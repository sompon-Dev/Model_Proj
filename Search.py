"""
Search.py
รับเนื้อเพลงบางส่วน → ค้นหาจาก index → คืนชื่อเพลง + ศิลปิน

ต้องรัน BuildIndex.py ก่อนอย่างน้อย 1 ครั้ง

กด Run ได้เลย แล้วพิมพ์เนื้อเพลงที่ต้องการค้นหา
"""

import pickle
import numpy as np
import faiss
from pathlib import Path
from sentence_transformers import SentenceTransformer

# ─────────────────────────────────────────────
# กำหนด path แบบ relative
# ─────────────────────────────────────────────
BASE_PATH     = Path(__file__).parent
INDEX_FILE    = BASE_PATH / "songs.index"
METADATA_FILE = BASE_PATH / "songs_metadata.pkl"

# ─────────────────────────────────────────────
# PROCESS 1 — โหลดโมเดลและ index ที่ build ไว้แล้ว
# ทำไม: โหลดครั้งเดียวตอนเริ่ม ไม่ต้อง build ใหม่ทุกครั้งที่ค้นหา
# ─────────────────────────────────────────────
print("โหลดโมเดลและ index...")
model = SentenceTransformer("intfloat/multilingual-e5-base")
index = faiss.read_index(str(INDEX_FILE))

with open(METADATA_FILE, "rb") as f:
    metadata = pickle.load(f)

print(f"พร้อมค้นหาจาก {index.ntotal} เพลง\n")


# ─────────────────────────────────────────────
# ฟังก์ชันค้นหาเพลง
# ─────────────────────────────────────────────
def search(snippet: str, top_k: int = 3):
    """
    PROCESS 2 — ค้นหาเพลงจากเนื้อเพลงที่ป้อนเข้ามา
    ทำไม: แปลง snippet → vector แล้วหาว่า vector ไหนใกล้ที่สุดใน index
           ยิ่ง score ใกล้ 1.0 ยิ่งใกล้เคียงมาก
    top_k: แสดงผลกี่อันดับ (default 3)
    """

    # แปลง snippet เป็น vector
    query_vector = model.encode([snippet], convert_to_numpy=True)
    faiss.normalize_L2(query_vector)

    # ค้นหา top_k เพลงที่ใกล้เคียงที่สุด
    scores, indices = index.search(query_vector, top_k)

    # แสดงผล
    print(f"\nผลการค้นหา: \"{snippet}\"")
    print("─" * 40)
    for rank, (score, idx) in enumerate(zip(scores[0], indices[0]), start=1):
        song   = metadata[idx]["song_name"]
        artist = metadata[idx]["artist"]
        pct    = round(float(score) * 100, 1)
        print(f"  {rank}. {song} - {artist}  ({pct}%)")
    print()
# ─────────────────────────────────────────────
# PROCESS 3 — รับ input จากผู้ใช้วนซ้ำ
# พิมพ์ 'exit' เพื่อออก
# ─────────────────────────────────────────────
print("พิมพ์เนื้อเพลงที่ต้องการค้นหา (พิมพ์ 'exit' เพื่อออก)")
print("=" * 40)

while True:
    snippet = input("\nเนื้อเพลง: ").strip()
    if snippet.lower() == "exit":
        print("ออกจากโปรแกรม")
        break
    if not snippet:
        continue
    search(snippet)