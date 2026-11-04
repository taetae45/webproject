from pathlib import Path
import base64
import os
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
from pydantic import BaseModel
import sqlite3, hashlib, secrets
from datetime import datetime, timezone
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
DB = ROOT / "data" / "users.sqlite3"
SESSIONS = {}
# ใช้ค่านี้สร้างบัญชี Admin ครั้งแรกเท่านั้น จากนั้นรหัสผ่านจะอยู่ในฐานข้อมูล
INITIAL_ADMIN_PASSWORD = os.getenv("PACKING_ADMIN_PASSWORD")

def hash_admin_password(password):
    salt = secrets.token_bytes(16)
    password_hash = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200_000).hex()
    return salt.hex(), password_hash

def verify_admin_password(password, salt, expected_hash):
    actual_hash = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 200_000).hex()
    return secrets.compare_digest(actual_hash, expected_hash)

def db():
    DB.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    con.execute("CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT NOT NULL, dob TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', first_name TEXT NOT NULL, last_name TEXT NOT NULL, created_at TEXT NOT NULL)")
    columns = {row["name"] for row in con.execute("PRAGMA table_info(users)")}
    if "national_id" in columns:
        # Migrate existing accounts and discard the previously collected ID data.
        con.execute("ALTER TABLE users RENAME TO users_legacy")
        con.execute("CREATE TABLE users (username TEXT PRIMARY KEY, password TEXT NOT NULL, dob TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', first_name TEXT NOT NULL, last_name TEXT NOT NULL, created_at TEXT NOT NULL)")
        email_expr = "email" if "email" in columns else "''"
        con.execute(f"INSERT INTO users (username,password,dob,email,first_name,last_name,created_at) SELECT username,password,dob,{email_expr},first_name,last_name,created_at FROM users_legacy")
        con.execute("DROP TABLE users_legacy")
        con.commit()
    con.execute("CREATE TABLE IF NOT EXISTS admins (username TEXT PRIMARY KEY, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL)")
    if INITIAL_ADMIN_PASSWORD and not con.execute("SELECT 1 FROM admins WHERE username='Admin'").fetchone():
        salt, password_hash = hash_admin_password(INITIAL_ADMIN_PASSWORD)
        con.execute("INSERT INTO admins VALUES (?, ?, ?, ?)", ("Admin", salt, password_hash, datetime.now(timezone.utc).isoformat()))
        con.commit()
    return con

def pw_hash(value): return hashlib.pbkdf2_hmac("sha256", value.encode(), b"packing-register-v1", 200_000).hex()

class RegisterRequest(BaseModel):
    username: str; password: str; dob: str; email: str; first_name: str; last_name: str
class LoginRequest(BaseModel):
    username: str; password: str

def require_user(token):
    username = SESSIONS.get(token or "")
    if not username: raise HTTPException(401, "Please sign in")
    return username

def require_admin(token):
    if require_user(token) != "Admin": raise HTTPException(403, "Administrator access required")


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

@app.post("/api/auth/register")
def register(body: RegisterRequest):
    values = [v.strip() for v in body.dict().values()]
    if not all(values) or len(body.password) < 4: raise HTTPException(400, "Complete all fields and use a password with at least 4 characters")
    if body.username.lower() == "admin": raise HTTPException(400, "This username is reserved")
    con = db()
    try:
        con.execute("INSERT INTO users (username,password,dob,email,first_name,last_name,created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", (body.username.strip(), pw_hash(body.password), body.dob, body.email.strip(), body.first_name.strip(), body.last_name.strip(), datetime.now(timezone.utc).isoformat()))
        con.commit()
    except sqlite3.IntegrityError: raise HTTPException(409, "This username is already taken")
    finally: con.close()
    return {"ok": True}

@app.post("/api/auth/login")
def login(body: LoginRequest):
    con = db()
    if body.username == "Admin":
        admin = con.execute("SELECT password_salt,password_hash FROM admins WHERE username=?", (body.username,)).fetchone()
        valid = admin and verify_admin_password(body.password, admin["password_salt"], admin["password_hash"])
        row = None
    else:
        row = con.execute("SELECT username,password FROM users WHERE username=?", (body.username,)).fetchone()
        valid = row and row["password"] == pw_hash(body.password)
    if not valid: con.close(); raise HTTPException(401, "Incorrect username or password")
    username = "Admin" if body.username == "Admin" else row["username"]
    con.close()
    token = secrets.token_urlsafe(32); SESSIONS[token] = username
    return {"token": token, "username": username, "role": "admin" if username == "Admin" else "employee"}

@app.post("/api/auth/logout")
def logout(body: dict): SESSIONS.pop(body.get("token", ""), None); return {"ok": True}

@app.get("/api/auth/session")
def auth_session(token: str):
    username = require_user(token)
    return {"username": username, "role": "admin" if username == "Admin" else "employee"}

@app.get("/api/admin/overview")
def overview(token: str):
    require_admin(token); con=db()
    users=[dict(r) for r in con.execute("SELECT username,dob,email,first_name,last_name,created_at FROM users ORDER BY username")]
    con.close()
    products=sorted({item for order in orders.orders for item in order["items"]}, key=str.casefold)
    return {"users":users,"orders":orders.orders,"completed":history.all(),"products":products}

@app.delete("/api/admin/users/{username}")
def delete_user(username: str, token: str):
    require_admin(token); con=db(); con.execute("DELETE FROM users WHERE username=?",(username,)); con.commit(); con.close(); return {"ok":True}

class OrderEdit(BaseModel): items: list[str]
class UserEdit(BaseModel): dob: str; email: str; first_name: str; last_name: str; password: str = ""

@app.put("/api/admin/users/{username}")
def edit_user(username: str, body: UserEdit, token: str):
    require_admin(token); con=db()
    if body.password and len(body.password) < 4:
        con.close(); raise HTTPException(400, "Password must have at least 4 characters")
    result=con.execute("UPDATE users SET dob=?,email=?,first_name=?,last_name=? WHERE username=?", (body.dob,body.email.strip(),body.first_name.strip(),body.last_name.strip(),username))
    if result.rowcount and body.password:
        con.execute("UPDATE users SET password=? WHERE username=?", (pw_hash(body.password), username))
    con.commit(); con.close()
    if not result.rowcount: raise HTTPException(404,"Employee not found")
    return {"ok":True}

@app.put("/api/admin/completed-orders/{record_id}")
def edit_completed_order(record_id: str, body: OrderEdit, token: str):
    require_admin(token)
    items = [item.strip() for item in body.items if item.strip()]
    updated = history.update_items(record_id, items)
    if updated is None:
        raise HTTPException(404, "Packed order not found")
    return updated

@app.delete("/api/admin/completed-orders/{record_id}")
def delete_completed_order(record_id: str, token: str):
    require_admin(token)
    if not history.delete(record_id):
        raise HTTPException(404, "Packed order not found")
    return {"ok": True}


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
    username = SESSIONS.get(websocket.query_params.get("token", ""))
    await websocket.accept()
    await websocket.send_json({"type": "order", "order": orders.current()})
    try:
        while True:
            message = await websocket.receive_json()
            if message.get("type") == "complete_and_next":
                history.record(orders.current(), username)
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
