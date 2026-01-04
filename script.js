// ---------------- GLOBAL STATE ----------------

// cart will store objects like { name, price, qty }
let cart = [];

// Google Apps Script Web App URL (POST endpoint)
const ORDER_API_URL = 'https://script.google.com/macros/s/AKfycbwT3lfZAMDherJQrzDE1OS41fVqNiLM4CJK_5tw9qpNQDrFadsc-7PZNCiX-FazfZPjug/exec';

// holds the order id returned from Google Sheets (1, 2, 3, ...)
let currentOrderId = null;

// prevent double submit
let isPlacingOrder = false;


// ---------------- ADD TO CART WITH QUANTITY ----------------

function addToCart(name, price) {
  const existing = cart.find(item => item.name === name);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ name, price, qty: 1 });
  }

  updateCart();
}


// ---------------- CHANGE QTY FROM + / - BUTTONS ON CARD ----------------

function changeQty(button, delta) {
  // block clicks on out-of-stock cards
  if (button.closest('.product-card')?.classList.contains('out-of-stock')) {
    return;
  }

  const wrapper = button.closest('.qty-controls');
  const name = wrapper.getAttribute('data-name');
  const price = parseInt(wrapper.getAttribute('data-price'), 10);
  const valueSpan = wrapper.querySelector('.qty-value');

  let current = parseInt(valueSpan.textContent, 10);
  if (isNaN(current)) current = 0;

  let next = current + delta;
  if (next < 0) next = 0;

  valueSpan.textContent = next;

  const existing = cart.find(item => item.name === name);

  if (next === 0) {
    if (existing) {
      cart = cart.filter(item => item.name !== name);
    }
  } else {
    if (existing) {
      existing.qty = next;
    } else {
      cart.push({ name, price, qty: next });
    }
  }

  updateCart();
}


// ---------------- UPDATE CART DISPLAY ----------------

function updateCart() {
  const cartItemsBody = document.getElementById('cartItems');
  const cartCount = document.getElementById('cartCount');
  const itemsTotalSpan = document.getElementById('itemsTotal');
  const totalSpan = document.getElementById('total');

  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  cartCount.textContent = totalQty;

  cartItemsBody.innerHTML = cart.map((item) => {
    const lineTotal = item.price * item.qty;
    return `
      <tr>
        <td>${item.name} x${item.qty} - ₹${lineTotal}</td>
      </tr>
    `;
  }).join('');

  const itemsTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  const shipping = 40;              // not added to payable
  const payableTotal = itemsTotal;  // free shipping

  itemsTotalSpan.textContent = itemsTotal;
  totalSpan.textContent = payableTotal;
}


// ---------------- OPEN / CLOSE POPUP ----------------

function openOrderPopup() {
  if (cart.length === 0) {
    alert('Cart is empty!');
    return;
  }

  document.getElementById('popupOrderId').textContent = '...';
  document.getElementById('orderPopup').style.display = 'flex';
}

function closeOrderPopup() {
  document.getElementById('orderPopup').style.display = 'none';
}


// ---------------- CONFIRM ORDER + SAVE TO SHEET + WHATSAPP ----------------

async function confirmOrder() {
  if (isPlacingOrder) {
    return; // ignore double-clicks / taps
  }
  isPlacingOrder = true;

  const name = document.getElementById('customerName').value.trim();
  const mobile = document.getElementById('customerMobile').value.trim();

  if (!name) {
    alert('Please enter your name');
    isPlacingOrder = false;
    return;
  }

  const mobileRegex = /^[1-9]\d{9}$/;
  if (!mobileRegex.test(mobile)) {
    alert('Enter a valid 10-digit mobile number (cannot start with 0)');
    isPlacingOrder = false;
    return;
  }

  const itemsTotal = cart.re
