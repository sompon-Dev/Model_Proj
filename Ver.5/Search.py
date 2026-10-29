import pickle
from pathlib import Path

import torch
from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import TfidfVectorizer

from textproc import preprocess

BASE_PATH = Path(__file__).parent
W_DENSE   = 0.3   # น้ำหนักความหมาย (embedding) ส่วนที่เหลือเป็นน้ำหนักคำที่ตรงกัน (TF-IDF)

# 1. โหลด embedding ของ chunk และ metadata
# weights_only=True บอก torch.load ว่าไฟล์นี้มีแค่ตัวเลข/tensor ไม่มีโค้ด Python แอบฝังมา
# (ป้องกันความเสี่ยงด้านความปลอดภัยถ้าไฟล์ .pt มาจากที่ไม่น่าเชื่อถือ ไม่เกี่ยวกับความแม่นยำของโมเดล)
embeddings = torch.load(BASE_PATH / "chunks_embeddings.pt", weights_only=True)
with open(BASE_PATH / "chunks_metadata.pkl", "rb") as f:
    meta = pickle.load(f)
songs, chunks = meta["songs"], meta["chunks"]

model = SentenceTransformer("intfloat/multilingual-e5-base")

# 2. TF-IDF บนคำ (1 คำ + 2 คำติดกัน) คำที่หายากมีน้ำหนักมาก จึงจับเนื้อที่ตรงตัวได้ดี
# token_pattern=r"\S+": ตัดคำด้วย "กลุ่มตัวอักษรที่ไม่ใช่ช่องว่าง" (เพราะข้อความผ่าน preprocess()
#   ตัดคำไทยมาเป็นคำๆ เว้นวรรคแล้ว ไม่ต้องใช้ pattern คำอังกฤษ \w+ ของ sklearn ที่ตัดวรรณยุกต์ไทยหลุด)
# ngram_range=(1,2): เก็บทั้งคำเดี่ยว ("รัก") และคำคู่ติดกัน ("รัก เธอ") เป็น feature แยกกัน
# sublinear_tf=True: ใช้ 1+log(จำนวนครั้งที่คำนั้นปรากฏ) แทนจำนวนครั้งตรงๆ กันคำซ้ำถี่เกินไปมีน้ำหนักเวอร์
tfidf = TfidfVectorizer(token_pattern=r"\S+", ngram_range=(1, 2), sublinear_tf=True)
chunk_tfidf = tfidf.fit_transform(c["text"] for c in chunks)  # fit_transform รับ generator ได้ตรงๆ ไม่ต้องสร้าง list ก่อน; ผลลัพธ์เป็น sparse matrix (เก็บแต่ช่องที่ไม่ใช่ 0 ประหยัดหน่วยความจำ)


def reload_index():
    """โหลด chunks_embeddings.pt / chunks_metadata.pkl ใหม่จากดิสก์ แล้วแก้ตัวแปร module-level
    (embeddings, songs, chunks, tfidf, chunk_tfidf) ตรงๆ — เรียกหลังจาก BuildindexUpdate.update_index()
    เขียนทับไฟล์ไปแล้ว เพื่อให้ search() ที่รันอยู่ในโปรเซสเดียวกัน (container เดิมที่ยังไม่ cold start
    ใหม่) เห็นเพลงที่เพิ่งเทรนเพิ่มทันที ไม่ต้องรอ container รีสตาร์ท"""
    global embeddings, songs, chunks, tfidf, chunk_tfidf
    embeddings = torch.load(BASE_PATH / "chunks_embeddings.pt", weights_only=True)
    with open(BASE_PATH / "chunks_metadata.pkl", "rb") as f:
        meta = pickle.load(f)
    songs, chunks = meta["songs"], meta["chunks"]
    tfidf = TfidfVectorizer(token_pattern=r"\S+", ngram_range=(1, 2), sublinear_tf=True)
    chunk_tfidf = tfidf.fit_transform(c["text"] for c in chunks)


def search(query_text, top_k=11, w_dense=W_DENSE):
    # 3. query ต้องผ่านการ clean + ตัดคำแบบเดียวกับตอนสร้าง index
    query = preprocess(query_text)
    if not query:
        return []

    # 4. คะแนนของแต่ละ chunk = ความหมายที่ใกล้กัน + คำที่ตรงกัน (ทั้งคู่อยู่ในช่วง 0-1)
    #model.encode("query: " + query, convert_to_tensor=True, normalize_embeddings=True)
        # * model.encode() คือการเปลี่ยนข้อความในตัวแปร query นั้นเป็นตัวเลข
        # * model.encode(convert_to_tensor=True) คือการให้ return ออกมาเป็น tensor โดยปกติจะมาเป็น numpy เอาไว้ให้การ์ดจอทำงาน ไวขึ้น
        # * model.encode(normalize_embeddings=True) คล้ายกับการปรับ Vector ให้โดยใช้ minmax ให้ค่าของมัน อยู่ที่ 1
    q_vec = model.encode("query: " + query, convert_to_tensor=True, normalize_embeddings=True)
    #((embeddings @ q_vec - 0.70) / 0.25).clamp(0, 1)
        # นำทุกเพลงนั้นมาจัดคะแนน(Score) ตามความใกล้เคียงของ input มีเป็น100เพลงก็จัดคะแนนทั้ง100เพลง นำมาลบ 0.70 เพื่อให้เพลงที่ไม่ใกล้เคียงมีค่า <0 จากนั้นก็ทำการscaling ให้มันอยู่ในค่าระหว่าง 0-1
        # เพลงที่ไม่ใกล้เคียงจะมีค่า == 0 มากกว่านั้นก็จะมีจัดได้ว่ามีความหมายใกล้เคียงกับ input
    dense = ((embeddings @ q_vec - 0.70) / 0.25).clamp(0, 1)   # cosine ของ E5 มักอยู่ราว 0.70-0.95
    #torch.tensor((chunk_tfidf @ tfidf.transform([query]).T).toarray().ravel(), dtype=torch.float32)
    # tfidf.transform([query]) แปลง query เป็นเวกเตอร์ TF-IDF แบบเดียวกับ chunk (sparse matrix รูปร่าง 1 แถว)
    # chunk_tfidf @ ...T คือคูณตาราง chunk ทุกแถวกับเวกเตอร์ query นี้ (คล้าย dense score แต่ใช้ TF-IDF)
    # ผลลัพธ์ยังเป็น sparse matrix รูปร่าง (n_chunks, 1) จึง .toarray() แปลงเป็นตารางเลขปกติ แล้ว .ravel()
    # ทำให้แบนเหลือ 1 มิติ (n_chunks,) สุดท้ายห่อด้วย torch.tensor ให้เป็นชนิดเดียวกับ dense เพื่อเอามาบวกกันได้
    lexical = torch.tensor((chunk_tfidf @ tfidf.transform([query]).T).toarray().ravel(), dtype=torch.float32)

    scores = w_dense * dense + (1 - w_dense) * lexical

    # 5. เรียง chunk จากคะแนนมากไปน้อย แล้วหยิบเพลงละ 1 ครั้ง (= chunk ที่ตรงที่สุดของเพลงนั้น)
    # scores.argsort(descending=True) ไม่ได้คืนคะแนนที่เรียงแล้ว แต่คืน "index" ของ chunk เรียงจาก
    # คะแนนมากไปน้อย (.tolist() แปลง tensor เป็น list ของเลข Python ธรรมดา วน for ตรงๆได้)
    # เพลงหนึ่งมีหลาย chunk ซึ่งอาจติดอันดับสูงหลายอัน จึงใช้ set "seen" กันไม่ให้เพลงเดียวกันโผล่ซ้ำในผลลัพธ์
    results, seen = [], set()
    for i in scores.argsort(descending=True).tolist():
        song_idx = chunks[i]["song_idx"]
        if song_idx in seen:
            continue
        seen.add(song_idx)
        results.append({
            **songs[song_idx],                      # **dict คือ unpack เอาทุก key-value ของ songs[song_idx] (song_name, artist) มารวมเข้า dict ใหม่นี้เลย
            "score": scores[i].item(),
            "matched_text": chunks[i]["text"],      # ท่อนที่ตรงที่สุด (ไว้โชว์/debug)
        })
        if len(results) == top_k:   # เก็บพอ top_k เพลงแล้วเลิกวนต่อทันที ไม่ต้องไล่ดู chunk ที่เหลือทั้งหมด
            break
    return results


# ทดสอบใช้งาน: รัน python Search.py แล้วพิมพ์เนื้อร้อง (กด Enter เปล่าๆ เพื่อออก)
if __name__ == "__main__":
    while True:
        text = input("เนื้อร้อง : ").strip()
        if not text:
            break
        for rank, r in enumerate(search(text), start=1):
            print(f"{rank:>2}. {r['song_name']} - {r['artist']}  ({r['score'] * 100:.1f}%)")
            print(f"    ท่อนที่ตรง: {r['matched_text'].replace(' ', '')}")
        print()
