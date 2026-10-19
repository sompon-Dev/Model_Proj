import requests

# ต้องรัน API.py ไว้ก่อน (python API.py)
URL = "http://localhost:8002/search"

# Input ที่ส่งไป
text = "เธอก็ไม่เหลียวมอง"
print("Input :", text)

# ส่ง Request แล้วรับ Output กลับมา
# requests.post(..., json={...}) ใส่ header/encode เป็น JSON ให้เองอัตโนมัติ ไม่ต้องทำมือ
response = requests.post(URL, json={"text": text})
response_output = str(response.json())  # .json() แปลง response (ตัวอักษร JSON ดิบ) กลับเป็น dict/list ของ Python ให้เอง
print("Output:",response_output)
