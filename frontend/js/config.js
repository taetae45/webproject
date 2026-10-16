// ที่อยู่ของ backend กำหนดไว้ที่เดียว เพื่อให้ทุกไฟล์เรียกใช้ตรงกัน
const BACKEND_PORT = "8001";
// พอร์ตของ Live Server ที่ VS Code เปิดให้ตอนพัฒนา
const LIVE_SERVER_PORT = "5500";

// ถ้าเปิดหน้าเว็บผ่าน FastAPI เอง จะใช้ host เดียวกัน (relative)
// ถ้าเปิดผ่าน Live Server หรือเปิดไฟล์ตรง ๆ ให้ชี้ไปที่ backend พอร์ต 8001
const isRunningOnDevServer = location.port === LIVE_SERVER_PORT || location.protocol === "file:";
const backendOrigin = isRunningOnDevServer
    ? `${location.protocol === "https:" ? "https:" : "http:"}//${location.hostname || "127.0.0.1"}:${BACKEND_PORT}`
    : location.origin;

// ใช้ต่อกับ fetch() และ WebSocket
const API_BASE = backendOrigin;
const WS_URL = backendOrigin.replace(/^http/, "ws") + "/ws/detect";
