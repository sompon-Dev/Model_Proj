"""
AddSong.py
เพิ่มเพลง 1 เพลงเข้าฐานข้อมูลให้ครบทุกตารางที่เกี่ยวข้อง ผ่าน Add_song() ตัวเดียว

หมายเหตุสำคัญ — ส่วนที่ต่างจากที่ขอไว้ตอนแรก เพราะ schema จริงไม่รองรับ:
  - song_id เป็น integer (SERIAL) ของจริงในตาราง Song ไม่ใช่ uuid จึงให้ฐานข้อมูล
    generate เองตอน insert (RETURNING song_id) แล้วใช้ค่านั้นต่อในฟังก์ชันอื่น
  - Genre_Song ไม่มีคอลัมน์ song_name (มีแค่ song_id, genre_id) เลยไม่ได้เก็บ song_name ซ้ำ
  - Train_Song ไม่มีคอลัมน์ song_id เลย (มีแค่ newsong_id ของตัวเอง) รับ song_id เข้ามา
    เป็นพารามิเตอร์ตามที่ขอ แต่ไม่มีที่เก็บจริงในตารางนี้ จึงไม่ได้ insert ค่านี้ลงไป
  - song_mood รับเป็นพารามิเตอร์ไว้ตามสเปก แต่ยังไม่ผูกกับตาราง Mood/Mood_Song เพราะ
    เรื่อง mood ยังพักไว้ก่อน (ยังไม่มีวิธีหาค่า mood ที่น่าเชื่อถือ)
  - เชื่อมฐานข้อมูลตรงๆ ด้วย psycopg2 แบบเดียวกับ main.py ไม่ได้ยิงผ่าน HTTP endpoint
    จึงไม่ต้องเปิดเซิร์ฟเวอร์ uvicorn ก่อนใช้งาน (Postgres เองรันเป็น service อยู่แล้ว)

ใช้ในโค้ด:
    from AddSong import Add_song
    Add_song(song_name, artist, song_genre, link_song, song_mood, lyric)
    # song_genre ใส่ได้ทั้ง genre เดียว หรือหลาย genre คั่นด้วย comma เช่น "pop rock, pop, rock"
"""
import sys
from pathlib import Path

import psycopg2.extras

sys.path.insert(0, str(Path(__file__).parent))
from main import get_connection  # noqa: E402  (ใช้ DB_CONFIG/.env เดียวกับ main.py)


def add_genre(cursor, genre_name):
    """เช็กว่า genre_name มีอยู่ในตาราง Genre แล้วหรือยัง (ไม่สนตัวพิมพ์เล็ก-ใหญ่)
    ถ้ายังไม่มี สร้างแถวใหม่ ถ้ามีแล้วไม่ต้องทำอะไร — คืน genre_id เสมอ"""
    cursor.execute('SELECT genre_id FROM "Genre" WHERE LOWER(genre_name) = LOWER(%s)', (genre_name,))
    row = cursor.fetchone()
    if row:
        return row["genre_id"]
    cursor.execute('INSERT INTO "Genre" (genre_name) VALUES (%s) RETURNING genre_id', (genre_name,))
    return cursor.fetchone()["genre_id"]


def add_genre_song(cursor, song_id, genre_id):
    """เชื่อมเพลงกับ genre ในตาราง Genre_Song เช็กก่อนว่าคู่นี้มีอยู่แล้วหรือยัง กันแถวซ้ำ
    ตอนรันซ้ำ (Genre_Song มีแค่ song_id, genre_id ไม่มี song_name ให้เก็บ)"""
    cursor.execute('SELECT category_id FROM "Genre_Song" WHERE song_id = %s AND genre_id = %s', (song_id, genre_id))
    if cursor.fetchone():
        return
    cursor.execute('INSERT INTO "Genre_Song" (song_id, genre_id) VALUES (%s, %s)', (song_id, genre_id))


def add_train_song(cursor, song_id, song_name, artist, lyric):
    """เก็บเนื้อเพลงลงตาราง Train_Song เฉยๆ — song_id รับเข้ามาตามสเปก แต่ตารางนี้ไม่มี
    คอลัมน์ song_id จึงไม่ได้ insert ค่านี้ (เก็บแค่ newsong_name, newsong_artist, newsong_lyrics)"""
    cursor.execute(
        'INSERT INTO "Train_Song" (newsong_name, newsong_artist, newsong_lyrics) VALUES (%s, %s, %s)',
        (song_name, artist, lyric),
    )


def add_to_song_table(cursor, song_name, youtube_link):
    """เพิ่มเพลงลงตาราง Song เฉยๆ คืน song_id ที่ฐานข้อมูล generate ให้ (SERIAL)
    spotify_link เป็น NOT NULL ในตารางจริง แต่เราไม่มีค่านี้ (มีแค่ youtube_link) จึงใส่
    string ว่างแทน ไม่ใส่ NULL"""
    cursor.execute(
        'INSERT INTO "Song" (song_name, spotify_link, youtube_link) VALUES (%s, %s, %s) RETURNING song_id',
        (song_name, "", youtube_link),
    )
    return cursor.fetchone()["song_id"]


def Add_song(song_name, artist, song_genre, link_song, song_mood, lyric):
    """เพิ่มเพลง 1 เพลงเข้าฐานข้อมูลให้ครบ: Song -> Genre (+Genre_Song) -> Train_Song
    song_genre ใส่ได้หลาย genre คั่นด้วย comma (เช่นค่าที่ได้จาก songs_enriched.csv)
    song_mood รับไว้ตามสเปกแต่ยังไม่ได้ใช้งาน (เรื่อง mood ยังพักไว้)"""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        song_id = add_to_song_table(cursor, song_name, link_song)

        genres = [g.strip() for g in song_genre.split(",") if g.strip()] if song_genre else []
        for g in genres:
            genre_id = add_genre(cursor, g)
            add_genre_song(cursor, song_id, genre_id)

        add_train_song(cursor, song_id, song_name, artist, lyric)

        conn.commit()
        return {"status": "success", "song_id": song_id, "genres_linked": genres}
    except Exception as e:
        conn.rollback()
        return {"status": "error", "error": str(e)}
    finally:
        conn.close()


if __name__ == "__main__":
    result = Add_song(
        song_name="เพลงทดสอบ",
        artist="ศิลปินทดสอบ",
        song_genre="pop, test genre",
        link_song="https://music.youtube.com/watch?v=test",
        song_mood=None,
        lyric="เนื้อเพลงทดสอบ",
    )
    print(result)
