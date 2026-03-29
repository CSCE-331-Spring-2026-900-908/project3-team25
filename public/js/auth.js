async function logout() {
  await fetch('/auth/logout', { method: 'POST' });
  window.location.href = '/';
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

      if (cashierLink) {
        if (role === 'cashier' || role === 'manager') {
            cashierLink.textContent = 'Open Cashier POS';
            cashierLink.href = '/cashier.html';
        } else {
            cashierLink.textContent = 'Cashier Access Only';
            cashierLink.href = '#';
            cashierLink.addEventListener('click', (event) => event.preventDefault());
            }
        }

        if (managerLink) {
            managerLink.textContent = 'Manager Sign-In Required';
            managerLink.href = '/auth/google';
        }

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

    if (cashierLink) {
      cashierLink.textContent = 'Open Cashier POS';
      cashierLink.href = '/cashier.html';
    }

    if (managerLink) {
      if (role === 'manager') {
        managerLink.textContent = 'Open Manager View';
        managerLink.href = '/manager.html';
      } else {
        managerLink.textContent = 'Manager Access Only';
        managerLink.href = '#';
        managerLink.addEventListener('click', (event) => event.preventDefault());
      }
    }
  } catch (error) {
    statusWrap.innerHTML = `<p class="muted">Unable to load sign-in status.</p>`;
  }
}

loadAuthState();