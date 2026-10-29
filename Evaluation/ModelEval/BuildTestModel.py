"""
BuildTestModel.py
สร้าง TestModel.csv — สุ่ม 1000 เพลงจากเพลงที่มีอยู่จริงใน Ver.5 (เฉพาะฝั่ง DatasetInput ที่เป็น
เพลงใหม่ ไม่รวม 80 เพลงเดิมจาก CleanedData เพราะเก็บเนื้อเพลงคนละรูปแบบ — ดูเหตุผลเต็มใน
Test/Performance_Investigation.md ไม่เกี่ยว แค่โน้ตไว้ที่นี่ว่าตัดส่วนนี้ออกเพื่อความสอดคล้อง)

แต่ละแถวมี 42 คอลัมน์:
  1. ชื่อเพลง
  2. ชื่อศิลปิน
  3-22. ตัวอย่างเพลง1คำ ... ตัวอย่างเพลง20คำ  — คำ "ต้น" ของเนื้อเพลงจริง ตัดยาวขึ้นทีละคำ
         (คำต่อกันไม่เว้นวรรค เหมือนคนพิมพ์จริงในแอป ตาม convention เดียวกับ BuildTestCase.py)
  23-42. ผลของเนื้อเพลง1คำ ... ผลของเนื้อเพลง20คำ — ว่างไว้ก่อน ให้ RunModelEval.py มาเติมทีหลัง
"""
import csv
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "Ver.5"))
from textproc import preprocess

BASE_PATH      = Path(__file__).parent
DATASET_INPUT  = BASE_PATH.parent.parent / "DatasetInput"
NEW_SONG_FILES = ["famous_with_genre.csv", "songs_enriched.csv"]   # ชุดเดียวกับ Ver.5/Buildindex.py

OUT_FILE  = BASE_PATH / "TestModel.csv"
N_SAMPLE  = 1000
MAX_WORDS = 20
SEED      = 42

QUERY_COLS  = [f"ตัวอย่างเพลง{n}คำ" for n in range(1, MAX_WORDS + 1)]
RESULT_COLS = [f"ผลของเนื้อเพลง{n}คำ" for n in range(1, MAX_WORDS + 1)]
FIELDNAMES  = ["ชื่อเพลง", "ชื่อศิลปิน"] + QUERY_COLS + RESULT_COLS


def main():
    rng = random.Random(SEED)

    # รวมเพลงใหม่จากทั้ง 2 ไฟล์ ตัดซ้ำด้วย (name, artist) แบบเดียวกับ Ver.5/Buildindex.py
    seen = set()
    songs = []
    for fname in NEW_SONG_FILES:
        with open(DATASET_INPUT / fname, encoding="utf-8-sig", newline="") as f:
            rows = list(csv.DictReader(f))
        added = 0
        for row in rows:
            key = (row["name"], row["artist"])
            if key in seen:
                continue
            seen.add(key)
            songs.append(row)
            added += 1
        print(f"{fname}: {added} เพลงใหม่ (จากทั้งหมด {len(rows)} แถว)")
    print(f"รวมเพลงทั้งหมด (ตัดซ้ำแล้ว): {len(songs)}\n")

    # เพลงที่เนื้อเพลงสั้นกว่า MAX_WORDS คำ ใช้ไม่ได้ (คอลัมน์ "ตัวอย่างเพลง20คำ" จะไม่มีข้อมูลพอ)
    eligible = []
    for row in songs:
        tokens = preprocess(row["lyric"]).split()
        if len(tokens) >= MAX_WORDS:
            eligible.append((row, tokens))
    print(f"เพลงที่เนื้อเพลงยาวพอ (>= {MAX_WORDS} คำ): {len(eligible)}/{len(songs)}")

    sample = rng.sample(eligible, min(N_SAMPLE, len(eligible)))
    print(f"สุ่มมาใช้: {len(sample)} เพลง (seed={SEED})\n")

    out_rows = []
    for row, tokens in sample:
        record = {"ชื่อเพลง": row["name"], "ชื่อศิลปิน": row["artist"]}
        for n in range(1, MAX_WORDS + 1):
            record[f"ตัวอย่างเพลง{n}คำ"] = "".join(tokens[:n])   # คำแรกๆ ของเนื้อเพลง ต่อกันไม่เว้นวรรค
        for col in RESULT_COLS:
            record[col] = ""   # ว่างไว้ก่อน รอ RunModelEval.py เติม
        out_rows.append(record)

    with open(OUT_FILE, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDNAMES)
        w.writeheader()
        w.writerows(out_rows)
    print(f"✓ บันทึก {OUT_FILE} ({len(out_rows)} แถว x {len(FIELDNAMES)} คอลัมน์)")


if __name__ == "__main__":
    main()
