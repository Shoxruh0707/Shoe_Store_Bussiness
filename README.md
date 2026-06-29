# Admin Shoe Store Inventory

Inventory web app for managing shoe products, stock, auth, and store ownership backed by MySQL.

## What This Project Runs

- Backend: Node.js + Express
- Database: MySQL 8+
- Frontend: Static pages served from `public/`
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

4. Open the app:

   ```text
   http://localhost:3000
   ```

## Development Mode

Use watch mode when you want the server to restart automatically after file edits:

```powershell
npm run dev
```

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

## Sign In and Sign Up

- Sign in page: `/signin`
- Sign up page: `/signup`
- Admin store signup page: `/signup/store`

Signup is controlled by:

```env
SIGNUP_ENABLED=true
```

Set it to `false` to disable registration.

## ngrok

The project has been used with ngrok to expose the local backend.

Run ngrok against the app port:

```powershell
E:\AdminShoeStore\tools\ngrok\ngrok.exe http 3000 --log=stdout
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
SIGNUP_ENABLED=true

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=shoes_store_db

SESSION_SECRET=replace_with_a_long_random_value

DEFAULT_STORE_ID=1
DEFAULT_STORE_NAME=Default Store
DEFAULT_OWNER_PHONE=+998000000001

DEFAULT_BRAND_NAME=Unbranded
```

Notes:

- `SIGNUP_ENABLED` controls whether signup is available.
- `SESSION_SECRET` signs the session cookie.
- `DEFAULT_STORE_ID` is used by the legacy/default product flow.
- `DEFAULT_BRAND_NAME` is used because the current product form does not ask for brand.

## Database Setup

Import the schema from `shoes_store_database_ddl.sql` into MySQL 8+.

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

Useful pages:

- `/`
- `/signin`
- `/signup`
- `/signup/store`
- `/customer`
- `/inventory`

Useful API endpoints:

- `GET /api/health`
- `GET /api/meta`
- `GET /api/auth/me`
- `POST /api/auth/signin`
- `POST /api/auth/signout`
- `POST /api/auth/signup`
- `GET /api/products`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`

## Common Troubleshooting

If you see `ENOENT` for `auth.html`, the app is probably still running an old Node process. Stop the old process and start the current code again.

If the app says the database is unavailable:

- confirm MySQL is running
- confirm the `.env` database values are correct
- confirm `shoes_store_db` exists

If port `3000` is already in use:

- stop the old Node process
- or change `PORT` in `.env`

## Notes

- Passwords are stored hashed, not in plain text.
- Admin/store-owner inventory is scoped by `store_id`.
- Telegram username checking is best-effort and not a guaranteed Telegram API validation.
