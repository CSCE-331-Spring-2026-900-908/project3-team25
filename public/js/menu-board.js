const CATEGORY_LABELS = {
  milk_tea:  'Milky Series',
  fruit_tea: 'Fruity Beverage',
  tea:       'Non Caffeinated',
  coffee:    'Fresh Brew',
  seasonal:  'Seasonal',
  topping:   'Topping'
};

const POPULAR_IDS = [2, 4, 9, 10, 14];

// ── Live clock ────────────────────────────────────────────────────────────────
function updateClock() {
  const now   = new Date();
  const time  = now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });
  const date  = now.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
  const timeEl = document.getElementById('clock-time');
  const dateEl = document.getElementById('clock-date');
  if (timeEl) timeEl.textContent = time;
  if (dateEl) dateEl.textContent = date;
}
updateClock();
setInterval(updateClock, 1000);

// ── Weather ───────────────────────────────────────────────────────────────────
async function loadBoardWeather() {
  const LAT = 30.6280, LON = -96.3344;
  function wLabel(code) {
    const m = {0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',
      51:'Light drizzle',61:'Light rain',63:'Moderate rain',65:'Heavy rain',
      80:'Rain showers',95:'Thunderstorm'};
    return m[Number(code)] || 'Mixed conditions';
  }
  function wTip(temp, code) {
    if ([61,63,65,80,95].includes(Number(code))) return 'Rainy outside — warm milk teas are a great pick';
    if (temp >= 90) return 'Very hot today — fruit teas and extra ice are flying';
    if (temp >= 80) return 'Warm day — iced fruit teas are perfect';
    if (temp >= 65) return 'Mild weather — milk teas and fruit teas both popular';
    if (temp >= 50) return 'Cool outside — rich milk teas hit the spot';
    return 'Cold today — warm up with a brown sugar milk tea';
  }
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,apparent_temperature,weather_code&temperature_unit=fahrenheit&timezone=America%2FChicago`;
    const data = await (await fetch(url)).json();
    const cur  = data.current || {};
    const temp = cur.temperature_2m != null ? Math.round(cur.temperature_2m) : null;
    const code = cur.weather_code ?? null;
    if (temp !== null) {
      document.getElementById('bw-temp').textContent  = `${temp}°F`;
      document.getElementById('bw-label').textContent = wLabel(code);
      document.getElementById('bw-tip').textContent   = wTip(temp, code);
    }
  } catch(_) {
    document.getElementById('bw-label').textContent = '';
    document.getElementById('bw-tip').textContent   = '';
  }
}
loadBoardWeather();

// ── Menu ──────────────────────────────────────────────────────────────────────
async function loadMenuBoard() {
  const columns = document.getElementById('menu-board-columns');
  try {
    const res  = await fetch('/api/menu');
    const data = await res.json();

    const grouped = {};
    (data.items || []).forEach(item => {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    });

    columns.innerHTML = Object.entries(grouped).map(([category, items]) => `
      <article class="board-panel">
        <h3>${CATEGORY_LABELS[category] || category.replace(/_/g,' ')}</h3>
        <ul>
          ${items.map(item => `
            <li>
              <span class="item-name">
                ${item.name}
                ${POPULAR_IDS.includes(item.id) ? '<span class="pop-tag">Popular</span>' : ''}
              </span>
              <span class="item-price">$${Number(item.price).toFixed(2)}</span>
            </li>`).join('')}
        </ul>
      </article>`).join('');

    // Update ticker with popular items
    const popularItems = (data.items || []).filter(i => POPULAR_IDS.includes(i.id));
    const ticker = document.getElementById('ticker-track');
    if (ticker && popularItems.length) {
      const extras = popularItems.map(i => `<span>Try our ${i.name} for just $${Number(i.price).toFixed(2)}</span>`).join('');
      ticker.innerHTML += extras + ticker.innerHTML; // duplicate for seamless loop
    }
  } catch (_) {
    columns.innerHTML = '<article class="board-panel"><p class="muted">Failed to load menu.</p></article>';
  }
}

loadMenuBoard();
// Refresh menu every 5 minutes
setInterval(loadMenuBoard, 5 * 60 * 1000);
