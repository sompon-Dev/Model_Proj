"""
หาแนวเพลง (genre/tag) จากชื่อเพลง (Last.fm API)

ทำไมเลือก Last.fm แทน Spotify: Spotify Web API ตอนนี้บังคับให้บัญชีเจ้าของแอปต้องมี
Premium ถึงจะเรียกได้ (แม้แต่ endpoint ค้นหาเพลงสาธารณะ) ส่วน Last.fm สมัคร API key
ได้ฟรีทันที ไม่ต้องจ่ายเงิน ไม่ต้อง OAuth

ข้อควรรู้: Last.fm ไม่มี genre มาตรฐานตายตัวแบบ Spotify สิ่งที่ได้คือ "tag" ที่ผู้ใช้
Last.fm ช่วยกันติดให้เพลง/ศิลปินนั้น (crowd-sourced) ส่วนใหญ่เป็นแนวเพลงจริง
(เช่น rock, pop, thai) แต่บางครั้งก็มี tag ที่ไม่ใช่แนวเพลงปนมา (เช่น "beautiful",
"2016") โค้ดนี้คืน tag ที่มีคนติดเยอะที่สุด 5 อันดับแรก เรียงตามความถี่ ไม่ได้กรอง
ว่าอันไหน "ใช่แนวเพลง" จริงๆ เพราะไม่มีรายการแนวเพลงมาตรฐานให้เทียบ

ใช้ในโค้ด:  from Genre import get_genre
            get_genre("หวั่นไหว")                    # แค่ชื่อเพลง (อาจกำกวมถ้ามีหลายเพลงชื่อซ้ำ)
            get_genre("หวั่นไหว", artist="Bodyslam")  # ใส่ศิลปินด้วย แม่นกว่า
ใช้ใน terminal:  python Genre.py "ชื่อเพลง" ["ศิลปิน"]   (ไม่ใส่ artist ก็ได้ จะถามให้พิมพ์)
"""
import json
import os
import sys
from pathlib import Path

import requests

API_URL  = "https://ws.audioscrobbler.com/2.0/"
TOP_N    = 5    # เอา tag ที่มีคนติดเยอะสุดกี่อันดับ


def _load_env():
    """อ่านค่าจากไฟล์ .env ข้างๆ ไฟล์นี้ (ถ้ามี) เช่น LASTFM_API_KEY=xxxx"""
    env_file = Path(__file__).parent / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


_load_env()


def _api_key():
    key = os.environ.get("LASTFM_API_KEY")
    if not key:
        raise RuntimeError("ไม่พบ LASTFM_API_KEY (ใส่ในไฟล์ .env ดู .env.example)")
    return key


def _call(method, **params):
    """เรียก Last.fm API แล้วคืน dict ที่ parse จาก JSON แล้ว — โยน error ถ้า Last.fm ตอบ error กลับมา"""
    r = requests.get(
        API_URL,
        params={"method": method, "api_key": _api_key(), "format": "json", **params},
        timeout=10,
    )
    r.raise_for_status()
    data = r.json()
    if "error" in data:
        raise RuntimeError(f"Last.fm error {data['error']}: {data.get('message')}")
    return data


def _as_list(x):
    """Last.fm คืน dict เดี่ยวแทน list เวลามีผลลัพธ์แค่ 1 ตัว (ความประหลาดของ API นี้) ฟังก์ชันนี้ทำให้เป็น list เสมอ"""
    if x is None:
        return []
    return x if isinstance(x, list) else [x]


def _search_track(song_name):
    """ไม่รู้ศิลปิน: ค้นหาแล้วเอาผลลัพธ์แรก (Last.fm เรียงตามความเกี่ยวข้อง/ความดังให้แล้ว)"""
    data = _call("track.search", track=song_name, limit=1)
    matches = _as_list(data["results"]["trackmatches"].get("track"))
    return matches[0] if matches else None


def _track_tags(song_name, artist):
    """ดึง tag ระดับ "เพลง" — autocorrect=1 ให้ Last.fm ช่วยแก้ชื่อเพลง/ศิลปินที่สะกดเพี้ยนเล็กน้อยให้เอง"""
    data = _call("track.getInfo", track=song_name, artist=artist, autocorrect=1)
    track = data["track"]
    tags = _as_list(track.get("toptags", {}).get("tag"))
    matched_artist = track["artist"]["name"]
    matched_song = track["name"]
    return tags, matched_song, matched_artist


def _artist_tags(artist):
    """ดึง tag ระดับ "ศิลปิน" ใช้ตอน tag ระดับเพลงไม่มี (มักกว้างกว่าและเป็นแนวเพลงมากกว่า)"""
    data = _call("artist.getTopTags", artist=artist, autocorrect=1)
    return _as_list(data["toptags"].get("tag"))


def get_genre(song_name, artist=None):
    """คืน {"genres": [...], "matched_song", "matched_artist"} ถ้าไม่เจอเพลง/ไม่มี tag เลย
    "genres" จะเป็น [] พร้อม "note"/"error" อธิบายสาเหตุ — และพิมพ์ผลลง terminal ด้วย"""
    try:
        if not artist:
            found = _search_track(song_name)
            if not found:
                result = {"genres": [], "matched_song": None, "matched_artist": None, "note": "ไม่เจอเพลงนี้ใน Last.fm"}
                _print_result(song_name, artist, result)
                return result
            artist = found["artist"]

        tags, matched_song, matched_artist = _track_tags(song_name, artist)
        if not tags:
            tags = _artist_tags(matched_artist)  # tag ระดับเพลงไม่มี ลองระดับศิลปินแทน
    except Exception as e:
        result = {"genres": [], "matched_song": None, "matched_artist": None, "error": str(e)}
        _print_result(song_name, artist, result)
        return result

    tags_sorted = sorted(tags, key=lambda t: int(t.get("count", 0)), reverse=True)[:TOP_N]
    result = {
        "genres": [t["name"] for t in tags_sorted],
        "matched_song": matched_song,
        "matched_artist": matched_artist,
    }
    if not result["genres"]:
        result["note"] = "เจอเพลง/ศิลปินแล้ว แต่ Last.fm ไม่มีใครติด tag ไว้เลย (พบได้กับศิลปิน/เพลงที่ไม่ค่อยมีคนฟังบน Last.fm)"
    _print_result(song_name, artist, result)
    return result


def _print_result(song_name, artist, result):
    print(f"{song_name} - {artist}" if artist else song_name)
    if result["genres"]:
        print(f"  genre/tag: {', '.join(result['genres'])}")
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
    get_genre(song, singer)
