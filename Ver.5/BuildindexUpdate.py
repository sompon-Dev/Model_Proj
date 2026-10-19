"""
BuildindexUpdate.py
อัปเดต index ที่มีอยู่แล้ว (chunks_embeddings.pt + chunks_metadata.pkl) ด้วยเพลงใหม่จาก
update_dataset.csv (ไฟล์ที่ AddUpdate.py สร้างไว้จากตาราง Train_Song) โดย "ไม่ต้อง encode
เพลงเก่าซ้ำเลย" ต่างจาก Buildindex.py ที่ทำใหม่ทั้งหมดทุกครั้ง

ทำไมทำแบบนี้ได้โดยไม่ต้องเทรนโมเดลใหม่: multilingual-e5-base เป็นโมเดลที่เทรนสำเร็จรูปมาแล้ว
encode() ข้อความเดิมได้ vector เดิมเสมอ (ไม่เปลี่ยนตามเวลา) เพลงเก่าที่ encode ไปแล้วจึงยังถูกต้อง
100% ไม่ต้องคำนวณซ้ำ — แค่ encode "เฉพาะ chunk ของเพลงใหม่" แล้วต่อ (concatenate) เข้ากับของเดิม

ส่วน TF-IDF ไม่ต้องทำอะไรเพิ่มเลย เพราะ Search.py fit ใหม่จาก chunks_metadata.pkl ทุกครั้งที่
เปิด server อยู่แล้ว (เร็ว ไม่ใช่คอขวด) แค่รันไฟล์นี้เสร็จแล้วรีสตาร์ท Ver.5/API.py ก็พอ

ใช้: python BuildindexUpdate.py [update_csv] [index_file] [metadata_file]
     ไม่ใส่ argument เลย = ใช้ไฟล์จริงของ Ver.5 ทั้งหมด (update_dataset.csv, chunks_embeddings.pt,
     chunks_metadata.pkl ที่อยู่ในโฟลเดอร์นี้) — ใส่ path อื่นมาแทนได้เพื่อทดสอบกับไฟล์สำรอง/ไฟล์เล็ก
     โดยไม่ไปแก้ของจริง
"""
import pickle
import sys
from pathlib import Path

# บนเครื่อง Windows ที่ locale เป็นไทย terminal มักใช้ codepage cp874 ซึ่งพิมพ์ตัวอักษรบางตัว
# (เช่น ✓) ไม่ได้ ถ้าไม่ตั้งค่านี้ก่อน print() ที่มีตัวอักษรนี้จะ error (UnicodeEncodeError)
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import pandas as pd
import torch
from sentence_transformers import SentenceTransformer

sys.path.insert(0, str(Path(__file__).parent))
from textproc import preprocess

BASE_PATH = Path(__file__).parent

WINDOW_TOK, STRIDE_TOK = 32, 16   # เหมือนกับ Buildindex.py เป๊ะ ต้อง chunk แบบเดียวกันไม่งั้น chunk เก่า/ใหม่จะไม่สอดคล้องกัน


def make_token_chunks(tokens):
    if len(tokens) <= WINDOW_TOK:
        return [" ".join(tokens)]
    return [" ".join(tokens[i:i + WINDOW_TOK]) for i in range(0, len(tokens) - WINDOW_TOK + 1, STRIDE_TOK)]


def load_existing_index(index_file, metadata_file):
    """โหลด index เดิมที่มีอยู่แล้ว คืน (embeddings tensor, songs list, chunks list)"""
    embeddings = torch.load(index_file, weights_only=True)
    with open(metadata_file, "rb") as f:
        meta = pickle.load(f)
    return embeddings, meta["songs"], meta["chunks"]


def collect_new_songs(update_csv, songs, chunks):
    """อ่าน update_dataset.csv เทียบกับ songs ที่มีอยู่แล้ว (กันซ้ำด้วย (song_name, artist))
    เพลงที่ยังไม่เคยอยู่ใน index จะถูกเพิ่มเข้า songs/chunks ตรงนี้เลย (แก้ list ที่ส่งเข้ามาตรงๆ)
    คืนค่า list ของ text ของ chunk ใหม่ทั้งหมด (ไว้เอาไป encode ต่อ) และจำนวนเพลงใหม่ที่เพิ่มได้"""
    seen_keys = {(s["song_name"], s["artist"]) for s in songs}   # เพลงที่อยู่ใน index อยู่แล้ว ห้ามเพิ่มซ้ำ
    df = pd.read_csv(update_csv, encoding="utf-8-sig")
    df["newsong_lyrics"] = df["newsong_lyrics"].fillna("")   # ช่องเนื้อเพลงว่างเปล่า pandas จะอ่านเป็น NaN (float) ไม่ใช่สตริงเปล่า ถ้าไม่เติมให้ก่อน preprocess() จะพังเพราะรับได้แต่ string

    new_chunk_texts = []
    added = 0
    skipped_dup = skipped_empty = 0
    for row in df.itertuples():
        key = (row.newsong_name, row.newsong_artist)
        if key in seen_keys:
            skipped_dup += 1
            continue
        seen_keys.add(key)

        tokens = preprocess(row.newsong_lyrics).split()
        if not tokens:
            skipped_empty += 1
            continue

        song_idx = len(songs)
        songs.append({"song_name": row.newsong_name, "artist": row.newsong_artist})
        for text in make_token_chunks(tokens):
            chunks.append({"song_idx": song_idx, "text": text})
            new_chunk_texts.append(text)
        added += 1

    print(f"  เพลงใหม่ที่เพิ่มได้: {added} | ข้ามเพราะซ้ำกับของเดิม: {skipped_dup} | ข้ามเพราะไม่มีเนื้อเพลง: {skipped_empty}")
    return new_chunk_texts, added


def update_index(update_csv, index_file, metadata_file):
    update_csv, index_file, metadata_file = Path(update_csv), Path(index_file), Path(metadata_file)

    print(f"โหลด index เดิมจาก {index_file.name} / {metadata_file.name} ...")
    embeddings, songs, chunks = load_existing_index(index_file, metadata_file)
    n_old_songs, n_old_chunks = len(songs), len(chunks)
    print(f"  ของเดิมมี {n_old_songs} เพลง / {n_old_chunks} chunks")

    print(f"\nอ่านเพลงใหม่จาก {update_csv.name} ...")
    new_chunk_texts, added_songs = collect_new_songs(update_csv, songs, chunks)

    if not new_chunk_texts:
        print("\nไม่มีเพลงใหม่ให้เพิ่มเลย (ซ้ำหมด หรือไม่มีเนื้อเพลง) — ไม่ต้องแก้ไฟล์ index เลย")
        return {"added_songs": 0, "added_chunks": 0, "n_songs": n_old_songs, "n_chunks": n_old_chunks}

    print("\nโหลดโมเดล multilingual-e5 (ตัวเดียวกับที่ใช้สร้าง index เดิม ไม่ได้เทรนใหม่)...")
    model = SentenceTransformer("intfloat/multilingual-e5-base")

    print(f"กำลังแปลง chunk ใหม่ {len(new_chunk_texts)} ก้อนเป็น vector (ของเดิม {n_old_chunks} ก้อน ไม่ต้อง encode ซ้ำ)...")
    new_embeddings = model.encode(
        ["passage: " + t for t in new_chunk_texts],
        batch_size=64,
        show_progress_bar=True,
        convert_to_tensor=True,
    )
    new_embeddings_norm = torch.nn.functional.normalize(new_embeddings, p=2, dim=1)

    # torch.cat ต่อ tensor ใหม่เข้าท้าย tensor เดิม (dim=0 คือต่อแถว ไม่ใช่ต่อคอลัมน์) ตำแหน่งแถวใน
    # embeddings_updated ตรงกับตำแหน่งใน chunks list พอดี เพราะ chunks ใหม่ถูก append ต่อท้าย chunks เดิมไปแล้ว
    embeddings_updated = torch.cat([embeddings, new_embeddings_norm], dim=0)

    torch.save(embeddings_updated, index_file)
    with open(metadata_file, "wb") as f:
        pickle.dump({"songs": songs, "chunks": chunks}, f)

    print(f"\n✓ อัปเดตเสร็จแล้ว: เพิ่ม {added_songs} เพลง ({len(new_chunk_texts)} chunks) "
          f"รวมเป็น {len(songs)} เพลง / {len(chunks)} chunks")
    print(f"✓ บันทึกทับ {index_file} และ {metadata_file}")
    print("รีสตาร์ท Ver.5/API.py เพื่อให้ Search.py โหลดข้อมูลที่อัปเดตแล้ว (รวมถึง fit TF-IDF ใหม่ให้ครอบคลุมเพลงใหม่ด้วย)")

    return {
        "added_songs": added_songs,
        "added_chunks": len(new_chunk_texts),
        "n_songs": len(songs),
        "n_chunks": len(chunks),
    }


if __name__ == "__main__":
    update_csv    = sys.argv[1] if len(sys.argv) > 1 else BASE_PATH / "update_dataset.csv"
    index_file    = sys.argv[2] if len(sys.argv) > 2 else BASE_PATH / "chunks_embeddings.pt"
    metadata_file = sys.argv[3] if len(sys.argv) > 3 else BASE_PATH / "chunks_metadata.pkl"
    update_index(update_csv, index_file, metadata_file)
