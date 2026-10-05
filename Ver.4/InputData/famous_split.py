"""
famous_split.py
เอาเฉพาะเพลงที่ "เจอ link แต่ไม่เจอ genre" (reason == "missing: genre" ใน songs_failed.csv)
มาแยกเป็น 2 ไฟล์ตามยอดวิวใน YouTube:
  - famous.csv     ยอดวิว > 20,000,000
  - nonfamous.csv  ยอดวิว <= 20,000,000

ต้องดึง link ใหม่อีกครั้งด้วย Link_Fetcher เพราะรอบที่แล้ว (importdata.py) เจอ link จริง
แต่ไม่ได้บันทึกค่า link ไว้ในไฟล์ (songs_failed.csv มีแค่ name, artist, reason) แล้วดึงยอดวิวด้วย
yt-dlp (ไม่มี YouTube Data API key จึงใช้ yt-dlp อ่านข้อมูลหน้าวิดีโอแทน)

คอลัมน์ output: name, artist, lyric, Youtube_Link, views

เพลงที่ลองหา link ใหม่แล้วไม่เจอ (ผลค้นหาไม่เหมือนรอบก่อนเป๊ะ บางครั้งเกิดขึ้นได้) หรือ yt-dlp
ดึงยอดวิวไม่ได้ หรือช้าเกิน TIMEOUT_SEC จะถูกบันทึกแยกไว้ที่ view_failed.csv พร้อมเหตุผล
ไม่ถูกทิ้งแบบไม่มีร่องรอย

คุณสมบัติเหมือน importdata.py: resume ได้, เขียนทันทีทีละแถว, ทำพร้อมกันหลาย worker
"""
import csv
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pandas as pd
import yt_dlp

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "Link_Fetcher"))
from Links import get_links  # noqa: E402  (Link_Fetcher)

BASE_PATH    = Path(__file__).parent
INPUT_FILE   = BASE_PATH / "thai_songs_30000_merged.xls"   # ไว้ดึง lyric กลับมา (ไฟล์เดิมไม่มีเก็บ)
FAILED_FILE  = BASE_PATH / "songs_failed.csv"               # ไฟล์จาก importdata.py รอบก่อน
FAMOUS_FILE    = BASE_PATH / "famous.csv"
NONFAMOUS_FILE = BASE_PATH / "nonfamous.csv"
VIEW_FAILED_FILE = BASE_PATH / "view_failed.csv"

VIEW_THRESHOLD = 20_000_000
TIMEOUT_SEC = 25
WORKERS     = 2    # ลดจาก 4 เพราะยิงแรงไปโดน YouTube บล็อกตอนทดสอบจริง
LIMIT       = None
# ลองแล้วว่า bot-check ของ YouTube เป็นบล็อกระดับ IP ที่ติดนานหลักนาทีถึงชั่วโมง ไม่ใช่วินาที —
# รอ/retry ในสคริปต์เดียวไม่คุ้ม เลยแค่ "แท็กแล้วข้ามไปเลย" ให้เพลงอื่นที่ยังไม่โดนบล็อกไหลต่อได้
# ค่อยรันสคริปต์นี้ซ้ำอีกรอบ (resume ได้) ตอนบล็อกคลายแล้วเพื่อเก็บเพลงกลุ่มนี้ทีหลัง

OUT_FIELDS  = ["name", "artist", "lyric", "Youtube_Link", "views"]
FAIL_FIELDS = ["name", "artist", "reason"]

YDL_OPTS = {
    "quiet": True,
    "no_warnings": True,
    "skip_download": True,
    "noplaylist": True,
    "youtube_include_dash_manifest": False,
    "youtube_include_hls_manifest": False,
    # player_client=android หลบ "Sign in to confirm you're not a bot" ที่ client เริ่มต้น (web) โดน
    # หลังยิงคำขอรัวๆ ไปสักพัก — เจอปัญหานี้จริงตอนรันจริง (ดู famous_log.txt ก่อนแก้)
    "extractor_args": {"youtube": {"player_client": ["android"]}},
}


def _is_bot_check(err):
    s = str(err).lower()
    return "sign in" in s or "not a bot" in s


def enrich_one(title, artist, lyric):
    """หา link ใหม่ + ยอดวิว คืน (ok: bool, data: dict) — ไม่ throw ออกไป (จับ error เองหมด)
    ถ้าเจอ bot-check ของ YouTube (บล็อกระดับ IP ติดนานเป็นนาที-ชั่วโมง) จะแท็กแล้วข้ามไปเลย
    ไม่รอ/ไม่ retry ในรอบเดียวกัน เพราะรอไม่คุ้ม — รันสคริปต์นี้ซ้ำทีหลัง (resume ได้) เพื่อเก็บ
    เพลงกลุ่มนี้ตอนบล็อกคลายแล้วแทน"""
    try:
        link_result = get_links(title, artist)
    except Exception as e:
        return False, {"reason": f"link error: {e}"}

    url = link_result.get("url")
    if not url:
        return False, {"reason": "หา link ใหม่ไม่เจอ (ผลต่างจากรอบก่อน)"}

    try:
        with yt_dlp.YoutubeDL(YDL_OPTS) as ydl:
            info = ydl.extract_info(url, download=False)
        views = info.get("view_count")
    except Exception as e:
        reason = "bot_check (ลองใหม่ได้ทีหลัง)" if _is_bot_check(e) else f"yt-dlp error: {e}"
        return False, {"reason": reason}

    if views is None:
        return False, {"reason": "yt-dlp ไม่คืนยอดวิวมาให้ (วิดีโออาจถูกลบ/ปิดส่วนตัว)"}

    return True, {"name": title, "artist": artist, "lyric": lyric, "Youtube_Link": url, "views": views}


def load_lyrics():
    df = pd.read_csv(INPUT_FILE, encoding="utf-8-sig")
    df[["Title", "Artist", "Lyric"]] = df[["Title", "Artist", "Lyric"]].fillna("")
    lyrics = {}
    for row in df.itertuples():
        lyrics.setdefault((row.Title, row.Artist), row.Lyric)   # เก็บตัวแรกถ้าซ้ำ
    return lyrics


def load_target_songs():
    with open(FAILED_FILE, encoding="utf-8-sig", newline="") as f:
        return [(r["name"], r["artist"]) for r in csv.DictReader(f) if r["reason"] == "missing: genre"]


def load_done():
    done = set()
    for path in (FAMOUS_FILE, NONFAMOUS_FILE, VIEW_FAILED_FILE):
        if path.exists():
            with open(path, encoding="utf-8-sig", newline="") as f:
                done.update((row["name"], row["artist"]) for row in csv.DictReader(f))
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
    targets = load_target_songs()
    if LIMIT:
        targets = targets[:LIMIT]
    lyrics = load_lyrics()

    done = load_done()
    pending = [(t, a) for t, a in targets if (t, a) not in done]
    print(f"เพลงเป้าหมาย (เจอ link ไม่เจอ genre) {len(targets)} | ทำไปแล้ว {len(done)} (ข้าม) | เหลือ {len(pending)}\n")

    famous_f, famous_w = open_writer(FAMOUS_FILE, OUT_FIELDS)
    nonfamous_f, nonfamous_w = open_writer(NONFAMOUS_FILE, OUT_FIELDS)
    failed_f, failed_w = open_writer(VIEW_FAILED_FILE, FAIL_FIELDS)

    famous_n = nonfamous_n = failed_n = timeout_n = 0
    t_start = time.time()

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        song_iter = iter(pending)
        futures = {}

        def submit_next():
            pair = next(song_iter, None)
            if pair is None:
                return False
            title, artist = pair
            fut = pool.submit(enrich_one, title, artist, lyrics.get((title, artist), ""))
            futures[fut] = (title, artist, time.time())
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
                    ok, data = f.result()
                except Exception as e:
                    ok, data = False, {"reason": f"error: {e}"}

                if ok:
                    if data["views"] > VIEW_THRESHOLD:
                        famous_w.writerow(data)
                        famous_f.flush()
                        famous_n += 1
                        tag = "ดัง"
                    else:
                        nonfamous_w.writerow(data)
                        nonfamous_f.flush()
                        nonfamous_n += 1
                        tag = "ไม่ดัง"
                    print(f">>> [{tag} | {data['views']:,} views] {title} - {artist}")
                else:
                    failed_w.writerow({"name": title, "artist": artist, "reason": data["reason"]})
                    failed_f.flush()
                    failed_n += 1
                    print(f"[✗ {data['reason']}] {title} - {artist}")
                submit_next()

            for f in timed_out:
                title, artist, _ = futures.pop(f)
                failed_w.writerow({"name": title, "artist": artist, "reason": "timeout"})
                failed_f.flush()
                timeout_n += 1
                print(f"[⏱ ตัดทิ้ง เกิน {TIMEOUT_SEC}s] {title} - {artist}")
                submit_next()

            if not finished and not timed_out:
                time.sleep(0.3)

            total = famous_n + nonfamous_n + failed_n + timeout_n
            if total and total % 20 == 0 and (finished or timed_out):
                elapsed = (time.time() - t_start) / 60
                rate = total / elapsed if elapsed > 0 else 0
                remaining = len(pending) - total
                eta = remaining / rate if rate > 0 else float("inf")
                print(f"--- ดัง {famous_n} | ไม่ดัง {nonfamous_n} | หายอดวิวไม่ได้ {failed_n} | ช้า {timeout_n} "
                      f"| {elapsed:.1f} นาที | เหลืออีกราว {eta:.0f} นาที ---")

    famous_f.close(); nonfamous_f.close(); failed_f.close()
    elapsed = (time.time() - t_start) / 60
    print(f"\nเสร็จแล้ว! ดัง {famous_n} | ไม่ดัง {nonfamous_n} | หายอดวิวไม่ได้ {failed_n} | ช้า {timeout_n} | {elapsed:.1f} นาที")
    print(f"บันทึกที่: {FAMOUS_FILE}, {NONFAMOUS_FILE}, {VIEW_FAILED_FILE}")


if __name__ == "__main__":
    main()
