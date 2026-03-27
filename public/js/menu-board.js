async function loadMenuBoard() {
  const res = await fetch('/api/menu');
  const data = await res.json();
  const grouped = {};

  data.items.forEach(item => {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  });

  const columns = document.getElementById('menu-board-columns');
  columns.innerHTML = Object.entries(grouped).map(([category, items]) => `
    <article class="board-panel">
      <h3>${category.replace('_', ' ')}</h3>
      <ul>
        ${items.map(item => `
          <li>
            <span>${item.name}</span>
            <strong>$${item.price.toFixed(2)}</strong>
          </li>
        `).join('')}
      </ul>
    </article>
  `).join('');
}

loadMenuBoard();