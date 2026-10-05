"""
importdata.py
เพิ่ม 2 ฟีเจอร์ให้ทุกเพลงใน thai_songs_30000_merged.xls (จริงๆ เป็นไฟล์ CSV ใช้นามสกุลผิด):
  - Youtube_Link  มาจาก Link_Fetcher/Links.py  (ค้นด้วยชื่อเพลง+ศิลปิน)
  - Genre         มาจาก Genre_Finder/Genre.py  (ค้นด้วยชื่อเพลง+ศิลปิน)
แล้วบันทึกเป็นไฟล์ใหม่ songs_enriched.csv

คอลัมน์ input  : Title, Artist, Lyric
คอลัมน์ output : name, artist, lyric, Genre, Youtube_Link

เพลงไหนหาไม่ครบ (ไม่เจอ Genre หรือไม่เจอ Youtube_Link หรืออย่างใดอย่างหนึ่งว่าง/NaN) หรือ
หานานเกิน TIMEOUT_SEC วินาที จะถูก "ตัดทิ้ง" ไม่เขียนลง songs_enriched.csv เลย — songs_enriched.csv
จึงมีแต่แถวที่ข้อมูลครบทุกคอลัมน์เท่านั้น ส่วนเพลงที่ถูกตัดทิ้งจะถูกจดไว้ที่ songs_failed.csv
(name, artist, reason) ไว้ดูย้อนหลังว่าตัดเพราะอะไร และกันไม่ให้ลองซ้ำเพลงเดิมทุกครั้งที่รันต่อ

คุณสมบัติ:
  - เขียนผลลงไฟล์ทันทีทีละเพลง (ไม่รอให้ครบทุกเพลงก่อนเซฟ) ปิดโปรแกรมกลางทางข้อมูลที่ทำไปแล้วไม่หาย
  - รันซ้ำได้ (resume): เพลงที่เคยทำไปแล้วไม่ว่าสำเร็จหรือถูกตัดทิ้ง จะไม่ถูกลองซ้ำอีก
  - ประมวลผลหลายเพลงพร้อมกัน (WORKERS) เพื่อให้เร็วขึ้น เพราะงานส่วนใหญ่คือรอ network ไม่ใช่รอ CPU

หมายเหตุ: Links.py และ Genre.py เองมี print() บอกผลทุกครั้งที่เรียก (ของเดิมตั้งใจให้ทำแบบนั้น)
สคริปต์นี้ไม่ได้ปิดมันเพราะ print() ไม่ thread-safe เวลาเรียกพร้อมกันหลาย thread ดังนั้น terminal
จะมี log เยอะมาก ถ้ารันจริงยาวๆ แนะนำ redirect ออกไฟล์: python importdata.py > run_log.txt 2>&1
"""
import csv
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "Link_Fetcher"))
sys.path.insert(0, str(ROOT / "Genre_Finder"))
from Links import get_links   # noqa: E402  (Link_Fetcher)
from Genre import get_genre   # noqa: E402  (Genre_Finder)

BASE_PATH   = Path(__file__).parent
INPUT_FILE  = BASE_PATH / "thai_songs_30000_merged.xls"
OUTPUT_FILE = BASE_PATH / "songs_enriched.csv"   # เฉพาะเพลงที่ข้อมูลครบ
FAILED_FILE = BASE_PATH / "songs_failed.csv"     # เพลงที่ถูกตัดทิ้ง + เหตุผล

TIMEOUT_SEC = 20   # ต่อเพลง: หา link+genre รวมกันเกินนี้ = ตัดทิ้งเลย
WORKERS     = 4    # จำนวนเพลงที่ทำพร้อมกัน (เพิ่มได้ถ้าไม่โดน rate-limit แต่เสี่ยงมากขึ้น)
LIMIT       = None  # ใส่ตัวเลขเพื่อทดสอบกับไม่กี่เพลงก่อน (เช่น 10) ปล่อย None = ทำทั้งหมด

FIELDNAMES        = ["name", "artist", "lyric", "Genre", "Youtube_Link"]
FAILED_FIELDNAMES = ["name", "artist", "reason"]


def enrich_one(title, artist, lyric):
    """หา youtube_link + genre ของเพลงเดียว ไม่ throw ออกไป (จับ error เองหมด คืนค่าว่างแทน)"""
    youtube_link = ""
    try:
        link_result = get_links(title, artist)
        youtube_link = link_result.get("url") or ""
    except Exception as e:
        print(f"    [link error] {title} - {artist}: {e}")

    genre = ""
    try:
        genre_result = get_genre(title, artist)
        genre = ", ".join(genre_result.get("genres", []))
    except Exception as e:
        print(f"    [genre error] {title} - {artist}: {e}")

    if genre and youtube_link:
        status = "เจอครบทั้ง genre และ link"
    elif genre:
        status = "เจอแค่ genre (ไม่เจอ link)"
    elif youtube_link:
        status = "เจอแค่ link (ไม่เจอ genre)"
    else:
        status = "ไม่เจอทั้งคู่"
    print(f">>> [{status}] {title} - {artist}")

    return {"name": title, "artist": artist, "lyric": lyric, "Genre": genre, "Youtube_Link": youtube_link}


def missing_reason(result):
    """คืน None ถ้าข้อมูลครบ (ไม่ต้องตัดทิ้ง) ไม่งั้นคืนข้อความเหตุผลที่ตัดทิ้ง"""
    missing = []
    if not result["Genre"]:
        missing.append("genre")
    if not result["Youtube_Link"]:
        missing.append("youtube_link")
    return "missing: " + ", ".join(missing) if missing else None


def load_done():
    """อ่าน output + failed เดิม (ถ้ามี) คืนเซ็ต (name, artist) ที่เคยทำไปแล้ว (ไม่ว่าผลจะเป็นยังไง)
    เผื่อรันต่อจากที่ค้าง จะได้ไม่ลองซ้ำเพลงเดิมที่รู้อยู่แล้วว่าหาไม่เจอ"""
    done = set()
    for path, cols in ((OUTPUT_FILE, ("name", "artist")), (FAILED_FILE, ("name", "artist"))):
        if path.exists():
            with open(path, encoding="utf-8-sig", newline="") as f:
                done.update((row[cols[0]], row[cols[1]]) for row in csv.DictReader(f))
    return done


def open_writer(path, fieldnames):
    file_exists = path.exists()
    f = open(path, "a", encoding="utf-8-sig", newline="")
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    if not file_exists:
        writer.writeheader()
        f.flush()
    return f, writer


def main():
    df = pd.read_csv(INPUT_FILE, encoding="utf-8-sig")
    df[["Title", "Artist", "Lyric"]] = df[["Title", "Artist", "Lyric"]].fillna("")
    if LIMIT:
        df = df.head(LIMIT)

    done = load_done()
    pending = [row for row in df.itertuples() if (row.Title, row.Artist) not in done]
    print(f"เพลงทั้งหมด {len(df)} | ทำไปแล้ว {len(done)} (ข้าม) | เหลือต้องทำ {len(pending)}\n")

    out_f, writer = open_writer(OUTPUT_FILE, FIELDNAMES)
    fail_f, fail_writer = open_writer(FAILED_FILE, FAILED_FIELDNAMES)

    def record_failed(title, artist, reason):
        fail_writer.writerow({"name": title, "artist": artist, "reason": reason})
        fail_f.flush()
        done.add((title, artist))

    kept = dropped = timed_out_n = errored = 0
    t_start = time.time()

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        song_iter = iter(pending)
        futures = {}  # future -> (title, artist, submitted_at)

        def submit_next():
            row = next(song_iter, None)
            if row is None:
                return False
            fut = pool.submit(enrich_one, row.Title, row.Artist, row.Lyric)
            futures[fut] = (row.Title, row.Artist, time.time())
            return True

        for _ in range(WORKERS * 2):
            if not submit_next():
                break

        while futures:
            now = time.time()
            finished = [f for f in futures if f.done()]
            timed_out = [f for f in futures if not f.done() and now - futures[f][2] > TIMEOUT_SEC]

            for f in finished:
                title, artist, _ = futures.pop(f)
                try:
                    result = f.result()
                    reason = missing_reason(result)
                    if reason:
                        record_failed(title, artist, reason)
                        dropped += 1
                        print(f"[✗ ตัดทิ้ง: {reason}] {title} - {artist}")
                    else:
                        writer.writerow(result)
                        out_f.flush()
                        done.add((title, artist))
                        kept += 1
                except Exception as e:
                    record_failed(title, artist, f"error: {e}")
                    errored += 1
                    print(f"[err] {title} - {artist}: {e}")
                submit_next()

            for f in timed_out:
                title, artist, _ = futures.pop(f)
                record_failed(title, artist, "timeout")
                timed_out_n += 1
                print(f"[⏱ ตัดทิ้ง เกิน {TIMEOUT_SEC}s] {title} - {artist}")
                # thread ที่ยังทำงานอยู่จะปล่อยทิ้งไว้ให้จบเองตามธรรมชาติ (ytmusicapi/requests มี
                # timeout ภายในตัวเองสูงสุด ~30s อยู่แล้ว จึงไม่ค้างตลอดไปจนกิน worker ทั้งหมด)
                submit_next()

            if not finished and not timed_out:
                time.sleep(0.3)

            total_done = kept + dropped + timed_out_n + errored
            if total_done and total_done % 20 == 0 and (finished or timed_out):
                elapsed = (time.time() - t_start) / 60
                rate = total_done / elapsed if elapsed > 0 else 0
                remaining = len(pending) - total_done
                eta_min = remaining / rate if rate > 0 else float("inf")
                print(f"--- เก็บ {kept} | ตัดทิ้งเพราะข้อมูลไม่ครบ {dropped} | ตัดทิ้งเพราะช้า {timed_out_n} "
                      f"| error {errored} | ใช้เวลา {elapsed:.1f} นาที | เหลืออีกราว {eta_min:.0f} นาที ---")

    out_f.close()
    fail_f.close()
    elapsed = (time.time() - t_start) / 60
    print(f"\nเสร็จแล้ว! เก็บ {kept} | ตัดทิ้งเพราะข้อมูลไม่ครบ {dropped} | ตัดทิ้งเพราะช้า {timed_out_n} "
          f"| error {errored} | ใช้เวลา {elapsed:.1f} นาที")
    print(f"บันทึกเพลงที่ข้อมูลครบที่: {OUTPUT_FILE}")
    print(f"บันทึกเพลงที่ตัดทิ้ง (+เหตุผล) ที่: {FAILED_FILE}")


if __name__ == "__main__":
    main()
