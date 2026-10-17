# Product Suggestions, Daily Sales, and Image Ordering Design

## Objective

Extend the Ombor backend with fast store-scoped product suggestions, a complete and timezone-correct daily-sales response, and deterministic primary-image ordering. Existing mobile routes and request parameters remain compatible, and no frontend code is changed.

## Runtime and Configuration

The application gains an `APP_TIMEZONE` setting. It defaults to `Asia/Tashkent` and must be a valid IANA timezone. Configuration validation rejects invalid values at startup so sales-day boundaries cannot silently depend on the host or container timezone.

Sales timestamps remain stored in the existing MySQL `DATETIME` columns. A requested local calendar date is converted into an inclusive local start and exclusive next-day boundary before querying. Missing `date` retains the existing behavior of selecting the current local day, now derived using `APP_TIMEZONE` rather than MySQL or host defaults.

## Database Migration

A new migration follows the existing checksummed `0001-current-inventory` migration. The baseline migration is not modified.

The migration will:

1. Add `product_images.sort_order` as a non-negative integer.
2. Backfill each variant's existing images in deterministic `created_at, id` order, assigning zero-based positions.
3. Make `sort_order` non-null after backfill.
4. Add an index on `product_images(product_variant_id, sort_order, id)` for primary-image lookup and ordered serialization.
5. Add a composite index on `product_variant(store_id, product_id, id)` for tenant-scoped catalogue joins.
6. Add an article lookup index on `products(art_no, id)` to support exact and prefix article matches under the column's case-insensitive collation.
7. Add composite sales indexes ending in the sale ID for store/date ordering on both pair and box sales.

The migration is additive and compatible with the current application: older code ignores the new image-order column. It is applied only to disposable integration databases during development. Production application remains an explicit operator action using the existing migration runbook, backup, and restore requirements.

## Product Suggestions API

`GET /api/products/suggestions?q=<text>&limit=<integer>` uses the existing authentication and active-store middleware. It is registered before the parameterized `/api/products/:id` route.

Validation trims `q`, rejects missing or blank values, and rejects values longer than 100 Unicode code points. `limit` defaults to `6`; only decimal integers from `1` through `20` are accepted. Validation failures use the existing `{ success: false, error, message }` envelope.

One parameterized SQL query joins products, store-owned variants, colour, material, shoe type, seasons, and the first ordered image. Matching is case-insensitive against article number, product name, colour name, and material type. SQL wildcard characters supplied by the user are escaped so they are treated as text rather than uncontrolled match operators.

Results are ranked by:

1. exact article match;
2. article prefix match;
3. all other substring matches;
4. variant ID as the final deterministic tie-breaker.

The query returns one row per variant and applies the requested limit in SQL. Each item contains `id`, `variantId`, `artNo`, `name`, `type`, `seasons`, `colour`, `material`, `price`, `landingPrice`, and `primaryImagePath`. `landingPrice` is returned as a number for admins, owners, and managers and as `null` for staff, matching existing product responses. Numeric money values are checked and serialized as JavaScript-safe whole UZS integers.

## Daily Sales API

`GET /api/sold-products?date=YYYY-MM-DD` retains its existing route, response envelope, role behavior, and missing-date compatibility.

Date validation requires exactly four-digit year, two-digit month, and two-digit day components and rejects impossible dates, including invalid month lengths and non-leap-year February 29. The application computes local-day boundaries using `APP_TIMEZONE`; the query compares existing `DATETIME` values against explicit start-inclusive and end-exclusive boundary strings.

The pair and box branches remain one `UNION ALL` query. Both branches:

- filter by the authenticated active store before returning any related data;
- left-join seller identity and return a trimmed display name or `Unknown user`;
- obtain only the first image ordered by `sort_order, id`;
- return cancelled rows with `isCancelled: true`;
- return the required product, variant, quantity, pricing, seller, and timestamp fields;
- identify the numeric sale ID separately so final ordering is `soldAt DESC, saleId DESC` without lexicographic ID errors.

The public `id` stays compatible as `pair-<id>` or `box-<id>`. `viewer.canViewLandingPrice` uses the existing admin/owner/manager permission. Staff receive `landingPrice: null` consistently. Pair landed cost remains the stored per-pair cost. Box sale `soldPrice` remains total box revenue, and stored `landingPrice` remains the total landed cost used for that sale: landed cost per box multiplied by sold quantity. Cancelled records remain visible but are excluded from any future server-calculated active totals; this response currently has no totals to change.

## Image Write Semantics

The submitted `images` array is authoritative whenever present on product create or update. Position in the array becomes zero-based `sort_order`.

For updates:

- an existing image ID belonging to the edited variant is retained and assigned its submitted position;
- a new data or temporary image is saved and inserted at its submitted position;
- existing images omitted from an explicitly submitted array are removed;
- images from another variant are never retained or exposed;
- duplicate submitted IDs are rejected rather than creating ambiguous ordering.

Backward compatibility distinguishes an omitted `images` property from an explicit empty array. On `PUT`, omission preserves all current images and their order, while an explicit empty array deliberately removes them all. A `POST` that creates a product or a new variant assigns submitted order directly. A legacy `POST` that matches an existing variant remains a stock-addition operation: it preserves existing images and appends newly submitted images in submitted order after the current final position. Create requests continue to accept no images.

Product metadata, season relations, stock mutations performed by the endpoint, image rows, and image ordering remain inside one database transaction. Files promoted or created during a failed transaction are removed during rollback cleanup. Files for removed database rows are deleted only after a successful commit so rollback cannot leave the database pointing to a deleted file. Cleanup failures are logged without converting an already committed database transaction into an API failure.

All product serializers and first-image lookups order by `sort_order, id`. List and suggestion queries fetch images without per-result queries. Existing single-product reads retain their present response shape.

## Authorization and Data Safety

Every new or changed query derives its store ID only from the authenticated active-store context. Client-provided store IDs are ignored. Product, variant, inventory, sale, seller, and image joins cannot cross the store boundary.

All query values use MySQL bindings. Responses never include password hashes, phone numbers, filesystem paths, or seller metadata beyond the display name. Public image values remain `/uploads/...` URL paths. Landing cost uses the existing centralized permission check.

## Error Handling

Expected input failures return HTTP 400 through the project's structured error helper. Missing authentication returns 401, missing active-store access returns 403, and store-scoped resource misses retain existing 404 behavior. Unexpected database and filesystem errors pass through the centralized safe error handler.

Image write failures roll back database changes and clean up newly created files. A failed post-commit deletion of an obsolete file is logged for operational cleanup but does not misreport the committed update as failed.

## Testing and Verification

Integration tests will cover:

- authentication and active-store requirements;
- cross-store suggestion and sales isolation;
- suggestion query validation, maximum query length, limit validation, ranking, stable ties, deduplication, and primary image selection;
- admin, owner, manager, and staff landed-price visibility;
- exact date syntax, impossible dates, leap days, missing-date compatibility, and local-day boundaries in `Asia/Tashkent`;
- newest-first sales ordering with numeric ID ties;
- cancelled sales visibility;
- missing seller and image fallbacks;
- pair and box price semantics;
- deterministic migration backfill and indexes;
- create/update image ordering, retained image IDs, explicit removal, omitted-image compatibility, and foreign/duplicate image rejection;
- database rollback and file cleanup after injected image-write failures.

Unit tests will cover timezone configuration validation and pure date-boundary behavior where isolation improves diagnostics. Verification runs the complete unit suite, complete integration suite, migration status/apply/idempotency checks, and any available lint or typecheck scripts. This repository currently defines no lint or typecheck script, so that absence will be reported rather than replaced with an unrelated tool.

## Delivery Report

The final handoff will list changed endpoint and helper files, the new migration and indexes, test files, verification results, and authenticated example `curl` requests for product suggestions and daily sales.
