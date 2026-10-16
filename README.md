# AI Packing Detection System

ระบบตรวจสอบสินค้าที่ใส่ลงกล่อง โดยหน้าเว็บส่งภาพจากกล้องไปยัง FastAPI ผ่าน WebSocket แล้ว backend ใช้ YOLO ตรวจจับและเปรียบเทียบกับรายการสั่งซื้อ

## สิ่งที่มีในโปรเจกต์

- หน้าเว็บ HTML/CSS/JavaScript เลือกกล้องและแสดงสินค้าใน order, สินค้าที่พบ และรายการผิดพลาด
- FastAPI API สำหรับอ่าน/เปลี่ยน order
- WebSocket `/ws/detect` สำหรับส่งภาพ JPEG จากกล้องและรับผลตรวจแบบ real-time
- YOLO detector ที่โหลด `backend/models/best.pt` อัตโนมัติเมื่อมีไฟล์โมเดล
- order ตัวอย่างใน `backend/data/orders.json`

## ติดตั้งและรัน

ต้องมี Python 3.11+ ก่อน จากโฟลเดอร์รากของโปรเจกต์:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8001
```

เปิด frontend ผ่าน Live Server ที่พอร์ต 5500 (เช่น `http://127.0.0.1:5500/frontend/`) แล้วกด **START** และอนุญาตให้เว็บใช้กล้อง

ตรวจสอบ backend ได้ที่ `http://127.0.0.1:8001/health` และเอกสาร API ที่ `http://127.0.0.1:8001/docs`

## เพิ่มโมเดล YOLO

นำโมเดลที่ train จาก CVAT/Ultralytics มาวางเป็น `backend/models/best.pt` โดยชื่อ class ในโมเดลต้องตรงกับชื่อสินค้าใน `backend/data/orders.json` เช่น `Milk`, `Bread`, `Water` (ตัวพิมพ์เล็กใหญ่ต้องตรงกัน) จากนั้น restart backend

หากยังไม่มีโมเดล backend จะเริ่มทำงานได้ แต่จะรายงานว่ายังไม่พบสินค้า ซึ่งช่วยให้ทดสอบการเชื่อมต่อกล้อง, WebSocket และ order ได้ก่อน

## API หลัก

- `GET /health` สถานะ server และสถานะโมเดล
- `GET /api/orders/current` ดู order ปัจจุบัน
- `POST /api/orders/next` เปลี่ยนเป็น order ถัดไป
- `POST /api/detect` ส่งภาพแบบ base64 เพื่อทดสอบแบบ HTTP
- `WS /ws/detect` ช่องทางที่หน้าเว็บใช้จริง
