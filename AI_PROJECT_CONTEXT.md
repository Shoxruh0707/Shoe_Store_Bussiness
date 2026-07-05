# AI Project Context: Admin Shoe Store

This project is a small Node.js/Express + MySQL inventory web app for shoe stores. The UI language is mostly Uzbek. It supports user sign in/sign up, store-owner registration, and a store-owner inventory dashboard where admins add, edit, search, and delete stock by article number, color, material, season, size, price, and images.

## Tech Stack

- Backend: Node.js with Express 4.
- Database: MySQL 8+ using `mysql2/promise`.
- Frontend: static HTML/CSS/vanilla JavaScript served from `public/`.
- Auth: custom signed HTTP-only cookie named `session`.
- Password hashing: custom PBKDF2 format `p2$<salt>$<hash>`.
- File uploads: frontend converts images to base64 data URLs; backend writes files into `public/uploads/`.

## Main Files

- `server.js`: main Express app, routing, auth, validation, image saving, product/inventory CRUD, and DB helper logic.
- `src/db.js`: MySQL pool and connection test.
- `public/index.html`: store-owner inventory page.
- `public/app.js`: inventory dashboard behavior.
- `public/signin.html` and `public/signin.js`: login page.
- `public/signup.html` and `public/signup.js`: account registration page.
- `public/signup-store.html` and `public/signup-store.js`: second step for store-owner signup.
- `public/customer.html`: placeholder customer page.
- `public/styles.css`: shared styling.
- `shoes_store_database_ddl.sql`: schema setup.
- `shoes_store_database_ddl copy.sql`: duplicate schema copy.
- `README.md`: run/setup notes.

## How To Run

Install dependencies:

```powershell
npm install
```

Start the app:

```powershell
npm start
```

Development mode:

```powershell
npm run dev
```

Default URL:

```text
http://localhost:3000
```

The app expects a `.env` with values like `PORT`, `SIGNUP_ENABLED`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `SESSION_SECRET`, `DEFAULT_STORE_ID`, `DEFAULT_STORE_NAME`, `DEFAULT_OWNER_PHONE`, and `DEFAULT_BRAND_NAME`. Do not expose real `.env` secrets in generated docs or responses.

## User Roles And Routing

Roles in DB enum: `customer`, `seller`, `store_owner`, `admin`.

The app mostly treats `store_owner` and `admin` as admin/store-owner users. In signup, choosing "Admin" sends role `store_owner`.

Important page routes:

- `GET /`: redirects to `/inventory` if signed in, otherwise `/signin`.
- `GET /signin`: shows login unless already signed in.
- `GET /signup`: shows signup only when `SIGNUP_ENABLED=true`.
- `GET /signup/store`: shows store registration step only when signup is enabled.
- `GET /customer`: placeholder customer page.
- `GET /inventory`: protected by session redirect only at page level; API calls enforce real auth.

## Auth Flow

Auth uses a custom signed cookie:

1. `POST /api/auth/signin` validates phone and password.
2. Passwords must be stored in the backend's PBKDF2 format beginning with `p2$`.
3. On success, `setSessionCookie()` writes a signed cookie containing user id, role, and issued time.
4. `requireAuth` reads the cookie, validates HMAC signature, loads the user from DB, and attaches `request.user`.
5. If user is `store_owner` or `admin`, `requireAuth` also loads their active store into `request.store`.

Important auth endpoints:

- `GET /api/auth/me`
- `POST /api/auth/signin`
- `POST /api/auth/signout`
- `POST /api/auth/signup`

Signup behavior:

- Customer signup creates only a `users` row.
- Store-owner signup is two-step in the frontend. `signup.js` stores account fields in `sessionStorage` under `pendingStoreSignup`, then `signup-store.js` submits account + store fields together.
- Store-owner signup creates both `users` and `store` in a transaction.
- Store image is optional and saved via the same image upload helper.

## Product/Inventory Model

The intended schema:

- `users`: accounts.
- `store`: store profile linked to owner user.
- `brands`, `materials`, `shoe_type`, `colours`: lookup tables.
- `products`: art number, name, brand, shoe type, prices, timestamps.
- `product_seasons`: one product can have multiple seasons.
- `product_variant`: variant per product/color/material.
- `product_images`: image paths per variant.
- `inventory`: store-specific quantity and price per variant and size.
- `orders`, `order_items`, `payment_details`, `delivery`: order-related tables exist in schema but are not used by current backend/frontend.

Admin inventory APIs require both authentication and store-owner/admin role with an active store:

- `GET /api/meta`: shoe types, seasons, sizes, existing colors/materials.
- `GET /api/products`: list products with aggregated store inventory.
- `GET /api/products/match?artNo=&colour=&material=`: find an existing matching product/variant.
- `GET /api/products/:id`: fetch one product with inventory rows and images.
- `POST /api/products`: add product or add stock to existing matching product.
- `PUT /api/products/:id`: update product/variant/seasons/inventory and append images.
- `DELETE /api/products/:id`: deletes inventory rows for the current store only; it does not delete the product row globally.

## Inventory UI Behavior

`public/app.js` owns the dashboard state. It loads auth/session first, then `/api/health`, `/api/meta`, and `/api/products`.

Key UI behavior:

- Inventory page shows a searchable product table.
- The add/edit form opens in a right-side drawer.
- Product fields include art number, color, material, type, sale price, landing price, optional name, optional images, seasons, and size quantities.
- Sizes are fixed: `33` through `44`.
- Seasons are client labels `Summer`, `Autumn`, `Winter`, `Spring`, mapped to DB enum values `summer`, `autumn`, `winter`, `spring`.
- Images can come from file input or the device camera through `navigator.mediaDevices.getUserMedia`.
- Money inputs are displayed with dot thousand separators but sent as digits.
- When adding a product, if art number + color + material matches an existing variant, details are disabled and the user only adds new size quantities. Backend then increments inventory instead of creating a duplicate variant.
- Clicking a table row opens edit mode.

## Backend Data Rules

Hard-coded product metadata in `server.js`:

- Shoe types: `Basanochka`, `Tapochka`, `Tufli`, `Makasima`, `Skechers`, `Etik`, `Krasovka`, `Baletka`.
- Seasons: `Summer`, `Autumn`, `Winter`, `Spring`.
- Sizes: `33` to `44`.
- Default brand comes from `DEFAULT_BRAND_NAME`, defaulting to `Unbranded`.

Product validation requires:

- `artNo`
- valid shoe type
- at least one valid season
- non-negative `price`
- non-negative `landingPrice`
- `colour`
- `material`

Image validation:

- Allowed MIME types: JPEG, PNG, WEBP, GIF.
- Each decoded image must be 5 MB or smaller.
- Stored under `public/uploads/<timestamp>-<uuid>.<ext>`.

## Important Known Issues / Mismatches

1. The backend uses `products.landing_price`, but both SQL files currently define `products` without a `landing_price` column. This will cause DB errors on product create/list/fetch/update unless the schema is fixed. Add something like:

   ```sql
   ALTER TABLE products
     ADD COLUMN landing_price DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER type_id,
     ADD CONSTRAINT chk_products_landing_price CHECK (landing_price >= 0);
   ```

   Or update the DDL directly before importing the schema.

2. `users.password_hash` is `VARCHAR(60)`, but the PBKDF2 hash format generated by the app is longer than 60 characters (`p2$` + 16 hex salt + `$` + 40 hex hash = about 60 exactly today). If iterations/hash length changes, this may need more room. A safer schema would use `VARCHAR(255)`.

3. `DEFAULT_OWNER_PASSWORD_HASH` fallback looks like a bcrypt placeholder, but `verifyPassword()` only accepts hashes beginning with `p2$`. The default owner created by `ensureDefaultStore()` may not be login-capable unless a valid PBKDF2 hash is supplied.

4. `SESSION_SECRET` is not required by code; if missing, it falls back to `change-this-session-secret`. Production/local shared use should set a real secret.

5. The frontend has some mojibake characters in `public/index.html` camera buttons (`âœ“`, `Ã—`), likely intended to be checkmark and multiplication/close icons.

6. `DELETE /api/products/:id` removes only current-store inventory rows. It leaves product, variant, image, and lookup records. That is intentional for store-scoped inventory, but the UI text says product deleted.

7. The order/payment/delivery schema exists, but there is no implemented customer shopping/order flow yet. `customer.html` is only a placeholder.

8. Telegram username checking calls `https://t.me/<username>` from the backend using `fetch` and marks results as best-effort/non-reliable. It is not a real Telegram API verification.

## Security Notes

- SQL queries use parameterized `execute()` for user data in normal paths.
- Session cookies are `HttpOnly`, `SameSite=Lax`, and path `/`, but not `Secure`.
- Image uploads are accepted as base64 JSON, decoded, type checked by declared MIME type, and size checked. There is no magic-byte validation.
- `.env` contains sensitive values and should not be committed or pasted into external prompts.

## Suggested Next Work

- Fix the schema/backend mismatch for `landing_price`.
- Add `SESSION_SECRET` to `.env`.
- Add migration or seed data for initial store/admin and lookup values.
- Add automated tests for auth, product create/update/delete, and schema compatibility.
- Decide whether delete should remove only inventory or the full product when no stores reference it.
- Build the real customer catalog/order flow if this app is meant to sell, not only manage inventory.
