import re
from pythainlp.tokenize import word_tokenize
from pythainlp.util import normalize  # นี่คือ normalize ของ pythainlp (จัดระเบียบตัวอักษรไทย) ไม่ใช่ normalize ของ numpy/sklearn ที่ปรับสเกลตัวเลข — คนละเรื่องกันแม้ชื่อเหมือนกัน


def clean_text(text):
    """
    ทำความสะอาดข้อความ
    ทำไม: เนื้อเพลงดิบมักมีอักขระพิเศษ วรรณยุกต์ซ้อน หรือ space เกิน
           ถ้าไม่ clean ก่อน tokenizer จะตัดคำผิดพลาด
    """
    text = normalize(text)                                   # แก้วรรณยุกต์ซ้อน / สระผิดตำแหน่ง
    # "฀-๿" คือช่วงอักขระ Unicode ของตัวอักษรไทยทั้งหมด (ตั้งแต่ ฀ ถึง ๿ รวมพยัญชนะ สระ วรรณยุกต์ ตัวเลขไทย)
    # [^...] ใน regex หมายถึง "ตัวอักษรที่ไม่อยู่ในชุดนี้" ดังนั้นแปลว่า "ลบทุกอักขระที่ไม่ใช่ไทย/อังกฤษ/เลข/เว้นวรรค"
    text = re.sub(r"[^฀-๿a-zA-Z0-9\s]", "", text)  # เอาอักขระพิเศษออก เก็บแค่ ไทย/อังกฤษ/ตัวเลข
    text = re.sub(r" +", " ", text).strip()                  # ลด space ซ้ำ
    return text


def tokenize_text(text):
    """
    ตัดคำภาษาไทยด้วย newmm
    ผลลัพธ์: "ฉันรักเธอ" → "ฉัน รัก เธอ"
    """
    tokens = word_tokenize(text, engine="newmm", keep_whitespace=False)
    return " ".join(t for t in tokens if t.strip())


def preprocess(text):
    """clean + tokenize ในขั้นเดียว ใช้ทั้งตอนสร้าง index และตอนแปลง query ให้ผ่านทางเดียวกัน"""
    return tokenize_text(clean_text(text))
