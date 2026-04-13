// ── State ─────────────────────────────────────────────────────────────────────
let allMenuItems    = [];
let allInventory    = [];
let allEmployees    = [];
let allManagers     = [];
let catChartInst    = null;
let payChartInst    = null;
let hourlyChartInst = null;
let weeklyChartInst = null;

// ── Distinct colors per category ──────────────────────────────────────────────
const CAT_COLORS = {
  coffee:    '#6f4e37',   // warm brown
  fruit_tea: '#e85d4a',   // vivid red-orange
  milk_tea:  '#c9a96e',   // golden milk
  seasonal:  '#4caf82',   // teal green
  tea:       '#7eb3c9',   // soft blue
  topping:   '#b06ab3',   // purple
  other:     '#aaa'
};
function catColor(key) { return CAT_COLORS[key] || CAT_COLORS.other; }

// ── Tab routing ───────────────────────────────────────────────────────────────
document.querySelectorAll('.mgr-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mgr-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.mgr-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const panel = document.getElementById('tab-' + btn.dataset.tab);
    if (panel) panel.classList.add('active');
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
function initials(first, last) { return ((first||'?')[0]+(last||'?')[0]).toUpperCase(); }
function fmtDate(d) {
  if (!d) return '—';
  const s = d.toString().slice(0,10);
  return s;
}

// ── Overview / Stats ──────────────────────────────────────────────────────────
async function loadOverview() {
  try {
    const [dashRes, recentRes, payRes] = await Promise.all([
      fetch('/api/dashboard'),
      fetch('/api/orders/recent?limit=50'),
      fetch('/api/analytics/payment-split')
    ]);
    const dash   = await dashRes.json();
    const recent = await recentRes.json();
    const pay    = payRes.ok ? await payRes.json() : { splits:[] };

    // Stats
    document.getElementById('s-items').textContent  = dash.metrics?.activeMenuItems ?? '--';
    document.getElementById('s-inv').textContent    = dash.metrics?.inventoryItems  ?? '--';
    document.getElementById('s-low').textContent    = dash.metrics?.lowStockItems   ?? '--';
    document.getElementById('s-rev').textContent    = fmt(dash.metrics?.totalRevenue);
    document.getElementById('s-orders').textContent = fmtN(dash.metrics?.totalOrders);

    // Low stock table
    document.getElementById('inv-tbody').innerHTML = (dash.lowStock || []).map(i => `
      <tr>
        <td>${i.itemName}</td>
        <td style="${i.quantityOnHand < 0 ? 'color:#dc2626;font-weight:700;' : ''}">${i.quantityOnHand}</td>
        <td>${i.reorderThreshold}</td>
        <td><span class="${i.status==='low'?'badge-low':'badge-ok'}">${i.status==='low'?'Low stock':'OK'}</span></td>
      </tr>`).join('') || '<tr><td colspan="4" class="muted">No data.</td></tr>';

    // Recent orders — scrollable, shows cashier name, 50 rows
    const orderRows = (recent.items || []);
    document.getElementById('orders-tbody').innerHTML = orderRows.map(i => `
      <tr>
        <td>#${i.transactionid || i.transactionId}</td>
        <td>${i.cashier_name || i.cashierId || i.cashierid || '—'}</td>
        <td><strong>${fmt(i.totalamount || i.totalAmount)}</strong></td>
        <td style="text-transform:capitalize;">${i.paymentmethod || i.paymentMethod || '—'}</td>
        <td>${fmtDate(i.transactiontime || i.transactionTime)}</td>
        <td><span class="badge-ok">${i.status}</span></td>
      </tr>`).join('') || '<tr><td colspan="6" class="muted">No orders yet.</td></tr>';

    // Category donut — distinct colors
    const cats  = dash.categories || {};
    const cKeys = Object.keys(cats);
    if (catChartInst) catChartInst.destroy();
    catChartInst = new Chart(document.getElementById('cat-chart'), {
      type: 'doughnut',
      data: {
        labels: cKeys.map(k => k.replace(/_/g,' ')),
        datasets: [{
          data: cKeys.map(k => cats[k]),
          backgroundColor: cKeys.map(k => catColor(k)),
          borderWidth: 3,
          borderColor: '#fffaf7'
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position:'right', labels:{ font:{size:12}, color:'#3d251e', padding:14,
          generateLabels: chart => {
            const ds = chart.data.datasets[0];
            return chart.data.labels.map((label,i) => ({
              text: `${label}  (${ds.data[i]})`,
              fillStyle: ds.backgroundColor[i],
              strokeStyle: '#fffaf7', lineWidth: 2, index: i
            }));
          }
        }}}
      }
    });

    // Payment split donut
    const splits = pay.splits || [];
    if (payChartInst) payChartInst.destroy();
    const PAY_COLORS = { card:'#9e3b35', applepay:'#4caf82', cash:'#c9a96e' };
    if (splits.length) {
      payChartInst = new Chart(document.getElementById('pay-chart'), {
        type: 'doughnut',
        data: {
          labels: splits.map(s => s.method),
          datasets: [{
            data: splits.map(s => Number(s.total).toFixed(2)),
            backgroundColor: splits.map(s => PAY_COLORS[s.method] || '#aaa'),
            borderWidth: 3, borderColor: '#fffaf7'
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position:'right', labels:{ font:{size:12}, color:'#3d251e', padding:14,
            generateLabels: chart => {
              const ds = chart.data.datasets[0];
              return chart.data.labels.map((label,i) => ({
                text: `${label}  ($${ds.data[i]})`,
                fillStyle: ds.backgroundColor[i],
                strokeStyle: '#fffaf7', lineWidth:2, index:i
              }));
            }
          }}}
        }
      });
    } else {
      document.getElementById('pay-chart').parentElement.innerHTML =
        '<p class="muted" style="text-align:center;padding:40px 0;">No payment data yet.</p>';
    }

  } catch(e) { console.error('Overview load failed:', e); }
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

    // Hourly bar chart
    const hrs = hourly.rows || [];
    if (hourlyChartInst) hourlyChartInst.destroy();
    hourlyChartInst = new Chart(document.getElementById('hourly-chart'), {
      type: 'bar',
      data: {
        labels: hrs.map(r => `${String(r.hour_of_day).padStart(2,'0')}:00`),
        datasets: [{
          label: 'Revenue ($)',
          data: hrs.map(r => Number(r.revenue||0).toFixed(2)),
          backgroundColor: hrs.map((_,i) => `hsl(${10 + i*3}, 55%, ${45 + (i%3)*5}%)`),
          borderRadius: 8
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend:{ display:false } },
        scales: { y:{ beginAtZero:true, ticks:{ callback: v => '$'+v } } }
      }
    });

    // Weekly line chart
    const wks = (weekly.rows || []).slice(-12);
    if (weeklyChartInst) weeklyChartInst.destroy();
    weeklyChartInst = new Chart(document.getElementById('weekly-chart'), {
      type: 'line',
      data: {
        labels: wks.map(r => (r.week_start||'').toString().slice(0,10)),
        datasets: [{
          label: 'Weekly Revenue ($)',
          data: wks.map(r => Number(r.revenue||0).toFixed(2)),
          borderColor: '#9e3b35',
          backgroundColor: 'rgba(158,59,53,0.08)',
          fill: true, tension: 0.4,
          pointBackgroundColor: '#9e3b35', pointRadius: 5
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend:{ display:false } },
        scales: { y:{ beginAtZero:true, ticks:{ callback: v => '$'+v } } }
      }
    });

    // Peak days table
    document.getElementById('peak-tbody').innerHTML = (peak.rows||[]).map((r,i) => `
      <tr>
        <td>${['🥇','🥈','🥉'][i]||''} ${r.day||'—'}</td>
        <td><strong>${fmt(r.revenue)}</strong></td>
        <td>${fmtN(r.orders)}</td>
      </tr>`).join('') || '<tr><td colspan="3" class="muted">No data yet.</td></tr>';
  } catch(e) { console.error('Sales charts failed:', e); }
}

// ── Menu Editor ───────────────────────────────────────────────────────────────
async function loadMenuEditor() {
  const res  = await fetch('/api/menu-all');
  const data = res.ok ? await res.json() : { items:[] };
  allMenuItems = data.items || [];
  renderMenuTable();
}

function renderMenuTable() {
  const q   = (document.getElementById('menu-search')?.value||'').toLowerCase();
  const cat = document.getElementById('menu-filter-cat')?.value||'';
  const rows = allMenuItems.filter(i =>
    (!q   || i.name.toLowerCase().includes(q)) &&
    (!cat || i.category===cat)
  );
  document.getElementById('menu-tbody').innerHTML = rows.map(item => {
    const active = item.is_active ?? item.isActive ?? true;
    return `
      <tr style="${active?'':'opacity:0.5;'}">
        <td><strong>${item.name}</strong></td>
        <td><span style="padding:3px 8px;border-radius:6px;font-size:0.78rem;font-weight:700;background:${catColor(item.category)}22;color:${catColor(item.category)};">
          ${(item.category||'').replace(/_/g,' ')}
        </span></td>
        <td>${fmt(item.price||item.baseprice)}</td>
        <td>
          <button class="toggle-switch ${active?'on':''}"
                  onclick="toggleMenuActive(${item.id||item.productid}, this)"
                  title="${active?'Disable':'Enable'} on kiosk"></button>
        </td>
        <td>
          <button class="action-btn" onclick="openEditMenuModal(${item.id||item.productid})">Edit</button>
          <button class="action-btn danger" onclick="deleteMenuItem(${item.id||item.productid},'${item.name.replace(/'/g,"\\'")}')">Remove</button>
        </td>
      </tr>`;
  }).join('') || '<tr><td colspan="5" class="muted" style="padding:20px;">No items found.</td></tr>';
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
  const item = allMenuItems.find(i => (i.id||i.productid)===id);
  if (!item) return;
  document.getElementById('menu-modal-title').textContent = 'Edit Menu Item';
  document.getElementById('menu-modal-id').value  = id;
  document.getElementById('menu-name').value      = item.name;
  document.getElementById('menu-category').value  = item.category;
  document.getElementById('menu-price').value     = item.price||item.baseprice;
  document.getElementById('menu-modal').classList.add('open');
}
function closeMenuModal() { document.getElementById('menu-modal').classList.remove('open'); }

async function saveMenuItem() {
  const id    = document.getElementById('menu-modal-id').value;
  const name  = document.getElementById('menu-name').value.trim();
  const cat   = document.getElementById('menu-category').value;
  const price = parseFloat(document.getElementById('menu-price').value);
  if (!name||isNaN(price)) { alert('Please fill in all fields.'); return; }
  const res = await fetch(id ? `/api/menu-item/${id}` : '/api/menu-item', {
    method: id ? 'PUT' : 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ name, category:cat, basePrice:price })
  });
  if (res.ok) { closeMenuModal(); loadMenuEditor(); }
  else { const d=await res.json(); alert('Error: '+(d.error||'Save failed.')); }
}

async function toggleMenuActive(id, btn) {
  const isOn = btn.classList.contains('on');
  const res  = await fetch(`/api/menu-item/${id}/toggle`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ active:!isOn }) });
  if (res.ok) { btn.classList.toggle('on'); btn.closest('tr').style.opacity = isOn?'0.5':'1'; }
  else alert('Could not update item.');
}
async function deleteMenuItem(id, name) {
  if (!confirm(`Remove "${name}" from the menu?`)) return;
  const res = await fetch(`/api/menu-item/${id}`, { method:'DELETE' });
  if (res.ok) loadMenuEditor(); else alert('Could not delete item.');
}

window.openAddMenuModal=openAddMenuModal; window.openEditMenuModal=openEditMenuModal;
window.closeMenuModal=closeMenuModal; window.saveMenuItem=saveMenuItem;
window.toggleMenuActive=toggleMenuActive; window.deleteMenuItem=deleteMenuItem;
window.filterMenuTable=filterMenuTable;

// ── Full Inventory ────────────────────────────────────────────────────────────
async function loadFullInventory() {
  const res  = await fetch('/api/inventory');
  const data = res.ok ? await res.json() : { items:[] };
  allInventory = data.items || [];
  renderInvTable();
}
function renderInvTable() {
  const filter = document.getElementById('inv-filter')?.value||'';
  const rows   = allInventory.filter(i => !filter||i.status===filter);
  document.getElementById('full-inv-tbody').innerHTML = rows.map(i => `
    <tr>
      <td><strong>${i.itemName}</strong></td>
      <td>${i.unit}</td>
      <td style="${i.quantityOnHand<0?'color:#dc2626;font-weight:700;':i.status==='low'?'color:#f97316;font-weight:600;':''}">${i.quantityOnHand}</td>
      <td>${i.reorderThreshold}</td>
      <td>$${Number(i.unitCost||0).toFixed(4)}</td>
      <td>${i.vendor||'—'}</td>
      <td><span class="${i.status==='low'?'badge-low':'badge-ok'}">${i.status==='low'?'⚠ Low':'OK'}</span></td>
    </tr>`).join('') || '<tr><td colspan="7" class="muted" style="padding:20px;">No items.</td></tr>';
}
window.filterInvTable = renderInvTable;

// ── Employees ─────────────────────────────────────────────────────────────────
async function loadEmployees() {
  const [empRes, mgrRes] = await Promise.all([fetch('/api/employees'), fetch('/api/managers')]);
  allEmployees = empRes.ok ? (await empRes.json()).cashiers||[] : [];
  allManagers  = mgrRes.ok ? (await mgrRes.json()).managers||[]  : [];
  renderEmployeeTable();
  renderManagerTable();
}

function renderEmployeeTable() {
  document.getElementById('emp-tbody').innerHTML = allEmployees.map(e => {
    const active   = e.is_active??e.isActive??true;
    const first    = e.firstname||e.firstName||'';
    const last     = e.lastname||e.lastName||'';
    const hours    = Number(e.hoursworked||e.hoursWorked||0).toFixed(1);
    const hireDate = fmtDate(e.hiredate||e.hireDate);
    const id       = e.cashierid||e.cashierId||e.id;
    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="emp-avatar">${initials(first,last)}</div>
            <div>
              <div style="font-weight:600;">${first} ${last}</div>
              <div style="font-size:0.76rem;color:var(--muted);">PIN: ${e.pin||'—'}</div>
            </div>
          </div>
        </td>
        <td>${hireDate}</td>
        <td>${hours} hrs</td>
        <td><span class="${active?'badge-ok':'badge-low'}">${active?'Active':'Inactive'}</span></td>
        <td>
          <button class="action-btn" onclick="openEditEmpModal(${id})">Edit</button>
          <button class="action-btn danger" onclick="toggleEmpActive(${id},${active})">
            ${active?'Deactivate':'Reactivate'}
          </button>
        </td>
      </tr>`;
  }).join('') || '<tr><td colspan="5" class="muted" style="padding:20px;">No cashiers found.</td></tr>';
}

function renderManagerTable() {
  document.getElementById('mgr-tbody').innerHTML = allManagers.map(m => {
    const first  = m.firstname||m.firstName||'';
    const last   = m.lastname||m.lastName||'';
    const active = m.is_active??m.isActive??true;
    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="emp-avatar" style="background:#4f46e5;">${initials(first,last)}</div>
            <strong>${first} ${last}</strong>
          </div>
        </td>
        <td>${fmtDate(m.hiredate||m.hireDate)}</td>
        <td><span class="${active?'badge-ok':'badge-low'}">${active?'Active':'Inactive'}</span></td>
      </tr>`;
  }).join('') || '<tr><td colspan="3" class="muted">No managers found.</td></tr>';
}

function openAddEmpModal() {
  document.getElementById('emp-modal-title').textContent = 'Add Cashier';
  ['emp-modal-id','emp-first','emp-last','emp-pin'].forEach(id => document.getElementById(id).value='');
  document.getElementById('emp-hire').value = new Date().toISOString().slice(0,10);
  document.getElementById('emp-modal').classList.add('open');
}
function openEditEmpModal(id) {
  const e = allEmployees.find(x=>(x.cashierid||x.cashierId||x.id)===id);
  if (!e) return;
  document.getElementById('emp-modal-title').textContent = 'Edit Cashier';
  document.getElementById('emp-modal-id').value  = id;
  document.getElementById('emp-first').value     = e.firstname||e.firstName||'';
  document.getElementById('emp-last').value      = e.lastname||e.lastName||'';
  document.getElementById('emp-hire').value      = fmtDate(e.hiredate||e.hireDate);
  document.getElementById('emp-pin').value       = e.pin||'';
  document.getElementById('emp-modal').classList.add('open');
}
function closeEmpModal() { document.getElementById('emp-modal').classList.remove('open'); }

async function saveEmployee() {
  const id        = document.getElementById('emp-modal-id').value;
  const firstName = document.getElementById('emp-first').value.trim();
  const lastName  = document.getElementById('emp-last').value.trim();
  const hireDate  = document.getElementById('emp-hire').value;
  const pin       = document.getElementById('emp-pin').value.trim();
  if (!firstName||!lastName||!hireDate) { alert('Please fill in all required fields.'); return; }
  const res = await fetch(id ? `/api/employees/${id}` : '/api/employees', {
    method: id?'PUT':'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ firstName, lastName, hireDate, pin })
  });
  if (res.ok) { closeEmpModal(); loadEmployees(); }
  else { const d=await res.json(); alert('Error: '+(d.error||'Save failed.')); }
}
async function toggleEmpActive(id, currentlyActive) {
  const res = await fetch(`/api/employees/${id}/toggle`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ active:!currentlyActive }) });
  if (res.ok) loadEmployees(); else alert('Could not update employee.');
}

window.openAddEmpModal=openAddEmpModal; window.openEditEmpModal=openEditEmpModal;
window.closeEmpModal=closeEmpModal; window.saveEmployee=saveEmployee;
window.toggleEmpActive=toggleEmpActive;

// ── X-Report ──────────────────────────────────────────────────────────────────
async function loadXReport() {
  const res  = await fetch('/api/analytics/xreport');
  const data = res.ok ? await res.json() : { rows:[] };
  const rows = data.rows||[];

  const totalOrders = rows.reduce((s,r)=>s+Number(r.orders||0),0);
  const totalRev    = rows.reduce((s,r)=>s+Number(r.revenue||0),0);
  const totalCard   = rows.reduce((s,r)=>s+Number(r.card_total||0),0);
  const totalCash   = rows.reduce((s,r)=>s+Number(r.cash_total||0),0);
  const totalApple  = rows.reduce((s,r)=>s+Number(r.applepay_total||0),0);

  document.getElementById('xreport-summary').innerHTML = `
    <div class="xr-cell"><div class="xv">${totalOrders}</div><div class="xl">Orders Today</div></div>
    <div class="xr-cell"><div class="xv">${fmt(totalRev)}</div><div class="xl">Revenue Today</div></div>
    <div class="xr-cell"><div class="xv">${fmt(totalCard)}</div><div class="xl">Card</div></div>
    <div class="xr-cell"><div class="xv">${fmt(totalCash)}</div><div class="xl">Cash</div></div>
    <div class="xr-cell"><div class="xv">${fmt(totalApple)}</div><div class="xl">Apple Pay</div></div>`;

  const activeRows = rows.filter(r=>Number(r.orders||0)>0);
  document.getElementById('xreport-tbody').innerHTML = activeRows.map(r=>`
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
  document.getElementById('bow-tbody').innerHTML = (data.rows||[]).map(r=>`
    <tr>
      <td>${r.week_start||'—'}</td>
      <td>${r.worst_revenue_day||'—'}</td>
      <td>${fmt(r.worst_day_revenue)}</td>
      <td>${r.best_items_day||'—'}</td>
      <td>${fmtN(r.best_day_items_sold)}</td>
    </tr>`).join('') || '<tr><td colspan="5" class="muted" style="padding:20px;">No data yet.</td></tr>';
}

// ── Fix the recent orders table header (add Time column) ──────────────────────
function fixOrdersTableHeader() {
  const thead = document.querySelector('#tab-overview .mgr-card:nth-child(2) thead tr');
  if (thead && thead.children.length === 5) {
    const th = document.createElement('th');
    th.textContent = 'Time';
    thead.insertBefore(th, thead.children[4]);
  }
}

// ── User greeting ─────────────────────────────────────────────────────────────
async function loadUser() {
  const res  = await fetch('/api/me');
  const data = res.ok ? await res.json() : {};
  if (data.authenticated) {
    const el = document.getElementById('mgr-user-name');
    if (el) el.textContent = `${data.user.firstName||data.user.displayName} · Manager`;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadUser();
fixOrdersTableHeader();
loadOverview();
