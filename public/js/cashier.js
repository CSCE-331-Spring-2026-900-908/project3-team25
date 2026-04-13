//  STATE 
let cashierMenu = [];
let cashierCategories = [];
let cashierActiveCategory = '';
let cashierOrder = []; // { id, name, qty, unitPrice, sugar, ice, note, linePrice }
let cashierSelectedRow = -1;

const CATEGORY_LABELS = {
  milk_tea:  'Milky\nSeries',
  fruit_tea: 'Fruity\nBeverage',
  tea:       'Non\nCaffeinated',
  coffee:    'Fresh\nBrew',
  seasonal:  'Seasonal'
};

const EXTRA_BOBA_PRODUCT_ID = 16;
const EXTRA_BOBA_PRICE = 0.75;

//  INIT 
async function initCashier() {
  // Load logged-in user display name
  try {
    const res = await fetch('/api/me');
    const data = await res.json();
    const nameEl = document.getElementById('cashier-user-name');
    if (data.authenticated && data.user) {
      nameEl.textContent = data.user.displayName || data.user.email || 'Staff';
    } else {
      nameEl.textContent = 'Guest';
    }
  } catch (_) {
    document.getElementById('cashier-user-name').textContent = 'Staff';
  }

  // Load menu from API
  try {
    const res = await fetch('/api/menu');
    const data = await res.json();
    cashierMenu = data.items || [];
    cashierCategories = Object.keys(data.categories || {});
    cashierActiveCategory = cashierCategories[0] || '';
    renderCategories();
    renderProductGrid();
  } catch (_) {
    document.getElementById('cashier-product-grid').innerHTML =
      '<p style="color:var(--muted);padding:12px;grid-column:1/-1;">Failed to load menu.</p>';
  }

  renderCart();
  bindModButtons();
  bindCartActions();
  bindHelpers();
  loadCashierWeather();

  // Close modify overlay when clicking the backdrop
  document.getElementById('cashier-modify-overlay').addEventListener('click', e => {
    if (e.target.id === 'cashier-modify-overlay') {
      e.target.classList.add('hidden');
    }
  });
}

//  CATEGORIES 
function renderCategories() {
  const col = document.getElementById('cashier-cat-col');
  col.innerHTML = cashierCategories.map(cat => {
    const label = (CATEGORY_LABELS[cat] || cat.replace('_', ' ')).replace('\n', '<br>');
    return `<button class="cashier-cat-btn${cashierActiveCategory === cat ? ' active' : ''}"
              data-cat="${cat}">${label}</button>`;
  }).join('');

  col.querySelectorAll('.cashier-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      cashierActiveCategory = btn.dataset.cat;
      renderCategories();
      renderProductGrid();
    });
  });
}

//  PRODUCT GRID 
function renderProductGrid() {
  const grid = document.getElementById('cashier-product-grid');
  const filtered = cashierMenu.filter(item => item.category === cashierActiveCategory);

  if (!filtered.length) {
    grid.innerHTML = '<p style="color:var(--muted);padding:12px;grid-column:1/-1;">No items in this category.</p>';
    return;
  }

  grid.innerHTML = filtered.map(item =>
    `<button class="cashier-product-btn" data-id="${item.id}">
      <strong>${item.name}</strong>
      <span>$${Number(item.price).toFixed(2)}</span>
    </button>`
  ).join('');

  grid.querySelectorAll('.cashier-product-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = cashierMenu.find(x => x.id === Number(btn.dataset.id));
      if (!item) return;
      cashierOrder.push({
        id: item.id,
        name: item.name,
        qty: 1,
        unitPrice: Number(item.price),
        sugar: 100,
        ice: 100,
        note: '',
        linePrice: Number(item.price)
      });
      cashierSelectedRow = cashierOrder.length - 1;
      renderCart();
    });
  });
}

//  CART 
function renderCart() {
  const tbody   = document.getElementById('cashier-cart-body');
  const emptyEl = document.getElementById('cashier-cart-empty');
  const tableEl = document.getElementById('cashier-cart-table');
  const countEl = document.getElementById('cashier-item-count');

  const count = cashierOrder.length;
  countEl.textContent = `${count} item${count === 1 ? '' : 's'}`;

  if (!count) {
    emptyEl.style.display = '';
    tableEl.style.display = 'none';
    updateTotals(0);
    return;
  }

  emptyEl.style.display = 'none';
  tableEl.style.display = '';

  tbody.innerHTML = cashierOrder.map((item, i) =>
    `<tr class="cart-row${cashierSelectedRow === i ? ' selected' : ''}" data-index="${i}">
      <td>${item.name}</td>
      <td class="col-center">${item.qty}</td>
      <td class="col-right">$${item.linePrice.toFixed(2)}</td>
      <td class="col-center">${item.sugar}%</td>
      <td class="col-center">${item.ice}%</td>
      <td class="col-notes">${item.note}</td>
    </tr>`
  ).join('');

  tbody.querySelectorAll('.cart-row').forEach(row => {
    row.addEventListener('click', () => {
      const idx = Number(row.dataset.index);
      cashierSelectedRow = cashierSelectedRow === idx ? -1 : idx;
      renderCart();
    });
  });

  updateTotals(cashierOrder.reduce((sum, item) => sum + item.linePrice, 0));
}

function updateTotals(subtotal) {
  const tax   = subtotal * 0.0825;
  const total = subtotal + tax;
  document.getElementById('cashier-subtotal').textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById('cashier-tax').textContent      = `$${tax.toFixed(2)}`;
  document.getElementById('cashier-total').textContent    = `$${total.toFixed(2)}`;
}

//  QUICK MOD BUTTONS 
function bindModButtons() {
  document.getElementById('mod-half-sweet').addEventListener('click',  () => applyQuickMod('sugar', 50));
  document.getElementById('mod-2x-sweet').addEventListener('click',   () => applyQuickMod('sugar', 200));
  document.getElementById('mod-half-ice').addEventListener('click',   () => applyQuickMod('ice', 50));
  document.getElementById('mod-no-ice').addEventListener('click',     () => applyQuickMod('ice', 0));
  document.getElementById('mod-extra-boba').addEventListener('click', () => applyExtraBoba());
  document.getElementById('mod-modify-btn').addEventListener('click', () => showModifyPanel());
}

function applyQuickMod(type, value) {
  if (!requireSelection()) return;
  const item = cashierOrder[cashierSelectedRow];

  if (type === 'sugar') {
    item.sugar = value;
    if (value >= 200 && !item.note.includes('2x Sweet')) {
      item.note = (item.note ? item.note + ', ' : '') + '2x Sweet';
    }
  } else if (type === 'ice') {
    item.ice = Math.min(value, 100);
    const tag = value === 0 ? 'No Ice' : 'Half Ice';
    if (!item.note.includes(tag)) {
      item.note = (item.note ? item.note + ', ' : '') + tag;
    }
  }

  renderCart();
}

function applyExtraBoba() {
  if (!requireSelection()) return;
  const selected = cashierOrder[cashierSelectedRow];
  if (selected.id === EXTRA_BOBA_PRODUCT_ID) {
    setStatus('Cannot add Extra Boba to a topping.', 'error');
    return;
  }
  cashierOrder.splice(cashierSelectedRow + 1, 0, {
    id: EXTRA_BOBA_PRODUCT_ID,
    name: 'Extra Boba',
    qty: 1,
    unitPrice: EXTRA_BOBA_PRICE,
    sugar: 100,
    ice: 100,
    note: 'for: ' + selected.name,
    linePrice: EXTRA_BOBA_PRICE
  });
  renderCart();
}

function requireSelection() {
  if (cashierSelectedRow < 0 || cashierSelectedRow >= cashierOrder.length) {
    setStatus('Select a cart row first.', 'error');
    return false;
  }
  return true;
}

//  MODIFY PANEL (MODAL) 
function showModifyPanel() {
  if (!requireSelection()) return;
  const item    = { ...cashierOrder[cashierSelectedRow] };
  const overlay = document.getElementById('cashier-modify-overlay');
  const card    = document.getElementById('cashier-modify-card');

  card.innerHTML = `
    <h3>Modify: ${item.name}</h3>
    <div class="modify-fields">
      <div class="modify-field">
        <label>Sweetness <strong id="mod-sugar-val">${Math.min(item.sugar, 200)}%</strong></label>
        <input type="range" id="mod-sugar" min="0" max="200" step="25" value="${Math.min(item.sugar, 200)}" />
      </div>
      <div class="modify-field">
        <label>Ice Level <strong id="mod-ice-val">${item.ice}%</strong></label>
        <input type="range" id="mod-ice" min="0" max="100" step="25" value="${item.ice}" />
      </div>
      <div class="modify-field">
        <label>Quantity</label>
        <input type="number" id="mod-qty" min="1" max="20" value="${item.qty}" />
      </div>
      <div class="modify-field">
        <label>Notes</label>
        <input type="text" id="mod-note" value="${item.note}" placeholder="Special instructions..." />
      </div>
    </div>
    <div class="modify-actions">
      <button class="btn ghost" id="mod-cancel-btn">Cancel</button>
      <button class="btn" id="mod-apply-btn">Apply Changes</button>
    </div>
  `;

  overlay.classList.remove('hidden');

  document.getElementById('mod-sugar').addEventListener('input', e => {
    document.getElementById('mod-sugar-val').textContent = e.target.value + '%';
  });
  document.getElementById('mod-ice').addEventListener('input', e => {
    document.getElementById('mod-ice-val').textContent = e.target.value + '%';
  });
  document.getElementById('mod-cancel-btn').addEventListener('click', () => {
    overlay.classList.add('hidden');
  });
  document.getElementById('mod-apply-btn').addEventListener('click', () => {
    const sugar = Number(document.getElementById('mod-sugar').value);
    const ice   = Number(document.getElementById('mod-ice').value);
    const qty   = Math.max(1, Number(document.getElementById('mod-qty').value));
    const note  = document.getElementById('mod-note').value.trim();
    cashierOrder[cashierSelectedRow] = {
      ...item,
      sugar,
      ice,
      qty,
      note,
      linePrice: Number((item.unitPrice * qty).toFixed(2))
    };
    overlay.classList.add('hidden');
    renderCart();
  });
}

//  CART ACTIONS 
function bindCartActions() {
  document.getElementById('cashier-remove-btn').addEventListener('click', () => {
    if (!requireSelection()) return;
    cashierOrder.splice(cashierSelectedRow, 1);
    cashierSelectedRow = cashierOrder.length ? Math.min(cashierSelectedRow, cashierOrder.length - 1) : -1;
    renderCart();
  });

  document.getElementById('cashier-clear-btn').addEventListener('click', () => {
    cashierOrder = [];
    cashierSelectedRow = -1;
    setStatus('');
    renderCart();
  });

  document.getElementById('cashier-pay-btn').addEventListener('click', async () => {
    if (!cashierOrder.length) {
      setStatus('Add at least one item first.', 'error');
      return;
    }
    setStatus('Submitting order…', '');
    try {
      const paymentMethod = document.getElementById('cashier-payment-method').value;
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashierId: 1,
          paymentMethod,
          items: cashierOrder.map(item => ({
            id: item.id,
            quantity: item.qty,
            unitPrice: item.unitPrice,
            selections: {
              sweetness: item.sugar + '%',
              ice: item.ice + '%',
              size: 'Regular',
              topping: item.id === EXTRA_BOBA_PRODUCT_ID ? 'Extra Boba' : 'None'
            }
          }))
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || 'Checkout failed.');
      setStatus(`Payment complete — Transaction #${data.transactionId}`, 'success');
      cashierOrder = [];
      cashierSelectedRow = -1;
      renderCart();
    } catch (err) {
      setStatus(err.message, 'error');
    }
  });
}

function setStatus(msg, type = '') {
  const el = document.getElementById('cashier-checkout-result');
  el.textContent = msg;
  el.className = 'cashier-checkout-status' + (type ? ' ' + type : '');
}

//  HELPERS 
function bindHelpers() {
  document.getElementById('cashier-translate-btn').addEventListener('click', async () => {
    const text   = document.getElementById('cashier-translate-text').value.trim();
    const target = document.getElementById('cashier-translate-target').value;
    const out    = document.getElementById('cashier-translate-result');
    out.textContent = 'Translating…';
    try {
      const res  = await fetch(`/api/translate?text=${encodeURIComponent(text)}&target=${encodeURIComponent(target)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Translation failed.');
      out.textContent = data.translatedText;
    } catch (e) {
      out.textContent = e.message;
    }
  });

  document.getElementById('cashier-assistant-btn').addEventListener('click', async () => {
    const message = document.getElementById('cashier-assistant-input').value.trim();
    const out     = document.getElementById('cashier-assistant-result');
    out.textContent = 'Thinking…';
    try {
      const res  = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      const data = await res.json();
      out.textContent = data.reply || 'No response.';
    } catch (e) {
      out.textContent = e.message;
    }
  });
}

async function loadCashierWeather() {
  const wrap = document.getElementById('cashier-weather-card');
  if (!wrap) return;

  wrap.innerHTML = '<p class="muted">Loading weather…</p>';

  try {
    const res = await fetch('/api/weather?city=College%20Station');
    const data = await res.json();

    if (!res.ok) {
      wrap.innerHTML = `<p class="muted">Weather temporarily unavailable.</p>`;
      return;
    }

    const temp = data.temperature != null ? Math.round(data.temperature) : '—';
    const feels = data.feelsLike != null
      ? Math.round(data.feelsLike)
      : (data.temperature != null ? Math.round(data.temperature) : '—');
    const wind = data.windSpeed != null ? Math.round(data.windSpeed) : '—';

    wrap.innerHTML = `
      <div class="weather-mini">
        <div class="weather-main">
          <strong>${data.city}</strong>
          <span>${data.weatherLabel}</span>
        </div>
        <div class="weather-temp">${temp}°F</div>
        <p class="muted">
          Feels like: ${feels}°F · Wind: ${wind} mph
        </p>
        <p class="weather-suggestion">${data.drinkSuggestion}</p>
      </div>
    `;
  } catch (_) {
      wrap.innerHTML = `<p class="muted">Weather temporarily unavailable.</p>`;
    }
}

//  START 
initCashier();
