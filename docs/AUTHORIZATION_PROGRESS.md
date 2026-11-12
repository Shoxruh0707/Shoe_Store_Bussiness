# Backend Business Logic Progress

Last updated: 2026-11-12

## Current Phase: Authorization and Store Onboarding

Status: backend implementation complete on `feature/authorization-onboarding`; final verification is recorded below.

Canonical documents:

- Design: `docs/superpowers/specs/2026-11-12-authorization-onboarding-design.md`
- Plan: `docs/superpowers/plans/2026-11-12-authorization-onboarding.md`

Confirmed decisions:

- Registration requires first name, last name, unique email, unique phone, password, and matching password confirmation.
- Account creation happens only after a six-digit email code is verified.
- Codes expire in 10 minutes, resend after 60 seconds, allow five attempts, and are rate-limited.
- Email uses configurable SMTP; `noreply` is the display name and the full sender awaits an owned domain.
- Login is phone/password with seven-day sessions. Password reset revokes all sessions.
- Every account can belong to only one store.
- Onboarding offers create-store or join-store paths.
- Stores use unique regeneratable entry codes for join requests.
- Invitations only target existing phone numbers and require recipient acceptance.
- Request approvers select manager or seller.
- Owners manage managers and sellers. Managers manage sellers only. Sellers manage nobody.
- Store profile/social settings and entry-code regeneration are owner-only.

## Existing Baseline

- Backend: Node.js 22, Express 4, MySQL 8.4, CommonJS.
- Deployment: Docker Compose with MySQL, migrator, backend, and Caddy.
- Current authentication: phone/password and signed HTTP-only cookie.
- The former immediate-signup endpoint now returns `410 SIGNUP_VERIFICATION_REQUIRED`; verified signup uses start/verify endpoints.
- Email verification, password reset, session revocation, membership invitations, join requests, and membership management are implemented.
- Unit baseline on 2026-11-12: 34 tests passed, 0 failed.
- The working tree already contained user changes to `README.md` and an untracked `docs/API-INTEGRATION-GUIDE.md`; these must be preserved.

## Implementation Checkpoints

- Task 1 schema migration: implemented and verified. Migration 0003 preserves immutable migration checksums, adds auth/store membership schema, converts `staff` memberships to `seller`, rejects ambiguous legacy multi-store memberships, and is resumable. Focused migration tests: 6 passed.
- Task 2 email/security configuration: implemented. Provider-neutral Nodemailer SMTP adapter, independent OTP secret, disabled-mail safe failure, Docker/env wiring, and HMAC code digests are covered.
- Task 3 challenge service: implemented and verified. Signup remains absent until code verification; OTP cooldown/expiry/attempt lock, parallel one-use verification, and non-enumerating reset with one-use reset token pass real-MySQL tests.
- Task 4 account lifecycle: verified signup, resend, phone/password login, current session, sign-out/sign-out-all, password reset, legacy email attachment, and versioned session revocation are implemented and documented in OpenAPI.
- Task 5 store onboarding: transactional create-store, regeneratable entry codes, join requests, phone invitations, recipient acceptance/rejection, owner/manager approvals, member role changes, removal hierarchy, owner immutability, and one-store exclusivity are implemented. Parallel invitation acceptance creates at most one membership.
- Task 6 authorization: store membership roles—not the global user role—control access. Sellers cannot mutate stock or see landing cost and see only their sales; managers have operational access but cannot edit store profile or manage managers; owners have full store/membership control.
- Task 7 API/deployment: every Express route is covered by OpenAPI. Compose interpolation, migration status/apply/status, and the backend Docker image build have been verified.
- Security audit: production dependencies report 0 known vulnerabilities after safe transitive updates and Nodemailer 10.5.0.
- Final verification: `npm test` passed 45/45 and `npm run test:integration` passed 36/36 on 2026-11-12.
- MySQL 8.4 test container is healthy on the repository's isolated test Compose stack.

## Configuration Still Required Before Production

- Register or choose an owned email domain and configure `EMAIL_FROM` as `noreply@<owned-domain>`.
- Configure SMTP host, port, user, password, and TLS mode; set `EMAIL_DELIVERY_MODE=smtp`.
- Add SPF, DKIM, and DMARC DNS records supplied by the chosen SMTP provider.
- Generate independent random production values for `SESSION_SECRET` and `OTP_SECRET`.

## Later Phases

1. Inventory query/result audit: unordered search across article number, colour, material, type, and size; zero-filled size quantities; box composition display; box opening.
2. Product mutation audit: add/edit product, pair additions, box additions, price visibility, stock correction, and role enforcement.
3. Selling workflow audit: product suggestions, automatic field population contract, size selection, atomic stock deduction, and cancellation.
4. Sold-products audit: date filtering in Asia/Tashkent, card fields, seller-only own-sales scope, manager/owner all-sales scope.
5. Store profile audit: complete store fields, photo/media lifecycle, Telegram/Instagram validation, and response contracts.
6. Final deployment verification: migrations, full tests, image build, Compose validation, and API smoke tests.

## Resume Instructions

Read the design and plan above, inspect `git status` before editing, and preserve unrelated working-tree changes. Execute the authorization plan test-first. Update this file after each completed plan task with tests run, migration state, and the next unchecked task.
