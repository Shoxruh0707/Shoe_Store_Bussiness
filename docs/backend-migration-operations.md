# Database migration operations

`src/db/migrations/` is the only schema source. Migration `0001-current-inventory` can initialize an empty database and reconcile supported historical schemas. Do not edit an applied migration; add a new numbered migration.

## Before production changes

1. Back up the MySQL database and the `uploads` volume.
2. Restore both backups in a separate environment and verify them.
3. Review the release migration against that restored copy.
4. Give the migration account schema-change privileges. Keep runtime `DB_USER` limited to required data operations plus read access to `schema_migrations`.

The migration command requires every `MIGRATION_DB_*` variable and never falls back to runtime `DB_*` credentials:

```text
MIGRATION_DB_HOST
MIGRATION_DB_PORT
MIGRATION_DB_USER
MIGRATION_DB_PASSWORD
MIGRATION_DB_NAME
```

## Status and apply

```bash
npm run db:status
npm run db:migrate
npm run db:status
```

Status is read-only. Apply takes a MySQL advisory lock, runs pending migrations in order, and records their checksums in `schema_migrations`. Failed migrations are not recorded. Because MySQL DDL may commit before a later statement fails, migration steps inspect existing schema and support safe retry where possible.

Startup performs a readiness check only. Pending, missing, unknown, or checksum-mismatched migrations prevent the API listener from opening.

## Compose deployment

The `migrate` service uses the same production backend image and runs `node scripts/migrate.js apply`. The `backend` service depends on successful migration completion and a healthy MySQL service.

```bash
docker compose up -d mysql
docker compose run --rm --build migrate
docker compose up -d --build backend caddy
```

The named `mysql_data` volume is never removed by normal `docker compose down`. Do not run `docker compose down -v` in production.

## Reconciliation failures

The initial migration stops rather than guessing when it finds unsupported key types, missing required runtime columns, ambiguous box ownership, or incompatible historical sales data. Resolve the issue on a restored copy, document the reconciliation, back up again, and only then repeat production migration.

## Rollback

There are no destructive down migrations. If an application rollback is needed, keep the expanded schema and migration ledger, and deploy a previously tested compatible image. For schema or data recovery, stop writers and restore the verified database plus uploads backup. Never delete the migration ledger or persistent volumes to force startup.
