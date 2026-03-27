let cashierMenu = [];
let cashierCategories = [];
let cashierActiveCategory = '';
let cashierOrder = [];

function cashierSelections() {
  return {
    sweetness: document.getElementById('cashier-sweetness').value,
    ice: document.getElementById('cashier-ice').value,
    size: document.getElementById('cashier-size').value,
    topping: document.getElementById('cashier-topping').value
  };
}

function cashierExtraPrice(selections) {
  let extra = 0;
  if (selections.size === 'Large') extra += 1.0;
  if (selections.topping === 'Extra Boba') extra += 0.75;
  return extra;
}

function cashierRenderTabs() {
  const wrap = document.getElementById('cashier-tabs');
  wrap.innerHTML = cashierCategories.map(category => `
    <button class="tab-btn ${cashierActiveCategory === category ? 'active' : ''}" data-category="${category}">
      ${category.replace('_', ' ')}
    </button>
  `).join('');

  wrap.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      cashierActiveCategory = btn.dataset.category;
      cashierRenderTabs();
      cashierRenderMenu();
    });
  });
}

function cashierRenderMenu() {
  const wrap = document.getElementById('cashier-menu');
  const filtered = cashierMenu.filter(item => item.category === cashierActiveCategory);
  wrap.innerHTML = filtered.map(item => `
    <article class="menu-card">
      <div class="topline">
        <div>
          <h3>${item.name}</h3>
          <p>${item.description}</p>
        </div>
        ${item.popular ? '<span class="tag">Popular</span>' : ''}
      </div>
      <div class="price-line">
        <span class="price">$${item.price.toFixed(2)}</span>
        <button class="btn cashier-add-btn" data-id="${item.id}">Add</button>
      </div>
    </article>
  `).join('');

  wrap.querySelectorAll('.cashier-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = cashierMenu.find(x => x.id === Number(btn.dataset.id));
      if (!item) return;
      const selections = cashierSelections();
      cashierOrder.push({
        ...item,
        selections,
        linePrice: item.price + cashierExtraPrice(selections)
      });
      cashierRenderOrder();
    });
  });
}

function cashierRenderOrder() {
  const lines = document.getElementById('cashier-order-lines');
  const count = document.getElementById('cashier-item-count');
  const subtotalEl = document.getElementById('cashier-subtotal');
  const taxEl = document.getElementById('cashier-tax');
  const totalEl = document.getElementById('cashier-total');

  count.textContent = `${cashierOrder.length} item${cashierOrder.length === 1 ? '' : 's'}`;

  if (!cashierOrder.length) {
    lines.innerHTML = '<p class="cart-note">No drinks added yet.</p>';
    subtotalEl.textContent = '$0.00';
    taxEl.textContent = '$0.00';
    totalEl.textContent = '$0.00';
    return;
  }

  lines.innerHTML = cashierOrder.map((item, index) => `
    <article class="order-item">
      <div class="line-top">
        <strong>${item.name}</strong>
        <strong>$${item.linePrice.toFixed(2)}</strong>
      </div>
      <small>${item.selections.size} • ${item.selections.sweetness} sugar • ${item.selections.ice} ice • ${item.selections.topping}</small>
      <button class="btn ghost cashier-remove-btn" data-index="${index}">Remove</button>
    </article>
  `).join('');

  lines.querySelectorAll('.cashier-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      cashierOrder.splice(Number(btn.dataset.index), 1);
      cashierRenderOrder();
    });
  });

  const subtotal = cashierOrder.reduce((sum, item) => sum + item.linePrice, 0);
  const tax = subtotal * 0.0825;
  const total = subtotal + tax;

  subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
  taxEl.textContent = `$${tax.toFixed(2)}`;
  totalEl.textContent = `$${total.toFixed(2)}`;
}

async function loadCashierMenu() {
  const res = await fetch('/api/menu');
  const data = await res.json();
  cashierMenu = data.items;
  cashierCategories = Object.keys(data.categories);
  cashierActiveCategory = cashierCategories[0];
  cashierRenderTabs();
  cashierRenderMenu();
}
loadCashierMenu();

document.getElementById('cashier-clear-btn').addEventListener('click', () => {
  cashierOrder = [];
  cashierRenderOrder();
});

document.getElementById('cashier-pay-btn').addEventListener('click', () => {
  if (!cashierOrder.length) {
    alert('Add at least one drink before taking payment.');
    return;
  }
  const total = document.getElementById('cashier-total').textContent;
  alert(`Payment captured in demo mode.\nTicket total: ${total}`);
});

document.getElementById('cashier-translate-btn').addEventListener('click', async () => {
  const text = document.getElementById('cashier-translate-text').value.trim();
  const target = document.getElementById('cashier-translate-target').value;
  const out = document.getElementById('cashier-translate-result');
  out.textContent = 'Translating...';
  try {
    const res = await fetch(`/api/translate?text=${encodeURIComponent(text)}&target=${encodeURIComponent(target)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Translation failed.');
    out.textContent = data.translatedText;
  } catch (error) {
    out.textContent = error.message;
  }
});

document.getElementById('cashier-assistant-btn').addEventListener('click', async () => {
  const message = document.getElementById('cashier-assistant-input').value.trim();
  const out = document.getElementById('cashier-assistant-result');
  out.textContent = 'Thinking...';
  try {
    const res = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    const data = await res.json();
    out.textContent = data.reply || 'No response.';
  } catch (error) {
    out.textContent = error.message;
  }
});