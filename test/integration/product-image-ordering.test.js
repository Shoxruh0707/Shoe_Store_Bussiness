const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { withInventory, product } = require('../support/inventory-app');

function image(name, content, type = 'image/png') {
  return { name, type, data: Buffer.from(content).toString('base64') };
}

function editFixture(images) {
  return {
    artNo: 'ART1', name: 'Fixture Shoe', type: 'Tufli', seasons: ['Summer'],
    colour: 'Black', material: 'Leather', price: 100000, landingPrice: 50000,
    inventory: [{ size: 38, quantity: 1 }], variantId: 1, ...(images === undefined ? {} : { images })
  };
}

test('product image order follows create and update arrays while preserving retained IDs', () =>
  withInventory(async ({ request, pool }) => {
    const created = await request(1, '/products', 'POST', {
      ...product,
      artNo: 'ORDERED',
      images: [image('first.png', 'first'), image('second.png', 'second')]
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const original = created.body.data.images;
    assert.equal(original.length, 2);

    const reordered = await request(1, `/products/${created.body.data.id}`, 'PUT', {
      ...product,
      artNo: 'ORDERED',
      variantId: created.body.data.variantId,
      images: [original[1], original[0]]
    });
    assert.equal(reordered.status, 200, JSON.stringify(reordered.body));
    assert.deepEqual(reordered.body.data.images.map((entry) => entry.id), [original[1].id, original[0].id]);

    const [stored] = await pool.execute(
      'SELECT id,sort_order AS sortOrder FROM product_images WHERE product_variant_id=? ORDER BY sort_order,id',
      [created.body.data.variantId]
    );
    assert.deepEqual(stored, [
      { id: original[1].id, sortOrder: 0 },
      { id: original[0].id, sortOrder: 1 }
    ]);
  }));

test('explicit removals delete images while omitted images preserve the existing order', () =>
  withInventory(async ({ request, uploadsDir }) => {
    const created = await request(1, '/products', 'POST', {
      ...product,
      artNo: 'REMOVE',
      images: [image('first.png', 'first'), image('second.png', 'second')]
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const [first, second] = created.body.data.images;

    const removed = await request(1, `/products/${created.body.data.id}`, 'PUT', {
      ...product, artNo: 'REMOVE', variantId: created.body.data.variantId, images: [second]
    });
    assert.deepEqual(removed.body.data.images.map((entry) => entry.id), [second.id]);
    await assert.rejects(fs.access(path.join(uploadsDir, path.basename(first.path))), { code: 'ENOENT' });

    const { images: _fixtureImages, ...productWithoutImages } = product;
    const omitted = await request(1, `/products/${created.body.data.id}`, 'PUT', {
      ...productWithoutImages, artNo: 'REMOVE', variantId: created.body.data.variantId
    });
    assert.deepEqual(omitted.body.data.images.map((entry) => entry.id), [second.id]);

    const emptied = await request(1, `/products/${created.body.data.id}`, 'PUT', {
      ...product, artNo: 'REMOVE', variantId: created.body.data.variantId, images: []
    });
    assert.deepEqual(emptied.body.data.images, []);
    await assert.rejects(fs.access(path.join(uploadsDir, path.basename(second.path))), { code: 'ENOENT' });
  }));

test('matching-variant POST appends new images after existing ordered images', () =>
  withInventory(async ({ request }) => {
    const first = await request(1, '/products', 'POST', {
      ...product, artNo: 'APPEND', images: [image('first.png', 'first')]
    });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const appended = await request(1, '/products', 'POST', {
      ...product, artNo: 'APPEND', images: [image('second.png', 'second')]
    });
    assert.equal(appended.status, 200, JSON.stringify(appended.body));
    assert.deepEqual(appended.body.data.images.map((entry) => entry.id), [
      first.body.data.images[0].id,
      appended.body.data.images[1].id
    ]);
  }));

test('duplicate and foreign image IDs fail without changing the variant', () =>
  withInventory(async ({ request, pool }) => {
    await pool.query(
      `INSERT INTO product_images (id,product_variant_id,image_path,sort_order)
       VALUES (201,1,'/uploads/owned.jpg',0),(202,2,'/uploads/foreign.jpg',0)`
    );
    for (const images of [
      [{ id: 201, path: '/uploads/owned.jpg' }, { id: 201, path: '/uploads/owned.jpg' }],
      [{ id: 202, path: '/uploads/foreign.jpg' }]
    ]) {
      const result = await request(1, '/products/1', 'PUT', editFixture(images));
      assert.equal(result.status, 400, JSON.stringify(result.body));
      const [rows] = await pool.query('SELECT id,product_variant_id AS variantId,sort_order AS sortOrder FROM product_images ORDER BY id');
      assert.deepEqual(rows, [
        { id: 201, variantId: 1, sortOrder: 0 },
        { id: 202, variantId: 2, sortOrder: 0 }
      ]);
    }
  }));

test('failed multi-image writes roll back rows and remove files already created', () =>
  withInventory(async ({ request, pool, uploadsDir }) => {
    const result = await request(1, '/products', 'POST', {
      ...product,
      artNo: 'ROLLBACK',
      images: [image('valid.png', 'created-first'), image('invalid.bmp', 'fails-second', 'image/bmp')]
    });
    assert.equal(result.status, 400, JSON.stringify(result.body));
    const [[count]] = await pool.query("SELECT COUNT(*) AS n FROM products WHERE art_no='ROLLBACK'");
    assert.equal(count.n, 0);
    const entries = await fs.readdir(uploadsDir, { withFileTypes: true });
    assert.deepEqual(entries.filter((entry) => entry.isFile()).map((entry) => entry.name), []);
  }));

test('equal sort positions use image ID as deterministic serialization fallback', () =>
  withInventory(async ({ request, pool }) => {
    await pool.query(
      `INSERT INTO product_images (id,product_variant_id,image_path,sort_order)
       VALUES (300,1,'/uploads/later-id.jpg',0),(299,1,'/uploads/lower-id.jpg',0)`
    );
    const detail = await request(1, '/products/1');
    assert.deepEqual(detail.body.data.images.map((entry) => entry.id), [299, 300]);
    const suggestion = await request(1, '/products/suggestions?q=ART1');
    assert.equal(suggestion.body.data.items[0].primaryImagePath, '/uploads/lower-id.jpg');
  }));
