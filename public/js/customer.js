async function loadMenu() {
  const res = await fetch('/api/menu');
  const data = await res.json();
  document.getElementById('customer-menu').innerHTML = data.items.map(item => `
    <article class="menu-item">
      ${item.popular ? '<span class="badge">Popular</span>' : `<span class="badge">${item.category.replace('_', ' ')}</span>`}
      <h3>${item.name}</h3>
      <p>${item.description}</p>
      <div class="price">$${item.price.toFixed(2)}</div>
    </article>
  `).join('');
}

async function loadWeather() {
  const city = document.getElementById('city-input').value;
  const res = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
  const data = await res.json();
  document.getElementById('weather-result').textContent = data.error ? data.error : `${data.city}: ${data.temperature}° with suggestion — ${data.recommendation}`;
}

async function askAssistant() {
  const message = document.getElementById('kiosk-assistant-input').value;
  const res = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
  const data = await res.json();
  document.getElementById('kiosk-assistant-result').textContent = data.reply;
}

async function translateText() {
  const text = document.getElementById('customer-translate-text').value;
  const target = document.getElementById('customer-translate-target').value;
  const res = await fetch(`/api/translate?text=${encodeURIComponent(text)}&target=${encodeURIComponent(target)}`);
  const data = await res.json();
  document.getElementById('customer-translate-result').textContent = data.translatedText || data.error || 'Translation unavailable.';
}

document.getElementById('weather-btn').addEventListener('click', loadWeather);
document.getElementById('kiosk-assistant-btn').addEventListener('click', askAssistant);
document.getElementById('customer-translate-btn').addEventListener('click', translateText);
loadMenu();
