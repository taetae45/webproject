const menuButton = document.getElementById("menuButton");
const menuPanel = document.getElementById("menuPanel");
const homeView = document.getElementById("homeView");
const historyView = document.getElementById("historyView");

if (menuButton && menuPanel) {
    menuButton.addEventListener("click", () => {
        const isOpen = menuButton.getAttribute("aria-expanded") === "true";
        menuButton.setAttribute("aria-expanded", String(!isOpen));
        menuPanel.hidden = isOpen;
    });
}

// Switch views without unloading the camera, detection timer, or WebSocket.
if (homeView && historyView) {
    function showView(view, updateAddress = true) {
        const showHistory = view === "history";
        homeView.hidden = showHistory;
        historyView.hidden = !showHistory;

        if (updateAddress) {
            const url = new URL(window.location.href);
            url.hash = showHistory ? "history" : "";
            window.history.pushState({ view: showHistory ? "history" : "home" }, "", url);
        }

        if (showHistory && typeof loadHistory === "function") loadHistory();
        if (menuPanel) menuPanel.hidden = true;
        if (menuButton) menuButton.setAttribute("aria-expanded", "false");
    }

    document.addEventListener("click", event => {
        const link = event.target.closest("a");
        if (!link) return;

        if (link.getAttribute("href") === "history.html") {
            event.preventDefault();
            showView("history");
        } else if (link.getAttribute("href") === "index.html") {
            event.preventDefault();
            showView("home");
        }
    });

    window.addEventListener("popstate", () => {
        showView(window.location.hash === "#history" ? "history" : "home", false);
    });

    if (window.location.hash === "#history") showView("history", false);
}
