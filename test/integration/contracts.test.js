const test=require('node:test');const assert=require('node:assert/strict');
const {withInventory,product}=require('../support/inventory-app');
test('password auth, metadata, product envelopes, cost visibility and price units',()=>withInventory(async({request,login,pool})=>{
 assert.equal((await request(null,'/products')).status,401);
 const auth=await login(1);assert.equal(auth.status,200);assert.match(auth.headers.get('set-cookie'),/HttpOnly/);
 assert.equal((await request(3,'/auth/me')).body.store.storeRole,'staff');
 assert.ok((await request(1,'/meta')).body.data.types.includes('Tufli'));
 const owner=await request(1,'/products');assert.equal(owner.status,200);assert.equal(owner.body.data[0].landingPrice,50000);
 const staff=await request(3,'/products');assert.equal(staff.body.data[0].landingPrice,null);
 assert.equal((await request(3,'/products','POST',product)).status,403);
 const created=await request(2,'/products','POST',product);assert.equal(created.status,201,JSON.stringify(created.body));
 assert.equal(created.body.data.price,120000);assert.equal(created.body.data.landingPrice,60000);
 const [[stored]]=await pool.execute('SELECT price FROM product_variant WHERE id=?',[created.body.data.variantId]);assert.equal(stored.price,120000);
 assert.deepEqual((await request(null,'/health')).body,{ok:true});
}));
