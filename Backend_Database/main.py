
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
    """อ่านค่าจากไฟล์ .env ข้างๆ ไฟล์นี้ (ถ้ามี) เช่น DB_PASSWORD=xxxx"""
    env_file = Path(__file__).parent / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


_load_env()

app = FastAPI()

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


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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

class SongData(BaseModel):
    song_name: str
    spotify_Link:str
    youtube_link:str

class Update_SongData(BaseModel):
    song_name: str
    spotify_Link:str
    youtube_link:str

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


# ---------- เพิ่มข้อมูล ตาราง users ----------
@app.post("/users")
def create_user(data: UserData):
    hashed_password = pwd_context.hash(data.password)

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'INSERT INTO "User" (username, email, password) VALUES (%s, %s, %s) RETURNING user_id',
        (data.username, data.email, hashed_password),
    )
    new_id = cursor.fetchone()["user_id"]
    conn.commit()
    conn.close()

    return {"status": "success", "users_id": new_id}


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


# ---------- อ่านข้อมูลคนเดียว ตาราง users ----------
@app.get("/Train_Song/{newsong_id}")
def read_Train_Song(newsong_id: int):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
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
    cursor.execute(
        'UPDATE "Train_Song" SET username = %s, email = %s WHERE user_id = %s',
        (data.newsong_name, data.newsong_artist, newsong_id),
    )
    conn.commit()
    conn.close()

    return {"status": "success"}


# ---------- ลบข้อมูล ตาราง users ----------
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


# ---------- /register คือ URL ชื่อเดิมที่ Register.jsx เรียกอยู่ ----------
# ให้ทำงานเหมือนกับ /users เป๊ะๆ แค่คนละชื่อ URL ตาราง users
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


# ---------- อ่านข้อมูลคนเดียว ตาราง Song ----------
@app.get("/Song/{song_id}")
def read_Song(song_id: int):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'SELECT song_id, song_name, spotify_Link, youtube_link FROM "User" WHERE song_id = %s',
        (song_id,),
    )
    Song = cursor.fetchone()
    conn.close()

    return {"status": "success", "data": Song}


# ---------- แก้ไขข้อมูล ตาราง users ----------
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
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('SELECT genre_id, genre_name FROM "Genre" ORDER BY genre_id')
    genres = cursor.fetchall()
    conn.close()

    return {"status": "success", "data": genres}


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
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('SELECT mood_id, mood_name FROM "Mood" ORDER BY mood_id')
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
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'SELECT trend_song_id, song_id, trend_song_name, trend_alltime, trend_one_week, trend_one_month, trend_one_year '
        'FROM "trending_song" ORDER BY trend_song_id'
    )
    trending_songs = cursor.fetchall()
    conn.close()

    return {"status": "success", "data": trending_songs}


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


# ---------- ลบข้อมูลทั้งหมด ตาราง User ----------
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