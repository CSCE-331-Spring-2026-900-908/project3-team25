const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const dataDir = path.join(__dirname, 'data');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function parseCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return [];
  const [headerLine, ...lines] = raw.split(/\r?\n/);
  const headers = headerLine.split(',');
  return lines.map((line) => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((header, index) => {
      obj[header.trim()] = (values[index] || '').trim();
    });
    return obj;
  });
}

const menuItems = parseCsv(path.join(dataDir, 'product.csv'))
  .filter((item) => item.is_active === 'true' && item.category !== 'topping')
  .map((item) => ({
    id: Number(item.productid),
    name: item.name,
    category: item.category,
    price: Number(item.baseprice),
    popular: [2, 4, 9, 10, 14].includes(Number(item.productid)),
    description: {
      milk_tea: 'Creamy tea-based drink with optional toppings and sweetness customization.',
      tea: 'Refreshing brewed tea with a lighter flavor profile.',
      fruit_tea: 'Fruity green tea served cold with vibrant flavors.',
      coffee: 'Coffee-forward milk tea blend for stronger energy and flavor.'
    }[item.category] || 'Bubble tea menu item.'
  }));

const inventory = parseCsv(path.join(dataDir, 'inventory.csv')).map((item) => ({
  id: Number(item.inventoryid),
  itemName: item.itemname,
  unit: item.unit,
  quantityOnHand: Number(item.quantityonhand),
  reorderThreshold: Number(item.reorderthreshold),
  unitCost: Number(item.unitcost),
  vendor: item.vendor,
  status: Number(item.quantityonhand) <= Number(item.reorderthreshold) ? 'low' : 'ok'
}));

const lowStock = [...inventory]
  .sort((a, b) => (a.quantityOnHand / a.reorderThreshold) - (b.quantityOnHand / b.reorderThreshold))
  .slice(0, 6)
  .map((item) => ({ ...item, status: item.quantityOnHand <= item.reorderThreshold ? 'low' : 'ok' }));

function categoryBreakdown() {
  const counts = {};
  for (const item of menuItems) counts[item.category] = (counts[item.category] || 0) + 1;
  return counts;
}

function ruleBasedAssistant(message) {
  const text = (message || '').toLowerCase();
  if (!text.trim()) return 'Ask me about drinks, toppings, sweetness, allergens, or how to use this kiosk.';
  if (text.includes('popular') || text.includes('best')) return 'Our most popular items right now are Brown Sugar Milk Tea, Matcha Milk Tea, Strawberry Green Tea, and Mango Green Tea.';
  if (text.includes('sweet') || text.includes('sugar')) return 'Customers can choose 0%, 25%, 50%, 75%, or 100% sweetness. Fruit teas usually work well at 50% or 75% sweetness.';
  if (text.includes('topping') || text.includes('boba')) return 'The main add-on supported in this starter build is extra boba. You can extend the menu data later for pudding, jelly, or foam toppings.';
  if (text.includes('milk') || text.includes('dairy')) return 'Most milk teas contain dairy in the base recipe. Tea and fruit tea options are the easiest starting point for customers avoiding dairy.';
  if (text.includes('translate') || text.includes('language')) return 'Use the translation widget on the page to translate short menu phrases for kiosk support.';
  if (text.includes('weather')) return 'The weather widget can be used for seasonal drink suggestions, such as recommending fruit teas on warmer days.';
  if (text.includes('manager')) return 'The manager dashboard includes inventory status, menu mix, and quick daily insight cards in this starter version.';
  return 'I can help with menu suggestions, sweetness levels, popular drinks, toppings, dietary hints, and basic kiosk guidance.';
}

app.get('/api/menu', (_req, res) => res.json({ items: menuItems, categories: categoryBreakdown() }));
app.get('/api/inventory', (_req, res) => res.json({ items: inventory, lowStock }));
app.get('/api/dashboard', (_req, res) => {
  const avgPrice = menuItems.length
    ? menuItems.reduce((sum, item) => sum + item.price, 0) / menuItems.length
    : 0;

  res.json({
    metrics: {
      activeMenuItems: menuItems.length,
      inventoryItems: inventory.length,
      lowStockItems: lowStock.length,
      averageMenuPrice: Number(avgPrice.toFixed(2))
    },
    lowStock,
    categories: categoryBreakdown(),
    announcements: [
      'Portal page is the centralized launch point for all interfaces.',
      'Cashier and customer pages use touch-friendly layouts.',
      'Manager view is back-office focused for keyboard-and-mouse usage.'
    ]
  });
});

app.post('/api/assistant', async (req, res) => {
  const { message } = req.body || {};
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    return res.json({ source: 'local-fallback', reply: ruleBasedAssistant(message) });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a concise bubble tea kiosk assistant. Help users with ordering, menu choices, customization, allergens, and store guidance.'
          },
          {
            role: 'user',
            content: String(message || '')
          }
        ],
        temperature: 0.5,
        max_tokens: 180
      })
    });

    if (!response.ok) throw new Error(`OpenAI request failed with ${response.status}`);

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || ruleBasedAssistant(message);
    res.json({ source: 'openai', reply });
  } catch (error) {
    res.json({
      source: 'local-fallback',
      reply: ruleBasedAssistant(message),
      error: error.message
    });
  }
});

app.get('/api/weather', async (req, res) => {
  const city = String(req.query.city || 'College Station').trim();

  try {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
    const geoData = await geoRes.json();
    const place = geoData.results?.[0];

    if (!place) {
      return res.status(404).json({ error: 'Location not found.' });
    }

    const forecastRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code&timezone=auto`);
    const forecastData = await forecastRes.json();

    res.json({
      city: `${place.name}${place.admin1 ? ', ' + place.admin1 : ''}`,
      temperature: forecastData.current?.temperature_2m,
      weatherCode: forecastData.current?.weather_code,
      recommendation:
        (forecastData.current?.temperature_2m ?? 0) >= 80
          ? 'Warm weather today. Suggest fruit teas and iced drinks.'
          : 'Cooler weather today. Suggest milk teas and warmer flavors.'
    });
  } catch (error) {
    res.status(500).json({ error: 'Weather service unavailable.', details: error.message });
  }
});

app.get('/api/translate', async (req, res) => {
  const text = String(req.query.text || '').trim();
  const target = String(req.query.target || 'es').trim();

  if (!text) {
    return res.status(400).json({ error: 'Text is required.' });
  }

  try {
    const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${encodeURIComponent(target)}`);
    const data = await response.json();
    const translatedText = data.responseData?.translatedText;

    if (!translatedText) {
      return res.status(502).json({ error: 'Translation failed.' });
    }

    res.json({ translatedText, target });
  } catch (error) {
    res.status(500).json({ error: 'Translation service unavailable.', details: error.message });
  }
});

app.post('/api/auth/mock-login', (req, res) => {
  const { email, role } = req.body || {};
  const safeRole = ['manager', 'cashier', 'customer'].includes(role) ? role : 'customer';
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const allowed =
    !normalizedEmail ||
    normalizedEmail === 'reveille.bubbletea@gmail.com' ||
    normalizedEmail.endsWith('@tamu.edu');

  if (!allowed) {
    return res.status(403).json({
      ok: false,
      message: 'Starter build only accepts the required project email or a TAMU address for demo login.'
    });
  }

  res.json({
    ok: true,
    role: safeRole,
    email: normalizedEmail || 'guest@demo.local',
    note: 'This is a starter mock-auth flow. Replace with Google OAuth before final submission.'
  });
});

app.get('/api/auth/config', (_req, res) =>
  res.json({
    googleClientConfigured: Boolean(process.env.GOOGLE_CLIENT_ID),
    requiredEmail: 'reveille.bubbletea@gmail.com'
  })
);

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Project 3 Team 25 app running on port ${PORT}`);
});