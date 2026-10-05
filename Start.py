import os
import socket
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
PYTHON = f'"{sys.executable}"'


def open_terminal(folder, command):
    """เปิดหน้าต่าง cmd ใหม่ที่ folder แล้วรัน command (/k = ให้หน้าต่างค้างไว้ดู log)"""
    subprocess.Popen(
        f'cmd /k "{command}"',
        cwd=os.path.join(ROOT, folder),
        creationflags=subprocess.CREATE_NEW_CONSOLE,
    )


def wait_for_server(port, seconds=300):
    """ลองต่อ port ทุก 1 วินาที จนกว่า server จะพร้อม คืน True ถ้าพร้อมทันเวลา"""
    for _ in range(seconds):
        try:
            socket.create_connection(("127.0.0.1", port), timeout=1).close()
            return True
        except OSError:
            time.sleep(1)
    return False


# 1-2. เปิด server ทั้งสองตัว
open_terminal("Ver.4", f"{PYTHON} -m uvicorn API:app --host 0.0.0.0 --port 8002")
open_terminal("Backend_Database", f"{PYTHON} -m uvicorn main:app --reload --host 0.0.0.0 --port 8000")

# 3. รอให้ server พร้อม แล้วค่อยเปิด frontend
print("Waiting for servers (8002, 8000)...")
if wait_for_server(8002) and wait_for_server(8000):
    open_terminal("FrontEnd\\Frontend", "npm run android")
else:
    print("Server did not start in time, skipped frontend.")
