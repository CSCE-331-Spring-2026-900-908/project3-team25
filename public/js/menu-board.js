function announceBoard(message) {
  if (window.announceAccessibility) window.announceAccessibility(message);
}

const CATEGORY_LABELS = {
  milk_tea:  'Milky Series',
  fruit_tea: 'Fruity Beverage',
  tea:       'Non Caffeinated',
  coffee:    'Fresh Brew',
  seasonal:  'Seasonal'
};

async function loadMenuBoard() {
  const columns = document.getElementById('menu-board-columns');
  try {
    const res = await fetch('/api/menu');
    const data = await res.json();

    const grouped = {};
    data.items.forEach(item => {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    });

    columns.innerHTML = Object.entries(grouped).map(([category, items]) => `
      <article class="board-panel">
        <h3>${CATEGORY_LABELS[category] || category.replace('_', ' ')}</h3>
        <ul>
          ${items.map(item => `
            <li>
              <span>${item.name}</span>
              <strong>$${Number(item.price).toFixed(2)}</strong>
            </li>
          `).join('')}
        </ul>
      </article>
    `).join('');
    announceBoard('Menu board loaded.');
  } catch (_) {
    columns.innerHTML = '<article class="board-panel"><p class="muted">Failed to load menu.</p></article>';
  }
}

loadMenuBoard();
