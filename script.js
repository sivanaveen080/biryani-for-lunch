// cart will store objects like { name, price, qty }
let cart = [];

// auto-incrementing order id
let currentOrderId = 0;

// read last order id from browser storage so numbers continue after refresh
const savedId = localStorage.getItem('lastOrderId');
if (savedId) {
  currentOrderId = parseInt(savedId, 10);
}

// ---------------- ADD TO CART WITH QUANTITY (still usable if you want a simple Add button) ----------------
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

  // find the wrapper div for this product's quantity controls
  const wrapper = button.closest('.qty-controls');
  const name = wrapper.getAttribute('data-name');                  // product name
  const price = parseInt(wrapper.getAttribute('data-price'), 10);  // product price
  const valueSpan = wrapper.querySelector('.qty-value');           // span showing current qty

  // current shown quantity
  let current = parseInt(valueSpan.textContent, 10);
  if (isNaN(current)) current = 0;

  // calculate next quantity after +1 or -1
  let next = current + delta;
  if (next < 0) next = 0; // do not go below 0

  // update number shown on the card
  valueSpan.textContent = next;

  // update cart array
  const existing = cart.find(item => item.name === name);

  if (next === 0) {
    // remove item from cart if exists
    if (existing) {
      cart = cart.filter(item => item.name !== name);
    }
  } else {
    if (existing) {
      existing.qty = next; // set new quantity
    } else {
      cart.push({ name, price, qty: next });
    }
  }

  updateCart(); // refresh totals and cart list
}

// ---------------- UPDATE CART DISPLAY ----------------
function updateCart() {
  const cartItemsBody = document.getElementById('cartItems');   // <tbody> for rows
  const cartCount = document.getElementById('cartCount');       // total items span
  const itemsTotalSpan = document.getElementById('itemsTotal'); // items-only total
  const totalSpan = document.getElementById('total');           // final payable total

  // total quantity across all products
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  cartCount.textContent = totalQty;

  // build one <tr> per product with name + qty + line total in SAME cell
  cartItemsBody.innerHTML = cart.map((item) => {
    const lineTotal = item.price * item.qty; // price * quantity
    // Example row text: "Veg Noodles x2 - ₹180"
    return `
      <tr>
        <td>${item.name} x${item.qty} - ₹${lineTotal}</td>
      </tr>
    `;
  }).join('');

  // sum of all line totals (items only)
  const itemsTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  // shipping charge is ₹40, but we will NOT add to final total (free for customer)
  const shipping = 40;

  // what customer actually pays (you absorb shipping)
  const payableTotal = itemsTotal;

  // update numbers on screen
  itemsTotalSpan.textContent = itemsTotal;
  totalSpan.textContent = payableTotal;
}

// ---------------- OPEN POPUP AND CREATE ORDER ID ----------------
function openOrderPopup() {
  if (cart.length === 0) {
    alert('Cart is empty!');
    return;
  }

  // next sequential order id
  currentOrderId += 1;
  localStorage.setItem('lastOrderId', currentOrderId.toString());

  // put id in popup and show it
  document.getElementById('popupOrderId').textContent = currentOrderId;
  document.getElementById('orderPopup').style.display = 'flex';
}

// hide popup
function closeOrderPopup() {
  document.getElementById('orderPopup').style.display = 'none';
}

// ---------------- CONFIRM ORDER + WHATSAPP MESSAGE ----------------
function confirmOrder() {
  const name = document.getElementById('customerName').value.trim();
  const mobile = document.getElementById('customerMobile').value.trim();

  // basic name check
  if (!name) {
    alert('Please enter your name');
    return;
  }

  // mobile: only digits, 10 digits, cannot start with 0
  const mobileRegex = /^[1-9]\d{9}$/;
  if (!mobileRegex.test(mobile)) {
    alert('Enter a valid 10-digit mobile number (cannot start with 0)');
    return;
  }

  const itemsTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const shipping = 40;
  const payableTotal = itemsTotal;

  const itemsText = cart
    .map((item, i) =>
      `${i + 1}. ${item.name} x${item.qty} - ₹${item.price * item.qty}`
    )
    .join('%0A');

  const myWhatsAppNumber = '919912233382';

  const message =
    `New Order%0A` +
    `Order ID: ${currentOrderId}%0A` +
    `Customer Name: ${encodeURIComponent(name)}%0A` +
    `Customer Mobile: ${mobile}%0A` +
    `Items:%0A${itemsText}%0A` +
    `Items Total: ₹${itemsTotal}%0A` +
    `Shipping: ₹${shipping} (FREE given to customer)%0A` +
    `Payable Total: ₹${payableTotal}`;

  const waUrl = `https://wa.me/${myWhatsAppNumber}?text=${message}`;

  window.open(waUrl, '_blank');

  cart = [];
  updateCart();
  closeOrderPopup();
}




// ---------------- FILTER LOGIC FOR TAG BUTTONS ----------------
document.addEventListener('DOMContentLoaded', function () {
  const tags = document.querySelectorAll('.tag');           // All filter buttons
  const cards = document.querySelectorAll('.product-card'); // All product cards

  tags.forEach(tag => {
    tag.addEventListener('click', () => {
      // remove "active" from all tags
      tags.forEach(t => t.classList.remove('active'));
      // add "active" to clicked tag
      tag.classList.add('active');

      const filter = tag.getAttribute('data-filter'); // all / veg / nonveg / bestseller

      cards.forEach(card => {
        const category = card.getAttribute('data-category'); // veg or nonveg
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
