# Product Suggestions, Daily Sales, and Image Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure store-scoped product suggestions, timezone-correct enriched daily sales, and transactional deterministic product-image ordering without breaking existing mobile API contracts.

**Architecture:** Keep the repository's CommonJS Express/MySQL structure and add one resumable additive migration after the immutable baseline. Isolate calendar logic in a small pure module, keep authorization centralized in existing middleware, and implement catalogue/sales reads as bounded SQL queries with no per-row fetches. Extend the existing product transaction flow so database image order and filesystem cleanup succeed or roll back coherently.

**Tech Stack:** Node.js 22, CommonJS, Express 4, MySQL 8.4 with `mysql2/promise`, Node's built-in test runner, built-in `Intl` timezone support.

**Spec:** `docs/superpowers/specs/2026-10-17-product-suggestions-sales-images-design.md`

## Global Constraints

- Backend/API/database changes only; do not edit Expo or React Native code.
- Preserve session-cookie authentication, active-store scoping, and all existing mobile routes and request parameters.
- `APP_TIMEZONE` defaults to the exact IANA zone `Asia/Tashkent` and invalid zones fail configuration validation.
- Use parameterized SQL values; never concatenate user search or date values into SQL.
- Only global admins and store owners/managers may see `landingPrice`; staff receive `null` consistently.
- Monetary response values are whole UZS JavaScript-safe integers.
- Do not modify the checksummed `0001-current-inventory` migration.
- Treat `images` order as authoritative when supplied, preserve omitted-image backward compatibility, and never expose filesystem paths.
- Do not edit the user's existing uncommitted `README.md` or `docs/API-INTEGRATION-GUIDE.md` changes.

## Review Focus

- Search input containing `%`, `_`, or `\\` must be treated as literal text and must not broaden catalogue matches; Task 3 pins this behavior.
- A syntactically valid but impossible date such as `2026-02-29` must return 400 while `2028-02-29` succeeds; Task 2 pins this behavior.
- At the `Asia/Tashkent` local midnight boundary, the previous and following calendar days must not leak into results; Task 2 pins this behavior.
- Duplicate or foreign existing image IDs must be rejected without changing database rows or leaving new files behind; Task 4 pins this behavior.
- A migration rerun after the image-order column exists but before its migration record is written must converge without renumbering nondeterministically; Task 1 pins this behavior.

---

### Task 1: Add the Resumable Catalogue and Image-Order Migration

**Files:**
- Create: `src/db/migrations/0002-product-search-image-order.js`
- Modify: `src/db/migrations/index.js`
- Create: `test/integration/product-catalog-migration.test.js`

**Interfaces:**
- Consumes: migration objects shaped as `{ id, checksum, up(connection) }` from `src/db/migrations/index.js` and MySQL 8 window functions.
- Produces: migration ID `0002-product-search-image-order`; `product_images.sort_order INT UNSIGNED NOT NULL`; indexes `idx_product_images_variant_order`, `idx_variant_store_product_id`, `idx_products_art_no_id`, `idx_pair_store_sold_at_id`, and `idx_box_store_sold_at_id`.

- [ ] **Step 1: Write the failing migration integration tests**

Add tests named `catalog migration backfills stable image order and creates lookup indexes` and `catalog migration resumes safely after partial application`. Create the baseline with only migration `0001`, insert multiple image rows out of ID/creation order across two variants, apply `0002`, and assert zero-based `created_at, id` order per variant plus all five exact index definitions. Simulate partial application by adding the nullable column before calling `up()` twice and assert the same final order.

- [ ] **Step 2: Run the migration test and verify RED**

Run: `node --test test/integration/product-catalog-migration.test.js`

Expected: FAIL because `0002-product-search-image-order.js` and the new schema/indexes do not exist.

- [ ] **Step 3: Implement and register migration `0002-product-search-image-order`**

Implement `up(connection)` with information-schema guards for the column and each named index. Add `sort_order` nullable when absent, deterministically backfill every variant using `ROW_NUMBER() OVER (PARTITION BY product_variant_id ORDER BY created_at, id) - 1`, then make it `INT UNSIGNED NOT NULL`. Reruns must recompute the same complete ordering before enforcing the final shape. Add the five exact indexes and export the migration with a checksum derived from its normalized source bytes while preserving the existing `0001` checksum calculation.

- [ ] **Step 4: Run migration and existing migration-runner tests and verify GREEN**

Run: `node --test test/integration/product-catalog-migration.test.js test/integration/migration-runner.test.js test/integration/schema-upgrade.test.js test/unit/migration-runner.test.js`

Expected: all tests PASS with no warnings or pending handles.

- [ ] **Step 5: Commit the migration slice**

```bash
git add src/db/migrations/0002-product-search-image-order.js src/db/migrations/index.js test/integration/product-catalog-migration.test.js
git commit -m "feat: migrate product image ordering and lookup indexes"
```

### Task 2: Add Application-Timezone Date Resolution and Enrich Daily Sales

**Files:**
- Create: `src/time/local-date.js`
- Create: `test/unit/local-date.test.js`
- Modify: `src/config.js`
- Modify: `test/unit/config.test.js`
- Modify: `server.js` (configuration initialization, date validation, `/api/sold-products` query and serialization)
- Create: `test/integration/daily-sales.test.js`

**Interfaces:**
- Consumes: `config.APP_TIMEZONE`, injected `clock`, authenticated `request.store.id`, and existing `canViewLandingPrice(request)`.
- Produces: `isValidTimeZone(value) -> boolean`; `resolveLocalDateRange(value, timeZone, nowMs) -> null | { date, start, end }`, where omitted `value` uses the current date in `timeZone`, and `start`/`end` are local wall-clock `YYYY-MM-DD HH:mm:ss` strings.

- [ ] **Step 1: Write failing unit tests for configuration and local calendar resolution**

Test the default `Asia/Tashkent`, a valid override, invalid-zone rejection, exact format enforcement, month lengths, `2028-02-29` acceptance, `2026-02-29` rejection, year rollover, and an omitted date at an instant where UTC is October 16 but Tashkent is October 17.

- [ ] **Step 2: Run the timezone unit tests and verify RED**

Run: `node --test test/unit/config.test.js test/unit/local-date.test.js`

Expected: FAIL because the timezone configuration and local-date module are absent.

- [ ] **Step 3: Implement the pure local-date interfaces and configuration validation**

Use `Intl.DateTimeFormat(..., { timeZone })` only to resolve the current local date. Validate explicit dates by component round-trip and use UTC calendar arithmetic solely to increment the date label, avoiding host-timezone dependence. Freeze the validated `APP_TIMEZONE` in `readConfig`.

- [ ] **Step 4: Run the timezone unit tests and verify GREEN**

Run: `node --test test/unit/config.test.js test/unit/local-date.test.js`

Expected: all tests PASS.

- [ ] **Step 5: Write failing daily-sales integration tests**

Cover unauthenticated access, cross-store isolation, exact invalid/leap dates, omitted-date behavior with the injected clock, inclusive start/exclusive end local boundaries, cancelled-row visibility, manager/staff `landingPrice` and `viewer.canViewLandingPrice`, missing seller fallback after creating a deliberately orphaned test fixture, missing image fallback, ordered primary image, required response fields, box total-revenue/total-landed-cost semantics, and stable `soldAt DESC, numeric saleId DESC` ordering.

- [ ] **Step 6: Run the daily-sales integration test and verify RED**

Run: `node --test test/integration/daily-sales.test.js`

Expected: FAIL on impossible-date validation, local current-day resolution, seller fallback, image ordering, or numeric tie ordering.

- [ ] **Step 7: Implement the enriched `/api/sold-products` flow**

Replace `normalizeSoldProductsDate` with `resolveLocalDateRange`. Bind the explicit start and end strings in both `UNION ALL` branches. Select a private numeric `saleId`, use `COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.fname, u.lname)), ''), 'Unknown user')`, order primary images by `sort_order, id`, order the union by `soldAt DESC, saleId DESC`, then omit the private `saleId` from public items. Keep pair landed cost unchanged; calculate authorized box `landingPrice` as stored per-box landed cost multiplied by `quantity`, matching total box revenue. Convert quantity and price fields to checked whole safe integers and retain `pair-<id>`/`box-<id>` IDs and staff-null cost behavior.

- [ ] **Step 8: Run the daily-sales slice and verify GREEN**

Run: `node --test test/unit/config.test.js test/unit/local-date.test.js test/integration/daily-sales.test.js test/integration/store-authorization.test.js`

Expected: all tests PASS and existing sales contracts remain green.

- [ ] **Step 9: Commit the daily-sales slice**

```bash
git add src/time/local-date.js src/config.js server.js test/unit/local-date.test.js test/unit/config.test.js test/integration/daily-sales.test.js
git commit -m "feat: make daily sales timezone correct and complete"
```

### Task 3: Add Store-Scoped Product Suggestions

**Files:**
- Modify: `server.js` (suggestion validation/helper and route before `/api/products/:id`)
- Create: `test/integration/product-suggestions.test.js`

**Interfaces:**
- Consumes: authenticated active store, `q` trimmed to 1-100 Unicode code points, optional decimal `limit` from 1-20, Task 1 image/catalogue indexes, existing `canViewLandingPrice(request)`, and season conversion.
- Produces: `GET /api/products/suggestions` returning `{ success: true, data: { items } }` with the exact compact item fields from the spec.

- [ ] **Step 1: Write failing suggestion integration tests**

Test 401 without a session, 403 without active-store access, blank/missing/101-code-point queries, invalid limits (`0`, `21`, decimal, signed, and nonnumeric), default limit 6, requested limits, case-insensitive matching across article/name/colour/material, literal `%`/`_`/`\\`, exact-article then article-prefix then other-substring ranking, variant-ID tie-breaking, one result per variant, cross-store exclusion, ordered primary image, manager-visible cost, staff-null cost, required shape, and whole safe integer prices.

- [ ] **Step 2: Run the suggestion integration test and verify RED**

Run: `node --test test/integration/product-suggestions.test.js`

Expected: FAIL with 404 because the route does not exist.

- [ ] **Step 3: Implement suggestion validation and the single-query endpoint**

Register the literal route before `/api/products/:id`. Escape LIKE metacharacters, bind exact/prefix/substring forms and `limit`, and use one grouped query joining only variants with `pv.store_id = ?`. Aggregate seasons, select the first image through an ordered derived/subquery using `sort_order, id`, calculate rank with exact article first and article prefix second, and order by rank then `pv.id`. Serialize the compact shape and apply the existing landing-price permission consistently.

- [ ] **Step 4: Run suggestion and authorization tests and verify GREEN**

Run: `node --test test/integration/product-suggestions.test.js test/integration/store-authorization.test.js test/integration/contracts.test.js`

Expected: all tests PASS with no duplicate items or cross-store data.

- [ ] **Step 5: Commit the suggestion slice**

```bash
git add server.js test/integration/product-suggestions.test.js
git commit -m "feat: add store-scoped product suggestions"
```

### Task 4: Make Image Writes Ordered, Backward-Compatible, and Rollback-Safe

**Files:**
- Modify: `server.js` (`normalizeImages`, image save/replace helpers, product create/update transaction cleanup, and every image query)
- Create: `test/integration/product-image-ordering.test.js`

**Interfaces:**
- Consumes: Task 1 `product_images.sort_order`; optional request `images`; image entries using existing `id`, `path`, `data`, or `tempId` fields.
- Produces: `saveProductImages(connection, variantId, images, startOrder) -> { savedImages, createdPaths }`; `replaceProductImages(connection, variantId, images) -> { savedImages, createdPaths, obsoletePaths }`; all serialized images ordered by `sort_order, id`.

- [ ] **Step 1: Write failing image-ordering and transaction integration tests**

Cover ordered create serialization, ordered `PUT` reorder while retaining IDs, explicit removal, explicit empty-array removal, omitted-images preservation, legacy matching-variant `POST` append order, deterministic ID fallback, foreign image ID rejection, duplicate image ID rejection, first-image behavior in product/suggestion/sales responses, and a two-image request whose second invalid image fails after the first file is created—asserting database rollback and removal of the first file.

- [ ] **Step 2: Run the image-ordering test and verify RED**

Run: `node --test test/integration/product-image-ordering.test.js`

Expected: FAIL because `sort_order` is neither written nor used and rollback leaves the first created file behind.

- [ ] **Step 3: Preserve whether `images` was omitted and validate image identity lists**

Carry an `imagesProvided` boolean from `validateProductPayload`. On `PUT`, omitted images bypass replacement; an explicit array is authoritative. Reject repeated positive IDs and any submitted existing ID not owned by the active variant with HTTP 400 before destructive row changes.

- [ ] **Step 4: Implement ordered database writes and deferred filesystem cleanup**

Insert or update every retained/new row with its zero-based position. Matching-variant `POST` begins new positions after the existing maximum without deleting existing images. Track every newly created/promoted public path and delete those paths after rollback. Delete obsolete files only after commit; log cleanup errors without changing a committed response. Do not delete retained paths.

- [ ] **Step 5: Update every product, suggestion, and sales image read**

Use `ORDER BY sort_order, id` for image arrays and primary-image selection. Keep public values as `/uploads/...` paths and preserve all existing response shapes.

- [ ] **Step 6: Run image, product, suggestion, and sales tests and verify GREEN**

Run: `node --test test/integration/product-image-ordering.test.js test/integration/inventory.test.js test/integration/contracts.test.js test/integration/store-authorization.test.js test/integration/product-suggestions.test.js test/integration/daily-sales.test.js`

Expected: all tests PASS; failed image writes leave neither rows nor files.

- [ ] **Step 7: Commit the image-ordering slice**

```bash
git add server.js test/integration/product-image-ordering.test.js
git commit -m "feat: preserve transactional product image order"
```

### Task 5: Publish Configuration and API Contracts, Then Run Full Verification

**Files:**
- Modify: `.env.example`
- Modify: `.env.production.example`
- Modify: `src/docs/swagger.js`
- Modify: `test/unit/swagger.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: final endpoint schemas and `APP_TIMEZONE` from Tasks 2-4.
- Produces: discoverable environment examples, Swagger contracts for `/api/products/suggestions` and enriched `/api/sold-products`, and an integration script that includes all new integration test files.

- [ ] **Step 1: Write failing Swagger/config contract assertions**

Assert the generated OpenAPI document includes the suggestion query/limit constraints, compact response fields, daily-sales `date`, `viewer`, enriched item fields, and nullable `landingPrice`. Assert both environment examples contain `APP_TIMEZONE=Asia/Tashkent`.

- [ ] **Step 2: Run contract tests and verify RED**

Run: `node --test test/unit/swagger.test.js`

Expected: FAIL because the new endpoint and enriched schemas are not documented.

- [ ] **Step 3: Update Swagger, environment examples, and test scripts**

Document both GET routes without changing existing route semantics. Add `APP_TIMEZONE=Asia/Tashkent` to development and production examples. Extend `test:integration` to include `daily-sales.test.js`, `product-catalog-migration.test.js`, `product-image-ordering.test.js`, and `product-suggestions.test.js` alongside every existing integration file.

- [ ] **Step 4: Run the full unit suite**

Run: `npm test`

Expected: all unit tests PASS with pristine output.

- [ ] **Step 5: Run the full integration suite**

Run: `npm run test:integration`

Expected: all integration tests PASS against disposable MySQL databases with pristine output.

- [ ] **Step 6: Run migration checks**

Run: `npm run db:status`

Expected: the configured database reports migrations deterministically; if local migration credentials are unavailable, report that exact environmental limitation and rely on the passing disposable-database migration status/apply/idempotency tests rather than claiming this command passed.

- [ ] **Step 7: Check available lint/typecheck scripts and repository diff**

Run: `npm run`

Expected: no lint or typecheck script is listed. Then run `git diff --check` and `git status --short`; expect no whitespace errors and only intentional task changes plus the user's pre-existing `README.md` and `docs/API-INTEGRATION-GUIDE.md` changes.

- [ ] **Step 8: Commit the contract and verification slice**

```bash
git add .env.example .env.production.example src/docs/swagger.js test/unit/swagger.test.js package.json
git commit -m "docs: publish catalogue and daily sales contracts"
```

- [ ] **Step 9: Prepare the delivery evidence**

Report changed endpoint/helper files, migration `0002-product-search-image-order`, all five indexes, new test files, exact verification results, and cookie-authenticated `curl` examples for `GET /api/products/suggestions?q=SH-2026&limit=6` and `GET /api/sold-products?date=2026-10-17`.
