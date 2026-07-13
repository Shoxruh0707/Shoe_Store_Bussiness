# Admin Shoe Store Inventory

Inventory web app for managing shoe products, stock, Telegram authentication, and store ownership backed by PostgreSQL.

## What This Project Runs

- Backend: Node.js + Express
- Database: PostgreSQL 16+
- Frontend: Next.js app in `frontend/`
- Image processing: Python + rembg/ONNX in `image-processor/`
- Authentication: Telegram Bot + Telegram Mini App
- Public tunnel: optional ngrok on port `3000`

## Docker Start

1. Copy the Docker environment template:

   ```powershell
   Copy-Item .env.docker.example .env.docker
   ```

2. Edit `.env.docker` and set `DB_PASSWORD`, `SESSION_SECRET`, and Telegram values.

3. Build and start the app with PostgreSQL:

   ```powershell
   docker compose up --build
   ```

   The first build downloads and caches the `u2net` segmentation model. New
   product photos are processed locally and saved as transparent PNG files;
   no external image API or API key is used.

4. Start the Telegram bot profile when needed:

   ```powershell
   docker compose --profile bot up --build
   ```

## DigitalOcean Production

The production stack includes PostgreSQL, backend, frontend, Telegram bot,
image processor, and Caddy with automatic HTTPS. Copy the production environment
template, configure a domain and secrets, then start it with:

```bash
cp .env.production.example .env.production
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

See [docs/digitalocean-deployment.md](docs/digitalocean-deployment.md) for the
Droplet, DNS, firewall, backup, update, and troubleshooting instructions.

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

DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=shoes_store_app
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

DEFAULT_STORE_ID=1
DEFAULT_STORE_NAME=Default Store
DEFAULT_OWNER_PHONE=+998000000001

DEFAULT_BRAND_NAME=Unbranded

BACKGROUND_REMOVAL_URL=http://127.0.0.1:7000
BACKGROUND_REMOVAL_REQUIRED=false
BACKGROUND_REMOVAL_TIMEOUT_MS=120000
```

Notes:

- `TELEGRAM_BOT_TOKEN` is used to verify Mini App `initData`; never commit it.
- `TELEGRAM_WEBAPP_URL` must point to the HTTPS `/inventory` URL configured for the bot.
- `FRONTEND_URL` is where the backend redirects page requests.
- `API_AUTH_REQUIRED=false` is useful only for local frontend testing without Telegram auth.
- `SESSION_SECRET` signs the internal app session cookie created after Telegram verification.
- `DEFAULT_STORE_ID` is used by the legacy/default product flow.
- `DEFAULT_BRAND_NAME` is used because the current product form does not ask for brand.
- `BACKGROUND_REMOVAL_URL` enables automatic shoe extraction during image upload.
- `BACKGROUND_REMOVAL_REQUIRED=true` rejects an upload if processing fails. When
  false, the backend logs the error and keeps the original image.

## Product Image Background Removal

Docker Compose enables background removal automatically. The browser uploads a
JPG, PNG, WEBP, or GIF image (maximum 5 MB), the Node backend sends its bytes to
the private Python service, and `rembg` extracts the foreground with the local
`u2net` model. The backend stores the result as a transparent PNG and returns it
for the product-form preview.

For manual, non-Docker development, use Python 3.11-3.13 and start the processor
before the Node backend:

```powershell
python -m venv image-processor\.venv
image-processor\.venv\Scripts\pip.exe install -r image-processor\requirements.txt
image-processor\.venv\Scripts\python.exe image-processor\app.py
```

Set `BACKGROUND_REMOVAL_URL=http://127.0.0.1:7000` in `.env`. The model is
downloaded on the first local start and cached in the user's `.u2net` directory.

## Database Setup

For Docker, PostgreSQL imports `docker/postgres/init/01-schema.sql` automatically when the database volume is created.

For a manual PostgreSQL database, import the schema from `shoes_store_database_ddl.sql`.

For an existing database, run:

```sql
migrations/2026_07_01_add_telegram_auth_to_users.sql
migrations/2026_07_05_add_product_landing_price.sql
```

Expected tables include:

- `users`
- `store`
- `brands`
- `materials`
- `shoe_type`
- `colours`
- `products`
- `product_seasons`
- `product_variant`
- `product_images`
- `inventory`
- `orders`
- `order_items`
- `payment_details`
- `delivery`

## Backend Routes

Page routes are served by the Next.js frontend on port `3001`. The Express backend redirects `/` and `/inventory` to `FRONTEND_URL`.

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

- confirm PostgreSQL is running
- confirm the `.env` database values are correct
- confirm `shoes_store_db` exists

If port `3000` is already in use:

- stop the old Node process
- or change `PORT` in `.env`

## Notes

- Password login is no longer used for new access; retained password hashes are only for migration compatibility.
- Admin/store-owner inventory is scoped by `store_id`.
- Store owner onboarding creates a store automatically. Seller accounts need a store relationship before inventory access can be granted safely.
