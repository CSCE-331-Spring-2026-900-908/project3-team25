async function logout() {
  await fetch('/auth/logout', { method: 'POST' });
  window.location.href = '/';
}

function showPortalMessage(message) {
  const el = document.getElementById('portal-access-message');
  if (!el) return;
  el.textContent = message;
}

// ── Role-aware dashboard renderer ──────────────────────────────────────────

function renderManagerDashboard(user) {
  return `
    <p class="dashboard-greeting">Welcome back, ${user.firstName || user.displayName}! 👋</p>
    <p class="dashboard-sub">Manager Dashboard — you have full access.</p>
    <div class="dashboard-grid">
      <a href="/manager.html" class="dashboard-card">
        <div class="dc-icon">📊</div>
        <h3>Manager View</h3>
        <p>Sales, inventory &amp; menu management</p>
      </a>
      <a href="/cashier.html" class="dashboard-card">
        <div class="dc-icon">🖥️</div>
        <h3>Cashier POS</h3>
        <p>Process orders at the register</p>
      </a>
      <a href="/customer.html" class="dashboard-card">
        <div class="dc-icon">🧋</div>
        <h3>Customer Kiosk</h3>
        <p>Self-service ordering experience</p>
      </a>
      <a href="/menu-board.html" class="dashboard-card">
        <div class="dc-icon">📋</div>
        <h3>Menu Board</h3>
        <p>Display board for the store</p>
      </a>
    </div>`;
}

function renderCashierDashboard(user) {
  return `
    <p class="dashboard-greeting">Hey, ${user.firstName || user.displayName}! 👋</p>
    <p class="dashboard-sub">Cashier Dashboard</p>
    <div class="dashboard-grid">
      <a href="/cashier.html" class="dashboard-card">
        <div class="dc-icon">🖥️</div>
        <h3>Cashier POS</h3>
        <p>Process orders at the register</p>
      </a>
      <a href="/customer.html" class="dashboard-card">
        <div class="dc-icon">🧋</div>
        <h3>Customer Kiosk</h3>
        <p>Self-service ordering experience</p>
      </a>
      <a href="/menu-board.html" class="dashboard-card">
        <div class="dc-icon">📋</div>
        <h3>Menu Board</h3>
        <p>Display board for the store</p>
      </a>
    </div>`;
}

function renderCustomerDashboard(user) {
  const pts = user.rewardPoints ?? 0;
  return `
    <p class="dashboard-greeting">Hi, ${user.firstName || user.displayName}! 🧋</p>
    <p class="dashboard-sub">You have <strong style="color:var(--accent)">${pts} reward points</strong> — keep earning!</p>
    <div class="dashboard-grid">
      <a href="/customer.html" class="dashboard-card">
        <div class="dc-icon">🧋</div>
        <h3>Order Now</h3>
        <p>Browse our menu and customize your drink</p>
      </a>
      <a href="/customer.html#rewards" class="dashboard-card">
        <div class="dc-icon">⭐</div>
        <h3>Rewards</h3>
        <p>${pts} pts — redeem for discounts &amp; free drinks</p>
      </a>
      <a href="/customer.html#spin" class="dashboard-card">
        <div class="dc-icon">🎡</div>
        <h3>Spin &amp; Win</h3>
        <p>Daily wheel for promos and free drinks</p>
      </a>
    </div>`;
}

function renderGuestDashboard() {
  return `
    <p class="dashboard-greeting">Welcome to Reveille Bubble Tea! 🧋</p>
    <p class="dashboard-sub">Sign in to earn rewards, spin the prize wheel, and unlock exclusive deals.</p>
    <div class="dashboard-grid">
      <a href="/customer.html" class="dashboard-card">
        <div class="dc-icon">🧋</div>
        <h3>Order Now</h3>
        <p>Browse our full menu</p>
      </a>
      <a href="/menu-board.html" class="dashboard-card">
        <div class="dc-icon">📋</div>
        <h3>Menu Board</h3>
        <p>See all drinks &amp; prices</p>
      </a>
      <div class="dashboard-card" onclick="window.location='/auth/google'" style="cursor:pointer;">
        <div class="dc-icon">🔐</div>
        <h3>Sign In</h3>
        <p>Login with TAMU Google to earn rewards</p>
      </div>
    </div>`;
}

// ── Main auth loader ────────────────────────────────────────────────────────

async function loadAuthState() {
  const statusWrap = document.getElementById('auth-status');
  const dashboard = document.getElementById('role-dashboard');

  if (!statusWrap) return;

  try {
    const response = await fetch('/api/me');
    const data = await response.json();

    if (!data.authenticated) {
      statusWrap.innerHTML = `
        <p class="muted">Not signed in.</p>
        <a class="btn" href="/auth/google">Sign in with Google</a>
      `;
      if (dashboard) dashboard.innerHTML = renderGuestDashboard();
      return;
    }

    const { displayName, firstName, email, role, rewardPoints } = data.user;
    const pts = rewardPoints ?? 0;

    statusWrap.innerHTML = `
      <div style="text-align:right;">
        <p class="muted" style="margin:0 0 2px;">Signed in as <strong>${displayName}</strong></p>
        <p class="muted" style="margin:0 0 2px;font-size:0.82rem;">${email} &nbsp;·&nbsp; Role: <strong>${role}</strong></p>
        ${role === 'customer' ? `<p class="muted" style="margin:0 0 8px;font-size:0.82rem;">⭐ <strong>${pts}</strong> reward points</p>` : ''}
        <button class="btn ghost" id="logout-btn" style="font-size:0.85rem;padding:7px 14px;">Sign out</button>
      </div>
    `;

    document.getElementById('logout-btn').addEventListener('click', logout);

    if (dashboard) {
      if (role === 'manager') dashboard.innerHTML = renderManagerDashboard(data.user);
      else if (role === 'cashier') dashboard.innerHTML = renderCashierDashboard(data.user);
      else dashboard.innerHTML = renderCustomerDashboard(data.user);
    }

    // Handle ?unauthorized=1 or ?loginError=1
    const params = new URLSearchParams(window.location.search);
    if (params.get('unauthorized')) showPortalMessage('⚠️ You do not have permission to access that page.');
    if (params.get('loginError')) showPortalMessage('⚠️ Login failed. Please try again.');

  } catch (error) {
    statusWrap.innerHTML = `
      <p class="muted">Not signed in.</p>
      <a class="btn" href="/auth/google">Sign in with Google</a>
    `;
    if (dashboard) dashboard.innerHTML = renderGuestDashboard();
  }
}

loadAuthState();
