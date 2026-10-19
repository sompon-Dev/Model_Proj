# สรุปการเพิ่มคอมเมนต์อธิบายโค้ด (เทียบกับ commit `7b45d2c` บน origin/main)

## สิ่งที่ทำ

เพิ่มคอมเมนต์อธิบายใน 33 ไฟล์ `.py` ทั่วทั้งโปรเจกต์ (ตั้งแต่ `Backend_Database/` ถึง `Ver.5/`)
**โดยไม่แก้ตรรกะ/โค้ดที่รันจริงแม้แต่บรรทัดเดียว** — ของทุกไฟล์ที่แก้ ตรวจสอบแล้วว่าบรรทัดที่เปลี่ยน
เป็นคอมเมนต์ (`#`), docstring, หรือบรรทัดเปล่าเท่านั้น (ยืนยันด้วย `git diff` ทุกไฟล์ + `python -m
py_compile` ทุกไฟล์ + เทียบ token ระดับโค้ด (ไม่รวมคอมเมนต์) ก่อน/หลังของ `main.py` ได้ตัวเลขเท่ากัน
เป๊ะ 4641=4641 + รัน smoke-test คำค้นเดิมก่อน/หลังแก้กับ `Search.py` ทั้ง 3 เวอร์ชัน ได้คะแนนตรงกัน
ทุกตัวเลข)

**ไม่ได้แก้บั๊กที่มีอยู่เดิม** — จุดที่ `Document.md` เคยบันทึกไว้ว่าเป็นบั๊ก (เช่น query ผิดตาราง,
endpoint ซ้ำ, ลำดับ route ผิด) ยังคงเป็นบั๊กเหมือนเดิมทุกอย่าง แค่เพิ่ม comment ชี้ไปที่ `Document.md`
ไว้ที่ตำแหน่งนั้นๆ ให้หาง่ายขึ้นเฉยๆ

## รายไฟล์

### Backend_Database/
- **main.py** (ไฟล์ใหญ่สุด 1045 บรรทัด): อธิบาย `_load_env`, CORS middleware, `CryptContext`/bcrypt,
  `BaseModel`/`EmailStr`, decorator routing (`@app.post`), path parameter binding, `RETURNING`,
  `RealDictCursor` — อธิบายละเอียดครั้งแรกที่ตาราง User แล้วไม่ย้ำซ้ำทุกตาราง (รูปแบบเดิมซ้ำกันเกือบ
  ทุกตาราง) + เพิ่ม comment ชี้บั๊กที่ Document.md เคยพบไว้แล้ว 6 จุด (query ผิดตาราง 2 จุด, UPDATE
  คอลัมน์ผิด, endpoint พิมพ์เล็ก-ใหญ่ไม่ตรงกัน, POST ซ้ำ 2 จุด, ลำดับ `/all` vs `/{id}`) + หมายเหตุ
  ชื่อฟังก์ชันซ้ำ (`delete_user` ใช้ 3 ครั้ง)
- **AddSong.py**: อธิบาย `sys.path.insert`+`noqa`, `LOWER()`, `RETURNING`, `RealDictCursor`, list
  comprehension แยก genre, `commit`/`rollback`/`finally close`
- **BulkAddSongs.py**: อธิบาย cursor ธรรมดา vs RealDictCursor, `set(cur.fetchall())`, `DictReader`,
  tuple-as-key dedup, `enumerate(rows, 1)`, modulo progress print
- **testInsert.py / testDeleteAll.py**: เพิ่ม/ขยาย docstring อธิบายว่าเรียกฟังก์ชัน endpoint ตรงๆ
  โดยไม่ผ่าน HTTP, และ `{e!r}` ใน f-string

### Genre_Finder/
- **Genre.py**: อธิบาย `_load_env` (dotenv มือ), dict unpacking `**params`, เหตุที่ต้องเช็ก
  `"error" in data` แยกจาก HTTP status, ternary ของ `_as_list`, `sorted(key=lambda...)`
- **GenreITunes.py**: อธิบาย regex ช่วง Unicode ไทย, regex ตัดคำท้ายชื่อเพลง, substring-shortcut ของ
  `_similar`, running-max ของ `_pick_track`
- **TestGenreFinder.py**: เพิ่ม comment สั้นเรื่อง `_artist` (underscore convention)

### Link_Fetcher/
- **Links.py**: อธิบาย client object ระดับโมดูล, regex เดียวกับ GenreITunes, generator+`max(...,
  default=0.0)`, การประกอบ URL จาก `videoId`, ความแตกต่างเรื่อง timeout กับ Genre.py/GenreITunes.py
- **testgetlink.py**: ไม่แก้ (ไฟล์ 3 บรรทัด ชัดเจนในตัวอยู่แล้ว)

### Ver.3/ (ของเดิม ยืนยันแล้วว่าไม่มีอะไรใช้งานจริงอ้างอิงถึง นอกจาก Ver.4/Evaluate.py แบบ optional)
- **Clean.py**: อธิบาย `normalize` ของ pythainlp (ไม่ใช่ numpy), `for...else`
- **MergeCSV.py**: อธิบาย `.stem`, `csv.DictWriter`
- **Buildindex.py**: อธิบาย `.to_dict(orient="records")`, `normalize(p=2, dim=1)`
- **Search.py**: อธิบาย `normalize(dim=0)` ของเวกเตอร์เดี่ยว, `torch.matmul` แบบ batch, `torch.topk`,
  `.item()`
- **API.py**: อธิบาย FastAPI/pydantic พื้นฐาน, decorator, auto-JSON return
- **TestAPICall.py**: อธิบาย `requests.post(json=...)`, `.json()`

### Ver.4/ (รวม InputData/)
- **textproc.py**: อธิบาย `normalize` ของ pythainlp, regex ช่วง Unicode ไทย (มิเรอร์เข้า Ver.5
  ให้ไฟล์ทั้งสองยังเหมือนกัน byte-ต่อ-byte เหมือนก่อนแก้)
- **Clean.py**: อธิบาย `for...else`
- **Buildindex.py**: อธิบาย sliding-window chunking (`make_chunks`), `normalize(dim=1)`
- **Search.py**: อธิบาย `weights_only=True`, TF-IDF params (`token_pattern`/`ngram_range`/
  `sublinear_tf`), sparse-matrix lexical score, `argsort`+dedup-by-song, `**dict` unpack
- **MergeCSV.py / API.py / TestAPICall.py**: เหมือน Ver.3 (มิเรอร์คอมเมนต์เดียวกัน)
- **Evaluate.py**: อธิบาย filter+`or` fallback, ternary สุ่มคำผิด, `lambda q, w=w:` (closure-over-loop
  -variable ของ Python), MRR/`top(k)` lambda
- **InputData/famous_split.py, importdata.py**: อธิบาย `sys.path.insert`+`noqa`, `yt_dlp.YoutubeDL`
  context manager, pandas `itertuples`/`fillna`, `ThreadPoolExecutor`+`Future`/`.done()`/`.result()`
  (ทำไมไม่ใช้ `as_completed()` ตรงๆ), generator ส่งเข้า `set.update()`

### Ver.5/
- **textproc.py, API.py, TestAPICall.py**: มิเรอร์จาก Ver.4 (ยังคง byte-identical เหมือนก่อนแก้)
- **Buildindex.py**: อธิบาย `make_line_chunks`/`make_token_chunks`, tuple-as-key dedup
- **Search.py**: มิเรอร์คอมเมนต์เดียวกับ Ver.4/Search.py ทุกจุด (ตรรกะเหมือนกัน)
- **Evaluate.py**: อธิบาย `importlib` hack ทีละ 4 ขั้นตอน (spec → module_from_spec → sys.modules →
  exec_module), ตาม + มิเรอร์คอมเมนต์ query-generation จาก Ver.4/Evaluate.py

### Evaluation/
- **BuildTestCase.py**: อธิบาย `sys.path.insert`, list comprehension สร้างชื่อคอลัมน์, seeded RNG,
  tuple-as-key dedup, `rng.sample` vs `rng.choice`
- **AddRankColumns.py**: อธิบาย `importlib` hack ทีละขั้น, dict comprehension, batch encode/matmul
  (ทำไมเร็วกว่าทำทีละคำค้น), `argsort(dim=0)` ความหมาย
- **smallTest/calibrate.py**: เพิ่ม module docstring (ไม่มีมาก่อน) + คอมเมนต์เดียวกับ AddRankColumns.py

### Start.py
อธิบาย `PYTHON` quote-wrapping, `CREATE_NEW_CONSOLE`, `socket.create_connection().close()` เป็น
health-check แบบ TCP เปล่าๆ (ไม่ใช่ HTTP), short-circuit `and`

## ไฟล์ที่ไม่แก้เลย
`Link_Fetcher/testgetlink.py` — 3 บรรทัด ชัดเจนในตัวอยู่แล้ว ไม่มีจุดที่ "ไม่คุ้นเคย" ให้อธิบายเพิ่ม

## สถานะ git
การแก้ไขทั้งหมดนี้ **ยังไม่ commit/push** ตามที่สั่งยกเลิกไว้ — มีแต่ commit checkpoint `7b45d2c`
("Add AddSong/BulkAddSongs DB scripts, GenreITunes lookup, Ver.5 model, and Evaluation
scripts/tools") ที่ขึ้น `origin/main` ไปแล้วก่อนเริ่มงานนี้ ถ้าต้องการ commit การแก้ไขคอมเมนต์นี้
ทีหลัง ให้บอกได้เลย
