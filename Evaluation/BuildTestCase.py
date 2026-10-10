"""
BuildTestCase.py
สร้าง TestCase.csv — 1 แถวต่อ 1 เพลง (ทุกเพลงที่อยู่ใน DatasetInput เท่ากับจำนวนเพลงที่
Ver.5 มี) แต่ละแถวมีเนื้อเพลงท่อนเดียวกัน ตัดสั้นลงเรื่อยๆ จาก 10 คำ เหลือ 1 คำ เอาไว้ทดสอบ
ว่าพิมพ์คำค้นสั้นแค่ไหนระบบยังหาเพลงเจอ

วิธีทำ: สุ่มจุดเริ่มต้น 1 จุดในเนื้อเพลงที่ตัดคำแล้ว หยิบมา 10 คำติดกัน แล้ว "ตัดหางออกทีละคำ"
จาก 10 คำชุดเดิม (ไม่ใช่สุ่มใหม่ทุกคอลัมน์) เพื่อให้เห็นภาพตรงๆ ว่ายิ่งพิมพ์สั้นลงเรื่อยๆ จากจุด
เดิม ระบบยังหาเจอไหม — คำในแต่ละคอลัมน์ต่อกันไม่มีเว้นวรรค เหมือนคนพิมพ์จริงในแอป (ตาม
convention เดียวกับ Ver.4/Ver.5 Evaluate.py)

หมายเหตุ: เพิ่มคอลัมน์ "artist" นอกเหนือจากที่ขอ เพราะเช็กแล้วมีชื่อเพลงซ้ำกันข้ามศิลปิน 602 ชื่อ
ในชุดข้อมูลนี้ (เช่น "ใจร้าย" มี 3 เพลงคนละศิลปิน) ถ้าเก็บแค่ชื่อเพลงอย่างเดียว ตอนเอาไปเทียบผล
การค้นหาทีหลังจะไม่รู้ว่า "ใช่เพลงที่ถูกเลือกมาจริงไหม"

ขั้นนี้แค่เตรียมไฟล์ ยังไม่ได้เอาไปรันกับ Search.py ตามที่สั่ง
"""
import csv
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "Ver.4"))
from textproc import preprocess

BASE_PATH     = Path(__file__).parent
DATASET_INPUT = BASE_PATH.parent / "DatasetInput"
NEW_SONG_FILES = ["songs_enriched.csv", "famous_with_genre.csv"]   # ชุดเดียวกับที่ Ver.5/Buildindex.py ใช้เป็น "เพลงใหม่"

OUT_ALL  = BASE_PATH / "TestCase.csv"
OUT_V4   = BASE_PATH / "TestCase_1.csv"   # เพลงส่วนน้อย ไว้ทดสอบ Ver.4
OUT_FULL = BASE_PATH / "TestCase_2.csv"   # เพลงทั้งหมด ไว้ทดสอบโมเดลที่มีเพลงครบ (Ver.5)

MAX_WORDS   = 10
V4_SAMPLE_N = 75   # อยู่ในช่วง 70-80 ตามที่ขอ
SEED        = 42

FIELDNAMES = ["Song name", "artist"] + [f"เนื้อเพลง{n}คำ" for n in range(MAX_WORDS, 0, -1)]


def main():
    rng = random.Random(SEED)

    # รวมเพลงใหม่จากทั้ง 2 ไฟล์ ตัดซ้ำด้วย (name, artist) แบบเดียวกับ Ver.5/Buildindex.py
    seen = set()
    songs = []
    for fname in NEW_SONG_FILES:
        with open(DATASET_INPUT / fname, encoding="utf-8-sig", newline="") as f:
            rows = list(csv.DictReader(f))
        added = 0
        for row in rows:
            key = (row["name"], row["artist"])
            if key in seen:
                continue
            seen.add(key)
            songs.append(row)
            added += 1
        print(f"{fname}: {added} เพลงใหม่ (จากทั้งหมด {len(rows)} แถว)")
    print(f"รวมเพลงทั้งหมด (ตัดซ้ำแล้ว): {len(songs)}\n")

    out_rows = []
    too_short = 0
    for row in songs:
        tokens = preprocess(row["lyric"]).split()
        if len(tokens) < MAX_WORDS:
            too_short += 1
            continue
        # สุ่มจุดเริ่ม แต่เลี่ยงไม่ให้คำแรกเป็นตัวอักษรเดี่ยวไร้ความหมาย (เช่น "ๆ" หรือเศษพยัญชนะ
        # จากการตัดคำผิด) เพราะถ้าดันไปเป็นคอลัมน์ "เนื้อเพลง1คำ" จะกลายเป็นคำค้นที่ทดสอบไม่ได้จริง
        for _ in range(20):
            start = rng.randrange(len(tokens) - MAX_WORDS + 1)
            if len(tokens[start]) >= 2:
                break
        window = tokens[start:start + MAX_WORDS]   # 10 คำติดกัน จุดเดียว ใช้ร่วมกันทุกคอลัมน์

        record = {"Song name": row["name"], "artist": row["artist"]}
        for n in range(MAX_WORDS, 0, -1):
            record[f"เนื้อเพลง{n}คำ"] = "".join(window[:n])   # ตัดหางออกทีละคำจากชุดเดิม ไม่เว้นวรรค
        out_rows.append(record)

    print(f"เพลงที่เนื้อเพลงสั้นกว่า {MAX_WORDS} คำ (ข้าม): {too_short}")
    print(f"ได้ test case ทั้งหมด: {len(out_rows)} แถว\n")

    with open(OUT_ALL, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDNAMES)
        w.writeheader()
        w.writerows(out_rows)
    print(f"✓ บันทึก {OUT_ALL} ({len(out_rows)} แถว)")

    with open(OUT_FULL, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDNAMES)
        w.writeheader()
        w.writerows(out_rows)
    print(f"✓ บันทึก {OUT_FULL} ({len(out_rows)} แถว) — เพลงทั้งหมด ไว้ทดสอบโมเดลที่มีเพลงครบ (Ver.5)")

    sample = rng.sample(out_rows, min(V4_SAMPLE_N, len(out_rows)))
    with open(OUT_V4, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDNAMES)
        w.writeheader()
        w.writerows(sample)
    print(f"✓ บันทึก {OUT_V4} ({len(sample)} แถว) — สุ่มมาเทียบกับ 70-80 เพลง ไว้ทดสอบ Ver.4")


if __name__ == "__main__":
    main()
