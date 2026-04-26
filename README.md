# Project 3 — Team 25 (CSCE 331)

Reveille Bubble Tea — a full-stack point-of-sale and kiosk web app.

---

## What This App Includes

### Customer Kiosk
- Full drink menu with category tabs (Coffee, Fruit Tea, Milk Tea, Seasonal, Smoothie, Tea, Topping)
- Customize each drink: sweetness, ice level, size, topping
- **"What's Inside"** panel showing real ingredients from the database
- Reward points system — earn 10 pts per dollar spent
- Spin-the-wheel daily reward (auto-applies prize — no code needed)
- Redeem points for free drinks, toppings, and discounts
- QR code sign-in — scan with phone → Google sign-in → kiosk auto-logs in
- Weather-based drink suggestions
- Live activity ticker showing real-time order buzz
- **AI assistant** (OpenAI GPT-4o-mini) for menu help and recommendations
- Full multilingual support: English, Spanish, Chinese, Arabic, Vietnamese (via Lara Translation API)
- Voice guide reads all screen content including dropdown options aloud

### Cashier POS
- Touch-screen optimized product grid
- Category filter tabs
- Cart management with quantity adjustments
- Checkout with cash / card / dining payment options

### Manager Dashboard
- Overview with revenue, order counts, active items, inventory alerts
- Sales charts (hourly, weekly, daily trends)
- Menu Editor — add/edit items with inline ingredient editor that opens immediately
- Inventory tracking — quantities update automatically after every sale
- Low-stock watchlist sorted by tightest margin
- Employee management and access request approval
- Login log with correct CST timestamps
- Reports: X-report, best/worst sellers

### Menu Board
- Auto-rotating digital display

---

## Local Setup

```bash
cp .env.example .env   # fill in your values
npm install
npm start
```

Visit `http://localhost:3000`

---

## Environment Variables

Set in `.env` locally and in **Render → Environment** for production.

### Required
| Key | Description |
|---|---|
| `DB_HOST` | PostgreSQL host |
| `DB_PORT` | PostgreSQL port (usually 5432) |
| `DB_NAME` | Database name |
| `DB_USER` | Database user |
| `DB_PASSWORD` | Database password |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | e.g. `https://yourapp.onrender.com/auth/google/callback` |
| `SESSION_SECRET` | Random secret string |
| `MANAGER_EMAILS` | Comma-separated manager emails |

### Optional
| Key | Description |
|---|---|
| `OPENAI_API_KEY` | Enables AI assistant on kiosk |
| `OPENAI_MODEL` | Default: `gpt-4o-mini` |
| `LARA_ACCESS_KEY_ID` | Lara Translation API key ID |
| `LARA_ACCESS_KEY_SECRET` | Lara Translation API secret |

> If DB credentials are missing, the app uses CSV fallback mode from `/data/`.

---

## Render Deployment

- **Build command:** `npm install`
- **Start command:** `npm start`
- **Branch:** `main`

---

## Database

```bash
# Add new drinks and remove test items
psql $DATABASE_URL -f queries/new_drinks_and_cleanup.sql
```

---

## Pages

| URL | Who |
|---|---|
| `/` | Portal |
| `/customer.html` | Customer kiosk (public) |
| `/cashier.html` | Cashier (requires login) |
| `/manager.html` | Manager (requires manager role) |
| `/menu-board.html` | Digital menu board |

---

## Tech Stack

Node.js · Express · PostgreSQL · Passport.js (Google OAuth) · Lara Translation API · OpenAI · Vanilla JS · Render

---

## Team 25 — CSCE 331 Spring 2026
