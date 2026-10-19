"""
ลบข้อมูลทั้งหมด (sample/test data) ในทุกตาราง โดยเรียก function จาก main.py ตรงๆ
(import ฟังก์ชัน delete_all_* ของ FastAPI endpoint มาเรียกแบบฟังก์ชัน Python ธรรมดา ไม่ได้ยิง HTTP
ผ่าน uvicorn เลย — เรียกได้เพราะฟังก์ชันพวกนี้ก็เป็นฟังก์ชันปกติ แค่มี @app.delete(...) ประดับไว้)
รัน: python testDeleteAll.py

ลำดับการลบสำคัญ เพราะมี foreign key:
Genre_Song, Mood_Song ต้องลบก่อน Song / Genre / Mood ที่มันอ้างถึง

คำเตือน: สคริปต์นี้ลบข้อมูลทุกตารางจริง ไม่มีถามยืนยันก่อนลบ รันแล้วลบทันที
"""

from main import (
    delete_all_users,
    delete_all_Train_Song,
    delete_all_Song,
    delete_all_Genre,
    delete_all_Genre_Song,
    delete_all_Mood,
    delete_all_Mood_Song,
)


if __name__ == "__main__":
    for name, delete_func in [
        ("Genre_Song", delete_all_Genre_Song),
        ("Mood_Song", delete_all_Mood_Song),
        ("Song", delete_all_Song),
        ("Genre", delete_all_Genre),
        ("Mood", delete_all_Mood),
        ("Train_Song", delete_all_Train_Song),
        ("User", delete_all_users),
    ]:
        try:
            result = delete_func()
            print(f"[{name}] ลบข้อมูลทั้งหมดสำเร็จ:", result)
        except Exception as e:
            print(f"[{name}] delete FAILED: {e!r}")  # {e!r} ใน f-string ใช้ repr() ของ error (รายละเอียดดิบ) แทน str() (ข้อความสั้นอ่านง่าย)

# Run โดย python testDeleteAll.py
