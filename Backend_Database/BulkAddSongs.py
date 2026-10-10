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

sys.path.insert(0, str(Path(__file__).parent))
from AddSong import Add_song
from main import get_connection


def load_existing():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute('SELECT song_name, youtube_link FROM "Song"')
    existing = set(cur.fetchall())
    conn.close()
    return existing


def main(csv_path):
    with open(csv_path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    existing = load_existing()
    print(f"ไฟล์: {csv_path} | ทั้งหมด {len(rows)} เพลง | มีอยู่แล้วในฐานข้อมูล {len(existing)} เพลง (ทุกไฟล์รวมกัน)\n")

    ok = skip = fail = 0
    for i, r in enumerate(rows, 1):
        key = (r["name"], r["Youtube_Link"])
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

        if i % 100 == 0:
            print(f"--- {i}/{len(rows)} | เพิ่มสำเร็จ {ok} | ข้าม(มีอยู่แล้ว) {skip} | error {fail} ---")

    print(f"\nเสร็จแล้ว! เพิ่มสำเร็จ {ok} | ข้าม(มีอยู่แล้ว) {skip} | error {fail} | รวม {len(rows)}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("ใช้: python BulkAddSongs.py <path/to/file.csv>")
        sys.exit(1)
    main(sys.argv[1])
