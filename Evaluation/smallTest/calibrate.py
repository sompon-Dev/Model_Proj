"""
calibrate.py
สคริปต์ทดลองชั่วคราว ใช้วัดเวลาจริงของขั้นตอน batch scoring (เหมือนใน AddRankColumns.py) ตอนประมาณ
เวลาที่ต้องใช้ก่อนรันเต็มกับเพลงทั้งหมด — ต้องรันจาก folder Evaluation/ (ไม่ใช่ smallTest/) เพราะ
เปิดไฟล์ "smallTest/TestCase_2.csv" แบบ path สัมพัทธ์ (relative path) ไว้
"""
import importlib.util, sys, time, csv, random
from pathlib import Path
import numpy as np
import torch

BASE_PATH = Path(".").resolve()  # ใช้ current working directory ตรงๆ (ไม่ใช่ Path(__file__).parent แบบไฟล์อื่นในโปรเจกต์) จึงต้องรันจาก folder Evaluation/ เท่านั้นให้ path ด้านล่างถูก

def load_search_module(mod_name, search_py_path):
    """โหลด Search.py ของ Ver.5 ด้วย importlib ตรงๆ (ไม่ใช่ import ปกติ) เพื่อกันชนกับไฟล์ Search.py
    อื่นที่ชื่อเดียวกันในโฟลเดอร์อื่น (เทคนิคเดียวกับ Ver.5/Evaluate.py และ Evaluation/AddRankColumns.py)"""
    folder = search_py_path.parent
    old_syspath = list(sys.path)   # เก็บ sys.path เดิมไว้ก่อน จะคืนกลับทีหลังไม่ว่าจะสำเร็จหรือพัง (finally)
    sys.path.insert(0, str(folder))
    try:
        # ขั้นตอนโหลดโมดูลจาก path ไฟล์ตรงๆ มี 4 ก้าว: 1) สร้างสเปคของโมดูล 2) สร้าง module object เปล่า
        # 3) ลงทะเบียนชื่อ mod_name ใน sys.modules กันชนกับชื่อไฟล์จริง 4) รันโค้ดในไฟล์จริงเข้า module นี้
        spec = importlib.util.spec_from_file_location(mod_name, search_py_path)
        module = importlib.util.module_from_spec(spec)
        sys.modules[mod_name] = module
        spec.loader.exec_module(module)
        return module
    finally:
        sys.path[:] = old_syspath

t0 = time.time()
sm = load_search_module("search_v5_cal", BASE_PATH.parent / "Ver.5" / "Search.py")
t_load = time.time() - t0
print(f"load_time_sec={t_load:.2f}")

sys.path.insert(0, str(BASE_PATH.parent / "Ver.5"))
from textproc import preprocess

with open("smallTest/TestCase_2.csv", encoding="utf-8-sig", newline="") as f:
    rows = list(csv.DictReader(f))

rng = random.Random(1)  # seed คงที่ให้สุ่มได้ชุดตัวอย่างเดิมซ้ำได้ (reproducible)
sample = rng.sample(rows, 300)  # สุ่มหยิบ 300 เพลงแบบไม่ซ้ำ (ให้เท่ากับ BATCH_SIZE จริงใน AddRankColumns.py เพื่อวัดเวลาต่อ batch ให้ตรงสภาพจริง)
queries = [r["เนื้อเพลง10คำ"] for r in sample]

for trial in range(2):   # รัน 2 รอบ เพราะรอบแรกมักช้ากว่าปกติ (model ยัง "warm-up" ไม่เต็มที่) เอารอบ 2 เป็นตัวแทนเวลาจริง
    t1 = time.time()
    prepped = [preprocess(q) for q in queries]
    # encode คำค้นทั้ง 300 พร้อมกันในการเรียกครั้งเดียว ได้ตาราง (300, 768) กลับมา
    q_vecs = sm.model.encode(["query: " + p for p in prepped], convert_to_tensor=True,
                              normalize_embeddings=True, batch_size=64, show_progress_bar=False)
    # sm.embeddings (n_chunks, 768) @ q_vecs.T (768, 300) = (n_chunks, 300): คูณเมทริกซ์ครั้งเดียว
    # ได้คะแนนความคล้ายของทุก chunk เทียบกับทุกคำค้นในชุดนี้พร้อมกันหมด
    dense = ((sm.embeddings @ q_vecs.T - 0.70) / 0.25).clamp(0, 1)
    q_tfidf = sm.tfidf.transform(prepped)
    # เหมือน dense แต่ใช้ TF-IDF แล้ว .toarray() แปลง sparse matrix เป็นตารางเลขปกติ
    lexical = torch.tensor((sm.chunk_tfidf @ q_tfidf.T).toarray(), dtype=torch.float32)
    scores = sm.W_DENSE * dense + (1 - sm.W_DENSE) * lexical
    # argsort(dim=0, ...) เรียงแต่ละคอลัมน์ (แต่ละคำค้น) แยกกัน ได้ index ของ chunk เรียงจากคะแนนมากไปน้อย
    order = scores.argsort(dim=0, descending=True).numpy()
    t_batch = time.time() - t1
    print(f"trial={trial} batch300_time_sec={t_batch:.2f}")
