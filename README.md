# Project 3 Team 25 Starter Build

This is a runnable Project 3 starter package built from your existing Project 2 repository.

## What was added

- Centralized **portal page** that links one-way to all required interfaces
- **Manager interface** for back-office analytics and inventory alerts
- **Cashier interface** with touch-friendly ordering flow
- **Customer kiosk** with simplified public-facing layout
- **Menu board** for large non-interactive display
- Starter backend routes for:
  - mock authentication
  - weather forecast
  - machine translation
  - personal assistant chatbot

## Tech stack in this starter

- Node.js
- Express
- HTML/CSS/JavaScript
- Existing CSV data reused from Project 2

## Run locally

```bash
npm install
npm start
```

Then open:

```text
http://localhost:3000
```

## Deployment note

This app is ready to deploy to Render as a Node web service.

Suggested Render settings:

- Build command: `npm install`
- Start command: `npm start`

## Important remaining work

This starter is a strong beginning, but a few things still need to be completed by your team before final submission:

1. Replace mock login with real Google OAuth.
2. Connect order flow to the PostgreSQL backend.
3. Add your chosen beyond-feature(s).
4. Refine the UI with your team’s final theme and branding.
5. Reconnect any manager and cashier actions to live database writes.

## Existing project files retained

Your original GUI, SQL, data, and scripts folders were kept in the repository so you can continue using them as references.
