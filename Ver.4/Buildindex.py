import pickle
import torch
from pathlib import Path
from sentence_transformers import SentenceTransformer

BASE_PATH     = Path(__file__).parent
CLEANED_PATH  = BASE_PATH / "CleanedData"            # CleanedData / ศิลปิน / เพลง.txt (1 บรรทัด = 1 วรรค)
INDEX_FILE    = BASE_PATH / "chunks_embeddings.pt"   # vector ของ "chunk" ไม่ใช่ทั้งเพลง
METADATA_FILE = BASE_PATH / "chunks_metadata.pkl"

# ─────────────────────────────────────────────
# ตั้งค่า chunk: หน้าต่างละ WINDOW บรรทัด เลื่อนทีละ STRIDE บรรทัด
# ทำไม: 1 เพลง = 1 vector ทำให้ความหมายถูกเฉลี่ยจนท่อนที่ผู้ใช้พิมพ์มาจางหาย
#        และเพลงยาวเกิน 512 token จะถูกตัดท้ายทิ้ง
#        แบ่งเป็นท่อนสั้นๆ แล้วให้คะแนนเพลงจาก chunk ที่ตรงที่สุดแทน
# ─────────────────────────────────────────────
WINDOW = 2
STRIDE = 1


def make_chunks(lines):
    if len(lines) <= WINDOW:
        return [" ".join(lines)]
    return [" ".join(lines[i:i + WINDOW]) for i in range(0, len(lines) - WINDOW + 1, STRIDE)]


print("อ่านเนื้อเพลงจาก CleanedData...")
songs  = []   # [{song_name, artist}]
chunks = []   # [{song_idx, text}]

for artist_folder in sorted(CLEANED_PATH.iterdir()):
    if not artist_folder.is_dir():
        continue
    for txt_file in sorted(artist_folder.glob("*.txt")):
        lines = [l.strip() for l in txt_file.read_text(encoding="utf-8").splitlines() if l.strip()]
        if not lines:
            continue
        song_idx = len(songs)
        songs.append({"song_name": txt_file.stem, "artist": artist_folder.name})
        for text in make_chunks(lines):
            chunks.append({"song_idx": song_idx, "text": text})

print(f"พบเพลง {len(songs)} เพลง → {len(chunks)} chunks (window={WINDOW}, stride={STRIDE})\n")

print("โหลดโมเดล multilingual-e5 (รองรับภาษาไทย)...")
model = SentenceTransformer("intfloat/multilingual-e5-base")
print("โหลดโมเดลสำเร็จ!\n")

print("กำลังแปลง chunk เป็น vector...")
# E5 ถูกเทรนให้เอกสารขึ้นต้นด้วย "passage: " และ query ขึ้นต้นด้วย "query: "
embeddings = model.encode(
    ["passage: " + c["text"] for c in chunks],
    batch_size=64,
    show_progress_bar=True,
    convert_to_tensor=True,
)
print(f"\nแปลงสำเร็จ! ขนาด vector: {embeddings.shape}")  # (จำนวน chunk, 768)

# L2 Normalize เพื่อให้ dot product = cosine similarity
embeddings_norm = torch.nn.functional.normalize(embeddings, p=2, dim=1)

torch.save(embeddings_norm, INDEX_FILE)
with open(METADATA_FILE, "wb") as f:
    pickle.dump({"songs": songs, "chunks": chunks}, f)

print(f"✓ บันทึก index tensor ที่ : {INDEX_FILE}")
print(f"✓ บันทึก metadata ที่     : {METADATA_FILE}")
print("\nเสร็จแล้ว! รันไฟล์ Evaluate.py เพื่อวัดผล หรือ Search.py เพื่อทดสอบได้เลย")
