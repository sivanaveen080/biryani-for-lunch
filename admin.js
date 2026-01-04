// REPLACE with your Apps Script Web App /exec URL
const ORDER_API_URL = 'https://script.google.com/macros/s/AKfycbwT3lfZAMDherJQrzDE1OS41fVqNiLM4CJK_5tw9qpNQDrFadsc-7PZNCiX-FazfZPjug/exec';

// Hard‑coded admin credentials
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin';

// ---- Login ----

document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('loginBtn');
  loginBtn.addEventListener('click', adminLogin);
});

async function adminLogin() {
  const u = document.getElementById('adminUser').value.trim();
  const p = document.getElementById('adminPass').value.trim();
  const err = document.getElementById('loginError');

  if (u === ADMIN_USER && p === ADMIN_PASS) {
    err.textContent = '';
    document.getElementById('loginBox').style.display = 'none';
    document.getElementById('adminApp').style.display = 'block';
    await loadOrders();
    await loadMenu();
  } else {
    err.textContent = 'Invalid username or password';
  }
}

// ---- Orders ----

async function loadOrders() {
  try {
    const res = await fetch(`${ORDER_API_URL}?action=listOrders`);
    const data = await res.json();
    if (!data.success) return;
    const tbody = document.querySelector('#ordersTable tbody');
    tbody.innerHTML = data.orders.map(o => `
      <tr>
        <td>${o.order_id}</td>
        <td>${o.timestamp}</td>
        <td>${o.name}</td>
        <td>${o.mobile}</td>
        <td><pre>${o.items}</pre></td>
        <td>₹${o.payable_total}</td>
        <td>${o.status || 'Pending'}</td>
        <td>
          <select onchange="changeOrderStatus(${o.order_id}, this.value)">
            <option value="">Set status</option>
            <option>Pending</option>
            <option>Accepted</option>
            <option>Out for delivery</option>
            <option>Delivered</option>
            <option>Cancelled</option>
          </select>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    console.error('loadOrders error', e);
  }
}

async function changeOrderStatus(orderId, status) {
  if (!status) return;
  try {
    await fetch(ORDER_API_URL, {
      method: 'POST',
      body: new URLSearchParams({
        action: 'updateOrderStatus',
        orderId: String(orderId),
        status
      })
    });
    loadOrders();
  } catch (e) {
    console.error('changeOrderStatus error', e);
  }
}

// ---- Menu ----

async function loadMenu() {
  try {
    const res = await fetch(`${ORDER_API_URL}?action=listMenu`);
    const data = await res.json();
    if (!data.success) return;
    const tbody = document.querySelector('#menuTable tbody');
    tbody.innerHTML = data.menu.map(m => `
      <tr>
        <td>${m.item_name}</td>
        <td>${m.available ? 'Yes' : 'No'}</td>
        <td>
          <button onclick="setAvailable('${m.item_name.replace(/'/g, "\\'")}', true)">Available</button>
          <button onclick="setAvailable('${m.item_name.replace(/'/g, "\\'")}', false)">Out of stock</button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    console.error('loadMenu error', e);
  }
}

async function setAvailable(itemName, available) {
  try {
    await fetch(ORDER_API_URL, {
      method: 'POST',
      body: new URLSearchParams({
        action: 'updateMenu',
        itemName,
        available: String(available)
      })
    });
    loadMenu();
  } catch (e) {
    console.error('setAvailable error', e);
  }
}


async function loadMenu() {
  try {
    const res = await fetch(`${ORDER_API_URL}?action=listMenu`);
    const data = await res.json();
    if (!data.success) return;
    const tbody = document.querySelector('#menuTable tbody');
    tbody.innerHTML = data.menu.map(m => `
      <tr>
        <td>${m.item_name}</td>
        <td>${m.available ? 'Enabled' : 'Disabled'}</td>
        <td>
          <button class="btn-small ${m.available ? 'btn-secondary' : 'btn-primary'}"
                  onclick="setAvailable('${m.item_name.replace(/'/g, "\\'")}', true)">
            Enable
          </button>
          <button class="btn-small ${m.available ? 'btn-danger' : 'btn-secondary'}"
                  onclick="setAvailable('${m.item_name.replace(/'/g, "\\'")}', false)">
            Disable
          </button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    console.error('loadMenu error', e);
  }
}
