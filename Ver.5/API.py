import sys
import json
import tempfile
from pathlib import Path
from fastapi import FastAPI  # FastAPI คือ framework สร้าง web API: ประกาศ endpoint ด้วย decorator (@app.post/@app.get) แล้ว FastAPI จัดการรับ-ส่ง HTTP/JSON ให้อัตโนมัติ (อธิบายละเอียดใน Document.md หัวข้อ 0.1)

# บนเครื่อง Windows ที่ locale เป็นไทย terminal มักใช้ codepage cp874 ซึ่งพิมพ์ emoji (📩📤) ไม่ได้
# ถ้าไม่ตั้งค่านี้ก่อน print() บรรทัดที่มี emoji ด้านล่างจะ error (UnicodeEncodeError) ทุกครั้งที่มีคนค้นหา
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import pandas as pd
from pydantic import BaseModel  # BaseModel ใช้นิยามรูปแบบข้อมูลที่รับเข้ามา — FastAPI จะเช็ก type ให้เองว่าตรงตามที่ประกาศไว้ ถ้าไม่ตรงจะตอบ error กลับไปอัตโนมัติ ไม่ต้องเช็กมือ
import Search
from Search import search  # ดึงฟังก์ชันค้นหาเดิมของคุณมาใช้
from BuildindexUpdate import update_index  # เพิ่มเพลงใหม่เข้า index เดิม ใช้คู่กับ /update_model ด้านล่าง

BASE_PATH = Path(__file__).parent

# 1. สร้างตัวแปรแอปพลิเคชัน FastAPI
app = FastAPI(
    title="Music Search Engine API",
    description="API สำหรับค้นหาเพลงด้วย Vector Search (PyTorch)",
    version="1.0"
)

# 2. กำหนดรูปแบบข้อมูลที่จะรับเข้ามา (Request Body)
class QueryRequest(BaseModel):
    text: str

# ใช้คู่กับหน้า UpdateModel.js (ผ่าน Backend_Database/main.py): เพลงที่แอดมินติ๊กเลือกจากตาราง
# Train_Song ส่งมาเป็น list ตรงๆ (ไม่ใช่ newsong_id เพราะ Ver.5 ไม่เชื่อมกับ database เลย)
class TrainSong(BaseModel):
    newsong_name: str
    newsong_artist: str
    newsong_lyrics: str

class UpdateModelRequest(BaseModel):
    songs: list[TrainSong]

# 3. สร้าง Endpoint สำหรับการค้นหา
# @app.post("/search") คือ decorator บอก FastAPI ว่า "ถ้ามีคนยิง HTTP POST มาที่ /search ให้เรียกฟังก์ชันข้างล่างนี้"
# payload: QueryRequest บอก FastAPI ให้แปลง JSON body ที่ส่งมาเป็น object QueryRequest ให้อัตโนมัติ (พร้อมเช็ก type)
@app.post("/search")
def run_search(payload: QueryRequest):
    # ดึงคำค้นหาออกมา
    query_text = payload.text #QueryRequest.text
    
    # ส่งไปค้นหาด้วยฟังก์ชันเดิมใน Search.py
    results = search(query_text)
    
    # --- เพิ่มส่วน Print ออกหน้า Terminal ---
    print("\n==========================================")
    print(f"📩 Received Query from App: '{query_text}'")
    print("------------------------------------------")
    print("📤 Sending Results to Frontend:")
    # ใช้ json.dumps เพื่อจัดฟอร์แมต List ให้เป็นระเบียบ อ่านง่ายใน Terminal
    print(json.dumps(results, indent=2, ensure_ascii=False))
    print("==========================================\n")
    # ----------------------------------------
    
    # ส่งผลลัพธ์กลับไปเป็น JSON อัตโนมัติ
    # แค่ return dict ธรรมดา FastAPI จะแปลงเป็น JSON ส่งกลับไปให้เอง ไม่ต้องเรียก json.dumps() ตรงนี้เอง
    return {"status": "success", "results": results}


# เพิ่มเพลงใหม่เข้า index โดยไม่ต้อง encode เพลงเก่าซ้ำ (ดูเหตุผลใน BuildindexUpdate.py)
# เดิม endpoint นี้เคยอยู่ที่ Backend_Database/main.py (เรียก update_index ในเครื่องเดียวกัน) แต่
# main.py รันอยู่บน Render ซึ่งไม่ได้ลง torch/sentence-transformers และไม่มีไฟล์ index เลย เรียกแล้ว
# พังทุกครั้ง — ย้ายมาไว้ที่นี่ (Ver.5/API.py บน Modal) ที่มีทั้งโมเดลและไฟล์ index จริงแทน
@app.post("/update_model")
def run_update_model(payload: UpdateModelRequest):
    if not payload.songs:
        return {"status": "error", "error": "ไม่มีเพลงส่งมาให้เทรน"}

    # update_index() เดิมรับเป็น path ไฟล์ csv (ใช้ร่วมกับตอนรันจาก Train_Song ในเครื่อง local ได้ด้วย)
    # เขียนเพลงที่รับมาจาก request ลง csv ชั่วคราวก่อน ไม่แก้ฟังก์ชัน update_index เลย
    df = pd.DataFrame([s.model_dump() for s in payload.songs])
    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
        tmp_csv = Path(tmp.name)
    df.to_csv(tmp_csv, index=False, encoding="utf-8-sig")

    try:
        result = update_index(
            tmp_csv,
            BASE_PATH / "chunks_embeddings.pt",
            BASE_PATH / "chunks_metadata.pkl",
        )
        # ไฟล์ index บนดิสก์ถูกเขียนทับไปแล้ว แต่ Search.py โหลด embeddings/songs/chunks/tfidf เป็นตัวแปร
        # module-level ไว้ตอน import (cold start) เฉยๆ แก้ไฟล์ไม่ทำให้ตัวแปรพวกนี้เปลี่ยนตาม ต้องสั่งโหลดใหม่เอง
        Search.reload_index()
    except Exception as e:
        return {"status": "error", "error": f"อัปเดตโมเดลไม่สำเร็จ: {e}"}
    finally:
        tmp_csv.unlink(missing_ok=True)

    return {"status": "success", **result}


# 4. สั่งรัน Server ด้วย uvicorn
if __name__ == "__main__":
    import uvicorn
    # host="0.0.0.0" เพื่อเปิดรับทุกการเชื่อมต่อ, ใช้ port=8002 เพราะ 8000 ถูกใช้โดย API ของ database
    uvicorn.run(app, host="0.0.0.0", port=8002)