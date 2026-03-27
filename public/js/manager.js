async function loadDashboard() {
  const res = await fetch('/api/dashboard');
  const data = await res.json();
  document.getElementById('metric-menu').textContent = data.metrics.activeMenuItems;
  document.getElementById('metric-inventory').textContent = data.metrics.inventoryItems;
  document.getElementById('metric-low').textContent = data.metrics.lowStockItems;
  document.getElementById('metric-price').textContent = `$${data.metrics.averageMenuPrice.toFixed(2)}`;

  document.getElementById('low-stock-body').innerHTML = data.lowStock.map(item => `
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
}
loadDashboard();
