// ปุ่มควบคุมหลักของหน้าเว็บ
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
let socket;
let captureTimer;

// เริ่มกล้อง, เชื่อม WebSocket และส่งภาพเพื่อตรวจเป็นระยะ
startBtn.onclick = () => {
    startCamera().then(async () => {
        await fetchRandomOrder();
        if (!socket || socket.readyState !== WebSocket.OPEN) socket = connectWebSocket();
        clearInterval(captureTimer);
        captureTimer = setInterval(sendFrame, 750);
    }).catch(error => alert("Cannot start camera: " + error.message));
};

// หยุดส่งภาพ ปิดการเชื่อมต่อ และปิดกล้อง
resetBtn.onclick = () => {
    clearInterval(captureTimer);
    clearTimeout(autoAdvanceTimer);
    isAdvancingOrder = false;
    if (socket) socket.close();
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
};

// แปลงภาพปัจจุบันจาก video เป็น JPEG base64 แล้วส่งผ่าน WebSocket
function sendFrame() {
    if (!socket || socket.readyState !== WebSocket.OPEN || video.readyState < 2) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    socket.send(JSON.stringify({ type: "frame", image: canvas.toDataURL("image/jpeg", 0.7) }));
}
