import pickle
import pandas as pd
import numpy as np 
import faiss
from pathlib import Path
from sentence_transformers import SentenceTransformer 

# import pickle
# คือ Lib เอาไว้ใช้ทำให้โมเดลเล็กลง และอีกหนึ่งหน้าที่ทำนำมาใช้คือ การมาเป็นindex 
# Scenario คือ สมมุติเจอเพลงในModel แล้ว จะไปอ่านไฟล์Pickle เพื่อเอาชื่อเพลงและชื่อศิลปิน เหมือนการใช้array ที่ดึงทั้งข้อมูลในarray(เนื้อเพลง) และดึงindexของArray(ศิลปิน)

# import pandas as pd
# คือ Lib เอาไว้ใช้สำหรับดึงข้อมูลจากไฟล์ CSV ที่เก็บเพลงที่ทำการแบ่งคำแล้ว

# import numpy as np
# ไม่ได้ใช้

# import faiss
# คือ Lib ของทางFacebook สำหรับสร้างModel ซึ่งModel ที่ใช้ เป็นในรูปแบบ Cosine Similarity คือกราฟที่มีความใกล้เคียงกันที่ทำได้ทั้งเก็บข้อมูลและเอาไว้Search ได้ง่าย

# from Pathlib import Path
# คือ Lib สำหรับการกำหนดPath ตำแหน่งไฟล์ ซึ่งเหมาะกับการทำงานได้หลาย OS ทั้ง Linux MacOS และ Window เพราะไม่ได้เก็บในรูปแบบString("../../(Folder)") 

# from sentence_transformers import SentenceTransformer  
# คือ API สำหรับการนำ Multilingual-e5 ซึ่งเป็น Word Embedding ที่รองรับหลายภาษาซึ่งรวมถึงภาษาไทยเช่นและเหมาะกับบางเพลงที่มีการนำภาษาอื่นมาใช้ได้


                                                    #from pathlib import Path
BASE_PATH    = Path(__file__).parent                #ประกาศตัวแปร BASE_PATH  
                                                    #PATH(__file__).parent คือคำสั่งเก็บ ให้เป็นไฟล์ Parent folderทั้งหมด สมมุติ ว่าไฟล์ที่ต้องการคือ Test.txt อยู่ใน C:/Document/Thesis/..
                                                    # #มันจะเก็บ C:/Document/Thesis เป็น String ไว้ใน ตัวแปร BASE_PATH


                                                    # Syntax คือ (ตัวแปร) = BASE_PATH(ตัวแปรที่เก็บ Path.parent) / "(ไฟล์ที่ต้องการ)"
CSV_FILE     = BASE_PATH / "dataset.csv"            # ตัวแปร CSV_FILE เก็บ String BASE_PATH โดยมีไฟล์ "dataset.csv" เป็น ไฟล์ที่ต้องการ
INDEX_FILE   = BASE_PATH / "songs.index"            # ตัวแปร CSV_FILE เก็บ String BASE_PATH โดยมีไฟล์ "songs.index" เป็น ไฟล์ที่ต้องการ
METADATA_FILE = BASE_PATH / "songs_metadata.pkl"    # ตัวแปร CSV_FILE เก็บ String BASE_PATH โดยมีไฟล์ "songs_metadata.pkl" เป็น ไฟล์ที่ต้องการ



print("โหลดโมเดล multilingual-e5 (รองรับภาษาไทย)...")             #แสดงข้อความออกTerminal ว่า "โหลดโมเดล multilingual-e5 (รองรับภาษาไทย)..."
model = SentenceTransformer("intfloat/multilingual-e5-base")     #เป็นการดึง Embedding model ชื่อ multilingual-e5-base จาก Lib SentenceTransformer 
print("โหลดโมเดลสำเร็จ!\n")                                       #แสดงข้อความออกTerminal "โหลดโมเดลสำเร็จ!\n"







print("อ่าน dataset.csv...")                                             #แสดงข้อความออกTerminal ว่า "อ่าน dataset.csv..."
df = pd.read_csv(CSV_FILE)                                              #ประกาศตัวแปรชื่อ df มาจากคำว่า DataFrame
                                                                        #pd.read_csv(CSV_FILE) คือคำสั่งอ่าน ไฟล์.csv ซึ่งในที่นี้คืออ่านไฟล์ dataset.csv เก็บในตัวแปร CSV_FILE ไปอยู่ใน ตัวแปร df
print(f"พบเพลงทั้งหมด {len(df)} เพลง\n")                                 #แสดงข้อความออกTerminal ว่า ""พบเพลงทั้งหมด {len(df)} เพลง\n""

lyrics_list = df["lyrics_tokens"].tolist()                              #นำเนื้อเพลงที่อยู่ใน Column ชื่อ"lyrics_token" ในไฟล์ dataset.csv ไปเก็บใว้ในตัวแปร lyrics_list
metadata    = df[["song_name", "artist"]].to_dict(orient="records")     #นำ ชื่อเพลง และ ชื่อศิลปิน ที่อยู่ใน Column ชื่อ "song_name" "artist" ในไฟล์ dataset.csv เก็บในรูปแบบของ List Dictionary โดยมีชื่อเพลงเป็น Index และมีชื่อศิลปินเป็น ข้อมูลข้่างใน









print("กำลังแปลงเนื้อเพลงเป็น vector...")                                   #แสดงข้อความออกTerminal ว่า "กำลังแปลงเนื้อเพลงเป็น vector..."
print("(อาจใช้เวลาสักครู่ขึ้นอยู่กับจำนวนเพลง)\n")                               #แสดงข้อความออกTerminal ว่า "(อาจใช้เวลาสักครู่ขึ้นอยู่กับจำนวนเพลง)\n"

                                                                        #มาจากLib sentenceTransformer
embeddings = model.encode(                                              #
    lyrics_list,
    show_progress_bar=True,   
    convert_to_numpy=True,
)
print(f"\nแปลงสำเร็จ! ขนาด vector: {embeddings.shape}")  # (จำนวนเพลง, 768)

# ─────────────────────────────────────────────
# PROCESS 4 — สร้าง FAISS Index
# ทำไม: FAISS เป็น library ค้นหา vector ที่เร็วมาก
#        เวลา query มา มันหา vector ที่ใกล้เคียงที่สุดได้ทันที
#        ไม่ต้องเทียบทีละเพลงทุกครั้ง
# ─────────────────────────────────────────────
print("\nสร้าง FAISS Index...")

dimension = embeddings.shape[1]                    # 768
index = faiss.IndexFlatIP(dimension)               # IndexFlatIP = cosine similarity

# normalize ก่อน add เพื่อให้ cosine similarity ทำงานถูกต้อง
faiss.normalize_L2(embeddings)
index.add(embeddings)

print(f"Index มีเพลงทั้งหมด {index.ntotal} เพลง")

# ─────────────────────────────────────────────
# PROCESS 5 — บันทึก Index และ Metadata
# ทำไม: บันทึกไว้ใช้ใหม่โดยไม่ต้อง embed ทุกครั้ง
#        songs.index = vector ทุกเพลง
#        songs_metadata.pkl = ชื่อเพลง/ศิลปินที่ตรงกับแต่ละ vector
# ─────────────────────────────────────────────
print("\nบันทึก index และ metadata...")

faiss.write_index(index, str(INDEX_FILE))

with open(METADATA_FILE, "wb") as f:
    pickle.dump(metadata, f)

print(f"✓ บันทึก index ที่   : {INDEX_FILE}")
print(f"✓ บันทึก metadata ที่: {METADATA_FILE}")
print(f"\nเสร็จแล้ว! รันไฟล์ Search.py เพื่อทดสอบได้เลย")