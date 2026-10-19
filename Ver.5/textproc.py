import re
from pythainlp.tokenize import word_tokenize
from pythainlp.util import normalize  # นี่คือ normalize ของ pythainlp (จัดระเบียบตัวอักษรไทย) ไม่ใช่ normalize ของ numpy/sklearn ที่ปรับสเกลตัวเลข — คนละเรื่องกันแม้ชื่อเหมือนกัน

#กำจัดตัวอักษรพิฌสษและจัดการช่องว่าง
def clean_text(text):
    # แก้วรรณยุกต์ซ้อน เช่น " ่่ หรือ  ้้ " / สระผิดตำแหน่ง เช่น " มแว หรือ กได์ "
    text = normalize(text)
    # เอาทุกตัวที่เป็นภาษาไทย ก-ฮ รวมถึงสระ วรรณยุก,ภาษาอังกฤษ,ตัวเลข0-9 นอกนั้นแทนที่ด้วย"" ก็คือตัดออกนั่นแหละ ไม่ใช่พวกนี้ตีเก๊ว่าง่ายๆ
    text = re.sub(r"[^฀-๿a-zA-Z0-9\s]", "", text)
    # ตัดบางข้อความที่มีการเว้นว่าง "   " ออกเป็น " " แค่ช่องเดียว
    text = re.sub(r" +", " ", text).strip()
    return text

# แบ่งคำ
def tokenize_text(text):
    # ตัดคำโดยใช้ newmm ของ pythainlp โดยไม่เอาช่องว่าเป็น Token
    tokens = word_tokenize(text, engine="newmm", keep_whitespace=False)
    
    non_empty_tokens = []
    for t in tokens:          # วนดูทีละคำใน tokens
        if t.strip():         # ถ้าคำนี้ไม่ใช่ช่องว่างเปล่าๆ
            non_empty_tokens.append(t)   # เก็บคำนี้ไว้ในลิสต์ใหม่

    return " ".join(non_empty_tokens)  # ต่อคำที่เหลือด้วยช่องว่าง

#เรียกใช้ทั้ง 2 Function
def preprocess(text):
    """clean + tokenize ในขั้นเดียว ใช้ทั้งตอนสร้าง index และตอนแปลง query ให้ผ่านทางเดียวกัน"""
    return tokenize_text(clean_text(text))
