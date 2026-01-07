// ---------------- GLOBAL STATE ----------------

// cart will store objects like { name, price, qty }
let cart = [];

// Google Apps Script Web App URL (POST endpoint)
const ORDER_API_URL = 'https://script.google.com/macros/s/AKfycbwzYkES0Im3CCxb6aJAI13TVpMiqI7Mc0RvCZRAieV8qP1yG_Yd313SLWJ9t3ZdFFnbMQ/exec';

// holds the order id returned from Google Sheets (1, 2, 3, ...)
let currentOrderId = null;

// prevent double submit
let isPlacingOrder = false;


// ---------------- ORDERING TIME WINDOW ----------------

// true if current time is between 10:00 and 12:30 (same day)
function isWithinOrderingWindow() {
  const now = new Date();
  const h = now.getHours();      // 0–23 in your local timezone
  const m = now.getMinutes();
  const minutes = h * 60 + m;

  const start = 10 * 60;         // 10:00  -> 600
  const end = 13 * 60;      // 12:30 -> 750

  // simple range: ONLY between start and end
  return minutes >= start && minutes <= end;
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

// --------- SPECIAL: generic starters (Half / Full) single card ---------

function changeStarterQty(key, button, delta) {
  // key is one of: "Chicken65", "ChickenFry", "ChickenPakodi"
  const wrapper = button.closest('.qty-controls');
  if (!wrapper) return;

  const select = document.getElementById(`starter${key}Size`);
  const priceSpan = document.getElementById(`starter${key}Price`);

  if (!select) return;

  const selectedOption = select.options[select.selectedIndex];
  const size = selectedOption.value;                  // "half" or "full"
  const price = parseInt(selectedOption.dataset.price, 10);

  const baseName =
    key === 'Chicken65' ? 'Chicken 65'
    : key === 'ChickenFry' ? 'Chicken Fry'
    : 'Chicken Pakodi';

  const itemName = size === 'half'
    ? `${baseName} (Half)`
    : `${baseName} (Full)`;

  // update attributes so changeQty uses correct name/price
  wrapper.setAttribute('data-name', itemName);
  wrapper.setAttribute('data-price', String(price));

  if (priceSpan) {
    priceSpan.textContent = `₹${price}`;
  }

  // reuse common cart logic
  changeQty(button, delta);
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
    const safeName = item.name.replace(/'/g, "\\'");
    return `
      <tr>
        <td class="cart-item-name">${item.name}</td>
        <td class="cart-item-qty">
          <div class="qty-controls cart-qty-controls"
               data-name="${item.name}">
            <button class="qty-btn" onclick="changeCartQty('${safeName}', -1)">−</button>
            <span class="qty-value">${item.qty}</span>
            <button class="qty-btn" onclick="changeCartQty('${safeName}', 1)">+</button>
          </div>
        </td>
        <td class="cart-item-total">₹${lineTotal}</td>
      </tr>
    `;
  }).join('');

  const itemsTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  const shipping = 40;              // not added to payable
  const payableTotal = itemsTotal;  // free shipping

  itemsTotalSpan.textContent = itemsTotal;
  totalSpan.textContent = payableTotal;
}


// ------------- CHANGE QTY FROM CART (+ / - IN CART) -------------

function changeCartQty(name, delta) {
  const item = cart.find(it => it.name === name);
  if (!item) return;

  let next = item.qty + delta;
  if (next < 0) next = 0;

  if (next === 0) {
    cart = cart.filter(it => it.name !== name);
  } else {
    item.qty = next;
  }

  updateCart();

  // keep product card qty in sync
  const cardControls = document.querySelectorAll(`.qty-controls[data-name="${name}"]`);
  cardControls.forEach(ctrl => {
    const span = ctrl.querySelector('.qty-value');
    if (span) span.textContent = next || 0;
  });
}


// ---------------- OPEN / CLOSE POPUP ----------------

function openOrderPopup() {
  if (cart.length === 0) {
    alert('Cart is empty!');
    return;
  }

  // allow orders only from 10:00 AM to 12:30 PM
  if (!isWithinOrderingWindow()) {
    alert(
      'Orders can be placed only between 10:00 AM to 12:30 PM.\n' +
      'Sorry..! please visit again during that time window.'
    );
    return;
  }

  document.getElementById('popupOrderId').textContent = '...';

  // set delivery information text on the popup
  const infoEl = document.getElementById('deliveryInfo');
  if (infoEl) {
    infoEl.textContent = 'Orders will be delivered between 1:30 PM and 2:30 PM.';
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
      body: formData
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
  const myWhatsAppNumber = '919494961597';

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
        } else if (filter === 'starters') {
          show = category === 'starters';
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


// ---------------- LEGAL POPUP (TERMS & PRIVACY) ----------------

function openLegal(type) {
  const popup = document.getElementById('legalPopup');
  const title = document.getElementById('legalTitle');
  const body  = document.getElementById('legalBody');

  if (type === 'terms') {
    title.textContent = 'Terms & Conditions';
    body.textContent =
      'Orders are for same-day lunch delivery within Rajapushpa Paradigm. Please confirm your order on WhatsApp. Payment is collected at delivery.';
  } else {
    title.textContent = 'Privacy Policy';
    body.textContent =
      'Your name and mobile number are used only to confirm and deliver your lunch order. Your details are not shared with third parties.';
  }

  popup.style.display = 'flex';
}

function closeLegal() {
  const popup = document.getElementById('legalPopup');
  if (popup) {
    popup.style.display = 'none';
  }
}

