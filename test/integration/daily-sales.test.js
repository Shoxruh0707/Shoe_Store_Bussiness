const test = require('node:test');
const assert = require('node:assert/strict');
const { withInventory } = require('../support/inventory-app');

test('daily sales require authentication and reject invalid calendar dates', () =>
  withInventory(async ({ request }) => {
    assert.equal((await request(null, '/sold-products?date=2026-10-17')).status, 401);
    for (const value of ['', '2026-2-01', '2026-02-29', '2026-04-31', '2026-13-01', 'text']) {
      const result = await request(1, `/sold-products?date=${encodeURIComponent(value)}`);
      assert.equal(result.status, 400, `${value}: ${JSON.stringify(result.body)}`);
      assert.equal(result.body.success, false);
    }
    const leapDay = await request(1, '/sold-products?date=2028-02-29');
    assert.equal(leapDay.status, 200);
    assert.equal(leapDay.body.data.date, '2028-02-29');
  }));

test('daily sales use local-day bounds, stable ordering, fallbacks and store isolation', () =>
  withInventory(async ({ request, pool }) => {
    await pool.query(
      `INSERT INTO product_images (id, product_variant_id, image_path, sort_order)
       VALUES (50, 1, '/uploads/secondary.jpg', 1), (60, 1, '/uploads/primary.jpg', 0)`
    );
    await pool.query("INSERT INTO users (id,fname,lname,phone_number,password_hash,role) VALUES (5,'Gone','Seller','+10000000005','x','seller')");
    await pool.query(
      `INSERT INTO sold_products_pair
         (id,store_id,seller_user_id,product_variant_id,size,sold_price,landing_price,sold_at,isCancelled)
       VALUES
         (8,1,5,1,'38',80000,40000,'2026-10-16 18:59:59',FALSE),
         (9,1,5,1,'38',90000,45000,'2026-10-17 07:00:00',FALSE),
         (10,1,5,1,'38',100000,50000,'2026-10-17 07:00:00',TRUE),
         (11,1,5,1,'38',110000,55000,'2026-10-17 19:00:00',FALSE),
         (12,2,4,2,'38',120000,60000,'2026-10-17 08:00:00',FALSE)`
    );
    await pool.query('SET FOREIGN_KEY_CHECKS=0');
    await pool.query('DELETE FROM users WHERE id=5');
    await pool.query('SET FOREIGN_KEY_CHECKS=1');

    const result = await request(1, '/sold-products?date=2026-10-17');
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.data.viewer.canViewLandingPrice, true);
    assert.deepEqual(result.body.data.items.map((item) => item.id), ['pair-10', 'pair-9']);
    assert.deepEqual(result.body.data.items.map((item) => item.isCancelled), [true, false]);
    for (const item of result.body.data.items) {
      assert.equal(item.soldBy, 'Unknown user');
      assert.equal(item.imagePath, '/uploads/primary.jpg');
      assert.equal(item.artNo, 'ART1');
      assert.equal(item.name, 'Fixture Shoe');
      assert.equal(item.colour, 'Black');
      assert.equal(item.material, 'Leather');
      assert.equal(item.saleType, 'pair');
      assert.equal(item.size, '38');
      assert.equal(item.quantity, 1);
      assert.equal(Number.isSafeInteger(item.soldPrice), true);
      assert.equal(Number.isSafeInteger(item.landingPrice), true);
    }
  }, { clock: () => Date.parse('2026-10-16T20:30:00.000Z') }));

test('omitted date uses application timezone and missing images return null', () =>
  withInventory(async ({ request, pool }) => {
    await pool.query(
      `INSERT INTO sold_products_pair
         (store_id,seller_user_id,product_variant_id,size,sold_price,landing_price,sold_at,isCancelled)
       VALUES (1,1,1,'38',100000,50000,'2026-10-16 19:00:00',FALSE)`
    );
    const result = await request(1, '/sold-products');
    assert.equal(result.status, 200);
    assert.equal(result.body.data.date, '2026-10-17');
    assert.equal(result.body.data.items.length, 1);
    assert.equal(result.body.data.items[0].imagePath, null);
  }, { clock: () => Date.parse('2026-10-16T20:30:00.000Z') }));

test('daily sales preserve box totals and landing-price permissions', () =>
  withInventory(async ({ request, pool }) => {
    await pool.query(
      `INSERT INTO sold_products_box
         (store_id,seller_user_id,box_stock_id,quantity,sold_price,landing_price,sold_at,isCancelled)
       VALUES (1,3,1,2,300000,100000,'2026-10-17 04:00:00',FALSE)`
    );
    await pool.query(
      `INSERT INTO sold_products_pair
         (store_id,seller_user_id,product_variant_id,size,sold_price,landing_price,sold_at,isCancelled)
       VALUES (1,3,1,'38',125000,50000,'2026-10-17 04:00:00',FALSE)`
    );

    const manager = await request(2, '/sold-products?date=2026-10-17');
    assert.equal(manager.body.data.viewer.canViewLandingPrice, true);
    assert.deepEqual(manager.body.data.items.map((item) => item.id), ['pair-1', 'box-1']);
    const managerBox = manager.body.data.items.find((item) => item.saleType === 'box');
    assert.equal(managerBox.soldPrice, 600000);
    assert.equal(managerBox.landingPrice, 200000);

    const staff = await request(3, '/sold-products?date=2026-10-17');
    assert.equal(staff.body.data.viewer.canViewLandingPrice, false);
    assert.equal(staff.body.data.items.length, 2);
    for (const item of staff.body.data.items) assert.equal(item.landingPrice, null);
  }));
