"""
BulkAddSongs.py
เพิ่มเพลงจากไฟล์ CSV (famous_with_genre.csv, songs_enriched.csv) เข้าฐานข้อมูลทั้งหมด
โดยเรียก Add_song() ของ AddSong.py ทีละแถว

คุณสมบัติ:
  - resume ได้: เช็กก่อนว่าเพลง (song_name, youtube_link) นี้มีอยู่ในตาราง Song แล้วหรือยัง
    ถ้ามีแล้วข้ามไป ไม่ insert ซ้ำ (เผื่อรันค้างแล้วต้องรันต่อ)
  - พิมพ์ความคืบหน้าทุก 100 เพลง

ใช้: python BulkAddSongs.py <path/to/file.csv>
"""
import csv
import sys
from pathlib import Path

# เติม folder ของไฟล์นี้เองเข้า sys.path (รายการที่ Python ใช้หาไฟล์ตอน import) ให้ import AddSong/main ได้แน่นอนไม่ว่าจะรันจากไหน
sys.path.insert(0, str(Path(__file__).parent))
from AddSong import Add_song
from main import get_connection


def load_existing():
    conn = get_connection()
    cur = conn.cursor()  # cursor() ธรรมดา (ไม่ใช่ RealDictCursor แบบ AddSong.py) คืนแต่ละแถวเป็น tuple ธรรมดา เช่น ("ชื่อเพลง", "youtube.com/...")
    cur.execute('SELECT song_name, youtube_link FROM "Song"')
    existing = set(cur.fetchall())  # ใส่ tuple ทุกแถวลง set เพื่อเช็ก "มีอยู่แล้วหรือไม่" แบบเร็ว (set เช็กสมาชิกได้เร็วกว่า list มาก เพราะไม่ต้องไล่ดูทีละตัว)
    conn.close()
    return existing


def main(csv_path):
    with open(csv_path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))  # DictReader อ่านแต่ละแถวเป็น dict โดยใช้หัวตาราง (แถวแรกของ CSV) เป็น key เช่น row["name"], row["artist"]

    existing = load_existing()
    print(f"ไฟล์: {csv_path} | ทั้งหมด {len(rows)} เพลง | มีอยู่แล้วในฐานข้อมูล {len(existing)} เพลง (ทุกไฟล์รวมกัน)\n")

    ok = skip = fail = 0
    for i, r in enumerate(rows, 1):  # enumerate(rows, 1) นับเลขแถวคู่ไปกับ r โดยเริ่มที่ 1 (ไม่ใช่ 0) ให้ตรงกับที่คนเข้าใจว่า "แถวที่ 1"
        key = (r["name"], r["Youtube_Link"])  # ใช้ tuple (ชื่อเพลง, youtube link) เป็น key เดียว ให้ตรงชนิดกับ tuple ที่ load_existing() ดึงมาจาก DB เทียบกันได้ตรงๆ
        if key in existing:
            skip += 1
            continue

        result = Add_song(
            song_name=r["name"],
            artist=r["artist"],
            song_genre=r.get("Genre", ""),
            link_song=r["Youtube_Link"],
            song_mood=None,
            lyric=r["lyric"],
        )
        if result["status"] == "success":
            ok += 1
            existing.add(key)
        else:
            fail += 1
            print(f"[✗ error] {r['name']} - {r['artist']}: {result.get('error')}")

        if i % 100 == 0:   # % คือ modulo (เศษจากการหาร) — true ทุกๆ 100 แถว (100, 200, 300, ...) ใช้พิมพ์ความคืบหน้าเป็นช่วงๆ ไม่ใช่ทุกแถว
            print(f"--- {i}/{len(rows)} | เพิ่มสำเร็จ {ok} | ข้าม(มีอยู่แล้ว) {skip} | error {fail} ---")

    print(f"\nเสร็จแล้ว! เพิ่มสำเร็จ {ok} | ข้าม(มีอยู่แล้ว) {skip} | error {fail} | รวม {len(rows)}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("ใช้: python BulkAddSongs.py <path/to/file.csv>")
        sys.exit(1)
    main(sys.argv[1])
