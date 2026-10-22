"""เปิด backend แล้วเปิดหน้าเว็บให้อัตโนมัติในคลิกเดียว

ใช้ผ่าน start.bat (ดับเบิลคลิก) หรือสั่ง `py run.py` จากโฟลเดอร์โปรเจกต์
"""
import os
import socket
import sys
import threading
import time
import webbrowser
from pathlib import Path

import uvicorn

ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = 8001
URL = f"http://{HOST}:{PORT}/"
BROWSER_DELAY_SECONDS = 2


def is_port_in_use() -> bool:
    # ตรวจว่ามีอะไรจับพอร์ตอยู่แล้วหรือไม่ เพื่อแจ้ง error ที่อ่านรู้เรื่อง
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.settimeout(0.5)
        return probe.connect_ex((HOST, PORT)) == 0


def open_browser_when_ready() -> None:
    # รอให้เซิร์ฟเวอร์พร้อมก่อน แล้วค่อยเปิดเบราว์เซอร์
    time.sleep(BROWSER_DELAY_SECONDS)
    webbrowser.open(URL)


def main() -> int:
    # ให้ import backend.main ได้ไม่ว่าจะสั่งรันจากโฟลเดอร์ไหน
    os.chdir(ROOT)
    sys.path.insert(0, str(ROOT))

    if is_port_in_use():
        print(f"port {PORT} is already in use. Cannot start server.")
        print(f"starting {URL} in your browser instead...")
        webbrowser.open(URL)
        return 0

    print(f"Starting server at {URL}")
    print("Keep this window open. Press Ctrl+C to stop the server.")

    threading.Thread(target=open_browser_when_ready, daemon=True).start()
    uvicorn.run("backend.main:app", host=HOST, port=PORT, reload="--reload" in sys.argv)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
