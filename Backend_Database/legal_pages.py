"""หน้าเว็บสาธารณะที่ Facebook บังคับให้มีก่อนเปิด App เป็น Live ถ้าแอปเริ่มเก็บข้อมูลใหม่ต้องแก้ที่นี่ด้วย"""

CONTACT_EMAIL = "best14.159874@gmail.com"

PAGE_TEMPLATE = """<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>
body {{ margin: 0; background: #FFF5F3; color: #1E1E1E; font: 16px/1.7 system-ui, sans-serif; }}
main {{ max-width: 720px; margin: 0 auto; padding: 32px 16px 48px; }}
h1 {{ font-size: 28px; line-height: 1.3; }}
h2 {{ font-size: 20px; margin-top: 32px; }}
a {{ color: #C0392B; }}
</style>
</head>
<body><main>{body}</main></body>
</html>"""

PRIVACY_BODY = f"""
<h1>นโยบายความเป็นส่วนตัวของ LyriSeek</h1>
<p>LyriSeek เป็นแอปค้นหาเพลงไทยจากเนื้อเพลง พัฒนาเป็นโครงงานวิทยานิพนธ์</p>

<h2>ข้อมูลที่เก็บ</h2>
<ul>
<li>บัญชีผู้ใช้: ชื่อผู้ใช้ อีเมล บทบาท และสถานะการระงับบัญชี</li>
<li>การเข้าสู่ระบบด้วย Google หรือ Facebook: ชื่อและอีเมลที่ผู้ให้บริการส่งให้ แอปไม่เห็นรหัสผ่านของบัญชีเหล่านั้น</li>
<li>ประวัติการฟัง: เพลงที่กดฟังและเวลาที่กด</li>
<li>การค้นหา: ข้อความที่พิมพ์ค้นหา และเสียงเมื่อใช้การค้นหาด้วยเสียง</li>
</ul>

<h2>การใช้ข้อมูล</h2>
<p>ใช้เพื่อเข้าสู่ระบบ ค้นหาเพลง แสดงประวัติการฟัง จัดอันดับเพลงยอดนิยม และให้ผู้ดูแลจัดการบัญชี LyriSeek ไม่ขายข้อมูลผู้ใช้</p>

<h2>บริการที่เกี่ยวข้อง</h2>
<ul>
<li>Supabase: จัดการบัญชีและการเข้าสู่ระบบ</li>
<li>Render: เก็บข้อมูลเพลงและประวัติการฟัง</li>
<li>Modal: ประมวลผลการค้นหา</li>
<li>Google Speech-to-Text: แปลงเสียงเป็นข้อความเมื่อใช้การค้นหาด้วยเสียง</li>
</ul>

<h2>การลบข้อมูล</h2>
<p>ดูวิธีขอลบบัญชีและข้อมูลได้ที่ <a href="/data-deletion">หน้าคำแนะนำการลบข้อมูล</a></p>

<h2>ติดต่อ</h2>
<p><a href="mailto:{CONTACT_EMAIL}">{CONTACT_EMAIL}</a></p>

<h2>English summary</h2>
<p>LyriSeek stores your username, email, account role and status, the songs you open, and your search text. Voice searches are sent to Google Speech-to-Text. The app uses Supabase, Render, Modal and Google services to run, and does not sell personal data. To request deletion, see the <a href="/data-deletion">data deletion instructions</a>.</p>
"""

DATA_DELETION_BODY = f"""
<h1>คำแนะนำการลบข้อมูล LyriSeek</h1>
<p>ผู้ใช้ที่เข้าสู่ระบบด้วยอีเมล Google หรือ Facebook ขอลบบัญชีและข้อมูลได้ตามขั้นตอนนี้</p>
<ol>
<li>ส่งอีเมลไปที่ <a href="mailto:{CONTACT_EMAIL}?subject=LyriSeek%20data%20deletion">{CONTACT_EMAIL}</a></li>
<li>ใช้หัวข้อ "LyriSeek data deletion" และแจ้งอีเมลหรือชื่อผู้ใช้ของบัญชี</li>
<li>ผู้ดูแลจะลบบัญชีและประวัติการฟัง แล้วตอบกลับภายใน 30 วัน</li>
</ol>

<h2>ถอนการเชื่อมต่อจาก Facebook</h2>
<p>ไปที่ Settings &amp; privacy &gt; Settings &gt; Apps and Websites ใน Facebook แล้วเลือกลบ LyriSeek ขั้นตอนนี้หยุดการเชื่อมต่อเท่านั้น หากต้องการลบข้อมูลใน LyriSeek ให้ส่งอีเมลตามขั้นตอนด้านบนด้วย</p>

<h2>English</h2>
<p>To delete your LyriSeek account and listening history, email <a href="mailto:{CONTACT_EMAIL}?subject=LyriSeek%20data%20deletion">{CONTACT_EMAIL}</a> with the subject "LyriSeek data deletion" and include your account email or username. An administrator will complete the request and reply within 30 days.</p>
"""
