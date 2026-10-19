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
    # "฀-๿" คือช่วงอักขระ Unicode ของตัวอักษรไทยทั้งหมด (U+0E00-U+0E7F)
    # [^...] หมายถึง "ลบทุกตัวอักษรที่ไม่อยู่ในชุดนี้" ดังนั้นเหลือแค่ เลข/a-z/ไทย ล้างช่องว่าง เครื่องหมายวรรคตอนออกให้หมด
    # ก่อนเทียบความคล้าย (กันกรณีตัวพิมพ์เล็ก-ใหญ่ หรือเครื่องหมายต่างกันทำให้คิดว่าไม่เหมือนกันทั้งที่จริงๆคือเพลงเดียวกัน)
    return re.sub(r"[^0-9a-z฀-๿]+", "", text.lower())


def _base_title(title):
    """ตัด (feat. ...) / [Remastered] / " - Live" ท้ายชื่อออก"""
    title = re.sub(r"[\(\[].*?[\)\]]", "", title)  # [\(\[].*?[\)\]] จับข้อความในวงเล็บกลม/เหลี่ยมทั้งก้อน (.*? คือ non-greedy จับให้สั้นที่สุด ไม่ลากยาวเกินคู่ปิดแรกที่เจอ) แล้วลบทิ้ง
    return re.split(r"\s[-–]\s", title)[0]  # แยกด้วย " - " หรือ " – " (ขีดกลาง en-dash) ที่มีเว้นวรรคคั่นทั้งสองข้าง แล้วเอาส่วนก่อนขีดอันแรก (ตัดคำท้ายแบบ "เพลง - Live" ทิ้ง)


def _similar(a, b):
    """วัดความคล้ายของสตริง 2 อัน คืนค่า 0.0-1.0 (1.0 = เหมือนกันเป๊ะ/อันหนึ่งเป็นส่วนหนึ่งของอีกอัน)"""
    a, b = _norm(a), _norm(b)
    if not a or not b:
        return 0.0
    if a in b or b in a:   # ลัดขั้นตอน: ถ้าอันหนึ่งเป็นส่วนย่อยของอีกอันเลย (เช่นชื่อสั้นกว่าแต่ตรงทั้งหมด) ถือว่าเหมือนกันเต็ม ไม่ต้องคำนวณละเอียดเพิ่ม
        return 1.0
    return SequenceMatcher(None, a, b).ratio()  # SequenceMatcher เทียบความคล้ายของสตริงแบบละเอียด (หาส่วนที่เหมือนกันยาวที่สุดแล้ววัดสัดส่วน) ใช้ตอนไม่เหมือนกันเป๊ะแต่คล้ายกันบางส่วน


def _pick_track(results, song_name, artist):
    """วนดูผลลัพธ์ทั้งหมดที่ iTunes ส่งมา แล้วเลือกอันที่คะแนนความคล้ายสูงสุด (running max: เก็บค่าที่ดีที่สุด
    ที่เจอไว้ใน best/best_score แล้วอัปเดตทุกครั้งที่เจอตัวที่ดีกว่า)"""
    best, best_score = None, 0.0
    for item in results:
        title_sim = _similar(_base_title(song_name), _base_title(item.get("trackName") or ""))
        if title_sim < MIN_TITLE:
            continue
        artist_sim = _similar(artist, item.get("artistName") or "") if artist else 0.0
        # ถ้ามีชื่อศิลปินให้เทียบด้วย ถ่วงน้ำหนักชื่อเพลง 60% + ศิลปิน 40% ถ้าไม่มีศิลปินให้เทียบ ใช้ความคล้ายชื่อเพลงล้วนๆ
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
