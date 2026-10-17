const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { withInventory } = require('../support/inventory-app');

async function seedSuggestions(pool) {
  await pool.query("INSERT INTO colours (id,colour_name) VALUES (2,'Shimmer')");
  await pool.query("INSERT INTO materials (id,material_type) VALUES (2,'SH Mesh')");
  const products = [
    [3, 'SH', 'Exact shoe', 1, 1],
    [4, 'SH-200', 'Prefix shoe', 1, 1],
    [5, 'ZZSHZZ', 'Article substring', 1, 1],
    [6, 'NAME6', 'Casual sh model', 1, 1],
    [7, 'OTHER7', 'Colour match', 2, 1],
    [8, 'OTHER8', 'Material match', 1, 2],
    [9, 'SH-900', 'Later prefix', 1, 1],
    [10, 'PCT%1', 'Literal percent', 1, 1]
  ];
  for (const [id, artNo, name, colourId, materialId] of products) {
    await pool.execute('INSERT INTO products (id,art_no,name,brand_id,type_id) VALUES (?,?,?,1,1)', [id, artNo, name]);
    await pool.execute(
      'INSERT INTO product_variant (id,product_id,store_id,colour_id,material_id,price,landing_price) VALUES (?,?,1,?,?,250000,150000)',
      [id, id, colourId, materialId]
    );
    await pool.execute("INSERT INTO product_seasons (product_id,season) VALUES (?,'autumn'),(?,'winter')", [id, id]);
  }
  await pool.query(
    `INSERT INTO product_images (id,product_variant_id,image_path,sort_order)
     VALUES (100,3,'/uploads/secondary.jpg',1),(101,3,'/uploads/primary.jpg',0)`
  );
}

test('product suggestions enforce authentication, active-store access and query validation', () =>
  withInventory(async ({ request, pool }) => {
    assert.equal((await request(null, '/products/suggestions?q=ART')).status, 401);
    await pool.execute(
      'INSERT INTO users (id,fname,lname,phone_number,password_hash,role) VALUES (6,\'No\',\'Store\',?,?,\'seller\')',
      ['+10000000006', bcrypt.hashSync('test-password', 4)]
    );
    assert.equal((await request(6, '/products/suggestions?q=ART')).status, 403);

    for (const url of [
      '/products/suggestions',
      '/products/suggestions?q=',
      `/products/suggestions?q=${'x'.repeat(101)}`,
      '/products/suggestions?q=ART&limit=',
      '/products/suggestions?q=ART&limit=0',
      '/products/suggestions?q=ART&limit=21',
      '/products/suggestions?q=ART&limit=1.5',
      '/products/suggestions?q=ART&limit=+2',
      '/products/suggestions?q=ART&limit=text'
    ]) {
      const result = await request(1, url);
      assert.equal(result.status, 400, `${url}: ${JSON.stringify(result.body)}`);
      assert.equal(result.body.success, false);
    }
  }));

test('product suggestions rank, limit and deduplicate store variants in one compact shape', () =>
  withInventory(async ({ request, pool }) => {
    await seedSuggestions(pool);

    const defaultLimit = await request(1, '/products/suggestions?q=sh');
    assert.equal(defaultLimit.status, 200, JSON.stringify(defaultLimit.body));
    assert.deepEqual(defaultLimit.body.data.items.map((item) => item.variantId), [3, 4, 9, 1, 5, 6]);

    const all = await request(1, '/products/suggestions?q=SH&limit=20');
    assert.deepEqual(all.body.data.items.map((item) => item.variantId), [3, 4, 9, 1, 5, 6, 7, 8]);
    assert.equal(new Set(all.body.data.items.map((item) => item.variantId)).size, 8);
    const exact = all.body.data.items[0];
    assert.deepEqual(Object.keys(exact).sort(), [
      'artNo', 'colour', 'id', 'landingPrice', 'material', 'name', 'price',
      'primaryImagePath', 'seasons', 'type', 'variantId'
    ]);
    assert.deepEqual(exact.seasons, ['Autumn', 'Winter']);
    assert.equal(exact.primaryImagePath, '/uploads/primary.jpg');
    assert.equal(exact.price, 250000);
    assert.equal(exact.landingPrice, 150000);
    assert.equal(Number.isSafeInteger(exact.price), true);
    assert.equal((await request(1, '/products/suggestions?q=SH&limit=2')).body.data.items.length, 2);
  }));

test('product suggestions treat wildcard input literally and enforce store and cost isolation', () =>
  withInventory(async ({ request, pool }) => {
    await seedSuggestions(pool);

    const percent = await request(1, '/products/suggestions?q=%25&limit=20');
    assert.deepEqual(percent.body.data.items.map((item) => item.artNo), ['PCT%1']);
    assert.deepEqual((await request(1, '/products/suggestions?q=_&limit=20')).body.data.items, []);

    assert.deepEqual((await request(1, '/products/suggestions?q=ART2&limit=20')).body.data.items, []);
    const owner = await request(1, '/products/suggestions?q=ART1&limit=20');
    assert.deepEqual(owner.body.data.items.map((item) => item.artNo), ['ART1']);
    assert.equal(owner.body.data.items[0].landingPrice, 50000);

    const manager = await request(2, '/products/suggestions?q=ART1&limit=20');
    assert.equal(manager.body.data.items[0].landingPrice, 50000);
    const staff = await request(3, '/products/suggestions?q=ART1&limit=20');
    assert.equal(staff.body.data.items[0].landingPrice, null);
  }));
