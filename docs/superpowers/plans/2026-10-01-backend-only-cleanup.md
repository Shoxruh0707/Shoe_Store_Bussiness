# Backend-Only Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the repository into a Docker-deployable Node.js REST API and persistent MySQL database, with all Android, web frontend, Telegram, and phone-test implementation removed.

**Architecture:** The root CommonJS Express service remains the single backend. It exposes JSON routes under `/api`, serves product media under `/uploads`, authenticates existing users through a backend phone/password session endpoint, and starts only after explicit migrations are current. Docker Compose runs a one-shot migrator, MySQL 8.4, the API, and Caddy for HTTPS.

**Tech Stack:** Node.js 22, Express 4, mysql2, bcryptjs, MySQL 8.4, `node:test`, Docker Compose, Caddy 2.

**Spec:** `docs/superpowers/specs/2026-10-01-backend-only-deployment-design.md`

## Global Constraints

- Preserve existing database data and use migrations; do not run schema DDL during application startup.
- Keep API business logic, authorization, uploads, migrations, readiness checks, and database-backed tests.
- Remove Android, Next.js, Telegram, duplicate backend scaffold, and local phone-test implementation.
- Production must require authentication, HTTPS configuration, a strong session secret, and an explicit migration step.
- The future mobile application lives in a separate repository and reaches this backend only through HTTPS API requests.

## Review Focus

- Invalid phone/password credentials return a generic 401 response without revealing whether a user exists.
- A valid password for a user without store membership creates a session but store-protected routes still return 403.
- Non-API and unknown paths return JSON 404 rather than HTML or redirects.
- Pending or checksum-mismatched migrations prevent API startup before the listener opens.
- Docker recreations preserve MySQL and uploads through named volumes.

---

### Task 1: Replace Telegram authentication with backend credentials

**Files:**
- Create: `src/auth/password.js`
- Create: `test/unit/password-auth.test.js`
- Modify: `server.js`
- Modify: `src/config.js`
- Modify: `test/unit/config.test.js`
- Modify: `test/unit/app-lifecycle.test.js`
- Modify: `test/support/inventory-app.js`
- Modify: `test/integration/contracts.test.js`
- Modify: `package.json`
- Modify: `package-lock.json`
- Delete: `src/auth/telegram.js`
- Delete: `test/unit/telegram-auth.test.js`
- Delete: `src/telegramChannelPublisher.js`

**Interfaces:**
- Consumes: existing `users.phone_number`, `users.password_hash`, signed session codec, `store_users` membership, and Express error helpers.
- Produces: `verifyPassword(password, passwordHash) -> Promise<boolean>` and `POST /api/auth/login` accepting `{ phoneNumber, password }`, setting the existing signed HTTP-only session cookie, and returning `{ user, store }`.

- [ ] **Step 1: Write failing password and HTTP authentication tests**

Add tests named `password verification accepts bcrypt and rejects malformed hashes`, `login returns a generic 401 for unknown phone and wrong password`, `login establishes an authenticated session`, and `authenticated user without membership cannot access store data`. Assert no credential or hash appears in responses or logs.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `node --test test/unit/password-auth.test.js test/integration/contracts.test.js`

Expected: FAIL because `src/auth/password.js` and `/api/auth/login` do not exist.

- [ ] **Step 3: Implement password verification and the login route**

Use `bcryptjs.compare` for existing 60-character bcrypt hashes. Normalize the phone exactly once, query by phone, perform one generic failure path, hydrate store membership with existing helpers, and issue the existing signed HTTP-only cookie. Remove `X-Telegram-Init-Data` authentication, `/api/telegram/auth`, Telegram publication calls, Telegram configuration, and local phone-test mode.

- [ ] **Step 4: Make API routing JSON-only**

Remove `/` and `/inventory` redirects, frontend URL derivation, page-path normalization, and browser CORS defaults. Add a JSON 404 after API/upload routes. Keep explicit configured CORS origins for external clients that need them.

- [ ] **Step 5: Run authentication, contract, lifecycle, and configuration tests**

Run: `npm.cmd test && node --test test/integration/contracts.test.js`

Expected: all tests PASS, with invalid credentials returning 401, unauthorized requests returning 401, and non-API paths returning JSON 404.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json server.js src/auth src/config.js test
git commit -m "feat: expose backend-only session authentication"
```

### Task 2: Reduce deployment to API, migrator, MySQL, and Caddy

**Files:**
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `docker/caddy/Caddyfile`
- Modify: `.env.example`
- Modify: `.env.production.example`
- Modify: `scripts/deploy-digitalocean.sh`
- Modify: `scripts/start-stack.ps1`
- Modify: `test/unit/app-lifecycle.test.js`

**Interfaces:**
- Consumes: `npm start`, `node scripts/migrate.js apply`, `/api/health`, `/api/*`, and `/uploads/*`.
- Produces: Compose services `mysql`, `migrate`, `backend`, and `caddy`; named volumes `mysql_data`, `uploads`, `caddy_data`, and `caddy_config`.

- [ ] **Step 1: Add deployment configuration assertions**

Add a test that reads `Dockerfile`, `docker-compose.yml`, and the Caddyfile and asserts that frontend/bot stages and services are absent, the migrator gates backend startup, MySQL and uploads use named volumes, and Caddy proxies only `/api/*` and `/uploads/*` to `backend:3000`.

- [ ] **Step 2: Run the assertion and verify failure**

Run: `node --test test/unit/app-lifecycle.test.js`

Expected: FAIL because frontend and bot targets/services remain.

- [ ] **Step 3: Simplify Docker and Compose**

Keep one production API image stage. Remove frontend and bot stages/services. Retain MySQL health checks, the one-shot migrator, backend readiness, non-root execution, restricted private networking, log rotation, and named persistent volumes. Change Caddy's fallback response to JSON 404 rather than proxying a frontend.

- [ ] **Step 4: Align runtime environment and scripts**

Remove all frontend, Telegram, phone-test, and ngrok variables. Keep database credentials, migration credentials, session secret, public HTTPS URL, CORS origins, catalog defaults, domain, and ACME email. Make `scripts/start-stack.ps1` start only the local API.

- [ ] **Step 5: Validate deployment configuration**

Run: `docker compose --env-file .env.production.example config --quiet`

Expected: exit 0 with four services and no frontend or bot references.

- [ ] **Step 6: Build the production image**

Run: `docker build --target backend -t admin-shoe-store-backend:test .`

Expected: exit 0 and a Node 22 backend image.

- [ ] **Step 7: Commit**

```bash
git add Dockerfile docker-compose.yml docker/caddy/Caddyfile .env.example .env.production.example scripts test/unit/app-lifecycle.test.js
git commit -m "build: deploy api and mysql only"
```

### Task 3: Remove client projects and obsolete runtime files

**Files:**
- Delete: `android-app/`
- Delete: `artifacts/`
- Delete: `frontend/`
- Delete: `backend-api/`
- Delete: `src/telegramBot.js`
- Delete: `src/telegramChannelBot.js`
- Delete: `src/storeTelegramColumns.js`
- Delete: `scripts/start-phone-test.ps1`
- Delete: `scripts/stop-phone-test.ps1`
- Delete: `tools/`
- Delete: `HOW_TO_RUN_PROJECT.txt`
- Delete: `prompts.txt`
- Delete: stray activation-command file at repository root
- Modify: `.gitignore`
- Modify: `package.json`

**Interfaces:**
- Consumes: the API-only runtime and deployment configuration completed by Tasks 1 and 2.
- Produces: a repository file tree containing only backend source, tests, database assets, Docker assets, scripts, and relevant documentation.

- [ ] **Step 1: Remove client and obsolete runtime paths**

Delete the listed directories/files with literal-path operations after verifying every resolved target is inside `E:\AdminShoeStore`. Remove obsolete npm scripts and ignore entries.

- [ ] **Step 2: Verify the runtime dependency graph**

Run: `rg -n "android-app|frontend/|telegramBot|telegramChannel|phone-test|ngrok|backend-api" --glob '!docs/superpowers/specs/2026-10-01-backend-only-deployment-design.md' --glob '!docs/superpowers/plans/2026-10-01-backend-only-cleanup.md'`

Expected: no runtime/configuration matches.

- [ ] **Step 3: Run syntax and unit tests**

Run: `node --check server.js && npm.cmd test`

Expected: exit 0 and all unit tests PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove client and telegram projects"
```

### Task 4: Consolidate schema and backend documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/backend-migration-operations.md`
- Modify: `docs/digitalocean-deployment.md`
- Modify: `AI_PROJECT_CONTEXT.md`
- Delete: `docs/android-local-testing.md`
- Delete: `docs/android-migration-assessment.md`
- Delete: `docs/android-migration-changelog.md`
- Delete: `docs/android-migration-execution.md`
- Delete: `docs/telegram-mini-app-migration.md`
- Delete: `docs/superpowers/specs/2026-09-30-android-migration-design.md`
- Delete: `docs/superpowers/plans/2026-09-30-backend-safety-foundation.md`
- Delete: `docs/superpowers/plans/2026-09-30-migration-roadmap.md`
- Modify or delete: `shoes_store_database_ddl.sql`

**Interfaces:**
- Consumes: final API endpoints, authentication contract, migration commands, Docker service names, environment variables, and persistent volume names.
- Produces: one backend README, one migration runbook, one server deployment runbook, and one canonical schema source.

- [ ] **Step 1: Compare schema copies**

Run: `git diff --no-index -- shoes_store_database_ddl.sql src/db/migrations/0001-current-inventory.sql`

Expected: identify whether the root schema is a byte-equivalent duplicate. Remove it if redundant; otherwise document it as a fresh-install snapshot generated from the canonical migration.

- [ ] **Step 2: Rewrite backend documentation**

Document API-only architecture, local Node/MySQL commands, login/session behavior, migration status/apply commands, unit and integration tests, Docker Compose deployment, persistent volumes, HTTPS/Caddy, backup requirements, and rollback behavior. Remove all Android, frontend, Telegram, and phone-testing instructions.

- [ ] **Step 3: Scan documentation scope**

Run: `rg -n -i "android|apk|next\.js|frontend|telegram|mini app|phone test|ngrok" README.md AI_PROJECT_CONTEXT.md docs .env.example .env.production.example package.json Dockerfile docker-compose.yml scripts src`

Expected: no matches except database column names retained for backward-compatible stored data, if any.

- [ ] **Step 4: Commit**

```bash
git add -A README.md AI_PROJECT_CONTEXT.md docs shoes_store_database_ddl.sql src/db/migrations
git commit -m "docs: describe backend-only deployment"
```

### Task 5: Full backend and deployment verification

**Files:**
- Modify as failures require: backend source, tests, or deployment documentation from Tasks 1–4.

**Interfaces:**
- Consumes: final repository from Tasks 1–4.
- Produces: verification evidence and a clean backend-only deliverable.

- [ ] **Step 1: Run static and unit verification**

Run: `node --check server.js`, syntax-check every `src/**/*.js` and `scripts/*.js`, `npm.cmd test`, and `git diff --check`.

Expected: all commands exit 0.

- [ ] **Step 2: Run isolated MySQL integration tests**

Run: `docker compose -f docker-compose.test.yml up -d --wait`, then `npm.cmd run test:integration`, then `docker compose -f docker-compose.test.yml down`.

Expected: all integration tests PASS against MySQL 8.4 and the disposable database is removed.

- [ ] **Step 3: Verify production containers**

Run: `docker compose --env-file .env.production.example config --quiet` and `docker build --target backend -t admin-shoe-store-backend:test .`.

Expected: both exit 0.

- [ ] **Step 4: Audit final scope and secrets**

Run repository searches for removed platforms, tracked `.env` files, private keys, access tokens, password values, APK/build artifacts, and duplicate backend scaffolds.

Expected: no client runtime, generated artifacts, or secrets; only documented safe placeholders and legacy database column names where intentionally retained.

- [ ] **Step 5: Record final state**

Run: `git status --short` and `git log -6 --oneline`.

Expected: only intentional pre-existing user changes remain uncommitted; implementation commits are present and the summary can identify tests, limitations, and deployment steps.
