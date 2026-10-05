"""
ดึง URL ของ YouTube Music จากชื่อเพลง + ชื่อศิลปิน (ใช้ ytmusicapi ไม่ต้องใช้ key)

ใช้ในโค้ด:  from Links import get_links
            get_links("ชื่อเพลง", "ศิลปิน")
ใช้ใน terminal:  python Links.py "ชื่อเพลง" "ศิลปิน"   (ถ้าไม่ใส่ จะถามให้พิมพ์)
"""
import re
import sys
from difflib import SequenceMatcher

from ytmusicapi import YTMusic

MIN_TITLE = 0.6   # ชื่อเพลงต้องคล้ายอย่างน้อยเท่านี้ (0-1) ไม่งั้นถือว่าไม่เจอ ดีกว่าตอบเพลงผิด

_ytmusic = YTMusic()


# ─────────────────────────────────────────────
# จับคู่ผลการค้นหากับเพลงที่ต้องการ
# ทำไม: อันดับ 1 ของ YouTube Music ไม่ได้เป็นเพลงที่ต้องการเสมอ (อาจเป็น cover / เพลงชื่อซ้ำ)
#        จึงให้คะแนนความคล้ายของชื่อเพลงและชื่อศิลปินแล้วเลือกอันที่ตรงที่สุด
# ─────────────────────────────────────────────
def _norm(text):
    # เก็บเฉพาะ ไทย/อังกฤษ/ตัวเลข (ช่วง ฀-๿ รวมสระและวรรณยุกต์)
    return re.sub(r"[^0-9a-z฀-๿]+", "", text.lower())


def _base_title(title):
    """ตัด (Official Audio) / [Remastered] / " - Live" ท้ายชื่อออก"""
    title = re.sub(r"[\(\[].*?[\)\]]", "", title)
    return re.split(r"\s[-–]\s", title)[0]


def _similar(a, b):
    a, b = _norm(a), _norm(b)
    if not a or not b:
        return 0.0
    if a in b or b in a:
        return 1.0
    return SequenceMatcher(None, a, b).ratio()


def _best_match(song_name, artist, results):
    """ชื่อเพลงเป็นเงื่อนไขบังคับ ส่วนชื่อศิลปินใช้จัดอันดับเมื่อมีหลายเพลงชื่อซ้ำกัน
    (ไม่บังคับศิลปิน เพราะบางครั้งฝั่งหนึ่งเป็นชื่อไทย อีกฝั่งเป็นชื่ออังกฤษ)
    score: ~1.0 = ชื่อเพลงและศิลปินตรง, ~0.6 = ตรงแค่ชื่อเพลง"""
    best, best_score = {"url": None}, 0.0
    for r in results:
        title_sim = _similar(_base_title(song_name), _base_title(r["title"]))
        if not r.get("videoId") or title_sim < MIN_TITLE:
            continue
        artists = [a["name"] for a in r.get("artists", [])]
        artist_sim = max((_similar(artist, a) for a in artists), default=0.0)
        score = 0.6 * title_sim + 0.4 * artist_sim
        if score > best_score:
            best_score = score
            best = {
                "url": f"https://music.youtube.com/watch?v={r['videoId']}",
                "title": r["title"],
                "artist": ", ".join(artists),
                "score": round(score, 3),
            }
    return best


def get_links(song_name, artist):
    """คืน {"url", "title", "artist", "score"} และแสดง url ใน terminal ด้วย
    ถ้าไม่เจอ url เป็น None ถ้าค้นหาพัง (เช่น เน็ตหลุด) มี "error" บอกสาเหตุ"""
    try:
        results = _ytmusic.search(f"{song_name} {artist}", filter="songs", limit=10)
        result = _best_match(song_name, artist, results)
    except Exception as e:
        result = {"url": None, "error": str(e)}

    print(f"{song_name} - {artist}")
    if result["url"]:
        print(f"  {result['url']}  ({result['title']} | {result['artist']} | score {result['score']})")
    else:
        print(f"  ไม่พบเพลงนี้ {result.get('error', '')}".rstrip())
    return result


if __name__ == "__main__":
    if len(sys.argv) >= 3:
        song, singer = sys.argv[1], sys.argv[2]
    else:
        song, singer = input("ชื่อเพลง : ").strip(), input("ศิลปิน : ").strip()
    get_links(song, singer)
