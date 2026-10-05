from pathlib import Path
from textproc import clean_text, tokenize_text

# ─────────────────────────────────────────────
# กำหนด path input และ output แบบคงที่
# ─────────────────────────────────────────────
BASE_PATH   = Path(__file__).parent        # folder ที่ Clean.py อยู่
INPUT_PATH  = BASE_PATH / "Dataset"        # folder Dataset ข้างๆ Clean.py
OUTPUT_PATH = BASE_PATH / "CleanedData"    # folder CleanedData ข้างๆ Clean.py


def process_file(input_file, output_file):
    """
    อ่านไฟล์ → clean → tokenize → บันทึก
    ทำทีละบรรทัด เพื่อรักษาโครงสร้างเนื้อเพลง (แต่ละบรรทัด = 1 วรรคของเพลง)
    Ver.4 ใช้โครงสร้างบรรทัดนี้แบ่ง chunk ตอนสร้าง index
    """
    # อ่านไฟล์ รองรับหลาย encoding เพราะไฟล์ไทยบางไฟล์ไม่ได้ใช้ utf-8
    for encoding in ("utf-8-sig", "utf-8", "tis-620", "cp874"):
        try:
            lines = input_file.read_text(encoding=encoding).splitlines()
            break
        except (UnicodeDecodeError, LookupError):
            continue
    else:
        print(f"  [!] อ่านไม่ได้: {input_file.name}")
        return

    result = []
    for line in lines:
        line = clean_text(line)
        if not line:                  # ข้ามบรรทัดว่าง
            continue
        line = tokenize_text(line)
        if line:
            result.append(line)

    # สร้าง folder ปลายทางถ้ายังไม่มี แล้วบันทึก
    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text("\n".join(result), encoding="utf-8")
    print(f"  ✓ {input_file.name}")


if __name__ == "__main__":
    print("เริ่มทำความสะอาดข้อมูล...\n")

    for artist_folder in sorted(INPUT_PATH.iterdir()):
        if not artist_folder.is_dir():
            continue

        print(f"[{artist_folder.name}]")

        for txt_file in sorted(artist_folder.glob("*.txt")):
            out_file = OUTPUT_PATH / artist_folder.name / txt_file.name
            process_file(txt_file, out_file)

        print()

    print(f"เสร็จแล้ว! ดูผลลัพธ์ได้ที่: {OUTPUT_PATH}")
