"""
AddSong.py
เพิ่มเพลง 1 เพลงเข้าฐานข้อมูลให้ครบทุกตารางที่เกี่ยวข้อง ผ่าน Add_song() ตัวเดียว

หมายเหตุสำคัญ — ส่วนที่ต่างจากที่ขอไว้ตอนแรก เพราะ schema จริงไม่รองรับ:
  - song_id เป็น integer (SERIAL) ของจริงในตาราง Song ไม่ใช่ uuid จึงให้ฐานข้อมูล
    generate เองตอน insert (RETURNING song_id) แล้วใช้ค่านั้นต่อในฟังก์ชันอื่น
  - Genre_Song ไม่มีคอลัมน์ song_name (มีแค่ song_id, genre_id) เลยไม่ได้เก็บ song_name ซ้ำ
  - Train_Song ไม่มีคอลัมน์ song_id เลย (มีแค่ newsong_id ของตัวเอง) รับ song_id เข้ามา
    เป็นพารามิเตอร์ตามที่ขอ แต่ไม่มีที่เก็บจริงในตารางนี้ จึงไม่ได้ insert ค่านี้ลงไป
  - song_mood ผูกกับตาราง Mood/Mood_Song แล้ว (หลักการเดียวกับ song_genre: admin เพิ่มเพลง
    ทีละเพลงแล้วพิมพ์ mood เองได้ ไม่ต้องมีระบบคำนวณ mood อัตโนมัติ)
  - เชื่อมฐานข้อมูลตรงๆ ด้วย psycopg2 แบบเดียวกับ main.py ไม่ได้ยิงผ่าน HTTP endpoint
    จึงไม่ต้องเปิดเซิร์ฟเวอร์ uvicorn ก่อนใช้งาน (Postgres เองรันเป็น service อยู่แล้ว)

ใช้ในโค้ด:
    from AddSong import Add_song
    Add_song(song_name, artist, song_genre, youtube_link, spotify_link, song_mood, lyric)
    # song_genre และ song_mood ใส่ได้ทั้งค่าเดียว หรือหลายค่าคั่นด้วย comma
    # เช่น song_genre="pop, rock", song_mood="เศร้า, อกหัก"
    # youtube_link/spotify_link ใส่ "" ได้ถ้ายังไม่มีลิงก์ (ไม่บังคับกรอก)
"""
import re
import sys
from pathlib import Path

import psycopg2.extras

# เติม folder ของไฟล์นี้เองเข้า sys.path (รายการที่ Python ใช้หาไฟล์ตอน import) กันเผื่อรันจากที่อื่น
# (ปกติไม่จำเป็นถ้ารันจากตำแหน่งเดียวกับไฟล์อยู่แล้ว แต่ใส่ไว้ให้ import main ได้แน่นอนไม่ว่าจะรันจากไหน)
sys.path.insert(0, str(Path(__file__).parent))
from main import get_connection  # noqa: E402  (ใช้ DB_CONFIG/.env เดียวกับ main.py)
# "noqa: E402" คือ comment บอก linter (ตัวเช็คสไตล์โค้ด) ว่า "รู้ว่า import นี้ไม่อยู่บนสุดของไฟล์ตามธรรมเนียม
# แต่ตั้งใจ ไม่ต้องเตือน" — เพราะ import นี้ต้องมาหลัง sys.path.insert ข้างบน ไม่งั้นจะหา main.py ไม่เจอ


def add_genre(cursor, genre_name):
    """เช็กว่า genre_name มีอยู่ในตาราง Genre แล้วหรือยัง (ไม่สนตัวพิมพ์เล็ก-ใหญ่)
    ถ้ายังไม่มี สร้างแถวใหม่ ถ้ามีแล้วไม่ต้องทำอะไร — คืน genre_id เสมอ"""
    # LOWER(...) = LOWER(%s) แปลงทั้งสองฝั่งเป็นตัวพิมพ์เล็กก่อนเทียบ ทำให้ "Pop" กับ "pop" ถือว่าเป็น genre เดียวกัน
    cursor.execute('SELECT genre_id FROM "Genre" WHERE LOWER(genre_name) = LOWER(%s)', (genre_name,))
    row = cursor.fetchone()
    if row:
        print(f"  [ตาราง Genre] '{genre_name}' มีอยู่แล้ว -> genre_id={row['genre_id']}")
        return row["genre_id"]
    # RETURNING genre_id: ให้ Postgres ส่ง id ที่มันสร้างให้อัตโนมัติ (SERIAL) กลับมาด้วยในคำสั่ง INSERT เดียวกัน
    # ไม่ต้องสั่ง SELECT แยกอีกรอบเพื่อไปหาว่า id ที่เพิ่ง insert ไปคือเลขอะไร
    cursor.execute('INSERT INTO "Genre" (genre_name) VALUES (%s) RETURNING genre_id', (genre_name,))
    genre_id = cursor.fetchone()["genre_id"]
    print(f"  [ตาราง Genre] เพิ่มใหม่ '{genre_name}' -> genre_id={genre_id}")
    return genre_id


def add_genre_song(cursor, song_id, genre_id):
    """เชื่อมเพลงกับ genre ในตาราง Genre_Song เช็กก่อนว่าคู่นี้มีอยู่แล้วหรือยัง กันแถวซ้ำ
    ตอนรันซ้ำ (Genre_Song มีแค่ song_id, genre_id ไม่มี song_name ให้เก็บ)"""
    cursor.execute('SELECT category_id FROM "Genre_Song" WHERE song_id = %s AND genre_id = %s', (song_id, genre_id))
    if cursor.fetchone():
        print(f"  [ตาราง Genre_Song] song_id={song_id} + genre_id={genre_id} มีอยู่แล้ว ข้าม")
        return
    cursor.execute('INSERT INTO "Genre_Song" (song_id, genre_id) VALUES (%s, %s)', (song_id, genre_id))
    print(f"  [ตาราง Genre_Song] เชื่อม song_id={song_id} กับ genre_id={genre_id}")


def add_mood(cursor, mood_name):
    """เช็กว่า mood_name มีอยู่ในตาราง Mood แล้วหรือยัง (ไม่สนตัวพิมพ์เล็ก-ใหญ่)
    ถ้ายังไม่มี สร้างแถวใหม่ ถ้ามีแล้วไม่ต้องทำอะไร — คืน mood_id เสมอ (หลักการเดียวกับ add_genre)"""
    cursor.execute('SELECT mood_id FROM "Mood" WHERE LOWER(mood_name) = LOWER(%s)', (mood_name,))
    row = cursor.fetchone()
    if row:
        print(f"  [ตาราง Mood] '{mood_name}' มีอยู่แล้ว -> mood_id={row['mood_id']}")
        return row["mood_id"]
    cursor.execute('INSERT INTO "Mood" (mood_name) VALUES (%s) RETURNING mood_id', (mood_name,))
    mood_id = cursor.fetchone()["mood_id"]
    print(f"  [ตาราง Mood] เพิ่มใหม่ '{mood_name}' -> mood_id={mood_id}")
    return mood_id


def add_mood_song(cursor, song_id, mood_id):
    """เชื่อมเพลงกับ mood ในตาราง Mood_Song เช็กก่อนว่าคู่นี้มีอยู่แล้วหรือยัง กันแถวซ้ำตอนรันซ้ำ
    (หลักการเดียวกับ add_genre_song)"""
    cursor.execute('SELECT mood_song_id FROM "Mood_Song" WHERE song_id = %s AND mood_id = %s', (song_id, mood_id))
    if cursor.fetchone():
        print(f"  [ตาราง Mood_Song] song_id={song_id} + mood_id={mood_id} มีอยู่แล้ว ข้าม")
        return
    cursor.execute('INSERT INTO "Mood_Song" (song_id, mood_id) VALUES (%s, %s)', (song_id, mood_id))
    print(f"  [ตาราง Mood_Song] เชื่อม song_id={song_id} กับ mood_id={mood_id}")


def add_train_song(cursor, song_id, song_name, artist, lyric):
    """เก็บเนื้อเพลงลงตาราง Train_Song เฉยๆ — song_id รับเข้ามาตามสเปก แต่ตารางนี้ไม่มี
    คอลัมน์ song_id จึงไม่ได้ insert ค่านี้ (เก็บแค่ newsong_name, newsong_artist, newsong_lyrics)"""
    cursor.execute(
        'INSERT INTO "Train_Song" (newsong_name, newsong_artist, newsong_lyrics) VALUES (%s, %s, %s)',
        (song_name, artist, lyric),
    )
    print(f"  [ตาราง Train_Song] เก็บเนื้อเพลง '{song_name}' (artist={artist})")


YOUTUBE_LINK_RE = re.compile(
    r"^https?://(?:[a-z0-9-]+\.)*(?:youtube\.com/\S*[?&]v=|youtu\.be/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])",
    re.IGNORECASE,
)


def get_thumbnail_link(youtube_link):
    """input: ลิงก์ YouTube 1 ลิงก์ -> output: ลิงก์รูป thumbnail (หรือ "" ถ้าหา video id ไม่เจอ)
    หลักการเดียวกับ imageFetching/FetchThumbnails.py — คัดลอกมาเฉพาะฟังก์ชันนี้ (ไม่ import ข้ามไฟล์
    เพราะ FetchThumbnails.py เอง import get_connection จาก main.py กลับมา จะเกิด circular import ซ้อนกันอีกที)"""
    video_id = get_video_id(youtube_link)
    if not video_id:
        return ""
    return f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"


def get_video_id(youtube_link):
    """ตัดรหัสวิดีโอ 11 ตัวจากลิงก์ YouTube/YouTube Music (รองรับทั้ง ?v= และ youtu.be/) หาไม่เจอคืน ""
    ตรรกะเดียวกับ getVideoId ใน Frontend_Ver_2/frontend_Ver2/src/EditAdmin.js ถ้าแก้ต้องแก้ทั้งคู่"""
    match = YOUTUBE_LINK_RE.match((youtube_link or "").strip())
    return match.group(1) if match else ""


def add_to_song_table(cursor, song_name, artist, youtube_link, spotify_link):
    """เพิ่มเพลงลงตาราง Song คืน (song_id, image_link) — song_id ฐานข้อมูล generate ให้ (SERIAL)
    spotify_link เป็น NOT NULL ในตารางจริง ถ้า admin ไม่กรอกจะได้ค่า "" มาจากฟอร์ม ไม่ใช่ NULL อยู่แล้ว
    image_link ดึงจาก youtube_link อัตโนมัติ (ตัด video id มาประกอบ URL รูป) ถ้าหาไม่เจอจะได้ "" กลับมา
    (เช่น youtube_link เป็นลิงก์เพลย์ลิสต์ ไม่ใช่ลิงก์เพลงเดี่ยว) ให้ Add_song() เป็นคนแจ้งเตือนต่อ"""
    image_link = get_thumbnail_link(youtube_link)
    cursor.execute(
        'INSERT INTO "Song" (song_name, "Artist", spotify_link, youtube_link, "Image_Link") '
        'VALUES (%s, %s, %s, %s, %s) RETURNING song_id',
        (song_name, artist, spotify_link, youtube_link, image_link),
    )
    song_id = cursor.fetchone()["song_id"]
    print(f"  [ตาราง Song] เพิ่ม '{song_name}' -> song_id={song_id} "
          f"(youtube_link={youtube_link!r}, spotify_link={spotify_link!r}, image_link={image_link!r})")
    return song_id, image_link


def Add_song(song_name, artist, song_genre, youtube_link, spotify_link, song_mood, lyric):
    """เพิ่มเพลง 1 เพลงเข้าฐานข้อมูลให้ครบ: Song -> Genre (+Genre_Song) -> Mood (+Mood_Song) -> Train_Song
    song_genre และ song_mood ใส่ได้หลายค่า คั่นด้วย comma (หลักการเดียวกันทั้งคู่ — admin เพิ่มเพลงทีละเพลง
    แล้วเลือก mood เองได้ตอนนี้ เหมือนที่เลือก genre ได้)"""
    print("\n===== Add_song: ข้อมูลที่ได้รับมา =====")
    print(f"song_name     : {song_name}")
    print(f"artist        : {artist}")
    print(f"youtube_link  : {youtube_link}")
    print(f"spotify_link  : {spotify_link}")
    print(f"song_genre    : {song_genre}")
    print(f"song_mood     : {song_mood}")
    print(f"lyric         : {lyric}")
    print("----- กำลังบันทึกลงตารางต่างๆ -----")

    conn = get_connection()
    # cursor_factory=RealDictCursor: ให้แต่ละแถวที่ query ได้มาเป็น dict (เช่น row["song_id"])
    # แทนที่จะเป็น tuple ธรรมดา (row[0]) อ่านแล้วรู้เลยว่าคอลัมน์ไหนคือค่าไหน ไม่ต้องจำลำดับ
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        song_id, image_link = add_to_song_table(cursor, song_name, artist, youtube_link, spotify_link)

        # list comprehension พร้อมเงื่อนไข if ท้าย: แยก genre ด้วย comma, .strip() ตัดช่องว่างหัว-ท้ายทิ้ง,
        # กรองด้วย "if g.strip()" ทิ้งช่องว่างล้วนๆไม่ให้เป็น genre เปล่า — ส่วน "if song_genre else []"
        # ท้ายสุดคือ conditional expression กัน song_genre เป็น None (None.split จะ error) ให้เป็น list เปล่าแทน
        genres = [g.strip() for g in song_genre.split(",") if g.strip()] if song_genre else []
        for g in genres:
            genre_id = add_genre(cursor, g)
            add_genre_song(cursor, song_id, genre_id)

        # เหมือนกับ genre เป๊ะๆ แค่เปลี่ยนชื่อ: แยก mood ด้วย comma แล้ว find-or-create ทีละ mood
        moods = [m.strip() for m in song_mood.split(",") if m.strip()] if song_mood else []
        for m in moods:
            mood_id = add_mood(cursor, m)
            add_mood_song(cursor, song_id, mood_id)

        add_train_song(cursor, song_id, song_name, artist, lyric)

        conn.commit()  # ยืนยันบันทึกการเปลี่ยนแปลงทั้งหมดที่ทำมาในฟังก์ชันนี้ลงฐานข้อมูลจริง (ถ้าไม่ commit จะไม่ถูกบันทึกจริง)
        print(f"----- สำเร็จ: song_id={song_id}, genres_linked={genres}, moods_linked={moods}, "
              f"image_link={image_link!r} -----\n")
        result = {"status": "success", "song_id": song_id, "genres_linked": genres, "moods_linked": moods,
                  "image_link": image_link}
        if not image_link:
            # ไม่ใช่ error (เพลงเพิ่มสำเร็จแล้ว) แต่หารูปจาก youtube_link ไม่ได้ — ส่ง warning แยกไว้
            # ให้ frontend (AddSong.js) โชว์แจ้งเตือนเพิ่มได้ โดยไม่ทำให้ทั้งคำขอกลายเป็น error
            result["image_warning"] = "ไม่สามารถดึงรูปภาพจากลิงก์ YouTube นี้ได้ (อาจไม่ใช่ลิงก์เพลงเดี่ยว)"
        return result
    except Exception as e:
        conn.rollback()  # ถ้ามีจุดไหนพังระหว่างทาง ยกเลิกการเปลี่ยนแปลงทั้งหมดที่ยังไม่ commit กลับไปเหมือนไม่เคยทำอะไรเลย กันข้อมูลครึ่งๆกลางๆ (เช่น มี Song แต่ไม่มี Genre_Song คู่กัน)
        print(f"----- ล้มเหลว: {e} (ยกเลิกการเปลี่ยนแปลงทั้งหมดแล้ว) -----\n")
        return {"status": "error", "error": str(e)}
    finally:
        conn.close()  # ปิดการเชื่อมต่อเสมอไม่ว่าจะสำเร็จหรือพัง (finally รันทุกกรณี) กันการเชื่อมต่อค้างไว้ไม่ได้ปิด


if __name__ == "__main__":
    result = Add_song(
        song_name="เพลงทดสอบ",
        artist="ศิลปินทดสอบ",
        song_genre="pop, test genre",
        youtube_link="https://music.youtube.com/watch?v=test",
        spotify_link="https://open.spotify.com/track/test",
        song_mood="เศร้า, อกหัก",
        lyric="เนื้อเพลงทดสอบ",
    )
    print(result)
