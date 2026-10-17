const fs=require('node:fs');
const crypto=require('node:crypto');
const inventory=require('./0001-current-inventory');
const catalogue=require('./0002-product-search-image-order');
// Normalize line endings so Git's Windows checkout conversion cannot alter identity.
const bytes = file => fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
module.exports=[{
  id:'0001-current-inventory',
  checksum:crypto.createHash('sha256').update(bytes(require.resolve('./0001-current-inventory'))).update('\n').update(bytes(inventory.schemaPath)).digest('hex'),
  up:inventory.up
},{
  id:'0002-product-search-image-order',
  checksum:crypto.createHash('sha256').update(bytes(require.resolve('./0002-product-search-image-order'))).digest('hex'),
  up:catalogue.up
}];
