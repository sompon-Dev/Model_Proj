import json
from fastapi import FastAPI
from pydantic import BaseModel
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
    return {"status": "success", "results": results}

# 4. สั่งรัน Server ด้วย uvicorn
if __name__ == "__main__":
    import uvicorn
    # host="0.0.0.0" เพื่อเปิดรับทุกการเชื่อมต่อ, ใช้ port=8002 เพราะ 8000 ถูกใช้โดย API ของ database
    uvicorn.run(app, host="0.0.0.0", port=8002)