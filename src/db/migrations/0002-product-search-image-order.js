async function columnNames(connection, table) {
  const [rows] = await connection.execute(
    `SELECT COLUMN_NAME AS name, IS_NULLABLE AS nullable, COLUMN_TYPE AS type
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return new Map(rows.map((row) => [row.name, row]));
}

async function indexColumns(connection, table, name) {
  const [rows] = await connection.execute(
    `SELECT COLUMN_NAME AS name
       FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
      ORDER BY SEQ_IN_INDEX`,
    [table, name]
  );
  return rows.map((row) => row.name);
}

async function ensureIndex(connection, table, name, columns) {
  const existing = await indexColumns(connection, table, name);
  if (existing.length) {
    if (existing.join(',') !== columns.join(',')) {
      throw Object.assign(new Error('CATALOG_INDEX_RECONCILIATION_REQUIRED'), {
        code: 'CATALOG_INDEX_RECONCILIATION_REQUIRED'
      });
    }
    return;
  }
  await connection.query(`ALTER TABLE \`${table}\` ADD INDEX \`${name}\` (${columns.map((column) => `\`${column}\``).join(', ')})`);
}

async function up(connection) {
  const imageColumns = await columnNames(connection, 'product_images');
  if (!imageColumns.has('sort_order')) {
    await connection.query('ALTER TABLE product_images ADD COLUMN sort_order INT UNSIGNED NULL AFTER image_path');
  }

  await connection.query(
    `UPDATE product_images pi
       JOIN (
         SELECT id, ROW_NUMBER() OVER (
           PARTITION BY product_variant_id
           ORDER BY created_at, id
         ) - 1 AS position
         FROM product_images
       ) ranked ON ranked.id = pi.id
        SET pi.sort_order = ranked.position`
  );
  await connection.query('ALTER TABLE product_images MODIFY COLUMN sort_order INT UNSIGNED NOT NULL');

  await ensureIndex(connection, 'product_images', 'idx_product_images_variant_order', ['product_variant_id', 'sort_order', 'id']);
  await ensureIndex(connection, 'product_variant', 'idx_variant_store_product_id', ['store_id', 'product_id', 'id']);
  await ensureIndex(connection, 'products', 'idx_products_art_no_id', ['art_no', 'id']);
  await ensureIndex(connection, 'sold_products_pair', 'idx_pair_store_sold_at_id', ['store_id', 'sold_at', 'id']);
  await ensureIndex(connection, 'sold_products_box', 'idx_box_store_sold_at_id', ['store_id', 'sold_at', 'id']);
}

module.exports = { up };
