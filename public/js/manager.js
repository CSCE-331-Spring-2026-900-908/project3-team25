function announceManager(message) {
  if (window.announceAccessibility) window.announceAccessibility(message);
}

async function loadDashboard() {
  const response = await fetch('/api/dashboard');
  const data = await response.json();
  document.getElementById('metric-grid').innerHTML = `
    <article class="metric"><div class="value">${data.metrics.activeMenuItems}</div><small>active menu items</small></article>
    <article class="metric"><div class="value">${data.metrics.inventoryItems}</div><small>inventory ingredients</small></article>
    <article class="metric"><div class="value">${data.metrics.lowStockItems}</div><small>low stock alerts</small></article>
    <article class="metric"><div class="value">$${data.metrics.totalRevenue}</div><small>total revenue</small></article>
  `;
  document.getElementById('inventory-table-body').innerHTML = data.lowStock.map(item => `
    <tr>
      <td>${item.itemName}</td>
      <td>${item.quantityOnHand}</td>
      <td>${item.reorderThreshold}</td>
      <td><span class="status-${item.status}">${item.status === 'low' ? 'Low stock' : 'OK'}</span></td>
    </tr>
  `).join('');
  document.getElementById('announcements').innerHTML = data.announcements.map(text => `<li>${text}</li>`).join('');
  document.getElementById('category-grid').innerHTML = Object.entries(data.categories).map(([key, value]) => `
    <article class="metric"><h3>${key.replace('_', ' ')}</h3><div class="value">${value}</div><small>items in category</small></article>
  `).join('');
  announceManager('Manager dashboard loaded.');
  const recentRes = await fetch('/api/orders/recent');
  const recent = await recentRes.json();
  document.getElementById('recent-orders-body').innerHTML = (recent.items || []).map(item => `
    <tr>
      <td>${item.transactionid || item.transactionId}</td>
      <td>${item.cashierid || item.cashierId}</td>
      <td>$${Number(item.totalamount || item.totalAmount || 0).toFixed(2)}</td>
      <td>${item.status}</td>
    </tr>
  `).join('') || '<tr><td colspan="4">No recent orders.</td></tr>';
}
loadDashboard();
