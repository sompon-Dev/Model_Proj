"""
BackfillArtist.py
เติมคอลัมน์ "Artist" ในตาราง Song ให้ครบ (ตอนนี้ว่างทั้งหมด) โดยอ่านชื่อศิลปินจาก 3 แหล่งข้อมูล
เดิมที่เคยใช้สร้างเพลงพวกนี้เข้า Song/Train_Song มาตั้งแต่แรก (ไม่ต้องหาข้อมูลใหม่เลย):
  1. Ver.5/InputData/songs_enriched.csv   (คอลัมน์ name, artist)
  2. DatasetInput/famous_with_genre.csv   (คอลัมน์ name, artist)
  3. Ver.5/CleanedData/<ชื่อศิลปิน>/<ชื่อเพลง>.txt   (ชื่อศิลปินคือชื่อโฟลเดอร์)

ถ้าเพลงชื่อเดียวกันเจอในหลายแหล่งแต่ศิลปินไม่ตรงกัน (เป็นเพลงคนละเพลงจริงๆ ไม่ใช่ feat ร่วมร้อง)
ให้ใช้ศิลปินที่เจอ "บ่อยที่สุด" ในข้อมูลทั้งหมด (เสียงส่วนใหญ่) เป็นตัวตัดสิน — บันทึกเคสแบบนี้ไว้ใน
log file ด้วยเพื่อให้ตรวจสอบย้อนหลังได้ว่าเพลงไหนไม่แน่ใจ 100%

ใช้: python BackfillArtist.py   (รันครั้งเดียวพอ แต่รันซ้ำได้ปลอดภัย เขียนทับ Artist เดิมด้วยผลลัพธ์เดิม)
"""
import csv
import sys
from collections import Counter
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, str(Path(__file__).parent))
from main import get_connection  # noqa: E402

BASE_PATH = Path(__file__).parent.parent
SONGS_ENRICHED_CSV = BASE_PATH / "Ver.5" / "InputData" / "songs_enriched.csv"
FAMOUS_CSV = BASE_PATH / "DatasetInput" / "famous_with_genre.csv"
CLEANED_DATA_DIR = BASE_PATH / "Ver.5" / "CleanedData"
LOG_FILE = Path(__file__).parent / "backfill_artist_log.txt"


def collect_name_artist_pairs():
    """รวบรวม (ชื่อเพลง, ชื่อศิลปิน) ทุกคู่จากทั้ง 3 แหล่ง คืนเป็น list เดียว
    (ชื่อเพลงเดียวกันโผล่ซ้ำได้หลายครั้งถ้าเจอในหลายแหล่ง หรือมีหลายศิลปินในแหล่งเดียวกัน)"""
    pairs = []

    for csv_path in (SONGS_ENRICHED_CSV, FAMOUS_CSV):
        if not csv_path.exists():
            print(f"  [ข้าม] ไม่พบไฟล์ {csv_path}")
            continue
        with open(csv_path, encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                name, artist = row.get("name", "").strip(), row.get("artist", "").strip()
                if name and artist:
                    pairs.append((name, artist))
        print(f"  อ่าน {csv_path.name} แล้ว")

    if CLEANED_DATA_DIR.exists():
        count = 0
        for artist_folder in sorted(CLEANED_DATA_DIR.iterdir()):
            if not artist_folder.is_dir():
                continue
            for txt_file in artist_folder.glob("*.txt"):
                pairs.append((txt_file.stem, artist_folder.name))
                count += 1
        print(f"  อ่าน CleanedData แล้ว ({count} เพลง)")

    return pairs


def resolve_artist_per_song(pairs):
    """รวมคู่ (ชื่อเพลง, ศิลปิน) ทั้งหมดเป็น ชื่อเพลง -> ศิลปินที่เจอบ่อยที่สุด
    คืน (resolved: dict ชื่อเพลง->ศิลปิน, ambiguous: list ของชื่อเพลงที่เจอศิลปินมากกว่า 1 คน)"""
    artists_by_song = {}
    for name, artist in pairs:
        artists_by_song.setdefault(name, []).append(artist)

    resolved = {}
    ambiguous = []
    for name, artist_list in artists_by_song.items():
        counts = Counter(artist_list)
        # most_common(1) คืน [(ศิลปิน, จำนวนครั้งที่เจอ)] เรียงจากมากไปน้อย เอาตัวแรกคือตัวที่เจอบ่อยสุด
        top_artist, top_count = counts.most_common(1)[0]
        resolved[name] = top_artist
        if len(counts) > 1:
            ambiguous.append((name, dict(counts)))

    return resolved, ambiguous


def backfill():
    log_lines = []

    print("รวบรวมข้อมูล ชื่อเพลง->ศิลปิน จากทุกแหล่ง...")
    pairs = collect_name_artist_pairs()
    print(f"  รวม {len(pairs)} คู่ (ชื่อเพลง, ศิลปิน) จากทุกแหล่ง\n")

    resolved, ambiguous = resolve_artist_per_song(pairs)
    print(f"สรุป: มีชื่อเพลงทั้งหมด {len(resolved)} ชื่อที่รู้ศิลปินแล้ว "
          f"({len(ambiguous)} ชื่อที่เจอศิลปินมากกว่า 1 คน ใช้เสียงส่วนใหญ่ตัดสิน)\n")

    log_lines.append(f"รวม (ชื่อเพลง, ศิลปิน) จากทุกแหล่ง: {len(pairs)} คู่")
    log_lines.append(f"ชื่อเพลงที่รู้ศิลปินแล้ว: {len(resolved)}")
    log_lines.append(f"ชื่อเพลงที่ไม่แน่ใจ 100% (ศิลปินมากกว่า 1 คน ใช้เสียงส่วนใหญ่ตัดสิน): {len(ambiguous)}")
    log_lines.append("")
    log_lines.append("----- รายชื่อเพลงที่ไม่แน่ใจ 100% (ควรตรวจสอบย้อนหลัง) -----")
    for name, counts in ambiguous:
        log_lines.append(f"  '{name}' -> {counts}")
    log_lines.append("")

    print("กำลังอัปเดตตาราง Song...")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT song_id, song_name FROM "Song" ORDER BY song_id')
    songs = cursor.fetchall()

    updated, not_found = 0, []
    for song_id, song_name in songs:
        artist = resolved.get(song_name)
        if artist:
            cursor.execute('UPDATE "Song" SET "Artist" = %s WHERE song_id = %s', (artist, song_id))
            updated += 1
        else:
            not_found.append((song_id, song_name))

    conn.commit()
    conn.close()

    print(f"\n✓ อัปเดตสำเร็จ {updated} เพลง จากทั้งหมด {len(songs)} เพลง")
    print(f"✗ หาศิลปินไม่เจอเลย {len(not_found)} เพลง (ไม่มีในแหล่งข้อมูลทั้ง 3 แหล่ง)")

    log_lines.append(f"อัปเดตสำเร็จ: {updated} / {len(songs)} เพลง")
    log_lines.append(f"หาศิลปินไม่เจอเลย: {len(not_found)} เพลง")
    log_lines.append("")
    log_lines.append("----- รายชื่อเพลงที่หาศิลปินไม่เจอเลย -----")
    for song_id, song_name in not_found:
        log_lines.append(f"  song_id={song_id} '{song_name}'")

    LOG_FILE.write_text("\n".join(log_lines), encoding="utf-8")
    print(f"\nบันทึก log ไว้ที่ {LOG_FILE}")


if __name__ == "__main__":
    backfill()
