//  STATE 
let cashierMenu = [];
let cashierCategories = [];
let cashierActiveCategory = '';
let cashierOrder = []; // { id, name, qty, unitPrice, sugar, ice, note, linePrice }
let cashierSelectedRow = -1;
let pinSession = null; // { cashierId, name, role } — set after PIN login

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
  document.getElementById('cashier-logout-btn')?.addEventListener('click', cashierPinLogout);

  // Show PIN screen immediately — no Google login needed
  // PIN controls all cashier access
  renderCashierOverlay('pin', null);

  // Language selector
  const langSel = document.getElementById('cashier-lang-select');
  if (langSel) {
    langSel.addEventListener('change', () => {
      // Re-render categories with new language if needed
      renderCategories();
    });
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

  document.getElementById('cashier-modify-overlay').addEventListener('click', e => {
    if (e.target.id === 'cashier-modify-overlay') {
      e.target.classList.add('hidden');
    }
  });
}

async function getCashierAuthState() {
  try {
    const res = await fetch('/api/staff-auth-status');
    return await res.json();
  } catch (_) {
    return { authenticated: false, allowed: false, user: null };
  }
}

function startGoogleCashierLogin() {
  window.location.href = '/auth/google?returnTo=' + encodeURIComponent('/cashier.html');
}

function wirePinOverlayActions() {
  document.getElementById('pin-submit-btn')?.addEventListener('click', submitPin);
  document.getElementById('pin-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') submitPin(); });
  document.getElementById('pin-request-link')?.addEventListener('click', () => {
    const f = document.getElementById('request-access-form');
    if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('request-submit-btn')?.addEventListener('click', submitAccessRequest);
}

function renderCashierOverlay(mode, user = null) {
  const overlay = document.getElementById('pin-overlay');
  if (!overlay) return;

  if (mode === 'google') {
    overlay.innerHTML = `
      <div style="background:white;border:1px solid var(--line);border-radius:20px;padding:40px 36px;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.12);text-align:center;">
        <div style="width:60px;height:60px;border-radius:12px;background:var(--accent);color:white;display:grid;place-items:center;font-weight:800;font-size:1.4rem;margin:0 auto 16px;">RB</div>
        <h2 style="margin:0 0 6px;font-size:1.4rem;color:var(--accent-dark);">Cashier sign in</h2>
        <p style="color:var(--muted);font-size:0.9rem;margin:0 0 24px;">Sign in with your Google account first. After that, staff members can enter their PIN right here.</p>
        <button id="cashier-google-login-btn" style="width:100%;padding:14px;background:var(--accent);color:white;border:none;border-radius:10px;font:inherit;font-size:1rem;font-weight:700;cursor:pointer;">Continue with Google</button>
      </div>`;
    overlay.classList.remove('hidden');
    document.getElementById('cashier-google-login-btn')?.addEventListener('click', startGoogleCashierLogin);
    return;
  }

  if (mode === 'unauthorized') {
    overlay.innerHTML = `
      <div style="background:white;border:1px solid var(--line);border-radius:20px;padding:40px 36px;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.12);text-align:center;">
        <div style="width:60px;height:60px;border-radius:12px;background:var(--accent);color:white;display:grid;place-items:center;font-weight:800;font-size:1.4rem;margin:0 auto 16px;">RB</div>
        <h2 style="margin:0 0 6px;font-size:1.4rem;color:var(--accent-dark);">Staff access only</h2>
        <p style="color:var(--muted);font-size:0.9rem;margin:0 0 20px;">${user?.displayName || 'This Google account'} is not approved for cashier access. Sign out and use a staff Google account.</p>
        <button id="cashier-switch-account-btn" style="width:100%;padding:14px;background:var(--accent);color:white;border:none;border-radius:10px;font:inherit;font-size:1rem;font-weight:700;cursor:pointer;">Sign out</button>
      </div>`;
    overlay.classList.remove('hidden');
    document.getElementById('cashier-switch-account-btn')?.addEventListener('click', async () => {
      await fetch('/auth/logout', { method: 'POST' }).catch(() => {});
      startGoogleCashierLogin();
    });
    return;
  }

  overlay.innerHTML = `
    <div style="background:white;border:1px solid var(--line);border-radius:20px;padding:40px 36px;max-width:380px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.12);text-align:center;">
      <div style="width:60px;height:60px;border-radius:12px;background:var(--accent);color:white;display:grid;place-items:center;font-weight:800;font-size:1.4rem;margin:0 auto 16px;">RB</div>
      <h2 style="margin:0 0 6px;font-size:1.4rem;color:var(--accent-dark);">Reveille Bubble Tea</h2>
      <p style="color:var(--muted);font-size:0.88rem;margin:0 0 24px;">Signed in as ${user?.displayName || 'staff'}. Enter your staff PIN to begin.</p>
      <input type="password" id="pin-input" maxlength="8" placeholder="••••" style="width:100%;padding:14px;text-align:center;font-size:1.6rem;letter-spacing:0.35em;border:2px solid var(--line);border-radius:10px;font-weight:700;box-sizing:border-box;margin-bottom:10px;" />
      <div id="pin-error" style="color:var(--accent);font-size:0.85rem;min-height:20px;margin-bottom:10px;"></div>
      <button id="pin-submit-btn" style="width:100%;padding:14px;background:var(--accent);color:white;border:none;border-radius:10px;font:inherit;font-size:1rem;font-weight:700;cursor:pointer;margin-bottom:14px;">Enter PIN</button>
      <div id="pin-request-link" style="font-size:0.83rem;color:var(--muted);cursor:pointer;text-decoration:underline;">New here? Request access from a manager</div>
      <div id="request-access-form" style="display:none;margin-top:16px;text-align:left;">
        <input type="text" id="request-name" placeholder="Your full name" style="width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:8px;font:inherit;font-size:0.9rem;margin-bottom:8px;box-sizing:border-box;" />
        <input type="email" id="request-email" placeholder="Your TAMU email" style="width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:8px;font:inherit;font-size:0.9rem;margin-bottom:8px;box-sizing:border-box;" />
        <button id="request-submit-btn" style="width:100%;padding:11px;background:var(--accent-dark);color:white;border:none;border-radius:8px;font:inherit;font-weight:700;cursor:pointer;">Submit Request</button>
        <div id="request-msg" style="font-size:0.82rem;margin-top:6px;min-height:18px;"></div>
      </div>
    </div>`;
  overlay.classList.remove('hidden');
  if (user?.displayName) {
    const nameEl = document.getElementById('cashier-user-name');
    if (nameEl) nameEl.textContent = user.displayName;
  }
  wirePinOverlayActions();
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

//  IMAGE MAP
const CASHIER_IMAGE_MAP = {
  'Classic Milk Tea':      '/boba/Classic-Milk-Tea.PNG',
  'Brown Sugar Milk Tea':  '/boba/Brown-Sugar-Milk-Tea.PNG',
  'Taro Milk Tea':         '/boba/Taro-Milk-Tea.PNG',
  'Matcha Milk Tea':       '/boba/Matcha-Milk-Tea.PNG',
  'Thai Tea':              '/boba/Thai-Milk-Tea.PNG',
  'Honey Green Tea':       '/boba/Honey-Green-Tea.PNG',
  'Wintermelon Milk Tea':  '/boba/Wintermelon-Milk-Tea.PNG',
  'Oolong Milk Tea':       '/boba/Ooglong-Tea.png',
  'Coffee Milk Tea':       '/boba/Coffee-Milk-Tea.png',
  'Lychee Green Tea':      '/boba/Lychee.png',
  'Mango Green Tea':       '/boba/Mango.png',
  'Peach Green Tea':       '/boba/Peach.png',
  'Strawberry Green Tea':  '/boba/Strawberry-.png',
  'Jasmine Green Tea':     '/boba/Sonny-Boba.png',
  'Black Tea Lemonade':    '/boba/Sonny-Boba.png'
};
function cashierDrinkImg(name) { return CASHIER_IMAGE_MAP[name] || '/boba/Sonny-Boba.png'; }

//  PRODUCT GRID
function renderProductGrid() {
  const grid = document.getElementById('cashier-product-grid');
  const filtered = cashierMenu.filter(item => item.category === cashierActiveCategory);

  if (!filtered.length) {
    grid.innerHTML = '<p style="color:var(--muted);padding:12px;grid-column:1/-1;">No items in this category.</p>';
    return;
  }

  grid.innerHTML = filtered.map(item => {
    const img = cashierDrinkImg(item.name);
    return `<button class="cashier-product-btn" data-id="${item.id}" style="
        background-image: url('${img}');
        background-size: 62%;
        background-repeat: no-repeat;
        background-position: center 10%;
        background-color: #fffaf7;
        background-blend-mode: multiply;
        padding-top: 72px;
        position: relative;
      ">
        <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 45%,rgba(255,250,247,0.97) 72%);border-radius:14px;pointer-events:none;"></div>
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
          cashierId: pinSession ? pinSession.cashierId : 7,
          source: 'cashier',
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

  // Call Open-Meteo directly from browser (Render free plan blocks outbound server calls)
  const LAT = 30.6280, LON = -96.3344;

  function weatherLabel(code) {
    const m = { 0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
      45:'Foggy',51:'Light drizzle',53:'Drizzle',61:'Light rain',63:'Moderate rain',
      65:'Heavy rain',80:'Rain showers',81:'Moderate showers',82:'Heavy showers',
      95:'Thunderstorm',96:'Thunderstorm + hail' };
    return m[Number(code)] || 'Mixed conditions';
  }
  function drinkSuggestion(temp, code) {
    if ([61,63,65,80,81,82,95].includes(Number(code))) return 'Rainy outside. Customers will want warm milk teas like Brown Sugar or Matcha.';
    if (temp >= 95) return 'Scorching hot. Lead with Mango or Lychee Green Tea over extra ice.';
    if (temp >= 85) return 'Really warm. Strawberry or Peach Green Tea are great iced options today.';
    if (temp >= 75) return 'Warm day. Fruit teas are selling well, especially Mango Green Tea.';
    if (temp >= 65) return 'Mild weather. Classic Milk Tea and Taro Milk Tea are popular choices.';
    if (temp >= 50) return 'Getting cool. Push Brown Sugar Milk Tea or Thai Tea to warm customers up.';
    return 'Cold outside. Rich milk teas like Matcha or Brown Sugar are the top picks today.';
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FChicago`;
    const res  = await fetch(url);
    const data = await res.json();
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
          ${weatherLabel(code)}
          ${feels !== null ? ` · Feels like ${feels}°F` : ''}
          ${wind  !== null ? ` · ${wind} mph wind` : ''}
        </div>
        <div style="font-size:0.88rem;font-weight:600;color:var(--ink);margin-top:4px;">${drinkSuggestion(temp, code)}</div>
      </div>`;
  } catch (_) {
    wrap.innerHTML = '<p class="muted">Weather unavailable right now.</p>';
  }
}

//  START 
initCashier();

// ── PIN Overlay ───────────────────────────────────────────────────────────────
function showPinOverlay() {
  const el = document.getElementById('pin-overlay');
  if (el) el.classList.remove('hidden');
}
function hidePinOverlay() {
  const el = document.getElementById('pin-overlay');
  if (el) el.classList.add('hidden');
}

async function submitPin() {
  const input = document.getElementById('pin-input');
  const errEl = document.getElementById('pin-error');
  const pin   = input?.value.trim();
  if (!pin) { if (errEl) errEl.textContent = 'Please enter your PIN.'; return; }
  if (errEl) errEl.textContent = 'Checking...';
  try {
    const res  = await fetch('/api/cashier/pin-login', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ pin: String(pin) })
    });
    const data = await res.json();
    if (!res.ok) {
      if (errEl) errEl.textContent = data.error || 'Invalid PIN. Check with your manager.';
      if (input) input.value = '';
      return;
    }
    pinSession = { cashierId: data.cashierId, name: data.name, role: data.role };
    const nameEl = document.getElementById('cashier-user-name');
    if (nameEl) nameEl.textContent = data.name;
    if (input) input.value = '';
    if (errEl) errEl.textContent = '';
    hidePinOverlay();
  } catch(err) {
    if (errEl) errEl.textContent = 'Connection error: ' + err.message;
  }
}

async function cashierPinLogout() {
  if (pinSession) {
    await fetch('/api/cashier/pin-logout', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ cashierId: pinSession.cashierId, staffType: pinSession.role === 'manager' ? 'manager' : 'cashier' })
    }).catch(()=>{});
    pinSession = null;
  }
  cashierOrder = [];
  cashierSelectedRow = -1;
  renderCart();
  showPinOverlay();
}

async function submitAccessRequest() {
  const name  = document.getElementById('request-name')?.value.trim();
  const email = document.getElementById('request-email')?.value.trim();
  const msg   = document.getElementById('request-msg');
  if (!name || !email) { if (msg) msg.textContent = 'Please enter your name and email.'; return; }
  if (msg) msg.textContent = 'Submitting...';
  try {
    const res  = await fetch('/api/staff-requests', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name, email })
    });
    const data = await res.json();
    if (msg) { msg.textContent = data.message || 'Request submitted!'; msg.style.color = '#15803d'; }
  } catch(_) {
    if (msg) msg.textContent = 'Could not submit. Try again.';
  }
}
