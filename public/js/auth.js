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
    <p class="dashboard-greeting">Welcome back, ${user.firstName || user.displayName}.</p>
    <div class="dashboard-grid">
      <div class="dashboard-card"><h3>Manager View</h3><a href="/manager.html" class="btn full">Open Manager View</a></div>
      <div class="dashboard-card"><h3>Cashier POS</h3><a href="/cashier.html" class="btn full">Open Cashier POS</a></div>
      <div class="dashboard-card"><h3>Customer Kiosk</h3><a href="/customer.html" class="btn full">Open Customer Kiosk</a></div>
      <div class="dashboard-card"><h3>Menu Board</h3><a href="/menu-board.html" class="btn full">Open Menu Board</a></div>
    </div>`;
}

function renderCashierDashboard(user) {
  return `
    <p class="dashboard-greeting">Welcome back, ${user.firstName || user.displayName}.</p>
    <div class="dashboard-grid">
      <div class="dashboard-card"><h3>Cashier POS</h3><a href="/cashier.html" class="btn full">Open Cashier POS</a></div>
      <div class="dashboard-card"><h3>Customer Kiosk</h3><a href="/customer.html" class="btn full">Open Customer Kiosk</a></div>
      <div class="dashboard-card"><h3>Menu Board</h3><a href="/menu-board.html" class="btn full">Open Menu Board</a></div>
    </div>`;
}

function renderCustomerDashboard(user) {
  const pts = user.rewardPoints ?? 0;
  return `
    <p class="dashboard-greeting">Welcome back, ${user.firstName || user.displayName}.</p>
    <p class="dashboard-sub">${pts} reward point${pts === 1 ? '' : 's'}</p>
    <div class="dashboard-grid">
      <div class="dashboard-card"><h3>Order Now</h3><a href="/customer.html" class="btn full">Open Customer Kiosk</a></div>
      <div class="dashboard-card"><h3>Rewards</h3><a href="/customer.html#rewards" class="btn full">Open Rewards</a></div>
      <div class="dashboard-card"><h3>Spin &amp; Win</h3><a href="/customer.html#spin" class="btn full">Open Spin &amp; Win</a></div>
    </div>`;
}

function renderGuestDashboard() {
  return `
    <div class="dashboard-grid">
      <div class="dashboard-card"><h3>Customer Kiosk</h3><a href="/customer.html" class="btn full">Open Customer Kiosk</a></div>
      <div class="dashboard-card"><h3>Menu Board</h3><a href="/menu-board.html" class="btn full">Open Menu Board</a></div>
      <div class="dashboard-card"><h3>Sign In</h3><a href="/auth/google" class="btn full">Sign In with Google</a></div>
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
        ${role === 'customer' ? `<p class="muted" style="margin:0 0 8px;font-size:0.82rem;"><strong>${pts}</strong> reward points</p>` : ''}
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
    if (params.get('unauthorized')) showPortalMessage('You do not have permission to access that page.');
    if (params.get('loginError')) showPortalMessage('Login failed. Please try again.');

  } catch (error) {
    statusWrap.innerHTML = `
      <p class="muted">Not signed in.</p>
      <a class="btn" href="/auth/google">Sign in with Google</a>
    `;
    if (dashboard) dashboard.innerHTML = renderGuestDashboard();
  }
}

loadAuthState();
