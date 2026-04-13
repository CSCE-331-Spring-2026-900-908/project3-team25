//  STATE
let cashierMenu = [];
let cashierCategories = [];
let cashierActiveCategory = '';
let cashierOrder = [];
let cashierSelectedRow = -1;

// PIN session — who is currently logged in at the POS
let pinSession = null; // { cashierId, name, role }

const CATEGORY_LABELS = {
  milk_tea:  'Milky\nSeries',
  fruit_tea: 'Fruity\nBeverage',
  tea:       'Non\nCaffeinated',
  coffee:    'Fresh\nBrew',
  seasonal:  'Seasonal'
};

const EXTRA_BOBA_PRODUCT_ID = 16;
const EXTRA_BOBA_PRICE = 0.75;

// ── Translation ──────────────────────────────────────────────────────────────
let cashierLang = localStorage.getItem('cashierLang') || 'en';

const CASHIER_T = {
  en: {
    currentOrder: 'Current Order', noItems: 'No drinks added yet.',
    subtotal: 'Subtotal', tax: 'Tax (8.25%)', total: 'Total',
    payment: 'Payment', checkout: 'Checkout', removeItem: 'Remove Item',
    clearAll: 'Clear All', modifySelected: 'Modify selected:',
    halfSweet: 'Half Sweet', twoXSweet: '2x Sweet', halfIce: 'Half Ice',
    noIce: 'No Ice', extraBoba: 'Extra Boba (+$0.75)', modify: 'Modify',
    custTranslation: 'Customer Translation', assistantShortcut: 'Assistant Shortcut',
    weatherSuggestion: 'Weather Suggestion', translate: 'Translate', ask: 'Ask',
    loggedIn: 'Logged in as:', cashierPOS: 'Cashier POS'
  },
  es: {
    currentOrder: 'Pedido actual', noItems: 'No hay bebidas aún.',
    subtotal: 'Subtotal', tax: 'Impuesto (8.25%)', total: 'Total',
    payment: 'Pago', checkout: 'Cobrar', removeItem: 'Eliminar artículo',
    clearAll: 'Limpiar todo', modifySelected: 'Modificar seleccionado:',
    halfSweet: 'Mitad dulce', twoXSweet: '2x dulce', halfIce: 'Mitad hielo',
    noIce: 'Sin hielo', extraBoba: 'Boba extra (+$0.75)', modify: 'Modificar',
    custTranslation: 'Traducción al cliente', assistantShortcut: 'Asistente',
    weatherSuggestion: 'Sugerencia del tiempo', translate: 'Traducir', ask: 'Preguntar',
    loggedIn: 'Sesión:', cashierPOS: 'Caja POS'
  },
  zh: {
    currentOrder: '当前订单', noItems: '还没有饮品。',
    subtotal: '小计', tax: '税 (8.25%)', total: '合计',
    payment: '付款方式', checkout: '结账', removeItem: '删除',
    clearAll: '清空', modifySelected: '修改已选:',
    halfSweet: '半糖', twoXSweet: '双倍甜', halfIce: '少冰',
    noIce: '去冰', extraBoba: '加珍珠(+$0.75)', modify: '修改',
    custTranslation: '顾客翻译', assistantShortcut: '助手',
    weatherSuggestion: '天气建议', translate: '翻译', ask: '询问',
    loggedIn: '登录为:', cashierPOS: '收银台'
  }
};

function ct(key) { return CASHIER_T[cashierLang]?.[key] || CASHIER_T.en[key] || key; }

function applyTranslations() {
  document.querySelectorAll('[data-ct]').forEach(el => {
    el.textContent = ct(el.dataset.ct);
  });
}

// ── PIN Screen ────────────────────────────────────────────────────────────────
function showPinScreen() {
  const overlay = document.getElementById('pin-overlay');
  if (overlay) overlay.classList.remove('hidden');
}
function hidePinScreen() {
  const overlay = document.getElementById('pin-overlay');
  if (overlay) overlay.classList.add('hidden');
}

async function submitPin() {
  const pinInput = document.getElementById('pin-input');
  const pinError = document.getElementById('pin-error');
  const pin = pinInput.value.trim();
  if (!pin) { pinError.textContent = 'Please enter your PIN.'; return; }

  pinError.textContent = 'Checking…';
  try {
    const res  = await fetch('/api/cashier/pin-login', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ pin })
    });
    const data = await res.json();
    if (!res.ok) {
      pinError.textContent = data.error || 'Invalid PIN.';
      pinInput.value = '';
      return;
    }
    pinSession = { cashierId: data.cashierId, name: data.name, role: data.role };
    document.getElementById('cashier-user-name').textContent = data.name;
    hidePinScreen();
    pinInput.value = '';
    pinError.textContent = '';
  } catch(_) {
    pinError.textContent = 'Could not connect. Try again.';
  }
}

async function requestAccess() {
  const name  = document.getElementById('request-name').value.trim();
  const email = document.getElementById('request-email').value.trim();
  const msg   = document.getElementById('request-msg');
  if (!name || !email) { msg.textContent = 'Please enter your name and email.'; return; }
  msg.textContent = 'Submitting…';
  try {
    const res  = await fetch('/api/staff-requests', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ name, email, requestedRole: 'cashier' })
    });
    const data = await res.json();
    msg.textContent = data.message || 'Request submitted! A manager will set up your PIN.';
    msg.style.color = '#15803d';
  } catch(_) {
    msg.textContent = 'Could not submit. Try again.';
  }
}

function toggleRequestForm() {
  const form = document.getElementById('request-access-form');
  if (form) form.classList.toggle('hidden');
}

function cashierLogout() {
  if (pinSession) {
    fetch('/api/cashier/pin-logout', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ cashierId: pinSession.cashierId, staffType: pinSession.role === 'manager' ? 'manager' : 'cashier' })
    }).catch(() => {});
    pinSession = null;
  }
  cashierOrder = [];
  cashierSelectedRow = -1;
  renderCart();
  showPinScreen();
}

//  INIT
async function initCashier() {
  // Set up PIN overlay events
  const pinBtn = document.getElementById('pin-submit-btn');
  if (pinBtn) pinBtn.addEventListener('click', submitPin);
  document.getElementById('pin-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') submitPin();
  });
  document.getElementById('pin-request-link')?.addEventListener('click', toggleRequestForm);
  document.getElementById('request-submit-btn')?.addEventListener('click', requestAccess);
  document.getElementById('cashier-logout-btn')?.addEventListener('click', cashierLogout);

  // Language selector
  const langSel = document.getElementById('cashier-lang-select');
  if (langSel) {
    langSel.value = cashierLang;
    langSel.addEventListener('change', () => {
      cashierLang = langSel.value;
      localStorage.setItem('cashierLang', cashierLang);
      applyTranslations();
      renderCategories();
      renderProductGrid();
      renderCart();
    });
  }

  // Show PIN screen first
  showPinScreen();

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
  applyTranslations();

  document.getElementById('cashier-modify-overlay').addEventListener('click', e => {
    if (e.target.id === 'cashier-modify-overlay') e.target.classList.add('hidden');
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

//  PRODUCT GRID - with background image
const IMAGE_MAP = {
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
function getDrinkImg(name) { return IMAGE_MAP[name] || '/boba/Sonny-Boba.png'; }

function renderProductGrid() {
  const grid = document.getElementById('cashier-product-grid');
  const filtered = cashierMenu.filter(item => item.category === cashierActiveCategory);
  if (!filtered.length) {
    grid.innerHTML = '<p style="color:var(--muted);padding:12px;grid-column:1/-1;">No items in this category.</p>';
    return;
  }
  grid.innerHTML = filtered.map(item => {
    const img = getDrinkImg(item.name);
    return `<button class="cashier-product-btn" data-id="${item.id}" style="
      background-image: url('${img}');
      background-size: 60%;
      background-repeat: no-repeat;
      background-position: center 12%;
      background-blend-mode: multiply;
      background-color: white;
      padding-top: 70px;
      position: relative;
    ">
      <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,rgba(255,250,247,0.96) 70%);border-radius:14px;"></div>
      <div style="position:relative;z-index:1;">
        <strong>${item.name}</strong>
        <span>$${Number(item.price).toFixed(2)}</span>
      </div>
    </button>`;
  }).join('');

  grid.querySelectorAll('.cashier-product-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = cashierMenu.find(x => x.id === Number(btn.dataset.id));
      if (!item) return;
      cashierOrder.push({
        id: item.id, name: item.name, qty: 1, unitPrice: Number(item.price),
        sugar: 100, ice: 100, note: '', linePrice: Number(item.price)
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
  const count   = cashierOrder.length;

  countEl.textContent = `${count} item${count === 1 ? '' : 's'}`;
  if (!count) { emptyEl.style.display=''; tableEl.style.display='none'; updateTotals(0); return; }
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
  const tax = subtotal * 0.0825;
  document.getElementById('cashier-subtotal').textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById('cashier-tax').textContent      = `$${tax.toFixed(2)}`;
  document.getElementById('cashier-total').textContent    = `$${(subtotal + tax).toFixed(2)}`;
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
    if (value >= 200 && !item.note.includes('2x Sweet')) item.note = (item.note ? item.note+', ' : '')+'2x Sweet';
  } else if (type === 'ice') {
    item.ice = Math.min(value, 100);
    const tag = value === 0 ? 'No Ice' : 'Half Ice';
    if (!item.note.includes(tag)) item.note = (item.note ? item.note+', ' : '')+tag;
  }
  renderCart();
}

function applyExtraBoba() {
  if (!requireSelection()) return;
  const selected = cashierOrder[cashierSelectedRow];
  if (selected.id === EXTRA_BOBA_PRODUCT_ID) { setStatus('Cannot add Extra Boba to a topping.', 'error'); return; }
  cashierOrder.splice(cashierSelectedRow + 1, 0, {
    id: EXTRA_BOBA_PRODUCT_ID, name: 'Extra Boba', qty: 1,
    unitPrice: EXTRA_BOBA_PRICE, sugar: 100, ice: 100,
    note: 'for: '+selected.name, linePrice: EXTRA_BOBA_PRICE
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

//  MODIFY PANEL
function showModifyPanel() {
  if (!requireSelection()) return;
  const item    = { ...cashierOrder[cashierSelectedRow] };
  const overlay = document.getElementById('cashier-modify-overlay');
  const card    = document.getElementById('cashier-modify-card');

  card.innerHTML = `
    <h3>Modify: ${item.name}</h3>
    <div class="modify-fields">
      <div class="modify-field">
        <label>Sweetness <strong id="mod-sugar-val">${Math.min(item.sugar,200)}%</strong></label>
        <input type="range" id="mod-sugar" min="0" max="200" step="25" value="${Math.min(item.sugar,200)}" />
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
    </div>`;

  overlay.classList.remove('hidden');
  document.getElementById('mod-sugar').addEventListener('input', e => { document.getElementById('mod-sugar-val').textContent = e.target.value+'%'; });
  document.getElementById('mod-ice').addEventListener('input',   e => { document.getElementById('mod-ice-val').textContent   = e.target.value+'%'; });
  document.getElementById('mod-cancel-btn').addEventListener('click', () => overlay.classList.add('hidden'));
  document.getElementById('mod-apply-btn').addEventListener('click', () => {
    const sugar = Number(document.getElementById('mod-sugar').value);
    const ice   = Number(document.getElementById('mod-ice').value);
    const qty   = Math.max(1, Number(document.getElementById('mod-qty').value));
    const note  = document.getElementById('mod-note').value.trim();
    cashierOrder[cashierSelectedRow] = { ...item, sugar, ice, qty, note, linePrice: Number((item.unitPrice*qty).toFixed(2)) };
    overlay.classList.add('hidden');
    renderCart();
  });
}

//  CART ACTIONS
function bindCartActions() {
  document.getElementById('cashier-remove-btn').addEventListener('click', () => {
    if (!requireSelection()) return;
    cashierOrder.splice(cashierSelectedRow, 1);
    cashierSelectedRow = cashierOrder.length ? Math.min(cashierSelectedRow, cashierOrder.length-1) : -1;
    renderCart();
  });

  document.getElementById('cashier-clear-btn').addEventListener('click', () => {
    cashierOrder = [];
    cashierSelectedRow = -1;
    setStatus('');
    renderCart();
  });

  document.getElementById('cashier-pay-btn').addEventListener('click', async () => {
    if (!cashierOrder.length) { setStatus('Add at least one item first.', 'error'); return; }
    if (!pinSession) { setStatus('Please log in with your PIN first.', 'error'); showPinScreen(); return; }
    setStatus('Submitting order…', '');
    try {
      const paymentMethod = document.getElementById('cashier-payment-method').value;
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashierId: pinSession.cashierId,   // ← uses actual logged-in cashier
          source: 'cashier',
          paymentMethod,
          items: cashierOrder.map(item => ({
            id: item.id, quantity: item.qty, unitPrice: item.unitPrice,
            selections: {
              sweetness: item.sugar+'%', ice: item.ice+'%', size: 'Regular',
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
    } catch (err) { setStatus(err.message, 'error'); }
  });
}

function setStatus(msg, type = '') {
  const el = document.getElementById('cashier-checkout-result');
  el.textContent = msg;
  el.className = 'cashier-checkout-status' + (type ? ' '+type : '');
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
    } catch (e) { out.textContent = e.message; }
  });

  document.getElementById('cashier-assistant-btn').addEventListener('click', async () => {
    const message = document.getElementById('cashier-assistant-input').value.trim();
    const out     = document.getElementById('cashier-assistant-result');
    out.textContent = 'Thinking…';
    try {
      const res  = await fetch('/api/assistant', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ message }) });
      const data = await res.json();
      out.textContent = data.reply || 'No response.';
    } catch (e) { out.textContent = e.message; }
  });
}

//  WEATHER — direct from browser
async function loadCashierWeather() {
  const wrap = document.getElementById('cashier-weather-card');
  if (!wrap) return;
  wrap.innerHTML = '<p class="muted">Loading weather…</p>';
  const LAT = 30.6280, LON = -96.3344;

  function wLabel(code) {
    const m = {0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',
      51:'Light drizzle',61:'Light rain',63:'Moderate rain',65:'Heavy rain',
      80:'Rain showers',81:'Moderate showers',82:'Heavy showers',95:'Thunderstorm'};
    return m[Number(code)] || 'Mixed conditions';
  }
  function wTip(temp, code) {
    if ([61,63,65,80,81,82,95].includes(Number(code)))
      return 'Rainy outside — customers will appreciate warm milk teas.';
    if (temp >= 90) return 'Very hot today — lead with fruit teas and extra ice.';
    if (temp >= 80) return 'Warm day — fruit teas and iced drinks are selling well.';
    if (temp >= 65) return 'Mild weather — both milk teas and fruit teas are popular.';
    if (temp >= 50) return 'Cool outside — recommend brown sugar or matcha milk tea.';
    return 'Cold today — push hot or rich milk teas to warm customers up.';
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FChicago`;
    const data = await (await fetch(url)).json();
    const cur  = data.current || {};
    const temp  = cur.temperature_2m       != null ? Math.round(cur.temperature_2m)       : null;
    const feels = cur.apparent_temperature != null ? Math.round(cur.apparent_temperature) : null;
    const wind  = cur.wind_speed_10m       != null ? Math.round(cur.wind_speed_10m)       : null;
    const code  = cur.weather_code ?? null;
    if (temp === null) throw new Error('No data');
    wrap.innerHTML = `
      <div style="display:grid;gap:6px;">
        <div style="font-size:1.4rem;font-weight:800;color:var(--accent-dark);">${temp}°F</div>
        <div style="font-size:0.85rem;color:var(--muted);">
          ${wLabel(code)}${feels!==null?` · Feels like ${feels}°F`:''}${wind!==null?` · ${wind} mph wind`:''}
        </div>
        <div style="font-size:0.88rem;font-weight:600;color:var(--ink);margin-top:4px;">${wTip(temp, code)}</div>
      </div>`;
  } catch (_) {
    wrap.innerHTML = '<p class="muted">Weather unavailable right now.</p>';
  }
}

//  START
initCashier();
