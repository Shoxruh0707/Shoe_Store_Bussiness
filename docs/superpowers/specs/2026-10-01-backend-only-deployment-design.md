# Backend-Only Deployment Design

## Objective

Convert this repository into a deployable backend-only project. It will expose REST API and uploaded-file endpoints, run with MySQL through Docker Compose, preserve existing business data and migrations, and contain no Android, web frontend, Telegram client, or local phone-testing implementation.

## Retained Architecture

The root Node.js application remains the canonical backend. It owns API request validation, authentication and authorization, inventory business rules, file handling, database access, and structured error responses. MySQL remains the database. Database changes continue through the existing explicit migration runner; application startup must not create or alter schema implicitly.

Docker Compose will define the production-deployable API and MySQL services. The MySQL service will use a named persistent volume and health check. The API will wait for a healthy database, run with production-safe environment settings, and fail closed when migrations are pending. Caddy may remain as the HTTPS reverse proxy used by the documented server deployment.

## Removed Scope

The cleanup removes:

- The native Android project and generated APK artifacts.
- The Next.js frontend and all frontend-specific commands and configuration.
- Telegram Mini App page behavior, Telegram authentication compatibility, Telegram bots, and channel publishing runtime code.
- Local phone-testing scripts, flags, cleartext-network setup, and documentation.
- The unused duplicate `backend-api` TypeScript scaffold.
- Android migration plans, assessments, changelogs, and execution documents.
- Telegram migration documentation and obsolete run instructions.
- Generated caches, build products, and abandoned tool downloads.

Git history remains the record of removed implementation. Existing database files are not deleted or rewritten destructively.

## API Boundary

The server will accept API requests under `/api` and serve uploaded product media under `/uploads` when required by API responses. Browser page routes, frontend redirects, and static web-application behavior will be removed. Unknown routes will return a JSON 404 response.

Existing inventory endpoints and role-based access checks remain unless they depend exclusively on removed Telegram authentication. Authentication must be represented as a backend API concern. Any temporary development bypass must remain disabled in production and must not be part of the deployment workflow.

## Database and Migrations

The existing MySQL schema, SQL migration, JavaScript migration runner, readiness checks, migration tests, and integration fixtures remain. Docker Compose will persist `/var/lib/mysql` in a named volume. Deployment documentation will require an explicit migration command before starting a new API version.

The repository may retain a schema reference SQL file when it matches the canonical migration. Duplicate or obsolete schema copies will be removed or clearly designated to prevent multiple sources of truth.

## Deployment Configuration

The deployable repository will contain:

- A production API `Dockerfile`.
- A Docker Compose definition for API, MySQL, and optional Caddy HTTPS termination.
- A separate integration-test Compose definition if required by the test suite.
- Environment examples containing names and safe placeholders only.
- A deployment script and documentation aligned with the final service names and migration procedure.

No secrets, live database dumps, APKs, or local `.env` files will be added to source control.

## Verification

The cleanup is complete when:

1. Repository searches find no Android, frontend, Telegram, or phone-test runtime references outside historical Git data.
2. Unit tests pass.
3. Database-backed integration tests pass against the test Compose database.
4. The production Docker image builds successfully.
5. The Compose configuration renders successfully with placeholder deployment values.
6. API smoke tests confirm JSON responses, authorization behavior, migration readiness, and database connectivity.
7. Documentation describes only the backend API, database migration, testing, and Docker deployment workflows.

## Resulting Repository Boundary

This repository becomes the server-side project. The future mobile application will live in a separate project and communicate only through the deployed HTTPS API. Mobile implementation, signing, UI, and device-specific security will not be maintained here.
