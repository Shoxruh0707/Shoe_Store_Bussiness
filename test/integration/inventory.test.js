const test=require('node:test');const assert=require('node:assert/strict');
const {withInventory,sale,product}=require('../support/inventory-app');
test('concurrent last-pair sale cannot oversell; cancellation restores exactly once',()=>withInventory(async({request,pool})=>{
 await pool.query('UPDATE box_stock SET quantity=0 WHERE store_id=1');
 const results=await Promise.all([request(3,'/inventory/sold','POST',sale),request(3,'/inventory/sold','POST',sale)]);
 assert.equal(results.filter(r=>r.status===200).length,1,JSON.stringify(results));
 assert.ok(results.some(r=>[400,404,409].includes(r.status)));
 const [[total]]=await pool.query('SELECT COALESCE(SUM(quantity),0) AS n FROM inventory WHERE store_id=1');assert.equal(Number(total.n),0);
 const [sales]=await pool.query('SELECT id FROM sold_products_pair');assert.equal(sales.length,1);
 assert.equal((await request(2,`/sold-products/pair-${sales[0].id}/cancel`,'POST',{})).status,200);
 assert.equal((await request(2,`/sold-products/pair-${sales[0].id}/cancel`,'POST',{})).status,409);
 const [[restored]]=await pool.query('SELECT quantity FROM inventory WHERE store_id=1');assert.equal(restored.quantity,1);
}));
test('concurrent box opening conserves stock and successful products commit',()=>withInventory(async({request,pool})=>{
 const result=await Promise.all([request(2,'/box-stock/1/open','POST',{}),request(2,'/box-stock/1/open','POST',{})]);
 assert.equal(result.filter(r=>r.status===200).length,1,JSON.stringify(result));
 const [[box]]=await pool.query('SELECT quantity FROM box_stock WHERE id=1');assert.equal(box.quantity,0);
 const [pairs]=await pool.query('SELECT size,quantity FROM inventory WHERE store_id=1 ORDER BY size');assert.deepEqual(pairs.map(r=>[r.size,r.quantity]),[['38',2],['39',1]]);
 const created=await request(1,'/products','POST',product);assert.equal(created.status,201,JSON.stringify(created.body));
 const [[stored]]=await pool.execute('SELECT id FROM products WHERE id=?',[created.body.data.id]);assert.ok(stored);
 assert.equal((await request(1,'/products','POST',{...product,price:-1})).status,400);
}));
