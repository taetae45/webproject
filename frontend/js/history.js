const historyList = document.getElementById("historyList");
const historyMessage = document.getElementById("historyMessage");

function formatCompletedAt(value) {
    return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function renderHistory(orders) {
    historyList.innerHTML = "";
    if (orders.length === 0) {
        historyMessage.textContent = "ยังไม่มีออร์เดอร์ที่แพ็กเสร็จ";
        return;
    }
    historyMessage.textContent = `ประวัติทั้งหมด ${orders.length} ออร์เดอร์`;
    orders.forEach(order => {
        const card = document.createElement("article");
        card.className = "history-card";
        const items = order.items.map(item => `<li>✓ ${item}</li>`).join("");
        card.innerHTML = `<div class="history-card-header"><strong>${order.id}</strong><time datetime="${order.completed_at}">${formatCompletedAt(order.completed_at)}</time></div><ul>${items}</ul>`;
        historyList.appendChild(card);
    });
}

async function loadHistory() {
    try {
        const response = await fetch(`${API_BASE}/api/orders/history`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        renderHistory(payload.orders || []);
    } catch (error) {
        console.error("Cannot load order history:", error);
        historyMessage.textContent = "ไม่สามารถโหลดประวัติได้ กรุณาตรวจสอบว่า backend ทำงานอยู่";
    }
}

if (document.body.classList.contains("history-page")) loadHistory();
