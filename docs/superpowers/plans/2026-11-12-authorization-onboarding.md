# Authorization and Store Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add verified registration, recoverable and revocable authentication, single-store onboarding, and hierarchical store membership APIs to the deployable backend.

**Architecture:** Keep the existing Express/MySQL and signed-cookie architecture, add database-backed challenges/rate limits and a session version, and inject a provider-neutral mailer into the app factory. Store roles come exclusively from the caller's one membership; transactional membership services enforce hierarchy and exclusivity.

**Tech Stack:** Node.js 22, CommonJS, Express 4, MySQL 8.4, `mysql2/promise`, `bcryptjs`, Nodemailer SMTP, Node test runner, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-11-12-authorization-onboarding-design.md`

## Global Constraints

- Backend only; do not create or modify frontend code.
- Preserve existing inventory data and unrelated working-tree changes.
- Migrations run explicitly; application startup never mutates schema.
- Six-digit codes expire after 10 minutes, resend after 60 seconds, and lock after five failed attempts.
- Each account has at most one store membership; owners cannot be removed or demoted.
- Password reset invalidates every session and never reveals whether an email exists.
- Store permissions come from `store_users.role`, not global `users.role`.
- Tests must observe a relevant failure before production implementation is added.

## Review Focus

- Concurrent verification/accept/approve requests must create at most one user or membership; Task 4 and Task 6 integration tests use parallel requests.
- Email and phone normalization must prevent case/format aliases without changing valid international numbers; Task 3 unit and integration tests pin normalization.
- Resend and reset endpoints must not leak account existence or code values through bodies/logs; Task 4 and Task 5 tests compare responses and captured logs.
- A manager must never create or administer another manager, including by stale invitation/request identifiers; Task 6 tests every hierarchy boundary.
- A user who gains another membership between initiation and completion must be rejected transactionally; Task 6 race-state tests pin the recheck.

---

### Task 1: Migration and canonical schema

**Files:**
- Create: `src/db/migrations/0003-authorization-onboarding.js`
- Modify: `src/db/migrations/index.js`
- Modify: `src/db/migrations/0001-current-inventory.sql`
- Test: `test/integration/authorization-migration.test.js`
- Test: `test/integration/schema-upgrade.test.js`

**Interfaces:**
- Produces: MySQL columns/tables/indexes required by later auth and membership tasks; migration id `0003-authorization-onboarding`.

- [ ] Write integration tests that apply all migrations to a new schema, upgrade a legacy fixture, preserve existing users/stores, allow nullable legacy email, enforce unique normalized email and one `store_users` row per user, and fail with `MEMBERSHIP_RECONCILIATION_REQUIRED` when legacy duplicates exist.
- [ ] Run `node --test test/integration/authorization-migration.test.js test/integration/schema-upgrade.test.js` and verify the new assertions fail because migration 0003 is absent.
- [ ] Implement idempotent migration 0003 and update the canonical baseline schema with user email/session version, auth challenge/reset/rate-limit tables, store owner/entry-code/social fields, invitation/request audit fields, and required constraints.
- [ ] Register the migration checksum in `src/db/migrations/index.js`.
- [ ] Re-run the two integration tests and verify they pass.
- [ ] Run `npm test` and `npm run test:integration` and record results in `docs/AUTHORIZATION_PROGRESS.md`.

### Task 2: Configuration, secrets, and SMTP adapter

**Files:**
- Create: `src/auth/code-digest.js`
- Create: `src/email/smtp-mailer.js`
- Modify: `src/config.js`
- Modify: `.env.example`
- Modify: `.env.production.example`
- Modify: `docker-compose.yml`
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `test/unit/auth-config.test.js`
- Test: `test/unit/code-digest.test.js`
- Test: `test/unit/smtp-mailer.test.js`

**Interfaces:**
- Produces: `createCodeDigest({ secret, namespace, subject, code })`, `safeEqualDigest(left, right)`, and `createSmtpMailer(config)` exposing `sendVerification({ to, code, purpose, expiresInMinutes })`.

- [ ] Write failing unit tests for deterministic namespace-separated HMAC digests, constant-time comparison behavior, production secret validation, disabled-mail safe failure, and SMTP message construction without secret logging.
- [ ] Run the three unit test files and verify failures are caused by missing modules/configuration.
- [ ] Add Nodemailer and implement the digest helper, injectable SMTP adapter, and validated `OTP_SECRET`, `EMAIL_DELIVERY_MODE`, `EMAIL_FROM`, `SMTP_*` configuration.
- [ ] Pass configuration through Docker Compose and document placeholders only in environment examples.
- [ ] Re-run the focused tests and `npm test`; update progress.

### Task 3: Validation and database-backed challenge service

**Files:**
- Create: `src/auth/identifiers.js`
- Create: `src/auth/challenges.js`
- Test: `test/unit/auth-identifiers.test.js`
- Test: `test/integration/auth-challenges.test.js`

**Interfaces:**
- Produces: `normalizeEmail(value)`, `normalizePhone(value)`, `validatePasswordPair(password, confirmation)`, and `createChallengeService({ pool, mailer, clock, randomInt, digestSecret })` with `startSignup`, `verifySignup`, `resend`, `startPasswordReset`, `verifyPasswordReset`, `consumeResetToken`, `startEmailAttachment`, and `verifyEmailAttachment`.

- [ ] Write failing tests for email/phone/password normalization, duplicate identifiers, 10-minute expiry, 60-second resend, five-attempt lock, keyed code storage, identifier/IP rate limits, generic reset initiation, and transactional one-use consumption.
- [ ] Run both focused files and verify expected feature-missing failures.
- [ ] Implement identifier validators and the database challenge service with injected clock/random/mailer, row locks, transactions, and bounded cleanup.
- [ ] Add parallel verification tests proving a signup challenge creates at most one account.
- [ ] Re-run focused tests, `npm test`, and integration suite; update progress.

### Task 4: Registration, login, versioned sessions, and email attachment routes

**Files:**
- Modify: `src/auth/legacy-session.js`
- Modify: `server.js`
- Modify: `test/unit/legacy-session.test.js`
- Replace relevant cases: `test/unit/password-auth.test.js`
- Create: `test/integration/authorization-flow.test.js`

**Interfaces:**
- Consumes: Task 3 challenge service.
- Produces: signup start/verify/resend, login, me, signout/signout-all, password-reset start/verify/complete, and authenticated email attachment endpoints; session payload `{ userId, sessionVersion }`.

- [ ] Write failing HTTP tests for verification-before-account creation, matching password confirmation, session version rejection, reset token one-use behavior, reset-wide revocation, migrated-user email attachment, generic reset responses, and no sensitive response/log values.
- [ ] Run focused auth tests and verify failures reflect the old immediate-signup/session behavior.
- [ ] Extend the app factory with injected `mailer` and auth services, implement the routes, include effective onboarding state/permissions in `GET /api/auth/me`, and make legacy `/api/auth/signup` return a migration error.
- [ ] Re-run focused tests, `npm test`, and integration suite; update progress.

### Task 5: Store creation and membership service

**Files:**
- Create: `src/store/memberships.js`
- Modify: `server.js`
- Create: `test/integration/store-membership.test.js`
- Modify: `test/integration/store-authorization.test.js`

**Interfaces:**
- Produces: `createMembershipService({ pool, clock, randomBytes, digestSecret })` implementing create-store, entry-code regeneration, join requests, invitations, acceptance/rejection, approval/rejection, member role updates/removal, and permission predicates.

- [ ] Write failing integration tests for single-store creation, unique entry codes, request approval role selection, unknown-phone invitation rejection, invitation acceptance, conflicting-membership rechecks, manager/seller hierarchy, immutable owner, and parallel accept/approve safety.
- [ ] Run membership tests and verify failures are missing-route/service failures.
- [ ] Implement transactional membership operations with row locks and close conflicting pending records when membership is created.
- [ ] Wire store/member routes and replace misleading authorization helpers with explicit member/owner/manager predicates.
- [ ] Re-run focused tests, `npm test`, and integration suite; update progress.

### Task 6: Existing endpoint role enforcement

**Files:**
- Modify: `server.js`
- Modify: `test/integration/store-authorization.test.js`
- Modify: `test/integration/daily-sales.test.js`
- Modify: `test/integration/contracts.test.js`

**Interfaces:**
- Consumes: Task 5 effective membership permissions.
- Produces: consistent owner/manager/seller enforcement across store, inventory, product, stock, sale, and sold-product routes.

- [ ] Write failing tests proving seller cost redaction, seller mutation denial, seller own-sales filtering, manager operational access, manager store-profile denial, and owner/manager membership hierarchy.
- [ ] Run focused integration tests and verify at least manager profile denial and seller own-sales scope fail against current behavior.
- [ ] Apply centralized permission middleware and query scoping to every existing route; remove global-role permission decisions.
- [ ] Re-run focused tests and both full suites; update progress.

### Task 7: OpenAPI, integration guide, and deployment verification

**Files:**
- Modify: `src/docs/openapi.js`
- Modify: `docs/API-INTEGRATION-GUIDE.md`
- Modify: `README.md`
- Modify: `docs/AUTHORIZATION_PROGRESS.md`
- Modify: `test/unit/swagger.test.js`

**Interfaces:**
- Consumes: final route and schema contracts from Tasks 4-6.
- Produces: complete deployable API documentation and final verification record.

- [ ] Write failing Swagger tests requiring exact coverage for every new route, no active immediate-signup contract, reusable challenge/member schemas, and documented 400/401/403/404/409/429/503 responses.
- [ ] Run Swagger tests and verify the specification is incomplete.
- [ ] Update OpenAPI, the integration guide, README migration/deployment notes, and progress checkboxes without overwriting unrelated user documentation changes.
- [ ] Run `npm test` and `npm run test:integration`.
- [ ] Run migration status/apply/status against the disposable test database.
- [ ] Run `docker compose config --quiet` and build the backend image.
- [ ] Record exact verification results and remaining later phases in `docs/AUTHORIZATION_PROGRESS.md`.
