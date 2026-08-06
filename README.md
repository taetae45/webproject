# 📦 AI Packing Detection System

ระบบตรวจสอบการบรรจุสินค้า (Packing Verification System) โดยใช้ AI และ Computer Vision เพื่อตรวจสอบว่าสินค้าที่ใส่ลงในกล่องตรงตามรายการ (Order) หรือไม่

## ✨ Features

- 🎥 รองรับ Webcam และ USB Camera
- 📦 ตรวจจับสินค้าแบบ Real-time
- 🤖 ใช้โมเดล YOLO ที่เทรนจาก CVAT
- 📋 เปรียบเทียบสินค้าที่ตรวจพบกับ Order
- ✅ แสดงรายการสินค้าที่ครบ
- ❌ แจ้งรายการสินค้าที่ขาด
- 🔄 รองรับการเปลี่ยน Order
- 🌐 Frontend และ Backend แยกจากกัน
- ⚡ รองรับการสื่อสารแบบ Real-time ผ่าน WebSocket

---

## 🛠 Tech Stack

### Frontend
- HTML5
- CSS3
- JavaScript

### Backend
- Python 3.11+
- FastAPI
- OpenCV
- WebSocket

### AI
- Ultralytics YOLO
- CVAT

---

## 📂 Project Structure

```text
packing-ai/
│
├── backend/
│   ├── main.py
│   ├── detector.py
│   ├── camera.py
│   ├── websocket.py
│   ├── orders.py
│   └── models/
│       └── best.pt
│
├── frontend/
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── assets/
│
├── dataset/
├── train/
│
├── requirements.txt
└── README.md
```

---

## 🚀 Installation

Clone Repository

```bash
git clone https://github.com/taetae45/webproject.git
```

เข้าโฟลเดอร์โปรเจกต์

```bash
cd webproject
```

สร้าง Virtual Environment

```bash
python -m venv venv
```

Windows

```bash
venv\Scripts\activate
```

Linux / macOS

```bash
source venv/bin/activate
```

ติดตั้ง Library

```bash
pip install -r requirements.txt
```

---

## ▶️ Run Backend

```bash
cd backend
python main.py
```

หรือ

```bash
uvicorn main:app --reload
```

---

## 🌐 Run Frontend

เปิดไฟล์

```
frontend/index.html
```

หรือใช้ Live Server บน VS Code

---

## 📦 AI Model

โมเดลที่ใช้คือ

```
backend/models/best.pt
```

ซึ่งได้จากการ Train Dataset ที่สร้างด้วย CVAT

---

## 📷 Camera

ระบบรองรับ

- Integrated Camera
- USB Camera
- External Webcam

ผู้ใช้สามารถเลือกกล้องก่อนเริ่มตรวจสอบสินค้าได้

---

## 🔄 Workflow

```
Camera
    │
    ▼
OpenCV
    │
    ▼
YOLO Detection
    │
    ▼
Detected Items
    │
    ▼
Compare with Order
    │
    ▼
PASS / FAIL
    │
    ▼
Update Web Interface
```

---

## 📌 Current Status

- [x] Frontend UI
- [x] Camera Selection
- [ ] FastAPI Backend
- [ ] WebSocket
- [ ] YOLO Integration
- [ ] Order Management
- [ ] Database
- [ ] Export Report

---

## 👨‍💻 Developer

Project developed by **Taetae45**

For educational purposes and AI-powered packing verification.
