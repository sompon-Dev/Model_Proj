"""
GenreITunes.py
หา genre จาก iTunes Search API (ของ Apple) — ฟรี ไม่ต้องสมัคร ไม่ต้องมี key ไม่มีเงื่อนไข Premium

ต่างจาก Genre.py (Last.fm) ตรงที่ iTunes ให้ genre เป็นหมวดมาตรฐานตายตัว (Pop, Rock, Hip-Hop/Rap,
Dance, Country, R&B/Soul, ...) ไม่ใช่ tag อิสระที่ผู้ใช้ติดกันเอง — เหมาะเป็นตัวสำรองตอนที่ Last.fm
หา genre ไม่เจอ โดยเฉพาะเพลงดัง/เพลงค่ายใหญ่ที่มักมีอยู่ใน Apple Music/iTunes catalog

ใช้ในโค้ด:  from GenreITunes import get_genre_itunes
            get_genre_itunes("พบกันใหม่", artist="Polycat")
ใช้ใน terminal:  python GenreITunes.py "ชื่อเพลง" ["ศิลปิน"]
"""
import re
import sys
from difflib import SequenceMatcher

import requests

API_URL   = "https://itunes.apple.com/search"
MIN_TITLE = 0.6   # ชื่อเพลงต้องคล้ายอย่างน้อยเท่านี้ (0-1) ไม่งั้นถือว่าไม่เจอ


def _norm(text):
    return re.sub(r"[^0-9a-z฀-๿]+", "", text.lower())


def _base_title(title):
    """ตัด (feat. ...) / [Remastered] / " - Live" ท้ายชื่อออก"""
    title = re.sub(r"[\(\[].*?[\)\]]", "", title)
    return re.split(r"\s[-–]\s", title)[0]


def _similar(a, b):
    a, b = _norm(a), _norm(b)
    if not a or not b:
        return 0.0
    if a in b or b in a:
        return 1.0
    return SequenceMatcher(None, a, b).ratio()


def _pick_track(results, song_name, artist):
    best, best_score = None, 0.0
    for item in results:
        title_sim = _similar(_base_title(song_name), _base_title(item.get("trackName") or ""))
        if title_sim < MIN_TITLE:
            continue
        artist_sim = _similar(artist, item.get("artistName") or "") if artist else 0.0
        score = (0.6 * title_sim + 0.4 * artist_sim) if artist else title_sim
        if score > best_score:
            best_score = score
            best = {
                "genre": item.get("primaryGenreName"),
                "matched_song": item.get("trackName"),
                "matched_artist": item.get("artistName"),
                "score": round(score, 3),
            }
    return best


def get_genre_itunes(song_name, artist=None):
    """คืน {"genre", "matched_song", "matched_artist", "score"} ถ้าไม่เจอ genre เป็น None
    พร้อม "note"/"error" อธิบายสาเหตุ — และพิมพ์ผลลง terminal ด้วย"""
    try:
        q = f"{song_name} {artist}" if artist else song_name
        r = requests.get(API_URL, params={"term": q, "media": "music", "entity": "song", "limit": 10}, timeout=10)
        r.raise_for_status()
        results = r.json().get("results", [])
    except Exception as e:
        result = {"genre": None, "matched_song": None, "matched_artist": None, "error": str(e)}
        _print_result(song_name, artist, result)
        return result

    best = _pick_track(results, song_name, artist)
    if not best:
        result = {"genre": None, "matched_song": None, "matched_artist": None, "note": "ไม่เจอเพลงนี้ใน iTunes"}
    else:
        result = best
        if not result["genre"]:
            result["note"] = "เจอเพลง/ศิลปินแล้ว แต่ iTunes ไม่มีข้อมูล genre ให้"
    _print_result(song_name, artist, result)
    return result


def _print_result(song_name, artist, result):
    print(f"{song_name} - {artist}" if artist else song_name)
    if result.get("genre"):
        print(f"  genre: {result['genre']}")
    else:
        print(f"  ไม่พบ genre  ({result.get('note') or result.get('error', '')})")
    if result.get("matched_song"):
        print(f"  (จับคู่กับเพลง: {result['matched_song']} - {result['matched_artist']})")


if __name__ == "__main__":
    if len(sys.argv) >= 2:
        song, singer = sys.argv[1], (sys.argv[2] if len(sys.argv) >= 3 else None)
    else:
        song = input("ชื่อเพลง : ").strip()
        singer = input("ศิลปิน (เว้นว่างได้) : ").strip() or None
    get_genre_itunes(song, singer)
