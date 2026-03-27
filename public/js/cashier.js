const cart = [];

function renderCart() {
  const list = document.getElementById('cart-list');
  if (!cart.length) {
    list.innerHTML = '<li>No items added yet.</li>';
    document.getElementById('cart-total').textContent = '$0.00';
    return;
  }
  list.innerHTML = cart.map((item, index) => `<li>${item.name} - $${item.price.toFixed(2)} <button class="btn ghost" style="min-height:34px;padding:6px 10px;float:right;" onclick="removeItem(${index})">Remove</button></li>`).join('');
  const total = cart.reduce((sum, item) => sum + item.price, 0);
  document.getElementById('cart-total').textContent = `$${total.toFixed(2)}`;
}
function removeItem(index) { cart.splice(index, 1); renderCart(); }

async function loadMenu() {
  const res = await fetch('/api/menu');
  const data = await res.json();
  document.getElementById('cashier-menu').innerHTML = data.items.map(item => `
    <article class="menu-item">
      <span class="badge">${item.category.replace('_', ' ')}</span>
      <h3>${item.name}</h3>
      <p>${item.description}</p>
      <div class="price">$${item.price.toFixed(2)}</div>
      <button class="btn full" onclick='addItem(${JSON.stringify({ name: item.name, price: item.price })})'>Add to order</button>
    </article>
  `).join('');
}
function addItem(item) { cart.push(item); renderCart(); }

async function translateText() {
  const text = document.getElementById('translate-text').value;
  const target = document.getElementById('translate-target').value;
  const res = await fetch(`/api/translate?text=${encodeURIComponent(text)}&target=${encodeURIComponent(target)}`);
  const data = await res.json();
  document.getElementById('translate-result').textContent = data.translatedText || data.error || 'Translation unavailable.';
}

async function askAssistant() {
  const message = document.getElementById('assistant-input').value;
  const res = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
  const data = await res.json();
  document.getElementById('assistant-result').textContent = data.reply;
}

async function loginDemo() {
  const res = await fetch('/api/auth/mock-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'reveille.bubbletea@gmail.com', role: 'cashier' }) });
  const data = await res.json();
  alert(data.note || 'Logged in.');
}

document.getElementById('translate-btn').addEventListener('click', translateText);
document.getElementById('assistant-btn').addEventListener('click', askAssistant);
document.getElementById('cashier-login-btn').addEventListener('click', loginDemo);
document.getElementById('checkout-btn').addEventListener('click', () => { alert(cart.length ? 'Order completed in starter demo.' : 'Add at least one item first.'); cart.length = 0; renderCart(); });

loadMenu();
renderCart();
window.addItem = addItem;
window.removeItem = removeItem;
