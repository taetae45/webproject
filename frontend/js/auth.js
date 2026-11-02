// เก็บ element หลักของหน้าล็อกอิน หน้าผู้ดูแล และแถบเมนูไว้เรียกใช้ซ้ำ
const authView = document.getElementById('authView');
const adminView = document.getElementById('adminView');
const appHeader = document.getElementById('appHeader');
// อ่าน token สำหรับแนบไปกับคำขอที่ต้องยืนยันตัวตน
const token = () => sessionStorage.getItem('packing_token');

// เรียก API ของ backend และแปลงคำตอบหรือ error ให้อยู่ในรูปที่หน้าเว็บใช้ได้
async function api(url, options = {}) {
    const response = await fetch(API_BASE + url, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.detail || 'Something went wrong. Please try again.');
    return data;
}

// บันทึก session หลังล็อกอิน แล้วแสดงหน้าตามสิทธิ์ของบัญชี
function enter(data) {
    sessionStorage.setItem('packing_token', data.token);
    sessionStorage.setItem('packing_user', data.username);
    authView.hidden = true;
    appHeader.hidden = false;
    if (data.role === 'admin') {
        homeView.hidden = true;
        adminView.hidden = false;
        loadAdmin();
    } else {
        adminView.hidden = true;
        homeView.hidden = false;
    }
}

// แจ้ง backend ให้ออกจากระบบ ล้างข้อมูล session และกลับไปหน้าล็อกอิน
async function logout() {
    try { await api('/api/auth/logout', { method: 'POST', body: JSON.stringify({ token: token() }) }); } catch { }
    sessionStorage.removeItem('packing_token');
    sessionStorage.removeItem('packing_user');
    if (typeof resetBtn !== 'undefined') resetBtn.click();
    adminView.hidden = true;
    homeView.hidden = true;
    appHeader.hidden = true;
    authView.hidden = false;
}

// ผูกปุ่มออกจากระบบทั้งในเมนูและส่วนที่ระบุด้วย data-logout
document.querySelectorAll('[data-logout]').forEach(button => button.onclick = logout);
document.getElementById('menuLogout').onclick = logout;
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const authMessage = document.getElementById('authMessage');
const registerToggle = document.getElementById('registerToggle');
const loginToggle = document.getElementById('loginToggle');

// สลับจากแบบฟอร์มล็อกอินไปยังแบบฟอร์มสมัครพนักงาน
registerToggle.onclick = () => {
    loginForm.hidden = true;
    registerForm.hidden = false;
    registerToggle.hidden = true;
    loginToggle.hidden = false;
    document.getElementById('authTitle').textContent = 'Employee Registration';
    authMessage.textContent = '';
};
// กลับจากแบบฟอร์มสมัครพนักงานไปยังแบบฟอร์มล็อกอิน
loginToggle.onclick = () => {
    registerForm.hidden = true;
    loginForm.hidden = false;
    registerToggle.hidden = false;
    loginToggle.hidden = true;
    document.getElementById('authTitle').textContent = 'Sign In';
    authMessage.textContent = '';
};
// ส่งข้อมูลล็อกอินไปตรวจสอบ แล้วเปิดหน้าที่ตรงกับบทบาทเมื่อสำเร็จ
loginForm.onsubmit = async event => {
    event.preventDefault();
    authMessage.textContent = '';
    try {
        enter(await api('/api/auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(loginForm))) }));
    } catch (error) { authMessage.textContent = error.message; }
};
// ส่งข้อมูลสมัครพนักงาน และกลับไปหน้าเข้าสู่ระบบเมื่อสร้างบัญชีสำเร็จ
registerForm.onsubmit = async event => {
    event.preventDefault();
    authMessage.textContent = '';
    try {
        await api('/api/auth/register', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(registerForm))) });
        registerForm.reset();
        loginToggle.click();
        authMessage.textContent = 'Registration complete. You can now sign in.';
    } catch (error) { authMessage.textContent = error.message; }
};

// แปลงอักขระพิเศษเป็น HTML entity ก่อนนำข้อมูลไปแสดงใน HTML
function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

// โหลดข้อมูลภาพรวม แล้ววาดสถิติ รายการออร์เดอร์ และบัญชีพนักงานในหน้าแอดมิน
async function loadAdmin() {
    try {
        const data = await api('/api/admin/overview?token=' + encodeURIComponent(token()));
        storeProducts = data.products || [];
        document.getElementById('adminContent').innerHTML = `
            <div class="stats">
                <article><b>${data.users.length}</b><span>Employees</span></article>
                <article><b>${data.completed.length}</b><span>Orders Packed</span></article>
            </div>
            <section class="admin-panel"><h2>Packed Orders — Customer Changes</h2><p>Edit the products in an order when a customer requests a change after packing.</p><div class="table-wrap"><table><thead><tr><th>Order</th><th>Packed By</th><th>Packed At</th><th>Items</th><th>Actions</th></tr></thead><tbody>${data.completed.map(order => `<tr><td>${escapeHtml(order.id)}</td><td>${escapeHtml(order.employee || 'Not recorded')}</td><td>${new Date(order.completed_at).toLocaleString('en-US')}</td><td>${order.items.map(escapeHtml).join(', ') || 'No items'}</td><td><button onclick="editOrder('${encodeURIComponent(order.record_id)}','${encodeURIComponent(JSON.stringify(order.items))}','${encodeURIComponent(order.id)}')">Edit Items</button> <button class="danger" onclick="deleteOrder('${encodeURIComponent(order.record_id)}')">Delete</button></td></tr>`).join('') || '<tr><td colspan="5">No packed orders yet.</td></tr>'}</tbody></table></div></section>
            <section class="admin-panel"><h2>Employees</h2><div class="table-wrap"><table><thead><tr><th>Username</th><th>Name</th><th>Date of Birth</th><th>National ID</th><th>Actions</th></tr></thead><tbody>
                ${data.users.map(user => `<tr><td>${escapeHtml(user.username)}</td><td>${escapeHtml(user.first_name)} ${escapeHtml(user.last_name)}</td><td>${escapeHtml(user.dob)}</td><td>${escapeHtml(user.national_id)}</td><td><button onclick="editUser('${encodeURIComponent(user.username)}','${encodeURIComponent(user.first_name)}','${encodeURIComponent(user.last_name)}','${encodeURIComponent(user.dob)}','${encodeURIComponent(user.national_id)}')">Edit</button> <button class="danger" onclick="deleteUser('${encodeURIComponent(user.username)}')">Delete</button></td></tr>`).join('') || '<tr><td colspan="5">No employee accounts yet.</td></tr>'}
            </tbody></table></div></section>
        `;
    } catch (error) { document.getElementById('adminContent').textContent = error.message; }
}

// เก็บ element และสถานะของหน้าต่างแก้ไขข้อมูล
const editDialog = document.getElementById('editDialog');
const editDialogForm = document.getElementById('editDialogForm');
const editDialogBody = document.getElementById('editDialogBody');
const editDialogMessage = document.getElementById('editDialogMessage');
let activeEdit = null;
let storeProducts = [];

// ตั้งชื่อ เนื้อหา และชนิดข้อมูลที่กำลังแก้ ก่อนเปิด dialog
function showEditDialog(title, content, mode) {
    activeEdit = mode;
    document.getElementById('editDialogTitle').textContent = title;
    editDialogBody.innerHTML = content;
    editDialogMessage.textContent = '';
    editDialog.showModal();
}
// ปิด dialog และล้างสถานะการแก้ไขปัจจุบัน
function closeEditDialog() { editDialog.close(); activeEdit = null; }
document.getElementById('closeEditDialog').onclick = closeEditDialog;
document.getElementById('cancelEditDialog').onclick = closeEditDialog;
editDialog.addEventListener('click', event => { if (event.target === editDialog) closeEditDialog(); });

// สร้างแบบฟอร์มแก้ไขข้อมูลพนักงานจากข้อมูลที่ส่งมาจากแถวในตาราง
window.editUser = (encodedUser, encodedFirst, encodedLast, encodedDob, encodedId) => {
    const username = decodeURIComponent(encodedUser);
    const fields = [
        ['first_name', 'First Name', decodeURIComponent(encodedFirst), 'text'],
        ['last_name', 'Last Name', decodeURIComponent(encodedLast), 'text'],
        ['dob', 'Date of Birth', decodeURIComponent(encodedDob), 'date'],
        ['national_id', 'National ID Number', decodeURIComponent(encodedId), 'text']
    ];
    const content = `<p class="dialog-current">Editing employee: <strong>${escapeHtml(username)}</strong></p><div class="dialog-fields">${fields.map(([name, label, value, type]) => `<label>${label}<input name="${name}" type="${type}" value="${escapeHtml(value)}" required></label>`).join('')}</div>`;
    showEditDialog('Edit Employee Profile', content, { type: 'user', username });
};

// ยืนยันก่อนลบบัญชี แล้วโหลดข้อมูลแอดมินใหม่หลัง backend ตอบสำเร็จ
window.deleteUser = async username => {
    if (!confirm('Are you sure you want to delete this employee account?')) return;
    try { await api('/api/admin/users/' + username + '?token=' + encodeURIComponent(token()), { method: 'DELETE' }); loadAdmin(); }
    catch (error) { alert(error.message); }
};
// ยืนยันก่อนลบประวัติออร์เดอร์ที่แพ็กแล้ว
window.deleteOrder = async recordId => {
    if (!confirm('Delete this packed order from the order history?')) return;
    try { await api('/api/admin/completed-orders/' + decodeURIComponent(recordId) + '?token=' + encodeURIComponent(token()), { method: 'DELETE' }); loadAdmin(); }
    catch (error) { alert(error.message); }
};

// สร้างแถวเลือกสินค้าและจำนวน สำหรับใช้ในหน้าต่างแก้ไขออร์เดอร์
function orderItemRow(product = '', quantity = 1) {
    const products = [...new Set([...storeProducts, ...(product ? [product] : [])])];
    return `<div class="order-edit-row"><select class="edit-product" aria-label="Product">${products.map(item => `<option value="${escapeHtml(item)}" ${item === product ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}</select><div class="quantity-control"><button type="button" data-quantity="minus" aria-label="Decrease quantity">−</button><input class="edit-quantity" type="number" min="1" step="1" value="${quantity}" aria-label="Quantity"><button type="button" data-quantity="plus" aria-label="Increase quantity">+</button></div><button type="button" class="remove-item" aria-label="Remove item">Remove</button></div>`;
}
// รวมสินค้าซ้ำเป็นแถวพร้อมจำนวน และผูกปุ่มเพิ่ม ลด หรือนำสินค้าออก
window.editOrder = (encodedRecordId, encodedItems, encodedOrderId) => {
    const recordId = decodeURIComponent(encodedRecordId);
    const id = decodeURIComponent(encodedOrderId);
    const orderItems = JSON.parse(decodeURIComponent(encodedItems));
    const counts = new Map();
    orderItems.forEach(item => counts.set(item, (counts.get(item) || 0) + 1));
    const rows = [...counts].map(([product, quantity]) => orderItemRow(product, quantity)).join('');
    const content = `<p class="dialog-current">Edit products in order <strong>${escapeHtml(id)}</strong>.</p><div id="orderEditRows">${rows || orderItemRow(storeProducts[0] || '', 1)}</div><button type="button" id="addOrderItem" class="add-item">+ Add Product</button>`;
    showEditDialog('Edit Packed Order', content, { type: 'order', recordId, id });
    document.getElementById('addOrderItem').onclick = () => document.getElementById('orderEditRows').insertAdjacentHTML('beforeend', orderItemRow(storeProducts[0] || '', 1));
    document.getElementById('orderEditRows').onclick = event => {
        const button = event.target.closest('button');
        if (!button) return;
        const row = button.closest('.order-edit-row');
        if (button.dataset.quantity) {
            const input = row.querySelector('.edit-quantity');
            input.value = Math.max(1, (parseInt(input.value, 10) || 1) + (button.dataset.quantity === 'plus' ? 1 : -1));
        } else if (button.classList.contains('remove-item')) {
            if (document.querySelectorAll('.order-edit-row').length === 1) row.querySelector('.edit-quantity').value = 0;
            else row.remove();
        }
    };
};

// บันทึกข้อมูลที่แก้ไข โดยเลือก API ตามชนิดข้อมูลที่เปิดใน dialog
editDialogForm.onsubmit = async event => {
    event.preventDefault();
    if (!activeEdit) return;
    editDialogMessage.textContent = '';
    try {
        if (activeEdit.type === 'user') {
            const profile = Object.fromEntries(new FormData(editDialogForm));
            await api('/api/admin/users/' + encodeURIComponent(activeEdit.username) + '?token=' + encodeURIComponent(token()), { method: 'PUT', body: JSON.stringify(profile) });
        } else {
            const items = [];
            document.querySelectorAll('#orderEditRows .order-edit-row').forEach(row => {
                const quantity = Math.max(0, parseInt(row.querySelector('.edit-quantity').value, 10) || 0);
                for (let index = 0; index < quantity; index++) items.push(row.querySelector('.edit-product').value);
            });
            await api('/api/admin/completed-orders/' + encodeURIComponent(activeEdit.recordId) + '?token=' + encodeURIComponent(token()), { method: 'PUT', body: JSON.stringify({ items }) });
        }
        closeEditDialog();
        loadAdmin();
    } catch (error) { editDialogMessage.textContent = error.message; }
};

// ล้าง token แบบเก่าที่อาจค้างใน localStorage เพื่อใช้ sessionStorage เป็นแหล่ง session เดียว
localStorage.removeItem('packing_token');
localStorage.removeItem('packing_user');
// ตรวจสอบ token ที่ค้างอยู่กับ backend เพื่อกลับเข้าสู่ระบบอัตโนมัติ
if (token()) {
    api('/api/auth/session?token=' + encodeURIComponent(token()))
        .then(session => enter({ ...session, token: token() }))
        .catch(() => {
            sessionStorage.removeItem('packing_token');
            sessionStorage.removeItem('packing_user');
        });
} else {
    // หากยังไม่มี session ให้ซ่อนหน้าระบบไว้และแสดงหน้าล็อกอิน
    homeView.hidden = true;
    appHeader.hidden = true;
}
