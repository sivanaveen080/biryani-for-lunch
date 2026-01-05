// ---------------- GLOBAL STATE ----------------

// cart will store objects like { name, price, qty }
let cart = [];

// Google Apps Script Web App URL (POST endpoint)
const ORDER_API_URL = 'https://script.google.com/macros/s/AKfycbzJH2_CUx0BERMigLxykpXDtsHZwYccxuH_y-IUtREC9RMydUnaOGLXdIi6DNsV_9SH0g/exec';

// holds the order id returned from Google Sheets (1, 2, 3, ...)
let currentOrderId = null;

// prevent double submit
let isPlacingOrder = false;


// ---------------- ORDERING TIME WINDOW ----------------

// true if current time is between 16:00 and next-day 11:30
function isWithinOrderingWindow() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const minutes = h * 60 + m;

  const start = 22 * 60;        // 16:00 -> 960
  const end = 11 * 60 + 30;     // 11:30 -> 690

  // range crosses midnight: valid if time >= start OR time <= end
  return minutes >= start || minutes <= end;
}


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

  // allow orders only from 4:00 PM to next day 11:30 AM
  if (!isWithinOrderingWindow()) {
    alert(
      'Orders can be placed only between 4:00 PM and next day 11:30 AM.\n' +
      'Please visit again during that time window.'
    );
    return;
  }

  document.getElementById('popupOrderId').textContent = '...';

  // set delivery information text on the popup
  const infoEl = document.getElementById('deliveryInfo');
  if (infoEl) {
    infoEl.textContent = 'Orders will be delivered between 1:30 PM and 3:00 PM.';
  }

  document.getElementById('orderPopup').style.display = 'flex';
}

function closeOrderPopup() {
  document.getElementById('orderPopup').style.display = 'none';
}


// ---------------- CONFIRM ORDER + SAVE TO SHEET + WHATSAPP ----------------

async function confirmOrder() {
  // guard against double-clicks / retries
  if (isPlacingOrder) {
    return;
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

  const itemsTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const shipping = 40;
  const payableTotal = itemsTotal;

  const itemsTextPlain = cart
    .map((item, i) =>
      `${i + 1}. ${item.name} x${item.qty} - ₹${item.price * item.qty}`
    )
    .join('\n');

  // 1) Send order to Google Apps Script, get incremental order_id
  try {
    const formData = new URLSearchParams();
    formData.append('name', name);
    formData.append('mobile', mobile);
    formData.append('items', itemsTextPlain);
    formData.append('itemsTotal', String(itemsTotal));
    formData.append('payableTotal', String(payableTotal));

    const resp = await fetch(ORDER_API_URL, {
      method: 'POST',
      body: formData          // simple POST (no OPTIONS)
    });

    const data = await resp.json();
    if (!data.success) {
      alert('Error creating order id. Please try again.');
      isPlacingOrder = false;
      return;
    }

    currentOrderId = data.orderId;  // 1, 2, 3, ...
    document.getElementById('popupOrderId').textContent = currentOrderId;

  } catch (e) {
    alert('Network error while creating order. Please try again.');
    isPlacingOrder = false;
    return;
  }

  // 2) Open WhatsApp with that order id
  const myWhatsAppNumber = '919912233382';

  const itemsTextWA = encodeURIComponent(itemsTextPlain).replace(/%0A/g, '%0A');

  const message =
    `New Order%0A` +
    `Order ID: ${currentOrderId}%0A` +
    `Customer Name: ${encodeURIComponent(name)}%0A` +
    `Customer Mobile: ${mobile}%0A` +
    `Items:%0A${itemsTextWA}%0A` +
    `Items Total: ₹${itemsTotal}%0A` +
    `Shipping: ₹${shipping} (FREE given to customer)%0A` +
    `Payable Total: ₹${payableTotal}`;

  const waUrl = `https://wa.me/${myWhatsAppNumber}?text=${message}`;
  window.open(waUrl, '_blank');

  cart = [];
  updateCart();
  closeOrderPopup();
  isPlacingOrder = false;
}


// ---------------- FILTER LOGIC FOR TAG BUTTONS ----------------

document.addEventListener('DOMContentLoaded', function () {
  const tags = document.querySelectorAll('.tag');
  const cards = document.querySelectorAll('.product-card');

  tags.forEach(tag => {
    tag.addEventListener('click', () => {
      tags.forEach(t => t.classList.remove('active'));
      tag.classList.add('active');

      const filter = tag.getAttribute('data-filter');

      cards.forEach(card => {
        const category = card.getAttribute('data-category');
        const isBest = card.getAttribute('data-bestseller') === 'true';

        let show = false;
        if (filter === 'all') {
          show = true;
        } else if (filter === 'veg') {
          show = category === 'veg';
        } else if (filter === 'nonveg') {
          show = category === 'nonveg';
        } else if (filter === 'bestseller') {
          show = isBest;
        }

        if (show) {
          card.classList.remove('hidden');
        } else {
          card.classList.add('hidden');
        }
      });
    });
  });
});


