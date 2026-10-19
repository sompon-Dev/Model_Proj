"""
วัดผลการค้นหาแบบ "พิมพ์ท่อนเนื้อร้องมาหาเพลง"
สุ่มท่อนจาก CleanedData แล้วดูว่าเพลงเจ้าของท่อนนั้นอยู่อันดับที่เท่าไร

เปรียบเทียบ 4 แบบ:
  Ver.3   : 1 เพลง = 1 vector, query ดิบ (ของเดิม อ่านไฟล์จาก ../Ver.3)
  dense   : Ver.4 chunk + embedding อย่างเดียว
  tfidf   : Ver.4 chunk + ตัวอักษรตรงกันอย่างเดียว (TF-IDF char n-gram)
  hybrid  : Ver.4 chunk + embedding + TF-IDF

ชุดทดสอบ (query พิมพ์ติดกันไม่เว้นวรรค เหมือนคนพิมพ์จริง)
  1line exact  : 1 บรรทัดตรงตัว
  1line drop   : 1 บรรทัด ทิ้งคำ 40% (จำไม่ครบ)
  1line swap   : 1 บรรทัด เปลี่ยน 30% ของคำเป็นคำสุ่ม (จำผิด)
  3line mixed  : 3 บรรทัด ทิ้ง 25% + เปลี่ยน 20%
"""
import pickle
import random
from pathlib import Path

import torch
from sentence_transformers import SentenceTransformer

import Search  # Ver.4

N_QUERIES     = 150
SEED          = 42

BASE_PATH = Path(__file__).parent
V3_PATH   = BASE_PATH.parent / "Ver.3"


def build_queries():
    rng = random.Random(SEED)
    songs, vocab = [], set()
    for artist_folder in sorted((BASE_PATH / "CleanedData").iterdir()):
        for txt in sorted(artist_folder.glob("*.txt")):
            lines = [l for l in txt.read_text(encoding="utf-8").splitlines() if l.strip()]
            vocab.update(w for l in lines for w in l.split())
            if lines:
                songs.append((txt.stem, artist_folder.name, lines))
    vocab = sorted(vocab)

    def sample(n_lines, drop=0.0, swap=0.0):
        out = []
        for _ in range(N_QUERIES):
            name, artist, lines = rng.choice([s for s in songs if len(s[2]) >= n_lines])
            start = rng.randrange(len(lines) - n_lines + 1)
            toks = " ".join(lines[start:start + n_lines]).split()
            # list comprehension พร้อม "or" ต่อท้าย: สุ่มทิ้งคำออกทีละคำ (จำลองคนจำเนื้อเพลงไม่ครบ)
            # ถ้าทิ้งจนเหลือ list เปล่า (falsy) "or toks[:1]" จะใช้คำแรกแทน กันเหลือคำค้นว่างเปล่าไปเลย
            toks = [t for t in toks if rng.random() >= drop] or toks[:1]
            # conditional expression ในนี้คือ "สุ่มคำจาก vocab ทั้งหมดมาแทนที่ ถ้าทอยเต่าได้ < swap" ต่อคำ
            # (จำลองคนจำเนื้อเพลงผิดเป็นคำอื่น) ไม่ใช่ครบทุกคำ — swap ยิ่งสูงยิ่งมีคำผิดเยอะ
            toks = [rng.choice(vocab) if rng.random() < swap else t for t in toks]  # จำผิดเป็นคำอื่น
            out.append(("".join(toks), name, artist))
        return out

    return {
        "1line exact":       sample(1),
        "1line drop40%":     sample(1, drop=0.40),
        "1line swap30%":     sample(1, swap=0.30),
        "3line drop25%+sw20": sample(3, drop=0.25, swap=0.20),
    }


def rank_of(results, name, artist):
    for i, r in enumerate(results):
        if r["song_name"] == name and r["artist"] == artist:
            return i + 1
    return None


def make_v3_search():
    emb = torch.load(V3_PATH / "songs_embeddings.pt", weights_only=True)
    with open(V3_PATH / "songs_metadata.pkl", "rb") as f:
        meta = pickle.load(f)
    model = SentenceTransformer("intfloat/multilingual-e5-base")

    def search(q, top_k=11):
        # เหมือน Ver.3/Search.py: encode คำค้น -> normalize (dim=0 เพราะเป็นเวกเตอร์เดี่ยว) -> คูณเมทริกซ์
        # กับ embedding ทุกเพลง (cosine similarity ของทุกเพลงพร้อมกัน) -> topk ดึง k อันดับบนสุด (คะแนน+ตำแหน่ง)
        v = torch.nn.functional.normalize(model.encode(q, convert_to_tensor=True), p=2, dim=0)
        s, idx = torch.topk(torch.matmul(emb, v), k=min(top_k, emb.shape[0]))
        return [{"song_name": meta[i]["song_name"], "artist": meta[i]["artist"]} for i in idx.tolist()]
    return search


def main():
    engines = {}
    if (V3_PATH / "songs_embeddings.pt").exists():
        engines["Ver.3"] = make_v3_search()
    for name, w in (("dense", 1.0), ("tfidf", 0.0), ("hybrid", Search.W_DENSE)):
        # "w=w" ใน lambda ไม่ใช่ typo — นี่คือวิธีแก้ปัญหาคลาสสิกของ Python: ถ้าเขียนแค่ "lambda q: Search.search(q, ..., w_dense=w)"
        # ตัวแปร w ใน lambda จะไปอ้างอิงตัวแปร w ของ loop ตรงๆ (closure) พอ loop ทำงานจบแล้ว w จะเหลือค่าสุดท้ายของ loop
        # ทำให้ lambda ทุกตัวใน dict นี้ใช้ w ตัวเดียวกัน (ค่าสุดท้าย) ผิดเพี้ยนหมด การเขียน w=w (default argument)
        # บังคับให้ lambda "จำ" ค่า w ของรอบนั้นๆไว้เป็นของตัวเองตอนสร้าง ไม่ใช่ไปอ้างอิงตัวแปรภายนอกที่เปลี่ยนค่าได้
        engines[name] = lambda q, w=w: Search.search(q, top_k=11, w_dense=w)

    sets = build_queries()
    print(f"เพลงทั้งหมด {len(Search.songs)} เพลง / {len(Search.chunks)} chunks / {N_QUERIES} queries ต่อชุด\n")
    print(f"{'ชุดทดสอบ':<19} {'engine':<8} {'Top-1':>7} {'Top-3':>7} {'Top-5':>7} {'MRR':>7}")
    print("-" * 59)
    for set_name, queries in sets.items():
        for eng_name, fn in engines.items():
            ranks = [rank_of(fn(q), n, a) for q, n, a in queries]
            # top(k) นิยามเป็น lambda ใช้แค่ในลูปรอบนี้: นับว่ากี่ query ที่เพลงถูกต้องอยู่ในอันดับ <= k
            # หารด้วยจำนวน query ทั้งหมด = สัดส่วน (เช่น Top-1 = สัดส่วนที่เพลงถูกเจออันดับ 1 พอดี)
            top = lambda k: sum(1 for r in ranks if r and r <= k) / len(ranks)
            # MRR (Mean Reciprocal Rank): เฉลี่ยของ 1/อันดับ ของทุก query ที่เจอ (r ที่เป็น None/ไม่เจอ ถูกกรองออกด้วย "if r")
            # ยิ่งเจอเร็ว (อันดับน้อย) 1/r ยิ่งเข้าใกล้ 1 ยิ่งไม่เจอเลยไม่ถูกนับเข้าค่าเฉลี่ยนี้
            mrr = sum(1 / r for r in ranks if r) / len(ranks)
            print(f"{set_name:<19} {eng_name:<8} {top(1):>7.1%} {top(3):>7.1%} {top(5):>7.1%} {mrr:>7.3f}")
        print()


if __name__ == "__main__":
    main()
