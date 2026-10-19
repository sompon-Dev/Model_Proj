
import pickle
import sys
from pathlib import Path

import pandas as pd
import torch
from sentence_transformers import SentenceTransformer

sys.path.insert(0, str(Path(__file__).parent))
from textproc import preprocess

BASE_PATH      = Path(__file__).parent
CLEANED_DATA   = BASE_PATH / "CleanedData"                       # เพลงเดิม 80 เพลง (มีโครงสร้างบรรทัด) — คัดลอกมาจาก Ver.4 ไว้ในนี้แล้ว ไม่ต้องไปอ่านข้าม folder อีก
DATASET_INPUT  = BASE_PATH.parent / "DatasetInput"               # เพลงใหม่ (เนื้อเพลงดิบก้อนเดียว)
NEW_SONG_FILES = ["famous_with_genre.csv", "songs_enriched.csv"]

INDEX_FILE     = BASE_PATH / "chunks_embeddings.pt"
METADATA_FILE  = BASE_PATH / "chunks_metadata.pkl"

WINDOW_LINE, STRIDE_LINE = 2, 1
WINDOW_TOK,  STRIDE_TOK  = 32, 16


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

# 1) เพลงเดิม 80 เพลง ------------------------------------------------
print("อ่านเพลงเดิมจาก CleanedData...")
for artist_folder in sorted(CLEANED_DATA.iterdir()):
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
seen_keys = set()   # Set ของจำนวณเอาไว้ทำการตรวจสอบเพลงซ้ำจากชื่อเพลงและชื่อศืลปิน
for fname in NEW_SONG_FILES:
    path = DATASET_INPUT / fname
    df = pd.read_csv(path, encoding="utf-8-sig")   # อ่านทั้งไฟล์เป็นตาราง (DataFrame) ทีเดียว
    added = 0
    for row in df.itertuples():   # วนทีละแถว เข้าถึงคอลัมน์แบบ row.ชื่อคอลัมน์ (เช่น row.name, row.artist)
        
        key = (row.name, row.artist)  # ใช้ tuple (ชื่อเพลง, ศิลปิน) เป็น key เดียว กันเพลงชื่อซ้ำข้ามศิลปินถูกนับว่าเป็นเพลงเดียวกันผิดๆ
        # ถ้า keyในที่นี้คือ ชื่อเพลง,ชื่อศิลปิน มีในsetของseen_keys แปลว่ามีเพลงนี้มาตรวจสอบก่อนหน้านั้นแล้วเท่ากับว่าเพลงซ้ำก็ข้ามไป loop ถัดไป
        if key in seen_keys:
            continue
        # ไม่มีใน set seen_keys ก็เพิ่มเอาไว้เพื่อกันซ้ำกับเพลงที่กำลังloop นี้
        seen_keys.add(key)
        # แบ่งคำโดยใข้คำสั่งจาก ไฟล์ textproc.preprocess
        tokens = preprocess(row.lyric).split()
        # ถ้าใน token ไม่คำเลยแม้แต่คำเดียวข้ามไป loop ถัดไป
        if not tokens:
            continue
        # กำหนดจำนวนเพลงเอาไว้ในตัวแปร song_idx
        song_idx = len(songs)
        # นำชื่อเพลง ใส่ใน column:song_name และนำชื่อศิลปินใส่ใน column:artist ในList song เอาไว้เป็น metadata
        songs.append({"song_name": row.name, "artist": row.artist})
        # นำหมายเลขเพลง(index)เข้าไปใส่ใน column:song_idx และนำ คำทีละคำไปใส่ในcolumn:text ใน list chunks
        for text in make_token_chunks(tokens):
            chunks.append({"song_idx": song_idx, "text": text})
        added += 1 
    #บอกว่าเสร็จไปกี่เพลงจากกี่เพลง
    print(f"  {fname}: {added} เพลงใหม่ (จากทั้งหมด {len(df)} แถว)")

#สรุปผลว่าเอาเพลงเข้าไปกี่เพลง
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

# p=2 คือใช้ L2 norm (ความยาวเวกเตอร์แบบปกติ สูตร sqrt(sum(x^2))) แล้วหารเวกเตอร์ด้วยความยาวนี้ ให้ความยาวกลายเป็น 1
# dim=1 คือ normalize ไปตามแต่ละแถว (แต่ละ chunk 1 แถว) ไม่ใช่รวมทั้งตาราง — เพื่อให้ dot product เท่ากับ cosine similarity
embeddings_norm = torch.nn.functional.normalize(embeddings, p=2, dim=1)

torch.save(embeddings_norm, INDEX_FILE)
with open(METADATA_FILE, "wb") as f:
    pickle.dump({"songs": songs, "chunks": chunks}, f)

print(f"✓ บันทึก index tensor ที่ : {INDEX_FILE}")
print(f"✓ บันทึก metadata ที่     : {METADATA_FILE}")
print("\nเสร็จแล้ว! รันไฟล์ Evaluate.py เพื่อวัดผล หรือ Search.py เพื่อทดสอบได้เลย")
