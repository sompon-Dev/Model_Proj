"""
Buildindex.py (Ver.5)
เหมือน Ver.4 ทุกอย่าง (chunk + embed ด้วย multilingual-e5-base, hybrid dense+lexical ที่ Search.py)
ต่างแค่จำนวนเพลงในคลัง — Ver.5 รวมเพลงเดิมของ Ver.4 (80 เพลง) เข้ากับเพลงที่เพิ่งเพิ่มเข้าฐานข้อมูล
จาก DatasetInput (famous_with_genre.csv + songs_enriched.csv) สร้างมาเพื่อทดสอบว่า dataset
ที่ใหญ่ขึ้นมาก (~80 -> ~7,900 เพลง) มีผลต่อความแม่นยำของการค้นหาหรือไม่ (เทียบกับ Ver.4 ใน Evaluate.py)

ความต่างในการ chunk:
  - เพลงเดิมของ Ver.4 (CleanedData) มีโครงสร้างบรรทัด (1 บรรทัด = 1 วรรค) จึง chunk แบบเดิม
    คือหน้าต่าง 2 บรรทัด เลื่อนทีละ 1 บรรทัด
  - เพลงใหม่จาก DatasetInput เป็นเนื้อเพลงดิบ 1 ก้อนยาว ไม่มีการตัดบรรทัด (ไม่ได้ผ่าน Clean.py)
    จึง clean+ตัดคำด้วย textproc.preprocess() ก่อน แล้ว chunk แบบหน้าต่าง "คำ" แทน (WINDOW_TOK คำ
    เลื่อนทีละ STRIDE_TOK คำ สัดส่วนทับซ้อน 50% เท่ากับฝั่งบรรทัดของ Ver.4)
"""
import csv
import pickle
import sys
from pathlib import Path

import torch
from sentence_transformers import SentenceTransformer

sys.path.insert(0, str(Path(__file__).parent))
from textproc import preprocess

BASE_PATH      = Path(__file__).parent
VER4_CLEANED   = BASE_PATH.parent / "Ver.4" / "CleanedData"     # เพลงเดิม 80 เพลง (มีโครงสร้างบรรทัด)
DATASET_INPUT  = BASE_PATH.parent / "DatasetInput"               # เพลงใหม่ (เนื้อเพลงดิบก้อนเดียว)
NEW_SONG_FILES = ["famous_with_genre.csv", "songs_enriched.csv"]

INDEX_FILE     = BASE_PATH / "chunks_embeddings.pt"
METADATA_FILE  = BASE_PATH / "chunks_metadata.pkl"

WINDOW_LINE, STRIDE_LINE = 2, 1     # สำหรับเพลงเดิม (บรรทัด) เหมือน Ver.4
WINDOW_TOK,  STRIDE_TOK  = 32, 16   # สำหรับเพลงใหม่ (คำ) ทับซ้อน 50% แบบเดียวกัน


def make_line_chunks(lines):
    if len(lines) <= WINDOW_LINE:
        return [" ".join(lines)]
    return [" ".join(lines[i:i + WINDOW_LINE]) for i in range(0, len(lines) - WINDOW_LINE + 1, STRIDE_LINE)]


def make_token_chunks(tokens):
    if len(tokens) <= WINDOW_TOK:
        return [" ".join(tokens)]
    return [" ".join(tokens[i:i + WINDOW_TOK]) for i in range(0, len(tokens) - WINDOW_TOK + 1, STRIDE_TOK)]


songs  = []   # [{song_name, artist}]
chunks = []   # [{song_idx, text}]

# 1) เพลงเดิมของ Ver.4 ------------------------------------------------
print("อ่านเพลงเดิมจาก Ver.4/CleanedData...")
for artist_folder in sorted(VER4_CLEANED.iterdir()):
    if not artist_folder.is_dir():
        continue
    for txt_file in sorted(artist_folder.glob("*.txt")):
        lines = [l.strip() for l in txt_file.read_text(encoding="utf-8").splitlines() if l.strip()]
        if not lines:
            continue
        song_idx = len(songs)
        songs.append({"song_name": txt_file.stem, "artist": artist_folder.name})
        for text in make_line_chunks(lines):
            chunks.append({"song_idx": song_idx, "text": text})
n_old_songs, n_old_chunks = len(songs), len(chunks)
print(f"  เพลงเดิม {n_old_songs} เพลง -> {n_old_chunks} chunks\n")

# 2) เพลงใหม่จาก DatasetInput ------------------------------------------
print("อ่านเพลงใหม่จาก DatasetInput...")
seen_keys = set()   # (song_name, artist) กันเพลงซ้ำข้ามไฟล์ (famous_with_genre เป็นส่วนย่อยที่อาจซ้ำ)
for fname in NEW_SONG_FILES:
    path = DATASET_INPUT / fname
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    added = 0
    for row in rows:
        key = (row["name"], row["artist"])
        if key in seen_keys:
            continue
        seen_keys.add(key)
        tokens = preprocess(row["lyric"]).split()
        if not tokens:
            continue
        song_idx = len(songs)
        songs.append({"song_name": row["name"], "artist": row["artist"]})
        for text in make_token_chunks(tokens):
            chunks.append({"song_idx": song_idx, "text": text})
        added += 1
    print(f"  {fname}: {added} เพลงใหม่ (จากทั้งหมด {len(rows)} แถว)")

print(f"\nรวมทั้งหมด {len(songs)} เพลง ({n_old_songs} เดิม + {len(songs) - n_old_songs} ใหม่) "
      f"-> {len(chunks)} chunks ({n_old_chunks} เดิม + {len(chunks) - n_old_chunks} ใหม่)\n")

# 3) embed ----------------------------------------------------------
print("โหลดโมเดล multilingual-e5 (รองรับภาษาไทย)...")
model = SentenceTransformer("intfloat/multilingual-e5-base")
print("โหลดโมเดลสำเร็จ!\n")

print("กำลังแปลง chunk เป็น vector...")
embeddings = model.encode(
    ["passage: " + c["text"] for c in chunks],
    batch_size=64,
    show_progress_bar=True,
    convert_to_tensor=True,
)
print(f"\nแปลงสำเร็จ! ขนาด vector: {embeddings.shape}")

embeddings_norm = torch.nn.functional.normalize(embeddings, p=2, dim=1)

torch.save(embeddings_norm, INDEX_FILE)
with open(METADATA_FILE, "wb") as f:
    pickle.dump({"songs": songs, "chunks": chunks}, f)

print(f"✓ บันทึก index tensor ที่ : {INDEX_FILE}")
print(f"✓ บันทึก metadata ที่     : {METADATA_FILE}")
print("\nเสร็จแล้ว! รันไฟล์ Evaluate.py เพื่อวัดผล หรือ Search.py เพื่อทดสอบได้เลย")
