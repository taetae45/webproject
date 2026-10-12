// เปิดช่องสื่อสารแบบ realtime ระหว่างหน้าเว็บกับ FastAPI
function connectWebSocket() {
    const socket = new WebSocket(WS_URL);
    // รับ order ใหม่ หรือผลตรวจจับจาก backend
    socket.onmessage = event => {
        const data = JSON.parse(event.data);
        if (data.type === "order") loadOrder(data.order.items);
        if (data.type === "detection") renderDetection(data);
        if (data.type === "error") console.error(data.message);
    };
    socket.onopen = () => console.log("Connected to backend");
    socket.onclose = () => console.log("Backend disconnected");
    return socket;
}
