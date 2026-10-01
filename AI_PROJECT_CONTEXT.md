# Project context: Admin Shoe Store Backend

This repository contains only the server-side inventory system. Client applications are maintained separately and use the HTTPS REST API.

## Runtime

- Node.js 22, CommonJS, Express 4
- MySQL 8.4 through `mysql2/promise`
- Signed HTTP-only session cookie after phone/password login
- bcrypt password hashes stored in `users.password_hash`
- Product media stored in the persistent `public/uploads` path
- Docker Compose services: `mysql`, `migrate`, `backend`, `caddy`

## Important files

- `server.js`: API routes, validation, authorization, inventory and sales logic
- `src/config.js`: isolated environment validation and production guards
- `src/runtime.js`: database/readiness/listener lifecycle
- `src/auth/`: password verification and signed session codec
- `src/db/`: migration runner, readiness inspection, and canonical migrations
- `src/http/errors.js`: safe API error responses
- `test/`: unit and isolated MySQL integration suites
- `docs/backend-migration-operations.md`: migration, backup, and rollback procedure
- `docs/digitalocean-deployment.md`: Docker server deployment

## Invariants

- Clients never access MySQL directly.
- Production authentication cannot be disabled.
- Every protected resource is scoped through the authenticated user's active store membership.
- Store staff cannot read landing cost.
- Startup never applies schema changes; it refuses to listen when migrations are not ready.
- Migration tests use explicit `TEST_DB_*` credentials and disposable randomly suffixed schemas.
- Unexpected errors never expose SQL, credentials, stack traces, or raw exception messages.
- Database and uploaded media must be backed up and restore-tested before production migration.

## Commands

```text
npm start
npm test
npm run test:integration
npm run db:status
npm run db:migrate
docker compose up -d --build
```

The canonical schema lives under `src/db/migrations/`; do not create another root schema copy.
