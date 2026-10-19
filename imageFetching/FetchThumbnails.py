"""
FetchThumbnails.py
ดึงลิงก์รูป thumbnail ของ YouTube ให้ทุกเพลงในตาราง Song

หลักการ: YouTube มีรูปแบบ URL รูปตายตัวที่สร้างจาก video id ได้เลย
https://img.youtube.com/vi/<video_id>/hqdefault.jpg
แค่ตัด video id ออกจาก youtube_link ที่มีอยู่แล้ว ไม่ต้องเรียกเน็ตเลย เร็วมาก

ขั้นตอน:
  1. ดึงเพลงทุกเพลงจากตาราง Song (song_id, song_name, youtube_link) -> เขียนลง DatabeforeImage.csv
     (คอลัมน์ Image_link ยังว่างเปล่า)
  2. อ่าน DatabeforeImage.csv ทีละแถว ตัด video id จาก youtube_link แล้วประกอบเป็นลิงก์รูป
     ใส่ Image_link -> เขียนลง DataAfterImage.csv
  3. เอา Image_link จาก DataAfterImage.csv ไปอัปเดตคอลัมน์ "Image_Link" ในตาราง Song ให้ตรงกับ song_id

ใช้: python FetchThumbnails.py
"""
import csv
import sys
from pathlib import Path
from urllib.parse import urlparse, parse_qs

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, str(Path(__file__).parent.parent / "Backend_Database"))
from main import get_connection  # noqa: E402

BASE_PATH = Path(__file__).parent
BEFORE_CSV = BASE_PATH / "DatabeforeImage.csv"
AFTER_CSV = BASE_PATH / "DataAfterImage.csv"


def get_thumbnail_link(youtube_link):
    """input: ลิงก์ YouTube 1 ลิงก์ -> output: ลิงก์รูป thumbnail (หรือ "" ถ้าหา video id ไม่เจอ)"""
    if not youtube_link:
        return ""
    query = parse_qs(urlparse(youtube_link).query)
    video_id = query.get("v", [""])[0]
    if not video_id:
        return ""
    return f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"


def export_songs_to_csv():
    """ขั้นตอน 1: ดึงเพลงทุกเพลงจากตาราง Song เขียนลง DatabeforeImage.csv"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT song_id, song_name, youtube_link FROM "Song" ORDER BY song_id')
    songs = cursor.fetchall()
    conn.close()

    with open(BEFORE_CSV, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["song_id", "song_name", "youtube_link", "Image_link"])
        for song_id, song_name, youtube_link in songs:
            writer.writerow([song_id, song_name, youtube_link, ""])

    print(f"ขั้นตอน 1: ดึงเพลงทั้งหมด {len(songs)} เพลง ลงไฟล์ {BEFORE_CSV.name} แล้ว")


def fill_image_links():
    """ขั้นตอน 2: อ่าน DatabeforeImage.csv ใส่ Image_link ให้ครบ เขียนลง DataAfterImage.csv"""
    with open(BEFORE_CSV, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    found = 0
    for row in rows:
        row["Image_link"] = get_thumbnail_link(row["youtube_link"])
        if row["Image_link"]:
            found += 1

    with open(AFTER_CSV, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["song_id", "song_name", "youtube_link", "Image_link"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"ขั้นตอน 2: หาลิงก์รูปได้ {found} จาก {len(rows)} เพลง ลงไฟล์ {AFTER_CSV.name} แล้ว")
    return rows


def update_song_table(rows):
    """ขั้นตอน 3: เอา Image_link จากแต่ละแถวไปอัปเดตตาราง Song ให้ตรงกับ song_id"""
    conn = get_connection()
    cursor = conn.cursor()

    updated = 0
    for row in rows:
        if row["Image_link"]:
            cursor.execute(
                'UPDATE "Song" SET "Image_Link" = %s WHERE song_id = %s',
                (row["Image_link"], row["song_id"]),
            )
            updated += 1

    conn.commit()
    conn.close()
    print(f"ขั้นตอน 3: อัปเดตคอลัมน์ Image_Link ในตาราง Song แล้ว {updated} เพลง")


if __name__ == "__main__":
    export_songs_to_csv()
    rows = fill_image_links()
    update_song_table(rows)
