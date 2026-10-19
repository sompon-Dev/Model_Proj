"""
FetchYoutubeLinks.py
ค้นหา youtube_link ที่ถูกต้องใหม่ทั้งหมดให้ทุกเพลงในตาราง Song (ที่รู้ "Artist" แล้วจาก
BackfillArtist.py) โดยใช้ Link_Fetcher/Links.py ค้นหาจริงผ่าน ytmusicapi ทีละเพลง (ชื่อเพลง +
ศิลปิน คู่กัน แม่นกว่าเดิมที่หาแค่ชื่อเพลงอย่างเดียว)

รันได้นานหลายชั่วโมง (ค้นผ่านเน็ตทีละเพลงจริง) จึงออกแบบให้ "หยุดกลางทางแล้วมาต่อวันหลังได้":
  - เขียนผลลงไฟล์ song_youtube_links.csv ทันทีทุกครั้งที่เจอ 1 เพลง (ไม่รอเก็บไว้เขียนทีเดียวตอนจบ)
  - อัปเดต youtube_link ในตาราง Song ทันทีทุกครั้งที่เจอด้วย (ไม่ต้องมีขั้นตอน "เอา CSV ไป apply"
    แยกต่างหากอีกที — เพลงที่เสร็จแล้วจะถูกต้องในฐานข้อมูลจริงทันที ไม่ต้องรอสคริปต์รันจบทั้งหมด)
  - ตอนเริ่มรันใหม่ จะอ่าน CSV เดิมก่อน แล้วข้ามเพลงที่ทำไปแล้ว ทำต่อจากที่ค้างไว้เท่านั้น

ใช้: python FetchYoutubeLinks.py
     ปิด terminal/ปิดคอมระหว่างรันได้ (งานที่ทำไปแล้วไม่หาย) แค่รันคำสั่งเดิมซ้ำเพื่อทำต่อ
"""
import csv
import sys
import time
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_PATH = Path(__file__).parent
OUTPUT_CSV = BASE_PATH / "song_youtube_links.csv"
LOG_FILE = BASE_PATH / "fetch_youtube_links_log.txt"
FIELDNAMES = ["song_id", "song_name", "artist", "youtube_link"]

DELAY_SECONDS = 0.3   # หน่วงเวลาระหว่างแต่ละเพลงนิดหน่อย กันยิง request ถี่เกินไปจน ytmusicapi บล็อก

sys.path.insert(0, str(BASE_PATH.parent / "Link_Fetcher"))
from Links import get_links  # noqa: E402

sys.path.insert(0, str(BASE_PATH.parent / "Backend_Database"))
from main import get_connection  # noqa: E402


def load_already_done():
    """อ่าน CSV เดิม (ถ้ามีจากรันรอบก่อน) คืน set ของ song_id ที่ทำไปแล้ว ไม่ต้องทำซ้ำ"""
    if not OUTPUT_CSV.exists():
        return set()
    with open(OUTPUT_CSV, encoding="utf-8-sig", newline="") as f:
        return {int(row["song_id"]) for row in csv.DictReader(f)}


def fetch_all():
    already_done = load_already_done()
    print(f"เพลงที่ทำไปแล้วจากรอบก่อน: {len(already_done)} เพลง (จะข้ามพวกนี้)")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        'SELECT song_id, song_name, "Artist" FROM "Song" WHERE "Artist" IS NOT NULL ORDER BY song_id'
    )
    songs = cursor.fetchall()
    conn.close()

    todo = [(song_id, song_name, artist) for song_id, song_name, artist in songs
            if song_id not in already_done]
    print(f"เพลงที่เหลือต้องทำ: {len(todo)} จากทั้งหมด {len(songs)} เพลงที่รู้ศิลปินแล้ว\n")

    # เปิด CSV แบบ append (ถ้าไฟล์ยังไม่มีค่อยเขียน header ก่อน) ให้ progress เก่าไม่หาย
    write_header = not OUTPUT_CSV.exists()
    csv_file = open(OUTPUT_CSV, "a", encoding="utf-8-sig", newline="")
    writer = csv.DictWriter(csv_file, fieldnames=FIELDNAMES)
    if write_header:
        writer.writeheader()
        csv_file.flush()

    log_file = open(LOG_FILE, "a", encoding="utf-8")

    conn = get_connection()
    cursor = conn.cursor()

    found, not_found = 0, 0
    for i, (song_id, song_name, artist) in enumerate(todo, start=1):
        result = get_links(song_name, artist)
        url = result.get("url")

        writer.writerow({
            "song_id": song_id,
            "song_name": song_name,
            "artist": artist,
            "youtube_link": url or "",
        })
        csv_file.flush()   # เขียนลงดิสก์จริงทันที ไม่ค้างอยู่ใน buffer เผื่อปิดโปรแกรมกลางทาง

        if url:
            cursor.execute('UPDATE "Song" SET youtube_link = %s WHERE song_id = %s', (url, song_id))
            conn.commit()
            found += 1
            log_line = f"[{i}/{len(todo)}] song_id={song_id} '{song_name}' - '{artist}' -> {url}"
        else:
            not_found += 1
            log_line = f"[{i}/{len(todo)}] song_id={song_id} '{song_name}' - '{artist}' -> ไม่พบ ({result.get('error', '')})"

        log_file.write(log_line + "\n")
        log_file.flush()

        if i % 50 == 0:
            print(f"ความคืบหน้า: {i}/{len(todo)} (เจอ {found}, ไม่เจอ {not_found})")

        time.sleep(DELAY_SECONDS)

    csv_file.close()
    log_file.close()
    conn.close()

    print(f"\n✓ ทำเสร็จครบ: เจอลิงก์ {found} เพลง, ไม่เจอ {not_found} เพลง")
    print(f"ผลลัพธ์ทั้งหมดอยู่ที่ {OUTPUT_CSV}")
    print(f"log ละเอียดอยู่ที่ {LOG_FILE}")


if __name__ == "__main__":
    fetch_all()
