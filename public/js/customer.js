// ─── State ────────────────────────────────────────────────────────────────────
let customerMenu        = [];
let customerCategories  = [];
let customerActiveCategory = '';
let customerOrder       = [];
let selectedPaymentMethod = 'card';
let currentUser         = null;

// Reward / promo applied at checkout
let appliedRewardId     = null;
let appliedRewardLabel  = '';
let appliedPromoCode    = null;
let appliedPromoLabel   = '';
let discountAmount      = 0;
let spinPrizeDetails    = null; // { type, value } stored from spin result for deferred discount calc

// Drink modal state
let modalItem   = null;
let modalQty    = 1;

// Edit modal state
let editingIndex = -1;

// ─── Image map ────────────────────────────────────────────────────────────────
const IMAGE_MAP = {
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
function getDrinkImg(name) { return IMAGE_MAP[name] || '/boba/Sonny-Boba.png'; }

// ─── Pricing helpers ──────────────────────────────────────────────────────────
function extraPrice(size, topping) {
  let extra = 0;
  if (size === 'Large') extra += 1.0;
  if (topping === 'Extra Boba') extra += 0.75;
  return extra;
}
function calcSubtotal() {
  return customerOrder.reduce((s, i) => s + Number(i.linePrice || 0), 0);
}
function calcTax(subtotal) { return subtotal * 0.0825; }

// ─── Screen routing ───────────────────────────────────────────────────────────
function setActiveScreen(name) {
  ['menu','review','payment','confirm'].forEach(s => {
    const el = document.getElementById(`screen-${s}`);
    el.classList.remove('active-screen');
    el.classList.add('hidden-screen');
  });
  const target = document.getElementById(`screen-${name}`);
  target.classList.remove('hidden-screen');
  target.classList.add('active-screen');
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  let t = document.getElementById('kiosk-toast');
  if (!t) { t = document.createElement('div'); t.id='kiosk-toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('kiosk-toast-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('kiosk-toast-show'), 2200);
}

// ─── Auth / rewards bar ───────────────────────────────────────────────────────
async function loadUser() {
  try {
    const res  = await fetch('/api/me');
    const data = await res.json();
    if (!data.authenticated) return;
    currentUser = data.user;
    const greeting = document.getElementById('kiosk-user-greeting');
    if (greeting) greeting.textContent = `Hi, ${currentUser.firstName || currentUser.displayName}`;
    renderRewardsTopbar(currentUser.rewardPoints ?? 0);
  } catch(_) {}
}

function renderRewardsTopbar(pts) {
  const bar = document.getElementById('rewards-topbar');
  const ptsEl = document.getElementById('topbar-pts');
  if (!bar) return;
  bar.style.display = 'flex';
  if (ptsEl) ptsEl.textContent = pts.toLocaleString();
}

function updateTopbarPts(pts) {
  const ptsEl = document.getElementById('topbar-pts');
  if (ptsEl) ptsEl.textContent = pts.toLocaleString();
  if (currentUser) currentUser.rewardPoints = pts;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function renderTabs() {
  const wrap = document.getElementById('customer-tabs');
  wrap.innerHTML = customerCategories.map(cat => `
    <button class="tab-btn ${customerActiveCategory===cat?'active':''}" data-category="${cat}" type="button">
      ${cat.replace(/_/g,' ')}
    </button>
  `).join('');
  wrap.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      customerActiveCategory = btn.dataset.category;
      renderTabs();
      renderMenu();
    });
  });
}

// ─── Menu grid ────────────────────────────────────────────────────────────────
function renderMenu() {
  const wrap    = document.getElementById('customer-menu');
  const filtered = customerMenu.filter(i => i.category === customerActiveCategory);

  wrap.innerHTML = filtered.map(item => `
    <article class="menu-card" data-id="${item.id}" tabindex="0" role="button"
             aria-label="${item.name}, $${Number(item.price).toFixed(2)}">
      <div class="drink-image-wrap">
        <img src="${getDrinkImg(item.name)}" alt="${item.name}" class="drink-image"
             onerror="this.src='/boba/Sonny-Boba.png'" />
      </div>
      <div class="topline">
        <h3 style="margin:0;">${item.name}</h3>
        ${item.popular ? '<span class="tag">Popular</span>' : ''}
      </div>
      <div class="price-line" style="margin-top:auto;">
        <span class="price">$${Number(item.price).toFixed(2)}</span>
        <button class="btn add-btn" data-id="${item.id}" type="button" style="font-size:0.85rem;padding:8px 16px;">
          Customize →
        </button>
      </div>
    </article>
  `).join('');

  wrap.querySelectorAll('.menu-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.classList.contains('add-btn')) return; // handled below
      const item = customerMenu.find(x => x.id === Number(card.dataset.id));
      if (item) openDrinkModal(item);
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const item = customerMenu.find(x => x.id === Number(card.dataset.id));
        if (item) openDrinkModal(item);
      }
    });
  });

  wrap.querySelectorAll('.add-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const item = customerMenu.find(x => x.id === Number(btn.dataset.id));
      if (item) openDrinkModal(item);
    });
  });
}

// ─── Drink Detail Modal ───────────────────────────────────────────────────────
function openDrinkModal(item) {
  modalItem = item;
  modalQty  = 1;

  document.getElementById('modal-drink-img').src        = getDrinkImg(item.name);
  document.getElementById('modal-drink-img').alt        = item.name;
  document.getElementById('modal-drink-name').textContent = item.name;
  document.getElementById('modal-drink-desc').textContent = item.description || '';
  document.getElementById('modal-sweetness').value = 'Regular Sugar';
  document.getElementById('modal-ice').value       = 'Regular Ice';
  document.getElementById('modal-size').value      = 'Regular';
  document.getElementById('modal-topping').value   = 'None';

  updateModalQty();
  updateModalPrice();

  document.getElementById('drink-modal-overlay').classList.add('open');
  document.getElementById('modal-cancel-btn').focus();
}

function closeDrinkModal() {
  document.getElementById('drink-modal-overlay').classList.remove('open');
  modalItem = null;
}

function updateModalQty() {
  document.getElementById('modal-qty-display').textContent = modalQty;
}

function updateModalPrice() {
  if (!modalItem) return;
  const size    = document.getElementById('modal-size').value;
  const topping = document.getElementById('modal-topping').value;
  const extra   = extraPrice(size, topping);
  const unit    = Number(modalItem.price) + extra;
  const total   = unit * modalQty;
  document.getElementById('modal-drink-price').textContent = `$${unit.toFixed(2)}`;
  document.getElementById('modal-add-btn').textContent     = `Add to Order — $${total.toFixed(2)}`;
}

function addModalItemToOrder() {
  if (!modalItem) return;
  const selections = {
    sweetness: document.getElementById('modal-sweetness').value,
    ice:       document.getElementById('modal-ice').value,
    size:      document.getElementById('modal-size').value,
    topping:   document.getElementById('modal-topping').value
  };
  const extra     = extraPrice(selections.size, selections.topping);
  const unitPrice = Number(modalItem.price) + extra;
  const linePrice = unitPrice * modalQty;

  customerOrder.push({
    ...modalItem,
    quantity:  modalQty,
    selections,
    unitPrice,
    linePrice
  });

  showToast(`${modalItem.name} × ${modalQty} added! 🧋`);
  closeDrinkModal();
  renderOrder();
}

// ── Modal events
document.getElementById('modal-cancel-btn').addEventListener('click', closeDrinkModal);
document.getElementById('drink-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('drink-modal-overlay')) closeDrinkModal();
});
document.getElementById('modal-qty-minus').addEventListener('click', () => {
  if (modalQty > 1) { modalQty--; updateModalQty(); updateModalPrice(); }
});
document.getElementById('modal-qty-plus').addEventListener('click', () => {
  if (modalQty < 10) { modalQty++; updateModalQty(); updateModalPrice(); }
});
document.getElementById('modal-add-btn').addEventListener('click', addModalItemToOrder);
['modal-size','modal-topping'].forEach(id => {
  document.getElementById(id).addEventListener('change', updateModalPrice);
});

// ─── Order rendering ──────────────────────────────────────────────────────────
function renderOrder() {
  const lines      = document.getElementById('customer-order-lines');
  const count      = document.getElementById('customer-item-count');
  const revCount   = document.getElementById('review-item-count');
  const menuCount  = document.getElementById('menu-screen-count');

  const itemCount  = customerOrder.reduce((s, i) => s + (i.quantity || 1), 0);
  count.textContent   = `${itemCount} item${itemCount===1?'':'s'}`;
  revCount.textContent = `${itemCount} item${itemCount===1?'':'s'}`;
  menuCount.textContent = String(itemCount);

  renderTotals();

  if (!customerOrder.length) {
    lines.innerHTML = '<p class="cart-note">No drinks added yet. Pick a drink from the menu to start.</p>';
    return;
  }

  lines.innerHTML = customerOrder.map((item, idx) => {
    const mods = [
      item.selections.size !== 'Regular'       ? item.selections.size          : null,
      item.selections.sweetness !== 'Regular Sugar' ? item.selections.sweetness : null,
      item.selections.ice !== 'Regular Ice'    ? item.selections.ice           : null,
      item.selections.topping !== 'None'       ? item.selections.topping       : null
    ].filter(Boolean);

    return `
      <article class="order-item">
        <div class="line-top">
          <strong>${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ''}</strong>
          <strong>$${Number(item.linePrice).toFixed(2)}</strong>
        </div>
        <small class="muted">${mods.join(', ') || 'No modifications'}</small>
        <div class="order-item-actions">
          <button class="btn ghost edit-btn" data-index="${idx}" type="button" style="font-size:0.82rem;padding:6px 12px;">Edit</button>
          <button class="btn ghost remove-btn" data-index="${idx}" type="button" style="font-size:0.82rem;padding:6px 12px;">Remove</button>
        </div>
      </article>`;
  }).join('');

  lines.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      customerOrder.splice(Number(btn.dataset.index), 1);
      resetDiscount();
      renderOrder();
    });
  });
  lines.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(Number(btn.dataset.index)));
  });
}

function renderTotals() {
  const subtotal   = calcSubtotal();
  const discount   = discountAmount;
  const discounted = subtotal - discount;
  const tax        = calcTax(discounted);
  const total      = discounted + tax;

  document.getElementById('customer-subtotal').textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById('customer-tax').textContent      = `$${tax.toFixed(2)}`;
  document.getElementById('customer-total').textContent    = `$${total.toFixed(2)}`;
  document.getElementById('payment-total').textContent     = `$${total.toFixed(2)}`;

  const discountRow = document.getElementById('discount-row');
  if (discount > 0) {
    discountRow.style.display = '';
    document.getElementById('customer-discount').textContent = `−$${discount.toFixed(2)}`;
    document.getElementById('discount-label').textContent    = appliedRewardLabel || appliedPromoLabel || 'Discount';
    const note = document.getElementById('payment-discount-note');
    if (note) { note.textContent = `Includes ${appliedRewardLabel || appliedPromoLabel} (−$${discount.toFixed(2)})`; note.style.display = ''; }
  } else {
    discountRow.style.display = 'none';
    const note = document.getElementById('payment-discount-note');
    if (note) note.style.display = 'none';
  }
}

// ─── Rewards panel on review screen ──────────────────────────────────────────
let rewardsCatalogCache = [];

async function loadCheckoutRewardsPanel() {
  const panel = document.getElementById('checkout-rewards-panel');
  if (!panel) return;

  if (!currentUser) { panel.style.display = 'none'; return; }
  panel.style.display = '';

  try {
    const [rwRes, promoRes] = await Promise.all([
      fetch('/api/rewards'),
      fetch('/api/promos')
    ]);
    const rwData    = await rwRes.json();
    const promoData = await promoRes.json();

    const userPts = rwData.userPoints ?? currentUser.rewardPoints ?? 0;
    updateTopbarPts(userPts);
    rewardsCatalogCache = rwData.catalog || [];

    const wrap = document.getElementById('reward-select-wrap');

    // If a reward is already applied, don't re-render the selector
    if (appliedRewardId) {
      wrap.innerHTML = '';
      renderAppliedDiscount();
      renderTotals();
      return;
    }

    const affordable = rewardsCatalogCache.filter(r => r.points_cost <= userPts);

    if (affordable.length > 0) {
      wrap.innerHTML = `
        <label style="display:block;font-size:0.8rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted);margin-bottom:4px;">
          Apply a Reward (${userPts} pts available)
        </label>
        <div style="display:flex;gap:8px;margin-bottom:6px;">
          <select id="reward-select" style="flex:1;padding:9px 10px;border:1px solid var(--line);border-radius:8px;font:inherit;">
            <option value="">— Select a reward —</option>
            ${affordable.map(r => `<option value="${r.reward_id}" data-label="${r.label}" data-type="${r.reward_type}" data-value="${r.reward_value}">${r.label} (${r.points_cost} pts)</option>`).join('')}
          </select>
          <button type="button" class="btn-apply" id="apply-reward-btn">Apply</button>
        </div>`;
      document.getElementById('apply-reward-btn').addEventListener('click', applySelectedReward);

      // Auto-apply best affordable reward if only one exists
      if (affordable.length === 1 && !appliedPromoCode) {
        const sel = document.getElementById('reward-select');
        sel.value = affordable[0].reward_id;
        applySelectedReward();
      }
    } else {
      wrap.innerHTML = `<p class="muted" style="font-size:0.83rem;margin:0 0 6px;">
        ${userPts > 0 ? `You have ${userPts} pts — keep ordering to unlock rewards!` : 'Earn 10 pts per dollar — start ordering to earn rewards!'}
      </p>`;
    }

    // Auto-fill promo input if user has a code from spin wheel
    if (promoData.codes?.length > 0 && !appliedPromoCode) {
      const input = document.getElementById('promo-code-input');
      if (input) {
        input.placeholder = `You have a code: ${promoData.codes[0].code}`;
        // Auto-apply the newest code
        input.value = promoData.codes[0].code;
        await applyPromoCode();
      }
    }

    // If a spin prize was applied but discount not yet calculated (CSV mode or first review visit)
    if (appliedPromoCode && spinPrizeDetails && discountAmount === 0) {
      calcRewardDiscount(spinPrizeDetails.type, Number(spinPrizeDetails.value || 0));
    }

    renderAppliedDiscount();
    renderTotals();
  } catch(e) {
    console.error('Rewards panel failed:', e);
  }
}

function applySelectedReward() {
  const sel = document.getElementById('reward-select');
  if (!sel || !sel.value) return;
  const opt = sel.options[sel.selectedIndex];

  appliedRewardId    = Number(sel.value);
  appliedRewardLabel = opt.dataset.label || 'Reward';
  appliedPromoCode   = null;
  appliedPromoLabel  = '';

  // Calculate discount immediately from reward data attributes
  calcRewardDiscount(opt.dataset.type, Number(opt.dataset.value || 0));
  renderAppliedDiscount();
  renderTotals();

  // Hide the selector since reward is now applied
  const wrap = document.getElementById('reward-select-wrap');
  if (wrap) wrap.innerHTML = '';
}

function calcRewardDiscount(type, value) {
  const subtotal = calcSubtotal();
  if (!subtotal) { discountAmount = 0; return; }
  if (type === 'percent_off') {
    discountAmount = Number(((subtotal * value) / 100).toFixed(2));
  } else if (type === 'free_drink') {
    // Cheapest drink in cart
    discountAmount = customerOrder.length ? Math.min(...customerOrder.map(i => i.unitPrice)) : 0;
    discountAmount = Number(discountAmount.toFixed(2));
  } else if (type === 'free_topping') {
    discountAmount = 0.75;
  } else if (type === 'flat_off') {
    discountAmount = Math.min(subtotal, value);
  } else {
    discountAmount = 0;
  }
  discountAmount = Math.min(discountAmount, subtotal);
}

async function applyPromoCode() {
  const input = document.getElementById('promo-code-input');
  const fb    = document.getElementById('promo-feedback');
  const code  = (input?.value || '').trim().toUpperCase();
  if (!code) return;

  if (fb) { fb.style.color = 'var(--muted)'; fb.textContent = 'Checking…'; }

  try {
    const res  = await fetch(`/api/promos/validate/${code}`);
    const data = await res.json();
    if (!data.valid) {
      if (fb) { fb.style.color = 'var(--accent)'; fb.textContent = data.reason || 'Invalid or expired code.'; }
      return;
    }
    const promo = data.promo;
    appliedPromoCode   = code;
    appliedPromoLabel  = promo.label;
    appliedRewardId    = null;
    appliedRewardLabel = '';

    // Calculate discount immediately
    const subtotal = calcSubtotal();
    if (promo.promo_type === 'percent_off')  discountAmount = Number(((subtotal * Number(promo.promo_value)) / 100).toFixed(2));
    else if (promo.promo_type === 'flat_off') discountAmount = Math.min(subtotal, Number(promo.promo_value));
    else if (promo.promo_type === 'free_drink') discountAmount = customerOrder.length ? Math.min(...customerOrder.map(i=>i.unitPrice)) : 0;
    else if (promo.promo_type === 'free_topping') discountAmount = 0.75;
    discountAmount = Math.min(discountAmount, subtotal);

    if (fb) { fb.style.color = '#15803d'; fb.textContent = `✓ "${promo.label}" applied! −$${discountAmount.toFixed(2)}`; }
    renderAppliedDiscount();
    renderTotals();
  } catch(_) {
    if (fb) { fb.style.color = 'var(--accent)'; fb.textContent = 'Could not validate code.'; }
  }
}

function renderAppliedDiscount() {
  const wrap = document.getElementById('applied-reward-display');
  if (!wrap) return;
  if (appliedRewardId || appliedPromoCode) {
    const label = appliedRewardLabel || appliedPromoLabel;
    wrap.innerHTML = `
      <div class="applied-reward-tag">
        ✓ ${label}
        <button type="button" onclick="clearDiscount()" aria-label="Remove discount">✕</button>
      </div>`;
  } else {
    wrap.innerHTML = '';
  }
}

function clearDiscount() {
  appliedRewardId    = null;
  appliedRewardLabel = '';
  appliedPromoCode   = null;
  appliedPromoLabel  = '';
  discountAmount     = 0;
  spinPrizeDetails   = null;
  const fb = document.getElementById('promo-feedback');
  if (fb) fb.textContent = '';
  renderAppliedDiscount();
  renderTotals();
  loadCheckoutRewardsPanel();
}
window.clearDiscount = clearDiscount;

function resetDiscount() { clearDiscount(); }

// ─── Rewards Modal ────────────────────────────────────────────────────────────
async function openRewardsModal() {
  const overlay = document.getElementById('rewards-modal-overlay');
  overlay.classList.add('open');

  try {
    const res  = await fetch('/api/rewards');
    const data = await res.json();
    const pts  = data.userPoints ?? 0;

    document.getElementById('rewards-pts-display').textContent = `${pts.toLocaleString()} pts`;
    updateTopbarPts(pts);

    // Catalog
    const catalog = data.catalog || [];
    const listEl  = document.getElementById('rewards-catalog-list');
    listEl.innerHTML = catalog.map(r => {
      const canRedeem = pts >= r.points_cost;
      return `
        <div class="reward-card ${canRedeem ? 'can-redeem' : ''}">
          <div class="rw-info">
            <div class="rw-name">${r.label}</div>
            <div class="rw-cost">${r.points_cost} pts needed${!canRedeem ? ` · need ${r.points_cost - pts} more` : ''}</div>
          </div>
          <button class="btn-redeem" 
                  data-id="${r.reward_id}" 
                  data-label="${r.label}" 
                  data-type="${r.reward_type}"
                  data-value="${r.reward_value || 0}"
                  ${!canRedeem ? 'disabled' : ''}>
            ${canRedeem ? 'Redeem' : 'Locked'}
          </button>
        </div>`;
    }).join('');

    listEl.querySelectorAll('.btn-redeem:not(:disabled)').forEach(btn => {
      btn.addEventListener('click', () => {
        appliedRewardId    = Number(btn.dataset.id);
        appliedRewardLabel = btn.dataset.label;
        appliedPromoCode   = null;
        appliedPromoLabel  = '';
        // Calculate discount immediately using type/value from data attrs
        calcRewardDiscount(btn.dataset.type, Number(btn.dataset.value || 0));
        showToast(`${btn.dataset.label} applied — −$${discountAmount.toFixed(2)}`);
        closeRewardsModal();
        renderAppliedDiscount();
        renderTotals();
      });
    });

    // History
    const histEl = document.getElementById('rewards-history-list');
    const history = data.history || [];
    histEl.innerHTML = history.length
      ? history.map(h => `
          <div class="rw-history-item">
            <span>${h.label}</span>
            <span>${new Date(h.redeemed_at).toLocaleDateString()}</span>
          </div>`).join('')
      : '<p class="muted" style="font-size:0.85rem;">No redemptions yet.</p>';
  } catch(e) {
    document.getElementById('rewards-catalog-list').innerHTML = '<p class="muted">Could not load rewards.</p>';
  }
}

function closeRewardsModal() {
  document.getElementById('rewards-modal-overlay').classList.remove('open');
}

document.getElementById('rewards-modal-close').addEventListener('click', closeRewardsModal);
document.getElementById('rewards-modal-close2').addEventListener('click', closeRewardsModal);
document.getElementById('rewards-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('rewards-modal-overlay')) closeRewardsModal();
});

// ─── Spin Wheel ───────────────────────────────────────────────────────────────
const SPIN_SEGMENTS = [
  { label: '50% Off\nOne Drink',  color: '#9e3b35' },
  { label: 'Free\nTopping',       color: '#c05a4a' },
  { label: '$1 Off\nYour Order',  color: '#d07a5a' },
  { label: 'Free\nSmall Drink',   color: '#b84d3e' },
  { label: 'Buy One\nGet One',    color: '#a04040' },
  { label: '25% Off\nOrder',      color: '#cc6655' }
];

let spinAngle          = 0;
let spinning           = false;
let canSpin            = false;
let spinResult         = null;
let spinAnimDone       = false;
let spinApiDone        = false;
let hasSpunThisSession = false;

function drawWheel() {
  const canvas  = document.getElementById('spin-canvas');
  if (!canvas) return;
  const ctx     = canvas.getContext('2d');
  const cx      = canvas.width / 2;
  const cy      = canvas.height / 2;
  const radius  = cx - 4;
  const segAngle = (2 * Math.PI) / SPIN_SEGMENTS.length;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  SPIN_SEGMENTS.forEach((seg, i) => {
    const start = spinAngle + i * segAngle;
    const end   = start + segAngle;

    // Slice
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Text
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + segAngle / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'white';
    ctx.font = 'bold 11px Inter, sans-serif';
    seg.label.split('\n').forEach((line, li) => {
      ctx.fillText(line, radius - 10, li * 14 - (seg.label.includes('\n') ? 7 : 0));
    });
    ctx.restore();
  });

  // Center circle
  ctx.beginPath();
  ctx.arc(cx, cy, 24, 0, 2 * Math.PI);
  ctx.fillStyle = '#fffaf7';
  ctx.fill();
  ctx.strokeStyle = 'rgba(158,59,53,0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

async function openSpinModal() {
  closeRewardsModal();
  const overlay = document.getElementById('spin-modal-overlay');
  overlay.classList.add('open');
  drawWheel();

  const btn   = document.getElementById('spin-btn');
  const msgEl = document.getElementById('spin-status-msg');
  const result = document.getElementById('spin-result');
  result.classList.remove('show');

  if (!currentUser) {
    btn.disabled = true;
    btn.textContent = 'SPIN!';
    msgEl.textContent = 'Sign in with your TAMU Google account to spin!';
    return;
  }

  // Already spun this session — no need to re-check server
  if (hasSpunThisSession) {
    btn.disabled = true;
    btn.textContent = 'Spun!';
    msgEl.textContent = 'Already spun today. Come back tomorrow!';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'SPIN!';
  msgEl.textContent = 'Checking eligibility…';
  try {
    const res  = await fetch('/api/spin/status');
    const data = await res.json();
    canSpin    = data.canSpin;
    if (canSpin) {
      btn.disabled = false;
      msgEl.textContent = 'Spin once per day for a chance to win prizes!';
    } else {
      btn.disabled = true;
      btn.textContent = 'Spun!';
      msgEl.textContent = data.reason || 'Come back tomorrow!';
    }
  } catch(_) {
    canSpin = true;
    btn.disabled = false;
    msgEl.textContent = 'Spin for a chance to win!';
  }
}

function closeSpinModal() {
  document.getElementById('spin-modal-overlay').classList.remove('open');
}

// Called when both animation and API have resolved
function tryFinishSpin() {
  if (!spinAnimDone || !spinApiDone) return;

  spinning = false;
  const result  = document.getElementById('spin-result');
  const prizeEl = document.getElementById('spin-prize-label');
  const codeEl  = document.getElementById('spin-promo-code');

  if (spinResult) {
    // Snap wheel to the correct prize segment so visual matches the prize
    const segAngle = (2 * Math.PI) / SPIN_SEGMENTS.length;
    const segIdx = SPIN_SEGMENTS.findIndex(
      s => s.label.replace(/\n/g, ' ') === (spinResult.prize?.label || '')
    );
    if (segIdx >= 0) {
      // Pointer is at 12 o'clock (−π/2 in canvas coords)
      const base = -Math.PI / 2 - (segIdx + 0.5) * segAngle;
      const n = Math.round((spinAngle - base) / (2 * Math.PI));
      spinAngle = base + n * 2 * Math.PI;
      drawWheel();
    }

    prizeEl.textContent = `You won: ${spinResult.prize?.label || 'a prize'}!`;
    codeEl.textContent  = spinResult.code ? `Code: ${spinResult.code}` : '';
    result.classList.add('show');

    if (spinResult.code) {
      appliedPromoCode  = spinResult.code;
      appliedPromoLabel = spinResult.prize?.label || 'Promo';
      spinPrizeDetails  = spinResult.prize || null;
      discountAmount    = 0;
    }
    showToast(`You won: ${spinResult.prize?.label}!`);
  }

  const btn = document.getElementById('spin-btn');
  btn.textContent = 'Spun!';
  canSpin = false;
  hasSpunThisSession = true;
}

async function executeSpin() {
  if (!canSpin || spinning) return;
  spinning = true;
  spinAnimDone = false;
  spinApiDone  = false;
  spinResult   = null;

  const btn = document.getElementById('spin-btn');
  btn.disabled = true;
  btn.textContent = 'Spinning…';

  // Animate wheel
  const extraSpins  = 5 + Math.random() * 3;
  const targetAngle = spinAngle + extraSpins * 2 * Math.PI + Math.random() * 2 * Math.PI;
  const duration    = 4000;
  const startAngle  = spinAngle;
  const startTime   = performance.now();

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function animate(now) {
    const t = Math.min((now - startTime) / duration, 1);
    spinAngle = startAngle + (targetAngle - startAngle) * easeOut(t);
    drawWheel();
    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      spinAnimDone = true;
      if (!spinApiDone) btn.textContent = 'Processing…';
      tryFinishSpin();
    }
  }
  requestAnimationFrame(animate);

  // API call in parallel
  try {
    const res  = await fetch('/api/spin', { method: 'POST' });
    spinResult = await res.json();
  } catch(_) {
    spinResult = { prize: { label: 'Free Topping', type: 'free_topping', value: 0 }, code: 'RBT-DEMO' };
  }
  spinApiDone = true;
  tryFinishSpin();
}

document.getElementById('spin-btn').addEventListener('click', executeSpin);
document.getElementById('spin-modal-close').addEventListener('click', closeSpinModal);
document.getElementById('spin-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('spin-modal-overlay')) closeSpinModal();
});

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function openEditModal(index) {
  const item = customerOrder[index];
  if (!item) return;
  editingIndex = index;

  document.getElementById('edit-modal-title').textContent  = item.name;
  document.getElementById('edit-sweetness').value          = item.selections.sweetness;
  document.getElementById('edit-ice').value                = item.selections.ice;
  document.getElementById('edit-size').value               = item.selections.size;
  document.getElementById('edit-topping').value            = item.selections.topping;

  document.getElementById('edit-modal-overlay').classList.remove('hidden');
  document.getElementById('edit-modal-overlay').classList.add('open');
}

document.getElementById('edit-modal-cancel').addEventListener('click', () => {
  document.getElementById('edit-modal-overlay').classList.remove('open');
  document.getElementById('edit-modal-overlay').classList.add('hidden');
});

document.getElementById('edit-modal-save').addEventListener('click', () => {
  if (editingIndex < 0) return;
  const item = customerOrder[editingIndex];
  const newSel = {
    sweetness: document.getElementById('edit-sweetness').value,
    ice:       document.getElementById('edit-ice').value,
    size:      document.getElementById('edit-size').value,
    topping:   document.getElementById('edit-topping').value
  };
  const extra    = extraPrice(newSel.size, newSel.topping);
  const unitPrice = Number(item.price) + extra;
  customerOrder[editingIndex] = { ...item, selections: newSel, unitPrice, linePrice: unitPrice * (item.quantity || 1) };
  document.getElementById('edit-modal-overlay').classList.remove('open');
  document.getElementById('edit-modal-overlay').classList.add('hidden');
  renderOrder();
});

// ─── Payment ──────────────────────────────────────────────────────────────────
function setPaymentMethod(method) {
  selectedPaymentMethod = method;
  document.querySelectorAll('.payment-option').forEach(btn => {
    btn.classList.toggle('active-payment', btn.dataset.payment === method);
  });
}

document.querySelectorAll('.payment-option').forEach(btn => {
  btn.addEventListener('click', () => setPaymentMethod(btn.dataset.payment));
});

// ─── Checkout ─────────────────────────────────────────────────────────────────
document.getElementById('customer-checkout-btn').addEventListener('click', async () => {
  const out = document.getElementById('customer-checkout-result');
  if (!customerOrder.length) { out.textContent = 'Add at least one drink first.'; return; }

  out.textContent = 'Placing order…';

  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cashierId:     1,
        paymentMethod: selectedPaymentMethod,
        rewardId:      appliedRewardId || null,
        promoCode:     appliedPromoCode || null,
        items: customerOrder.map(item => ({
          id:         item.id,
          quantity:   item.quantity || 1,
          unitPrice:  item.unitPrice,
          selections: item.selections
        }))
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.details || data.error || 'Checkout failed.');

    // Update confirmation screen
    document.getElementById('confirmation-message').textContent =
      `Transaction #${data.transactionId} saved. ${data.source === 'database' ? '(Database)' : '(Fallback)'}`;

    const rewardsBox = document.getElementById('confirm-rewards-box');
    if (data.pointsEarned > 0) {
      document.getElementById('confirm-pts-earned').textContent = `+${data.pointsEarned}`;
      document.getElementById('confirm-pts-balance').textContent = (data.newPointBalance ?? 0).toLocaleString();
      rewardsBox.style.display = '';
      updateTopbarPts(data.newPointBalance ?? (currentUser?.rewardPoints ?? 0) + data.pointsEarned);
    } else {
      rewardsBox.style.display = 'none';
    }

    out.textContent = '';
    setActiveScreen('confirm');
  } catch(e) {
    out.textContent = e.message;
  }
});

// ─── Navigation wiring ────────────────────────────────────────────────────────
document.getElementById('go-to-review-btn').addEventListener('click', () => {
  if (!customerOrder.length) { showToast('Add at least one drink first! 🧋'); return; }
  renderOrder();
  setActiveScreen('review');
  loadCheckoutRewardsPanel();
});

document.getElementById('back-to-menu-btn').addEventListener('click', () => setActiveScreen('menu'));
document.getElementById('go-to-payment-btn').addEventListener('click', () => {
  if (!customerOrder.length) { showToast('Your order is empty.'); return; }
  renderTotals();
  setActiveScreen('payment');
});
document.getElementById('back-to-review-btn').addEventListener('click', () => setActiveScreen('review'));
document.getElementById('customer-clear-btn').addEventListener('click', () => {
  customerOrder = [];
  resetDiscount();
  renderOrder();
});
document.getElementById('start-new-order-btn').addEventListener('click', () => {
  customerOrder      = [];
  selectedPaymentMethod = 'card';
  resetDiscount();
  setPaymentMethod('card');
  document.getElementById('customer-checkout-result').textContent = '';
  document.getElementById('confirmation-message').textContent    = 'Your order has been received.';
  renderOrder();
  setActiveScreen('menu');
});

document.getElementById('apply-promo-btn').addEventListener('click', applyPromoCode);

// Rewards / spin buttons
document.getElementById('open-rewards-btn')?.addEventListener('click', openRewardsModal);
document.getElementById('open-spin-topbar-btn')?.addEventListener('click', openSpinModal);
document.getElementById('open-spin-btn')?.addEventListener('click', openSpinModal);

// ─── Deep-link support (#rewards / #spin from portal) ────────────────────────
function checkDeepLink() {
  if (window.location.hash === '#rewards') openRewardsModal();
  if (window.location.hash === '#spin')    openSpinModal();
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function loadCustomerMenu() {
  const res  = await fetch('/api/menu');
  const data = await res.json();
  customerMenu       = data.items || [];
  customerCategories = Object.keys(data.categories || {});
  customerActiveCategory = customerCategories[0] || '';
  renderTabs();
  renderMenu();
  renderOrder();
}

async function loadCustomerWeather() {
  const banner = document.getElementById('customer-weather-banner');
  if (!banner) return;

  banner.innerHTML = '<p class="muted">Loading weather…</p>';

  try {
    const res = await fetch('/api/weather?city=College%20Station');
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Weather failed.');

    banner.innerHTML = `
      <div class="weather-banner-content">
        <div>
          <strong>${data.city}</strong> · ${data.weatherLabel}
        </div>
        <div>
          ${Math.round(data.temperature)}°F · ${data.drinkSuggestion}
        </div>
      </div>
    `;
  } catch (err) {
    banner.innerHTML = `<p class="muted">${err.message}</p>`;
  }
}

async function init() {
  await loadUser();
  await loadCustomerMenu();
  await loadCustomerWeather();
  setPaymentMethod('card');
  setActiveScreen('menu');
  checkDeepLink();
}

init();
