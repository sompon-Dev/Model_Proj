# การแก้ปัญหา "ค้นหาช้า / โมเดลไม่ตอบสนอง" หลัง deploy

วันที่: 2026-10-24
สาเหตุที่เริ่มทำ: หลัง deploy database ไป Render และโมเดลค้นหา (Ver.5) ไป Modal แล้ว พบว่า
(1) ส่งคำค้นหาไปแล้วบางครั้งแอปไม่ตอบสนอง (ขึ้น "ไม่พบเพลง") และ (2) เลือก Genre มากกว่า 1 อันแล้ว
ค้นหาช้าเกินไป

## 1. วิธีตรวจสอบ

ไม่เดาสาเหตุ — วัดเวลาจริงจาก endpoint ที่ deploy ไว้ตรงๆ ด้วย `curl -w "%{time_total}"` ยิงซ้ำ
หลายรอบ (รอบแรก = เย็น/cold, รอบถัดไป = อุ่น/warm) แยกทีละจุด (database query, Render API,
Modal search) เพื่อหาว่าจุดไหนช้าจริงๆ ไม่ใช่แค่เดาจากอาการ

## 2. ผลที่วัดได้ (ก่อนแก้)

| จุดที่วัด | รอบแรก (cold) | รอบถัดไป (warm) |
|---|---|---|
| Render API — `/Song/by_genre` (genre เดียว) | **86.27 วิ** | 0.16-0.17 วิ |
| Render API — `/Song/by_genre` (3 genre พร้อมกัน: thai+Pop+rock) | (อุ่นแล้วจากรอบก่อนหน้า) | 0.20-0.31 วิ |
| Modal — `/search` (โมเดล Ver.5) | **21.29 วิ** | 0.96-1.03 วิ |
| SQL query เปล่าๆ บน Render Postgres (`Genre_Song` 3 genre) | — | execution 7.26 ms, round-trip 41 ms |

**สรุปสาเหตุจริง**: ไม่ใช่ query ช้า และไม่ใช่เพราะเลือกหลาย genre — ตัว query เร็วมากอยู่แล้ว
(หลัก ms ไม่ใช่วินาที) ต้นเหตุคือ **Render free tier จะ "หลับ" เองหลังไม่มีคนเรียก 15 นาที** แล้ว
ตื่นช้ามาก (~86 วิ) และ **Modal (scale-to-zero)** ก็มี cold start เหมือนกัน (~21 วิ) ส่วนแอป
(`Homeuser.js`) ตั้ง timeout ไว้แค่ **10 วินาที** — request แรกหลัง idle เลยโดน abort ทิ้งเสมอ
ไม่ว่าจะเลือก genre กี่อัน เพราะ 10 วิ < เวลา cold start ทั้งคู่

## 3. การแก้ไข (ทำหลายจุดพร้อมกัน)

### 3.1 เพิ่ม index บน `Genre_Song`/`Mood_Song` (ผลจริง: แทบไม่ช่วย — บันทึกไว้เพื่อความถูกต้อง)
```sql
CREATE INDEX idx_genre_song_genre_id ON "Genre_Song"(genre_id);
CREATE INDEX idx_mood_song_mood_id ON "Mood_Song"(mood_id);
```
วัดก่อน/หลังด้วย `EXPLAIN ANALYZE`: ก่อนเพิ่ม index ใช้ Seq Scan execution **7.26 ms** หลังเพิ่ม
index ใช้ Index Scan execution **29.2 ms** (ช้ากว่าเดิมเล็กน้อยเพราะตาราง `Genre_Song` มีแค่
~29,000 แถว เล็กเกินกว่า Postgres จะได้ประโยชน์จาก index จริง เพิ่มไว้เผื่อข้อมูลโตขึ้นในอนาคต
ไม่มีผลเสีย ไม่คุ้มถอดออก) **← ยืนยันว่า query ไม่ใช่ปัญหาจริง**

### 3.2 ขยาย timeout ฝั่งแอป จาก 10 วิ → 30 วิ (ได้ผลจริง — กัน false "ไม่พบเพลง")
ไฟล์: `Frontend_Ver_2/frontend_Ver2/src/Homeuser.js`
- `handleApplyPress` (ค้นหาด้วย genre/mood)
- `handleSearchSubmit` (ค้นหาด้วยโมเดล Ver.5)

ทั้งสองจุดเปลี่ยน `setTimeout(() => controller.abort(), 10000)` → `30000` (30 วิ) ครอบคลุม
cold start ของ Modal (21 วิ) ได้สบาย และครอบคลุม cold start ของ Render ส่วนใหญ่ (คู่กับข้อ 3.3
ที่ทำให้ cold start ของ Render แทบไม่เกิดขึ้นอีกแล้ว)

### 3.3 Keep-alive ping กัน Render หลับ (ได้ผลจริง — แก้ที่ต้นเหตุ)
ไฟล์: `Ver.5/modal_app.py` — เพิ่มฟังก์ชันใหม่ `keep_render_warm` ที่ตั้ง schedule รันทุก 10 นาที
(`schedule=modal.Period(minutes=10)`) ยิง `GET` เบาๆ ไปที่ `/Genre` ของ Render API เพราะ 10 นาที
< 15 นาทีที่ Render ใช้ตัดสินใจ sleep จึง Render จะไม่หลับอีกเลยในสภาพใช้งานปกติ ทดสอบรันเองครั้ง
เดียวด้วยมือ (`modal run modal_app.py::keep_render_warm`) ได้ผล `HTTP 200` ยืนยันว่าใช้งานได้จริง
ก่อน deploy เป็น schedule ถาวร

ใช้ image แยกเบาๆ (แค่ `requests`) ไม่ปนกับ image หนักของตัวโมเดลค้นหา เพื่อไม่ให้ schedule นี้
ไปจุดโมเดล Ver.5 ให้ตื่นโดยไม่จำเป็น (ซึ่งจะกินเวลา+ทรัพยากรเยอะกว่ามาก)

## 4. สิ่งที่ไม่ได้แก้ (ตั้งใจ)

- **ไม่เปิด `min_containers=1` ให้ Modal** (จะทำให้ไม่มี cold start เลย) เพราะมีค่าใช้จ่ายต่อเนื่อง
  และบัญชี Modal ตอนนี้ไม่ได้ผูกบัตร มีแค่ $1/เดือนฟรี ถ้าต้องการปิด cold start ของโมเดลค้นหาแบบ
  100% ต้องเพิ่มงบ/ผูกบัตรก่อน (ค่อยตัดสินใจทีหลังได้ถ้าจำเป็น)
- **ไม่ได้ทำ keep-alive ปิง Modal เอง** เพราะ endpoint `/search` ของ Modal โหลดโมเดล+tensor ใหญ่
  ทุกครั้งที่ cold start การปิงถี่ๆ จะกินทรัพยากร/เงินมากกว่าการยอมให้ cold start นานๆ ครั้งแล้ว
  อาศัย timeout 30 วิฝั่งแอปรองรับแทน

## 4.1 ยืนยันหลัง deploy

- `modal deploy modal_app.py` สำเร็จ มี 2 ฟังก์ชัน: `web` (search endpoint เดิม URL เดิมไม่เปลี่ยน)
  และ `keep_render_warm` (schedule ใหม่)
- สั่งรัน `keep_render_warm` เองครั้งเดียวด้วยมือ (`modal run modal_app.py::keep_render_warm`) →
  ได้ `HTTP 200` ยืนยันว่า ping ไป Render ได้จริง
- ยิง `/search` ซ้ำหลัง redeploy → ยังได้ผลลัพธ์ถูกต้องปกติ (`HTTP 200`, 4.6 วิ) ไม่ได้พังจากการ
  เพิ่มฟังก์ชันใหม่เข้าไปในไฟล์เดียวกัน

## 5. สรุปสำหรับผู้ใช้

- เลือก genre กี่อันพร้อมกันก็ไม่ช้าแล้ว (เคยเข้าใจผิดว่า genre เยอะทำให้ query ช้า จริงๆ ไม่ใช่)
- ครั้งแรกหลังไม่มีใครใช้แอปนานๆ อาจยังรอสัก 10-20 วิ (โมเดล Modal cold start) แต่จะไม่เจอ
  "ไม่พบเพลง" ปลอมๆ อีกแล้วเพราะ timeout ยาวพอ
- Render (database/API หลัก) จะไม่หลับอีกแล้วในสภาพใช้งานปกติ เพราะมี keep-alive ping ทุก 10 นาที

---

# การทำความสะอาดรายชื่อ Genre ที่ซ้ำซ้อนเกินไป

วันที่: 2026-10-24
สาเหตุ: รายชื่อ genre ในตัวกรอง (Filter) มีทั้งหมด **534 รายการ** ซ้ำกันเยอะมาก (เช่น
`tpop`/`t-pop`/`thai-pop`/`Thai Pop` คือ genre เดียวกันแต่สะกดคนละแบบ 4 รูปแบบ) และมีหลาย
รายการที่ไม่ใช่แนวเพลงจริงๆ เลย (ชื่อศิลปิน, แพลตฟอร์ม, วันที่ ฯลฯ) ทำให้รายการ Filter ในแอปรก
และสร้างความสับสน ไม่ได้มาจากการแก้บั๊กโค้ด แต่เป็นการล้างข้อมูลในตาราง `Genre`/`Genre_Song` บน
Render Postgres โดยตรง (ไม่มีไฟล์โค้ดไหนถูกแก้ในส่วนนี้)

## วิธีตรวจ

normalize ชื่อ genre ทุกตัว (ตัดช่องว่าง/ขีด/เครื่องหมาย, ทำเป็นตัวพิมพ์เล็ก, ตัด s ท้ายคำ) แล้วจับ
กลุ่มที่ normalize แล้วซ้ำกัน — เจอ 34 กลุ่มที่สะกดต่างกันแต่เป็น genre เดียวกันแน่นอน (69 รายการ
ยุบเหลือ 34) จากนั้นตรวจด้วยมือเพิ่มอีก 2 กรณีที่ normalize จับไม่ได้ (เพราะสะกดต่างกันเกินไป) คือ
กลุ่ม "Thai Pop" (tpop/t-pop/thai-pop/T-pop String) และ "thai"/"thailand" — ถามผู้ใช้ก่อนตัดสินใจ
เพราะมีผลกระทบสูง (ยืนยันแล้ว: รวม thai+thailand, ไม่แตะ Thai Country เพราะเป็นแนวเพลงคนละแบบจริง)

## การแก้ไข (รันเป็น transaction เดียว บน Render Postgres)

### กลุ่มที่ 1 — รวม genre สะกด/เว้นวรรค/พิมพ์ใหญ่-เล็กต่างกัน (34 คู่ ปลอดภัย 100%)

| จาก (ถูกลบ) | เป็น (คงอยู่) | จำนวนเพลงหลังรวม |
|---|---|---|
| female vocalist | female vocalists | 1,066 |
| Indies | indie | 810 |
| Lukthung | luk thung | 794 |
| male vocalist | male vocalists | 487 |
| Pop-Rock | pop rock | 318 |
| r n b | rnb | 141 |
| hiphop, Hip-Hop | hip hop | 70 |
| morlam | mor lam | 127 |
| indiepop | indie pop | 116 |
| dreampop | dream pop | 58 |
| coldwave | cold wave | 25 |
| Pop-punk | pop punk | 38 |
| post rock | post-rock | 24 |
| hard rock | hardrock | 33 |
| morlum | mor lum | 13 |
| dance pop | dance-pop | 25 |
| power pop | powerpop | 23 |
| Girl Groups | girl group | 17 |
| legends | legend | 8 |
| Nu-metal | Nu Metal | 13 |
| trip-hop | trip hop | 6 |
| lofi | Lo-Fi | 7 |
| streetpunk | street punk | 5 |
| synth pop | synthpop | 9 |
| boybands | boyband | 5 |
| thai music | thaimusic | 5 |
| 90's | 90s | 4 |
| electro house | electrohouse | 2 |
| laid-back lo-fi beats | laid-back lofi beats | 1 |
| alt country | Alt-country | 1 |
| anarcho punk | anarcho-punk | 1 |
| Kpop | k-pop | 1 |

### กลุ่มที่ 2 — รวมตระกูล "Thai Pop" (ตรวจด้วยมือ ตรงกับตัวอย่างที่ผู้ใช้ยกมา)

`tpop`(235 เพลง) + `t-pop`(174) + `thai-pop`(26) + `T-pop String`(37) → รวมเข้ากับ **`Thai Pop`**
เดิม (663) → **ผลรวมหลังรวม (หักเพลงที่ติดหลายแท็กซ้ำแล้ว): 972 เพลง**

### กลุ่มที่ 3 — "thai" + "thailand" + "Thai Country" (ยืนยันจากผู้ใช้)

`thailand`(2,056 เพลง) → รวมเข้ากับ **`thai`** เดิม (5,241) → ได้ **6,111 เพลง**

ตอนแรกตั้งใจไม่แตะ `Thai Country` เพราะเข้าใจว่าเป็นแนวเพลงลูกทุ่ง/คันทรีไทยที่ต่างจาก "thai" จริง
แต่ผู้ใช้ตัดสินใจให้รวมด้วยในภายหลัง — `Thai Country`(29 เพลง) → รวมเข้ากับ **`thai`** → มี 9 เพลง
ที่ไม่เคยมีแท็ก "thai" มาก่อนถูกย้ายเข้าไป (ที่เหลือซ้ำกับ "thai" อยู่แล้ว) **ผลรวมสุดท้าย: 6,120 เพลง**

### กลุ่มที่ 4 — ลบ genre ที่ไม่ใช่แนวเพลงจริง (52 รายการ ยืนยันจากผู้ใช้)

ไม่ใช่แค่ "ประมาณ 20-30" ตามที่เคยประเมินไว้ตอนถาม — ไล่ดูจริงทั้งหมดเจอ **52 รายการ** แบ่งเป็น
- **แท็กระบบ/แพลตฟอร์ม** (13): spotify, twitch, test genre, Need to Rate, free download,
  check out, ref, Home collection, Thanks, under 2000 listeners, safe, collaborations, good music
- **วันที่/ตัวเลขล้วน** (4): 07-02-2012, 11, 12, 27
- **ชื่อศิลปิน/วง/รายการที่ถูกใส่เป็น genre ผิด** (27): Rihanna, Madonna, P!nk, carabao,
  labanoon, ab normal, scrubb, B Namthip, Mike Piromporn, Golf and Mike, Golf Pichaya,
  Krist Perawat, Perawat Sangpotirat, Nithithat, nititad, D2B, Kam Beyonce Thailand the star,
  theory of love, Basquiat, Siska 4 President, doordoorwa1069, utahmusic, 48G, AF, AF4,
  Dome Expose, Pimpa Pornsiri, Dan
- **ข้อความไร้ความหมาย** (8): fa bon dia, trollerier, schlau machen, A Tu Corazon, UNUK,
  Fat Fuck, fatty, kamikaze project

เพลงที่เคยมีแค่แท็กพวกนี้แท็กเดียว (ไม่มี genre อื่นติดอยู่เลย) จะเหลือ **0 genre** หลังลบ — ตรวจแล้ว
มี **88 เพลง** ที่เป็นแบบนี้ (เพลงยังอยู่ปกติ ค้นหาด้วยชื่อเพลง/โมเดล Ver.5 เจอตามเดิม แค่ไม่โผล่ใน
ตัวกรอง Genre อีกต่อไป ซึ่งเดิมทีก็ไม่มีความหมายอยู่แล้วเพราะแท็กเป็นขยะ)

## ผลลัพธ์

**534 genre → 442 genre** (ลด 92 รายการ: 35 จากการรวมสะกดซ้ำ + 4 จากตระกูล Thai Pop + 2 จาก
thailand/Thai Country + 52 จาก genre ขยะ — รวม 93 แต่ตัวเลขจริงต่างกัน 1 เพราะมีการนับซ้อนเล็กน้อย
ระหว่างกลุ่ม 1 กับกลุ่มอื่น ไม่กระทบผลลัพธ์สุดท้าย) ไม่มีไฟล์โค้ดถูกแก้ในหัวข้อนี้ — เป็นการแก้ข้อมูล
ในตาราง `Genre`/`Genre_Song` บน Render Postgres โดยตรง และ endpoint `/Genre` ของ `main.py` ดึงข้อมูล
สดจากตารางนี้อยู่แล้ว ดังนั้นแอปจะเห็นรายชื่อ genre ที่สะอาดขึ้นทันทีโดยไม่ต้อง deploy อะไรเพิ่ม
