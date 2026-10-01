const test=require('node:test');
const assert=require('node:assert/strict');
const {withTestDatabase}=require('../support/test-database');
const {runMigrations}=require('../../src/db/migrate');
const migrations=require('../../src/db/migrations');
const {assertSchemaReady}=require('../../src/db/schema-inspection');
test('clean bootstrap, readiness, repeat apply and intact current schema',()=>withTestDatabase(async({pool})=>{
 await assert.rejects(assertSchemaReady(pool),{code:'SCHEMA_MIGRATION_REQUIRED'});
 const c=await pool.getConnection();
 try {
 await runMigrations({connection:c,migrations,mode:'apply'});
 await assertSchemaReady(pool);
 await c.execute("INSERT INTO users (id,fname,lname,phone_number,password_hash,role) VALUES (123,'Test','User','+10000000001',?,'seller')",['x'.repeat(60)]);
 await c.query("ALTER TABLE store MODIFY channel_id VARCHAR(100)");
 await c.query('DELETE FROM schema_migrations');
 await runMigrations({connection:c,migrations,mode:'apply'});
 const [[user]]=await c.query('SELECT id FROM users');assert.equal(user.id,123);
 const [[col]]=await c.query("SHOW COLUMNS FROM store LIKE 'channel_id'");assert.equal(col.Type,'varchar(100)');
 assert.deepEqual((await runMigrations({connection:c,migrations,mode:'apply'})).applied,[]);
 const [fk]=await c.query("SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='box_stock' AND COLUMN_NAME='store_id'");assert.match(fk[0].COLUMN_TYPE,/unsigned/);
 }finally{c.release();}
}));
test('canonical migration resumes after a real partially committed bootstrap',()=>withTestDatabase(async({pool})=>{
 const c=await pool.getConnection();try {
 let creates=0;
 const interrupted={execute:c.execute.bind(c),query:async(sql,...args)=>{const result=await c.query(sql,...args);if(/^CREATE TABLE IF NOT EXISTS/.test(sql)&&++creates===3)throw Error('canonical interruption');return result;}};
 await assert.rejects(runMigrations({connection:interrupted,migrations,mode:'apply'}),/canonical interruption/);
 await assert.rejects(assertSchemaReady(pool),{code:'SCHEMA_MIGRATION_REQUIRED'});
 const [tables]=await c.query('SHOW TABLES');assert.equal(tables.length,4);
 await runMigrations({connection:c,migrations,mode:'apply'});await assertSchemaReady(pool);
 const [[count]]=await c.query('SELECT COUNT(*) AS n FROM schema_migrations');assert.equal(count.n,1);
 }finally{c.release();}
}));
test('ambiguous box ownership stops before touching existing rows',()=>withTestDatabase(async({pool})=>{
 const c=await pool.getConnection();try {
 await c.query('CREATE TABLE box_stock (id INT UNSIGNED PRIMARY KEY, quantity INT NOT NULL)');
 await c.query('INSERT INTO box_stock VALUES (77,9)');
 await assert.rejects(runMigrations({connection:c,migrations,mode:'apply'}),{code:'BOX_STORE_RECONCILIATION_REQUIRED'});
 const [rows]=await c.query('SELECT * FROM box_stock');assert.deepEqual(rows,[{id:77,quantity:9}]);
 }finally{c.release();}
}));
test('historical cancellation alias preserves state; legacy sales halt migration',()=>withTestDatabase(async({pool})=>{
 const c=await pool.getConnection();try {
 await runMigrations({connection:c,migrations,mode:'apply'});
 await c.query('ALTER TABLE sold_products_pair CHANGE isCancelled isCanceled BOOLEAN NOT NULL DEFAULT FALSE');
 const {seedFixtures}=require('../support/fixtures');const f=await seedFixtures(pool);
 await c.execute('INSERT INTO sold_products_pair (store_id,seller_user_id,product_variant_id,size,sold_price,landing_price,isCanceled) VALUES (?,?,?,\'38\',100,50,TRUE)',[f.store,f.owner,f.variant]);
 await c.query('DELETE FROM schema_migrations');
 await runMigrations({connection:c,migrations,mode:'apply'});
 const [[sale]]=await c.query('SELECT isCanceled,isCancelled FROM sold_products_pair');assert.equal(sale.isCanceled,1);assert.equal(sale.isCancelled,1);
 await c.query('CREATE TABLE sold_products (id INT PRIMARY KEY)');await c.query('DELETE FROM schema_migrations');
 await assert.rejects(runMigrations({connection:c,migrations,mode:'apply'}),{code:'LEGACY_SALES_RECONCILIATION_REQUIRED'});
 }finally{c.release();}
}));
