import pickle
import pandas as pd
import numpy as np 
import torch 
from pathlib import Path
from sentence_transformers import SentenceTransformer 

BASE_PATH     = Path(__file__).parent            
CSV_FILE      = BASE_PATH / "dataset.csv"            
INDEX_FILE    = BASE_PATH / "songs_embeddings.pt"  # เปลี่ยนนามสกุลไฟล์เป็น .pt (PyTorch Tensor)
METADATA_FILE = BASE_PATH / "songs_metadata.pkl"    

print("โหลดโมเดล multilingual-e5 (รองรับภาษาไทย)...")        
model = SentenceTransformer("intfloat/multilingual-e5-base") 
print("โหลดโมเดลสำเร็จ!\n")                                

print("อ่าน dataset.csv...")                                            
df = pd.read_csv(CSV_FILE)                                             
print(f"พบเพลงทั้งหมด {len(df)} เพลง\n")                                

lyrics_list = df["lyrics_tokens"].tolist()                            
metadata    = df[["song_name", "artist"]].to_dict(orient="records")    

print("กำลังแปลงเนื้อเพลงเป็น vector...")                                  
print("(อาจใช้เวลาสักครู่ขึ้นอยู่กับจำนวนเพลง)\n")                               

embeddings = model.encode(                                             
    lyrics_list,
    show_progress_bar=True,   
    convert_to_tensor=True,  # เปลี่ยนให้ส่งกลับมาเป็น PyTorch Tensor ตรงๆ
)
print(f"\nแปลงสำเร็จ! ขนาด vector: {embeddings.shape}")  # (จำนวนเพลง, 768)

# ─────────────────────────────────────────────
# PROCESS 4 — Normalize Vectors ด้วย PyTorch
# ทำไม: เพื่อให้การหา Dot Product เท่ากับ Cosine Similarity
# ─────────────────────────────────────────────
print("\nNormalize Vectors ด้วย PyTorch...")

# L2 Normalize แบบเดียวกับ faiss.normalize_L2
embeddings_norm = torch.nn.functional.normalize(embeddings, p=2, dim=1)

print(f"เตรียม Tensor เสร็จสิ้น มีเพลงทั้งหมด {embeddings_norm.shape[0]} เพลง")

# ─────────────────────────────────────────────
# PROCESS 5 — บันทึก PyTorch Tensor และ Metadata
# ─────────────────────────────────────────────
print("\nบันทึก embeddings tensor และ metadata...")

# เซฟ PyTorch Tensor ตรงๆ
torch.save(embeddings_norm, INDEX_FILE)

with open(METADATA_FILE, "wb") as f:
    pickle.dump(metadata, f)

print(f"✓ บันทึก index tensor ที่ : {INDEX_FILE}")
print(f"✓ บันทึก metadata ที่     : {METADATA_FILE}")
print(f"\nเสร็จแล้ว! รันไฟล์ Search.py เพื่อทดสอบได้เลย")