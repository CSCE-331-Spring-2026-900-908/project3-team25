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
const weatherCache = new Map();
const WEATHER_CACHE_MS = 60 * 60 * 1000; // 1 hour
let weatherCallCount = 0;
let externalWeatherCalls = 0;
const COLLEGE_STATION_WEATHER = {
  city: 'College Station, Texas',
  latitude: 30.6280,
  longitude: -96.3344
};
const googleCallbackUrl =
  process.env.GOOGLE_CALLBACK_URL ||
  'https://project3-team25-m13k.onrender.com/auth/google/callback';
const publicBaseUrl = (googleCallbackUrl.replace(/\/auth\/google\/callback$/, '') || '').replace(/\/$/, '');
const authPairs = new Map();
const AUTH_PAIR_TTL_MS = 5 * 60 * 1000;

app.set('trust proxy', 1);
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_only_change_me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }
}));
app.use(passport.initialize());
app.use(passport.session());

const managerEmails = (process.env.MANAGER_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

function getUserRoleFromEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  if (managerEmails.includes(e)) return 'manager';
  if (e.endsWith('@tamu.edu')) return 'cashier';
  return 'customer';
}

function requireStaff(req, res, next) {
  if (req.isAuthenticated?.() && (req.user?.role === 'cashier' || req.user?.role === 'manager')) return next();
  return res.redirect('/?unauthorized=1');
}

function requireStaff(req, res, next) {
  if (req.isAuthenticated?.() && (req.user?.role === 'cashier' || req.user?.role === 'manager')) return next();
  return res.redirect('/?unauthorized=1');
}

function sanitizeReturnTo(value) {
  const target = String(value || '').trim();
  if (!target.startsWith('/')) return '';
  if (target.startsWith('//')) return '';
  return target;
}

function cleanupAuthPairs() {
  const now = Date.now();
  for (const [token, pair] of authPairs.entries()) {
    if (!pair || pair.expiresAt <= now || pair.claimedAt) authPairs.delete(token);
  }
}

function buildPairQrUrl(url) {
  return `https://quickchart.io/qr?size=220&text=${encodeURIComponent(url)}`;
}

function issueAuthPair(returnTo = '/customer.html') {
  cleanupAuthPairs();
  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const safeReturnTo = sanitizeReturnTo(returnTo) || '/customer.html';
  const pairUrl = `${publicBaseUrl}/auth/pair/${token}`;
  authPairs.set(token, {
    token,
    returnTo: safeReturnTo,
    createdAt: Date.now(),
    expiresAt: Date.now() + AUTH_PAIR_TTL_MS,
    status: 'pending',
    user: null,
    claimedAt: null
  });
  return { token, pairUrl, qrUrl: buildPairQrUrl(pairUrl), expiresInMs: AUTH_PAIR_TTL_MS };
}

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

async function queryDb(text, params = []) {
  const pool = getPool();
  if (!pool) throw new Error('Database not configured.');
  return pool.query(text, params);
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    { clientID: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, callbackURL: googleCallbackUrl },
    async (_at, _rt, profile, done) => {
      const email = profile.emails?.[0]?.value || '';
      const role = getUserRoleFromEmail(email);
      const user = {
        id: profile.id,
        displayName: profile.displayName || 'User',
        firstName: profile.name?.givenName || profile.displayName?.split(' ')[0] || 'User',
        email, role
      };
      if (hasDbConfig()) {
        try {
          await queryDb(
            `INSERT INTO user_accounts (user_id, email, display_name, role, last_login)
             VALUES ($1,$2,$3,$4,NOW())
             ON CONFLICT (user_id) DO UPDATE SET display_name=EXCLUDED.display_name, email=EXCLUDED.email, role=EXCLUDED.role, last_login=NOW()`,
            [user.id, user.email, user.displayName, user.role]
          );
        } catch (err) { console.error('upsert user_accounts:', err.message); }
      }
      done(null, user);
    }
  ));
}

function parseCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return [];
  const [headerLine, ...lines] = raw.split(/\r?\n/);
  const headers = headerLine.split(',').map(h => h.trim());
  return lines.map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (values[i] || '').trim(); });
    return obj;
  });
}

const DESCRIPTIONS = {
  milk_tea: 'Creamy tea-based drink with milk, optional toppings, and sweetness customization.',
  tea: 'Refreshing brewed tea with a lighter, clean flavor profile.',
  fruit_tea: 'Fruity green tea served cold with vibrant flavors and real fruit.',
  coffee: 'Coffee-forward milk tea blend for a stronger energy and flavor boost.',
  seasonal: 'Crafted with seasonal ingredients - fresh, vibrant, and available now.'
};

const csvMenu = parseCsv(path.join(dataDir, 'product.csv'))
  .filter(i => i.is_active === 'true' && i.category !== 'topping')
  .map(i => ({ id: Number(i.productid), name: i.name, category: i.category, price: Number(i.baseprice), popular: [2,4,9,10,14].includes(Number(i.productid)), description: DESCRIPTIONS[i.category] || 'Bubble tea menu item.' }));

const csvInventory = parseCsv(path.join(dataDir, 'inventory.csv')).map(i => ({
  id: Number(i.inventoryid), itemName: i.itemname, unit: i.unit,
  quantityOnHand: Number(i.quantityonhand), reorderThreshold: Number(i.reorderthreshold),
  unitCost: Number(i.unitcost), vendor: i.vendor,
  status: Number(i.quantityonhand) <= Number(i.reorderthreshold) ? 'low' : 'ok'
}));

let fallbackTransactions = [];
let nextFallbackId = (() => {
  const fp = path.join(dataDir, 'transactions.csv');
  if (!fs.existsSync(fp)) return 100001;
  const lines = fs.readFileSync(fp, 'utf8').trim().split(/\r?\n/);
  if (lines.length < 2) return 100001;
  const id = Number(lines[lines.length-1].split(',')[0]);
  return isNaN(id) ? 100001 : id + 1;
})();
let nextItemId = 500001;

function categoryBreakdown(items) {
  const c = {};
  for (const i of items) c[i.category] = (c[i.category] || 0) + 1;
  return c;
}
function lowStock(items) {
  return [...items].sort((a,b) => (a.quantityOnHand/(a.reorderThreshold||1)) - (b.quantityOnHand/(b.reorderThreshold||1))).slice(0,6)
    .map(i => ({ ...i, status: i.quantityOnHand <= i.reorderThreshold ? 'low' : 'ok' }));
}

async function getPopularIds() {
  try {
    if (!hasDbConfig()) return [2,4,9,10,14];
    const r = await queryDb(
      `SELECT productid, COUNT(*) AS sold FROM transactionitem
       GROUP BY productid ORDER BY sold DESC LIMIT 5`
    );
    if (r.rows.length > 0) return r.rows.map(row => Number(row.productid));
  } catch(_) {}
  return [2,4,9,10,14]; // fallback if table empty
}

async function getMenuItems() {
  if (hasDbConfig()) {
    const [r, popularIds] = await Promise.all([
      queryDb(`SELECT productid AS id, name, category, baseprice AS price, image_url FROM product WHERE is_active=true ORDER BY category,name`),
      getPopularIds()
    ]);
    return r.rows.map(i => ({ id: Number(i.id), name: i.name, category: i.category, price: Number(i.price), image_url: i.image_url || null, popular: popularIds.includes(Number(i.id)), description: DESCRIPTIONS[i.category] || 'Bubble tea menu item.' }));
  }
  return csvMenu;
}

async function getInventoryItems() {
  if (hasDbConfig()) {
    const r = await queryDb(`SELECT inventoryid AS id, itemname, unit, quantityonhand, reorderthreshold, unitcost, vendor FROM inventory ORDER BY itemname`);
    return r.rows.map(i => ({ id: Number(i.id), itemName: i.itemname, unit: i.unit, quantityOnHand: Number(i.quantityonhand), reorderThreshold: Number(i.reorderthreshold), unitCost: Number(i.unitcost), vendor: i.vendor, status: Number(i.quantityonhand) <= Number(i.reorderthreshold) ? 'low' : 'ok' }));
  }
  return csvInventory;
}

async function getDashboardData() {
  const menuItems = await getMenuItems();
  const inventoryItems = await getInventoryItems();
  let salesMetrics = { totalOrders: fallbackTransactions.length, totalRevenue: fallbackTransactions.reduce((s,t)=>s+Number(t.totalAmount||0),0), completedOrders: fallbackTransactions.filter(t=>t.status==='completed').length };
  if (hasDbConfig()) {
    const r = await queryDb(`SELECT COUNT(*)::int AS total_orders, COALESCE(SUM(totalamount),0)::numeric AS total_revenue, COUNT(*) FILTER (WHERE status='completed')::int AS completed_orders FROM transactions`);
    salesMetrics = { totalOrders: r.rows[0].total_orders, totalRevenue: Number(r.rows[0].total_revenue), completedOrders: r.rows[0].completed_orders };
  }
  const avgPrice = menuItems.length ? menuItems.reduce((s,i)=>s+i.price,0)/menuItems.length : 0;
  return {
    metrics: { activeMenuItems: menuItems.length, inventoryItems: inventoryItems.length, lowStockItems: lowStock(inventoryItems).length, averageMenuPrice: Number(avgPrice.toFixed(2)), ...salesMetrics },
    lowStock: lowStock(inventoryItems), categories: categoryBreakdown(menuItems),
    announcements: [hasDbConfig() ? 'Database mode active.' : 'CSV fallback mode active.', 'Portal is the centralized launch point.', 'Cashier and customer pages have separate layouts.']
  };
}

// SPIN prizes
// segmentIndex MUST match SPIN_SEGMENTS order in customer.js
const SPIN_PRIZES = [
  { label:'50% Off One Drink', type:'percent_off', value:50, weight:20, segmentIndex:0 },
  { label:'Free Topping',      type:'free_topping', value:0, weight:30, segmentIndex:1 },
  { label:'$1 Off Your Order', type:'flat_off',     value:1, weight:25, segmentIndex:2 },
  { label:'Free Small Drink',  type:'free_drink',   value:0, weight:10, segmentIndex:3 },
  { label:'Buy One Get One',   type:'percent_off', value:50, weight:5,  segmentIndex:4 },
  { label:'25% Off Order',     type:'percent_off', value:25, weight:10, segmentIndex:5 }
];
function randomPrize() {
  const total = SPIN_PRIZES.reduce((s,p)=>s+p.weight,0);
  let r = Math.random()*total;
  for (const p of SPIN_PRIZES) { r -= p.weight; if (r<=0) return p; }
  return SPIN_PRIZES[0];
}
function genCode() { return 'RBT-'+Math.random().toString(36).slice(2,8).toUpperCase(); }

const FALLBACK_CATALOG = [
  { reward_id:1, label:'Free Small Drink', description:'Any small drink free', points_cost:500, reward_type:'free_drink', reward_value:0 },
  { reward_id:2, label:'50% Off One Drink', description:'Half off one drink', points_cost:300, reward_type:'percent_off', reward_value:50 },
  { reward_id:3, label:'Free Topping', description:'Any topping free', points_cost:150, reward_type:'free_topping', reward_value:0 },
  { reward_id:4, label:'$1 Off Your Order', description:'$1 discount', points_cost:100, reward_type:'flat_off', reward_value:1 }
];

function ruleBasedAssistant(message) {
  const t = (message||'').toLowerCase();
  if (!t.trim()) return 'Ask me about drinks, toppings, sweetness, allergens, rewards, or how to use this kiosk.';
  if (t.includes('popular')||t.includes('best')) return 'Our top sellers: Brown Sugar Milk Tea, Matcha Milk Tea, Strawberry Green Tea, Mango Green Tea.';
  if (t.includes('sweet')||t.includes('sugar')) return 'Choose 0%, 25%, 50%, 75%, or 100% sweetness. Fruit teas are great at 50-75%.';
  if (t.includes('topping')||t.includes('boba')) return 'We offer extra boba as a topping add-on.';
  if (t.includes('milk')||t.includes('dairy')) return 'Most milk teas contain dairy. Tea and fruit tea are dairy-friendlier.';
  if (t.includes('reward')||t.includes('point')) return 'Earn 10 points per dollar spent. Redeem for free drinks, discounts, and toppings!';
  if (t.includes('spin')||t.includes('promo')) return 'Spin the wheel once per day for free drinks, discounts, and more!';
  return 'I can help with menu suggestions, sweetness, popular drinks, toppings, rewards, and kiosk guidance.';
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/auth/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).send('Google OAuth not configured.');
  }
  const safeReturnTo = sanitizeReturnTo(req.query.returnTo) || '';
  // Pass returnTo through OAuth state parameter — reliable across redirects
  passport.authenticate('google', {
    scope: ['profile','email'],
    state: safeReturnTo
  })(req, res, next);
});

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/?loginError=1' }),
  (req, res) => {
    // Read returnTo from state parameter (passed through Google redirect reliably)
    const returnTo = sanitizeReturnTo(req.query.state);
    if (returnTo) return res.redirect(returnTo);
    // Fallback by role
    const role = req.user?.role;
    if (role === 'manager') return res.redirect('/manager.html');
    if (role === 'cashier') return res.redirect('/cashier.html');
    return res.redirect('/customer.html');
  }
);

app.post('/auth/logout', (req, res, next) => {
  req.logout(err => { if (err) return next(err); req.session.destroy(() => res.json({ ok: true })); });
});

app.get('/api/me', async (req, res) => {
  if (!req.isAuthenticated?.()) return res.json({ authenticated: false, user: null });
  let rewardPoints = 0;
  if (hasDbConfig() && req.user?.id) {
    try { const r = await queryDb(`SELECT reward_points FROM user_accounts WHERE user_id=$1`, [req.user.id]); rewardPoints = r.rows[0]?.reward_points ?? 0; } catch(_) {}
  }
  res.json({ authenticated: true, user: { id: req.user.id, displayName: req.user.displayName, firstName: req.user.firstName || req.user.displayName?.split(' ')[0] || 'User', email: req.user.email, role: req.user.role, rewardPoints } });
});

app.get('/api/staff-auth-status', (req, res) => {
  const authenticated = Boolean(req.isAuthenticated?.() && req.user);
  const role = req.user?.role || null;
  const allowed = role === 'cashier' || role === 'manager';
  res.json({
    authenticated,
    allowed,
    role,
    user: authenticated ? {
      displayName: req.user.displayName,
      firstName: req.user.firstName || req.user.displayName?.split(' ')[0] || 'User',
      email: req.user.email
    } : null
  });
});

app.get('/api/auth/pair/new', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Google OAuth not configured.' });
  }
  const pair = issueAuthPair(req.query.returnTo || '/customer.html');
  res.json(pair);
});

app.get('/auth/pair/:token', (req, res) => {
  cleanupAuthPairs();
  const pair = authPairs.get(req.params.token);
  if (!pair) return res.status(404).send('This kiosk sign-in session expired. Please scan the new QR code on the kiosk.');
  const continueUrl = `/auth/google?returnTo=${encodeURIComponent(`/auth/pair/complete?token=${req.params.token}`)}`;
  res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Kiosk Sign In</title><style>body{font-family:system-ui,-apple-system,sans-serif;background:#f8f3ef;color:#3f2a24;display:grid;place-items:center;min-height:100vh;margin:0;padding:20px}.card{max-width:420px;background:#fff;border:1px solid #e8d4cb;border-radius:20px;padding:28px;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.08)}.badge{width:64px;height:64px;border-radius:16px;background:#b54a40;color:#fff;font-weight:800;font-size:28px;display:grid;place-items:center;margin:0 auto 16px}.btn{display:inline-block;background:#b54a40;color:#fff;text-decoration:none;padding:14px 18px;border-radius:12px;font-weight:700;margin-top:10px}.sub{color:#7d645c;font-size:.95rem;line-height:1.5}</style></head><body><div class="card"><div class="badge">RB</div><h1 style="margin:0 0 10px;font-size:1.7rem;">Sign in to Reveille Bubble Tea</h1><p class="sub">Continue with Google on your phone. After you finish, the kiosk on the counter will log in automatically.</p><a class="btn" href="${continueUrl}">Continue with Google</a></div></body></html>`);
});

app.get('/auth/pair/complete', (req, res) => {
  cleanupAuthPairs();
  const pair = authPairs.get(req.query.token);
  if (!pair) return res.status(404).send('This kiosk sign-in session expired. Please rescan the QR code.');
  if (!req.isAuthenticated?.() || !req.user) {
    return res.redirect(`/auth/google?returnTo=${encodeURIComponent(`/auth/pair/complete?token=${req.query.token}`)}`);
  }
  pair.status = 'authorized';
  pair.user = req.user;
  authPairs.set(req.query.token, pair);
  res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Kiosk Connected</title><style>body{font-family:system-ui,-apple-system,sans-serif;background:#f8f3ef;color:#3f2a24;display:grid;place-items:center;min-height:100vh;margin:0;padding:20px}.card{max-width:430px;background:#fff;border:1px solid #e8d4cb;border-radius:20px;padding:28px;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.08)}.badge{width:64px;height:64px;border-radius:16px;background:#b54a40;color:#fff;font-weight:800;font-size:28px;display:grid;place-items:center;margin:0 auto 16px}</style></head><body><div class="card"><div class="badge">RB</div><h1 style="margin:0 0 10px;font-size:1.7rem;">Kiosk connected</h1><p style="color:#7d645c;line-height:1.5">You are signed in as <strong>${req.user.displayName}</strong>. You can go back to the kiosk now and continue your order.</p></div></body></html>`);
});

app.get('/api/auth/pair-status/:token', (req, res) => {
  cleanupAuthPairs();
  const pair = authPairs.get(req.params.token);
  if (!pair) return res.status(404).json({ status: 'expired' });
  res.json({ status: pair.status, expiresInMs: Math.max(0, pair.expiresAt - Date.now()) });
});

app.post('/api/auth/pair-claim/:token', (req, res, next) => {
  cleanupAuthPairs();
  const pair = authPairs.get(req.params.token);
  if (!pair || pair.status !== 'authorized' || !pair.user) return res.status(404).json({ error: 'Pairing not ready.' });
  req.login(pair.user, err => {
    if (err) return next(err);
    pair.status = 'claimed';
    pair.claimedAt = Date.now();
    authPairs.set(req.params.token, pair);
    res.json({ ok: true, user: pair.user, returnTo: pair.returnTo });
  });
});

app.get('/api/menu', async (_req, res) => {
  try { const items = await getMenuItems(); res.json({ items, categories: categoryBreakdown(items), source: hasDbConfig()?'database':'csv' }); }
  catch(e) { res.status(500).json({ error: 'Failed to load menu.', details: e.message }); }
});

// Public endpoint — returns active toppings so kiosk and cashier stay in sync with DB
app.get('/api/toppings', async (_req, res) => {
  try {
    if (hasDbConfig()) {
      const r = await queryDb(`SELECT productid AS id, name, baseprice AS price FROM product WHERE is_active=true AND category='topping' ORDER BY name`);
      return res.json({ toppings: r.rows.map(t => ({ id: Number(t.id), name: t.name, price: Number(t.price) })) });
    }
    const toppings = parseCsv(path.join(dataDir,'product.csv'))
      .filter(r => r.is_active === 'true' && r.category === 'topping')
      .map(r => ({ id: Number(r.productid), name: r.name, price: Number(r.baseprice) }));
    res.json({ toppings });
  } catch(e) { res.status(500).json({ error: 'Failed to load toppings.', details: e.message }); }
});

app.get('/api/inventory', async (req, res) => {
  if (!req.isAuthenticated?.()) return res.status(401).json({ error: 'Auth required.' });
  try { const items = await getInventoryItems(); res.json({ items, lowStock: lowStock(items), source: hasDbConfig()?'database':'csv' }); }
  catch(e) { res.status(500).json({ error: 'Failed to load inventory.', details: e.message }); }
});

app.get('/api/dashboard', async (req, res) => {
  if (!req.isAuthenticated?.() || req.user?.role !== 'manager') return res.status(403).json({ error: 'Manager only.' });
  try { res.json(await getDashboardData()); }
  catch(e) { res.status(500).json({ error: 'Failed to load dashboard.', details: e.message }); }
});

// Customer recent orders endpoint
app.get('/api/customer/recent-orders', async (req, res) => {
  if (!req.isAuthenticated?.() || !req.user?.id) return res.status(401).json({ error: 'Login required.' });
  if (!hasDbConfig()) return res.json({ orders: [] });
  try {
    const r = await queryDb(`
      SELECT t.transactionid, t.transactiontime, t.totalamount, t.paymentmethod,
             json_agg(json_build_object(
               'name', p.name, 'price', ti.unitprice,
               'quantity', ti.quantity, 'category', p.category,
               'selections', ti.selections
             ) ORDER BY p.name) AS items
      FROM transactions t
      JOIN transactionitem ti ON ti.transactionid = t.transactionid
      JOIN product p ON p.productid = ti.productid
      WHERE t.user_id = $1 AND t.status IN ('completed','closed')
      GROUP BY t.transactionid, t.transactiontime, t.totalamount, t.paymentmethod
      ORDER BY t.transactiontime DESC LIMIT 5`, [req.user.id]);
    res.json({ orders: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orders/recent', async (req, res) => {
  if (!req.isAuthenticated?.() || req.user?.role !== 'manager') return res.status(403).json({ error: 'Manager only.' });
  const limit = Math.min(Number(req.query.limit || 50), 200);
  try {
    if (hasDbConfig()) {
      const r = await queryDb(`
        SELECT t.transactionid, t.cashierid,
               COALESCE(c.firstname || ' ' || c.lastname, 'Cashier #' || t.cashierid) AS cashier_name,
               (t.transactiontime AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') AS transactiontime,
               t.totalamount, t.paymentmethod, t.status
        FROM transactions t
        LEFT JOIN cashier c ON c.cashierid = t.cashierid
        ORDER BY t.transactiontime DESC LIMIT $1`, [limit]);
      return res.json({ items: r.rows, source: 'database' });
    }
    res.json({ items: [...fallbackTransactions].reverse().slice(0, limit), source: 'fallback' });
  } catch(e) { res.status(500).json({ error: 'Failed.', details: e.message }); }
});

// REWARDS
app.get('/api/rewards', async (req, res) => {
  try {
    let catalog = FALLBACK_CATALOG, userPoints = 0, history = [];
    if (hasDbConfig()) {
      const cr = await queryDb(`SELECT * FROM rewards_catalog WHERE is_active=true ORDER BY points_cost`);
      catalog = cr.rows;
      if (req.isAuthenticated?.() && req.user?.id) {
        const ur = await queryDb(`SELECT reward_points FROM user_accounts WHERE user_id=$1`, [req.user.id]);
        userPoints = ur.rows[0]?.reward_points ?? 0;
        const hr = await queryDb(`SELECT rr.redeemed_at, rc.label, rr.discount_amount, rr.status FROM reward_redemptions rr JOIN rewards_catalog rc ON rr.reward_id=rc.reward_id WHERE rr.user_id=$1 ORDER BY rr.redeemed_at DESC LIMIT 10`, [req.user.id]);
        history = hr.rows;
      }
    }
    res.json({ catalog, userPoints, history });
  } catch(e) { res.status(500).json({ error: 'Failed.', details: e.message }); }
});

// SPIN STATUS
app.get('/api/spin/status', async (req, res) => {
  if (!req.isAuthenticated?.()) return res.json({ canSpin: false, reason: 'Login required.' });
  if (!hasDbConfig()) return res.json({ canSpin: true });
  try {
    const r = await queryDb(`SELECT spun_at FROM spin_log WHERE user_id=$1 AND spun_at > NOW()-INTERVAL '24 hours' ORDER BY spun_at DESC LIMIT 1`, [req.user.id]);
    if (r.rows.length > 0) {
      const next = new Date(r.rows[0].spun_at); next.setHours(next.getHours()+24);
      return res.json({ canSpin: false, nextSpinAt: next.toISOString(), reason: 'Already spun today. Come back tomorrow!' });
    }
    res.json({ canSpin: true });
  } catch(e) { res.status(500).json({ error: 'Failed.', details: e.message }); }
});

// SPIN
app.post('/api/spin', async (req, res) => {
  if (!req.isAuthenticated?.()) return res.status(401).json({ error: 'Login required.' });
  const prize = randomPrize();
  const code = genCode();
  if (!hasDbConfig()) return res.json({ prize, code, message: 'CSV mode – code not persisted.' });
  try {
    const check = await queryDb(`SELECT spun_at FROM spin_log WHERE user_id=$1 AND spun_at > NOW()-INTERVAL '24 hours' LIMIT 1`, [req.user.id]);
    if (check.rows.length > 0) return res.status(429).json({ error: 'Already spun today!' });
    const exp = new Date(); exp.setDate(exp.getDate()+7);
    await queryDb(`INSERT INTO promo_codes (user_id, code, promo_type, promo_value, label, expires_at) VALUES ($1,$2,$3,$4,$5,$6)`, [req.user.id, code, prize.type, prize.value, prize.label, exp.toISOString()]);
    await queryDb(`INSERT INTO spin_log (user_id, prize) VALUES ($1,$2)`, [req.user.id, prize.label]);
    res.json({ prize, code, expiresAt: exp.toISOString() });
  } catch(e) { res.status(500).json({ error: 'Spin failed.', details: e.message }); }
});

// PROMOS
app.get('/api/promos', async (req, res) => {
  if (!req.isAuthenticated?.()) return res.json({ codes: [] });
  if (!hasDbConfig()) return res.json({ codes: [] });
  try {
    const r = await queryDb(`SELECT code, label, promo_type, promo_value, expires_at FROM promo_codes WHERE user_id=$1 AND is_used=false AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY created_at DESC`, [req.user.id]);
    res.json({ codes: r.rows });
  } catch(e) { res.status(500).json({ error: 'Failed.' }); }
});

app.get('/api/promos/validate/:code', async (req, res) => {
  if (!hasDbConfig()) return res.json({ valid: false, reason: 'CSV mode' });
  try {
    const r = await queryDb(`SELECT * FROM promo_codes WHERE code=$1 AND is_used=false AND (expires_at IS NULL OR expires_at > NOW())`, [req.params.code.toUpperCase()]);
    const promo = r.rows[0];
    if (!promo) return res.json({ valid: false, reason: 'Code not found or expired.' });
    res.json({ valid: true, promo });
  } catch(e) { res.status(500).json({ error: 'Failed.' }); }
});

// CHECKOUT
app.post('/api/checkout', async (req, res) => {
  try {
    const userId = req.isAuthenticated?.() ? req.user?.id : null;
    const body = req.body || {};
    console.log('DEBUG cashierId:', JSON.stringify(body).slice(0,200));
    const { items, paymentMethod = 'card', cashierId = 7, promoCode = null, rewardId = null, source = 'customer' } = body;
    const safeItems = Array.isArray(items) ? items : [];
    if (!safeItems.length) throw new Error('At least one item required.');

    const menuItems = await getMenuItems();
    const menuMap = new Map(menuItems.map(i => [Number(i.id), i]));
    if (hasDbConfig()) {
      const tr = await queryDb(`SELECT productid AS id, name, baseprice AS price FROM product WHERE is_active=true AND category='topping'`);
      for (const t of tr.rows) menuMap.set(Number(t.id), { id: Number(t.id), name: t.name, price: Number(t.price) });
    } else {
      parseCsv(path.join(dataDir,'product.csv')).filter(r=>r.is_active==='true'&&r.category==='topping').forEach(r=>menuMap.set(Number(r.productid),{id:Number(r.productid),name:r.name,price:Number(r.baseprice)}));
    }

    const normalized = safeItems.map(item => {
      const menu = menuMap.get(Number(item.id));
      if (!menu) throw new Error(`Menu item ${item.id} not found.`);
      const qty = Math.max(1, Number(item.quantity||1));
      return { productId: menu.id, name: menu.name, unitPrice: Number(item.unitPrice||menu.price), quantity: qty, lineTotal: Number((Number(item.unitPrice||menu.price)*qty).toFixed(2)), selections: item.selections||{} };
    });

    let subtotal = normalized.reduce((s,i)=>s+i.lineTotal,0);
    let discountAmount = 0, discountLabel = '';

    // Apply promo
    if (promoCode && hasDbConfig()) {
      const pr = await queryDb(`SELECT * FROM promo_codes WHERE code=$1 AND is_used=false AND (expires_at IS NULL OR expires_at > NOW())`, [promoCode.toUpperCase()]);
      const promo = pr.rows[0];
      if (promo) {
        if (promo.promo_type==='percent_off') discountAmount = Number(((subtotal*Number(promo.promo_value))/100).toFixed(2));
        else if (promo.promo_type==='flat_off') discountAmount = Math.min(subtotal, Number(promo.promo_value)||0);
        else if (promo.promo_type==='free_drink') discountAmount = Math.min(...normalized.map(i=>i.unitPrice));
        else if (promo.promo_type==='free_topping') discountAmount = 0.75;
        discountLabel = promo.label;
      }
    }

    // Apply reward
    if (rewardId && hasDbConfig() && userId) {
      const rwr = await queryDb(`SELECT rc.*, ua.reward_points FROM rewards_catalog rc, user_accounts ua WHERE rc.reward_id=$1 AND ua.user_id=$2 AND rc.is_active=true`, [rewardId, userId]);
      const reward = rwr.rows[0];
      if (reward && Number(reward.reward_points)>=Number(reward.points_cost)) {
        if (reward.reward_type==='percent_off') discountAmount = Number(((subtotal*Number(reward.reward_value))/100).toFixed(2));
        else if (reward.reward_type==='free_drink') discountAmount = Math.min(...normalized.map(i=>i.unitPrice));
        else if (reward.reward_type==='free_topping') discountAmount = 0.75;
        else if (reward.reward_type==='flat_off') discountAmount = Number(reward.reward_value);
        discountLabel = reward.label;
      }
    }

    discountAmount = Math.min(discountAmount, subtotal);
    const totalAmount = subtotal - discountAmount;

    if (hasDbConfig()) {
      const pool = getPool();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const txr = await client.query(
          `INSERT INTO transactions (cashierid,transactiontime,totalamount,paymentmethod,status,user_id)
           VALUES ($1,NOW(),$2,$3,'completed',$4)
           RETURNING transactionid,transactiontime,totalamount,paymentmethod,status`,
          [cashierId, totalAmount, String(paymentMethod).toLowerCase(), userId || null]);
        const tx = txr.rows[0];
        for (const item of normalized) {
          await client.query(
            `INSERT INTO transactionitem (transactionid,productid,quantity,unitprice,selections) VALUES ($1,$2,$3,$4,$5)`,
            [tx.transactionid, item.productId, item.quantity, item.unitPrice, JSON.stringify(item.selections||{})]);
        }

        // ── Deduct inventory based on ingredients used per item sold ──
        for (const item of normalized) {
          const ings = await client.query(
            `SELECT inventoryid, amountused FROM productingredient WHERE productid = $1`,
            [item.productId]
          );
          for (const ing of ings.rows) {
            const deduct = Number(ing.amountused) * item.quantity;
            await client.query(
              `UPDATE inventory SET quantityonhand = GREATEST(0, quantityonhand - $1) WHERE inventoryid = $2`,
              [deduct, ing.inventoryid]
            );
          }
        }

        let pointsEarned = 0, newBalance = 0;
        if (userId && source === 'customer') {
          pointsEarned = Math.floor((subtotal - discountAmount) * 10);
          if (pointsEarned > 0) {
            await client.query(`UPDATE user_accounts SET reward_points=reward_points+$1 WHERE user_id=$2`, [pointsEarned, userId]);
            await client.query(`INSERT INTO points_ledger (user_id,delta,reason,transaction_id) VALUES ($1,$2,$3,$4)`, [userId, pointsEarned, `Order #${tx.transactionid}`, tx.transactionid]);
          }
          if (promoCode) await client.query(`UPDATE promo_codes SET is_used=true WHERE code=$1`, [promoCode.toUpperCase()]);
          if (rewardId) {
            const rwr2 = await client.query(`SELECT points_cost, label FROM rewards_catalog WHERE reward_id=$1`, [rewardId]);
            const rw = rwr2.rows[0];
            if (rw) {
              await client.query(`UPDATE user_accounts SET reward_points=reward_points-$1 WHERE user_id=$2`, [rw.points_cost, userId]);
              await client.query(`INSERT INTO points_ledger (user_id,delta,reason,transaction_id) VALUES ($1,$2,$3,$4)`, [userId, -rw.points_cost, `Redeemed: ${rw.label}`, tx.transactionid]);
              await client.query(`INSERT INTO reward_redemptions (user_id,reward_id,transaction_id,discount_amount,status) VALUES ($1,$2,$3,$4,'applied')`, [userId, rewardId, tx.transactionid, discountAmount]);
            }
          }
          const balr = await client.query(`SELECT reward_points FROM user_accounts WHERE user_id=$1`, [userId]);
          newBalance = balr.rows[0]?.reward_points ?? 0;
        }
        await client.query('COMMIT');
        return res.status(201).json({ source:'database', transactionId:tx.transactionid, transactionTime:tx.transactiontime, subtotal:Number(subtotal.toFixed(2)), discountAmount:Number(discountAmount.toFixed(2)), discountLabel, totalAmount:Number(tx.totalamount), paymentMethod:tx.paymentmethod, status:tx.status, pointsEarned, newPointBalance:newBalance, items:normalized });
      } catch(err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
    }

    // CSV fallback
    const transactionId = nextFallbackId++;
    const transactionTime = new Date().toISOString().replace('T',' ').slice(0,19);
    const transaction = { transactionId, cashierId, transactionTime, totalAmount, paymentMethod: String(paymentMethod).toLowerCase(), status:'completed' };
    fallbackTransactions.push(transaction);
    normalized.forEach(item => { fallbackTransactionItems.push({ transactionItemId: nextItemId++, transactionId, productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice }); });
    fs.appendFileSync(path.join(dataDir,'transactions.csv'), `\n${transactionId},${cashierId},${transactionTime},${totalAmount.toFixed(2)},${transaction.paymentMethod},completed`);
    res.status(201).json({ source:'fallback', ...transaction, subtotal:Number(subtotal.toFixed(2)), discountAmount:Number(discountAmount.toFixed(2)), discountLabel, pointsEarned: Math.floor((subtotal-discountAmount)*10), items:normalized });
  } catch(e) { res.status(400).json({ error:'Checkout failed.', details:e.message }); }
});

app.post('/api/assistant', async (req, res) => {
  const { message } = req.body || {};
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.json({ source: 'local-fallback', reply: ruleBasedAssistant(message) });
  }

  try {
    const menuItems = await getMenuItems();

    const menuText = menuItems
      .map(item => `- ${item.name} (${item.category}) - $${Number(item.price).toFixed(2)}`)
      .join('\n');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `
You are the Reveille Bubble Tea customer kiosk assistant.

You help customers with:
- Menu questions
- Recommendations (popular drinks, what to try)
- Ordering steps and customization
- Rewards, promos, and kiosk features

IMPORTANT RULES:

1. Only say "I don't see that on our current menu" when the user is asking for a specific item that does not exist (e.g., "Do you have slushies?").

2. DO NOT use that response for general questions like:
- "What's popular?"
- "What should I get?"
- "What do you recommend?"
- "How does ordering work?"

3. For recommendation questions:
- Suggest drinks ONLY from the menu below
- You may use these popular items if they exist:
  Brown Sugar Milk Tea, Matcha Milk Tea, Strawberry Green Tea, Mango Green Tea, Coffee Milk Tea

4. Use ONLY the menu below when naming drinks or prices.
Do not invent drinks, toppings, or categories.

Current menu:
${menuText}

Ordering flow:
- Choose a drink
- Customize sweetness, ice level, size, and toppings
- Add to order
- Review cart
- Apply rewards or promo codes (if signed in)
- Choose payment
- Place order

Keep answers short, friendly, and helpful for a touchscreen kiosk.
            `.trim()
          },
          {
            role: 'user',
            content: String(message || '')
          }
        ],
        temperature: 0.2,
        max_tokens: 180
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI ${response.status}`);
    }

    const data = await response.json();

    res.json({
      source: 'openai',
      reply: data.choices?.[0]?.message?.content?.trim() || ruleBasedAssistant(message)
    });
  } catch (e) {
    console.error('Assistant API failed:', e.message);
    res.json({ source: 'local-fallback', reply: ruleBasedAssistant(message) });
  }
});

app.get('/api/weather', async (req, res) => {
  const city = String(req.query.city || 'College Station').trim();
  weatherCallCount++;
  console.log(`Weather endpoint hit: ${weatherCallCount}`);
  const cacheKey = city.toLowerCase();
  const now = Date.now();

  const cached = weatherCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < WEATHER_CACHE_MS) {
    return res.json({
      ...cached.data,
      source: 'cache'
    });
  }

  try {
    let placeName;
    let latitude;
    let longitude;

    if (cacheKey === 'college station') {
      placeName = COLLEGE_STATION_WEATHER.city;
      latitude = COLLEGE_STATION_WEATHER.latitude;
      longitude = COLLEGE_STATION_WEATHER.longitude;
    } else {
      return res.status(400).json({
        error: 'Only College Station weather is supported right now.'
      });
    }

    const forecastUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}` +
      `&longitude=${longitude}` +
      `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day` +
      `&temperature_unit=fahrenheit` +
      `&wind_speed_unit=mph` +
      `&timezone=auto`;

    externalWeatherCalls++;
    console.log(`Open-Meteo calls: ${externalWeatherCalls}`);
    const forecastRes = await fetch(forecastUrl);

    if (!forecastRes.ok) {
      throw new Error(`Forecast API failed with status ${forecastRes.status}`);
    }

    const forecastData = await forecastRes.json();
    const current = forecastData.current || forecastData.current_weather || null;

    if (!current) {
      throw new Error('Weather data missing from Open-Meteo response.');
    }

    const temperature = current.temperature_2m ?? current.temperature ?? null;
    const feelsLike = current.apparent_temperature ?? null;
    const windSpeed = current.wind_speed_10m ?? current.windspeed ?? null;
    const weatherCode = current.weather_code ?? current.weathercode ?? null;
    const isDay = current.is_day ?? 1;

    const weatherLabel = getWeatherLabel(weatherCode);
    const drinkSuggestion = getDrinkSuggestion(temperature, weatherCode);

    const responseData = {
      city: placeName,
      temperature,
      feelsLike,
      windSpeed,
      weatherCode,
      weatherLabel,
      isDay,
      drinkSuggestion
    };

    weatherCache.set(cacheKey, {
      timestamp: now,
      data: responseData
    });

    return res.json({
      ...responseData,
      source: 'live'
    });
  } catch (e) {
    if (cached) {
      return res.json({
        ...cached.data,
        source: 'stale-cache',
        warning: `Live weather unavailable: ${e.message}`
      });
    }

    return res.status(503).json({
      error: 'Weather temporarily unavailable.',
      details: e.message,
      city: COLLEGE_STATION_WEATHER.city
    });
  }
});

function getWeatherLabel(code) {
  const map = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',

    45: 'Fog',
    48: 'Depositing rime fog',

    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',

    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',

    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',

    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',

    85: 'Slight snow showers',
    86: 'Heavy snow showers',

    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail'
  };

  return map[Number(code)] || `Unknown conditions (${code})`;
}

function getDrinkSuggestion(temp, code) {
  const t = Number(temp ?? 0);

  if ([61, 63, 65, 80, 81, 82, 95].includes(code)) {
    return 'Rainy day - cozy milk teas and warm flavors are a great pick.';
  }

  if (t >= 85) {
    return 'Hot day - suggest fruit teas, lighter drinks, and extra ice.';
  }

  if (t >= 72) {
    return 'Nice weather - fruit teas and classic milk teas both fit well.';
  }

  return 'Cooler weather - milk teas and richer flavors are a great pick.';
}

app.post('/api/translate', async (req, res) => {
  try {
    const {
      text,
      sourceLanguage = 'en-US',
      targetLanguage
    } = req.body || {};

    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: 'Text required.' });
    }

    if (!targetLanguage) {
      return res.status(400).json({ error: 'targetLanguage required.' });
    }

    if (!process.env.LARA_ACCESS_KEY_ID || !process.env.LARA_ACCESS_KEY_SECRET) {
      return res.status(500).json({
        error: 'Lara Translate credentials are missing from .env.'
      });
    }

    const { Credentials, Translator } = await import('@translated/lara');

    const credentials = new Credentials(
      process.env.LARA_ACCESS_KEY_ID,
      process.env.LARA_ACCESS_KEY_SECRET
    );

    const lara = new Translator(credentials);

    const result = await lara.translate(
      String(text),
      sourceLanguage,
      targetLanguage,
      {
        instructions: [
          'Translate this for a boba tea shop self-order kiosk. Translate menu item names, drink names, toppings, sweetness levels, category names, buttons, and customer-facing UI text. Do not leave drink names in English unless the word is a brand name. Keep the wording short, natural, and customer-friendly.'
        ],
        style: 'fluid',
        contentType: 'text/plain',
        timeoutInMillis: 5000
      }
    );

    res.json({
      originalText: text,
      translatedText: result.translation,
      sourceLanguage,
      targetLanguage,
      source: 'lara'
    });
  } catch (e) {
    console.error('Lara translation error:', e);
    res.status(500).json({
      error: 'Translation unavailable.',
      details: e.message
    });
  }
});

app.post('/api/auth/mock-login', (req, res) => {
  const { email, role } = req.body || {};
  const safeRole = ['manager','cashier','customer'].includes(role) ? role : 'customer';
  const ne = String(email||'').trim().toLowerCase();
  const allowed = !ne || ne==='reveille.bubbletea@gmail.com' || ne.endsWith('@tamu.edu');
  if (!allowed) return res.status(403).json({ ok:false, message:'Only TAMU addresses or project email accepted.' });
  res.json({ ok:true, role:safeRole, email:ne||'guest@demo.local' });
});

app.get('/api/auth/config', (_req, res) => res.json({ googleClientConfigured: Boolean(process.env.GOOGLE_CLIENT_ID), requiredEmail:'reveille.bubbletea@gmail.com', googleCallbackUrl }));
app.get('/api/health', (_req, res) => res.json({ ok:true, dbConfigured:hasDbConfig() }));

app.get('/cashier.html', (_req, res) => res.sendFile(path.join(__dirname,'public','cashier.html')));
app.get('/manager-login', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).send('Google OAuth not configured.');
  }
  // Pass /manager.html as returnTo via state param
  passport.authenticate('google', {
    scope: ['profile','email'],
    state: '/manager.html'
  })(req, res, next);
});

app.get('/manager.html', (req, res) => {
  if (req.isAuthenticated?.() && req.user?.role==='manager') return res.sendFile(path.join(__dirname,'public','manager.html'));
  res.redirect('/?unauthorized=1');
});


// ─── Inventory CRUD ───────────────────────────────────────────────────────────

app.put('/api/inventory/:id', async (req, res) => {
  if (!req.isAuthenticated?.() || req.user?.role !== 'manager') return res.status(403).json({ error: 'Manager only.' });
  if (!hasDbConfig()) return res.status(503).json({ error: 'Database required.' });
  const { quantityOnHand, reorderThreshold, unitCost, vendor } = req.body || {};
  try {
    await queryDb(
      `UPDATE inventory SET quantityonhand=$1, reorderthreshold=$2, unitcost=$3, vendor=$4 WHERE inventoryid=$5`,
      [Number(quantityOnHand), Number(reorderThreshold), Number(unitCost), vendor || null, Number(req.params.id)]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/inventory', async (req, res) => {
  if (!req.isAuthenticated?.() || req.user?.role !== 'manager') return res.status(403).json({ error: 'Manager only.' });
  if (!hasDbConfig()) return res.status(503).json({ error: 'Database required.' });
  const { itemName, unit, quantityOnHand, reorderThreshold, unitCost, vendor } = req.body || {};
  if (!itemName || !unit) return res.status(400).json({ error: 'itemName and unit required.' });
  try {
    const r = await queryDb(
      `INSERT INTO inventory (itemname, unit, quantityonhand, reorderthreshold, unitcost, vendor) VALUES ($1,$2,$3,$4,$5,$6) RETURNING inventoryid`,
      [itemName, unit, Number(quantityOnHand||0), Number(reorderThreshold||0), Number(unitCost||0), vendor||null]
    );
    res.status(201).json({ id: r.rows[0].inventoryid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── Manager CRUD ─────────────────────────────────────────────────────────────

app.post('/api/managers', async (req, res) => {
  if (!req.isAuthenticated?.() || req.user?.role !== 'manager') return res.status(403).json({ error: 'Manager only.' });
  if (!hasDbConfig()) return res.status(503).json({ error: 'Database required.' });
  const { firstName, lastName, hireDate, pin } = req.body || {};
  if (!firstName || !lastName || !hireDate) return res.status(400).json({ error: 'firstName, lastName, hireDate required.' });
  try {
    const r = await queryDb(
      `INSERT INTO manager (firstname, lastname, hiredate, pin, is_active) VALUES ($1,$2,$3,$4,true) RETURNING managerid`,
      [firstName, lastName, hireDate, pin || '1234']
    );
    res.status(201).json({ id: r.rows[0].managerid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/managers/:id', async (req, res) => {
  if (!req.isAuthenticated?.() || req.user?.role !== 'manager') return res.status(403).json({ error: 'Manager only.' });
  if (!hasDbConfig()) return res.status(503).json({ error: 'Database required.' });
  const { firstName, lastName, hireDate, pin } = req.body || {};
  try {
    await queryDb(`UPDATE manager SET firstname=$1, lastname=$2, hiredate=$3, pin=$4 WHERE managerid=$5`,
      [firstName, lastName, hireDate, pin || '1234', Number(req.params.id)]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/managers/:id/toggle', async (req, res) => {
  if (!req.isAuthenticated?.() || req.user?.role !== 'manager') return res.status(403).json({ error: 'Manager only.' });
  if (!hasDbConfig()) return res.status(503).json({ error: 'Database required.' });
  try {
    await queryDb(`UPDATE manager SET is_active=$1 WHERE managerid=$2`, [Boolean(req.body.active), Number(req.params.id)]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── Active sessions (who is logged in) ──────────────────────────────────────

const activeSessions = new Map(); // userId -> { name, role, loginTime }

// Track logins
app.use((req, _res, next) => {
  if (req.isAuthenticated?.() && req.user?.id) {
    activeSessions.set(req.user.id, {
      name: req.user.displayName,
      role: req.user.role,
      email: req.user.email,
      loginTime: activeSessions.get(req.user.id)?.loginTime || new Date().toISOString()
    });
  }
  next();
});

app.get('/api/active-sessions', (req, res) => {
  if (!req.isAuthenticated?.() || req.user?.role !== 'manager') return res.status(403).json({ error: 'Manager only.' });
  const sessions = Array.from(activeSessions.entries()).map(([id, s]) => ({ id, ...s }));
  res.json({ sessions });
});

// ─── Analytics routes ─────────────────────────────────────────────────────────

function requireMgrRoute(req, res, next) {
  if (req.isAuthenticated?.() && req.user?.role === 'manager') return next();
  return res.status(403).json({ error: 'Manager only.' });
}

app.get('/api/analytics/hourly', requireMgrRoute, async (_req, res) => {
  if (!hasDbConfig()) return res.json({ rows: [] });
  try {
    const r = await queryDb(`
      SELECT EXTRACT(HOUR FROM transactiontime)::int AS hour_of_day,
             COUNT(*) AS orders, COALESCE(SUM(totalamount),0) AS revenue
      FROM transactions WHERE status='completed'
      GROUP BY 1 ORDER BY 1`);
    res.json({ rows: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/analytics/weekly', requireMgrRoute, async (_req, res) => {
  if (!hasDbConfig()) return res.json({ rows: [] });
  try {
    const r = await queryDb(`
      SELECT date_trunc('week', transactiontime)::date AS week_start,
             COUNT(*) AS orders, COALESCE(SUM(totalamount),0) AS revenue
      FROM transactions WHERE status='completed'
      GROUP BY 1 ORDER BY 1 DESC LIMIT 12`);
    res.json({ rows: r.rows.reverse() });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/analytics/peak-days', requireMgrRoute, async (_req, res) => {
  if (!hasDbConfig()) return res.json({ rows: [] });
  try {
    const r = await queryDb(`
      SELECT to_char((transactiontime AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')::date, 'Mon DD, YYYY') AS day,
             COALESCE(SUM(totalamount),0) AS revenue, COUNT(*) AS orders
      FROM transactions WHERE status='completed'
      GROUP BY (transactiontime AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')::date
      ORDER BY revenue DESC LIMIT 10`);
    res.json({ rows: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/analytics/payment-split', requireMgrRoute, async (_req, res) => {
  if (!hasDbConfig()) return res.json({ splits: [] });
  try {
    const r = await queryDb(`
      SELECT paymentmethod AS method, COUNT(*) AS cnt, COALESCE(SUM(totalamount),0) AS total
      FROM transactions WHERE status='completed'
      GROUP BY 1 ORDER BY total DESC`);
    res.json({ splits: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/analytics/xreport', requireMgrRoute, async (_req, res) => {
  if (!hasDbConfig()) return res.json({ rows: [] });
  try {
    const r = await queryDb(`
      WITH hours AS (SELECT generate_series(0,23) AS hour_of_day),
      day_tx AS (
        SELECT EXTRACT(HOUR FROM (transactiontime AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago'))::int AS hour_of_day,
               totalamount, paymentmethod
        FROM transactions
        WHERE status='completed'
          AND (transactiontime AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')::date
              = (NOW() AT TIME ZONE 'America/Chicago')::date
      )
      SELECT h.hour_of_day,
             COALESCE(COUNT(d.totalamount),0) AS orders,
             COALESCE(SUM(d.totalamount),0) AS revenue,
             COALESCE(SUM(CASE WHEN d.paymentmethod='cash' THEN d.totalamount ELSE 0 END),0) AS cash_total,
             COALESCE(SUM(CASE WHEN d.paymentmethod='card' THEN d.totalamount ELSE 0 END),0) AS card_total,
             COALESCE(SUM(CASE WHEN d.paymentmethod='applepay' THEN d.totalamount ELSE 0 END),0) AS applepay_total
      FROM hours h LEFT JOIN day_tx d ON d.hour_of_day=h.hour_of_day
      GROUP BY h.hour_of_day ORDER BY h.hour_of_day`);
    res.json({ rows: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Z-Report: check if already run today ─────────────────────────────────────
app.get('/api/analytics/zreport/status', requireMgrRoute, async (_req, res) => {
  if (!hasDbConfig()) return res.json({ run_today: false });
  try {
    await queryDb(`CREATE TABLE IF NOT EXISTS z_report_log (
      id SERIAL PRIMARY KEY,
      business_date DATE NOT NULL,
      total_orders INT,
      total_revenue NUMERIC(10,2),
      cash_total NUMERIC(10,2),
      card_total NUMERIC(10,2),
      applepay_total NUMERIC(10,2),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    const r = await queryDb(
      `SELECT id FROM z_report_log WHERE business_date = (NOW() AT TIME ZONE 'America/Chicago')::date`
    );
    res.json({ run_today: r.rows.length > 0 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Z-Report: get today's saved report if already run ────────────────────────
app.get('/api/analytics/zreport', requireMgrRoute, async (_req, res) => {
  if (!hasDbConfig()) return res.json({ run_today: false, rows: [], totals: {} });
  try {
    // Add missing columns to existing table if needed
    await queryDb(`ALTER TABLE z_report_log ADD COLUMN IF NOT EXISTS total_orders INT`);
    await queryDb(`ALTER TABLE z_report_log ADD COLUMN IF NOT EXISTS total_revenue NUMERIC(10,2)`);
    await queryDb(`ALTER TABLE z_report_log ADD COLUMN IF NOT EXISTS cash_total NUMERIC(10,2)`);
    await queryDb(`ALTER TABLE z_report_log ADD COLUMN IF NOT EXISTS card_total NUMERIC(10,2)`);
    await queryDb(`ALTER TABLE z_report_log ADD COLUMN IF NOT EXISTS applepay_total NUMERIC(10,2)`);

    const r = await queryDb(
      `SELECT * FROM z_report_log WHERE business_date = (NOW() AT TIME ZONE 'America/Chicago')::date LIMIT 1`
    );
    if (r.rows.length === 0) return res.json({ run_today: false });
    const log = r.rows[0];

    // Recompute hourly from closed transactions
    const hourly = await queryDb(`
      WITH hours AS (SELECT generate_series(0,23) AS hour_of_day),
      day_tx AS (
        SELECT EXTRACT(HOUR FROM (transactiontime AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago'))::int AS hour_of_day,
               totalamount, paymentmethod
        FROM transactions
        WHERE (status='completed' OR status='closed')
          AND (transactiontime AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')::date
              = (NOW() AT TIME ZONE 'America/Chicago')::date
      )
      SELECT h.hour_of_day,
             COALESCE(COUNT(d.totalamount),0) AS orders,
             COALESCE(SUM(d.totalamount),0) AS revenue,
             COALESCE(SUM(CASE WHEN d.paymentmethod='cash'     THEN d.totalamount ELSE 0 END),0) AS cash_total,
             COALESCE(SUM(CASE WHEN d.paymentmethod='card'     THEN d.totalamount ELSE 0 END),0) AS card_total,
             COALESCE(SUM(CASE WHEN d.paymentmethod='applepay' THEN d.totalamount ELSE 0 END),0) AS applepay_total
      FROM hours h LEFT JOIN day_tx d ON d.hour_of_day=h.hour_of_day
      GROUP BY h.hour_of_day ORDER BY h.hour_of_day`);

    const rows = hourly.rows;
    // Use saved totals if available, otherwise recompute from hourly
    const totals = {
      orders:   Number(log.total_orders  || rows.reduce((s,row) => s + Number(row.orders||0), 0)),
      revenue:  Number(log.total_revenue || rows.reduce((s,row) => s + Number(row.revenue||0), 0)),
      cash:     Number(log.cash_total    || rows.reduce((s,row) => s + Number(row.cash_total||0), 0)),
      card:     Number(log.card_total    || rows.reduce((s,row) => s + Number(row.card_total||0), 0)),
      applepay: Number(log.applepay_total|| rows.reduce((s,row) => s + Number(row.applepay_total||0), 0)),
    };
    res.json({ run_today: true, rows, totals });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Z-Report: generate (once per day) ────────────────────────────────────────
app.post('/api/analytics/zreport', requireMgrRoute, async (_req, res) => {
  if (!hasDbConfig()) return res.json({ rows: [], totals: {} });
  try {
    // Add missing columns to existing table if needed
    await queryDb(`ALTER TABLE z_report_log ADD COLUMN IF NOT EXISTS total_orders INT`);
    await queryDb(`ALTER TABLE z_report_log ADD COLUMN IF NOT EXISTS total_revenue NUMERIC(10,2)`);
    await queryDb(`ALTER TABLE z_report_log ADD COLUMN IF NOT EXISTS cash_total NUMERIC(10,2)`);
    await queryDb(`ALTER TABLE z_report_log ADD COLUMN IF NOT EXISTS card_total NUMERIC(10,2)`);
    await queryDb(`ALTER TABLE z_report_log ADD COLUMN IF NOT EXISTS applepay_total NUMERIC(10,2)`);

    const today = await queryDb(
      `SELECT business_date FROM z_report_log WHERE business_date = (NOW() AT TIME ZONE 'America/Chicago')::date`
    );
    if (today.rows.length > 0) {
      return res.status(409).json({ error: 'Z-Report has already been run today.' });
    }
    const r = await queryDb(`
      WITH hours AS (SELECT generate_series(0,23) AS hour_of_day),
      day_tx AS (
        SELECT EXTRACT(HOUR FROM (transactiontime AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago'))::int AS hour_of_day,
               totalamount, paymentmethod
        FROM transactions
        WHERE status='completed'
          AND (transactiontime AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')::date
              = (NOW() AT TIME ZONE 'America/Chicago')::date
      )
      SELECT h.hour_of_day,
             COALESCE(COUNT(d.totalamount),0)  AS orders,
             COALESCE(SUM(d.totalamount),0)    AS revenue,
             COALESCE(SUM(CASE WHEN d.paymentmethod='cash'     THEN d.totalamount ELSE 0 END),0) AS cash_total,
             COALESCE(SUM(CASE WHEN d.paymentmethod='card'     THEN d.totalamount ELSE 0 END),0) AS card_total,
             COALESCE(SUM(CASE WHEN d.paymentmethod='applepay' THEN d.totalamount ELSE 0 END),0) AS applepay_total
      FROM hours h LEFT JOIN day_tx d ON d.hour_of_day=h.hour_of_day
      GROUP BY h.hour_of_day ORDER BY h.hour_of_day`);
    const rows = r.rows;
    const totals = {
      orders:   rows.reduce((s,row) => s + Number(row.orders||0), 0),
      revenue:  rows.reduce((s,row) => s + Number(row.revenue||0), 0),
      cash:     rows.reduce((s,row) => s + Number(row.cash_total||0), 0),
      card:     rows.reduce((s,row) => s + Number(row.card_total||0), 0),
      applepay: rows.reduce((s,row) => s + Number(row.applepay_total||0), 0),
    };
    // Insert using existing schema + new columns
    await queryDb(
      `INSERT INTO z_report_log (business_date, total_orders, total_revenue, cash_total, card_total, applepay_total)
       VALUES ((NOW() AT TIME ZONE 'America/Chicago')::date, $1, $2, $3, $4, $5)`,
      [totals.orders, totals.revenue, totals.cash, totals.card, totals.applepay]
    );
    // Mark today's completed transactions as 'closed' so X-report resets to zero
    await queryDb(`
      UPDATE transactions SET status = 'closed'
      WHERE status = 'completed'
        AND (transactiontime AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')::date
            = (NOW() AT TIME ZONE 'America/Chicago')::date
    `);
    res.json({ rows, totals });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/analytics/best-of-worst', requireMgrRoute, async (_req, res) => {
  if (!hasDbConfig()) return res.json({ rows: [] });
  try {
    const r = await queryDb(`
      WITH daily AS (
        SELECT date_trunc('week',t.transactiontime AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')::date AS week_start,
               (t.transactiontime AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')::date AS day,
               SUM(t.totalamount) AS day_revenue,
               COALESCE(SUM(ti.quantity),0) AS items_sold
        FROM transactions t
        LEFT JOIN transactionitem ti ON ti.transactionid=t.transactionid
        WHERE t.status='completed'
        GROUP BY 1,2
      ),
      ranked AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY week_start ORDER BY day_revenue ASC) AS rn_low,
                  ROW_NUMBER() OVER (PARTITION BY week_start ORDER BY items_sold DESC) AS rn_high
        FROM daily
      )
      SELECT to_char(week_start, 'Mon DD, YYYY') AS week_start,
             to_char(MAX(CASE WHEN rn_low=1 THEN day END), 'Mon DD, YYYY') AS worst_revenue_day,
             MAX(CASE WHEN rn_low=1 THEN day_revenue END) AS worst_day_revenue,
             to_char(MAX(CASE WHEN rn_high=1 THEN day END), 'Mon DD, YYYY') AS best_items_day,
             MAX(CASE WHEN rn_high=1 THEN items_sold END) AS best_day_items_sold
      FROM ranked GROUP BY week_start ORDER BY week_start DESC LIMIT 12`);
    res.json({ rows: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── Menu CRUD ────────────────────────────────────────────────────────────────

app.get('/api/menu-all', requireMgrRoute, async (_req, res) => {
  try {
    if (hasDbConfig()) {
      const r = await queryDb(`SELECT productid AS id, name, category, baseprice AS price, is_active, image_url FROM product ORDER BY category, name`);
      return res.json({ items: r.rows.map(i => ({ ...i, id: Number(i.id), price: Number(i.price) })) });
    }
    const items = parseCsv(path.join(dataDir,'product.csv')).map(i => ({ id:Number(i.productid), name:i.name, category:i.category, price:Number(i.baseprice), is_active:i.is_active==='true' }));
    res.json({ items });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/menu-item', requireMgrRoute, async (req, res) => {
  if (!hasDbConfig()) return res.status(503).json({ error: 'Database required for menu edits.' });
  const { name, category, basePrice, imageUrl } = req.body || {};
  if (!name || !category || isNaN(Number(basePrice))) return res.status(400).json({ error: 'name, category, basePrice required.' });
  try {
    const r = await queryDb(
      `INSERT INTO product (name, category, baseprice, is_active, image_url) VALUES ($1,$2,$3,true,$4) RETURNING productid AS id`,
      [name, category, Number(basePrice), imageUrl || null]);
    res.status(201).json({ id: r.rows[0].id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/menu-item/:id', requireMgrRoute, async (req, res) => {
  if (!hasDbConfig()) return res.status(503).json({ error: 'Database required.' });
  const { name, category, basePrice, imageUrl } = req.body || {};
  try {
    if (imageUrl !== undefined) {
      await queryDb(`UPDATE product SET name=$1, category=$2, baseprice=$3, image_url=$4 WHERE productid=$5`,
        [name, category, Number(basePrice), imageUrl || null, Number(req.params.id)]);
    } else {
      await queryDb(`UPDATE product SET name=$1, category=$2, baseprice=$3 WHERE productid=$4`,
        [name, category, Number(basePrice), Number(req.params.id)]);
    }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/menu-item/:id/toggle', requireMgrRoute, async (req, res) => {
  if (!hasDbConfig()) return res.status(503).json({ error: 'Database required.' });
  try {
    await queryDb(`UPDATE product SET is_active=$1 WHERE productid=$2`, [Boolean(req.body.active), Number(req.params.id)]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/menu-item/:id', requireMgrRoute, async (req, res) => {
  if (!hasDbConfig()) return res.status(503).json({ error: 'Database required.' });
  try {
    // Delete ingredients first (foreign key), then delete the product
    await queryDb(`DELETE FROM productingredient WHERE productid=$1`, [Number(req.params.id)]);
    await queryDb(`DELETE FROM product WHERE productid=$1`, [Number(req.params.id)]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Public endpoint — lets customer kiosk show what's inside each drink (no auth needed)
app.get('/api/public/menu-item/:id/ingredients', async (req, res) => {
  try {
    if (hasDbConfig()) {
      const r = await queryDb(
        `SELECT i.itemname AS name FROM productingredient pi
         JOIN inventory i ON i.inventoryid = pi.inventoryid
         WHERE pi.productid = $1 ORDER BY i.itemname`,
        [Number(req.params.id)]
      );
      return res.json({ ingredients: r.rows.map(r => r.name) });
    }
    const pi = parseCsv(path.join(dataDir,'productingredient.csv'));
    const inv = parseCsv(path.join(dataDir,'inventory.csv'));
    const invMap = new Map(inv.map(i => [Number(i.inventoryid), i.itemname]));
    const names = pi.filter(r => Number(r.productid) === Number(req.params.id))
      .map(r => invMap.get(Number(r.inventoryid))).filter(Boolean);
    res.json({ ingredients: names });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/menu-item/:id/ingredients', requireMgrRoute, async (req, res) => {
  if (!hasDbConfig()) return res.status(503).json({ error: 'Database required.' });
  try {
    const r = await queryDb(
      `SELECT pi.inventoryid, i.itemname, pi.amountused, i.unit
       FROM productingredient pi
       JOIN inventory i ON i.inventoryid = pi.inventoryid
       WHERE pi.productid = $1
       ORDER BY i.itemname`,
      [Number(req.params.id)]
    );
    res.json({ ingredients: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/menu-item/:id/ingredients', requireMgrRoute, async (req, res) => {
  if (!hasDbConfig()) return res.status(503).json({ error: 'Database required.' });
  const { ingredients } = req.body || {};
  if (!Array.isArray(ingredients)) return res.status(400).json({ error: 'ingredients array required.' });
  const productId = Number(req.params.id);
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM productingredient WHERE productid = $1`, [productId]);
    for (const ing of ingredients) {
      await client.query(
        `INSERT INTO productingredient (productid, inventoryid, amountused) VALUES ($1, $2, $3)`,
        [productId, Number(ing.inventoryId), Number(ing.amountUsed)]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// ─── Employee CRUD ────────────────────────────────────────────────────────────

app.get('/api/employees', requireMgrRoute, async (_req, res) => {
  try {
    if (hasDbConfig()) {
      const r = await queryDb(`SELECT cashierid, firstname, lastname, hiredate, hoursworked, is_active, pin FROM cashier ORDER BY lastname, firstname`);
      return res.json({ cashiers: r.rows });
    }
    const cashiers = parseCsv(path.join(dataDir,'cashier.csv')).map(r => ({ cashierid:r.cashierid, firstname:r.firstname, lastname:r.lastname, hiredate:r.hiredate, hoursworked:r.hoursworked, is_active:r.is_active==='true', pin:r.pin }));
    res.json({ cashiers });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/managers', requireMgrRoute, async (_req, res) => {
  try {
    if (hasDbConfig()) {
      const r = await queryDb(`SELECT managerid, firstname, lastname, hiredate, is_active FROM manager ORDER BY lastname, firstname`);
      return res.json({ managers: r.rows });
    }
    const managers = parseCsv(path.join(dataDir,'manager.csv')).map(r => ({ managerid:r.managerid, firstname:r.firstname, lastname:r.lastname, hiredate:r.hiredate, is_active:r.is_active==='true' }));
    res.json({ managers });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/employees', requireMgrRoute, async (req, res) => {
  if (!hasDbConfig()) return res.status(503).json({ error: 'Database required.' });
  const { firstName, lastName, hireDate, pin } = req.body || {};
  if (!firstName || !lastName || !hireDate) return res.status(400).json({ error: 'firstName, lastName, hireDate required.' });
  try {
    const r = await queryDb(`INSERT INTO cashier (firstname, lastname, hiredate, pin, hoursworked, is_active) VALUES ($1,$2,$3,$4,0,true) RETURNING cashierid`, [firstName, lastName, hireDate, pin || '1234']);
    res.status(201).json({ id: r.rows[0].cashierid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/employees/:id', requireMgrRoute, async (req, res) => {
  if (!hasDbConfig()) return res.status(503).json({ error: 'Database required.' });
  const { firstName, lastName, hireDate, pin } = req.body || {};
  try {
    await queryDb(`UPDATE cashier SET firstname=$1, lastname=$2, hiredate=$3, pin=$4 WHERE cashierid=$5`, [firstName, lastName, hireDate, pin || '1234', Number(req.params.id)]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/employees/:id/toggle', requireMgrRoute, async (req, res) => {
  if (!hasDbConfig()) return res.status(503).json({ error: 'Database required.' });
  try {
    await queryDb(`UPDATE cashier SET is_active=$1 WHERE cashierid=$2`, [Boolean(req.body.active), Number(req.params.id)]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/weather-stats', (_req, res) => {
  res.json({
    totalRequests: weatherCallCount,
    externalCalls: externalWeatherCalls,
    cacheSize: weatherCache.size
  });
});

// ─── In-memory clock tracker (login time per cashier/manager) ────────────────
const clockedIn = new Map(); // staffId_type -> { name, role, loginTime }

// POST /api/cashier/pin-login
app.post('/api/cashier/pin-login', async (req, res) => {
  if (!hasDbConfig()) return res.status(503).json({ error: 'Database required.' });
  const { pin } = req.body || {};
  if (!pin) return res.status(400).json({ error: 'PIN required.' });
  try {
    const cr = await queryDb(`SELECT cashierid, firstname, lastname, is_active, pin FROM cashier WHERE pin=$1 AND is_active=true`, [String(pin)]);
    if (cr.rows.length > 0) {
      const c = cr.rows[0];
      const key = `${c.cashierid}_cashier`;
      clockedIn.set(key, { staffId: c.cashierid, staffType: 'cashier', name: `${c.firstname} ${c.lastname}`, loginTime: new Date().toISOString() });
      await queryDb(`INSERT INTO staff_login_log (staff_id, staff_type, action) VALUES ($1,'cashier','login')`, [c.cashierid]).catch(()=>{});
      return res.json({ ok: true, role: 'cashier', cashierId: c.cashierid, name: `${c.firstname} ${c.lastname}` });
    }
    const mr = await queryDb(`SELECT managerid, firstname, lastname, is_active, pin FROM manager WHERE pin=$1 AND is_active=true`, [String(pin)]);
    if (mr.rows.length > 0) {
      const m = mr.rows[0];
      const key = `${m.managerid}_manager`;
      clockedIn.set(key, { staffId: m.managerid, staffType: 'manager', name: `${m.firstname} ${m.lastname}`, loginTime: new Date().toISOString() });
      await queryDb(`INSERT INTO staff_login_log (staff_id, staff_type, action) VALUES ($1,'manager','login')`, [m.managerid]).catch(()=>{});
      return res.json({ ok: true, role: 'manager', cashierId: m.managerid, name: `${m.firstname} ${m.lastname}` });
    }
    return res.status(401).json({ error: 'Invalid PIN. Ask a manager if you need help.' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/cashier/pin-logout
app.post('/api/cashier/pin-logout', async (req, res) => {
  const { cashierId, staffType = 'cashier' } = req.body || {};
  const key = `${cashierId}_${staffType}`;
  const session = clockedIn.get(key);
  if (session && hasDbConfig()) {
    // Calculate hours worked this session and add to total
    const mins = (Date.now() - new Date(session.loginTime).getTime()) / 60000;
    const hrs  = mins / 60;
    if (hrs > 0.01 && staffType === 'cashier') {
      await queryDb(`UPDATE cashier SET hoursworked = hoursworked + $1 WHERE cashierid = $2`, [Number(hrs.toFixed(4)), Number(cashierId)]).catch(()=>{});
    }
    await queryDb(`INSERT INTO staff_login_log (staff_id, staff_type, action) VALUES ($1,$2,'logout')`, [cashierId, staffType]).catch(()=>{});
  }
  clockedIn.delete(key);
  res.json({ ok: true });
});

// GET /api/currently-working
app.get('/api/currently-working', async (req, res) => {
  if (!req.isAuthenticated?.() || req.user?.role !== 'manager') return res.status(403).json({ error: 'Manager only.' });
  const working = Array.from(clockedIn.values()).map(s => ({
    ...s,
    minutesWorked: Math.floor((Date.now() - new Date(s.loginTime).getTime()) / 60000)
  }));
  res.json({ working });
});

// POST /api/staff-requests
app.post('/api/staff-requests', async (req, res) => {
  if (!hasDbConfig()) return res.status(503).json({ error: 'Database required.' });
  const { name, email, requestedRole = 'cashier' } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'Name and email required.' });
  try {
    await queryDb(
      `INSERT INTO staff_requests (name, email, requested_role, status, created_at)
       VALUES ($1,$2,$3,'pending',NOW())
       ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name, status='pending', created_at=NOW()`,
      [name, email, requestedRole]
    );
    res.status(201).json({ ok: true, message: 'Request submitted. A manager will set up your PIN.' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/staff-requests
app.get('/api/staff-requests', async (req, res) => {
  if (!req.isAuthenticated?.() || req.user?.role !== 'manager') return res.status(403).json({ error: 'Manager only.' });
  if (!hasDbConfig()) return res.json({ requests: [] });
  try {
    const r = await queryDb(`SELECT * FROM staff_requests WHERE status='pending' ORDER BY created_at DESC`);
    res.json({ requests: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/staff-requests/:id/approve
app.post('/api/staff-requests/:id/approve', async (req, res) => {
  if (!req.isAuthenticated?.() || req.user?.role !== 'manager') return res.status(403).json({ error: 'Manager only.' });
  if (!hasDbConfig()) return res.status(503).json({ error: 'Database required.' });
  const { assignRole = 'cashier', pin } = req.body || {};
  if (!pin) return res.status(400).json({ error: 'PIN required.' });
  try {
    const rr = await queryDb(`SELECT * FROM staff_requests WHERE request_id=$1`, [Number(req.params.id)]);
    const request = rr.rows[0];
    if (!request) return res.status(404).json({ error: 'Request not found.' });
    const today = new Date().toISOString().slice(0,10);
    const parts = request.name.trim().split(' ');
    const first = parts[0] || request.name;
    const last  = parts.slice(1).join(' ') || '';
    if (assignRole === 'manager') {
      await queryDb(`INSERT INTO manager (firstname,lastname,hiredate,pin,is_active) VALUES ($1,$2,$3,$4,true)`, [first, last, today, pin]);
    } else {
      await queryDb(`INSERT INTO cashier (firstname,lastname,hiredate,pin,hoursworked,is_active) VALUES ($1,$2,$3,$4,0,true)`, [first, last, today, pin]);
    }
    await queryDb(`UPDATE staff_requests SET status='approved' WHERE request_id=$1`, [Number(req.params.id)]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/staff-requests/:id/deny
app.post('/api/staff-requests/:id/deny', async (req, res) => {
  if (!req.isAuthenticated?.() || req.user?.role !== 'manager') return res.status(403).json({ error: 'Manager only.' });
  if (!hasDbConfig()) return res.json({ ok: true });
  try {
    await queryDb(`UPDATE staff_requests SET status='denied' WHERE request_id=$1`, [Number(req.params.id)]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/staff-log
app.get('/api/staff-log', async (req, res) => {
  if (!req.isAuthenticated?.() || req.user?.role !== 'manager') return res.status(403).json({ error: 'Manager only.' });
  if (!hasDbConfig()) return res.json({ log: [] });
  try {
    const r = await queryDb(`
      SELECT sl.log_id, sl.staff_id, sl.staff_type, sl.action,
             to_char(sl.logged_at AT TIME ZONE 'America/Chicago',
                     'Mon DD, YYYY HH12:MI AM') AS logged_at_str,
             (sl.logged_at AT TIME ZONE 'America/Chicago') AS logged_at,
             CASE sl.staff_type
               WHEN 'cashier' THEN c.firstname || ' ' || c.lastname
               WHEN 'manager' THEN m.firstname || ' ' || m.lastname
               ELSE 'Unknown'
             END AS staff_name
      FROM staff_login_log sl
      LEFT JOIN cashier c ON sl.staff_type='cashier' AND c.cashierid=sl.staff_id
      LEFT JOIN manager m ON sl.staff_type='manager' AND m.managerid=sl.staff_id
      ORDER BY sl.logged_at DESC LIMIT 200`);
    res.json({ log: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname,'public','index.html')));

// ── Seed missing toppings into DB on startup ──────────────────────────────────
const REQUIRED_TOPPINGS = [
  { name: 'Extra Boba Add-on', price: 0.75 },
  { name: 'Grass Jelly',       price: 0.75 },
  { name: 'Egg Pudding',       price: 0.75 },
  { name: 'Coconut Jelly',     price: 0.75 },
];

async function seedToppings() {
  if (!hasDbConfig()) return;
  try {
    const existing = await queryDb(`SELECT name FROM product WHERE category='topping'`);
    const existingNames = new Set(existing.rows.map(r => r.name.trim().toLowerCase()));
    for (const tp of REQUIRED_TOPPINGS) {
      if (!existingNames.has(tp.name.toLowerCase())) {
        await queryDb(
          `INSERT INTO product (name, category, baseprice, is_active) VALUES ($1, 'topping', $2, true)`,
          [tp.name, tp.price]
        );
        console.log(`Seeded missing topping: ${tp.name}`);
      }
    }
  } catch (e) {
    console.warn('Could not seed toppings:', e.message);
  }
}

async function seedRewards() {
  if (!hasDbConfig()) return;
  try {
    const REWARDS = [
      { label: '$1 Off Your Order',  reward_type: 'flat_off',     reward_value: 1,    points_cost: 100 },
      { label: 'Free Topping',       reward_type: 'free_topping', reward_value: 0.75, points_cost: 150 },
      { label: '10% Off Your Order', reward_type: 'percent_off',  reward_value: 10,   points_cost: 200 },
      { label: '50% Off One Drink',  reward_type: 'percent_off',  reward_value: 50,   points_cost: 300 },
      { label: '$3 Off Your Order',  reward_type: 'flat_off',     reward_value: 3,    points_cost: 400 },
      { label: 'Free Small Drink',   reward_type: 'free_drink',   reward_value: 0,    points_cost: 500 },
      { label: 'Free Medium Drink',  reward_type: 'free_drink',   reward_value: 0,    points_cost: 700 },
      { label: 'Free Large Drink',   reward_type: 'free_drink',   reward_value: 0,    points_cost: 1000 },
    ];
    const existing = await queryDb('SELECT label FROM rewards_catalog');
    const existingLabels = new Set(existing.rows.map(r => r.label));
    for (const r of REWARDS) {
      if (!existingLabels.has(r.label)) {
        await queryDb(
          'INSERT INTO rewards_catalog (label,reward_type,reward_value,points_cost,is_active) VALUES ($1,$2,$3,$4,true)',
          [r.label, r.reward_type, r.reward_value, r.points_cost]);
        console.log('Seeded reward:', r.label);
      }
    }
  } catch(e) { console.warn('Could not seed rewards:', e.message); }
}

(async () => {
  await seedToppings();
  await seedRewards();
  if (hasDbConfig()) {
    try {
      await queryDb('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id VARCHAR(255)');
      await queryDb('ALTER TABLE transactionitem ADD COLUMN IF NOT EXISTS selections JSONB');
      await queryDb('ALTER TABLE product ADD COLUMN IF NOT EXISTS image_url TEXT');
    } catch(e) { console.warn('Migration warning:', e.message); }
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`Project 3 Team 25 running on port ${PORT}`));
})();
