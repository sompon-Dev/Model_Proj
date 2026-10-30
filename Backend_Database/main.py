
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
import psycopg2
import psycopg2.extras
import uuid


def _load_env():
    """อ่านค่าจากไฟล์ .env ข้างๆ ไฟล์นี้ (ถ้ามี) เช่น DB_PASSWORD=xxxx
    เขียนเองแทนใช้ library python-dotenv — ทำหน้าที่เหมือนกันคือแยก "KEY=VALUE" แล้วตั้งเป็น
    environment variable ให้ os.environ.get() ด้านล่างอ่านเจอทีหลัง"""
    env_file = Path(__file__).parent / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)  # split("=", 1) แยกแค่ "=" ตัวแรก เผื่อ VALUE มี "=" ปนอยู่
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))  # setdefault: ตั้งค่าก็ต่อเมื่อยังไม่มีตัวแปรนี้มาก่อน ไม่ทับของเดิม


_load_env()

app = FastAPI()

# CORS (Cross-Origin Resource Sharing): ปกติเบราว์เซอร์/แอปจะยิง request ข้าม origin (เช่นจาก
# แอป React Native ไปที่ server คนละ host/port) ไม่ได้ถ้า server ไม่อนุญาตไว้ก่อน
# allow_origins=["*"] คือ "อนุญาตทุก origin" allow_methods/allow_headers=["*"] คือ "อนุญาตทุก HTTP
# method/header" — เปิดกว้างสุดเพื่อให้พัฒนา/ทดสอบง่าย แต่ไม่ควรใช้ค่านี้ตอน deploy ใช้งานจริง
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# อ่านค่าเชื่อมต่อ DB จาก environment variable (ไม่ hardcode รหัสผ่านไว้ในโค้ด)
# ตั้งค่าก่อนรัน: คัดลอก .env.example เป็น .env แล้วใส่ค่าจริง (ดู .env.example)
DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "localhost"),
    "port": int(os.environ.get("DB_PORT", "5432")),
    "dbname": os.environ.get("DB_NAME", "LyricSeekDB"),
    "user": os.environ.get("DB_USER", "postgres"),
    "password": os.environ.get("DB_PASSWORD", ""),
}


def get_connection():
    return psycopg2.connect(**DB_CONFIG)


# CryptContext จาก passlib จัดการ hash รหัสผ่านให้ (เก็บ hash ไม่เก็บรหัสผ่านตัวจริงลง DB)
# schemes=["bcrypt"]: ใช้อัลกอริทึม bcrypt (ออกแบบมาเพื่อ hash รหัสผ่านโดยเฉพาะ ช้าโดยตั้งใจเพื่อให้เดารหัสยาก)
# deprecated="auto": ถ้าในอนาคตเปลี่ยน scheme ใหม่ รหัสผ่านเก่าที่ hash ด้วย scheme เดิมยังตรวจสอบได้อยู่
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# BaseModel (จาก pydantic) ใช้นิยามรูปแบบข้อมูลที่รับเข้ามาทาง endpoint แต่ละคลาสด้านล่างนี้คือ
# "แบบฟอร์ม" 1 ใบ บอก FastAPI ว่า field ไหนชื่ออะไร ชนิดอะไร (str, int, EmailStr ฯลฯ)
# พอมีคนยิง request เข้ามา FastAPI จะเช็ก type ให้เองอัตโนมัติ ถ้าข้อมูลไม่ตรงจะตอบ error กลับไปเลย
# ไม่ต้องเขียนโค้ดเช็กมือ — EmailStr คือ str ที่ pydantic เช็กฟอร์แมตอีเมลให้ด้วยว่าถูกต้องไหม
#
class UserData(BaseModel):
    username: str
    email: EmailStr
    password: str
    
class UpdateUserData(BaseModel):
    username: str
    email: EmailStr

class Train_SongData(BaseModel):
    newsong_name: str
    newsong_artist:str
    newsong_lyrics:str

class UpdateTrain_SongData(BaseModel):
    newsong_name: str
    newsong_artist:str
    newsong_lyrics:str

# ใช้คู่กับหน้า UpdateModel.js: admin ติ๊กเลือกเพลงจาก Train_Song ได้หลายเพลง ส่ง newsong_id มาเป็น list
class UpdateModelData(BaseModel):
    newsong_ids: list[int]

class SongData(BaseModel):
    song_name: str
    spotify_Link:str
    youtube_link:str

# ใช้คู่กับหน้า Homeuser.js ตอนค้นหาผ่านโมเดล Ver.5 (ผลลัพธ์มีแค่ song_name ไม่มี song_id เพราะ
# โมเดลไม่เชื่อมกับ database) ส่งชื่อเพลงที่เจอมาเป็น list แล้วให้ไปหา song_id/youtube_link จริงให้
class SongNamesData(BaseModel):
    song_names: list[str]

# ใช้คู่กับหน้า AddSong.js ของแอดมิน: เพิ่มเพลง 1 เพลงให้ครบทุกตาราง (Song, Genre_Song, Mood_Song,
# Train_Song) ในคำขอเดียว — song_genre/song_mood เป็น list เพราะแอดมินติ๊กเลือกได้หลายอันจากหน้าฟอร์ม
class AddSongData(BaseModel):
    song_name: str
    artist: str
    lyric: str
    song_genre: list[str] = []
    song_mood: list[str] = []
    youtube_link: str = ""
    spotify_link: str = ""

class Update_SongData(BaseModel):
    song_name: str
    spotify_Link:str
    youtube_link:str

# ใช้คู่กับหน้า EditAdmin.js: genre_ids/mood_ids คือรายการ "ทั้งหมด" ที่เพลงนี้ควรมีหลังบันทึก
class EditSongData(BaseModel):
    artist: str
    youtube_link: str
    genre_ids: list[int]
    mood_ids: list[int]

class GenreData(BaseModel):
    genre_name: str

class UpdateGenreData(BaseModel):
    genre_name: str

class Genre_SongData(BaseModel):
    song_id: int
    genre_id: int

class UpdateGenre_SongData(BaseModel):
    song_id: int
    genre_id: int

class MoodData(BaseModel):
    mood_name: str

class UpdateMoodData(BaseModel):
    mood_name: str

class Mood_SongData(BaseModel):
    song_id: int
    mood_id: int

class UpdateMood_SongData(BaseModel):
    song_id: int
    mood_id: int

class AdminData(BaseModel):
    admin_email: EmailStr
    admin_password: str

class UpdateAdminData(BaseModel):
    admin_email: EmailStr
    admin_password: str

# หมายเหตุ: pgAdmin โชว์ type ของ verified_username/verified_email/verified_password
# เป็น "char"[] (array ของตัวอักษรเดี่ยว) ซึ่งน่าจะตั้งผิดตอนสร้างตาราง (น่าจะตั้งใจเป็น
# character varying/text) โค้ดนี้เขียนให้รับ-ส่งเป็น string ปกติ ถ้าตารางจริงเป็น "char"[]
# จริงๆ INSERT/UPDATE ด้านล่างจะ error เพราะชนิดไม่ตรงกัน ต้องแก้ type ในฐานข้อมูลก่อน
class VerifiedUserData(BaseModel):
    verified_username: str
    verified_email: EmailStr
    verified_password: str

class UpdateVerifiedUserData(BaseModel):
    verified_username: str
    verified_email: EmailStr
    verified_password: str

class TrendingSongData(BaseModel):
    song_id: int
    trend_song_name: str
    trend_alltime: int
    trend_one_week: int
    trend_one_month: int
    trend_one_year: int

class UpdateTrendingSongData(BaseModel):
    song_id: int
    trend_song_name: str
    trend_alltime: int
    trend_one_week: int
    trend_one_month: int
    trend_one_year: int

# ใช้คู่กับหน้า MostSearch.js ของแอดมิน: แอดมินติ๊กเลือกเพลงได้สูงสุด 2 เพลง (เช็คจำนวนไว้ฝั่งแอป)
# แล้วกด Add เพื่อตั้งเป็นเพลงแนะนำ (trend_add = true) ไปโชว์ใน "For You" ของหน้า Homeuser.js
class AddRecommendData(BaseModel):
    trend_song_ids: list[int]

# ใช้คู่กับ Result.js / Homeuser.js (For You) / History.js: ผู้ใช้กดเปิดเพลงใน YouTube Music
# user_id คือ users_id (uuid) ของผู้ใช้ใน Supabase — คนละ database กับที่นี่ จึงผูก foreign key ไม่ได้
class HistoryData(BaseModel):
    user_id: uuid.UUID
    song_id: int


# ---------- เพิ่มข้อมูล ตาราง users ----------
# @app.post("/users") คือ decorator บอก FastAPI ว่า "ถ้ามีคน POST มาที่ /users ให้เรียกฟังก์ชันนี้"
# data: UserData บอกให้ FastAPI แปลง JSON body ที่ส่งมาเป็น object UserData ให้อัตโนมัติ (พร้อมเช็ก type)
# รูปแบบนี้ (decorator + ฟังก์ชัน + get_connection + RETURNING + commit + close + return dict) ซ้ำกัน
# แทบทุกตารางด้านล่างทั้งไฟล์ — คอมเมนต์ตรงนี้อธิบายละเอียดครั้งเดียว ตารางอื่นจะมีแค่คอมเมนต์สั้นๆชี้กลับมา
@app.post("/users")
def create_user(data: UserData):
    hashed_password = pwd_context.hash(data.password)  # แปลงรหัสผ่านดิบเป็น hash ก่อนเก็บ (ย้อนกลับเป็นรหัสเดิมไม่ได้ ตรวจสอบได้แต่อ่านค่าจริงไม่ได้)

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)  # RealDictCursor: ให้แต่ละแถวที่ query ได้มาเป็น dict (เช่น row["user_id"]) แทน tuple (row[0])
    cursor.execute(
        'INSERT INTO "User" (username, email, password) VALUES (%s, %s, %s) RETURNING user_id',
        (data.username, data.email, hashed_password),
    )
    new_id = cursor.fetchone()["user_id"]  # RETURNING user_id ให้ Postgres ส่ง id ที่มันสร้างให้อัตโนมัติ (SERIAL) กลับมาในคำสั่ง INSERT เดียวกัน ไม่ต้อง SELECT แยกอีกรอบ
    conn.commit()  # ยืนยันบันทึกการเปลี่ยนแปลงลงฐานข้อมูลจริง (ถ้าไม่เรียกจะไม่ถูกบันทึกจริง)
    conn.close()   # ปิดการเชื่อมต่อเสมอหลังใช้งานเสร็จ กันการเชื่อมต่อค้าง

    return {"status": "success", "users_id": new_id}  # แค่ return dict ธรรมดา FastAPI แปลงเป็น JSON ส่งกลับไปให้เอง


# ---------- /register คือ URL ชื่อเดิมที่ Register.jsx เรียกอยู่ ----------
# ให้ทำงานเหมือนกับ /users เป๊ะๆ แค่คนละชื่อ URL ตาราง users
@app.post("/register")
def register(data: UserData):
    return create_user(data)


# ---------- อ่านข้อมูลทั้งหมด ตาราง users ----------
@app.get("/users")
def read_users():
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('SELECT user_id, username, email FROM "User" ORDER BY user_id')
    users = cursor.fetchall()
    conn.close()

    return {"status": "success", "data": users}


# ---------- อ่านข้อมูลคนเดียว ตาราง users ----------
# {user_id} ใน path ของ decorator ผูกกับ parameter user_id: int ของฟังก์ชันอัตโนมัติ — ถ้ามีคนเรียก
# GET /users/5 แปลว่า user_id จะเท่ากับ 5 เลย (FastAPI แปลงจาก string ใน URL เป็น int ให้ตามชนิดที่ประกาศ)
@app.get("/users/{user_id}")
def read_user(user_id: int):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'SELECT user_id, username, email FROM "User" WHERE user_id = %s',
        (user_id,),
    )
    user = cursor.fetchone()
    conn.close()

    return {"status": "success", "data": user}


# ---------- แก้ไขข้อมูล ตาราง users ----------
@app.put("/users/{user_id}")
def update_user(user_id: int, data: UpdateUserData):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'UPDATE "User" SET username = %s, email = %s WHERE user_id = %s',
        (data.username, data.email, user_id),
    )
    conn.commit()
    conn.close()

    return {"status": "success"}


# ---------- ลบข้อมูล ตาราง users ----------
@app.delete("/users/{user_id}")
def delete_user(user_id: int):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('DELETE FROM "User" WHERE user_id = %s', (user_id,))
    conn.commit()
    conn.close()

    return {"status": "success"}










#class Train_SongData(BaseModel):
#    newsong_name: str
#    newsong_artist:str
#    newsong_lyrics:str





@app.post("/Train_Song")
def create_Train_Song(data:Train_SongData):


    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'INSERT INTO "Train_Song" (newsong_name, newsong_artist, newsong_lyrics) VALUES (%s, %s, %s) RETURNING newsong_id',
        (data.newsong_name, data.newsong_artist, data.newsong_lyrics),
    )
    new_id = cursor.fetchone()["newsong_id"]
    conn.commit()
    conn.close()

    return {"status": "success", "newsong_id": new_id}


# ---------- /register คือ URL ชื่อเดิมที่ Register.jsx เรียกอยู่ ----------
# ให้ทำงานเหมือนกับ /users เป๊ะๆ แค่คนละชื่อ URL ตาราง users
# ⚠ บั๊กที่รู้อยู่แล้ว (ดู Document.md ส่วนที่ 3 ข้อ 5): endpoint นี้ประกาศ @app.post("/Train_Song") ซ้ำกับ
# create_Train_Song ด้านบน — FastAPI ใช้ตัวที่ประกาศก่อนเสมอเวลา path ชนกัน ฟังก์ชันนี้จึงไม่ถูกเรียกจริง
# (ไม่ error แค่เป็นโค้ดที่ไม่มีผล) ไม่แก้ตอนนี้เพื่อคงพฤติกรรมเดิมไว้ก่อน
@app.post("/Train_Song")
def register_newsong(data: Train_SongData):
    return create_Train_Song(data)


# ---------- อ่านข้อมูลทั้งหมด ตาราง users ----------
@app.get("/Train_Song")
def read_Train_Song():
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('SELECT newsong_id, newsong_name, newsong_artist FROM "Train_Song" ORDER BY newsong_id')
    Train_Song = cursor.fetchall()
    conn.close()

    return {"status": "success", "data": Train_Song}


# ---------- หน้า UpdateModel.js ของแอดมินเรียก endpoint นี้: เอาเพลงที่ติ๊กไว้ไปเทรนเข้าโมเดล Ver.5 ----------
# ต้องประกาศ route คงที่นี้ไว้ "ก่อน" /Train_Song/{newsong_id} ด้านล่าง ไม่งั้น FastAPI จะจับคู่คำว่า
# "update_model" เข้ากับ newsong_id (ซึ่งเป็น int) แล้ว error ไปก่อนถึง route นี้ (เหมือน /Genre/unique)
# โมเดลจริง (torch/sentence-transformers + ไฟล์ index) อยู่บน Modal ไม่ใช่เครื่องนี้ (ดู Ver.5/modal_app.py)
# Render (เครื่องที่รัน main.py นี้) ไม่ได้ลง library พวกนั้นไว้เลย เรียก BuildindexUpdate ตรงๆ ในเครื่อง
# นี้จึงพังทุกครั้ง (ModuleNotFoundError) — endpoint นี้แค่ยิง HTTP ไปให้ Modal เทรนแทน
MODAL_UPDATE_MODEL_URL = "https://sompon-dev--lyriseek-search-web.us-east.modal.run/update_model"


@app.post("/Train_Song/update_model")
def update_model_with_selected_songs(data: UpdateModelData):
    """ขั้นตอน: (1) ดึงเพลงที่ admin ติ๊กไว้จากตาราง Train_Song (2) ส่งเพลงพวกนี้ไปให้ Ver.5/API.py
    (รันอยู่บน Modal) เทรนเข้า index จริง ผ่าน HTTP POST (3) ลบเฉพาะเพลงที่เพิ่งเทรนไปออกจาก
    Train_Song — เพลงที่ admin ไม่ได้ติ๊กยังอยู่ใน Train_Song เหมือนเดิม
    หมายเหตุ: ขั้นตอนนี้ช้า (ฝั่ง Modal ต้อง encode เพลงใหม่) request จะค้างรอจนกว่าจะเสร็จ"""
    if not data.newsong_ids:
        return {"status": "error", "error": "ไม่ได้เลือกเพลงเลย"}

    import requests

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'SELECT newsong_id, newsong_name, newsong_artist, newsong_lyrics FROM "Train_Song" WHERE newsong_id = ANY(%s)',
        (data.newsong_ids,),
    )
    rows = cursor.fetchall()

    if not rows:
        conn.close()
        return {"status": "error", "error": "ไม่พบเพลงที่เลือกในตาราง Train_Song"}

    songs_payload = [
        {
            "newsong_name": row["newsong_name"],
            "newsong_artist": row["newsong_artist"],
            "newsong_lyrics": row["newsong_lyrics"],
        }
        for row in rows
    ]
    print(f"[UpdateModel] ส่ง {len(songs_payload)} เพลงไปเทรนที่ Modal...")

    try:
        res = requests.post(
            MODAL_UPDATE_MODEL_URL,
            json={"songs": songs_payload},
            timeout=280,  # น้อยกว่า 300 วิที่ Modal ตั้งไว้นิดหน่อย กันเคส Modal กำลังจะ timeout พอดีแต่เรายังรอไม่ทัน
        )
        result = res.json()
    except Exception as e:
        conn.close()
        print(f"[UpdateModel] เรียก Modal ไม่สำเร็จ: {e} (ไม่ลบอะไรออกจาก Train_Song ไว้ลองใหม่ได้)")
        return {"status": "error", "error": f"เชื่อมต่อโมเดลไม่สำเร็จ: {e}"}

    if result.get("status") != "success":
        conn.close()
        print(f"[UpdateModel] Modal อัปเดตโมเดลไม่สำเร็จ: {result.get('error')} (ไม่ลบอะไรออกจาก Train_Song ไว้ลองใหม่ได้)")
        return {"status": "error", "error": result.get("error", "อัปเดตโมเดลไม่สำเร็จ")}

    trained_ids = [row["newsong_id"] for row in rows]
    cursor.execute('DELETE FROM "Train_Song" WHERE newsong_id = ANY(%s)', (trained_ids,))
    conn.commit()
    conn.close()

    print(f"[UpdateModel] ลบ {len(trained_ids)} เพลงออกจาก Train_Song แล้ว (เทรนเข้าโมเดลสำเร็จ)")

    return {"status": "success", "trained_song_ids": trained_ids, **{k: v for k, v in result.items() if k != "status"}}


# ---------- อ่านข้อมูลคนเดียว ตาราง users ----------
@app.get("/Train_Song/{newsong_id}")
def read_Train_Song(newsong_id: int):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    # ⚠ บั๊กที่รู้อยู่แล้ว (ดู Document.md ส่วนที่ 3 ข้อ 1): query นี้ไปค้นตาราง "User" ผิด (น่าจะคัดลอก
    # มาจากส่วน users แล้วลืมแก้) ที่ถูกต้องควรเป็น FROM "Train_Song" WHERE newsong_id — ไม่แก้ตอนนี้
    # เพื่อคงพฤติกรรมเดิมไว้ก่อน
    cursor.execute(
        'SELECT newsong_id, newsong_name, newsong_artist FROM "User" WHERE user_id = %s',
        (newsong_id,),
    )
    Train_Song = cursor.fetchone()
    conn.close()

    return {"status": "success", "data": Train_Song}


# ---------- แก้ไขข้อมูล ตาราง users ----------
@app.put("/Train_Song/{newsong_id}")
def update_Train_Song(newsong_id: int, data: UpdateTrain_SongData):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    # ⚠ บั๊กที่รู้อยู่แล้ว (ดู Document.md ส่วนที่ 3 ข้อ 2): ชื่อคอลัมน์ผิด (username, email ไม่มีในตาราง
    # Train_Song — ที่ถูกต้องควรเป็น newsong_name, newsong_artist WHERE newsong_id) และยังไม่ได้อัปเดต
    # เนื้อร้อง (newsong_lyrics) เลย ไม่แก้ตอนนี้เพื่อคงพฤติกรรมเดิมไว้ก่อน
    cursor.execute(
        'UPDATE "Train_Song" SET username = %s, email = %s WHERE user_id = %s',
        (data.newsong_name, data.newsong_artist, newsong_id),
    )
    conn.commit()
    conn.close()

    return {"status": "success"}


# ---------- ลบข้อมูล ตาราง users ----------
# หมายเหตุ: ฟังก์ชันนี้ตั้งชื่อ delete_user ซ้ำกับฟังก์ชันลบ User ด้านบน (และ Song ด้านล่างก็ใช้ชื่อนี้อีก)
# ทำงานได้ถูกต้องเพราะ FastAPI ผูก endpoint ไว้กับ decorator ตอนไฟล์ถูกอ่านไปแล้ว ไม่ได้ผูกกับชื่อฟังก์ชัน
# แต่ชื่อซ้ำแบบนี้ทำให้อ่านโค้ดสับสนว่ากำลังดูฟังก์ชันไหนอยู่ (ดู Document.md ส่วนที่ 3 "เรื่องอื่นที่ควรรู้")
@app.delete("/Train_Song/{newsong_id}")
def delete_user(newsong_id: int):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('DELETE FROM "Train_Song" WHERE newsong_id = %s', (newsong_id,))
    conn.commit()
    conn.close()

    return {"status": "success"}



#class SongData(BaseModel):
#    song_name: str
#    spotify_Link:str
#    youtube_link:str


@app.post("/Song")
def create_Song(data:SongData):
    

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'INSERT INTO "Song" (song_name, spotify_Link, youtube_link) VALUES (%s, %s, %s) RETURNING song_id',
        (data.song_name, data.spotify_Link, data.youtube_link),
    )
    song_id = cursor.fetchone()["song_id"]
    conn.commit()
    conn.close()

    return {"status": "success", "song_id": song_id}


# ---------- หน้า AddSong.js ของแอดมินเรียก endpoint นี้: เพิ่มเพลง 1 เพลงให้ครบทุกตารางในคำขอเดียว ----------
# ใช้ฟังก์ชัน Add_song จาก AddSong.py (เขียนไว้แยกไฟล์อยู่แล้ว ไม่ต้องเขียนใหม่)
# import แบบ deferred (อยู่ในฟังก์ชัน ไม่อยู่บนสุดไฟล์) เพราะ AddSong.py เองก็ import get_connection
# กลับมาจาก main.py นี้ — ถ้า import ไว้บนสุดจะเกิด circular import (สองไฟล์ import กันไปมา
# ตอนเริ่มโหลด) แต่พอ import ตอนถูกเรียกใช้งานจริง main.py โหลดเสร็จสมบูรณ์แล้ว จึงไม่มีปัญหา
@app.post("/AddSong")
def create_song_full(data: AddSongData):
    from AddSong import Add_song

    song_genre_str = ", ".join(data.song_genre)
    song_mood_str = ", ".join(data.song_mood)

    return Add_song(
        data.song_name, data.artist, song_genre_str,
        data.youtube_link, data.spotify_link, song_mood_str, data.lyric,
    )


# ---------- /register คือ URL ชื่อเดิมที่ Register.jsx เรียกอยู่ ----------
# ให้ทำงานเหมือนกับ /users เป๊ะๆ แค่คนละชื่อ URL ตาราง users
# ⚠ บั๊กที่รู้อยู่แล้ว (ดู Document.md ส่วนที่ 3 ข้อ 5): endpoint นี้ประกาศ @app.post("/Song") ซ้ำกับ
# create_Song ด้านบน — FastAPI ใช้ตัวที่ประกาศก่อนเสมอ ฟังก์ชันนี้จึงไม่ถูกเรียกจริง ไม่แก้ตอนนี้
@app.post("/Song")
def register_song(data: SongData):
    return create_Song(data)


# ---------- อ่านข้อมูลทั้งหมด ตาราง Song ----------
@app.get("/Song")
def read_Song():
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('SELECT song_id, song_name, spotify_Link, youtube_link FROM "Song" ORDER BY song_id')
    Song = cursor.fetchall()
    conn.close()

    return {"status": "success", "data": Song}


# ---------- หน้า EditAdmin.js: ค้นหาเพลงจากคำในชื่อเพลง พร้อม genre/mood ของแต่ละเพลง ----------
# ต้องประกาศ route คงที่นี้ไว้ "ก่อน" /Song/{song_id} ด้านล่าง เหตุผลเดียวกับ /Song/by_genre
@app.get("/Song/search")
def search_Song(q: str = ""):
    keyword = q.strip()
    if not keyword:
        return {"status": "success", "data": []}

    # ESCAPE กัน % และ _ ที่แอดมินพิมพ์มาไม่ให้ถูกตีความเป็น wildcard ของ ILIKE
    pattern = "%" + keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'SELECT s.song_id, s.song_name, s."Artist", s.youtube_link, s."Image_Link", '
        '  COALESCE((SELECT json_agg(json_build_object(\'genre_id\', g.genre_id, \'genre_name\', g.genre_name) ORDER BY g.genre_name) '
        '            FROM (SELECT DISTINCT genre_id FROM "Genre_Song" WHERE song_id = s.song_id) gs '
        '            JOIN "Genre" g ON g.genre_id = gs.genre_id), \'[]\'::json) AS genres, '
        '  COALESCE((SELECT json_agg(json_build_object(\'mood_id\', m.mood_id, \'mood_name\', m.mood_name) ORDER BY m.mood_name) '
        '            FROM (SELECT DISTINCT mood_id FROM "Mood_Song" WHERE song_id = s.song_id) ms '
        '            JOIN "Mood" m ON m.mood_id = ms.mood_id), \'[]\'::json) AS moods '
        'FROM "Song" s WHERE s.song_name ILIKE %s ESCAPE \'\\\' '
        'ORDER BY s.song_name, s.song_id LIMIT 50',
        (pattern,),
    )
    songs = cursor.fetchall()
    conn.close()

    return {"status": "success", "data": songs}


# ---------- หน้า EditAdmin.js: บันทึกศิลปินและ genre/mood ของเพลง 1 เพลง ----------
# ไม่รับชื่อเพลง เพราะผลค้นหาจากโมเดลจับคู่กับตาราง Song ด้วยชื่อเพลง แก้ชื่อแล้วจะหาลิงก์ไม่เจอ
@app.put("/Song/{song_id}/details")
def edit_Song_details(song_id: int, data: EditSongData):
    from AddSong import get_thumbnail_link  # deferred เหตุผลเดียวกับ /AddSong ด้านบน (AddSong.py import จากไฟล์นี้)

    artist = data.artist.strip() or None
    youtube_link = data.youtube_link.strip()

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        cursor.execute('SELECT youtube_link, "Image_Link" FROM "Song" WHERE song_id = %s', (song_id,))
        song = cursor.fetchone()
        if not song:
            return {"status": "error", "error": f"ไม่พบเพลง song_id={song_id} ในตาราง Song"}

        # เช็กเฉพาะตอนลิงก์เปลี่ยน: เพลงเก่าบางเพลงลิงก์ไม่ถูกต้องอยู่แล้ว (เช่นลิงก์เพลย์ลิสต์)
        # ถ้าเช็กทุกครั้ง แอดมินจะแก้ genre/mood ของเพลงพวกนั้นไม่ได้จนกว่าจะแก้ลิงก์ก่อน
        image_link = song["Image_Link"]
        if youtube_link != song["youtube_link"]:
            image_link = get_thumbnail_link(youtube_link)
            if not image_link or len(youtube_link) > 255:
                return {"status": "error", "error": "ลิงก์ไม่ถูกต้อง ต้องเป็นลิงก์เพลงเดี่ยวของ YouTube หรือ YouTube Music"}

        cursor.execute(
            'UPDATE "Song" SET "Artist" = %s, youtube_link = %s, "Image_Link" = %s WHERE song_id = %s',
            (artist, youtube_link, image_link, song_id),
        )
        # history คัดลอกค่าเหล่านี้มาเก็บเอง ต้องตามให้ตรงไม่งั้นกดจากหน้า History จะเปิดลิงก์เก่าที่ผิด
        cursor.execute(
            'UPDATE "history" SET "Artist" = %s, youtube_link = %s, "Image_Link" = %s WHERE song_id = %s',
            (artist, youtube_link, image_link, song_id),
        )

        # ลบของเดิมแล้วใส่ชุดใหม่ใน transaction เดียว ถ้าพังกลางทางจะไม่มีเพลงที่ genre/mood หาย
        # Genre_Song/Mood_Song ไม่มี foreign key จึงต้อง SELECT จากตารางหลักเพื่อกรอง id ที่ไม่มีจริงออก
        cursor.execute('DELETE FROM "Genre_Song" WHERE song_id = %s', (song_id,))
        cursor.execute(
            'INSERT INTO "Genre_Song" (song_id, genre_id) '
            'SELECT %s, genre_id FROM "Genre" WHERE genre_id = ANY(%s)',
            (song_id, data.genre_ids),
        )
        cursor.execute('DELETE FROM "Mood_Song" WHERE song_id = %s', (song_id,))
        cursor.execute(
            'INSERT INTO "Mood_Song" (song_id, mood_id) '
            'SELECT %s, mood_id FROM "Mood" WHERE mood_id = ANY(%s)',
            (song_id, data.mood_ids),
        )
        conn.commit()
    finally:
        conn.close()

    return {"status": "success", "youtube_link": youtube_link, "Image_Link": image_link}


# ---------- อ่านรายชื่อเพลงตาม genre ที่ user ติ๊กมาจากหน้า Filter ----------
# ต้องประกาศ route คงที่นี้ไว้ "ก่อน" /Song/{song_id} ด้านล่าง ไม่งั้น FastAPI จะจับคู่คำว่า
# "by_genre" เข้ากับ song_id (ซึ่งเป็น int) แล้ว error ไปก่อนถึง route นี้
@app.get("/Song/by_genre")
def read_Song_by_genre(genre_ids: str):
    """รับ genre_ids เป็น string คั่นด้วยจุลภาค เช่น "1,13" (มาจาก genre_id ที่ user ติ๊กไว้)
    ขั้นที่ 1: หา song_id ทั้งหมดในตาราง Genre_Song ที่ genre_id ตรงกับที่ส่งมา
    ขั้นที่ 2: เอา song_id ที่ได้ไปดึงข้อมูลเพลงจริงจากตาราง Song กลับไปให้ frontend"""
    try:
        genre_id_list = [int(g) for g in genre_ids.split(",") if g.strip()]
    except ValueError:
        return {"status": "error", "message": "genre_ids ต้องเป็นตัวเลขคั่นด้วยจุลภาค เช่น 1,13"}

    if not genre_id_list:
        return {"status": "success", "data": []}

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # ขั้นที่ 1: genre_id -> song_id (ANY(%s) คือ "เท่ากับตัวใดตัวหนึ่งใน list นี้")
    cursor.execute(
        'SELECT DISTINCT song_id FROM "Genre_Song" WHERE genre_id = ANY(%s)',
        (genre_id_list,),
    )
    song_id_list = [row["song_id"] for row in cursor.fetchall()]

    if not song_id_list:
        conn.close()
        return {"status": "success", "data": []}

    # ขั้นที่ 2: song_id -> ข้อมูลเพลงจริง (รวม "Artist" ด้วย หลังจากเพิ่มคอลัมน์นี้เข้า Song แล้ว)
    # LIMIT 200: genre ยอดนิยม (เช่น "thai" มีเพลงกว่า 5,000 เพลง) ถ้าไม่จำกัดจะส่งข้อมูลมหาศาล
    # กลับไปให้แอป render ทีเดียวหมด ทำให้แอปค้าง — 200 เพลงแรกพอสำหรับโชว์ผลลัพธ์แล้ว
    cursor.execute(
        'SELECT song_id, song_name, "Artist", spotify_Link, youtube_link, "Image_Link" FROM "Song" '
        'WHERE song_id = ANY(%s) ORDER BY song_id LIMIT 200',
        (song_id_list,),
    )
    songs = cursor.fetchall()
    conn.close()

    return {"status": "success", "data": songs}


# ---------- หน้า Homeuser.js เรียก endpoint นี้หลังค้นหาผ่านโมเดล Ver.5 ----------
# ผลลัพธ์จากโมเดลมีแค่ song_name/artist (ข้อความ) ไม่มี song_id เพราะโมเดลไม่เชื่อมกับ database เลย
# endpoint นี้รับชื่อเพลงที่เจอมาเป็น list แล้วไปหาใน Song ว่าชื่อนี้ song_id/youtube_link คืออะไร
# (เทียบด้วยชื่อเพลงเท่านั้น เพราะตาราง Song ไม่มีคอลัมน์ artist — ถ้ามีเพลงชื่อซ้ำกันคนละศิลปิน
# อาจจับคู่ผิดเพลงได้ เป็นข้อจำกัดที่รู้อยู่แล้ว)
@app.post("/Song/by_names")
def read_Song_by_names(data: SongNamesData):
    if not data.song_names:
        return {"status": "success", "data": []}

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'SELECT song_id, song_name, youtube_link, "Image_Link" FROM "Song" WHERE song_name = ANY(%s)',
        (data.song_names,),
    )
    songs = cursor.fetchall()
    conn.close()

    return {"status": "success", "data": songs}


# ---------- อ่านข้อมูลคนเดียว ตาราง Song ----------
@app.get("/Song/{song_id}")
def read_Song(song_id: int):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    # ⚠ บั๊กที่รู้อยู่แล้ว (ดู Document.md ส่วนที่ 3 ข้อ 3): query นี้ไปค้นตาราง "User" ผิด ที่ถูกต้อง
    # ควรเป็น FROM "Song" WHERE song_id — ไม่แก้ตอนนี้เพื่อคงพฤติกรรมเดิมไว้ก่อน
    cursor.execute(
        'SELECT song_id, song_name, spotify_Link, youtube_link FROM "User" WHERE song_id = %s',
        (song_id,),
    )
    Song = cursor.fetchone()
    conn.close()

    return {"status": "success", "data": Song}


# ---------- แก้ไขข้อมูล ตาราง users ----------
# ⚠ บั๊กที่รู้อยู่แล้ว (ดู Document.md ส่วนที่ 3 ข้อ 4): path เขียนเป็นตัวพิมพ์เล็ก "/song/{song_id}"
# ขณะที่ endpoint อื่นของตาราง Song ใช้ "/Song/{song_id}" (ตัวพิมพ์ใหญ่) ทำให้ URL ไม่ตรงกัน และ
# WHERE user_id ก็ผิด (ตาราง Song ไม่มีคอลัมน์ user_id ควรเป็น WHERE song_id) ไม่แก้ตอนนี้
@app.put("/song/{song_id}")
def update_Song(song_id: int, data: Update_SongData):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'UPDATE "Song" SET song_name = %s, spotify_Link = %s, youtube_link = %s WHERE user_id = %s',
        (data.song_name, data.spotify_Link, data.youtube_link, song_id),
    )
    conn.commit()
    conn.close()

    return {"status": "success"}


# ---------- ลบข้อมูล ตาราง users ----------
# หมายเหตุ: ชื่อฟังก์ชัน delete_user ซ้ำกับตัวลบ User/Train_Song ด้านบน — ทำงานถูกต้องเพราะ decorator
# ผูก endpoint ไว้แล้วตอนไฟล์ถูกอ่าน แต่ชื่อซ้ำทำให้อ่านสับสนว่ากำลังดูของตารางไหน
@app.delete("/Song/{song_id}")
def delete_user(song_id: int):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('DELETE FROM "Song" WHERE song_id = %s', (song_id,))
    conn.commit()
    conn.close()

    return {"status": "success"}





# ---------- เพิ่มข้อมูล ตาราง Genre ----------
@app.post("/Genre")
def create_Genre(data: GenreData):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'INSERT INTO "Genre" (genre_name) VALUES (%s) RETURNING genre_id',
        (data.genre_name,),
    )
    new_id = cursor.fetchone()["genre_id"]
    conn.commit()
    conn.close()

    return {"status": "success", "genre_id": new_id}


# ---------- อ่านข้อมูลทั้งหมด ตาราง Genre ----------
@app.get("/Genre")
def read_Genre():
    """เรียงจาก genre ที่มีเพลงเยอะสุดไปน้อยสุด (ใช้โชว์ในหน้า Filter ของ Homeuser.js)
    LEFT JOIN กับ Genre_Song แล้วนับจำนวนเพลงต่อ genre — genre ที่ไม่มีเพลงเลยจะนับเป็น 0 (ไม่หายไปจากลิสต์)"""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'SELECT g.genre_id, g.genre_name, COUNT(gs.song_id) AS song_count '
        'FROM "Genre" g LEFT JOIN "Genre_Song" gs ON gs.genre_id = g.genre_id '
        'GROUP BY g.genre_id, g.genre_name '
        'ORDER BY song_count DESC, g.genre_name'
    )
    genres = cursor.fetchall()
    conn.close()

    return {"status": "success", "data": genres}


Genre_List_all = []   # เก็บรายชื่อ genre ทั้งหมดในตาราง Genre (ไม่ซ้ำ) ไว้ในตัวแปรนี้ โหลดครั้งเดียวตอนเปิด server


def load_genre_list_all():
    """ดึง genre_name ทั้งหมดจากตาราง Genre แบบไม่ซ้ำ (DISTINCT) เก็บไว้ในตัวแปร Genre_List_all
    ให้ endpoint ด้านล่างเอาไปตอบ frontend ได้ โดยไม่ต้อง query ฐานข้อมูลใหม่ทุกครั้งที่มีคนเรียก"""
    global Genre_List_all   # บอกว่าจะแก้ตัวแปร Genre_List_all ที่อยู่ระดับไฟล์ ไม่ใช่สร้างตัวแปรใหม่ในฟังก์ชันนี้
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT DISTINCT genre_name FROM "Genre" ORDER BY genre_name')
        Genre_List_all = [row[0] for row in cursor.fetchall()]
        conn.close()
        print(f"โหลด Genre_List_all สำเร็จ: {len(Genre_List_all)} genre")
    except Exception as e:
        print(f"[!] โหลด Genre_List_all ไม่ได้: {e}")


load_genre_list_all()   # เรียกทันทีตอนไฟล์นี้ถูก import (คือตอนสั่ง uvicorn main:app) ให้มีข้อมูลพร้อมอยู่ในตัวแปรก่อนมีใครเรียก endpoint ด้านล่าง


# ---------- อ่านรายชื่อ genre ทั้งหมดแบบไม่ซ้ำ (ให้ frontend ดึงไปใช้ได้) ----------
# ต้องประกาศ route คงที่นี้ไว้ "ก่อน" /Genre/{genre_id} ด้านล่าง ไม่งั้น FastAPI จะจับคู่คำว่า
# "unique" เข้ากับ {genre_id} (ที่ต้องเป็นเลขจำนวนเต็ม) ก่อน แล้วตอบ error 422 กลับไปทันที
# (เป็นบั๊กแบบเดียวกับที่ Document.md เคยพบใน endpoint "/…/all" ด้านล่างไฟล์นี้)
@app.get("/Genre/unique")
def read_unique_genre_names():
    """ส่งค่าจากตัวแปร Genre_List_all ที่โหลดไว้แล้วตอนเปิด server กลับไปให้ frontend
    ไม่ต้อง query ฐานข้อมูลใหม่ทุกครั้งที่มีคนเรียก endpoint นี้"""
    return {"status": "success", "data": Genre_List_all}


# ---------- อ่านข้อมูลอันเดียว ตาราง Genre ----------
@app.get("/Genre/{genre_id}")
def read_Genre_by_id(genre_id: int):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'SELECT genre_id, genre_name FROM "Genre" WHERE genre_id = %s',
        (genre_id,),
    )
    genre = cursor.fetchone()
    conn.close()

    return {"status": "success", "data": genre}


# ---------- แก้ไขข้อมูล ตาราง Genre ----------
@app.put("/Genre/{genre_id}")
def update_Genre(genre_id: int, data: UpdateGenreData):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'UPDATE "Genre" SET genre_name = %s WHERE genre_id = %s',
        (data.genre_name, genre_id),
    )
    conn.commit()
    conn.close()

    return {"status": "success"}


# ---------- ลบข้อมูล ตาราง Genre ----------
@app.delete("/Genre/{genre_id}")
def delete_Genre(genre_id: int):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('DELETE FROM "Genre" WHERE genre_id = %s', (genre_id,))
    conn.commit()
    conn.close()

    return {"status": "success"}


# ---------- เพิ่มข้อมูล ตาราง Genre_Song ----------
@app.post("/Genre_Song")
def create_Genre_Song(data: Genre_SongData):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'INSERT INTO "Genre_Song" (song_id, genre_id) VALUES (%s, %s) RETURNING category_id',
        (data.song_id, data.genre_id),
    )
    new_id = cursor.fetchone()["category_id"]
    conn.commit()
    conn.close()

    return {"status": "success", "category_id": new_id}


# ---------- อ่านข้อมูลทั้งหมด ตาราง Genre_Song ----------
@app.get("/Genre_Song")
def read_Genre_Song():
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('SELECT category_id, song_id, genre_id FROM "Genre_Song" ORDER BY category_id')
    genre_songs = cursor.fetchall()
    conn.close()

    return {"status": "success", "data": genre_songs}


# ---------- อ่านข้อมูลอันเดียว ตาราง Genre_Song ----------
@app.get("/Genre_Song/{category_id}")
def read_Genre_Song_by_id(category_id: int):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'SELECT category_id, song_id, genre_id FROM "Genre_Song" WHERE category_id = %s',
        (category_id,),
    )
    genre_song = cursor.fetchone()
    conn.close()

    return {"status": "success", "data": genre_song}


# ---------- แก้ไขข้อมูล ตาราง Genre_Song ----------
@app.put("/Genre_Song/{category_id}")
def update_Genre_Song(category_id: int, data: UpdateGenre_SongData):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'UPDATE "Genre_Song" SET song_id = %s, genre_id = %s WHERE category_id = %s',
        (data.song_id, data.genre_id, category_id),
    )
    conn.commit()
    conn.close()

    return {"status": "success"}


# ---------- ลบข้อมูล ตาราง Genre_Song ----------
@app.delete("/Genre_Song/{category_id}")
def delete_Genre_Song(category_id: int):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('DELETE FROM "Genre_Song" WHERE category_id = %s', (category_id,))
    conn.commit()
    conn.close()

    return {"status": "success"}


# ---------- เพิ่มข้อมูล ตาราง Mood ----------
@app.post("/Mood")
def create_Mood(data: MoodData):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'INSERT INTO "Mood" (mood_name) VALUES (%s) RETURNING mood_id',
        (data.mood_name,),
    )
    new_id = cursor.fetchone()["mood_id"]
    conn.commit()
    conn.close()

    return {"status": "success", "mood_id": new_id}


# ---------- อ่านข้อมูลทั้งหมด ตาราง Mood ----------
@app.get("/Mood")
def read_Mood():
    """เรียงจาก mood ที่มีเพลงเยอะสุดไปน้อยสุด (หลักการเดียวกับ /Genre ด้านบน)"""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'SELECT m.mood_id, m.mood_name, COUNT(ms.song_id) AS song_count '
        'FROM "Mood" m LEFT JOIN "Mood_Song" ms ON ms.mood_id = m.mood_id '
        'GROUP BY m.mood_id, m.mood_name '
        'ORDER BY song_count DESC, m.mood_name'
    )
    moods = cursor.fetchall()
    conn.close()

    return {"status": "success", "data": moods}


# ---------- อ่านข้อมูลอันเดียว ตาราง Mood ----------
@app.get("/Mood/{mood_id}")
def read_Mood_by_id(mood_id: int):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'SELECT mood_id, mood_name FROM "Mood" WHERE mood_id = %s',
        (mood_id,),
    )
    mood = cursor.fetchone()
    conn.close()

    return {"status": "success", "data": mood}


# ---------- แก้ไขข้อมูล ตาราง Mood ----------
@app.put("/Mood/{mood_id}")
def update_Mood(mood_id: int, data: UpdateMoodData):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'UPDATE "Mood" SET mood_name = %s WHERE mood_id = %s',
        (data.mood_name, mood_id),
    )
    conn.commit()
    conn.close()

    return {"status": "success"}


# ---------- ลบข้อมูล ตาราง Mood ----------
@app.delete("/Mood/{mood_id}")
def delete_Mood(mood_id: int):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('DELETE FROM "Mood" WHERE mood_id = %s', (mood_id,))
    conn.commit()
    conn.close()

    return {"status": "success"}


# ---------- เพิ่มข้อมูล ตาราง Mood_Song ----------
@app.post("/Mood_Song")
def create_Mood_Song(data: Mood_SongData):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'INSERT INTO "Mood_Song" (song_id, mood_id) VALUES (%s, %s) RETURNING mood_song_id',
        (data.song_id, data.mood_id),
    )
    new_id = cursor.fetchone()["mood_song_id"]
    conn.commit()
    conn.close()

    return {"status": "success", "mood_song_id": new_id}


# ---------- อ่านข้อมูลทั้งหมด ตาราง Mood_Song ----------
@app.get("/Mood_Song")
def read_Mood_Song():
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('SELECT mood_song_id, song_id, mood_id FROM "Mood_Song" ORDER BY mood_song_id')
    mood_songs = cursor.fetchall()
    conn.close()

    return {"status": "success", "data": mood_songs}


# ---------- อ่านข้อมูลอันเดียว ตาราง Mood_Song ----------
@app.get("/Mood_Song/{mood_song_id}")
def read_Mood_Song_by_id(mood_song_id: int):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'SELECT mood_song_id, song_id, mood_id FROM "Mood_Song" WHERE mood_song_id = %s',
        (mood_song_id,),
    )
    mood_song = cursor.fetchone()
    conn.close()

    return {"status": "success", "data": mood_song}


# ---------- แก้ไขข้อมูล ตาราง Mood_Song ----------
@app.put("/Mood_Song/{mood_song_id}")
def update_Mood_Song(mood_song_id: int, data: UpdateMood_SongData):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'UPDATE "Mood_Song" SET song_id = %s, mood_id = %s WHERE mood_song_id = %s',
        (data.song_id, data.mood_id, mood_song_id),
    )
    conn.commit()
    conn.close()

    return {"status": "success"}


# ---------- ลบข้อมูล ตาราง Mood_Song ----------
@app.delete("/Mood_Song/{mood_song_id}")
def delete_Mood_Song(mood_song_id: int):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('DELETE FROM "Mood_Song" WHERE mood_song_id = %s', (mood_song_id,))
    conn.commit()
    conn.close()

    return {"status": "success"}


# ---------- เพิ่มข้อมูล ตาราง Admins ----------
@app.post("/Admins")
def create_Admin(data: AdminData):
    hashed_password = pwd_context.hash(data.admin_password)

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'INSERT INTO "Admins" (admin_email, admin_password) VALUES (%s, %s) RETURNING admin_id',
        (data.admin_email, hashed_password),
    )
    new_id = cursor.fetchone()["admin_id"]
    conn.commit()
    conn.close()

    return {"status": "success", "admin_id": new_id}


# ---------- อ่านข้อมูลทั้งหมด ตาราง Admins ----------
@app.get("/Admins")
def read_Admins():
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('SELECT admin_id, admin_email FROM "Admins" ORDER BY admin_id')
    admins = cursor.fetchall()
    conn.close()

    return {"status": "success", "data": admins}


# ---------- อ่านข้อมูลอันเดียว ตาราง Admins ----------
@app.get("/Admins/{admin_id}")
def read_Admin_by_id(admin_id: int):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'SELECT admin_id, admin_email FROM "Admins" WHERE admin_id = %s',
        (admin_id,),
    )
    admin = cursor.fetchone()
    conn.close()

    return {"status": "success", "data": admin}


# ---------- แก้ไขข้อมูล ตาราง Admins ----------
@app.put("/Admins/{admin_id}")
def update_Admin(admin_id: int, data: UpdateAdminData):
    hashed_password = pwd_context.hash(data.admin_password)

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'UPDATE "Admins" SET admin_email = %s, admin_password = %s WHERE admin_id = %s',
        (data.admin_email, hashed_password, admin_id),
    )
    conn.commit()
    conn.close()

    return {"status": "success"}


# ---------- ลบข้อมูล ตาราง Admins ----------
@app.delete("/Admins/{admin_id}")
def delete_Admin(admin_id: int):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('DELETE FROM "Admins" WHERE admin_id = %s', (admin_id,))
    conn.commit()
    conn.close()

    return {"status": "success"}


# ---------- เพิ่มข้อมูล ตาราง Verified_Users ----------
# หมายเหตุ: verified_user_id เป็น uuid ไม่มี SERIAL ให้ฐานข้อมูล generate เอง (ไม่เหมือน
# ตารางอื่นที่ใช้ RETURNING id) จึงสร้าง UUID ฝั่ง Python ด้วย uuid.uuid4() แล้วส่งเข้าไปเอง
@app.post("/Verified_Users")
def create_Verified_User(data: VerifiedUserData):
    hashed_password = pwd_context.hash(data.verified_password)
    new_id = uuid.uuid4()

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'INSERT INTO "Verified_Users" (verified_user_id, verified_username, verified_email, verified_password) '
        'VALUES (%s, %s, %s, %s)',
        (str(new_id), data.verified_username, data.verified_email, hashed_password),
    )
    conn.commit()
    conn.close()

    return {"status": "success", "verified_user_id": str(new_id)}


# ---------- อ่านข้อมูลทั้งหมด ตาราง Verified_Users ----------
@app.get("/Verified_Users")
def read_Verified_Users():
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'SELECT verified_user_id, verified_username, verified_email FROM "Verified_Users" ORDER BY verified_username'
    )
    verified_users = cursor.fetchall()
    conn.close()

    return {"status": "success", "data": verified_users}


# ---------- อ่านข้อมูลอันเดียว ตาราง Verified_Users ----------
@app.get("/Verified_Users/{verified_user_id}")
def read_Verified_User_by_id(verified_user_id: str):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'SELECT verified_user_id, verified_username, verified_email FROM "Verified_Users" WHERE verified_user_id = %s',
        (verified_user_id,),
    )
    verified_user = cursor.fetchone()
    conn.close()

    return {"status": "success", "data": verified_user}


# ---------- แก้ไขข้อมูล ตาราง Verified_Users ----------
@app.put("/Verified_Users/{verified_user_id}")
def update_Verified_User(verified_user_id: str, data: UpdateVerifiedUserData):
    hashed_password = pwd_context.hash(data.verified_password)

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'UPDATE "Verified_Users" SET verified_username = %s, verified_email = %s, verified_password = %s '
        'WHERE verified_user_id = %s',
        (data.verified_username, data.verified_email, hashed_password, verified_user_id),
    )
    conn.commit()
    conn.close()

    return {"status": "success"}


# ---------- ลบข้อมูล ตาราง Verified_Users ----------
@app.delete("/Verified_Users/{verified_user_id}")
def delete_Verified_User(verified_user_id: str):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('DELETE FROM "Verified_Users" WHERE verified_user_id = %s', (verified_user_id,))
    conn.commit()
    conn.close()

    return {"status": "success"}


# ---------- เพิ่มข้อมูล ตาราง trending_song ----------
@app.post("/trending_song")
def create_trending_song(data: TrendingSongData):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'INSERT INTO "trending_song" '
        '(song_id, trend_song_name, trend_alltime, trend_one_week, trend_one_month, trend_one_year) '
        'VALUES (%s, %s, %s, %s, %s, %s) RETURNING trend_song_id',
        (data.song_id, data.trend_song_name, data.trend_alltime,
         data.trend_one_week, data.trend_one_month, data.trend_one_year),
    )
    new_id = cursor.fetchone()["trend_song_id"]
    conn.commit()
    conn.close()

    return {"status": "success", "trend_song_id": new_id}


# ---------- อ่านข้อมูลทั้งหมด ตาราง trending_song ----------
@app.get("/trending_song")
def read_trending_songs():
    """JOIN กับตาราง Song เพิ่ม เพื่อเอา Image_Link มาโชว์รูปเพลงในหน้า MostSearch.js ของแอดมิน
    (แทนกล่องสี่เหลี่ยมเทาๆ placeholder เดิม)
    เรียงลำดับ: เพลงที่ trend_add = true (ติ๊กเป็นเพลงแนะนำไว้แล้ว) ขึ้นก่อนเสมอ (อันดับ 1-2)
    ที่เหลือเรียงตาม trend_alltime มากไปน้อย (อันดับ 3 เป็นต้นไป)"""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'SELECT t.trend_song_id, t.song_id, t.trend_song_name, t.trend_alltime, t.trend_one_week, '
        't.trend_one_month, t.trend_one_year, t.trend_add, s."Image_Link" '
        'FROM "trending_song" t LEFT JOIN "Song" s ON s.song_id = t.song_id '
        'ORDER BY t.trend_add DESC, t.trend_alltime DESC'
    )
    trending_songs = cursor.fetchall()
    conn.close()

    return {"status": "success", "data": trending_songs}


# ---------- หน้า Result.js เรียก endpoint นี้ตอน user กดไอคอน YouTube: นับเพลงนี้เข้า trending ----------
# ต้องประกาศ route คงที่นี้ไว้ "ก่อน" /trending_song/{trend_song_id} ด้านล่าง ไม่งั้น FastAPI จะจับคู่
# คำว่า "increment" เข้ากับ trend_song_id (ซึ่งเป็น int) แล้ว error ไปก่อนถึง route นี้ (เหมือน /Genre/unique)
@app.post("/trending_song/increment")
def increment_trending_song(song_id: int):
    """ถ้าเพลงนี้ (song_id) ยังไม่เคยอยู่ใน trending_song ให้สร้างแถวใหม่ (ทุกค่าเริ่มที่ 1)
    ถ้ามีอยู่แล้วให้ +1 ทั้ง trend_alltime, trend_one_week, trend_one_month, trend_one_year
    (trend_alltime ไม่มีการรีเซ็ต ส่วน week/month/year จะถูกรีเซ็ตเป็น 0 เองตามรอบโดย scheduled job
    ด้านล่างของไฟล์นี้ — ดู reset_weekly_trend/reset_monthly_trend/reset_yearly_trend)"""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cursor.execute('SELECT trend_song_id FROM "trending_song" WHERE song_id = %s', (song_id,))
    existing = cursor.fetchone()

    if existing:
        cursor.execute(
            'UPDATE "trending_song" SET trend_alltime = trend_alltime + 1, '
            'trend_one_week = trend_one_week + 1, trend_one_month = trend_one_month + 1, '
            'trend_one_year = trend_one_year + 1 WHERE trend_song_id = %s',
            (existing["trend_song_id"],),
        )
        conn.commit()
        conn.close()
        return {"status": "success", "trend_song_id": existing["trend_song_id"]}

    # เพลงนี้ยังไม่เคยถูกนับเลย ต้องไปหาชื่อเพลงจากตาราง Song มาเก็บไว้ใน trend_song_name ด้วย
    cursor.execute('SELECT song_name FROM "Song" WHERE song_id = %s', (song_id,))
    song = cursor.fetchone()
    if not song:
        conn.close()
        return {"status": "error", "error": f"ไม่พบเพลง song_id={song_id} ในตาราง Song"}

    cursor.execute(
        'INSERT INTO "trending_song" '
        '(song_id, trend_song_name, trend_alltime, trend_one_week, trend_one_month, trend_one_year) '
        'VALUES (%s, %s, 1, 1, 1, 1) RETURNING trend_song_id',
        (song_id, song["song_name"]),
    )
    new_id = cursor.fetchone()["trend_song_id"]
    conn.commit()
    conn.close()

    return {"status": "success", "trend_song_id": new_id}


# ---------- หน้า MostSearch.js กด Add แล้วเรียก endpoint นี้: ตั้งเพลงที่ติ๊กไว้เป็นเพลงแนะนำ ----------
@app.post("/trending_song/add_recommend")
def add_recommend(data: AddRecommendData):
    """เพลงที่ติ๊กไว้รอบนี้ "แทนที่" ชุดเพลงแนะนำเดิมทั้งหมด ไม่ใช่เพิ่มสะสมไปเรื่อยๆ:
    ขั้นที่ 1 เคลียร์ trend_add = false ให้ทุกแถวก่อน ขั้นที่ 2 ค่อยตั้ง true ให้เฉพาะแถวที่ติ๊กไว้รอบนี้"""
    if not data.trend_song_ids:
        return {"status": "error", "error": "ไม่ได้เลือกเพลงเลย"}

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE "trending_song" SET trend_add = FALSE')
    cursor.execute(
        'UPDATE "trending_song" SET trend_add = TRUE WHERE trend_song_id = ANY(%s)',
        (data.trend_song_ids,),
    )
    conn.commit()
    conn.close()

    return {"status": "success", "trend_song_ids": data.trend_song_ids}


# ---------- หน้า Homeuser.js เรียก endpoint นี้โชว์ใน "For You": เอาเพลงที่ trend_add = true ----------
@app.get("/trending_song/recommended")
def read_recommended_trending_songs():
    """JOIN กับ Song เอาชื่อเพลง/ศิลปิน/รูปมาด้วย เฉพาะแถวที่แอดมินกด Add ไว้ (trend_add = true)"""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'SELECT t.trend_song_id, t.song_id, s.song_name, s."Artist", s."Image_Link", s.youtube_link '
        'FROM "trending_song" t JOIN "Song" s ON s.song_id = t.song_id '
        'WHERE t.trend_add = TRUE ORDER BY t.trend_song_id'
    )
    songs = cursor.fetchall()
    conn.close()

    return {"status": "success", "data": songs}


# ---------- อ่านข้อมูลอันเดียว ตาราง trending_song ----------
@app.get("/trending_song/{trend_song_id}")
def read_trending_song_by_id(trend_song_id: int):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'SELECT trend_song_id, song_id, trend_song_name, trend_alltime, trend_one_week, trend_one_month, trend_one_year '
        'FROM "trending_song" WHERE trend_song_id = %s',
        (trend_song_id,),
    )
    trending_song = cursor.fetchone()
    conn.close()

    return {"status": "success", "data": trending_song}


# ---------- แก้ไขข้อมูล ตาราง trending_song ----------
@app.put("/trending_song/{trend_song_id}")
def update_trending_song(trend_song_id: int, data: UpdateTrendingSongData):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'UPDATE "trending_song" SET song_id = %s, trend_song_name = %s, trend_alltime = %s, '
        'trend_one_week = %s, trend_one_month = %s, trend_one_year = %s WHERE trend_song_id = %s',
        (data.song_id, data.trend_song_name, data.trend_alltime,
         data.trend_one_week, data.trend_one_month, data.trend_one_year, trend_song_id),
    )
    conn.commit()
    conn.close()

    return {"status": "success"}


# ---------- ลบข้อมูล ตาราง trending_song ----------
@app.delete("/trending_song/{trend_song_id}")
def delete_trending_song(trend_song_id: int):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('DELETE FROM "trending_song" WHERE trend_song_id = %s', (trend_song_id,))
    conn.commit()
    conn.close()

    return {"status": "success"}


# ---------- บันทึกประวัติการฟังเพลง ตาราง history ----------
# เก็บทุกครั้งที่กดฟัง (ฟังซ้ำก็เพิ่มแถวใหม่) และคัดลอกชื่อเพลง/ศิลปิน/ลิงก์/รูปจาก Song มาเก็บไว้ด้วยตามสเปก
@app.post("/history")
def add_history(data: HistoryData):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'INSERT INTO "history" (user_id, song_id, song_name, "Artist", youtube_link, "Image_Link") '
        'SELECT %s, song_id, song_name, "Artist", youtube_link, "Image_Link" FROM "Song" WHERE song_id = %s '
        'RETURNING history_id',
        (str(data.user_id), data.song_id),
    )
    row = cursor.fetchone()
    if not row:
        conn.close()
        return {"status": "error", "error": f"ไม่พบเพลง song_id={data.song_id} ในตาราง Song"}
    conn.commit()
    conn.close()

    return {"status": "success", "history_id": row["history_id"]}


# ---------- หน้า History.js: ประวัติการฟังของผู้ใช้ 1 คน ----------
# ในตารางมีหลายแถวต่อเพลงถ้าฟังซ้ำ แต่หน้า History โชว์เพลงละ 1 รายการ เรียงตามครั้งล่าสุดที่ฟัง:
# DISTINCT ON (song_id) + ORDER BY song_id, listened_at DESC เก็บไว้แค่แถวล่าสุดของแต่ละเพลง
# แล้ว query ชั้นนอกค่อยเรียงใหม่ตามเวลา (ฟังล่าสุดขึ้นก่อน)
@app.get("/history")
def read_history(user_id: uuid.UUID):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'SELECT * FROM ('
        '  SELECT DISTINCT ON (song_id) history_id, song_id, song_name, "Artist", youtube_link, "Image_Link", listened_at'
        '  FROM "history" WHERE user_id = %s ORDER BY song_id, listened_at DESC'
        ') latest ORDER BY listened_at DESC',
        (str(user_id),),
    )
    history = cursor.fetchall()
    conn.close()

    return {"status": "success", "data": history}


# ---------- ลบข้อมูลทั้งหมด ตาราง User ----------
# ⚠ บั๊กที่รู้อยู่แล้ว (ดู Document.md ส่วนที่ 3 ข้อ 6): endpoint "/…/all" ทั้งหมดในส่วนนี้ประกาศอยู่
# "หลัง" @app.delete("/users/{user_id}") ที่รับเลขจำนวนเต็ม — FastAPI จับคู่ URL ตามลำดับที่ประกาศ
# ก่อน-หลัง คำว่า "all" จึงน่าจะถูกจับคู่กับ {user_id} (ซึ่งคาดหวังเป็นเลข) ก่อน แล้วขึ้น error 422
# เพราะ "all" ไม่ใช่เลข ถ้าจะแก้ให้ย้ายกลุ่ม "/all" ทั้งหมดไปประกาศก่อนกลุ่ม "/{id}" แต่ไม่แก้ตอนนี้
@app.delete("/users/all")
def delete_all_users():
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('DELETE FROM "User"')
    conn.commit()
    conn.close()

    return {"status": "success"}


# ---------- ลบข้อมูลทั้งหมด ตาราง Train_Song ----------
@app.delete("/Train_Song/all")
def delete_all_Train_Song():
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('DELETE FROM "Train_Song"')
    conn.commit()
    conn.close()

    return {"status": "success"}


# ---------- ลบข้อมูลทั้งหมด ตาราง Song ----------
@app.delete("/Song/all")
def delete_all_Song():
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('DELETE FROM "Song"')
    conn.commit()
    conn.close()

    return {"status": "success"}


# ---------- ลบข้อมูลทั้งหมด ตาราง Genre ----------
@app.delete("/Genre/all")
def delete_all_Genre():
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('DELETE FROM "Genre"')
    conn.commit()
    conn.close()

    return {"status": "success"}


# ---------- ลบข้อมูลทั้งหมด ตาราง Genre_Song ----------
@app.delete("/Genre_Song/all")
def delete_all_Genre_Song():
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('DELETE FROM "Genre_Song"')
    conn.commit()
    conn.close()

    return {"status": "success"}


# ---------- ลบข้อมูลทั้งหมด ตาราง Mood ----------
@app.delete("/Mood/all")
def delete_all_Mood():
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('DELETE FROM "Mood"')
    conn.commit()
    conn.close()

    return {"status": "success"}


# ---------- ลบข้อมูลทั้งหมด ตาราง Mood_Song ----------
@app.delete("/Mood_Song/all")
def delete_all_Mood_Song():
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('DELETE FROM "Mood_Song"')
    conn.commit()
    conn.close()

    return {"status": "success"}


# ---------- ลบข้อมูลทั้งหมด ตาราง Admins ----------
@app.delete("/Admins/all")
def delete_all_Admins():
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('DELETE FROM "Admins"')
    conn.commit()
    conn.close()

    return {"status": "success"}


# ---------- ลบข้อมูลทั้งหมด ตาราง Verified_Users ----------
@app.delete("/Verified_Users/all")
def delete_all_Verified_Users():
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('DELETE FROM "Verified_Users"')
    conn.commit()
    conn.close()

    return {"status": "success"}


# ---------- ลบข้อมูลทั้งหมด ตาราง trending_song ----------
@app.delete("/trending_song/all")
def delete_all_trending_song():
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('DELETE FROM "trending_song"')
    conn.commit()
    conn.close()

    return {"status": "success"}


# รันด้วยคำสั่ง: python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
# ทดสอบทุก URL ได้ที่: http://localhost:8000/docs