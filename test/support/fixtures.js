const bcrypt=require('bcryptjs');
async function seedFixtures(pool) {
  for (const [table,column,value] of [['brands','brand_name','Unbranded'],['shoe_type','type','Tufli'],['colours','colour_name','Black'],['materials','material_type','Leather']]) await pool.execute(`INSERT INTO ${table} (${column}) VALUES (?)`,[value]);
  await pool.query("INSERT INTO store (id,store_name) VALUES (1,'Test Store'),(2,'Other Store')");
  for(const [id,role,membership,store] of [[1,'admin','owner',1],[2,'seller','manager',1],[3,'seller','staff',1],[4,'admin','owner',2]]) {
    await pool.execute('INSERT INTO users (id,fname,lname,phone_number,password_hash,role,telegram_id) VALUES (?,\'Test\',\'User\',?,?,?,?)',[id,'+1000000000'+id,bcrypt.hashSync('test-password',4),role,1000+id]);
    await pool.execute('INSERT INTO store_users (user_id,store_id,role) VALUES (?,?,?)',[id,store,membership]);
  }
  for(const id of [1,2]) {
    await pool.execute("INSERT INTO products (id,art_no,name,brand_id,type_id) VALUES (?,?, 'Fixture Shoe',1,1)",[id,'ART'+id]);
    await pool.execute('INSERT INTO product_variant (id,product_id,store_id,colour_id,material_id,price,landing_price) VALUES (?,?,?,1,1,100000,50000)',[id,id,id]);
    await pool.execute("INSERT INTO inventory (product_variant_id,store_id,size,quantity) VALUES (?,?,'38',1)",[id,id]);
    await pool.execute("INSERT INTO box_stock (id,product_variant_id,store_id,size_range,quantity) VALUES (?,?,?,'38-39',1)",[id,id,id]);
    await pool.execute("INSERT INTO stock_additions (store_id,user_id,product_variant_id,stock_type,size,quantity) VALUES (?,1,?,'pair','38',1)",[id,id]);
  }
  return {store:1,otherStore:2,owner:1,manager:2,staff:3,otherOwner:4,variant:1,otherVariant:2};
}
module.exports={seedFixtures};
