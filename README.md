# Admin Shoe Store Inventory

Small seller web app for adding, updating, and deleting shoe inventory records in your existing MySQL database.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and add your MySQL Workbench/local database values:

   ```bash
   copy .env.example .env
   ```

3. Start the app:

   ```bash
   npm start
   ```

4. Open `http://localhost:3000`.

## Database Notes

The app expects the table names and columns from your DDL:

- `products`: `id`, `art_no`, `name`, `brand_id`, `type_id`, `price`, `created_at`, `updated_at`
- `product_seasons`: `id`, `product_id`, `season`, `created_at`
- `product_variant`: `id`, `product_id`, `colour_id`, `material_id`, `created_at`, `updated_at`
- `inventory`: `id`, `product_variant_id`, `size`, `quantity`, `store_id`, `price`
- `colours`: `id`, `colour_name`
- `materials`: `id`, `material_type`
- `shoe_type`: `id`, `type`
- `brands`: `id`, `brand_name`
- `product_images`: `id`, `product_variant_id`, `image_path`

`products.name` and `products.brand_id` are required by the DDL. The form still treats name as optional for sellers; if it is empty, the app saves the Artno as the name. Because the form does not ask for brand yet, the app creates or reuses `DEFAULT_BRAND_NAME` from `.env`.

`inventory.store_id` must point to an existing `store.id`. Set `DEFAULT_STORE_ID` in `.env` to the store where sellers should add stock.

The rewritten DDL stores seasons in `product_seasons`, so one product can have multiple exact seasons. The UI season buttons are saved as separate rows in that table.
