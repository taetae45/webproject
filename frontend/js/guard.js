document.body.style.visibility = 'hidden';
window.authGuard = (async () => {
    const authToken = sessionStorage.getItem('packing_token');
    if (!authToken) {
        window.location.replace('index.html');
        return false;
    }
    try {
        const response = await fetch(`${API_BASE}/api/auth/session?token=${encodeURIComponent(authToken)}`);
        if (!response.ok) throw new Error('Session expired');
        document.body.style.visibility = 'visible';
        return true;
    } catch {
        sessionStorage.removeItem('packing_token');
        sessionStorage.removeItem('packing_user');
        window.location.replace('index.html');
        return false;
    }
})();

document.getElementById('historyLogout').onclick = async () => {
    const authToken = sessionStorage.getItem('packing_token');
    try {
        await fetch(`${API_BASE}/api/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: authToken })
        });
    } finally {
        sessionStorage.removeItem('packing_token');
        sessionStorage.removeItem('packing_user');
        window.location.replace('index.html');
    }
};
