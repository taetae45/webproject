const menuButton = document.getElementById("menuButton");
const menuPanel = document.getElementById("menuPanel");

if (menuButton && menuPanel) {
    menuButton.addEventListener("click", () => {
        const isOpen = menuButton.getAttribute("aria-expanded") === "true";
        menuButton.setAttribute("aria-expanded", String(!isOpen));
        menuPanel.hidden = isOpen;
    });
}
