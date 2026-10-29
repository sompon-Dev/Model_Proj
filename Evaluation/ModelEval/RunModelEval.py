"""
RunModelEval.py
อ่าน TestModel.csv (1000 เพลง x คอลัมน์ "ตัวอย่างเพลงNคำ" N=1..20) แล้วสำหรับคำค้นแต่ละคอลัมน์
เอาไปถามโมเดลค้นหาของ Ver.5 เหมือนพิมพ์ในแอปจริง ให้คืนลิสต์มา top_k=50 เพลง แล้วเช็กว่าเพลงที่
ถูกต้อง (ชื่อเพลง/ชื่อศิลปินของแถวนั้น) อยู่อันดับที่เท่าไหร่ บันทึกเลขอันดับ (1-50) ลงคอลัมน์
"ผลของเนื้อเพลงNคำ" — ถ้าไม่ติด Top 50 บันทึกเป็น 0

รันทั้งหมด 3 รอบ ด้วยค่า w_dense ต่างกัน (เปลี่ยนแค่สัดส่วนถ่วงน้ำหนัก dense/lexical ตรรกะ
การให้คะแนนที่เหลือเหมือน search() ใน Search.py เป๊ะ):
  - DenseEval.csv   : w_dense=1.0 (ใช้ความหมาย/embedding ล้วน ไม่สน TF-IDF เลย)
  - LexicalEval.csv : w_dense=0.0 (ใช้ TF-IDF คำตรงตัวล้วน ไม่สนความหมาย)
  - HybridEval.csv  : w_dense=0.3 (ค่า W_DENSE จริงที่ระบบ deploy ใช้งานอยู่)

ทำไมไม่เรียก search() ตรงๆ ทีละคำค้น: 1000 แถว x 20 คอลัมน์ x 3 โมเดล = 60,000 คำค้น ถ้า
encode ทีละคำค้นจะช้ามาก สคริปต์นี้เลยใช้ embedding/tfidf ที่โหลดไว้ใน Search.py โดยตรง
encode เป็นชุดใหญ่ (batch) ทีเดียวหลายร้อยคำค้น เร็วกว่ามาก (แนวทางเดียวกับ
Evaluation/AddRankColumns.py ที่มีอยู่แล้วในโปรเจกต์)

ใช้: python RunModelEval.py
"""
import csv
import importlib.util
import sys
import time
from pathlib import Path

import numpy as np
import torch

BASE_PATH  = Path(__file__).parent
VER5_PATH  = BASE_PATH.parent.parent / "Ver.5"
TESTMODEL  = BASE_PATH / "TestModel.csv"

MAX_WORDS  = 20
QUERY_COLS  = [f"ตัวอย่างเพลง{n}คำ" for n in range(1, MAX_WORDS + 1)]
RESULT_COLS = [f"ผลของเนื้อเพลง{n}คำ" for n in range(1, MAX_WORDS + 1)]

BATCH_SIZE = 300
TOP_K = 50
NOT_IN_TOP_K = 0   # ไม่ติด Top 50 (ตามที่ยืนยันไว้ — ค่าตัวเลข ไม่ใช่ string กันปนกับอันดับจริง)

RUNS = [
    ("DenseEval.csv",   1.0),
    ("LexicalEval.csv", 0.0),
    ("HybridEval.csv",  0.3),
]


def load_search_module():
    """โหลด Ver.5/Search.py ด้วย importlib (ไม่ใช่ import ปกติ) เพราะไฟล์นี้รันโค้ดระดับ
    module ทันทีตอน import (โหลดโมเดล 768 มิติ + tensor 98,104 แถว) อยากคุมให้โหลดครั้งเดียว
    ตอนเริ่มสคริปต์ แล้วใช้ตัวแปรข้างในซ้ำได้ตลอดทั้ง 3 รอบ ไม่ต้องโหลดใหม่ทุกรอบ"""
    old_syspath = list(sys.path)
    sys.path.insert(0, str(VER5_PATH))
    try:
        spec = importlib.util.spec_from_file_location("search_ver5", VER5_PATH / "Search.py")
        module = importlib.util.module_from_spec(spec)
        sys.modules["search_ver5"] = module
        spec.loader.exec_module(module)
        return module
    finally:
        sys.path[:] = old_syspath


def _song_key_to_idx(sm):
    return {(s["song_name"], s["artist"]): i for i, s in enumerate(sm.songs)}


def _rank_in_top_k(song_idx_per_chunk, order_col, target_song_idx):
    seen = set()
    for i in order_col:
        song_idx = int(song_idx_per_chunk[i])
        if song_idx in seen:
            continue
        seen.add(song_idx)
        if song_idx == target_song_idx:
            return len(seen)
        if len(seen) >= TOP_K:
            break
    return None


def batch_ranks(sm, queries, targets, song_idx_per_chunk, key_to_idx, w_dense):
    from textproc import preprocess

    results = []
    for start in range(0, len(queries), BATCH_SIZE):
        batch_q = queries[start:start + BATCH_SIZE]
        batch_t = targets[start:start + BATCH_SIZE]
        prepped = [preprocess(q) for q in batch_q]

        q_vecs = sm.model.encode(
            ["query: " + p for p in prepped], convert_to_tensor=True,
            normalize_embeddings=True, batch_size=64, show_progress_bar=False,
        )
        dense = ((sm.embeddings @ q_vecs.T - 0.70) / 0.25).clamp(0, 1)

        q_tfidf = sm.tfidf.transform(prepped)
        lexical = torch.tensor(
            (sm.chunk_tfidf @ q_tfidf.T).toarray(), dtype=torch.float32
        )

        scores = w_dense * dense + (1 - w_dense) * lexical
        order = scores.argsort(dim=0, descending=True).numpy()

        for j in range(len(batch_q)):
            target_song_idx = key_to_idx.get(batch_t[j])
            rank = _rank_in_top_k(song_idx_per_chunk, order[:, j], target_song_idx)
            results.append(rank if rank is not None else NOT_IN_TOP_K)

        done = start + len(batch_q)
        print(f"    {done}/{len(queries)}", flush=True)
    return results


def main():
    print("โหลด Ver.5/Search.py ...", flush=True)
    sm = load_search_module()
    print(f"  {len(sm.songs)} เพลง / {len(sm.chunks)} chunks\n", flush=True)

    song_idx_per_chunk = np.array([c["song_idx"] for c in sm.chunks])
    key_to_idx = _song_key_to_idx(sm)

    with open(TESTMODEL, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)
    print(f"โหลด {TESTMODEL.name}: {len(rows)} แถว\n", flush=True)

    targets = [(r["ชื่อเพลง"], r["ชื่อศิลปิน"]) for r in rows]

    t_start_all = time.time()
    for out_name, w_dense in RUNS:
        out_path = BASE_PATH / out_name
        print(f"===== {out_name} (w_dense={w_dense}) =====", flush=True)
        out_rows = [dict(r) for r in rows]   # copy ทุกคอลัมน์จาก TestModel.csv มาตั้งต้น

        t_start = time.time()
        for query_col, result_col in zip(QUERY_COLS, RESULT_COLS):
            queries = [r[query_col] for r in rows]
            ranks = batch_ranks(sm, queries, targets, song_idx_per_chunk, key_to_idx, w_dense)
            for r, rank in zip(out_rows, ranks):
                r[result_col] = rank

            found1 = sum(1 for r in ranks if r == 1)
            not_found = sum(1 for r in ranks if r == NOT_IN_TOP_K)
            print(f"  '{query_col}': เจออันดับ 1 พอดี {found1}/{len(rows)} | "
                  f"ไม่ติด Top {TOP_K}: {not_found}/{len(rows)}", flush=True)

        with open(out_path, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames)
            w.writeheader()
            w.writerows(out_rows)

        elapsed = (time.time() - t_start) / 60
        print(f"✓ บันทึก {out_path} ({elapsed:.1f} นาที)\n", flush=True)

    elapsed_all = (time.time() - t_start_all) / 60
    print(f"เสร็จทั้งหมด! รวมเวลา {elapsed_all:.1f} นาที", flush=True)


if __name__ == "__main__":
    main()
