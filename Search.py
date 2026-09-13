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

def search(query_text, top_k=5):
    # 2. แปลงข้อความที่ต้องการค้นหาเป็น Vector และ Normalize
    query_vector = model.encode(query_text, convert_to_tensor=True)
    query_vector = torch.nn.functional.normalize(query_vector, p=2, dim=0)

    # 3. คำนวณ Cosine Similarity ด้วย Matrix Multiplication (mm)
    # query_vector (768) x embeddings_norm (N, 768)^T -> (N,)
    scores = torch.matmul(embeddings_norm, query_vector)

    # 4. ดึง Top-K เพลงที่คล้ายที่สุด
    top_scores, top_indices = torch.topk(scores, k=top_k)

    # 5. แสดงผลลัพธ์
    results = []
    for score, idx in zip(top_scores, top_indices):
        song = metadata[idx.item()]
        results.append({
            "song_name": song["song_name"],
            "artist": song["artist"],
            "score": score.item()
        })
    return results

# ทดสอบใช้งาน
while True :
    Text_Input = input("เนื้อร้อง : ")
    List_Song = search(Text_Input)
    print("เพลง : ",List_Song)
    if Text_Input == "":
        break