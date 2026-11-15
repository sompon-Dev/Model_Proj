import pickle
from pathlib import Path

import pandas as pd
import torch
from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import TfidfVectorizer

from textproc import preprocess

BASE_PATH = Path(__file__).parent
W_DENSE   = 0.2   # น้ำหนักความหมาย (embedding) ส่วนที่เหลือเป็นน้ำหนักคำที่ตรงกัน (TF-IDF)
# ค่า W_DENSE / DENSE_LO / DENSE_HI ได้จาก grid search 400 ชุดค่า บนชุด tune 1,000 เพลง (TestCase_2.csv)
# แล้วยืนยันบนชุด test อีก 1,000 เพลงที่ไม่ซ้ำกัน: MRR 0.8969 -> 0.9035, P@1 0.849 -> 0.858 (ค่าเดิม 0.3 / 0.70 / 0.95)
DENSE_LO  = 0.60  # cosine เท่านี้ -> dense = 0
DENSE_HI  = 0.90  # cosine เท่านี้ -> dense = 1

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
texts = []
for c in chunks:
    texts.append(c["text"])
chunk_tfidf = tfidf.fit_transform(texts)  # ผลลัพธ์เป็น sparse matrix (เก็บแต่ช่องที่ไม่ใช่ 0 ประหยัดหน่วยความจำ)


def reload_index():
    global embeddings, songs, chunks, tfidf, chunk_tfidf
    embeddings = torch.load(BASE_PATH / "chunks_embeddings.pt", weights_only=True)
    with open(BASE_PATH / "chunks_metadata.pkl", "rb") as f:
        meta = pickle.load(f)
    songs, chunks = meta["songs"], meta["chunks"]
    tfidf = TfidfVectorizer(token_pattern=r"\S+", ngram_range=(1, 2), sublinear_tf=True)
    texts = []
    for c in chunks:
        texts.append(c["text"])
    chunk_tfidf = tfidf.fit_transform(texts)


def search(query_text, top_k=11, w_dense=W_DENSE):
    # 3. query ต้องผ่านการ clean + ตัดคำแบบเดียวกับตอนสร้าง index
    query = preprocess(query_text)
    if not query:
        return []

    # 4. คะแนนของแต่ละ chunk = ความหมายที่ใกล้กัน + คำที่ตรงกัน (ทั้งคู่อยู่ราวๆ ช่วง 0-1)
    #model.encode(query, convert_to_tensor=True)
        # * model.encode() คือการเปลี่ยนข้อความในตัวแปร query นั้นเป็นตัวเลข
        # * model.encode(convert_to_tensor=True) คือการให้ return ออกมาเป็น tensor โดยปกติจะมาเป็น numpy เอาไว้ให้การ์ดจอทำงาน ไวขึ้น
        # * ไม่ต้องใส่ normalize_embeddings=True เพราะ E5 มีขั้น Normalize ในตัวอยู่แล้ว (ได้เวกเตอร์ยาว 1 เสมอ)
    q_vec = model.encode(query, convert_to_tensor=True)
    #(embeddings @ q_vec - DENSE_LO) / (DENSE_HI - DENSE_LO)
        # นำทุก chunk มาหา cosine กับ input แล้วยืดช่วง 0.60-0.90 ให้เป็น 0-1 (scaling) ให้อยู่ระดับเดียวกับ lexical
        # cosine ของ E5 กองอยู่ในช่วงแคบ (ราว 0.7-0.9) ถ้าไม่ยืด dense จะต่างกันน้อยจนแทบไม่มีผลกับอันดับ
        # ไม่ใส่ .clamp(0, 1) เพราะทดสอบ 1,000 เพลงแล้วผลแทบเท่าเดิม (P@1 ต่างกันไม่เกิน 0.002) โค้ดจะอธิบายง่ายกว่า
    dense = (embeddings @ q_vec - DENSE_LO) / (DENSE_HI - DENSE_LO)   # cosine ของ chunk ที่ถูกต้องอยู่ราว 0.81-0.91
    #torch.tensor((chunk_tfidf @ tfidf.transform([query]).T).toarray().ravel(), dtype=torch.float32)
    # tfidf.transform([query]) แปลง query เป็นเวกเตอร์ TF-IDF แบบเดียวกับ chunk (sparse matrix รูปร่าง 1 แถว)
    # chunk_tfidf @ ...T คือคูณตาราง chunk ทุกแถวกับเวกเตอร์ query นี้ (คล้าย dense score แต่ใช้ TF-IDF)
    # ผลลัพธ์ยังเป็น sparse matrix รูปร่าง (n_chunks, 1) จึง .toarray() แปลงเป็นตารางเลขปกติ แล้ว .ravel()
    # ทำให้แบนเหลือ 1 มิติ (n_chunks,) สุดท้ายห่อด้วย torch.tensor ให้เป็นชนิดเดียวกับ dense เพื่อเอามาบวกกันได้
    lexical = torch.tensor((chunk_tfidf @ tfidf.transform([query]).T).toarray().ravel(), dtype=torch.float32)

    scores = w_dense * dense + (1 - w_dense) * lexical

    # 5. ทำตาราง chunk_score: 1 แถว = 1 chunk (เพลงไหน / เนื้อท่อนนั้น / คะแนน)
    chunk_score = pd.DataFrame(chunks)        # chunks เป็น list ของ dict -> ได้คอลัมน์ song_idx กับ text
    chunk_score["score"] = scores.numpy()     # เพิ่มคอลัมน์คะแนน

    # เรียงคะแนนมาก -> น้อย, ตัดเพลงซ้ำ (เก็บ chunk ที่คะแนนสูงสุดของแต่ละเพลง), เอา top_k เพลงแรก
    # ตัดซ้ำด้วย song_idx ไม่ใช่ song_name เพราะชื่อเพลงซ้ำกันได้ถ้าคนละศิลปิน
    chunk_score_sorted = (chunk_score.sort_values("score", ascending=False)
                                     .drop_duplicates("song_idx")
                                     .head(top_k))

    # ทำตาราง result: เติมชื่อเพลงและศิลปินจาก song_idx
    result = chunk_score_sorted.copy()
    result["song_name"] = [songs[i]["song_name"] for i in result["song_idx"]]
    result["artist"]    = [songs[i]["artist"] for i in result["song_idx"]]
    result = result[["song_name", "artist", "text", "score"]]

    return result.to_dict("records")    # แปลงเป็น list ของ dict ให้ FastAPI ส่ง JSON ได้


# ทดสอบใช้งาน: รัน python Search.py แล้วพิมพ์เนื้อร้อง (กด Enter เปล่าๆ เพื่อออก)
if __name__ == "__main__":
    while True:
        text = input("เนื้อร้อง : ").strip()
        if not text:
            break
        for rank, r in enumerate(search(text), start=1):
            print(f"{rank:>2}. {r['song_name']} - {r['artist']}  ({r['score'] * 100:.1f}%)")
            print(f"    ท่อนที่ตรง: {r['text'].replace(' ', '')}")
        print()
