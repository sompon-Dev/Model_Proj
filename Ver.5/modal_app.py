"""Deploy Ver.5 search API (API.py + Search.py เดิม ไม่แก้โค้ด) ขึ้น Modal
รัน deploy ด้วยคำสั่ง: modal deploy modal_app.py
"""
from pathlib import Path

import modal

app = modal.App("lyriseek-search")

HERE = Path(__file__).parent

# ไฟล์โมเดล chunks_embeddings.pt (288MB) + chunks_metadata.pkl (39MB) อัปโหลดแยกไว้ล่วงหน้าแล้วด้วย
# `modal volume put` (เสถียรกว่าแนบไปกับ image ตรงๆ ซึ่งไฟล์ใหญ่ขนาดนี้อัปโหลดค้างได้)
model_volume = modal.Volume.from_name("lyriseek-model-data", create_if_missing=True)

# image: ลง library ที่ Search.py/textproc.py ต้องใช้ + ดาวน์โหลดโมเดล E5 ฝังไว้ใน image
# ตอน build เลย (กัน container ต้องโหลดโมเดลจาก HuggingFace ใหม่ทุกครั้งที่ cold start)
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi",
        "pydantic",
        "torch",
        "sentence-transformers",
        "scikit-learn",
        "pythainlp",
        "pandas",  # ใช้ใน BuildindexUpdate.py + API.py (endpoint /update_model)
    )
    .run_commands(
        "python -c \"from sentence_transformers import SentenceTransformer; "
        "SentenceTransformer('intfloat/multilingual-e5-base')\""
    )
    .add_local_dir(
        HERE,
        remote_path="/root/ver5",
        # ตัดไฟล์/โฟลเดอร์ที่ API ตอน runtime ไม่ได้ใช้เลย (ข้อมูลดิบ/สคริปต์ build/ไฟล์ log)
        # และตัดไฟล์โมเดล 2 ไฟล์ออกด้วย เพราะมาจาก Volume แทน (ดูด้านล่าง)
        ignore=[
            "CleanedData/**",
            "Dataset/**",
            "InputData/**",
            "__pycache__/**",
            "*.csv",
            "*.txt",
            "modal_app.py",
            "chunks_embeddings.pt",
            "chunks_metadata.pkl",
        ],
    )
)


@app.function(
    image=image,
    # /update_model (เทรนเพลงใหม่เข้า index) ช้ากว่า /search มาก เพราะต้อง encode เพลงใหม่ทั้งหมด —
    # 120 วิเดิมพอสำหรับ search อย่างเดียว แต่ไม่พอเผื่อแอดมินติ๊กเทรนหลายเพลงพร้อมกัน เลยเผื่อไว้ 5 นาที
    # (ตรงกับ timeout ฝั่ง frontend ที่ UpdateModel.js ตั้งไว้ 300000ms พอดี)
    timeout=300,
    min_containers=0,
    volumes={"/model_data": model_volume},
)
@modal.asgi_app()
def web():
    import os
    import sys

    # เอาไฟล์โมเดลจาก Volume มาวางข้างๆ Search.py (symlink แทน copy ไม่ต้องเขียนไฟล์ 327MB ซ้ำทุก
    # cold start) เพราะ Search.py เดิมอ่านไฟล์จาก BASE_PATH = Path(__file__).parent ตรงๆ
    for fname in ("chunks_embeddings.pt", "chunks_metadata.pkl"):
        dest = f"/root/ver5/{fname}"
        if not os.path.exists(dest):
            os.symlink(f"/model_data/{fname}", dest)

    sys.path.insert(0, "/root/ver5")
    from API import app as fastapi_app  # ใช้ FastAPI app เดิมของ API.py ตรงๆ ไม่แก้โค้ดค้นหาเลย

    # /update_model เขียนทับ chunks_embeddings.pt/chunks_metadata.pkl ผ่าน symlink ข้างบน (เขียนเข้า
    # /model_data ที่ mount ไว้จริง) — แต่การเขียนนั้นจะเห็นแค่ใน container นี้จนกว่าจะ .commit() ลง
    # Volume ไม่งั้นพอ container นี้ถูก Modal เก็บ/recycle ของที่เพิ่งเทรนไปจะหายเหมือนไม่เคยอัปเดต
    @fastapi_app.middleware("http")
    async def commit_volume_after_update(request, call_next):
        response = await call_next(request)
        if request.url.path == "/update_model" and response.status_code == 200:
            model_volume.commit()
        return response

    return fastapi_app


# ---------- กัน Render (Backend_Database API) หลับ ----------
# Render free tier จะ sleep เองหลังไม่มีคนเรียก 15 นาที แล้วตื่นช้ามาก (วัดจริงได้ถึง ~86 วิ ดู
# Test/) ping เบาๆ ไปทุก 10 นาที (< 15) ก็พอกันไม่ให้หลับแล้ว ไม่ต้องแก้อะไรที่ฝั่ง Render เลย
# ใช้ image แยกเล็กๆ (แค่ requests) ไม่ปนกับ image หนักของโมเดลค้นหาด้านบน
RENDER_API_URL = "https://lyriseek-api-database.onrender.com/Genre"
keepalive_image = modal.Image.debian_slim(python_version="3.11").pip_install("requests")


@app.function(image=keepalive_image, schedule=modal.Period(minutes=10), timeout=30)
def keep_render_warm():
    import requests

    try:
        res = requests.get(RENDER_API_URL, timeout=20)
        print(f"keep-alive ping: HTTP {res.status_code}")
    except Exception as e:
        print(f"keep-alive ping failed: {e}")
