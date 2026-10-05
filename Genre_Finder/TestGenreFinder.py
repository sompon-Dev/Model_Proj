"""
TestGenreFinder.py
ทดสอบว่า get_genre() คืนแนวเพลงที่สมเหตุสมผลหรือไม่ (ต้องดูผลด้วยตาเอง เพราะไม่มี genre
ที่ถูกต้อง 100% ให้เทียบ — Last.fm ไม่มี genre มาตรฐานตายตัว เป็น tag ที่คนช่วยกันติด)
ต้องตั้งค่า .env ก่อน (ดู .env.example) แล้วกด Run ได้เลย
"""
from Genre import get_genre

# ตัวอย่างเพลงจริงจาก dataset (Ver.4) มีทั้งชื่อเพลง+ศิลปินให้เทียบว่าจับเพลงถูกเพลงไหม
SAMPLE_SONGS = [
    ("หวั่นไหว", "Bodyslam"),
    ("เพลงนี้เกี่ยวกับความรัก", "Silly Fools"),
    ("Cinderella", "แทททูคัลเลอร์"),
    ("ฝนตกไหม", "Three Man Down"),
    ("ไม่ค่อยเต็ม", "Big Ass"),
]

print("=== ทดสอบแบบใส่ชื่อเพลง + ศิลปิน ===\n")
for song, artist in SAMPLE_SONGS:
    get_genre(song, artist)
    print()

print("=== ทดสอบแบบใส่แค่ชื่อเพลง (ไม่บอกศิลปิน ให้ระบบเดาเอง) ===\n")
for song, _artist in SAMPLE_SONGS:
    get_genre(song)
    print()
