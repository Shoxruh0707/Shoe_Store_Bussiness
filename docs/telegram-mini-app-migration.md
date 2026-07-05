# Telegram Mini App Migration

## File-by-file implementation plan

- `migrations/2026_07_01_add_telegram_auth_to_users.sql`: apply this once to add Telegram identity columns while keeping existing users, stores, phone numbers, and password hashes.
- `server.js`: serves `/inventory`, verifies Telegram WebApp `initData`, creates the internal signed app session, and protects inventory APIs with Telegram-backed authentication.
- `src/telegramBot.js`: runs the Telegram bot, shows the Mini App button, collects first name, last name, phone contact, account type, and store details for store owners.
- `public/index.html`: loads Telegram's WebApp JavaScript before the inventory app script.
- `public/app.js`: reads `window.Telegram.WebApp.initData`, authenticates with `/api/telegram/auth`, and then keeps the existing product and inventory CRUD flow.
- `.env.example`: documents required Telegram configuration.
- `package.json`: adds `npm run bot`.

## Required environment

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBAPP_URL=https://your-public-domain.example/inventory
```

`TELEGRAM_WEBAPP_URL` must be HTTPS for production Telegram Mini Apps. For local testing, expose the app with a tunnel such as ngrok and use the HTTPS forwarding URL.

## Step-by-step migration guide

1. Back up the current MySQL database.
2. Apply `migrations/2026_07_01_add_telegram_auth_to_users.sql`.
3. Put Telegram bot values in `.env`.
4. Configure the bot in BotFather with the Mini App/web app URL.
5. Start the web app with `npm start`.
6. Start the bot with `npm run bot`.
7. Open the bot, send `/start`, complete onboarding, and press `📦 Open Inventory`.
8. Verify that product CRUD, inventory CRUD, uploads, search, and stock management still happen inside the web app.

## Security review

- The backend verifies Telegram `initData` using the official HMAC check derived from `TELEGRAM_BOT_TOKEN`.
- `auth_date` is checked with `TELEGRAM_AUTH_MAX_AGE_SECONDS` to reduce replay risk.
- Secrets are read from `.env`; no bot token is hardcoded.
- The bot accepts phone numbers through Telegram contact sharing and rejects contacts whose `contact.user_id` does not match the sender.
- Password login and signup endpoints are removed from Express.
- Existing `phone_number` and `password_hash` columns remain for migration compatibility, but new Telegram users receive `password_hash = NULL`.
- Inventory APIs remain server-protected and scoped to the authenticated user's active store.

## Operational note

The current schema has `store.owner_id`, but no separate seller-to-store assignment table. Store owners can use inventory immediately after onboarding because the bot creates their store. Seller accounts can authenticate, but they need a store relationship before inventory access can be granted safely.
