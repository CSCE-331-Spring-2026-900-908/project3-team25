async function logout() {
  await fetch('/auth/logout', { method: 'POST' });
  window.location.href = '/';
}

function showPortalMessage(message) {
  const el = document.getElementById('portal-access-message');
  if (!el) return;
  el.textContent = message;
}

function setRestrictedLink(linkEl, label, message) {
  if (!linkEl) return;
  linkEl.textContent = label;
  linkEl.href = '#';
  linkEl.onclick = (event) => {
    event.preventDefault();
    showPortalMessage(message);
  };
}

function setOpenLink(linkEl, label, href) {
  if (!linkEl) return;
  linkEl.textContent = label;
  linkEl.href = href;
  linkEl.onclick = null;
}

async function loadAuthState() {
  const statusWrap = document.getElementById('auth-status');
  const cashierLink = document.getElementById('portal-cashier-link');
  const managerLink = document.getElementById('portal-manager-link');

  if (!statusWrap) return;

  try {
    const response = await fetch('/api/me');
    const data = await response.json();

    if (!data.authenticated) {
      statusWrap.innerHTML = `
        <p class="muted">Not signed in.</p>
        <div class="button-row">
          <a class="btn" href="/auth/google">Sign in with Google</a>
        </div>
      `;

      setRestrictedLink(
        cashierLink,
        'Cashier POS',
        'Cashier access requires a staff login.'
      );

      setRestrictedLink(
        managerLink,
        'Manager View',
        'Manager access is restricted to authorized manager accounts.'
      );

      return;
    }

    const { displayName, email, role } = data.user;

    statusWrap.innerHTML = `
      <p class="muted">Signed in as <strong>${displayName}</strong> (${email})</p>
      <p class="muted">Role: <strong>${role}</strong></p>
      <div class="button-row">
        <button class="btn ghost" id="logout-btn">Sign out</button>
      </div>
    `;

    document.getElementById('logout-btn').addEventListener('click', logout);

    if (role === 'cashier' || role === 'manager') {
      setOpenLink(cashierLink, 'Open Cashier POS', '/cashier.html');
    } else {
      setRestrictedLink(
        cashierLink,
        'Cashier POS',
        'Cashier access requires a staff login.'
      );
    }

    if (role === 'manager') {
      setOpenLink(managerLink, 'Open Manager View', '/manager.html');
    } else {
      setRestrictedLink(
        managerLink,
        'Manager View',
        'Manager access is restricted to authorized manager accounts.'
      );
    }
  } catch (error) {
    statusWrap.innerHTML = `
      <p class="muted">Not signed in yet.</p>
      <div class="button-row">
        <a class="btn" href="/auth/google">Sign in with Google</a>
      </div>
    `;

    setRestrictedLink(
      cashierLink,
      'Cashier POS',
      'Cashier access requires a staff login.'
    );

    setRestrictedLink(
      managerLink,
      'Manager View',
      'Manager access is restricted to authorized manager accounts.'
    );
  }
}

loadAuthState();