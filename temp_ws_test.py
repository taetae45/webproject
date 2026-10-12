"""สคริปต์ชั่วคราว: ทดสอบ HTTP + WebSocket ของ backend (ลบทิ้งหลังใช้)"""
import asyncio
import base64
import json
import urllib.request

import cv2
import numpy as np
import websockets

BASE_URL = "http://127.0.0.1:8000"
WS_URL = "ws://127.0.0.1:8000/ws/detect"


def black_jpeg_data_url() -> str:
    # สร้าง JPEG เล็ก ๆ เพื่อส่งเป็น frame ทดสอบ
    frame = np.zeros((64, 64, 3), dtype=np.uint8)
    ok, buffer = cv2.imencode(".jpg", frame)
    if not ok:
        raise RuntimeError("Cannot encode test JPEG")
    return "data:image/jpeg;base64," + base64.b64encode(buffer.tobytes()).decode()


async def check_websocket() -> None:
    async with websockets.connect(WS_URL) as socket:
        initial = json.loads(await socket.recv())
        print("1. initial message:", initial["type"], "-> order", initial["order"]["id"])

        await socket.send(json.dumps({"type": "next_order"}))
        print("2. next_order ->", json.loads(await socket.recv())["type"])

        await socket.send(json.dumps({"type": "frame", "image": black_jpeg_data_url()}))
        detection = json.loads(await socket.recv())
        print("3. frame ->", detection["type"], "| status:", detection["status"],
              "| missing:", len(detection["missing"]), "| detected:", detection["detected"])

        await socket.send(json.dumps({"type": "frame", "image": "data:image/jpeg;base64,bm90IGpwZWc="}))
        print("4. bad frame ->", json.loads(await socket.recv()))

        await socket.send(json.dumps({"type": "complete_and_next"}))
        print("5. complete_and_next ->", json.loads(await socket.recv())["type"])


def check_http() -> None:
    html = urllib.request.urlopen(BASE_URL + "/").read().decode("utf-8")
    print("6. index.html served by FastAPI:", "<title>AI Packing Detection</title>" in html)
    history = json.loads(urllib.request.urlopen(BASE_URL + "/api/orders/history").read())
    print("7. history entries after complete_and_next:", len(history["orders"]))


asyncio.run(check_websocket())
check_http()
