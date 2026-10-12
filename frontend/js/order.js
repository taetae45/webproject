const orderList = document.getElementById("orderList");
const unexpectedList = document.getElementById("unexpectedList");
let order = [];
let confirmedCounts = {};
let isAdvancingOrder = false;
let autoAdvanceTimer;

function loadOrder(items = order) {
    order = items;
    confirmedCounts = {};
    isAdvancingOrder = false;
    clearTimeout(autoAdvanceTimer);
    orderList.innerHTML = "";
    unexpectedList.innerHTML = "";

    const requiredCounts = countItems(order);
    Object.entries(requiredCounts).forEach(([item, required]) => {
        appendItem(orderList, `${item} (0/${required})`, "order-item pending", "✕");
    });
}

function advanceToNextOrder() {
    if (isAdvancingOrder) return;
    isAdvancingOrder = true;
    autoAdvanceTimer = setTimeout(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "complete_and_next" }));
        } else {
            isAdvancingOrder = false;
        }
    }, 1000);
}

function countItems(items) {
    return items.reduce((counts, item) => {
        counts[item] = (counts[item] || 0) + 1;
        return counts;
    }, {});
}

function appendItem(list, text, className = "", statusIcon = "") {
    const item = document.createElement("li");
    item.className = className;
    if (statusIcon) {
        const icon = document.createElement("span");
        icon.className = "order-status-icon";
        icon.textContent = statusIcon;
        icon.setAttribute("aria-hidden", "true");
        item.appendChild(icon);
    }
    item.append(text);
    list.appendChild(item);
}

async function fetchRandomOrder() {
    try {
        const response = await fetch(`${API_BASE}/api/orders/random`, {
            method: "POST"
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const randomOrder = await response.json();
        loadOrder(randomOrder.items);
    } catch (error) {
        console.error("Cannot load random order:", error);
        orderList.innerHTML = "";
        appendItem(orderList, "Cannot load order. Start the backend server.");
    }
}
