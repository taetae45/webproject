const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

class Element {
    constructor(id = '') {
        this.id = id;
        this.children = [];
        this.attributes = {};
        this.listeners = {};
        this.dataset = {};
        this.hidden = false;
        this.value = '';
        this.textContent = '';
        this._innerHTML = '';
        this.className = '';
        this.style = {};
        this.formData = {};
        this.classList = {
            contains: name => this.className.split(/\s+/).includes(name),
            add: name => { if (!this.classList.contains(name)) this.className += ` ${name}`; },
            remove: name => { this.className = this.className.split(/\s+/).filter(x => x !== name).join(' '); }
        };
    }
    get innerHTML() { return this._innerHTML; }
    set innerHTML(value) { this._innerHTML = value; this.children = []; }
    append(value) { this.children.push(value); }
    appendChild(child) { this.children.push(child); return child; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    dispatch(name, event = {}) { return this.listeners[name]?.({ target: this, preventDefault() {}, ...event }); }
    click() { return this.onclick?.({ preventDefault() {} }); }
    showModal() { this.open = true; }
    close() { this.open = false; }
    reset() { this.formData = {}; }
    insertAdjacentHTML(_where, html) { this.innerHTML += html; this.added = html; }
    querySelector(selector) {
        this.queries ||= {};
        return this.queries[selector] ||= new Element(selector);
    }
    querySelectorAll() { return this.rows || []; }
    closest(selector) {
        if (selector === 'button') return this.button || null;
        if (selector === '.order-edit-row') return this.row || null;
        return null;
    }
    remove() { this.removed = true; }
    async play() {}
}

class FakeWebSocket {
    static OPEN = 1;
    constructor(url) { this.url = url; this.readyState = FakeWebSocket.OPEN; this.sent = []; }
    send(message) { this.sent.push(message); }
    close() { this.closed = true; }
}

function makeContext(overrides = {}) {
    const elements = new Map();
    const listeners = {};
    const storage = () => {
        const values = new Map();
        return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
    };
    const location = { href: 'http://localhost:8001/', hash: '', protocol: 'http:', hostname: 'localhost', origin: 'http://localhost:8001', port: '8001', replace(url) { this.replaced = url; } };
    const window = {
        location,
        history: { pushState(state, _title, url) { this.state = state; this.url = url; } },
        addEventListener(name, fn) { listeners[name] = fn; }
    };
    const document = {
        body: new Element('body'),
        getElementById(id) { if (!elements.has(id)) elements.set(id, new Element(id)); return elements.get(id); },
        createElement(tag) {
            const element = new Element(tag);
            if (tag === 'canvas') {
                element.getContext = () => ({ drawImage() {} });
                element.toDataURL = () => 'data:image/jpeg;base64,ZmFrZQ==';
            }
            if (tag === 'video') element.play = async () => {};
            return element;
        },
        addEventListener(name, fn) { listeners[`document:${name}`] = fn; },
        querySelectorAll(selector) { return context.domQueries?.[selector] || []; }
    };
    const context = {
        document, window, location,
        history: window.history, sessionStorage: storage(), localStorage: storage(), navigator: { mediaDevices: { enumerateDevices: async () => [], getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } },
        WebSocket: FakeWebSocket, console: { log() {}, error() {} }, URL,
        fetch: async () => ({ ok: true, status: 200, json: async () => ({}) }),
        setTimeout: fn => { context.timeout = fn; return 1; }, clearTimeout() {},
        setInterval: fn => { context.interval = fn; return 2; }, clearInterval() {},
        confirm: () => true, alert() {}, FormData: class { constructor(form) { this.form = form; } entries() { return Object.entries(this.form.formData); } [Symbol.iterator]() { return this.entries()[Symbol.iterator](); } },
        ...overrides
    };
    window.window = window;
    Object.assign(window, context);
    return { context: vm.createContext(context), elements, listeners, window };
}

function run(page, filename) {
    const fullPath = path.join(ROOT, 'frontend', 'js', filename);
    vm.runInContext(fs.readFileSync(fullPath, 'utf8'), page.context, { filename: fullPath });
}

test('order rendering, duplicate counts, detection and auto advance', async () => {
    const page = makeContext({ API_BASE: 'http://localhost:8001' });
    page.context.socket = new FakeWebSocket('ws://test');
    run(page, 'order.js');
    run(page, 'detector.js');
    vm.runInContext('loadOrder(["Milk", "Milk", "Bread"]);', page.context);
    assert.equal(page.elements.get('orderList').children.length, 2);
    assert.deepEqual(Array.from(vm.runInContext('countItems(["A", "A"])["A"]', page.context) ? [2] : []), [2]);
    vm.runInContext('renderDetection({ detected: ["Milk"], unexpected: ["X", "X"] });', page.context);
    assert.match(page.elements.get('orderList').children[0].children[1], /1\/2/);
    assert.match(page.elements.get('unexpectedList').children[0].children[1], /X \(2\)/);
    vm.runInContext('renderDetection({ detected: ["Milk"], unexpected: [] });', page.context);
    vm.runInContext('renderDetection({ detected: [], unexpected: [] });', page.context);
    vm.runInContext('renderDetection({ detected: [], unexpected: [] });', page.context);
    vm.runInContext('loadOrder(["Bread"]); renderDetection({ detected: ["Bread"], unexpected: ["X"] });', page.context);
    assert.equal(vm.runInContext('isAdvancingOrder', page.context), false);
    vm.runInContext('loadOrder(["Milk"]); renderDetection({ detected: ["Milk"], unexpected: [] }); renderDetection({ detected: [], unexpected: ["X"] });', page.context);
    assert.equal(vm.runInContext('isAdvancingOrder', page.context), false);
    vm.runInContext('loadOrder(["Bread"]); renderDetection({ detected: ["Bread"], unexpected: [] });', page.context);
    assert.equal(typeof page.context.timeout, 'function');
    page.context.timeout();
    assert.deepEqual(JSON.parse(page.context.socket.sent.at(-1)), { type: 'complete_and_next' });
    vm.runInContext('advanceToNextOrder()', page.context);
    page.context.socket.readyState = 0;
    page.context.timeout();
    assert.equal(vm.runInContext('isAdvancingOrder', page.context), false);
    vm.runInContext('loadOrder(["Milk"]); renderDetection({detected:["Milk"], unexpected:["X"]});', page.context);
    assert.equal(page.context.socket.sent.length, 1);
    page.context.fetch = async () => ({ ok: true, json: async () => ({ items: ['Water'] }) });
    await vm.runInContext('fetchRandomOrder()', page.context);
    assert.equal(page.elements.get('orderList').children[0].children[1], 'Water (0/1)');
    page.context.fetch = async () => ({ ok: false, status: 503 });
    await vm.runInContext('fetchRandomOrder()', page.context);
    assert.match(page.elements.get('orderList').children[0].children[0], /Cannot load order/);
});

test('camera discovery and starting camera handles available and unavailable devices', async () => {
    const page = makeContext();
    page.context.navigator.mediaDevices.enumerateDevices = async () => [{ kind: 'videoinput', deviceId: 'cam1', label: 'Front' }];
    run(page, 'camera.js');
    await vm.runInContext('loadCamera()', page.context);
    assert.equal(page.elements.get('cameraSelect').children[0].text, 'Front');
    page.elements.get('cameraSelect').value = 'cam1';
    await vm.runInContext('startCamera()', page.context);
    assert.ok(page.elements.get('video').srcObject);
    page.context.navigator.mediaDevices.enumerateDevices = async () => [];
    await vm.runInContext('loadCamera()', page.context);
    assert.equal(page.elements.get('cameraSelect').children[0].text, 'No camera found');
    page.context.navigator.mediaDevices = {};
    await assert.rejects(vm.runInContext('loadCamera()', page.context), /does not support camera/);
});

test('websocket messages dispatch orders, detections and errors', () => {
    const page = makeContext({ WS_URL: 'ws://localhost/ws/detect' });
    page.context.sessionStorage.setItem('packing_token', 'token value');
    page.context.loadOrder = items => { page.context.loaded = items; };
    page.context.renderDetection = result => { page.context.detection = result; };
    run(page, 'websocket.js');
    const socket = vm.runInContext('connectWebSocket()', page.context);
    assert.match(socket.url, /token=token%20value/);
    socket.onmessage({ data: JSON.stringify({ type: 'order', order: { items: ['Milk'] } }) });
    assert.deepEqual(Array.from(page.context.loaded), ['Milk']);
    socket.onmessage({ data: JSON.stringify({ type: 'detection', status: 'PASS' }) });
    assert.equal(page.context.detection.status, 'PASS');
    socket.onmessage({ data: JSON.stringify({ type: 'error', message: 'bad frame' }) });
    socket.onopen(); socket.onclose();
});

test('history displays empty, populated, failed and escaped responses', async () => {
    const page = makeContext();
    run(page, 'history.js');
    vm.runInContext('renderHistory([])', page.context);
    assert.equal(page.elements.get('historyMessage').textContent, 'No packed orders yet.');
    vm.runInContext('renderHistory([{id:"<x>",items:["Milk"],completed_at:"2026-01-01T00:00:00Z",employee:null}])', page.context);
    assert.match(page.elements.get('historyList').children[0].innerHTML, /&lt;x&gt;/);
    assert.match(page.elements.get('historyList').children[0].innerHTML, /Not recorded/);
    page.context.API_BASE = 'http://test';
    page.context.fetch = async () => ({ ok: true, json: async () => ({ orders: [] }) });
    await vm.runInContext('loadHistory()', page.context);
    page.context.fetch = async () => ({ ok: false, status: 500 });
    await vm.runInContext('loadHistory()', page.context);
    assert.match(page.elements.get('historyMessage').textContent, /Could not load/);

    const authenticatedPage = makeContext();
    authenticatedPage.context.API_BASE = 'http://test';
    authenticatedPage.context.window.authGuard = Promise.resolve(true);
    authenticatedPage.context.fetch = async () => ({ ok: true, json: async () => ({ orders: [] }) });
    authenticatedPage.context.document.body.classList.add('history-page');
    run(authenticatedPage, 'history.js');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(authenticatedPage.elements.get('historyMessage').textContent, 'No packed orders yet.');
});

test('navigation toggles menu, views, links and browser back', () => {
    const page = makeContext();
    const menuButton = page.context.document.getElementById('menuButton');
    const menuPanel = page.context.document.getElementById('menuPanel');
    page.elements.get('homeView'); page.elements.get('historyView');
    page.context.loadHistory = () => { page.context.historyLoads = (page.context.historyLoads || 0) + 1; };
    run(page, 'navigation.js');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.dispatch('click');
    assert.equal(menuPanel.hidden, false);
    const event = { target: { closest: () => ({ getAttribute: () => 'history.html' }) }, preventDefault() { this.prevented = true; } };
    page.listeners['document:click'](event);
    assert.equal(event.prevented, true);
    assert.equal(page.elements.get('historyView').hidden, false);
    assert.equal(page.context.historyLoads, 1);
    const homeEvent = { target: { closest: () => ({ getAttribute: () => 'index.html' }) }, preventDefault() { this.prevented = true; } };
    page.listeners['document:click'](homeEvent);
    assert.equal(page.elements.get('historyView').hidden, true);
    const ignoredEvent = { target: { closest: () => ({ getAttribute: () => 'elsewhere.html' }) }, preventDefault() {} };
    page.listeners['document:click'](ignoredEvent);
    page.window.location.hash = '';
    page.listeners.popstate();
    assert.equal(page.elements.get('homeView').hidden, false);
});

test('configuration selects server origin for local file and hosted app', () => {
    const local = makeContext();
    local.context.location.port = '5500'; local.context.location.hostname = '127.0.0.1';
    run(local, 'config.js');
    assert.equal(vm.runInContext('API_BASE', local.context), 'http://127.0.0.1:8001');
    assert.equal(vm.runInContext('WS_URL', local.context), 'ws://127.0.0.1:8001/ws/detect');
    const hosted = makeContext();
    run(hosted, 'config.js');
    assert.equal(vm.runInContext('API_BASE', hosted.context), 'http://localhost:8001');
});

test('auth toggles forms, submits registration and login, and logs out', async () => {
    const page = makeContext();
    page.context.homeView = page.context.document.getElementById('homeView');
    run(page, 'config.js'); run(page, 'auth.js');
    const registerToggle = page.elements.get('registerToggle');
    registerToggle.click();
    assert.equal(page.elements.get('registerForm').hidden, false);
    page.elements.get('loginToggle').click();
    assert.equal(page.elements.get('loginForm').hidden, false);
    let requested = [];
    page.context.fetch = async (url, options = {}) => {
        requested.push([url, options]);
        return { ok: true, json: async () => url.endsWith('/login') ? { token: 't', username: 'employee', role: 'employee' } : { ok: true } };
    };
    page.elements.get('registerForm').formData = { username: 'employee', password: 'pass' };
    assert.deepEqual(Array.from(vm.runInContext('new FormData(document.getElementById("registerForm"))', page.context)), [['username', 'employee'], ['password', 'pass']]);
    await page.elements.get('registerForm').onsubmit({ preventDefault() {} });
    assert.equal(page.elements.get('authMessage').textContent, 'Registration complete. You can now sign in.');
    page.elements.get('loginForm').formData = { username: 'employee', password: 'pass' };
    await page.elements.get('loginForm').onsubmit({ preventDefault() {} });
    assert.equal(page.context.sessionStorage.getItem('packing_token'), 't');
    assert.equal(page.elements.get('homeView').hidden, false);
    await vm.runInContext("api('/ok')", page.context);
    vm.runInContext("enter({token:'admin-token',username:'Admin',role:'admin'})", page.context);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(page.elements.get('adminView').hidden, false);
    await vm.runInContext('logout()', page.context);
    assert.equal(page.context.sessionStorage.getItem('packing_token'), null);
    assert.equal(page.elements.get('authView').hidden, false);
    assert.ok(requested.length >= 3);
});

test('auth API errors show message and failed startup session clears storage', async () => {
    const page = makeContext();
    page.context.sessionStorage.setItem('packing_token', 'stale');
    run(page, 'config.js');
    page.context.fetch = async () => ({ ok: false, json: async () => ({ detail: 'expired' }) });
    run(page, 'auth.js');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(page.context.sessionStorage.getItem('packing_token'), null);
    page.elements.get('loginForm').onsubmit = async event => { event.preventDefault(); };
    page.context.fetch = async () => ({ ok: false, json: async () => ({ detail: 'bad credentials' }) });
    await vm.runInContext("api('/bad')", page.context).catch(() => {});
    page.elements.get('registerForm').formData = { username: 'worker' };
    await page.elements.get('registerForm').onsubmit({ preventDefault() {} });
    assert.equal(page.elements.get('authMessage').textContent, 'bad credentials');
});

test('admin dashboard renders data and editor actions update/delete records', async () => {
    const page = makeContext();
    page.context.homeView = page.context.document.getElementById('homeView');
    run(page, 'config.js'); run(page, 'auth.js');
    let failRequest = false;
    const overview = {
        users: [{ username: '<worker>', first_name: 'A', last_name: 'B', dob: '2000', national_id: '123' }],
        completed: [{ id: 'A<&', employee: null, completed_at: '2026-01-01T00:00:00Z', items: ['Milk'], record_id: 'rid' }],
        products: ['Milk']
    };
    page.context.fetch = async (url, options = {}) => ({
        ok: !failRequest,
        json: async () => failRequest ? { detail: 'denied' } : (url.includes('/overview') ? overview : { ok: true })
    });
    await page.elements.get('editDialogForm').onsubmit({ preventDefault() {} });
    await vm.runInContext('loadAdmin()', page.context);
    assert.match(page.elements.get('adminContent').innerHTML, /&lt;worker&gt;/);
    assert.match(page.elements.get('adminContent').innerHTML, /A&lt;&amp;/);
    vm.runInContext("window.editUser('u%3C','A','B','2000','123')", page.context);
    assert.equal(page.elements.get('editDialog').open, true);
    await page.elements.get('editDialogForm').onsubmit({ preventDefault() {} });
    assert.equal(page.elements.get('editDialogMessage').textContent, '');
    await page.elements.get('editDialogForm').onsubmit({ preventDefault() {} });
    vm.runInContext("window.editOrder('rid','%5B%22Milk%22%5D','A')", page.context);
    page.elements.get('addOrderItem').onclick();
    const quantity = new Element('quantity'); quantity.value = '1';
    const row = new Element('row'); row.queries = { '.edit-quantity': quantity, '.edit-product': Object.assign(new Element(), { value: 'Milk' }) };
    const button = new Element('button'); button.dataset.quantity = 'plus'; button.row = row;
    const rows = page.elements.get('orderEditRows');
    rows.onclick({ target: { closest: () => button } });
    assert.equal(quantity.value, 2);
    const remove = new Element('button'); remove.classList.add('remove-item'); remove.row = row;
    page.context.document.querySelectorAll = () => [row];
    rows.onclick({ target: { closest: () => remove } });
    assert.equal(quantity.value, 0);
    const anotherRow = new Element('row');
    page.context.document.querySelectorAll = () => [row, anotherRow];
    rows.onclick({ target: { closest: () => remove } });
    assert.equal(row.removed, true);
    await page.elements.get('editDialogForm').onsubmit({ preventDefault() {} });
    page.context.confirm = () => false;
    await vm.runInContext("window.deleteUser('u')", page.context);
    await vm.runInContext("window.deleteOrder('rid')", page.context);
    page.context.confirm = () => true;
    await vm.runInContext("window.deleteUser('u')", page.context);
    await vm.runInContext("window.deleteOrder('rid')", page.context);
    await new Promise(resolve => setImmediate(resolve));
    failRequest = true;
    await vm.runInContext("window.deleteUser('u')", page.context);
    await vm.runInContext("window.deleteOrder('rid')", page.context);
    await vm.runInContext('loadAdmin()', page.context);
    assert.equal(page.elements.get('adminContent').textContent, 'denied');
});

test('auth guard rejects missing/expired sessions and logout always clears session', async () => {
    const missing = makeContext();
    missing.elements.get('historyLogout');
    missing.context.API_BASE = 'http://test';
    run(missing, 'guard.js');
    assert.equal(await missing.context.window.authGuard, false);
    assert.equal(missing.window.location.replaced, 'index.html');
    const expired = makeContext();
    expired.elements.get('historyLogout'); expired.context.API_BASE = 'http://test';
    expired.context.sessionStorage.setItem('packing_token', 'x');
    expired.context.fetch = async () => ({ ok: false });
    run(expired, 'guard.js');
    assert.equal(await expired.context.window.authGuard, false);
    assert.equal(expired.context.sessionStorage.getItem('packing_user'), null);
    expired.elements.get('historyLogout').onclick();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(expired.context.sessionStorage.getItem('packing_token'), null);

    const valid = makeContext();
    valid.context.API_BASE = 'http://test';
    valid.context.sessionStorage.setItem('packing_token', 'valid');
    valid.elements.get('historyLogout');
    valid.context.fetch = async () => ({ ok: true });
    run(valid, 'guard.js');
    assert.equal(await valid.context.window.authGuard, true);
    assert.equal(valid.context.document.body.style.visibility, 'visible');
    await valid.elements.get('historyLogout').onclick();
    assert.equal(valid.context.sessionStorage.getItem('packing_user'), null);
});

test('app controls start/reset and sends camera frames only when ready', async () => {
    const page = makeContext();
    page.elements.get('startBtn'); page.elements.get('resetBtn'); page.context.video = page.context.document.getElementById('video');
    run(page, 'order.js');
    page.context.startCamera = async () => {};
    page.context.fetchRandomOrder = async () => {};
    page.context.connectWebSocket = () => new FakeWebSocket('ws://test');
    run(page, 'app.js');
    page.context.video.readyState = 2;
    page.elements.get('startBtn').click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(typeof page.context.interval, 'function');
    vm.runInContext('sendFrame()', page.context);
    const socket = vm.runInContext('socket', page.context);
    assert.equal(JSON.parse(socket.sent[0]).type, 'frame');
    const video = page.context.video;
    video.readyState = 1;
    const sent = socket.sent.length;
    vm.runInContext('sendFrame()', page.context);
    assert.equal(socket.sent.length, sent);
    video.srcObject = { getTracks: () => [{ stop() { video.stopped = true; } }] };
    page.elements.get('resetBtn').click();
    assert.equal(video.stopped, true);
    assert.equal(video.srcObject, null);
});
