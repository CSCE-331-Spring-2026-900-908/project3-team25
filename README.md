# Project 3 Team 25

This is the Team 25 Project 3 web app for CSCE 331.

## What this version includes
- Centralized portal page
- Customer kiosk, cashier POS, manager dashboard, and menu board
- Google OAuth authentication (Sign in with Google)
- Role-based access control
   * Customer (public access)
   * Cashier (TAMU emails)
   * Manager (authorized emails)
- Protected routes for cashier and manager interfaces
- CSV fallback mode for menu and inventory
- PostgreSQL-ready backend using `pg`
- Real checkout route that inserts into `transactions` and `transactionitem` when DB environment variables are configured
- Weather, translation, and assistant starter routes

## Local setup
1. Create `.env` in the project root using `.env.example`.
2. Add your Google OAuth values to `.env` and to your Render environment variables.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the app:
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
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SESSION_SECRET`
- `MANAGER_EMAILS`
- `GOOGLE_CALLBACK_URL` (recommended on Render)

Optional:
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `GOOGLE_CLIENT_ID`

## Render
Use a **Web Service** with:
- Build command: `npm install`
- Start command: `npm start`

In Render, add these environment variables:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SESSION_SECRET`
- `MANAGER_EMAILS`
- `GOOGLE_CALLBACK_URL=https://your-service-name.onrender.com/auth/google/callback`

In Google Cloud Console, add the same deployed callback URL under **Authorized redirect URIs** and add your site root under **Authorized JavaScript origins**.

## Notes
- If DB credentials are missing, the app stays usable in CSV fallback mode.
