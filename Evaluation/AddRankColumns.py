"""
AddRankColumns.py
สำหรับแต่ละแถวใน TestCase_2.csv และแต่ละคอลัมน์ "เนื้อเพลงNคำ" (N = 10..1): เอาข้อความในคอลัมน์
นั้นไปถามโมเดลค้นหาของ Ver.5 เหมือนพิมพ์ในแอปจริง ให้โมเดลคืนลิสต์มา top_k=50 เพลง แล้วเช็กว่า
เพลงที่ถูกต้อง (Song name, artist ของแถวนั้น) อยู่อันดับที่เท่าไหร่ในลิสต์ 50 อันดับนั้น
บันทึกเลขอันดับ (1-50) ลงคอลัมน์ "อันดับที่ถูกต้อง_Nคำ" — ถ้าไม่ติด 50 อันดับแรก บันทึกเป็น
"ไม่ติด Top 50" แทน

ทำไมไม่เรียก search() ตรงๆ ทีละคำค้น: มีคำค้นทั้งหมด 7,828 แถว x 10 คอลัมน์ = 78,280 คำค้น
ถ้าเรียก model.encode() ทีละคำค้นจะช้ามาก (หลายชั่วโมง) สคริปต์นี้เลยเลี่ยงไปใช้ embedding/tfidf
ที่โหลดไว้ใน Search.py โดยตรง แล้ว encode เป็นชุดใหญ่ (batch) ทีเดียวหลายร้อยคำค้น เร็วกว่ามาก
ตรรกะการให้คะแนน (dense+lexical ถ่วงน้ำหนัก, เรียง, เลือกเพลงละ 1 chunk) เหมือนกับใน search()
เป๊ะ แค่ทำเป็นชุดแทนทีละคำค้น — ผลลัพธ์ตรงกับเรียก Search.py ตรงๆ ทุกกรณี

พิมพ์ความคืบหน้าระหว่างทางเพื่อเขียนลง log ไฟล์ได้ (งานนี้คาดว่าใช้เวลานาน)

ใช้: python AddRankColumns.py <TestCase_2.csv> <Ver.5>
"""
import csv
import importlib.util
import sys
import time
from pathlib import Path

import numpy as np
import torch

BASE_PATH  = Path(__file__).parent
WORD_COLS  = [f"เนื้อเพลง{n}คำ" for n in range(10, 0, -1)]
RANK_COLS  = [f"อันดับที่ถูกต้อง_{n}คำ" for n in range(10, 0, -1)]
BATCH_SIZE = 300
TOP_K = 50
NOT_IN_TOP_K  = f"ไม่ติด Top {TOP_K}"
NOT_IN_CORPUS = "ไม่มีในคลัง"   # กันไว้เฉยๆ เผื่อเพลงไหนหลุดไม่อยู่ในคลังจริงๆ (ไม่ควรเกิดกับ Ver.5)


def load_search_module(mod_name, search_py_path):
    """โหลด Search.py ของ Ver.4/Ver.5 แยกกันไม่ให้ชนกัน (ทั้งคู่ชื่อไฟล์ Search.py เหมือนกัน
    ใช้ importlib ตรงๆ แทน import ปกติ)"""
    folder = search_py_path.parent
    old_syspath = list(sys.path)
    sys.path.insert(0, str(folder))
    try:
        spec = importlib.util.spec_from_file_location(mod_name, search_py_path)
        module = importlib.util.module_from_spec(spec)
        sys.modules[mod_name] = module
        spec.loader.exec_module(module)
        return module
    finally:
        sys.path[:] = old_syspath


def _song_key_to_idx(sm):
    return {(s["song_name"], s["artist"]): i for i, s in enumerate(sm.songs)}


def _rank_in_top_k(song_idx_per_chunk, order_col, target_song_idx):
    """เดินไล่ chunk ตามลำดับคะแนน (order_col) เก็บเพลงละ 1 ครั้ง (chunk แรกสุด/คะแนนสูงสุดของ
    เพลงนั้น) เหมือน search() จริง หยุดทันทีที่เจอเพลงเป้าหมาย หรือครบ TOP_K เพลงแล้วยังไม่เจอ
    เร็วกว่าการหาอันดับแบบเต็ม เพราะไม่ต้องไล่ทั้ง chunk list ถ้าไม่เจอใน TOP_K ก็เลิกไล่ต่อเลย"""
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


def batch_ranks(sm, queries, targets, song_idx_per_chunk, key_to_idx):
    from textproc import preprocess  # อยู่ในโฟลเดอร์เดียวกับ sm (ผ่าน sys.path ตอนโหลด sm)

    results = []
    for start in range(0, len(queries), BATCH_SIZE):
        batch_q = queries[start:start + BATCH_SIZE]
        batch_t = targets[start:start + BATCH_SIZE]
        prepped = [preprocess(q) for q in batch_q]

        q_vecs = sm.model.encode(
            ["query: " + p for p in prepped], convert_to_tensor=True,
            normalize_embeddings=True, batch_size=64, show_progress_bar=False,
        )   # (B, 768)
        dense = ((sm.embeddings @ q_vecs.T - 0.70) / 0.25).clamp(0, 1)   # (n_chunks, B)

        q_tfidf = sm.tfidf.transform(prepped)                            # (B, vocab) sparse
        lexical = torch.tensor(
            (sm.chunk_tfidf @ q_tfidf.T).toarray(), dtype=torch.float32
        )   # (n_chunks, B)

        scores = sm.W_DENSE * dense + (1 - sm.W_DENSE) * lexical         # (n_chunks, B)
        order = scores.argsort(dim=0, descending=True).numpy()           # (n_chunks, B)

        for j in range(len(batch_q)):
            target_song_idx = key_to_idx.get(batch_t[j])
            if target_song_idx is None:
                results.append(NOT_IN_CORPUS)
                continue
            rank = _rank_in_top_k(song_idx_per_chunk, order[:, j], target_song_idx)
            results.append(rank if rank is not None else NOT_IN_TOP_K)

        done = start + len(batch_q)
        print(f"  กำลังทำเพลงที่ {done}/{len(queries)}", flush=True)
    return results


def main(csv_path, model_name):
    csv_path = Path(csv_path)
    search_py = BASE_PATH.parent / model_name / "Search.py"
    print(f"โหลด {model_name}/Search.py ...", flush=True)
    sm = load_search_module(f"search_{model_name}", search_py)
    print(f"  {len(sm.songs)} เพลง / {len(sm.chunks)} chunks\n", flush=True)

    song_idx_per_chunk = np.array([c["song_idx"] for c in sm.chunks])
    key_to_idx = _song_key_to_idx(sm)

    with open(csv_path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    # เติม RANK_COLS เข้า fieldnames ถ้ายังไม่มี (เผื่อไฟล์มีคอลัมน์ว่างเตรียมไว้ก่อนแล้ว)
    for col in RANK_COLS:
        if col not in fieldnames:
            fieldnames = fieldnames + [col]

    targets = [(r["Song name"], r["artist"]) for r in rows]
    t_start = time.time()

    for word_col, rank_col in zip(WORD_COLS, RANK_COLS):
        print(f"=== คอลัมน์ '{word_col}' ({len(rows)} แถว) top_k={TOP_K} ===", flush=True)
        queries = [r[word_col] for r in rows]
        ranks = batch_ranks(sm, queries, targets, song_idx_per_chunk, key_to_idx)
        for r, rank in zip(rows, ranks):
            r[rank_col] = rank

        with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames)
            w.writeheader()
            w.writerows(rows)

        found1 = sum(1 for r in ranks if r == 1)
        not_top50 = sum(1 for r in ranks if r == NOT_IN_TOP_K)
        elapsed_total = (time.time() - t_start) / 60
        print(f"--- เสร็จคอลัมน์ '{word_col}' | เจออันดับ 1 พอดี {found1}/{len(rows)} "
              f"| ไม่ติด Top {TOP_K}: {not_top50}/{len(rows)} | เวลารวมตั้งแต่เริ่ม {elapsed_total:.1f} นาที "
              f"| บันทึกไฟล์แล้ว ---\n", flush=True)

    print(f"เสร็จแล้ว! บันทึกทับ {csv_path} ครบทั้ง {len(RANK_COLS)} คอลัมน์", flush=True)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("ใช้: python AddRankColumns.py <TestCase_2.csv> <Ver.5>")
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
