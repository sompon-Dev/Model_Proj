import pickle
import torch
from pathlib import Path
from sentence_transformers import SentenceTransformer

BASE_PATH     = Path(__file__).parent
INDEX_FILE    = BASE_PATH / "songs_embeddings.pt"
METADATA_FILE = BASE_PATH / "songs_metadata.pkl"

# 1. โหลด Embedding Tensor และ Metadata
embeddings_norm = torch.load(INDEX_FILE)
with open(METADATA_FILE, "rb") as f:
    metadata = pickle.load(f)

model = SentenceTransformer("intfloat/multilingual-e5-base")

def search(query_text, top_k=11):
    # 2. แปลงข้อความที่ต้องการค้นหาเป็น Vector และ Normalize
    query_vector = model.encode(query_text, convert_to_tensor=True)
    # dim=0 เพราะ query_vector เป็นเวกเตอร์เดี่ยว 1 มิติ (ตรงข้ามกับ Buildindex.py ที่ normalize
    # เป็นตารางหลายแถวจึงใช้ dim=1) — normalize ให้ความยาวเวกเตอร์เป็น 1 เพื่อให้ dot product = cosine similarity
    query_vector = torch.nn.functional.normalize(query_vector, p=2, dim=0)

    # 3. คำนวณ Cosine Similarity ด้วย Matrix Multiplication (mm)
    # query_vector (768) x embeddings_norm (N, 768)^T -> (N,)
    # torch.matmul ของตาราง (N,768) กับเวกเตอร์ (768) คือคูณเวกเตอร์นี้กับทุกแถวพร้อมกันในคำสั่งเดียว
    # ได้คะแนนความคล้ายของทุกเพลงออกมาเป็นเวกเตอร์ (N,) โดยไม่ต้องวน loop ทีละเพลง
    scores = torch.matmul(embeddings_norm, query_vector)

    # 4. ดึง Top-K เพลงที่คล้ายที่สุด (ถ้ามีเพลงน้อยกว่า top_k ให้ใช้เท่าที่มี)
    top_k = min(top_k, scores.shape[0])
    # torch.topk คืนค่าทั้งคะแนนสูงสุด k อันดับ (top_scores) และตำแหน่ง/index ของมันในเวกเตอร์เดิม
    # (top_indices) มาพร้อมกันในคำสั่งเดียว เรียงจากคะแนนสูงไปต่ำให้เสร็จ ไม่ต้อง sort เองเพิ่ม
    top_scores, top_indices = torch.topk(scores, k=top_k)

    # 5. แสดงผลลัพธ์
    results = []
    for score, idx in zip(top_scores, top_indices):
        song = metadata[idx.item()]  # .item() แปลง tensor ตัวเลขเดี่ยว (0 มิติ) เป็นเลข Python ธรรมดา ใช้เป็น index ของ list ปกติไม่ได้ถ้าไม่แปลงก่อน
        results.append({
            "song_name": song["song_name"],
            "artist": song["artist"],
            "score": score.item()
        })
    return results

# ทดสอบใช้งาน
#while True :
#    Text_Input = input("เนื้อร้อง : ")
#    List_Song = search(Text_Input)
#    print("เพลง : ",List_Song)
#    if Text_Input == "":
#        break