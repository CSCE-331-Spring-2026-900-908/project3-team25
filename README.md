# Project 3 Team 25

This is the Team 25 Project 3 web app for CSCE 331.

## What this version includes
- Centralized portal page
- Customer kiosk, cashier POS, manager dashboard, and menu board
- CSV fallback mode for menu and inventory
- PostgreSQL-ready backend using `pg`
- Real checkout route that inserts into `transactions` and `transactionitem` when DB environment variables are configured
- Weather, translation, and assistant starter routes

## Local setup
1. Create `.env` in the project root using `.env.example`.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the app:
   ```bash
   npm start
   ```

## Environment variables
Set these locally in `.env` and in Render environment variables:
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

Optional:
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `GOOGLE_CLIENT_ID`

## Render
Use a **Web Service** with:
- Build command: `npm install`
- Start command: `npm start`

## Notes
- If DB credentials are missing, the app stays usable in CSV fallback mode.
- For final submission, replace mock login with real OAuth and decide whether to deduct inventory after checkout.
