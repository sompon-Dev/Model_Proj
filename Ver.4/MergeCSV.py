"""
MergeCSV.py
รวมเนื้อเพลงที่ clean แล้วทุกเพลง → ไฟล์ CSV ไฟล์เดียว
กด Run ได้เลย
"""

import csv
from pathlib import Path

# ─────────────────────────────────────────────
# กำหนด path
# ─────────────────────────────────────────────
# INPUT_PATH  = Path(r"c:\Users\usEr\Documents\Wokr\Thesis\Ver.2\CleanedData")
# OUTPUT_FILE = Path(r"c:\Users\usEr\Documents\Wokr\Thesis\Ver.2\dataset.csv")
BASE_PATH   = Path(__file__).parent        # folder ที่ MergeCSV.py อยู่
INPUT_PATH  = BASE_PATH / "CleanedData"    # folder CleanedData ข้างๆ MergeCSV.py
OUTPUT_FILE = BASE_PATH / "dataset.csv"    # ไฟล์ CSV ที่จะสร้างข้างๆ MergeCSV.py



# ─────────────────────────────────────────────
# วน loop อ่านทุกไฟล์ใน CleanedData
# โครงสร้าง: CleanedData / ชื่อศิลปิน / ชื่อเพลง.txt
# ─────────────────────────────────────────────
rows = []  # เก็บข้อมูลทุกเพลงไว้ที่นี่

for artist_folder in sorted(INPUT_PATH.iterdir()):
    if not artist_folder.is_dir():
        continue

    artist_name = artist_folder.name  # ชื่อ folder = ชื่อศิลปิน

    for txt_file in sorted(artist_folder.glob("*.txt")):
        song_name = txt_file.stem      # ชื่อไฟล์ (ไม่มี .txt) = ชื่อเพลง
        lyrics    = txt_file.read_text(encoding="utf-8").replace("\n", " ").strip()

        rows.append({
            "lyrics_tokens": lyrics,
            "song_name":     song_name,
            "artist":        artist_name,
        })

        print(f"  ✓ {artist_name} — {song_name}")


# ─────────────────────────────────────────────
# บันทึกเป็น CSV
# ─────────────────────────────────────────────
with open(OUTPUT_FILE, "w", encoding="utf-8-sig", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["lyrics_tokens", "song_name", "artist"])
    writer.writeheader()
    writer.writerows(rows)

print(f"\nเสร็จแล้ว! รวมทั้งหมด {len(rows)} เพลง")
print(f"บันทึกที่: {OUTPUT_FILE}")