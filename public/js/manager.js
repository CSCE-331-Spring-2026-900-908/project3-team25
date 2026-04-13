// ── State ─────────────────────────────────────────────────────────────────────
let allMenuItems   = [];
let allInventory   = [];
let allEmployees   = [];
let allManagers    = [];
let catChartInst   = null;
let payChartInst   = null;
let hourlyChartInst = null;
let weeklyChartInst = null;

// ── Tab routing ───────────────────────────────────────────────────────────────
document.querySelectorAll('.mgr-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mgr-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.mgr-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const panel = document.getElementById('tab-' + btn.dataset.tab);
    if (panel) panel.classList.add('active');
    // Lazy-load per tab
    if (btn.dataset.tab === 'sales')     loadSalesCharts();
    if (btn.dataset.tab === 'menu')      loadMenuEditor();
    if (btn.dataset.tab === 'inventory') loadFullInventory();
    if (btn.dataset.tab === 'employees') loadEmployees();
    if (btn.dataset.tab === 'reports')   { loadXReport(); loadBestOfWorst(); }
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n)  { return '$' + Number(n||0).toFixed(2); }
function fmtN(n) { return Number(n||0).toLocaleString(); }
function initials(first, last) { return ((first||'?')[0] + (last||'?')[0]).toUpperCase(); }

// ── Overview / Stats ──────────────────────────────────────────────────────────
async function loadOverview() {
  try {
    const [dashRes, recentRes, payRes] = await Promise.all([
      fetch('/api/dashboard'),
      fetch('/api/orders/recent'),
      fetch('/api/analytics/payment-split')
    ]);
    const dash   = await dashRes.json();
    const recent = await recentRes.json();
    const pay    = payRes.ok ? await payRes.json() : { splits: [] };

    // Stats
    document.getElementById('s-items').textContent  = dash.metrics.activeMenuItems;
    document.getElementById('s-inv').textContent    = dash.metrics.inventoryItems;
    document.getElementById('s-low').textContent    = dash.metrics.lowStockItems;
    document.getElementById('s-rev').textContent    = fmt(dash.metrics.totalRevenue);
    document.getElementById('s-orders').textContent = fmtN(dash.metrics.totalOrders);

    // Low stock table
    document.getElementById('inv-tbody').innerHTML = (dash.lowStock || []).map(i => `
      <tr>
        <td>${i.itemName}</td>
        <td>${i.quantityOnHand}</td>
        <td>${i.reorderThreshold}</td>
        <td><span class="${i.status==='low'?'badge-low':'badge-ok'}">${i.status==='low'?'Low stock':'OK'}</span></td>
      </tr>`).join('') || '<tr><td colspan="4" class="muted">No data.</td></tr>';

    // Recent orders
    document.getElementById('orders-tbody').innerHTML = (recent.items || []).map(i => `
      <tr>
        <td>#${i.transactionid || i.transactionId}</td>
        <td>${i.cashierid || i.cashierId}</td>
        <td>${fmt(i.totalamount || i.totalAmount)}</td>
        <td style="text-transform:capitalize">${i.paymentmethod || i.paymentMethod || '—'}</td>
        <td><span class="badge-ok">${i.status}</span></td>
      </tr>`).join('') || '<tr><td colspan="5" class="muted">No orders yet.</td></tr>';

    // Category donut
    const cats  = dash.categories || {};
    const cKeys = Object.keys(cats);
    const COLORS = ['#9e3b35','#c05a4a','#d07a5a','#b84d3e','#a04040','#cc6655','#e08060','#d05040'];
    if (catChartInst) catChartInst.destroy();
    catChartInst = new Chart(document.getElementById('cat-chart'), {
      type: 'doughnut',
      data: { labels: cKeys.map(k => k.replace(/_/g,' ')), datasets: [{ data: cKeys.map(k => cats[k]), backgroundColor: COLORS, borderWidth: 2, borderColor: '#fffaf7' }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'right', labels:{ font:{ size:11 }, color:'#3d251e' } } } }
    });

    // Payment split donut
    const splits = pay.splits || [];
    if (payChartInst) payChartInst.destroy();
    if (splits.length) {
      payChartInst = new Chart(document.getElementById('pay-chart'), {
        type: 'doughnut',
        data: { labels: splits.map(s => s.method), datasets: [{ data: splits.map(s => s.total), backgroundColor: ['#9e3b35','#c05a4a','#d07a5a'], borderWidth: 2, borderColor: '#fffaf7' }] },
        options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'right', labels:{ font:{ size:11 }, color:'#3d251e' } } } }
      });
    } else {
      document.getElementById('pay-chart').parentElement.innerHTML = '<p class="muted" style="text-align:center;padding:40px 0;">No payment data yet.</p>';
    }
  } catch(e) {
    console.error('Overview load failed:', e);
  }
}

// ── Sales Charts ──────────────────────────────────────────────────────────────
async function loadSalesCharts() {
  try {
    const [hourlyRes, weeklyRes, peakRes] = await Promise.all([
      fetch('/api/analytics/hourly'),
      fetch('/api/analytics/weekly'),
      fetch('/api/analytics/peak-days')
    ]);
    const hourly = hourlyRes.ok ? await hourlyRes.json() : { rows:[] };
    const weekly = weeklyRes.ok ? await weeklyRes.json() : { rows:[] };
    const peak   = peakRes.ok  ? await peakRes.json()   : { rows:[] };

    // Hourly chart
    const hrs   = (hourly.rows || []);
    const hLabels = hrs.map(r => `${r.hour_of_day}:00`);
    const hRevs   = hrs.map(r => Number(r.revenue||0).toFixed(2));
    if (hourlyChartInst) hourlyChartInst.destroy();
    hourlyChartInst = new Chart(document.getElementById('hourly-chart'), {
      type: 'bar',
      data: { labels: hLabels, datasets: [{ label:'Revenue ($)', data: hRevs, backgroundColor:'rgba(158,59,53,0.75)', borderRadius:6 }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true, ticks:{ callback: v => '$'+v } } } }
    });

    // Weekly chart
    const wks    = (weekly.rows || []).slice(-12);
    const wLabels = wks.map(r => r.week_start ? r.week_start.toString().slice(0,10) : '');
    const wRevs   = wks.map(r => Number(r.revenue||0).toFixed(2));
    if (weeklyChartInst) weeklyChartInst.destroy();
    weeklyChartInst = new Chart(document.getElementById('weekly-chart'), {
      type: 'line',
      data: { labels: wLabels, datasets: [{ label:'Weekly Revenue ($)', data: wRevs, borderColor:'#9e3b35', backgroundColor:'rgba(158,59,53,0.08)', fill:true, tension:0.4, pointBackgroundColor:'#9e3b35' }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true, ticks:{ callback: v => '$'+v } } } }
    });

    // Peak days table
    document.getElementById('peak-tbody').innerHTML = (peak.rows || []).map((r,i) => `
      <tr>
        <td>${i===0?'🥇 ':i===1?'🥈 ':i===2?'🥉 ':''}${r.day||r.transactiontime||'—'}</td>
        <td><strong>${fmt(r.revenue)}</strong></td>
        <td>${fmtN(r.orders)}</td>
      </tr>`).join('') || '<tr><td colspan="3" class="muted">No data yet.</td></tr>';
  } catch(e) {
    console.error('Sales charts failed:', e);
  }
}

// ── Menu Editor ───────────────────────────────────────────────────────────────
async function loadMenuEditor() {
  const res  = await fetch('/api/menu-all');
  const data = res.ok ? await res.json() : { items:[] };
  allMenuItems = data.items || [];
  renderMenuTable();
}

function renderMenuTable() {
  const q   = (document.getElementById('menu-search')?.value || '').toLowerCase();
  const cat = document.getElementById('menu-filter-cat')?.value || '';
  const rows = allMenuItems.filter(i =>
    (!q   || i.name.toLowerCase().includes(q)) &&
    (!cat || i.category === cat)
  );

  document.getElementById('menu-tbody').innerHTML = rows.map(item => `
    <tr>
      <td><strong>${item.name}</strong></td>
      <td><span class="badge-role">${(item.category||'').replace(/_/g,' ')}</span></td>
      <td>${fmt(item.price || item.baseprice)}</td>
      <td>
        <button class="toggle-switch ${item.is_active||item.isActive?'on':''}" 
                onclick="toggleMenuActive(${item.id||item.productid}, this)"
                title="${item.is_active||item.isActive?'Disable':'Enable'} item"></button>
      </td>
      <td>
        <button class="action-btn" onclick="openEditMenuModal(${item.id||item.productid})">Edit</button>
        <button class="action-btn danger" onclick="deleteMenuItem(${item.id||item.productid}, '${item.name.replace(/'/g,"\\'")}')">Remove</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="5" class="muted" style="padding:20px;">No items found.</td></tr>';
}

function filterMenuTable() { renderMenuTable(); }

function openAddMenuModal() {
  document.getElementById('menu-modal-title').textContent = 'Add Menu Item';
  document.getElementById('menu-modal-id').value  = '';
  document.getElementById('menu-name').value      = '';
  document.getElementById('menu-category').value  = 'milk_tea';
  document.getElementById('menu-price').value     = '';
  document.getElementById('menu-modal').classList.add('open');
}

function openEditMenuModal(id) {
  const item = allMenuItems.find(i => (i.id||i.productid) === id);
  if (!item) return;
  document.getElementById('menu-modal-title').textContent = 'Edit Menu Item';
  document.getElementById('menu-modal-id').value  = id;
  document.getElementById('menu-name').value      = item.name;
  document.getElementById('menu-category').value  = item.category;
  document.getElementById('menu-price').value     = item.price || item.baseprice;
  document.getElementById('menu-modal').classList.add('open');
}

function closeMenuModal() { document.getElementById('menu-modal').classList.remove('open'); }

async function saveMenuItem() {
  const id    = document.getElementById('menu-modal-id').value;
  const name  = document.getElementById('menu-name').value.trim();
  const cat   = document.getElementById('menu-category').value;
  const price = parseFloat(document.getElementById('menu-price').value);
  if (!name || isNaN(price)) { alert('Please fill in all fields.'); return; }

  const method = id ? 'PUT' : 'POST';
  const url    = id ? `/api/menu-item/${id}` : '/api/menu-item';
  const res    = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, category:cat, basePrice:price }) });
  if (res.ok) { closeMenuModal(); loadMenuEditor(); } 
  else { const d = await res.json(); alert('Error: ' + (d.error || 'Save failed.')); }
}

async function toggleMenuActive(id, btn) {
  const isOn = btn.classList.contains('on');
  const res  = await fetch(`/api/menu-item/${id}/toggle`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ active: !isOn }) });
  if (res.ok) { btn.classList.toggle('on'); } 
  else { alert('Could not update item.'); }
}

async function deleteMenuItem(id, name) {
  if (!confirm(`Remove "${name}" from the menu?`)) return;
  const res = await fetch(`/api/menu-item/${id}`, { method:'DELETE' });
  if (res.ok) loadMenuEditor();
  else alert('Could not delete item.');
}

window.openAddMenuModal    = openAddMenuModal;
window.openEditMenuModal   = openEditMenuModal;
window.closeMenuModal      = closeMenuModal;
window.saveMenuItem        = saveMenuItem;
window.toggleMenuActive    = toggleMenuActive;
window.deleteMenuItem      = deleteMenuItem;
window.filterMenuTable     = filterMenuTable;

// ── Full Inventory ────────────────────────────────────────────────────────────
async function loadFullInventory() {
  const res  = await fetch('/api/inventory');
  const data = res.ok ? await res.json() : { items:[] };
  allInventory = data.items || [];
  renderInvTable();
}

function renderInvTable() {
  const filter = document.getElementById('inv-filter')?.value || '';
  const rows = allInventory.filter(i => !filter || i.status === filter);
  document.getElementById('full-inv-tbody').innerHTML = rows.map(i => `
    <tr>
      <td><strong>${i.itemName}</strong></td>
      <td>${i.unit}</td>
      <td style="${i.status==='low'?'color:#dc2626;font-weight:700;':''}">${i.quantityOnHand}</td>
      <td>${i.reorderThreshold}</td>
      <td>$${Number(i.unitCost||0).toFixed(4)}</td>
      <td>${i.vendor || '—'}</td>
      <td><span class="${i.status==='low'?'badge-low':'badge-ok'}">${i.status==='low'?'Low stock':'OK'}</span></td>
    </tr>`).join('') || '<tr><td colspan="7" class="muted" style="padding:20px;">No items.</td></tr>';
}
window.filterInvTable = renderInvTable;

// ── Employees ─────────────────────────────────────────────────────────────────
async function loadEmployees() {
  const [empRes, mgrRes] = await Promise.all([
    fetch('/api/employees'),
    fetch('/api/managers')
  ]);
  allEmployees = empRes.ok ? (await empRes.json()).cashiers || [] : [];
  allManagers  = mgrRes.ok ? (await mgrRes.json()).managers  || [] : [];
  renderEmployeeTable();
  renderManagerTable();
}

function renderEmployeeTable() {
  document.getElementById('emp-tbody').innerHTML = allEmployees.map(e => `
    <tr class="emp-row">
      <td>
        <div style="display:flex;align-items:center;">
          <div class="emp-avatar">${initials(e.firstname||e.firstName, e.lastname||e.lastName)}</div>
          <div>
            <div style="font-weight:600;">${e.firstname||e.firstName} ${e.lastname||e.lastName}</div>
            <div style="font-size:0.78rem;color:var(--muted);">PIN: ${e.pin}</div>
          </div>
        </div>
      </td>
      <td>${e.hiredate||e.hireDate||'—'}</td>
      <td>${Number(e.hoursworked||e.hoursWorked||0).toFixed(1)} hrs</td>
      <td>
        <span class="${(e.is_active||e.isActive)?'badge-ok':'badge-low'}">
          ${(e.is_active||e.isActive)?'Active':'Inactive'}
        </span>
      </td>
      <td>
        <button class="action-btn" onclick="openEditEmpModal(${e.cashierid||e.cashierId||e.id})">Edit</button>
        <button class="action-btn danger" onclick="toggleEmpActive(${e.cashierid||e.cashierId||e.id}, ${e.is_active||e.isActive})">
          ${(e.is_active||e.isActive)?'Deactivate':'Reactivate'}
        </button>
      </td>
    </tr>`).join('') || '<tr><td colspan="5" class="muted" style="padding:20px;">No cashiers found.</td></tr>';
}

function renderManagerTable() {
  document.getElementById('mgr-tbody').innerHTML = allManagers.map(m => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;">
          <div class="emp-avatar" style="background:#4f46e5;">${initials(m.firstname||m.firstName, m.lastname||m.lastName)}</div>
          <strong>${m.firstname||m.firstName} ${m.lastname||m.lastName}</strong>
        </div>
      </td>
      <td>${m.hiredate||m.hireDate||'—'}</td>
      <td><span class="${(m.is_active||m.isActive)?'badge-ok':'badge-low'}">${(m.is_active||m.isActive)?'Active':'Inactive'}</span></td>
    </tr>`).join('') || '<tr><td colspan="3" class="muted">No managers found.</td></tr>';
}

function openAddEmpModal() {
  document.getElementById('emp-modal-title').textContent = 'Add Cashier';
  document.getElementById('emp-modal-id').value  = '';
  document.getElementById('emp-first').value     = '';
  document.getElementById('emp-last').value      = '';
  document.getElementById('emp-hire').value      = new Date().toISOString().slice(0,10);
  document.getElementById('emp-pin').value       = '';
  document.getElementById('emp-modal').classList.add('open');
}

function openEditEmpModal(id) {
  const emp = allEmployees.find(e => (e.cashierid||e.cashierId||e.id) === id);
  if (!emp) return;
  document.getElementById('emp-modal-title').textContent = 'Edit Cashier';
  document.getElementById('emp-modal-id').value  = id;
  document.getElementById('emp-first').value     = emp.firstname||emp.firstName||'';
  document.getElementById('emp-last').value      = emp.lastname||emp.lastName||'';
  document.getElementById('emp-hire').value      = (emp.hiredate||emp.hireDate||'').toString().slice(0,10);
  document.getElementById('emp-pin').value       = emp.pin||'';
  document.getElementById('emp-modal').classList.add('open');
}

function closeEmpModal() { document.getElementById('emp-modal').classList.remove('open'); }

async function saveEmployee() {
  const id        = document.getElementById('emp-modal-id').value;
  const firstName = document.getElementById('emp-first').value.trim();
  const lastName  = document.getElementById('emp-last').value.trim();
  const hireDate  = document.getElementById('emp-hire').value;
  const pin       = document.getElementById('emp-pin').value.trim();
  if (!firstName || !lastName || !hireDate) { alert('Please fill in all required fields.'); return; }

  const method = id ? 'PUT' : 'POST';
  const url    = id ? `/api/employees/${id}` : '/api/employees';
  const res    = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ firstName, lastName, hireDate, pin }) });
  if (res.ok) { closeEmpModal(); loadEmployees(); }
  else { const d = await res.json(); alert('Error: ' + (d.error || 'Save failed.')); }
}

async function toggleEmpActive(id, currentlyActive) {
  const res = await fetch(`/api/employees/${id}/toggle`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ active: !currentlyActive }) });
  if (res.ok) loadEmployees();
  else alert('Could not update employee.');
}

window.openAddEmpModal  = openAddEmpModal;
window.openEditEmpModal = openEditEmpModal;
window.closeEmpModal    = closeEmpModal;
window.saveEmployee     = saveEmployee;
window.toggleEmpActive  = toggleEmpActive;

// ── X-Report ──────────────────────────────────────────────────────────────────
async function loadXReport() {
  const res  = await fetch('/api/analytics/xreport');
  const data = res.ok ? await res.json() : { rows:[] };
  const rows = data.rows || [];

  const totalOrders  = rows.reduce((s,r) => s + Number(r.orders||0), 0);
  const totalRev     = rows.reduce((s,r) => s + Number(r.revenue||0), 0);
  const totalCard    = rows.reduce((s,r) => s + Number(r.card_total||0), 0);
  const totalCash    = rows.reduce((s,r) => s + Number(r.cash_total||0), 0);
  const totalApple   = rows.reduce((s,r) => s + Number(r.applepay_total||0), 0);

  document.getElementById('xreport-summary').innerHTML = `
    <div class="xr-cell"><div class="xv">${totalOrders}</div><div class="xl">Orders Today</div></div>
    <div class="xr-cell"><div class="xv">${fmt(totalRev)}</div><div class="xl">Revenue Today</div></div>
    <div class="xr-cell"><div class="xv">${fmt(totalCard)}</div><div class="xl">Card</div></div>
    <div class="xr-cell"><div class="xv">${fmt(totalCash)}</div><div class="xl">Cash</div></div>
    <div class="xr-cell"><div class="xv">${fmt(totalApple)}</div><div class="xl">Apple Pay</div></div>
  `;

  document.getElementById('xreport-tbody').innerHTML = rows
    .filter(r => Number(r.orders||0) > 0)
    .map(r => `
      <tr>
        <td>${String(r.hour_of_day).padStart(2,'0')}:00</td>
        <td>${r.orders}</td>
        <td>${fmt(r.revenue)}</td>
        <td>${fmt(r.card_total)}</td>
        <td>${fmt(r.cash_total)}</td>
        <td>${fmt(r.applepay_total)}</td>
      </tr>`).join('') || '<tr><td colspan="6" class="muted" style="padding:20px;">No orders today yet.</td></tr>';
}
window.loadXReport = loadXReport;

// ── Best of Worst ─────────────────────────────────────────────────────────────
async function loadBestOfWorst() {
  const res  = await fetch('/api/analytics/best-of-worst');
  const data = res.ok ? await res.json() : { rows:[] };
  document.getElementById('bow-tbody').innerHTML = (data.rows||[]).map(r => `
    <tr>
      <td>${r.week_start||'—'}</td>
      <td>${r.worst_revenue_day||'—'}</td>
      <td>${fmt(r.worst_day_revenue)}</td>
      <td>${r.best_items_day||'—'}</td>
      <td>${fmtN(r.best_day_items_sold)}</td>
    </tr>`).join('') || '<tr><td colspan="5" class="muted" style="padding:20px;">No data yet.</td></tr>';
}

// ── Load user greeting ────────────────────────────────────────────────────────
async function loadUser() {
  const res  = await fetch('/api/me');
  const data = res.ok ? await res.json() : {};
  if (data.authenticated) {
    const el = document.getElementById('mgr-user-name');
    if (el) el.textContent = `${data.user.firstName || data.user.displayName} · Manager`;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadUser();
loadOverview();
