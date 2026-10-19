import os
import socket
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
# กำหนดตำแหน่งให้ terminal ให้เป็น C:\Users\usEr\Documents\Wokr\Thesis

PYTHON = f'"{sys.executable}"'
#ตำแหน่งของ Interpreter Python3.13 เอาไว้ให้อ่านไฟล์.py ได้

# open_terminal คือfunction เอาไว้สำหรับเปิด Terminal โดยมี parameter คือ folder(บอกชื่อFolderที่ไฟล์ที่ต้องการRunนั้นอยู่) และ command(บอกคำสั่งที่ให้รันหลังเปิดTerminal) 
def open_terminal(folder, command):
    #คือการทำให้คำสั่งนั้นRun ต่อไปจนกว่าจะมีกดปิดโดย ผู้ใช้งานเองเพราะปกติจะต้องรอจนมันRun เสร็จแล้วถึงprocess ต่อไปจะทำงานต่อ
    #ในที่นี้คือต้องเปิด Terminal 2อันแล้วต้องรันในขณะเดียวกัน
    subprocess.Popen(
        #f'cmd /k "{command}"' คือการบอกให้ Run คำสั่ง {command} นี้ใน Terminal และกด Enter ในที่นี้ก็แล้วแต่ ที่Parameter:command ส่งมา
        f'cmd /k "{command}"',
        #
        cwd=os.path.join(ROOT, folder), #มันคือ parameter ของ subprocess.Popen() บอกว่าตำแหน่งใน terminal นั้นคือที่ใหน
        creationflags=subprocess.CREATE_NEW_CONSOLE,  # ให้เมื่อสมมุติมีการเรียกใช้ def open_terminal 2 ครั้งก็สร้าง terminal แยกมาอีกอัน
    )

# รอเปิด api_server การทำงานของ Database และ Model โดยการcheck จาก port นั้นๆ เมื่อเรียกใช้ function 
def wait_for_server(port, seconds=300):
    for i in range(seconds):
        try:
            #เข้าไปเปิด url:127.0.0.1(ในที่นี้คือ server ของ Host(ตัวเราเอง)โดยport ตาม parameter ) ว่าport นั้นพร้อมทำงานหรือยังหรือให้ชัดเจนกว่านี้ก็
            #port นี้มีการใช้งานหรือเปล่าถ้ามีการใช้งานก็ จะทำงาน บรรทัดถัดไปคือ การ return True
            socket.create_connection(("127.0.0.1", port), timeout=1).close()
            return True
        except OSError:
            #หาก port นั้นว่างก็จะรอก่อน 1 วินาทีแล้วรัน socket.create_connection อีกรอบ 
            time.sleep(1)
    return False


#เปิด API ของ Model โดยมันคืออญู่ใน folder Ver.5 โดยใช้คำสั่ง python -m uvicorn API:app --host 0.0.0.0 --port 8002
open_terminal("Ver.5", f"{PYTHON} -m uvicorn API:app --host 0.0.0.0 --port 8002")
#เปิด API ของ Database โดยมันอยู่ใน folder Backend_Database โดยใช้คำสั่ง python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
open_terminal("Backend_Database", f"{PYTHON} -m uvicorn main:app --reload --host 0.0.0.0 --port 8000")

# รอเพื่อดูว่า socket นั้นพร้อมแล้วหรือยัง
print("Waiting for servers (8002, 8000)...")
if wait_for_server(8002) and wait_for_server(8000):
    open_terminal("Frontend_Ver_2\\frontend_Ver2", "npm run android")
else:
    print("Server did not start in time, skipped frontend.")
