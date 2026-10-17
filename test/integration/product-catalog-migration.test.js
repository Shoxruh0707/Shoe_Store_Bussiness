const test = require('node:test');
const assert = require('node:assert/strict');
const { withTestDatabase } = require('../support/test-database');
const { runMigrations } = require('../../src/db/migrate');
const migrations = require('../../src/db/migrations');
const catalogueMigration = require('../../src/db/migrations/0002-product-search-image-order');
const { seedFixtures } = require('../support/fixtures');

async function baseline(connection) {
  await runMigrations({ connection, migrations: [migrations[0]], mode: 'apply' });
}

async function insertImages(pool) {
  await seedFixtures(pool);
  await pool.query(
    `INSERT INTO product_images (id, product_variant_id, image_path, created_at)
     VALUES
       (30, 1, '/uploads/late-id.jpg', '2026-01-02 10:00:00'),
       (10, 1, '/uploads/early.jpg', '2026-01-01 10:00:00'),
       (20, 1, '/uploads/same-time-low-id.jpg', '2026-01-02 10:00:00'),
       (40, 2, '/uploads/other-variant.jpg', '2025-01-01 10:00:00')`
  );
}

async function imageOrder(connection) {
  const [rows] = await connection.query(
    'SELECT id, product_variant_id AS variantId, sort_order AS sortOrder FROM product_images ORDER BY product_variant_id, sort_order, id'
  );
  return rows;
}

async function namedIndexes(connection) {
  const names = [
    'idx_product_images_variant_order',
    'idx_variant_store_product_id',
    'idx_products_art_no_id',
    'idx_pair_store_sold_at_id',
    'idx_box_store_sold_at_id'
  ];
  const [rows] = await connection.query(
    `SELECT TABLE_NAME AS tableName, INDEX_NAME AS indexName,
            GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columnsList
       FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND INDEX_NAME IN (?)
      GROUP BY TABLE_NAME, INDEX_NAME
      ORDER BY INDEX_NAME`,
    [names]
  );
  return rows;
}

test('catalog migration backfills stable image order and creates lookup indexes', () =>
  withTestDatabase(async ({ pool }) => {
    const connection = await pool.getConnection();
    try {
      await baseline(connection);
      await insertImages(pool);
      await runMigrations({ connection, migrations, mode: 'apply' });

      assert.deepEqual(await imageOrder(connection), [
        { id: 10, variantId: 1, sortOrder: 0 },
        { id: 20, variantId: 1, sortOrder: 1 },
        { id: 30, variantId: 1, sortOrder: 2 },
        { id: 40, variantId: 2, sortOrder: 0 }
      ]);
      const [[column]] = await connection.query("SHOW COLUMNS FROM product_images LIKE 'sort_order'");
      assert.equal(column.Type, 'int unsigned');
      assert.equal(column.Null, 'NO');
      assert.deepEqual(await namedIndexes(connection), [
        { tableName: 'sold_products_box', indexName: 'idx_box_store_sold_at_id', columnsList: 'store_id,sold_at,id' },
        { tableName: 'sold_products_pair', indexName: 'idx_pair_store_sold_at_id', columnsList: 'store_id,sold_at,id' },
        { tableName: 'product_images', indexName: 'idx_product_images_variant_order', columnsList: 'product_variant_id,sort_order,id' },
        { tableName: 'products', indexName: 'idx_products_art_no_id', columnsList: 'art_no,id' },
        { tableName: 'product_variant', indexName: 'idx_variant_store_product_id', columnsList: 'store_id,product_id,id' }
      ]);
    } finally {
      connection.release();
    }
  }));

test('catalog migration resumes safely after partial application', () =>
  withTestDatabase(async ({ pool }) => {
    const connection = await pool.getConnection();
    try {
      await baseline(connection);
      await insertImages(pool);
      await connection.query('ALTER TABLE product_images ADD COLUMN sort_order INT UNSIGNED NULL');

      await catalogueMigration.up(connection);
      const first = await imageOrder(connection);
      await catalogueMigration.up(connection);

      assert.deepEqual(await imageOrder(connection), first);
      assert.deepEqual(first.map(({ id, sortOrder }) => [id, sortOrder]), [[10, 0], [20, 1], [30, 2], [40, 0]]);
    } finally {
      connection.release();
    }
  }));
