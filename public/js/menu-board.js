async function loadBoard() {
  const res = await fetch('/api/menu');
  const data = await res.json();
  const featured = data.items.filter(item => item.popular).slice(0, 6);
  document.getElementById('board-menu').innerHTML = featured.map(item => `
    <article class="board-card">
      <div class="badge" style="background: rgba(255,255,255,0.18); color: white;">Featured Drink</div>
      <h2>${item.name}</h2>
      <p>${item.description}</p>
      <p style="font-size: 1.4rem; font-weight: 800;">$${item.price.toFixed(2)}</p>
    </article>
  `).join('');
}
loadBoard();
