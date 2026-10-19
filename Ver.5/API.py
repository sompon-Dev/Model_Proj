import sys
import json
from fastapi import FastAPI  # FastAPI คือ framework สร้าง web API: ประกาศ endpoint ด้วย decorator (@app.post/@app.get) แล้ว FastAPI จัดการรับ-ส่ง HTTP/JSON ให้อัตโนมัติ (อธิบายละเอียดใน Document.md หัวข้อ 0.1)

# บนเครื่อง Windows ที่ locale เป็นไทย terminal มักใช้ codepage cp874 ซึ่งพิมพ์ emoji (📩📤) ไม่ได้
# ถ้าไม่ตั้งค่านี้ก่อน print() บรรทัดที่มี emoji ด้านล่างจะ error (UnicodeEncodeError) ทุกครั้งที่มีคนค้นหา
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from pydantic import BaseModel  # BaseModel ใช้นิยามรูปแบบข้อมูลที่รับเข้ามา — FastAPI จะเช็ก type ให้เองว่าตรงตามที่ประกาศไว้ ถ้าไม่ตรงจะตอบ error กลับไปอัตโนมัติ ไม่ต้องเช็กมือ
from Search import search  # ดึงฟังก์ชันค้นหาเดิมของคุณมาใช้

# 1. สร้างตัวแปรแอปพลิเคชัน FastAPI
app = FastAPI(
    title="Music Search Engine API",
    description="API สำหรับค้นหาเพลงด้วย Vector Search (PyTorch)",
    version="1.0"
)

# 2. กำหนดรูปแบบข้อมูลที่จะรับเข้ามา (Request Body)
class QueryRequest(BaseModel):
    text: str

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

# 4. สั่งรัน Server ด้วย uvicorn
if __name__ == "__main__":
    import uvicorn
    # host="0.0.0.0" เพื่อเปิดรับทุกการเชื่อมต่อ, ใช้ port=8002 เพราะ 8000 ถูกใช้โดย API ของ database
    uvicorn.run(app, host="0.0.0.0", port=8002)