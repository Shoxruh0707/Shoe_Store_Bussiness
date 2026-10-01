const test=require('node:test');const assert=require('node:assert/strict');
const {withInventory,product,sale}=require('../support/inventory-app');
test('cross-store resource identifiers cannot change another store inventory',()=>withInventory(async({request,pool})=>{
 const attempts=[['GET','/products/2'],['PUT','/products/2',{...product,variantId:2}],['PUT','/products/2/pair-inventory',{variantId:2,inventory:[{size:38,quantity:99}]}],['PUT','/products/2/box-stock',{variantId:2,boxes:[{id:2,sizeRange:'38-39',quantity:99}]}],['POST','/box-stock/2/open',{}],['POST','/stock-additions/2/cancel',{}],['DELETE','/products/2']];
 for(const [method,url,body]of attempts){const r=await request(1,url,method,body);assert.ok([400,403,404].includes(r.status),url+JSON.stringify(r.body));}
 assert.equal((await request(1,'/products/lookup?artNo=ART2')).body.data,null);
 assert.deepEqual((await request(1,'/products/match?artNo=ART2&colour=Black&material=Leather')).body.data,[]);
 const [[pair]]=await pool.query('SELECT quantity FROM inventory WHERE store_id=2');assert.equal(pair.quantity,1);
 const [[box]]=await pool.query('SELECT quantity FROM box_stock WHERE store_id=2');assert.equal(box.quantity,1);
 const [[variant]]=await pool.query('SELECT price,landing_price FROM product_variant WHERE store_id=2');assert.deepEqual(variant,{price:100000,landing_price:50000});
 for(const [method,url,body]of attempts.filter(a=>a[0]!=='GET'))assert.equal((await request(3,url,method,body)).status,403);
}));
test('foreign variants, prices and sale cancellation remain store-scoped',()=>withInventory(async({request,pool})=>{
 for(const [url,body]of [['/products/1',{...product,variantId:2}],['/products/1/pair-inventory',{variantId:2,inventory:[{size:38,quantity:99}]}],['/products/1/box-stock',{variantId:2,boxes:[{id:2,sizeRange:'38-39',quantity:99}]}]])assert.equal((await request(1,url,'PUT',body)).status,404,url);
 assert.equal((await request(1,'/products/prices','POST',{artNo:'ART2',sellingPrice:999,landingPriceUpdate:88})).status,404);
 const sold=await request(4,'/inventory/sold','POST',{...sale,art_no:'ART2'});assert.equal(sold.status,200);
 const [[row]]=await pool.query('SELECT id,isCancelled FROM sold_products_pair WHERE store_id=2');
 assert.equal((await request(1,`/sold-products/pair-${row.id}/cancel`,'POST',{})).status,404);
 const [[stored]]=await pool.query('SELECT isCancelled FROM sold_products_pair WHERE store_id=2');assert.equal(stored.isCancelled,0);
 const [[variant]]=await pool.query('SELECT price FROM product_variant WHERE id=2');assert.equal(variant.price,100000);
}));
test('staff cannot retrieve cost through detail, matching, lookup or sales',()=>withInventory(async({request})=>{
 for(const url of ['/products/1','/products/match?artNo=ART1&colour=Black&material=Leather','/products/lookup?artNo=ART1']) {
 const r=await request(3,url);assert.equal(r.status,200);const data=r.body.data;const values=Array.isArray(data)?data:[data.product||data];for(const value of values)assert.equal(value.landingPrice,null,url);
 }
 assert.equal((await request(3,'/inventory/sold','POST',sale)).status,200);
 const analytics=await request(3,'/sold-products');assert.equal(analytics.status,200);assert.ok(analytics.body.data.items.length);for(const item of analytics.body.data.items)assert.equal(item.landingPrice,null);
}));
