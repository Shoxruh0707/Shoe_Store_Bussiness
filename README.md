# Admin Shoe Store Inventory

Inventory web app for managing shoe products, stock, Telegram authentication, and store ownership backed by MySQL.

## What This Project Runs

- Backend: Node.js + Express
- Database: MySQL 8+
- Frontend: Next.js app in `frontend/`
- Authentication: Telegram Bot + Telegram Mini App
- Public tunnel: optional ngrok on port `3000`

## Start Backend

1. Install dependencies once:

   ```powershell
   npm install
   ```

2. Make sure `.env` exists and has your local values.

3. Start the backend:

   ```powershell
   npm start
   ```

4. Start the frontend in a second terminal:

   ```powershell
   npm run frontend:dev
   ```

5. Start the Telegram bot in another terminal when you need Telegram auth:

   ```powershell
   npm run bot
   ```

5. Open the app from Telegram by pressing the bot's `📦 Open Inventory` button.

For local Telegram testing, expose the frontend with HTTPS and set `TELEGRAM_WEBAPP_URL` to the public `/inventory` URL. The frontend proxies `/api` requests to the backend.

```powershell
E:\AdminShoeStore\tools\ngrok\ngrok.exe http 3001 --log=stdout
```

The Mini App URL should look like:

```text
https://your-ngrok-domain.ngrok-free.app/inventory
```

## Development Mode

Use watch mode when you want the server to restart automatically after file edits:

```powershell
npm run dev
```

Run the redesigned frontend separately:

```powershell
npm run frontend:dev
```

## Docker Deployment

The project includes a production Docker setup for a DigitalOcean Droplet:

- `Dockerfile` builds the Express backend, Telegram bot, and Next.js frontend.
- `docker-compose.yml` runs MySQL, backend, frontend, bot, and Caddy HTTPS proxy.
- `.env.production.example` contains the required production environment values.

On the Droplet:

```bash
cp .env.production.example .env
nano .env
docker compose up -d --build
```

See `docs/digitalocean-deployment.md` for the full deployment checklist.

To use a different domain, point that domain's DNS to the server and change only
`DOMAIN` in the production `.env` file. The app derives its public URL, backend
redirects, CORS origin, Telegram Mini App URL, and Caddy HTTPS certificate from
that value by default.

## Full Stack With Logs

To start or restart the backend, frontend, Telegram bot, and ngrok together, run:

```powershell
npm run stack:restart
```

All runtime logs from that command are saved in `logs/`:

- `logs/backend.log`
- `logs/backend.err.log`
- `logs/frontend.log`
- `logs/frontend.err.log`
- `logs/bot.log`
- `logs/bot.err.log`
- `logs/ngrok.log`
- `logs/ngrok.err.log`

## Restart Backend

If you changed backend code or `.env`, restart the process.

Basic restart:

1. Stop the current Node process.
2. Start it again with:

   ```powershell
   npm start
   ```

If port `3000` is busy, find the Node process and stop it:

```powershell
netstat -ano | findstr :3000
taskkill /PID <PID_FROM_NETSTAT> /F
```

Then start the server again:

```powershell
npm start
```

## Restart After Config Change

When you change `.env`, you must restart the backend because `dotenv` is loaded at process start.

Typical flow:

```powershell
taskkill /PID <PID_FROM_NETSTAT> /F
npm start
```

## Telegram Authentication

Traditional website sign-in and signup pages have been removed. Users start in the Telegram bot, complete onboarding there, and open `/inventory` as a Telegram Mini App.

The bot collects:

- first name
- last name
- phone number through Telegram's native contact share button
- account type: Seller or Store Owner
- store name, phone, and description for Store Owner accounts

## ngrok

The project has been used with ngrok to expose the local backend.

Run ngrok against the frontend app port:

```powershell
E:\AdminShoeStore\tools\ngrok\ngrok.exe http 3001 --log=stdout
```

ngrok local inspector:

```text
http://127.0.0.1:4040
```

The public forwarding URL changes each time ngrok starts unless you are using a reserved domain in your ngrok account.

## Environment Variables

Recommended `.env` values:

```env
PORT=3000
FRONTEND_URL=http://localhost:3001
PUBLIC_URL=http://localhost:3001

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=shoes_store_db

SESSION_SECRET=replace_with_a_long_random_value

TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBAPP_URL=https://your-public-domain.example/inventory
TELEGRAM_AUTH_MAX_AGE_SECONDS=86400
TELEGRAM_POLL_TIMEOUT_SECONDS=25

API_AUTH_REQUIRED=true
CORS_ORIGINS=http://localhost:3001,http://127.0.0.1:3001
NEXT_ALLOWED_DEV_ORIGINS=

DEFAULT_STORE_ID=1
DEFAULT_STORE_NAME=Default Store
DEFAULT_OWNER_PHONE=+998000000001

DEFAULT_BRAND_NAME=Unbranded

REMBG_ENABLED=true
REMBG_PYTHON=.venv\Scripts\python.exe
REMBG_SCRIPT=scripts\remove_background.py
REMBG_TIMEOUT_MS=300000
```

Notes:

- `TELEGRAM_BOT_TOKEN` is used to verify Mini App `initData`; never commit it.
- `TELEGRAM_WEBAPP_URL` must point to the HTTPS `/inventory` URL configured for the bot.
- `PUBLIC_URL`/`FRONTEND_URL` is where the backend redirects page requests.
- `DOMAIN` in production is the hostname Caddy serves with HTTPS. Change it to
  deploy the same project under another domain without code changes.
- `API_AUTH_REQUIRED=false` is useful only for local frontend testing without Telegram auth.
- `SESSION_SECRET` signs the internal app session cookie created after Telegram verification.
- `DEFAULT_STORE_ID` is used by the legacy/default product flow.
- `DEFAULT_BRAND_NAME` is used because the current product form does not ask for brand.
- `REMBG_PYTHON` and `REMBG_SCRIPT` point the backend to the Python environment
  and script used for background removal. On direct Ubuntu installs, use
  `.venv/bin/python` and `scripts/remove_background.py`; Docker uses `/app/...`
  paths inside the container.

## Database Setup

For a new database, import the schema from `shoes_store_database_ddl.sql` into MySQL 8+.

For an existing database, run:

```sql
migrations/2026_07_01_add_telegram_auth_to_users.sql
migrations/2026_07_05_add_product_landing_price.sql
```

Expected tables include:

- `users`
- `store`
- `store_users`
- `seller_store_requests`
- `brands`
- `materials`
- `shoe_type`
- `colours`
- `products`
- `product_seasons`
- `product_variant`
- `product_images`
- `inventory`
- `box_stock`
- `sold_products_pair`
- `sold_products_box`

## Backend Routes

Page routes are served by the Next.js frontend on port `3001`. The Express backend redirects `/` and `/inventory` to `PUBLIC_URL`/`FRONTEND_URL`.

Useful API endpoints:

- `GET /api/health`
- `GET /api/meta`
- `GET /api/auth/me`
- `POST /api/auth/signout`
- `POST /api/telegram/auth`
- `GET /api/products`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`

## Common Troubleshooting

If `/inventory` says to open from Telegram, use the bot's `📦 Open Inventory` button. A normal browser does not provide Telegram Mini App `initData`.

If the app says the database is unavailable:

- confirm MySQL is running
- confirm the `.env` database values are correct
- confirm `shoes_store_db` exists

If port `3000` is already in use:

- stop the old Node process
- or change `PORT` in `.env`

## Notes

- Password login is no longer used for new access; retained password hashes are only for migration compatibility.
- Admin/store-owner inventory is scoped by `store_id`.
- Store owner onboarding creates a store automatically. Seller accounts need a store relationship before inventory access can be granted safely.
