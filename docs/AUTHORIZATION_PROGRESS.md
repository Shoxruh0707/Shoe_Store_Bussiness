# Backend Business Logic Progress

Last updated: 2026-11-12

## Current Phase: Authorization and Store Onboarding

Status: design and implementation plan prepared; implementation pending plan review.

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
- Current signup is incompatible with the new rules because it immediately creates a user and store without email verification.
- Email verification, password reset, session revocation, membership invitations, and membership-management APIs do not yet exist.
- Unit baseline on 2026-11-12: 34 tests passed, 0 failed.
- The working tree already contained user changes to `README.md` and an untracked `docs/API-INTEGRATION-GUIDE.md`; these must be preserved.

## Later Phases

1. Inventory query/result audit: unordered search across article number, colour, material, type, and size; zero-filled size quantities; box composition display; box opening.
2. Product mutation audit: add/edit product, pair additions, box additions, price visibility, stock correction, and role enforcement.
3. Selling workflow audit: product suggestions, automatic field population contract, size selection, atomic stock deduction, and cancellation.
4. Sold-products audit: date filtering in Asia/Tashkent, card fields, seller-only own-sales scope, manager/owner all-sales scope.
5. Store profile audit: complete store fields, photo/media lifecycle, Telegram/Instagram validation, and response contracts.
6. Final deployment verification: migrations, full tests, image build, Compose validation, and API smoke tests.

## Resume Instructions

Read the design and plan above, inspect `git status` before editing, and preserve unrelated working-tree changes. Execute the authorization plan test-first. Update this file after each completed plan task with tests run, migration state, and the next unchecked task.
