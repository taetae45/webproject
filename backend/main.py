from pathlib import Path
import base64
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
from pydantic import BaseModel
from backend.detector import Detector, compare
from backend.history import HistoryStore
from backend.orders import OrderStore

# ตำแหน่งโฟลเดอร์ backend ใช้หาโมเดลและข้อมูล order แบบไม่ขึ้นกับที่สั่งรัน
ROOT = Path(__file__).resolve().parent
# โฟลเดอร์หน้าเว็บ ให้ FastAPI เสิร์ฟเอง จึงไม่ต้องเปิด Live Server แยกอีก
FRONTEND = ROOT.parent / "frontend"
if not FRONTEND.is_dir():
    raise RuntimeError(f"ไม่พบโฟลเดอร์หน้าเว็บที่ {FRONTEND}")
app = FastAPI(title="AI Packing Detection API", version="1.0.0")
# อนุญาตหน้า frontend ให้เรียก API ได้ทุกวิธีเปิด (FastAPI เอง, Live Server, หรือเปิดไฟล์ตรง ๆ)
# เซิร์ฟเวอร์ฟังเฉพาะ 127.0.0.1 จึงไม่เปิดรับจากภายนอกเครื่อง
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
orders = OrderStore(ROOT / "data" / "simulation" / "orders.json")
history = HistoryStore(ROOT / "data" / "history" / "completed_orders.json")
detector = Detector(ROOT / "models" / "best.pt")


class DetectionRequest(BaseModel):
    # รูป JPEG ที่แปลงเป็น data URL/base64 จากหน้าเว็บ
    image: str


def result_for(image: str) -> dict:
    # ถอดรหัสรูป, ตรวจจับด้วย YOLO และเทียบกับ order ปัจจุบัน
    try:
        raw = base64.b64decode(image.split(",", 1)[-1], validate=True)
        order = orders.current()
        return {"type": "detection", "order": order, **compare(order["items"], detector.detect_jpeg(raw))}
    except ValueError as error:
        raise HTTPException(400, detail=str(error)) from error


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": detector.model is not None}


@app.get("/api/orders/current")
def current_order():
    return orders.current()


@app.post("/api/orders/next")
def next_order():
    return orders.next()


@app.post("/api/orders/random")
def random_order():
    return orders.random()


@app.get("/api/orders/history")
def order_history():
    return {"orders": history.all()}


@app.post("/api/detect")
def detect(body: DetectionRequest):
    return result_for(body.image)


@app.websocket("/ws/detect")
async def websocket_detect(websocket: WebSocket):
    # หน้าเว็บส่ง frame และ backend ส่งผลตรวจกลับช่องทางเดิม
    await websocket.accept()
    await websocket.send_json({"type": "order", "order": orders.current()})
    try:
        while True:
            message = await websocket.receive_json()
            if message.get("type") == "complete_and_next":
                history.record(orders.current())
                await websocket.send_json({"type": "order", "order": orders.next()})
            elif message.get("type") == "next_order":
                await websocket.send_json({"type": "order", "order": orders.next()})
            elif message.get("type") == "frame":
                try:
                    await websocket.send_json(result_for(message["image"]))
                except HTTPException as error:
                    await websocket.send_json({"type": "error", "message": error.detail})
    except WebSocketDisconnect:
        pass


# เสิร์ฟหน้าเว็บจาก FastAPI เอง ต้อง mount หลังประกาศ route ทั้งหมด
# ไม่งั้น mount ที่ path "/" จะกลืนทุก request ของ API
app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="frontend")


if __name__ == "__main__":
    # สั่งรันด้วย `py -m backend.main` ได้เลย ไม่ต้องพิมพ์ uvicorn เอง
    uvicorn.run(app, host="127.0.0.1", port=8001)
