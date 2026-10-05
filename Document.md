# เอกสารอธิบายโค้ด: `API.py` และ `main.py`

เอกสารนี้อธิบายโค้ดของสองไฟล์ทีละคำสั่ง เขียนให้คนที่ไม่เคยใช้ FastAPI มาก่อนอ่านเข้าใจได้

| ไฟล์ | ที่อยู่ | หน้าที่ | Port |
|---|---|---|---|
| `API.py` | `Ver.3/API.py` | รับข้อความจากแอป แล้วค้นหาเพลงที่เนื้อร้องคล้ายที่สุด | **8002** |
| `main.py` | `Backend_Database/main.py` | จัดการฐานข้อมูล PostgreSQL (เพิ่ม / อ่าน / แก้ไข / ลบ) | **8000** |

---

## 0. ภาพรวมของระบบ

```
                    ┌──────────────────────────┐
                    │  แอปมือถือ (FrontEnd)      │
                    └───────┬──────────┬───────┘
      ค้นหาเพลงจากเนื้อร้อง  │          │  สมัครสมาชิก / จัดการข้อมูล
         POST /search       │          │  POST /users, GET /Song ...
                            ▼          ▼
              ┌────────────────┐   ┌──────────────────────┐
              │ API.py :8002   │   │ main.py :8000        │
              │ (Search.py)    │   │                      │
              └───────┬────────┘   └──────────┬───────────┘
                      │                       │
        ไฟล์ embeddings (.pt, .pkl)     PostgreSQL "LyricSeekDB"
```

**API คืออะไร** คือ "หน้าต่างรับออเดอร์" ของโปรแกรม แอปส่งคำขอ (request) มาที่ URL หนึ่ง โปรแกรมทำงานตามที่ URL นั้นกำหนด แล้วส่งคำตอบ (response) กลับไป

**FastAPI คืออะไร** คือ library ของ Python ที่ช่วยสร้าง API ได้ง่าย ทั้งสองไฟล์ใช้ FastAPI

**Uvicorn คืออะไร** คือโปรแกรมที่เปิด server จริงๆ FastAPI เขียนแค่ "กติกาว่า URL ไหนทำอะไร" ส่วน Uvicorn เป็นคนรับคำขอจากเครือข่ายมาส่งให้ FastAPI

## 0.1 Endpoint คืออะไร

**Endpoint คือ "จุดให้บริการ" หนึ่งจุดของ API** ประกอบด้วยสองอย่างคู่กัน คือ **วิธีส่งคำขอ (method)** และ **ที่อยู่ (URL path)** เมื่อมีคำขอที่ตรงกับคู่นี้เข้ามา โปรแกรมจะทำงานตามที่ผูกไว้กับจุดนั้น

**เปรียบเทียบกับร้านอาหาร**

| ในร้านอาหาร | ใน API |
|---|---|
| ร้านทั้งร้าน | server (`API.py` หรือ `main.py`) |
| เลขที่ร้าน / ถนน | IP และ port เช่น `192.168.1.7:8002` |
| เคาน์เตอร์แต่ละแห่ง เช่น "สั่งอาหาร", "จ่ายเงิน", "ยกเลิกออเดอร์" | **endpoint** แต่ละอัน |
| ลูกค้าไปที่เคาน์เตอร์แล้วบอกสิ่งที่ต้องการ | แอปส่งคำขอพร้อมข้อมูลแนบ |
| พนักงานทำตามหน้าที่ของเคาน์เตอร์นั้น แล้วส่งของหรือใบเสร็จกลับ | ฟังก์ชันที่ผูกกับ endpoint ทำงาน แล้วตอบ JSON กลับมา |

### ส่วนประกอบของ endpoint

ยกตัวอย่างที่แอปเรียกจริงใน `Homeuser.js`: `POST http://192.168.1.7:8002/search`

```
POST   http://192.168.1.7 : 8002 /search
  │           │             │      │
  │           │             │      └─ path: ชื่อจุดให้บริการ ("เคาน์เตอร์ไหน")
  │           │             └──────── port: ช่องทางที่ server ฟังอยู่
  │           └────────────────────── host: เครื่องที่รัน server
  └────────────────────────────────── method: วิธีส่งคำขอ ("จะทำอะไร")
```

| ส่วน | ความหมาย |
|---|---|
| **method** | บอกว่าจะทำอะไร: `GET` อ่าน, `POST` เพิ่ม (หรือส่งข้อมูลให้ประมวลผล), `PUT` แก้ไข, `DELETE` ลบ |
| **path** | ชื่อจุดให้บริการ เช่น `/search`, `/users`, `/Song/5` |
| **ข้อมูลแนบ (body)** | ข้อมูลที่ส่งไปด้วยตอน POST/PUT เช่น `{"text": "คิดถึงเธอ"}` |
| **path parameter** | ค่าที่ฝังอยู่ใน path เช่น เลข `5` ใน `/Song/5` ตรงกับ `{song_id}` ในโค้ด |

**จุดสำคัญ:** endpoint ถูกกำหนดด้วย **method + path ทั้งคู่** URL เดียวกันแต่ method ต่างกัน ถือเป็นคนละ endpoint และทำงานต่างกัน เช่น

| Method | Path | ทำอะไร |
|---|---|---|
| `GET` | `/users` | อ่านผู้ใช้ทั้งหมด |
| `POST` | `/users` | สมัครสมาชิกใหม่ |

### ใน 2 ไฟล์นี้เขียน endpoint อย่างไร

ใน FastAPI ประกาศ endpoint ด้วย **decorator** (บรรทัดที่ขึ้นต้นด้วย `@app.`) แล้วตามด้วยฟังก์ชันที่ทำงานจริง

```python
@app.post("/search")              # ← ประกาศ endpoint:  method = POST,  path = /search
def run_search(payload: QueryRequest):   # ← ฟังก์ชันที่จะถูกเรียกเมื่อมีคำขอตรงกับ endpoint นี้
    ...
    return {"status": "success", "results": results}   # ← สิ่งที่ตอบกลับไปหาแอป
```

- `@app.post(...)`, `@app.get(...)`, `@app.put(...)`, `@app.delete(...)` คือการเลือก method
- ข้อความในวงเล็บคือ path
- ชื่อฟังก์ชัน (เช่น `run_search`) ตั้งอะไรก็ได้ ไม่มีผลกับ URL ที่แอปเรียก

**จำนวน endpoint ในแต่ละไฟล์**

| ไฟล์ | จำนวน | รายละเอียด |
|---|---|---|
| `API.py` | 1 | `POST /search` |
| `main.py` | 43 | มีบรรทัด `@app.` ทั้งหมด 45 บรรทัด แต่ `POST /Train_Song` และ `POST /Song` ถูกประกาศซ้ำอย่างละ 2 ครั้ง (ดูส่วนที่ 3 ข้อ 5) จึงนับเป็น endpoint จริง 43 อัน |

รายการ endpoint ของ `main.py` ทั้งหมดอยู่ในหัวข้อ 2.7

### ดูรายการ endpoint ทั้งหมดได้ที่ไหน

FastAPI สร้างหน้ารายการให้อัตโนมัติ เปิดในเบราว์เซอร์ได้เลยตอน server ทำงานอยู่:

- `http://localhost:8002/docs` สำหรับ `API.py`
- `http://localhost:8000/docs` สำหรับ `main.py`

หน้านี้แสดงทุก endpoint (method + path) บอกว่าต้องส่งข้อมูลอะไร และมีปุ่ม **Try it out** ให้ทดลองเรียกได้ทันที ไม่ต้องเขียนโค้ดหรือเปิดแอป

---

## 0.2 Flowchart: ตอนสั่ง `python Start.py`

วิธีอ่าน: อ่านจากบนลงล่าง `▼` คือขั้นตอนถัดไป, `?` คือจุดที่ต้องตัดสินใจ แล้วแตกเป็นทางเลือก (`├─`, `└─`)

```
python Start.py
   │
   │  (สองคำสั่งนี้ "สั่งเปิด" แล้วไปต่อทันที ไม่รอให้เสร็จ
   │   ทั้งสอง server จึงเริ่มทำงานพร้อมกัน)
   │
   ├──► เปิดหน้าต่าง cmd ที่ 1  (โฟลเดอร์ Ver.3)
   │        └─► uvicorn API:app --port 8002
   │              └─► โหลดโมเดล + ไฟล์ embeddings  ← ใช้เวลานานกว่า server ตัวที่สอง
   │                    └─► พร้อมรับคำขอที่ port 8002
   │
   ├──► เปิดหน้าต่าง cmd ที่ 2  (โฟลเดอร์ Backend_Database)
   │        └─► uvicorn main:app --reload --port 8000
   │              └─► พร้อมรับคำขอที่ port 8000  ← เร็ว
   ▼
Start.py พิมพ์ "Waiting for servers (8002, 8000)..."
   ▼
port 8002 เปิดรับการเชื่อมต่อแล้วหรือยัง?   (ลองต่อทุก 1 วินาที สูงสุด 300 วินาที)
   ├─ ยัง ──► รอต่อ ──► ถ้าครบ 300 วินาทียังไม่เปิด
   │                      └─► พิมพ์ "Server did not start in time, skipped frontend."
   │                          แล้วจบ (ไม่เปิดแอป)
   └─ แล้ว
        ▼
port 8000 เปิดรับการเชื่อมต่อแล้วหรือยัง?   (วิธีเดียวกัน)
   ├─ ยัง ──► รอต่อ ──► หมดเวลา ──► จบเหมือนด้านบน
   └─ แล้ว
        ▼
เปิดหน้าต่าง cmd ที่ 3  (โฟลเดอร์ FrontEnd\Frontend)
   └─► npm run android  ──► แอปเปิดขึ้นบน Android
```

**ทำไมต้องรอ:** แอปเรียก server ทันทีที่เปิด ถ้า `API.py` ยังโหลดโมเดลไม่เสร็จ คำขอแรกจะล้มเหลว จึงให้ `Start.py` รอจน port พร้อมก่อนค่อยเปิดแอป

---

# ส่วนที่ 1: `API.py`

ไฟล์นี้เป็น "ตัวห่อ" ฟังก์ชันค้นหา `search()` ใน `Search.py` ให้เรียกผ่านเครือข่ายได้

## 1.1 คำสั่ง import (บรรทัด 1-4)

```python
import json
from fastapi import FastAPI
from pydantic import BaseModel
from Search import search  # ดึงฟังก์ชันค้นหาเดิมของคุณมาใช้
```

| บรรทัด | ความหมาย |
|---|---|
| `import json` | เรียกใช้โมดูล `json` ของ Python ใช้แปลงข้อมูลเป็นข้อความ JSON สวยๆ ตอนพิมพ์ log |
| `from fastapi import FastAPI` | ดึงคลาส `FastAPI` ซึ่งเป็นตัวหลักของ framework มาใช้ |
| `from pydantic import BaseModel` | ดึง `BaseModel` ซึ่งเป็นแม่แบบสำหรับ "กำหนดหน้าตาของข้อมูลที่รับเข้ามา" |
| `from Search import search` | ดึงฟังก์ชัน `search` จากไฟล์ `Search.py` (อยู่โฟลเดอร์เดียวกัน) มาใช้ |

> **สิ่งที่เกิดตอน `from Search import search`:** Python จะรันไฟล์ `Search.py` ทั้งไฟล์หนึ่งครั้ง ซึ่งจะโหลดไฟล์ `songs_embeddings.pt`, `songs_metadata.pkl` และโหลดโมเดล `intfloat/multilingual-e5-base` ขึ้นมาไว้ในหน่วยความจำ นี่คือเหตุผลที่ `API.py` **ใช้เวลาเริ่มต้นนานกว่า** `main.py` (และเป็นเหตุผลที่ `Start.py` ต้องรอ port 8002 พร้อมก่อนเปิดแอป)

## 1.2 สร้างแอป FastAPI (บรรทัด 6-11)

```python
app = FastAPI(
    title="Music Search Engine API",
    description="API สำหรับค้นหาเพลงด้วย Vector Search (PyTorch)",
    version="1.0"
)
```

- `app = FastAPI(...)` สร้างตัวแอป เก็บไว้ในตัวแปรชื่อ `app` (ชื่อนี้สำคัญ เพราะคำสั่ง `uvicorn API:app` จะเรียกหาตัวแปรนี้)
- `title`, `description`, `version` เป็นแค่ข้อมูลประกอบ จะไปโผล่ในหน้าเอกสารอัตโนมัติที่ `http://localhost:8002/docs` ไม่มีผลต่อการทำงาน

## 1.3 กำหนดรูปแบบข้อมูลที่รับเข้ามา (บรรทัด 13-15)

```python
class QueryRequest(BaseModel):
    text: str
```

- `class QueryRequest(BaseModel)` สร้าง "แบบฟอร์ม" ชื่อ `QueryRequest`
- `text: str` แบบฟอร์มนี้มีช่องเดียวชื่อ `text` และต้องเป็นข้อความ (`str`)

แอปต้องส่งข้อมูลหน้าตาแบบนี้มา:

```json
{ "text": "คิดถึงเธอทุกคืน" }
```

ถ้าส่งมาไม่ตรง เช่น ไม่มี `text` หรือ `text` ไม่ใช่ข้อความ FastAPI จะตอบ error **422** กลับไปเองอัตโนมัติ โดยไม่ต้องเขียนโค้ดตรวจสอบเพิ่ม

## 1.4 Endpoint สำหรับค้นหา (บรรทัด 17-37)

```python
@app.post("/search")
def run_search(payload: QueryRequest):
```

- `@app.post("/search")` เรียกว่า **decorator** แปลว่า "เมื่อมีคำขอแบบ **POST** เข้ามาที่ URL `/search` ให้เรียกฟังก์ชันที่อยู่บรรทัดถัดไป"
  - POST คือวิธีส่งคำขอแบบมีข้อมูลแนบมาด้วย (ต่างจาก GET ที่แค่ขอดูข้อมูล)
- `def run_search(payload: QueryRequest):` สร้างฟังก์ชัน โดย `payload: QueryRequest` บอก FastAPI ว่า "เอาข้อมูลที่แอปส่งมา ใส่ในแบบฟอร์ม `QueryRequest` แล้วส่งให้ฟังก์ชันในชื่อ `payload`"

```python
    query_text = payload.text
```

ดึงข้อความที่แอปส่งมาออกจากช่อง `text` เก็บไว้ในตัวแปร `query_text`

```python
    results = search(query_text)
```

เรียกฟังก์ชัน `search` จาก `Search.py` ส่งข้อความเข้าไปค้นหา ได้ผลลัพธ์เป็นลิสต์ของเพลง 5 อันดับแรกเก็บไว้ใน `results` (ดูหัวข้อ 1.6 ว่าข้างในทำอะไร)

```python
    print("\n==========================================")
    print(f"📩 Received Query from App: '{query_text}'")
    print("------------------------------------------")
    print("📤 Sending Results to Frontend:")
    print(json.dumps(results, indent=2, ensure_ascii=False))
    print("==========================================\n")
```

ส่วนนี้ **พิมพ์ log ออกหน้าต่าง cmd** เพื่อให้เห็นว่ามีอะไรเข้ามาบ้าง (ตรงกับที่ต้องการดูตอนรันผ่าน `Start.py`)

| คำสั่ง | ความหมาย |
|---|---|
| `print("\n====...")` | พิมพ์เส้นคั่น `\n` คือขึ้นบรรทัดใหม่ก่อนพิมพ์ |
| `print(f"...{query_text}...")` | `f"..."` คือ f-string แทรกค่าตัวแปรลงในข้อความ จึงพิมพ์คำค้นที่ได้รับ |
| `json.dumps(results, ...)` | แปลงลิสต์ผลลัพธ์เป็นข้อความ JSON |
| `indent=2` | ย่อหน้า 2 ช่อง ให้อ่านง่าย |
| `ensure_ascii=False` | ถ้าไม่ใส่ ภาษาไทยจะกลายเป็นรหัสอ่านไม่ออก เช่น `เ...` ใส่แล้วจะเห็นภาษาไทยปกติ |

```python
    return {"status": "success", "results": results}
```

ส่งคำตอบกลับไปหาแอป FastAPI แปลง dictionary ของ Python เป็น JSON ให้เอง

### ตัวอย่างการใช้งานจริง

**แอปส่งไป:** `POST http://<IP เครื่อง>:8002/search`

```json
{ "text": "คิดถึงเธอทุกคืน" }
```

**ได้คำตอบกลับ:**

```json
{
  "status": "success",
  "results": [
    { "song_name": "ชื่อเพลง", "artist": "ชื่อศิลปิน", "score": 0.87 },
    ...รวม 5 เพลง
  ]
}
```

## 1.5 ส่วนสั่งรัน server (บรรทัด 39-43)

```python
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
```

| คำสั่ง | ความหมาย |
|---|---|
| `if __name__ == "__main__":` | โค้ดในบล็อกนี้ทำงาน **เฉพาะตอนสั่งรันไฟล์นี้ตรงๆ** (`python API.py`) ถ้าไฟล์อื่น import ไฟล์นี้ไป บล็อกนี้จะไม่ทำงาน |
| `import uvicorn` | เรียกใช้ Uvicorn (import ไว้ในบล็อกนี้เพราะใช้แค่ตรงนี้) |
| `uvicorn.run(app, ...)` | เปิด server ให้ตัวแอป `app` |
| `host="0.0.0.0"` | ให้รับการเชื่อมต่อจาก **ทุกเครื่องในเครือข่าย** (เช่น มือถือที่ต่อ Wi-Fi เดียวกัน) ถ้าใส่ `127.0.0.1` จะรับได้แค่จากเครื่องตัวเอง |
| `port=8002` | เลขช่องทางที่ server ฟังอยู่ ต้องไม่ซ้ำกับโปรแกรมอื่น (ที่เคยขึ้น error `10048` คือ port ซ้ำ) |

### ทำไมต้องเขียนแบบนี้

เขียนแบบนี้เพราะต้องการให้ไฟล์นี้ใช้ได้สองแบบ คือ **รันตรงๆ เพื่อเปิด server** และ **ให้ไฟล์อื่น import ไปใช้โดยไม่เปิด server ขึ้นมาเอง**

**(1) `if __name__ == "__main__":` ทำหน้าที่อะไร**

ทุกครั้งที่ Python รันไฟล์ จะตั้งตัวแปร `__name__` ให้อัตโนมัติ ค่าที่ได้ขึ้นอยู่กับวิธีที่ไฟล์ถูกใช้:

| วิธีที่ไฟล์ถูกใช้ | ค่าของ `__name__` | บล็อก `if` ทำงานไหม |
|---|---|---|
| รันตรงๆ เช่น `python API.py` | `"__main__"` | **ทำงาน** |
| ถูกไฟล์อื่น import เช่น `import API` | `"API"` (ชื่อไฟล์) | **ไม่ทำงาน** |

ถ้าไม่มีบรรทัดนี้ แล้วเขียน `uvicorn.run(...)` ไว้เปล่าๆ ทุกครั้งที่มีไฟล์อื่นหรือ Uvicorn เอง import `API.py` เพื่อดึง `app` ไปใช้ ก็จะเปิด server ซ้อนขึ้นมาอีกตัว และชนกับ port เดิมจนขึ้น error `[Errno 10048]`

**(2) ทำไมต้องมี `uvicorn.run(...)`**

โค้ดด้านบนของไฟล์แค่ "ประกาศ" ว่า URL ไหนทำอะไร ยังไม่ได้เปิด server จริง บรรทัด `uvicorn.run(...)` คือคำสั่งเปิด server จริง จึงต้องมี ถ้าอยากรัน `python API.py` แล้วใช้งานได้ทันที

**(3) ทำไม `import uvicorn` อยู่ข้างในบล็อก**

เป็นแค่แนวปฏิบัติ เพราะใช้ uvicorn ตรงนี้ที่เดียว จึงเรียกใช้เมื่อจำเป็นเท่านั้น จะย้ายไปไว้บนสุดของไฟล์รวมกับ import อื่นก็ทำงานเหมือนกัน

### เกี่ยวข้องกับ `Start.py` อย่างไร

`Start.py` **ไม่ได้รัน** `python API.py` แต่ใช้คำสั่ง `python -m uvicorn API:app --host 0.0.0.0 --port 8002` ซึ่งให้ Uvicorn เป็นคน import ไฟล์ `API.py` แล้วดึง `app` ไปเปิด server เอง

```
รันด้วย Start.py:   Uvicorn import API.py  →  __name__ เป็น "API"      →  บล็อก if ไม่ทำงาน  →  Uvicorn เปิด server เอง
รันด้วย python API.py:  Python รัน API.py ตรงๆ  →  __name__ เป็น "__main__"  →  บล็อก if ทำงาน  →  uvicorn.run(...) เปิด server
```

ผลคือไม่ว่าจะรันวิธีไหน จะมี server เปิดขึ้นมาแค่ตัวเดียว เพราะบรรทัด `if` คอยกันไม่ให้เปิดซ้ำ

ตอนนี้ระบบใช้งานผ่าน `Start.py` ตลอด บล็อกนี้จึงเป็นเพียง **ทางเลือกสำรอง** สำหรับรัน `python API.py` ตอนทดสอบ หรือกดปุ่ม Run ใน IDE ถ้าลบบล็อกนี้ออกก็ไม่กระทบการทำงานของ `Start.py`

## 1.6 ข้างใน `search()` ใน `Search.py` ทำอะไร

`API.py` เรียกฟังก์ชันนี้ จึงสรุปสั้นๆ ไว้ตรงนี้

```python
query_vector = model.encode(query_text, convert_to_tensor=True)
query_vector = torch.nn.functional.normalize(query_vector, p=2, dim=0)
scores = torch.matmul(embeddings_norm, query_vector)
top_scores, top_indices = torch.topk(scores, k=top_k)
```

1. `model.encode(...)` แปลงข้อความเป็น **เวกเตอร์** (ชุดตัวเลข 768 ตัวที่แทน "ความหมาย" ของข้อความ)
2. `normalize(...)` ปรับความยาวเวกเตอร์ให้เท่ากับ 1 เพื่อให้เปรียบเทียบกันได้เป็นธรรม
3. `torch.matmul(...)` คูณเมทริกซ์ เพื่อคำนวณ **Cosine Similarity** กับเนื้อเพลงทุกเพลงในครั้งเดียว ได้คะแนนความคล้ายของแต่ละเพลง
4. `torch.topk(..., k=5)` เลือกเพลงที่คะแนนสูงสุด 5 อันดับ
5. ลูป `for` วนเอาชื่อเพลงและศิลปินจาก `metadata` มาประกอบเป็นผลลัพธ์ พร้อมคะแนน (`score`) ยิ่งใกล้ 1 ยิ่งคล้าย

## 1.7 Flowchart: เมื่อผู้ใช้กดค้นหาเพลง (`API.py`)

```
ผู้ใช้พิมพ์เนื้อร้อง แล้วกดค้นหาในแอป
   ▼
แอปส่ง  POST http://<IP เครื่อง>:8002/search
        ข้อมูลแนบ: {"text": "...", "genres": [...], "moods": [...]}
   ▼
Uvicorn รับคำขอจากเครือข่าย แล้วส่งต่อให้ FastAPI
   ▼
มี endpoint ที่เป็น POST + /search ไหม?
   ├─ ไม่มี ──► ตอบ 404 Not Found (จบ)
   └─ มี  (คือฟังก์ชัน run_search)
        ▼
ข้อมูลแนบตรงกับแบบฟอร์ม QueryRequest ไหม?  (ต้องมีช่อง text เป็นข้อความ)
   ├─ ไม่ตรง ──► ตอบ 422 error (จบ)
   └─ ตรง
        │   (ช่อง genres และ moods ที่แอปส่งมาเกิน จะถูกมองข้าม ไม่มี error
        │    และตอนนี้ยังไม่ได้ถูกนำไปใช้กรองผลลัพธ์)
        ▼
run_search: ดึงข้อความ  query_text = payload.text
        ▼
เรียก search(query_text)  ใน Search.py
        │
        │   ├─ 1. แปลงข้อความเป็นเวกเตอร์ 768 ตัวเลข   (model.encode)
        │   ├─ 2. ปรับความยาวเวกเตอร์ให้เป็น 1          (normalize)
        │   ├─ 3. คำนวณความคล้ายกับ "ทุกเพลง" ในครั้งเดียว (matmul)
        │   ├─ 4. เลือกคะแนนสูงสุด 5 อันดับ              (topk)
        │   └─ 5. ประกอบผลลัพธ์: ชื่อเพลง, ศิลปิน, คะแนน
        ▼
ได้ results (ลิสต์ 5 เพลง)
        ▼
print log ออกหน้าต่าง cmd ของ API  (เห็นว่าคำค้นอะไรเข้ามา และส่งอะไรกลับ)
        ▼
return {"status": "success", "results": [...]}
        ▼
FastAPI แปลงเป็น JSON แล้วส่งกลับผ่าน Uvicorn
        ▼
แอปได้รับผล ──► เก็บใน setResults(...) ──► แสดงรายการเพลงบนหน้าจอ
```

---

# ส่วนที่ 2: `main.py`

ไฟล์นี้เป็น API ที่ต่อกับฐานข้อมูล PostgreSQL ชื่อ `LyricSeekDB` ทำหน้าที่ **CRUD** ให้แต่ละตาราง

> **CRUD** = **C**reate (เพิ่ม) · **R**ead (อ่าน) · **U**pdate (แก้ไข) · **D**elete (ลบ) ซึ่งตรงกับวิธีส่งคำขอ HTTP ดังนี้
>
> | การกระทำ | HTTP method | คำสั่ง SQL |
> |---|---|---|
> | เพิ่ม | `POST` | `INSERT` |
> | อ่าน | `GET` | `SELECT` |
> | แก้ไข | `PUT` | `UPDATE` |
> | ลบ | `DELETE` | `DELETE` |

## 2.1 คำสั่ง import (บรรทัด 2-7)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
import psycopg2
import psycopg2.extras
```

| บรรทัด | ความหมาย |
|---|---|
| `FastAPI` | ตัวหลักของ framework (เหมือนใน `API.py`) |
| `CORSMiddleware` | ตัวช่วยเรื่อง CORS (อธิบายในหัวข้อ 2.2) |
| `BaseModel` | แม่แบบกำหนดหน้าตาข้อมูลที่รับเข้ามา |
| `EmailStr` | ชนิดข้อมูล "อีเมล" ที่ตรวจรูปแบบให้อัตโนมัติ (ต้องมี `xxx@xxx.xxx`) ต้องติดตั้งแพ็กเกจ `email-validator` ด้วย |
| `CryptContext` | เครื่องมือเข้ารหัสรหัสผ่านจาก library `passlib` |
| `psycopg2` | library สำหรับคุยกับ PostgreSQL จาก Python |
| `psycopg2.extras` | ส่วนเสริมของ psycopg2 ที่เรานำมาใช้ `RealDictCursor` |

## 2.2 สร้างแอปและตั้งค่า CORS (บรรทัด 9-16)

```python
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

- `app = FastAPI()` สร้างแอป (ชื่อ `app` นี้คือที่มาของ `main:app` ในคำสั่งรัน)
- **CORS** เป็นกฎความปลอดภัยของเบราว์เซอร์ ที่โดยปกติจะไม่ยอมให้หน้าเว็บจาก "ที่อยู่หนึ่ง" ไปเรียก API ของ "อีกที่อยู่หนึ่ง" ถ้า server ไม่อนุญาต
- `add_middleware(CORSMiddleware, ...)` ติดตั้งตัวกลางที่แนบข้อความ "อนุญาต" ไปกับทุกคำตอบ

| ค่า | ความหมาย |
|---|---|
| `allow_origins=["*"]` | อนุญาตให้ **ทุกที่อยู่** เรียกได้ |
| `allow_methods=["*"]` | อนุญาต **ทุก method** (GET, POST, PUT, DELETE ...) |
| `allow_headers=["*"]` | อนุญาต **ทุก header** |

## 2.3 ตั้งค่าการเชื่อมต่อฐานข้อมูล (บรรทัด 18-29)

```python
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "LyricSeekDB",
    "user": "postgres",
    "password": "...",
}

def get_connection():
    return psycopg2.connect(**DB_CONFIG)
```

| ค่า | ความหมาย |
|---|---|
| `host` | ที่อยู่เครื่องที่ติดตั้งฐานข้อมูล `localhost` = เครื่องเดียวกับที่รัน `main.py` |
| `port` | port ของ PostgreSQL (ค่ามาตรฐานคือ 5432 ไม่เกี่ยวกับ port 8000 ของ API) |
| `dbname` | ชื่อฐานข้อมูล |
| `user` / `password` | ชื่อผู้ใช้และรหัสผ่านของ PostgreSQL |

- `def get_connection():` สร้างฟังก์ชัน "เปิดการเชื่อมต่อใหม่ไปยังฐานข้อมูล"
- `psycopg2.connect(**DB_CONFIG)` เปิดการเชื่อมต่อ เครื่องหมาย `**` แปลว่า "กระจาย dictionary เป็น argument แยกตัว" จึงเท่ากับเขียน `psycopg2.connect(host="localhost", port=5432, ...)`

ทุก endpoint จะเรียก `get_connection()` เพื่อเปิดการเชื่อมต่อของตัวเองทุกครั้งที่มีคำขอเข้ามา

## 2.4 เครื่องมือเข้ารหัสรหัสผ่าน (บรรทัด 32)

```python
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
```

- `schemes=["bcrypt"]` เลือกใช้อัลกอริทึม **bcrypt** ซึ่งเป็นการเข้ารหัสแบบ "ทางเดียว" (แปลงกลับเป็นรหัสผ่านเดิมไม่ได้)
- `deprecated="auto"` ถ้าในอนาคตมีอัลกอริทึมที่เก่าแล้ว ให้ระบบทำเครื่องหมายเองอัตโนมัติ

ใช้ในตอนสมัครสมาชิก เพื่อไม่ให้เก็บรหัสผ่านตัวจริงลงฐานข้อมูล

## 2.5 แบบฟอร์มข้อมูลที่รับเข้ามา (บรรทัด 35-91)

แต่ละ `class` คือแบบฟอร์มหนึ่งใบ ใช้ตรวจว่าข้อมูลที่แอปส่งมามีช่องครบและชนิดถูกต้อง ถ้าไม่ตรง FastAPI ตอบ 422 ให้เอง

| คลาส | ช่องข้อมูล | ใช้กับ |
|---|---|---|
| `UserData` | `username: str`, `email: EmailStr`, `password: str` | สมัครสมาชิก (`POST /users`, `POST /register`) |
| `UpdateUserData` | `username: str`, `email: EmailStr` | แก้ไขผู้ใช้ (`PUT /users/{id}`) ไม่มี `password` |
| `Train_SongData` | `newsong_name`, `newsong_artist`, `newsong_lyrics` (ทั้งหมด `str`) | เพิ่มเพลงสำหรับเทรน |
| `UpdateTrain_SongData` | ช่องเดียวกับ `Train_SongData` | แก้ไขเพลงสำหรับเทรน |
| `SongData` | `song_name`, `spotify_Link`, `youtube_link` (ทั้งหมด `str`) | เพิ่มเพลง |
| `Update_SongData` | ช่องเดียวกับ `SongData` | แก้ไขเพลง |
| `GenreData` | `genre_name: str` | เพิ่มแนวเพลง |
| `UpdateGenreData` | `genre_name: str` | แก้ไขแนวเพลง |
| `Genre_SongData` | `song_id: int`, `genre_id: int` | เชื่อมเพลงกับแนวเพลง |
| `UpdateGenre_SongData` | `song_id: int`, `genre_id: int` | แก้ไขการเชื่อมนั้น |
| `MoodData` | `mood_name: str` | เพิ่มอารมณ์เพลง |
| `UpdateMoodData` | `mood_name: str` | แก้ไขอารมณ์เพลง |
| `Mood_SongData` | `song_id: int`, `mood_id: int` | เชื่อมเพลงกับอารมณ์ |
| `UpdateMood_SongData` | `song_id: int`, `mood_id: int` | แก้ไขการเชื่อมนั้น |

`str` = ข้อความ, `int` = จำนวนเต็ม

ตาราง `Genre_Song` และ `Mood_Song` เป็น **ตารางเชื่อม** เก็บว่า "เพลงไหน อยู่ในแนวไหน / อารมณ์ไหน" โดยเก็บแค่เลข id ของสองตารางมาคู่กัน

## 2.6 อธิบายรูปแบบของ endpoint ทีละบรรทัด (ใช้ตาราง `User` เป็นตัวอย่าง)

ทุก endpoint ในไฟล์นี้เขียนตามรูปแบบเดียวกัน อ่านตัวอย่างนี้เข้าใจแล้วจะเข้าใจทั้งไฟล์

### Flowchart: เมื่อมีคำขอเข้ามาที่ `main.py` (ใช้ได้กับทุก endpoint)

```
แอปส่งคำขอ เช่น  POST /users  หรือ  GET /Song  หรือ  DELETE /Mood/3
   ▼
Uvicorn รับคำขอ ส่งต่อให้ FastAPI
   ▼
CORSMiddleware: แนบข้อความ "อนุญาตให้เรียกได้" ไปกับคำตอบ
   ▼
มี endpoint ที่ตรงกับ  method + URL  ไหม?
   │   (FastAPI ไล่ดูตามลำดับที่ประกาศในไฟล์ อันแรกที่ตรงจะถูกใช้)
   ├─ ไม่มี ──► ตอบ 404 (จบ)
   └─ มี
        ▼
ข้อมูลที่ส่งมาถูกต้องไหม?
   │   - ตัวเลขใน URL เช่น {user_id} ต้องเป็นจำนวนเต็ม (int)
   │   - ข้อมูลแนบ (POST/PUT) ต้องตรงกับแบบฟอร์ม เช่น UserData
   ├─ ไม่ถูก ──► ตอบ 422 error (จบ)
   └─ ถูก
        ▼
(เฉพาะสมัครสมาชิก) เข้ารหัสรหัสผ่านด้วย bcrypt
        ▼
get_connection()  ──► เปิดการเชื่อมต่อ PostgreSQL
        ▼
สร้าง cursor  (ตัวส่งคำสั่ง SQL)
        ▼
cursor.execute(SQL, ค่าที่ใส่แทน %s)
   ├─ ฐานข้อมูลไม่ตอบสนอง / SQL ผิด / ข้อมูลซ้ำ
   │     └─► เกิด error ──► ตอบ 500 (จบ)
   │         (หมายเหตุ: conn.close() จะไม่ถูกเรียก การเชื่อมต่อค้างอยู่)
   └─ สำเร็จ
        ▼
คำขอเป็นแบบไหน?
   ├─ GET     (อ่าน)  ──► fetchall() ได้หลายแถว  หรือ  fetchone() ได้แถวเดียว
   ├─ POST    (เพิ่ม)  ──► fetchone() รับ id ที่เพิ่งสร้าง (RETURNING) ──► commit()
   ├─ PUT     (แก้ไข)  ──► commit()
   └─ DELETE  (ลบ)    ──► commit()
        │
        │   commit() = ยืนยันการเปลี่ยนแปลง ถ้าไม่เรียก ข้อมูลจะไม่ถูกบันทึกจริง
        │   GET ไม่ต้อง commit เพราะไม่ได้เปลี่ยนข้อมูล
        ▼
conn.close()  ──► ปิดการเชื่อมต่อ
        ▼
return {"status": "success", ...}
        ▼
FastAPI แปลงเป็น JSON ส่งกลับไปหาแอป
```

ตัวอย่างสมัครสมาชิก `POST /users` ไล่ตามผังนี้: ข้อมูลผ่านแบบฟอร์ม `UserData` → เข้ารหัสรหัสผ่าน → เปิด DB → `INSERT` → `fetchone()` ได้ `user_id` ใหม่ → `commit()` → `close()` → ตอบ `{"status": "success", "users_id": <เลข id>}`

### อธิบายรูปแบบทีละบรรทัด

### (1) เพิ่มข้อมูล: `POST /users` (บรรทัด 94-109)

```python
@app.post("/users")
def create_user(data: UserData):
    hashed_password = pwd_context.hash(data.password)

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        'INSERT INTO "User" (username, email, password) VALUES (%s, %s, %s) RETURNING user_id',
        (data.username, data.email, hashed_password),
    )
    new_id = cursor.fetchone()["user_id"]
    conn.commit()
    conn.close()

    return {"status": "success", "users_id": new_id}
```

| คำสั่ง | ความหมาย |
|---|---|
| `@app.post("/users")` | คำขอ POST ที่มาที่ `/users` ให้เรียกฟังก์ชันนี้ |
| `def create_user(data: UserData)` | รับข้อมูลที่แอปส่งมา ตรวจกับแบบฟอร์ม `UserData` แล้วเก็บในตัวแปร `data` |
| `pwd_context.hash(data.password)` | เข้ารหัสรหัสผ่านด้วย bcrypt ได้ข้อความยาวๆ ที่อ่านไม่ออก เช่น `$2b$12$...` |
| `conn = get_connection()` | เปิดการเชื่อมต่อฐานข้อมูล |
| `conn.cursor(cursor_factory=RealDictCursor)` | สร้าง **cursor** คือ "ตัวส่งคำสั่ง SQL และรับผลลัพธ์" โดย `RealDictCursor` ทำให้แต่ละแถวที่ได้กลับมาเป็น dictionary (เรียกด้วยชื่อคอลัมน์ได้ เช่น `row["user_id"]`) แทนที่จะเป็นลำดับตัวเลข |
| `cursor.execute(SQL, (ค่า...))` | สั่งรันคำสั่ง SQL |
| `INSERT INTO "User" (...) VALUES (...)` | เพิ่มแถวใหม่ในตาราง `User` |
| `%s` | ช่องว่างสำหรับใส่ค่า จะถูกแทนด้วยค่าใน tuple ตามลำดับ **การแยกแบบนี้ป้องกัน SQL Injection** (การแอบยัดคำสั่ง SQL ผ่านข้อมูลที่ผู้ใช้กรอก) ห้ามต่อข้อความ SQL เองด้วย f-string |
| `RETURNING user_id` | ขอให้ฐานข้อมูลบอก `user_id` ของแถวที่เพิ่งเพิ่มกลับมา (เลขที่ฐานข้อมูลสร้างให้เอง) |
| `cursor.fetchone()["user_id"]` | ดึงผลลัพธ์แถวเดียว แล้วหยิบค่าของคอลัมน์ `user_id` |
| `conn.commit()` | **ยืนยันการเปลี่ยนแปลง** ถ้าไม่เรียก ข้อมูลที่เพิ่มจะไม่ถูกบันทึกจริง |
| `conn.close()` | ปิดการเชื่อมต่อ |
| `return {...}` | ตอบกลับแอปเป็น JSON บอกว่าสำเร็จและ id ที่ได้ |

**ทำไมใส่ `"User"` ในเครื่องหมายคำพูดคู่:** ใน PostgreSQL ถ้าไม่ใส่จะถูกแปลงเป็นตัวพิมพ์เล็ก และ `user` ยังเป็นคำสงวนของระบบ ต้องใส่เครื่องหมายคำพูดคู่ให้ตรงกับชื่อตารางที่สร้างไว้ ตัวอักษรใหญ่-เล็กต้องตรงเป๊ะ

### (2) `POST /register` (บรรทัด 114-116)

```python
@app.post("/register")
def register(data: UserData):
    return create_user(data)
```

URL อีกชื่อหนึ่งที่ทำงานเหมือน `/users` ทุกประการ เพราะแค่เรียกฟังก์ชัน `create_user` ต่อ (มีไว้ให้หน้า Register เรียกด้วยชื่อเดิม)

### (3) อ่านทั้งหมด: `GET /users` (บรรทัด 120-128)

```python
@app.get("/users")
def read_users():
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('SELECT user_id, username, email FROM "User" ORDER BY user_id')
    users = cursor.fetchall()
    conn.close()

    return {"status": "success", "data": users}
```

| คำสั่ง | ความหมาย |
|---|---|
| `SELECT user_id, username, email` | เลือกอ่านเฉพาะสามคอลัมน์นี้ **ตั้งใจไม่เลือก `password`** เพื่อไม่ส่งรหัสผ่านออกไป |
| `FROM "User"` | จากตาราง `User` |
| `ORDER BY user_id` | เรียงตาม `user_id` จากน้อยไปมาก |
| `cursor.fetchall()` | ดึงผลลัพธ์ **ทุกแถว** เป็นลิสต์ของ dictionary |
| ไม่มี `conn.commit()` | เพราะแค่อ่าน ไม่ได้เปลี่ยนข้อมูล จึงไม่ต้องยืนยัน |

### (4) อ่านทีละคน: `GET /users/{user_id}` (บรรทัด 132-143)

```python
@app.get("/users/{user_id}")
def read_user(user_id: int):
    ...
    cursor.execute('SELECT user_id, username, email FROM "User" WHERE user_id = %s', (user_id,))
    user = cursor.fetchone()
```

- `{user_id}` ใน URL คือ **path parameter** ค่าที่อยู่ตรงนั้นจะถูกส่งเข้าฟังก์ชัน เช่น เรียก `GET /users/5` ได้ `user_id = 5`
- `user_id: int` บอกว่าต้องเป็นจำนวนเต็ม ถ้าเรียก `/users/abc` จะได้ error 422
- `WHERE user_id = %s` เอาเฉพาะแถวที่ id ตรงกัน
- `(user_id,)` **ต้องมีเครื่องหมายจุลภาคท้าย** เพื่อให้เป็น tuple ที่มีสมาชิกตัวเดียว ถ้าเขียน `(user_id)` จะกลายเป็นแค่ตัวเลขในวงเล็บ
- `cursor.fetchone()` ดึงแถวเดียว ถ้าไม่พบ id นั้นจะได้ `None` ซึ่งส่งกลับเป็น `"data": null`

### (5) แก้ไข: `PUT /users/{user_id}` (บรรทัด 147-158)

```python
@app.put("/users/{user_id}")
def update_user(user_id: int, data: UpdateUserData):
    ...
    cursor.execute(
        'UPDATE "User" SET username = %s, email = %s WHERE user_id = %s',
        (data.username, data.email, user_id),
    )
    conn.commit()
```

- รับสองอย่างพร้อมกัน: `user_id` จาก URL และ `data` จากข้อมูลที่แนบมา
- `UPDATE "User" SET ... WHERE user_id = %s` แก้ค่าคอลัมน์ที่ระบุ **เฉพาะแถวที่ id ตรงกัน** (ถ้าลืม `WHERE` จะแก้ทุกแถว)
- ต้อง `commit()` เพราะเป็นการเปลี่ยนข้อมูล

### (6) ลบ: `DELETE /users/{user_id}` (บรรทัด 162-170)

```python
@app.delete("/users/{user_id}")
def delete_user(user_id: int):
    ...
    cursor.execute('DELETE FROM "User" WHERE user_id = %s', (user_id,))
    conn.commit()
```

`DELETE FROM ... WHERE ...` ลบเฉพาะแถวที่ id ตรงกัน

## 2.7 รายการ endpoint ทั้งหมดของแต่ละตาราง

ทุกตารางทำงานตามรูปแบบในหัวข้อ 2.6 ตารางด้านล่างสรุปว่า URL ไหนทำอะไร และรัน SQL อะไร

### ตาราง `User` (บรรทัด 94-170)

| Method | URL | ทำอะไร | SQL |
|---|---|---|---|
| POST | `/users` | สมัครสมาชิก เข้ารหัสรหัสผ่านก่อนเก็บ | `INSERT INTO "User" (username, email, password) ... RETURNING user_id` |
| POST | `/register` | เหมือน `/users` | เรียก `create_user` |
| GET | `/users` | อ่านผู้ใช้ทั้งหมด (ไม่รวมรหัสผ่าน) | `SELECT user_id, username, email FROM "User" ORDER BY user_id` |
| GET | `/users/{user_id}` | อ่านผู้ใช้คนเดียว | `SELECT ... FROM "User" WHERE user_id = %s` |
| PUT | `/users/{user_id}` | แก้ชื่อและอีเมล | `UPDATE "User" SET username, email WHERE user_id` |
| DELETE | `/users/{user_id}` | ลบผู้ใช้คนเดียว | `DELETE FROM "User" WHERE user_id = %s` |

### ตาราง `Train_Song` เพลงสำหรับเทรน (บรรทัด 190-265)

| Method | URL | ทำอะไร | SQL |
|---|---|---|---|
| POST | `/Train_Song` | เพิ่มเพลง (ชื่อ ศิลปิน เนื้อร้อง) | `INSERT INTO "Train_Song" (newsong_name, newsong_artist, newsong_lyrics) ... RETURNING newsong_id` |
| GET | `/Train_Song` | อ่านทั้งหมด (ไม่รวมเนื้อร้อง) | `SELECT newsong_id, newsong_name, newsong_artist FROM "Train_Song" ORDER BY newsong_id` |
| GET | `/Train_Song/{newsong_id}` | อ่านทีละเพลง | ดู "ข้อสังเกต" ข้อ 1 |
| PUT | `/Train_Song/{newsong_id}` | แก้ไขเพลง | ดู "ข้อสังเกต" ข้อ 2 |
| DELETE | `/Train_Song/{newsong_id}` | ลบเพลงเดียว | `DELETE FROM "Train_Song" WHERE newsong_id = %s` |

### ตาราง `Song` (บรรทัด 275-350)

| Method | URL | ทำอะไร | SQL |
|---|---|---|---|
| POST | `/Song` | เพิ่มเพลง (ชื่อ ลิงก์ Spotify ลิงก์ YouTube) | `INSERT INTO "Song" (song_name, spotify_Link, youtube_link) ... RETURNING song_id` |
| GET | `/Song` | อ่านทั้งหมด | `SELECT song_id, song_name, spotify_Link, youtube_link FROM "Song" ORDER BY song_id` |
| GET | `/Song/{song_id}` | อ่านทีละเพลง | ดู "ข้อสังเกต" ข้อ 3 |
| PUT | `/song/{song_id}` | แก้ไขเพลง | ดู "ข้อสังเกต" ข้อ 4 |
| DELETE | `/Song/{song_id}` | ลบเพลงเดียว | `DELETE FROM "Song" WHERE song_id = %s` |

### ตาราง `Genre` แนวเพลง (บรรทัด 356-423)

| Method | URL | ทำอะไร | SQL |
|---|---|---|---|
| POST | `/Genre` | เพิ่มแนวเพลง | `INSERT INTO "Genre" (genre_name) VALUES (%s) RETURNING genre_id` |
| GET | `/Genre` | อ่านทั้งหมด | `SELECT genre_id, genre_name FROM "Genre" ORDER BY genre_id` |
| GET | `/Genre/{genre_id}` | อ่านทีละแนว | `SELECT genre_id, genre_name FROM "Genre" WHERE genre_id = %s` |
| PUT | `/Genre/{genre_id}` | แก้ชื่อแนวเพลง | `UPDATE "Genre" SET genre_name = %s WHERE genre_id = %s` |
| DELETE | `/Genre/{genre_id}` | ลบแนวเดียว | `DELETE FROM "Genre" WHERE genre_id = %s` |

### ตาราง `Genre_Song` เชื่อมเพลงกับแนวเพลง (บรรทัด 426-493)

| Method | URL | ทำอะไร | SQL |
|---|---|---|---|
| POST | `/Genre_Song` | เชื่อมเพลงกับแนว | `INSERT INTO "Genre_Song" (song_id, genre_id) VALUES (%s, %s) RETURNING category_id` |
| GET | `/Genre_Song` | อ่านทั้งหมด | `SELECT category_id, song_id, genre_id FROM "Genre_Song" ORDER BY category_id` |
| GET | `/Genre_Song/{category_id}` | อ่านทีละรายการ | `SELECT ... WHERE category_id = %s` |
| PUT | `/Genre_Song/{category_id}` | แก้การเชื่อม | `UPDATE "Genre_Song" SET song_id = %s, genre_id = %s WHERE category_id = %s` |
| DELETE | `/Genre_Song/{category_id}` | ลบการเชื่อมเดียว | `DELETE FROM "Genre_Song" WHERE category_id = %s` |

### ตาราง `Mood` อารมณ์เพลง (บรรทัด 496-563)

| Method | URL | ทำอะไร | SQL |
|---|---|---|---|
| POST | `/Mood` | เพิ่มอารมณ์ | `INSERT INTO "Mood" (mood_name) VALUES (%s) RETURNING mood_id` |
| GET | `/Mood` | อ่านทั้งหมด | `SELECT mood_id, mood_name FROM "Mood" ORDER BY mood_id` |
| GET | `/Mood/{mood_id}` | อ่านทีละอารมณ์ | `SELECT mood_id, mood_name FROM "Mood" WHERE mood_id = %s` |
| PUT | `/Mood/{mood_id}` | แก้ชื่ออารมณ์ | `UPDATE "Mood" SET mood_name = %s WHERE mood_id = %s` |
| DELETE | `/Mood/{mood_id}` | ลบอารมณ์เดียว | `DELETE FROM "Mood" WHERE mood_id = %s` |

### ตาราง `Mood_Song` เชื่อมเพลงกับอารมณ์ (บรรทัด 566-633)

| Method | URL | ทำอะไร | SQL |
|---|---|---|---|
| POST | `/Mood_Song` | เชื่อมเพลงกับอารมณ์ | `INSERT INTO "Mood_Song" (song_id, mood_id) VALUES (%s, %s) RETURNING mood_song_id` |
| GET | `/Mood_Song` | อ่านทั้งหมด | `SELECT mood_song_id, song_id, mood_id FROM "Mood_Song" ORDER BY mood_song_id` |
| GET | `/Mood_Song/{mood_song_id}` | อ่านทีละรายการ | `SELECT ... WHERE mood_song_id = %s` |
| PUT | `/Mood_Song/{mood_song_id}` | แก้การเชื่อม | `UPDATE "Mood_Song" SET song_id = %s, mood_id = %s WHERE mood_song_id = %s` |
| DELETE | `/Mood_Song/{mood_song_id}` | ลบการเชื่อมเดียว | `DELETE FROM "Mood_Song" WHERE mood_song_id = %s` |

### ลบข้อมูลทั้งหมดของตาราง (บรรทัด 636-717)

ทั้งหมดเป็น `DELETE` และทำตามรูปแบบเดียวกัน คือ `DELETE FROM "<ตาราง>"` **ไม่มี `WHERE`** จึงลบ **ทุกแถว** ในตาราง

| Method | URL | ตารางที่ล้าง |
|---|---|---|
| DELETE | `/users/all` | `User` |
| DELETE | `/Train_Song/all` | `Train_Song` |
| DELETE | `/Song/all` | `Song` |
| DELETE | `/Genre/all` | `Genre` |
| DELETE | `/Genre_Song/all` | `Genre_Song` |
| DELETE | `/Mood/all` | `Mood` |
| DELETE | `/Mood_Song/all` | `Mood_Song` |

> ⚠️ **ระวัง:** ลบแล้วกู้คืนไม่ได้ และไม่มีการถามยืนยันหรือตรวจสิทธิ์ใดๆ ก่อนลบ ดู "ข้อสังเกต" ข้อ 6 เรื่อง URL กลุ่มนี้อาจใช้งานไม่ได้ตามที่ตั้งใจ

## 2.8 บรรทัดสุดท้ายของไฟล์ (บรรทัด 720-721)

```python
# รันด้วยคำสั่ง: python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
# ทดสอบทุก URL ได้ที่: http://localhost:8000/docs
```

สองบรรทัดนี้เป็นคอมเมนต์ (ขึ้นต้นด้วย `#` ไม่ถูกรัน) ไว้บอกวิธีรัน ซึ่งเป็นคำสั่งเดียวกับที่ `Start.py` ใช้ อธิบายทีละส่วน:

| ส่วนของคำสั่ง | ความหมาย |
|---|---|
| `python` | เรียก Python |
| `-m uvicorn` | `-m` คือ "รันโมดูล" สั่งให้ Python รันโปรแกรม `uvicorn` ที่ติดตั้งไว้ |
| `main:app` | บอกว่าแอปอยู่ที่ไหน: `main` = ไฟล์ `main.py` และ `app` = ตัวแปร `app` ในไฟล์นั้น (บรรทัดที่ 9) |
| `--reload` | ให้ server **รีสตาร์ทตัวเองอัตโนมัติ** เมื่อแก้โค้ด เหมาะกับตอนพัฒนา |
| `--host 0.0.0.0` | รับการเชื่อมต่อจากทุกเครื่องในเครือข่าย (มือถือเรียกเข้ามาได้) |
| `--port 8000` | ใช้ port 8000 |

**หน้า `/docs`:** เปิด `http://localhost:8000/docs` แล้วจะเห็นรายการ endpoint ทั้งหมดที่ FastAPI สร้างให้อัตโนมัติ และกดทดลองเรียกได้เลยโดยไม่ต้องเขียนโค้ดเพิ่ม (`API.py` ก็ใช้ได้เหมือนกันที่ `http://localhost:8002/docs`)

---

# ส่วนที่ 3: ข้อสังเกตที่พบตอนอ่านโค้ด

ระหว่างเขียนเอกสารพบจุดที่ **น่าจะเป็นบั๊ก** ใน `main.py` ยังไม่ได้แก้อะไรในโค้ด สรุปไว้เผื่อนำไปแก้ ข้อ 1-4 อ่านจากโค้ดโดยตรง ส่วนข้อ 5-6 เป็นการคาดการณ์ตามการทำงานของ FastAPI ยังไม่ได้ทดสอบจริง

| # | บรรทัด | ปัญหา | ผลที่จะเกิด |
|---|---|---|---|
| 1 | 232 | `GET /Train_Song/{newsong_id}` ไปค้นในตาราง **`"User"`** ด้วย `WHERE user_id` (น่าจะคัดลอกมาจากส่วน users แล้วลืมแก้) | ได้ข้อมูลผิดตาราง หรือ error เพราะตาราง `User` ไม่มีคอลัมน์ `newsong_id` |
| 2 | 247-248 | `PUT /Train_Song/{id}` สั่ง `UPDATE "Train_Song" SET username, email WHERE user_id` และส่งค่า 3 ตัวให้ `%s` 3 ช่อง แต่ชื่อคอลัมน์ผิด (ต้องเป็น `newsong_name`, `newsong_artist`, `newsong_id`) และไม่ได้อัปเดตเนื้อร้อง | error เพราะไม่มีคอลัมน์ `username` ในตาราง `Train_Song` |
| 3 | 317 | `GET /Song/{song_id}` ไปค้นในตาราง **`"User"`** เช่นกัน | ได้ข้อมูลผิดตาราง หรือ error |
| 4 | 327, 332 | `PUT /song/{song_id}` ใช้ตัวพิมพ์เล็ก (`/song`) ขณะที่อันอื่นใช้ `/Song` และเงื่อนไขเป็น `WHERE user_id` แทน `song_id` | URL ไม่ตรงกับ endpoint อื่น และ error เพราะไม่มีคอลัมน์ `user_id` ในตาราง `Song` |
| 5 | 209, 294 | `POST /Train_Song` และ `POST /Song` ถูกประกาศ **ซ้ำสองครั้ง** (`create_...` กับ `register_...`) | FastAPI ใช้อันแรกเสมอ อันที่สอง (`register_newsong`, `register_song`) ไม่เคยถูกเรียก ไม่พังแต่เป็นโค้ดที่ไม่ได้ใช้ |
| 6 | 637-717 | URL `/…/all` ทั้งเจ็ดอันมาหลัง `/…/{id}` ที่รับเลขจำนวนเต็ม FastAPI จะจับคู่ URL ตามลำดับที่ประกาศ `DELETE /users/all` จึงน่าจะถูกจับคู่กับ `/users/{user_id}` ก่อน แล้วขึ้น error 422 เพราะ `"all"` ไม่ใช่เลข | คาดว่า endpoint ลบทั้งหมดใช้ไม่ได้ ถ้าจะแก้ให้ย้ายกลุ่ม `/all` ไปประกาศ **ก่อน** `/{id}` (ควรทดสอบผ่าน `/docs` เพื่อยืนยัน) |

**เรื่องอื่นที่ควรรู้ (ไม่ใช่บั๊ก แต่เป็นจุดอ่อน)**

- **รหัสผ่านฐานข้อมูลเขียนอยู่ในโค้ด** (บรรทัด 24) ถ้าเอาโค้ดขึ้น GitHub หรือส่งให้คนอื่น รหัสผ่านจะรั่วไปด้วย ควรย้ายไปเก็บในไฟล์ `.env` หรือ environment variable
- **`allow_origins=["*"]` และไม่มีระบบยืนยันตัวตน** ใครที่เข้าถึง port 8000 ได้ก็เรียก endpoint ลบข้อมูลทั้งหมดได้ ไม่เป็นปัญหาตอนพัฒนาบนเครือข่ายภายใน แต่ไม่ควรเปิดใช้งานจริงแบบนี้
- **ไม่ได้จัดการ error** ถ้าฐานข้อมูลปิดอยู่ ข้อมูลซ้ำ (เช่น สมัครอีเมลเดิม) หรือ SQL ผิด จะได้ error 500 และ `conn.close()` จะไม่ถูกเรียก (การเชื่อมต่อค้าง) ถ้าจะให้ดีควรใช้ `try / finally`
- **ไม่มีการตอบ 404** ถ้าค้นหา id ที่ไม่มีอยู่ จะได้ `"data": null` พร้อม `"status": "success"`
- **ชื่อฟังก์ชันซ้ำกัน** เช่น `delete_user` ใช้ 3 ครั้ง (บรรทัด 163, 258, 343) และ `read_Train_Song`, `read_Song` ใช้ซ้ำอย่างละ 2 ครั้ง ยังทำงานได้เพราะ URL ถูกลงทะเบียนตอนอ่านบรรทัด `@app...` ไปแล้ว แต่ทำให้อ่านสับสนและควรตั้งชื่อให้ไม่ซ้ำกัน
- **คำตอบของ `POST /users` ใช้ชื่อ `users_id`** ขณะที่ตารางอื่นใช้ชื่อตรงกับคอลัมน์ (`newsong_id`, `song_id`, ...) ถ้าแอปอ่านค่านี้ ต้องใช้ชื่อให้ตรง
