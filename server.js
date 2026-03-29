require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { getPool, hasDbConfig } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;
const dataDir = path.join(__dirname, 'data');

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev_only_change_me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

const managerEmails = (process.env.MANAGER_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean);

function getUserRoleFromEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (managerEmails.includes(normalizedEmail)) {
    return 'manager';
  }

  if (normalizedEmail.endsWith('@tamu.edu')) {
    return 'cashier';
  }

  return 'customer';
}

function requireStaff(req, res, next) {
  if (
    req.isAuthenticated &&
    req.isAuthenticated() &&
    (req.user?.role === 'cashier' || req.user?.role === 'manager')
  ) {
    return next();
  }
  return res.redirect('/?unauthorized=1');
}

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

const googleCallbackUrl =
  process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback';

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: googleCallbackUrl
      },
      (_accessToken, _refreshToken, profile, done) => {
        const email = profile.emails?.[0]?.value || '';
        const user = {
          id: profile.id,
          displayName: profile.displayName || 'User',
          email,
          role: getUserRoleFromEmail(email)
        };
        done(null, user);
      }
    )
  );
}

function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.redirect('/?authRequired=1');
}

function requireManager(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated() && req.user?.role === 'manager') {
    return next();
  }
  return res.redirect('/?unauthorized=1');
}

function parseCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return [];
  const [headerLine, ...lines] = raw.split(/\r?\n/);
  const headers = headerLine.split(',').map((h) => h.trim());
  return lines.map((line) => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = (values[index] || '').trim();
    });
    return obj;
  });
}

const csvMenu = parseCsv(path.join(dataDir, 'product.csv'))
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

const csvInventory = parseCsv(path.join(dataDir, 'inventory.csv')).map((item) => ({
  id: Number(item.inventoryid),
  itemName: item.itemname,
  unit: item.unit,
  quantityOnHand: Number(item.quantityonhand),
  reorderThreshold: Number(item.reorderthreshold),
  unitCost: Number(item.unitcost),
  vendor: item.vendor,
  status: Number(item.quantityonhand) <= Number(item.reorderthreshold) ? 'low' : 'ok'
}));

let fallbackTransactions = [];
let fallbackTransactionItems = [];
let nextFallbackTransactionId = 100001;
let nextFallbackTransactionItemId = 500001;

function categoryBreakdown(items) {
  const counts = {};
  for (const item of items) counts[item.category] = (counts[item.category] || 0) + 1;
  return counts;
}

function lowStock(items) {
  return [...items]
    .sort((a, b) => (a.quantityOnHand / (a.reorderThreshold || 1)) - (b.quantityOnHand / (b.reorderThreshold || 1)))
    .slice(0, 6)
    .map((item) => ({ ...item, status: item.quantityOnHand <= item.reorderThreshold ? 'low' : 'ok' }));
}

function ruleBasedAssistant(message) {
  const text = (message || '').toLowerCase();
  if (!text.trim()) return 'Ask me about drinks, toppings, sweetness, allergens, or how to use this kiosk.';
  if (text.includes('popular') || text.includes('best')) return 'Our most popular items right now are Brown Sugar Milk Tea, Matcha Milk Tea, Strawberry Green Tea, and Mango Green Tea.';
  if (text.includes('sweet') || text.includes('sugar')) return 'Customers can choose 0%, 25%, 50%, 75%, or 100% sweetness. Fruit teas usually work well at 50% or 75% sweetness.';
  if (text.includes('topping') || text.includes('boba')) return 'The starter build supports extra boba. You can expand later to pudding, jelly, foam, or seasonal toppings.';
  if (text.includes('milk') || text.includes('dairy')) return 'Most milk teas contain dairy in the base recipe. Tea and fruit tea options are the easiest starting point for customers avoiding dairy.';
  if (text.includes('manager')) return 'The manager dashboard shows menu counts, sales metrics, and inventory alerts using either the database or CSV fallback.';
  return 'I can help with menu suggestions, sweetness levels, popular drinks, toppings, dietary hints, and kiosk guidance.';
}

async function queryDb(text, params = []) {
  const pool = getPool();
  if (!pool) throw new Error('Database configuration is missing.');
  return pool.query(text, params);
}

async function getMenuItems() {
  if (hasDbConfig()) {
    const result = await queryDb(`
      SELECT productid AS id, name, category, baseprice AS price, is_active
      FROM product
      WHERE is_active = true
      ORDER BY category, name
    `);
    return result.rows.map((item) => ({
      id: Number(item.id),
      name: item.name,
      category: item.category,
      price: Number(item.price),
      popular: [2, 4, 9, 10, 14].includes(Number(item.id)),
      description: {
        milk_tea: 'Creamy tea-based drink with optional toppings and sweetness customization.',
        tea: 'Refreshing brewed tea with a lighter flavor profile.',
        fruit_tea: 'Fruity green tea served cold with vibrant flavors.',
        coffee: 'Coffee-forward milk tea blend for stronger energy and flavor.'
      }[item.category] || 'Bubble tea menu item.'
    }));
  }
  return csvMenu;
}

async function getInventoryItems() {
  if (hasDbConfig()) {
    const result = await queryDb(`
      SELECT inventoryid AS id, itemname, unit, quantityonhand, reorderthreshold, unitcost, vendor
      FROM inventory
      ORDER BY itemname
    `);
    return result.rows.map((item) => ({
      id: Number(item.id),
      itemName: item.itemname,
      unit: item.unit,
      quantityOnHand: Number(item.quantityonhand),
      reorderThreshold: Number(item.reorderthreshold),
      unitCost: Number(item.unitcost),
      vendor: item.vendor,
      status: Number(item.quantityonhand) <= Number(item.reorderthreshold) ? 'low' : 'ok'
    }));
  }
  return csvInventory;
}

async function getDashboardData() {
  const menuItems = await getMenuItems();
  const inventoryItems = await getInventoryItems();
  let salesMetrics = {
    totalOrders: fallbackTransactions.length,
    totalRevenue: fallbackTransactions.reduce((sum, tx) => sum + Number(tx.totalAmount || 0), 0),
    completedOrders: fallbackTransactions.filter((tx) => tx.status === 'completed').length
  };

  if (hasDbConfig()) {
    const txStats = await queryDb(`
      SELECT COUNT(*)::int AS total_orders,
             COALESCE(SUM(totalamount), 0)::numeric AS total_revenue,
             COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_orders
      FROM transactions
    `);
    salesMetrics = {
      totalOrders: txStats.rows[0].total_orders,
      totalRevenue: Number(txStats.rows[0].total_revenue),
      completedOrders: txStats.rows[0].completed_orders
    };
  }

  const avgPrice = menuItems.length
    ? menuItems.reduce((sum, item) => sum + item.price, 0) / menuItems.length
    : 0;

  return {
    metrics: {
      activeMenuItems: menuItems.length,
      inventoryItems: inventoryItems.length,
      lowStockItems: lowStock(inventoryItems).length,
      averageMenuPrice: Number(avgPrice.toFixed(2)),
      totalOrders: salesMetrics.totalOrders,
      totalRevenue: Number(salesMetrics.totalRevenue.toFixed(2)),
      completedOrders: salesMetrics.completedOrders
    },
    lowStock: lowStock(inventoryItems),
    categories: categoryBreakdown(menuItems),
    announcements: [
      hasDbConfig()
        ? 'Database mode is active. Checkout can insert transactions into PostgreSQL.'
        : 'CSV fallback mode is active. Add DB environment variables to enable real PostgreSQL checkout.',
      'Portal page is the centralized launch point for all interfaces.',
      'Cashier and customer pages use separate layouts for the assignment requirements.'
    ]
  };
}

async function createCheckout({ items, paymentMethod = 'card', cashierId = 1 }) {
  const safeItems = Array.isArray(items) ? items : [];
  if (!safeItems.length) throw new Error('At least one item is required for checkout.');

  const menuItems = await getMenuItems();
  const menuMap = new Map(menuItems.map((item) => [Number(item.id), item]));
  const normalized = safeItems.map((item) => {
    const menu = menuMap.get(Number(item.id));
    if (!menu) throw new Error(`Menu item ${item.id} was not found.`);
    const quantity = Math.max(1, Number(item.quantity || 1));
    return {
      productId: menu.id,
      name: menu.name,
      unitPrice: Number(item.unitPrice || menu.price),
      quantity,
      lineTotal: Number((Number(item.unitPrice || menu.price) * quantity).toFixed(2)),
      selections: item.selections || {}
    };
  });

  const totalAmount = normalized.reduce((sum, item) => sum + item.lineTotal, 0);

  if (hasDbConfig()) {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const txResult = await client.query(
        `INSERT INTO transactions (cashierid, transactiontime, totalamount, paymentmethod, status)
         VALUES ($1, NOW(), $2, $3, 'completed')
         RETURNING transactionid, transactiontime, totalamount, paymentmethod, status`,
        [cashierId, totalAmount, String(paymentMethod).toLowerCase()]
      );
      const txRow = txResult.rows[0];

      for (const item of normalized) {
        await client.query(
          `INSERT INTO transactionitem (transactionid, productid, quantity, unitprice)
           VALUES ($1, $2, $3, $4)`,
          [txRow.transactionid, item.productId, item.quantity, item.unitPrice]
        );
      }

      await client.query('COMMIT');
      return {
        source: 'database',
        transactionId: txRow.transactionid,
        transactionTime: txRow.transactiontime,
        totalAmount: Number(txRow.totalamount),
        paymentMethod: txRow.paymentmethod,
        status: txRow.status,
        items: normalized
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  const transactionId = nextFallbackTransactionId++;
  const transaction = {
    transactionId,
    cashierId,
    transactionTime: new Date().toISOString(),
    totalAmount,
    paymentMethod: String(paymentMethod).toLowerCase(),
    status: 'completed'
  };
  fallbackTransactions.push(transaction);
  normalized.forEach((item) => {
    fallbackTransactionItems.push({
      transactionItemId: nextFallbackTransactionItemId++,
      transactionId,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice
    });
  });
  return { source: 'fallback', ...transaction, items: normalized };
}

app.get('/auth/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).send(
      'Google OAuth is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your environment variables.'
    );
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/?loginError=1' }),
  (req, res) => {
    res.redirect('/');
  }
);

app.post('/auth/logout', (req, res, next) => {
  req.logout((error) => {
    if (error) return next(error);
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });
});

app.get('/api/me', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.json({
      authenticated: true,
      user: {
        displayName: req.user.displayName,
        email: req.user.email,
        role: req.user.role
      }
    });
  }

  return res.json({
    authenticated: false,
    user: null
  });
});

app.get('/api/menu', async (_req, res) => {
  try {
    const items = await getMenuItems();
    res.json({ items, categories: categoryBreakdown(items), source: hasDbConfig() ? 'database' : 'csv' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load menu.', details: error.message });
  }
});

app.get('/api/inventory', requireAuth, async (_req, res) => {
  try {
    const items = await getInventoryItems();
    res.json({ items, lowStock: lowStock(items), source: hasDbConfig() ? 'database' : 'csv' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load inventory.', details: error.message });
  }
});

app.get('/api/dashboard', requireManager, async (_req, res) => {
  try {
    res.json(await getDashboardData());
  } catch (error) {
    res.status(500).json({ error: 'Failed to load dashboard.', details: error.message });
  }
});

app.get('/api/orders/recent', requireManager, async (_req, res) => {
  try {
    if (hasDbConfig()) {
      const result = await queryDb(`
        SELECT transactionid, cashierid, transactiontime, totalamount, paymentmethod, status
        FROM transactions
        ORDER BY transactiontime DESC
        LIMIT 10
      `);
      return res.json({ items: result.rows, source: 'database' });
    }
    return res.json({ items: [...fallbackTransactions].reverse().slice(0, 10), source: 'fallback' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load recent orders.', details: error.message });
  }
});

app.post('/api/checkout', async (req, res) => {
  try {
    const result = await createCheckout(req.body || {});
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: 'Checkout failed.', details: error.message });
  }
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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, dbConfigured: hasDbConfig() });
});

app.get('/cashier.html', requireStaff, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cashier.html'));
});

app.get('/manager.html', requireManager, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manager.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Project 3 Team 25 app running on port ${PORT}`);
});