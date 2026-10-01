const fs=require('node:fs');
const crypto=require('node:crypto');
const migration=require('./0001-current-inventory');
// Normalize line endings so Git's Windows checkout conversion cannot alter identity.
const bytes = file => fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
module.exports=[{
  id:'0001-current-inventory',
  checksum:crypto.createHash('sha256').update(bytes(require.resolve('./0001-current-inventory'))).update('\n').update(bytes(migration.schemaPath)).digest('hex'),
  up:migration.up
}];
