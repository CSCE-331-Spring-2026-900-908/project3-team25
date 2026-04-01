let customerMenu = [];
let customerCategories = [];
let customerActiveCategory = '';
let customerOrder = [];
let selectedPaymentMethod = 'card';

function announceCustomer(message) {
  if (window.announceAccessibility) window.announceAccessibility(message);
}

function customerSelections() {
  return {
    sweetness: document.getElementById('sweetness').value,
    ice: document.getElementById('ice-level').value,
    size: document.getElementById('size').value,
    topping: document.getElementById('topping').value
  };
}

function customerExtraPrice(selections) {
  let extra = 0;
  if (selections.size === 'Large') extra += 1.0;
  if (selections.topping === 'Extra Boba') extra += 0.75;
  return extra;
}

function customerSubtotal() {
  return customerOrder.reduce((sum, item) => sum + Number(item.linePrice || 0), 0);
}

function customerTax(subtotal) {
  return subtotal * 0.0825;
}

function getDrinkImagePath(itemName) {
  const imageMap = {
    'Classic Milk Tea': '/boba/Classic-Milk-Tea.PNG',
    'Brown Sugar Milk Tea': '/boba/Brown-Sugar-Milk-Tea.PNG',
    'Taro Milk Tea': '/boba/Taro-Milk-Tea.PNG',
    'Matcha Milk Tea': '/boba/Matcha-Milk-Tea.PNG',
    'Thai Tea': '/boba/Thai-Milk-Tea.PNG',
    'Honey Green Tea': '/boba/Honey-Green-Tea.PNG',
    'Wintermelon Milk Tea': '/boba/Wintermelon-Milk-Tea.PNG',
    'Oolong Milk Tea': '/boba/Ooglong-Tea.png',
    'Coffee Milk Tea': '/boba/Coffee-Milk-Tea.png',
    'Lychee Green Tea': '/boba/Lychee.png',
    'Mango Green Tea': '/boba/Mango.png',
    'Peach Green Tea': '/boba/Peach.png',
    'Strawberry Green Tea': '/boba/Strawberry-.png',
    'Jasmine Green Tea': '/boba/Sonny-Boba.png',
    'Black Tea Lemonade': '/boba/Sonny-Boba.png'
  };

  return imageMap[itemName] || '/boba/Sonny-Boba.png';
}

function setActiveScreen(screenName) {
  const screens = {
    menu: document.getElementById('screen-menu'),
    review: document.getElementById('screen-review'),
    payment: document.getElementById('screen-payment'),
    confirm: document.getElementById('screen-confirm')
  };

  Object.values(screens).forEach((screen) => {
    screen.classList.remove('active-screen');
    screen.classList.add('hidden-screen');
  });

  screens[screenName].classList.remove('hidden-screen');
  screens[screenName].classList.add('active-screen');

  updateStepIndicators(screenName);
  const labels = { menu: 'Choose drinks screen', review: 'Review order screen', payment: 'Payment screen', confirm: 'Order confirmation screen' };
  announceCustomer(labels[screenName]);
}

function updateStepIndicators(screenName) {
  const ids = [
    'step-indicator-menu',
    'step-indicator-review',
    'step-indicator-payment',
    'step-indicator-confirm'
  ];

  ids.forEach((id) => {
    document.getElementById(id).classList.remove('active');
  });

  if (screenName === 'menu') {
    document.getElementById('step-indicator-menu').classList.add('active');
  } else if (screenName === 'review') {
    document.getElementById('step-indicator-menu').classList.add('active');
    document.getElementById('step-indicator-review').classList.add('active');
  } else if (screenName === 'payment') {
    document.getElementById('step-indicator-menu').classList.add('active');
    document.getElementById('step-indicator-review').classList.add('active');
    document.getElementById('step-indicator-payment').classList.add('active');
  } else if (screenName === 'confirm') {
    ids.forEach((id) => {
      document.getElementById(id).classList.add('active');
    });
  }
}

function customerRenderTabs() {
  const wrap = document.getElementById('customer-tabs');
  wrap.innerHTML = customerCategories
    .map(
      (category) => `
        <button
          class="tab-btn ${customerActiveCategory === category ? 'active' : ''}"
          data-category="${category}"
          type="button"
        >
          ${category.replace(/_/g, ' ')}
        </button>
      `
    )
    .join('');

  wrap.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      customerActiveCategory = btn.dataset.category;
      customerRenderTabs();
      customerRenderMenu();
    });
  });
}

function customerRenderMenu() {
  const wrap = document.getElementById('customer-menu');
  const filtered = customerMenu.filter((item) => item.category === customerActiveCategory);

  wrap.innerHTML = filtered
    .map((item) => {
      const imagePath = getDrinkImagePath(item.name);

      return `
        <article class="menu-card">
          <div class="drink-image-wrap">
            <img
              src="${imagePath}"
              alt="${item.name}"
              class="drink-image"
              onerror="this.src='/boba/Sonny-Boba.png'"
            />
          </div>

          <div class="topline">
            <div>
              <h3>${item.name}</h3>
              <p>${item.description}</p>
            </div>
            ${item.popular ? '<span class="tag">Popular</span>' : ''}
          </div>

          <div class="price-line">
            <span class="price">$${Number(item.price).toFixed(2)}</span>
            <button class="btn add-btn" data-id="${item.id}" type="button">Add</button>
          </div>
        </article>
      `;
    })
    .join('');

  wrap.querySelectorAll('.add-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = customerMenu.find((x) => x.id === Number(btn.dataset.id));
      if (!item) return;

      const selections = customerSelections();
      const extra = customerExtraPrice(selections);
      const finalPrice = Number(item.price) + extra;

      customerOrder.push({
        ...item,
        quantity: 1,
        selections,
        unitPrice: finalPrice,
        linePrice: finalPrice
      });

      customerRenderOrder();
      announceCustomer(`${item.name} added to order.`);
    });
  });
}

function customerRenderOrder() {
  const lines = document.getElementById('customer-order-lines');
  const count = document.getElementById('customer-item-count');
  const reviewCount = document.getElementById('review-item-count');
  const menuCount = document.getElementById('menu-screen-count');
  const subtotalEl = document.getElementById('customer-subtotal');
  const taxEl = document.getElementById('customer-tax');
  const totalEl = document.getElementById('customer-total');
  const paymentTotalEl = document.getElementById('payment-total');

  const itemCount = customerOrder.length;
  const subtotal = customerSubtotal();
  const tax = customerTax(subtotal);
  const total = subtotal + tax;

  count.textContent = `${itemCount} item${itemCount === 1 ? '' : 's'}`;
  reviewCount.textContent = `${itemCount} item${itemCount === 1 ? '' : 's'}`;
  menuCount.textContent = String(itemCount);

  subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
  taxEl.textContent = `$${tax.toFixed(2)}`;
  totalEl.textContent = `$${total.toFixed(2)}`;
  paymentTotalEl.textContent = `$${total.toFixed(2)}`;

  if (!customerOrder.length) {
    lines.innerHTML = '<p class="cart-note">No drinks added yet. Pick a drink from the menu to start.</p>';
    return;
  }

  lines.innerHTML = customerOrder
    .map((item, index) => `
      <article class="order-item">
        <div class="line-top">
          <strong>${item.name}</strong>
          <strong>$${Number(item.linePrice).toFixed(2)}</strong>
        </div>
        <small>
          ${item.selections.size} •
          ${item.selections.sweetness} •
          ${item.selections.ice} ice •
          ${item.selections.topping}
        </small>
        <button class="btn ghost remove-btn" data-index="${index}" type="button">Remove</button>
      </article>
    `)
    .join('');

  lines.querySelectorAll('.remove-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      customerOrder.splice(Number(btn.dataset.index), 1);
      customerRenderOrder();
      announceCustomer(`${item.name} added to order.`);
    });
  });
}

async function loadCustomerMenu() {
  const res = await fetch('/api/menu');
  const data = await res.json();

  customerMenu = data.items || [];
  customerCategories = Object.keys(data.categories || {});
  customerActiveCategory = customerCategories[0] || '';

  customerRenderTabs();
  customerRenderMenu();
  customerRenderOrder();
}

function setPaymentMethod(method) {
  selectedPaymentMethod = method;

  const labelMap = {
    card: 'Card',
    applepay: 'Apple Pay',
    cash: 'Cash'
  };

  document.getElementById('selected-payment-label').textContent =
    `Selected payment: ${labelMap[method] || 'Card'}`;
  announceCustomer(`Payment method set to ${labelMap[method] || 'Card'}.`);

  document.querySelectorAll('.payment-option').forEach((btn) => {
    btn.classList.toggle('active-payment', btn.dataset.payment === method);
  });
}

function resetCustomerOrder() {
  customerOrder = [];
  selectedPaymentMethod = 'card';
  customerRenderOrder();
  setPaymentMethod('card');

  document.getElementById('customer-checkout-result').textContent = '';
  document.getElementById('confirmation-message').textContent = 'Thank you for your order.';
  setActiveScreen('menu');
}

document.getElementById('go-to-review-btn').addEventListener('click', () => {
  if (!customerOrder.length) {
    alert('Please add at least one drink before reviewing your order.');
    return;
  }
  setActiveScreen('review');
});

document.getElementById('back-to-menu-btn').addEventListener('click', () => {
  setActiveScreen('menu');
});

document.getElementById('go-to-payment-btn').addEventListener('click', () => {
  if (!customerOrder.length) {
    alert('Your order is empty.');
    return;
  }
  setActiveScreen('payment');
});

document.getElementById('back-to-review-btn').addEventListener('click', () => {
  setActiveScreen('review');
});

document.getElementById('customer-clear-btn').addEventListener('click', () => {
  customerOrder = [];
  customerRenderOrder();
  announceCustomer('Order cleared.');
});

document.getElementById('start-new-order-btn').addEventListener('click', () => {
  resetCustomerOrder();
});

document.querySelectorAll('.payment-option').forEach((btn) => {
  btn.addEventListener('click', () => {
    setPaymentMethod(btn.dataset.payment);
  });
});

document.getElementById('customer-checkout-btn').addEventListener('click', async () => {
  const out = document.getElementById('customer-checkout-result');

  if (!customerOrder.length) {
    out.textContent = 'Add at least one drink before checkout.';
    return;
  }

  out.textContent = 'Submitting order...';

  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cashierId: 1,
        paymentMethod: selectedPaymentMethod,
        items: customerOrder.map((item) => ({
          id: item.id,
          quantity: 1,
          unitPrice: item.unitPrice,
          selections: item.selections
        }))
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.details || data.error || 'Checkout failed.');
    }

    document.getElementById('confirmation-message').textContent =
      `Your order has been placed! Transaction #${data.transactionId} was saved using ${data.source}.`;
    announceCustomer(`Order placed successfully. Transaction ${data.transactionId}.`);

    out.textContent = '';
    setActiveScreen('confirm');
  } catch (error) {
    out.textContent = error.message;
  }
});

loadCustomerMenu();
setPaymentMethod('card');
setActiveScreen('menu');