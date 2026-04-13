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

const googleCallbackUrl =
  process.env.GOOGLE_CALLBACK_URL ||
  'https://project3-team25-m13k.onrender.com/auth/google/callback';

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
  milk_tea: 'Creamy tea-based drink with optional toppings and sweetness customization.',
  tea: 'Refreshing brewed tea with a lighter flavor profile.',
  fruit_tea: 'Fruity green tea served cold with vibrant flavors.',
  coffee: 'Coffee-forward milk tea blend for stronger energy and flavor.'
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

async function getMenuItems() {
  if (hasDbConfig()) {
    const r = await queryDb(`SELECT productid AS id, name, category, baseprice AS price FROM product WHERE is_active=true ORDER BY category,name`);
    return r.rows.map(i => ({ id: Number(i.id), name: i.name, category: i.category, price: Number(i.price), popular: [2,4,9,10,14].includes(Number(i.id)), description: DESCRIPTIONS[i.category] || 'Bubble tea menu item.' }));
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
const SPIN_PRIZES = [
  { label:'50% Off One Drink', type:'percent_off', value:50, weight:20 },
  { label:'Free Topping', type:'free_topping', value:0, weight:30 },
  { label:'$1 Off Your Order', type:'flat_off', value:1, weight:25 },
  { label:'Free Small Drink', type:'free_drink', value:0, weight:10 },
  { label:'Buy One Get One', type:'percent_off', value:50, weight:5 },
  { label:'25% Off Order', type:'percent_off', value:25, weight:10 }
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
  if (t.includes('sweet')||t.includes('sugar')) return 'Choose 0%, 25%, 50%, 75%, or 100% sweetness. Fruit teas are great at 50–75%.';
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
  passport.authenticate('google', { scope: ['profile','email'] })(req, res, next);
});

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/?loginError=1' }),
  (req, res) => {
    const role = req.user?.role;
    if (role === 'manager') return res.redirect('/');
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

app.get('/api/menu', async (_req, res) => {
  try { const items = await getMenuItems(); res.json({ items, categories: categoryBreakdown(items), source: hasDbConfig()?'database':'csv' }); }
  catch(e) { res.status(500).json({ error: 'Failed to load menu.', details: e.message }); }
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
    const { items, paymentMethod = 'card', cashierId = 1, promoCode = null, rewardId = null } = body;
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
        const txr = await client.query(`INSERT INTO transactions (cashierid,transactiontime,totalamount,paymentmethod,status) VALUES ($1,NOW(),$2,$3,'completed') RETURNING transactionid,transactiontime,totalamount,paymentmethod,status`, [cashierId, totalAmount, String(paymentMethod).toLowerCase()]);
        const tx = txr.rows[0];
        for (const item of normalized) { await client.query(`INSERT INTO transactionitem (transactionid,productid,quantity,unitprice) VALUES ($1,$2,$3,$4)`, [tx.transactionid, item.productId, item.quantity, item.unitPrice]); }

        let pointsEarned = 0, newBalance = 0;
        if (userId) {
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
  if (!apiKey) return res.json({ source:'local-fallback', reply: ruleBasedAssistant(message) });
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`}, body: JSON.stringify({ model: process.env.OPENAI_MODEL||'gpt-4o-mini', messages:[{role:'system',content:'You are a concise bubble tea kiosk assistant. Help users with ordering, menu choices, customization, allergens, rewards, promos, and store guidance.'},{role:'user',content:String(message||'')}], temperature:0.5, max_tokens:180 }) });
    if (!response.ok) throw new Error(`OpenAI ${response.status}`);
    const data = await response.json();
    res.json({ source:'openai', reply: data.choices?.[0]?.message?.content?.trim() || ruleBasedAssistant(message) });
  } catch(e) { res.json({ source:'local-fallback', reply: ruleBasedAssistant(message) }); }
});

app.get('/api/weather', async (req, res) => {
  const city = String(req.query.city || 'College Station').trim();

  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
    );
    const geoData = await geoRes.json();
    const place = geoData.results?.[0];

    if (!place) {
      return res.status(404).json({ error: 'Location not found.' });
    }

    const forecastRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`
    );
    const forecastData = await forecastRes.json();
    const current = forecastData.current || {};

    const weatherLabel = getWeatherLabel(current.weather_code);
    const drinkSuggestion = getDrinkSuggestion(
      current.temperature_2m,
      current.weather_code
    );

    res.json({
      city: `${place.name}${place.admin1 ? ', ' + place.admin1 : ''}`,
      temperature: current.temperature_2m ?? null,
      feelsLike: current.apparent_temperature ?? null,
      windSpeed: current.wind_speed_10m ?? null,
      weatherCode: current.weather_code ?? null,
      weatherLabel,
      isDay: current.is_day ?? 1,
      drinkSuggestion
    });
  } catch (e) {
    res.status(500).json({
      error: 'Weather unavailable.',
      details: e.message
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
    return 'Rainy day — cozy milk teas and warm flavors are a great pick.';
  }

  if (t >= 85) {
    return 'Hot day — suggest fruit teas, lighter drinks, and extra ice.';
  }

  if (t >= 72) {
    return 'Nice weather — fruit teas and classic milk teas both fit well.';
  }

  return 'Cooler weather — milk teas and richer flavors are a great pick.';
}

app.get('/api/translate', async (req, res) => {
  const text = String(req.query.text||'').trim();
  const target = String(req.query.target||'es').trim();
  if (!text) return res.status(400).json({ error:'Text required.' });
  try {
    const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${encodeURIComponent(target)}`);
    const d = await r.json();
    const tt = d.responseData?.translatedText;
    if (!tt) return res.status(502).json({ error:'Translation failed.' });
    res.json({ translatedText:tt, target });
  } catch(e) { res.status(500).json({ error:'Translation unavailable.' }); }
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

app.get('/cashier.html', requireStaff, (_req, res) => res.sendFile(path.join(__dirname,'public','cashier.html')));
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
      SELECT transactiontime::date AS day,
             COALESCE(SUM(totalamount),0) AS revenue, COUNT(*) AS orders
      FROM transactions WHERE status='completed'
      GROUP BY 1 ORDER BY revenue DESC LIMIT 10`);
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
          AND DATE(transactiontime AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = CURRENT_DATE AT TIME ZONE 'America/Chicago'
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

app.get('/api/analytics/best-of-worst', requireMgrRoute, async (_req, res) => {
  if (!hasDbConfig()) return res.json({ rows: [] });
  try {
    const r = await queryDb(`
      WITH daily AS (
        SELECT date_trunc('week',t.transactiontime)::date AS week_start,
               t.transactiontime::date AS day,
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
      SELECT week_start,
             MAX(CASE WHEN rn_low=1 THEN day END) AS worst_revenue_day,
             MAX(CASE WHEN rn_low=1 THEN day_revenue END) AS worst_day_revenue,
             MAX(CASE WHEN rn_high=1 THEN day END) AS best_items_day,
             MAX(CASE WHEN rn_high=1 THEN items_sold END) AS best_day_items_sold
      FROM ranked GROUP BY week_start ORDER BY week_start DESC LIMIT 12`);
    res.json({ rows: r.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── Menu CRUD ────────────────────────────────────────────────────────────────

app.get('/api/menu-all', requireMgrRoute, async (_req, res) => {
  try {
    if (hasDbConfig()) {
      const r = await queryDb(`SELECT productid AS id, name, category, baseprice AS price, is_active FROM product ORDER BY category, name`);
      return res.json({ items: r.rows.map(i => ({ ...i, id: Number(i.id), price: Number(i.price) })) });
    }
    const items = parseCsv(path.join(dataDir,'product.csv')).map(i => ({ id:Number(i.productid), name:i.name, category:i.category, price:Number(i.baseprice), is_active:i.is_active==='true' }));
    res.json({ items });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/menu-item', requireMgrRoute, async (req, res) => {
  if (!hasDbConfig()) return res.status(503).json({ error: 'Database required for menu edits.' });
  const { name, category, basePrice } = req.body || {};
  if (!name || !category || isNaN(Number(basePrice))) return res.status(400).json({ error: 'name, category, basePrice required.' });
  try {
    const r = await queryDb(`INSERT INTO product (name, category, baseprice, is_active) VALUES ($1,$2,$3,true) RETURNING productid AS id`, [name, category, Number(basePrice)]);
    res.status(201).json({ id: r.rows[0].id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/menu-item/:id', requireMgrRoute, async (req, res) => {
  if (!hasDbConfig()) return res.status(503).json({ error: 'Database required.' });
  const { name, category, basePrice } = req.body || {};
  try {
    await queryDb(`UPDATE product SET name=$1, category=$2, baseprice=$3 WHERE productid=$4`, [name, category, Number(basePrice), Number(req.params.id)]);
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
    await queryDb(`UPDATE product SET is_active=false WHERE productid=$1`, [Number(req.params.id)]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
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


app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT, '0.0.0.0', () => console.log(`Project 3 Team 25 running on port ${PORT}`));
