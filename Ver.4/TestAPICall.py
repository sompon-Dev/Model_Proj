import requests

# ต้องรัน API.py ไว้ก่อน (python API.py)
URL = "http://localhost:8002/search"

# Input ที่ส่งไป
text = "เธอก็ไม่เหลียวมอง"
print("Input :", text)

# ส่ง Request แล้วรับ Output กลับมา
response = requests.post(URL, json={"text": text})
response_output = str(response.json())
print("Output:",response_output)
