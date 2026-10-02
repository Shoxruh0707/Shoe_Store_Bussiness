# Admin Shoe Store Backend API

Backend-only inventory service built with Node.js, Express, and MySQL. Client applications belong in separate projects and communicate with this service through HTTPS JSON APIs.

## Architecture

- `server.js`: REST API, session authentication, authorization, inventory and sales rules, and upload handling.
- `src/db.js`: MySQL connection pool.
- `src/db/migrations/`: canonical schema and versioned migration code.
- `scripts/migrate.js`: explicit migration status/apply command.
- `public/uploads/`: persistent product media served from `/uploads`.
- `docker-compose.yml`: MySQL, one-shot migrator, backend, and Caddy HTTPS proxy.

Application startup checks migration readiness and fails before listening when schema work is pending. It never changes the schema automatically.

## Local setup

Requirements: Node.js 22+ and MySQL 8+.

```powershell
npm.cmd ci
Copy-Item .env.example .env
```

Edit `.env` with local credentials. Configure the separate `MIGRATION_DB_*` values, then initialize or upgrade the selected database:

```powershell
npm.cmd run db:status
npm.cmd run db:migrate
npm.cmd run db:status
npm.cmd start
```

The API listens on `http://127.0.0.1:3000` by default. `GET /api/health` checks database connectivity.

## Authentication

`POST /api/auth/login` accepts JSON:

```json
{"phoneNumber":"+998901234567","password":"your-password"}
```

The backend verifies the existing bcrypt password hash and returns the user and active store. A successful response sets a signed, HTTP-only `session` cookie. Send that cookie on protected API requests. Invalid users and passwords share one generic `401` response. `GET /api/auth/me` reads the session and `POST /api/auth/signout` clears it.

Production requires authentication, a minimum 32-byte non-placeholder `SESSION_SECRET`, an HTTPS `PUBLIC_URL`, and secure cookies. Users need an active `store_users` membership for store-scoped inventory endpoints.

## API surface

### Swagger / interactive API documentation

Set these values in `.env`, then restart the backend (`npm.cmd start` locally,
or recreate the backend with Docker Compose):

```dotenv
SWAGGER_ENABLED=true
SWAGGER_USERNAME=your-docs-username
SWAGGER_PASSWORD=your-docs-password
```

Open [Swagger UI](http://127.0.0.1:3000/api/docs/) and enter those credentials
in the browser's login prompt. The same credentials protect `/api/openapi.json`
and the Swagger UI assets. They grant documentation access only.

To test protected endpoints, expand `POST /api/auth/login`, click **Try it out**,
enter an existing application's `phoneNumber` and `password`, and click **Execute**.
Then execute `GET /api/auth/me` or another endpoint. Swagger runs on the API's
origin, so the browser automatically sends the HTTP-only session cookie; no
manual cookie entry in **Authorize** is needed. Store permissions still apply.
Use `POST /api/auth/signout` to end the application session.

Swagger is disabled by default. Enabling it without both documentation credentials
fails startup. Credentials stay on the server and are not embedded in the spec or UI.
In production use the HTTPS domain's `/api/docs/` URL. Docker Compose forwards the
same settings, and the existing Caddy `/api/*` proxy includes the documentation.
**Try it out executes real requests against the connected database.**

All application operations use `/api`; unknown routes return JSON 404 responses.

- `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/signout`
- `GET /api/health`, `GET /api/meta`
- `GET|PUT /api/store`
- `GET|POST /api/products`
- `GET|PUT|DELETE /api/products/:id`
- product matching, price, pair inventory, box stock, stock-addition, sales, and sale-cancellation routes under `/api`
- temporary product media under `/api/uploads/temp`; persisted media under `/uploads`

The implementation enforces role and store scope on every protected operation. Landing cost visibility is restricted to owners and managers.

## Tests

```powershell
npm.cmd test
docker compose -f docker-compose.test.yml up -d --wait
$env:TEST_DB_HOST="127.0.0.1"
$env:TEST_DB_PORT="3307"
$env:TEST_DB_USER="root"
$env:TEST_DB_PASSWORD="isolated-test-only"
$env:TEST_DB_NAME="shoe_migration_test_local"
npm.cmd run test:integration
docker compose -f docker-compose.test.yml down
```

Integration tests create randomly suffixed disposable databases and drop only databases they created. They never fall back to application database credentials.

## Docker deployment

```bash
cp .env.production.example .env
# Replace every placeholder, then:
docker compose config --quiet
docker compose up -d mysql
docker compose run --rm --build migrate
docker compose up -d --build --remove-orphans
```

Caddy publishes ports 80 and 443 and proxies `/api/*` plus `/uploads/*` to the backend. MySQL and the backend remain on the private Compose network. Named volumes preserve `mysql_data`, `uploads`, `caddy_data`, and `caddy_config` across container replacement.

See [database migration operations](docs/backend-migration-operations.md) and [server deployment](docs/digitalocean-deployment.md) before a production rollout.
