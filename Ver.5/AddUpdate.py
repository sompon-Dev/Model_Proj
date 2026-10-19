"""
AddUpdate.py
ดึงเพลงทั้งหมดที่อยู่ในตาราง Train_Song ของฐานข้อมูล มาบันทึกเป็นไฟล์ update_dataset.csv
แล้วลบข้อมูลทั้งหมดในตาราง Train_Song ทิ้ง (เคลียร์ตารางให้พร้อมรับเพลงใหม่รอบถัดไป เพราะ
เพลงที่ดึงออกมาแล้วถูกสำรองไว้ในไฟล์ CSV แล้ว ไม่จำเป็นต้องเก็บซ้ำไว้ในตารางนี้ต่อ)
ไว้ใช้เป็นข้อมูลตั้งต้นตอนจะอัปเดต index ของโมเดล (Ver.5) ด้วยเพลงที่เพิ่งถูกเพิ่มเข้าระบบ

คอลัมน์ output: newsong_name, newsong_artist, newsong_lyrics (ตรงกับชื่อคอลัมน์จริงในตาราง Train_Song)

ใช้: python AddUpdate.py
"""
import csv
import sys
from pathlib import Path

# บนเครื่อง Windows ที่ locale เป็นไทย terminal มักใช้ codepage cp874 ซึ่งพิมพ์ตัวอักษรบางตัว
# (เช่น ✓) ไม่ได้ ถ้าไม่ตั้งค่านี้ก่อน print() ที่มีตัวอักษรนี้จะ error (UnicodeEncodeError)
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent.parent / "Backend_Database"))
from main import get_connection  # noqa: E402  (ใช้ DB_CONFIG/.env เดียวกับ main.py)

BASE_PATH   = Path(__file__).parent
OUTPUT_FILE = BASE_PATH / "update_dataset.csv"
FIELDNAMES  = ["newsong_name", "newsong_artist", "newsong_lyrics"]


def fetch_train_songs():
    """ดึงทุกแถวจากตาราง Train_Song คืนเป็น list ของ dict ที่มี key ตรงกับ FIELDNAMES"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT newsong_name, newsong_artist, newsong_lyrics FROM "Train_Song"')
    rows = cursor.fetchall()   # แต่ละแถวเป็น tuple (newsong_name, newsong_artist, newsong_lyrics) เพราะใช้ cursor ธรรมดา ไม่ใช่ RealDictCursor
    conn.close()
    return [dict(zip(FIELDNAMES, row)) for row in rows]   # zip จับคู่ชื่อคอลัมน์กับค่าในแต่ละ tuple ให้เป็น dict


def clear_train_songs():
    """ลบข้อมูลทั้งหมดในตาราง Train_Song ทิ้ง (เรียกหลังจากสำรองข้อมูลลง CSV แล้วเท่านั้น)"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM "Train_Song"')
    deleted_count = cursor.rowcount   # rowcount บอกจำนวนแถวที่ DELETE ไปจริง
    conn.commit()
    conn.close()
    return deleted_count


def main():
    print("ดึงข้อมูลจากตาราง Train_Song...")
    songs = fetch_train_songs()
    print(f"  พบ {len(songs)} เพลง")

    with open(OUTPUT_FILE, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(songs)

    print(f"✓ บันทึก {OUTPUT_FILE} ({len(songs)} แถว)")

    print("ลบข้อมูลทั้งหมดในตาราง Train_Song...")
    deleted_count = clear_train_songs()
    print(f"✓ ลบไปแล้ว {deleted_count} แถว (ตาราง Train_Song ว่างแล้ว)")


if __name__ == "__main__":
    main()
