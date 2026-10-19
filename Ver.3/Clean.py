import os
import re
from pathlib import Path
from pythainlp.tokenize import word_tokenize
from pythainlp.util import normalize  # นี่คือ normalize ของ pythainlp (จัดระเบียบตัวอักษรไทย) ไม่ใช่ normalize ของ numpy/sklearn ที่ปรับสเกลตัวเลข — คนละเรื่องกันแม้ชื่อเหมือนกัน
 
# ─────────────────────────────────────────────
# กำหนด path input และ output แบบคงที่
# เปลี่ยนตรงนี้ถ้า path เปลี่ยน
# ─────────────────────────────────────────────
# INPUT_PATH  = Path(r"c:\Users\usEr\Documents\Wokr\Thesis\Ver.2\Dataset")
# OUTPUT_PATH = Path(r"c:\Users\usEr\Documents\Wokr\Thesis\Ver.2\CleanedData")
BASE_PATH   = Path(__file__).parent        # folder ที่ Clean.py อยู่
INPUT_PATH  = BASE_PATH / "Dataset"        # folder Dataset ข้างๆ Clean.py
OUTPUT_PATH = BASE_PATH / "CleanedData"    # folder CleanedData ข้างๆ Clean.py

 
 
def clean_text(text):
    """
    PROCESS 1 — ทำความสะอาดข้อความ
    ทำไม: เนื้อเพลงดิบมักมีอักขระพิเศษ วรรณยุกต์ซ้อน หรือ space เกิน
           ถ้าไม่ clean ก่อน tokenizer จะตัดคำผิดพลาด
    """
    text = normalize(text)                          # แก้วรรณยุกต์ซ้อน / สระผิดตำแหน่ง
    text = re.sub(r"[^\u0E00-\u0E7Fa-zA-Z0-9\s]", "", text)  # เอาอักขระพิเศษออก เก็บแค่ ไทย/อังกฤษ/ตัวเลข
    text = re.sub(r" +", " ", text).strip()         # ลด space ซ้ำ
    return text
 
 
def tokenize_text(text):
    """
    PROCESS 2 — ตัดคำภาษาไทย
    ทำไม: โมเดล ML ต้องการข้อมูลในรูปแบบ token (คำ) ไม่ใช่ตัวอักษรต่อเนื่อง
           ใช้ newmm engine ของ pythainlp ซึ่งแม่นที่สุดสำหรับภาษาไทย
    ผลลัพธ์: "ฉันรักเธอ" → "ฉัน รัก เธอ"
    """
    tokens = word_tokenize(text, engine="newmm", keep_whitespace=False)
    return " ".join(t for t in tokens if t.strip())
 
 
def process_file(input_file, output_file):
    """
    PROCESS 3 — อ่านไฟล์ → clean → tokenize → บันทึก
    ทำไม: รวม process 1 และ 2 ทำทีละบรรทัด เพื่อรักษาโครงสร้างเนื้อเพลง
           (แต่ละบรรทัด = 1 วรรคของเพลง)
    """
    # อ่านไฟล์ รองรับหลาย encoding เพราะไฟล์ไทยบางไฟล์ไม่ได้ใช้ utf-8
    # วนลองทีละ encoding ถ้าอ่านสำเร็จจะ break ออกจาก loop ทันที
    # ส่วน else ท้าย for (ไม่ใช่ else ของ if) จะรันก็ต่อเมื่อ loop จบครบทุกตัวโดยไม่มี break เลย
    # หมายถึง "ลองครบทุก encoding แล้วยังอ่านไม่ได้สักอัน" — นี่คือ for...else ของ Python ไม่เหมือน if...else ทั่วไป
    for encoding in ("utf-8-sig", "utf-8", "tis-620", "cp874"):
        try:
            lines = input_file.read_text(encoding=encoding).splitlines()
            break
        except (UnicodeDecodeError, LookupError):
            continue
    else:
        print(f"  [!] อ่านไม่ได้: {input_file.name}")
        return
 
    result = []
    for line in lines:
        line = clean_text(line)       # Process 1
        if not line:                  # ข้ามบรรทัดว่าง
            continue
        line = tokenize_text(line)    # Process 2
        if line:
            result.append(line)
 
    # สร้าง folder ปลายทางถ้ายังไม่มี แล้วบันทึก
    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text("\n".join(result), encoding="utf-8")
    print(f"  ✓ {input_file.name}")
 
 
# ─────────────────────────────────────────────
# PROCESS 4 — วน loop ทุกศิลปิน ทุกเพลง
# ทำไม: วน loop อัตโนมัติตาม folder ที่มี
#        ไม่ต้องระบุชื่อศิลปินหรือชื่อเพลงเอง
# ─────────────────────────────────────────────
print(f"เริ่มทำความสะอาดข้อมูล...\n")
 
for artist_folder in sorted(INPUT_PATH.iterdir()):
    if not artist_folder.is_dir():
        continue
 
    print(f"[{artist_folder.name}]")
 
    for txt_file in sorted(artist_folder.glob("*.txt")):
        out_file = OUTPUT_PATH / artist_folder.name / txt_file.name
        process_file(txt_file, out_file)
 
    print()
 
print(f"เสร็จแล้ว! ดูผลลัพธ์ได้ที่: {OUTPUT_PATH}")