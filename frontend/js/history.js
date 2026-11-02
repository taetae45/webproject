const historyList = document.getElementById("historyList");
const historyMessage = document.getElementById("historyMessage");

function formatCompletedAt(value) {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function renderHistory(orders) {
    historyList.innerHTML = "";
    if (orders.length === 0) {
        historyMessage.textContent = "No packed orders yet.";
        return;
    }
    historyMessage.textContent = `${orders.length} orders in history`;
    orders.forEach(order => {
        const card = document.createElement("article");
        card.className = "history-card";
        const items = order.items.map(item => `<li>✓ ${escapeHtml(item)}</li>`).join("");
        card.innerHTML = `<div class="history-card-header"><strong>${escapeHtml(order.id)}</strong><time datetime="${escapeHtml(order.completed_at)}">${formatCompletedAt(order.completed_at)}</time></div><p class="history-employee">Packed by: <strong>${escapeHtml(order.employee || 'Not recorded')}</strong></p><ul>${items}</ul>`;
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
        historyMessage.textContent = "Could not load order history. Please check that the backend is running.";
    }
}

if (document.body.classList.contains("history-page")) {
    window.authGuard.then(isAuthenticated => { if (isAuthenticated) loadHistory(); });
}
