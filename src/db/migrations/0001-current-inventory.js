const fs = require('node:fs');
const path = require('node:path');
const schemaPath = path.join(__dirname, '0001-current-inventory.sql');
const statements = () => fs.readFileSync(schemaPath,'utf8').replace(/^\s*--.*$/gm,'').split(';').map(s=>s.trim()).filter(Boolean);
const fail = code => Object.assign(new Error(code),{code});
async function columns(c, table) {
  const [rows]=await c.execute('SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',[table]);
  return new Map(rows.map(r=>[r.COLUMN_NAME,r.COLUMN_TYPE]));
}
async function up(c) {
  if((await columns(c,'sold_products')).size) throw fail('LEGACY_SALES_RECONCILIATION_REQUIRED');
  // Validate existing key types before any DDL; do not guess tenant ownership.
  for(const table of ['users','store','products','product_variant','box_stock']) {
    const cols=await columns(c,table);
    if(cols.size && !/^int(?:\(\d+\))? unsigned$/.test(cols.get('id')||'')) throw fail('SCHEMA_KEY_TYPE_RECONCILIATION_REQUIRED');
  }
  const existingBox=await columns(c,'box_stock');
  if(existingBox.size && !existingBox.has('store_id')) throw fail('BOX_STORE_RECONCILIATION_REQUIRED');
  for(const statement of statements()) {
    if(!/^CREATE TABLE [a-z_]+\s*\(/.test(statement)) throw fail('UNSAFE_BOOTSTRAP_STATEMENT');
    await c.query(statement.replace('CREATE TABLE ','CREATE TABLE IF NOT EXISTS '));
  }
  for(const [name,type] of [['store_image','VARCHAR(500) NULL'],['channel_name_telegram','VARCHAR(100) NULL'],['channel_link_telegram','VARCHAR(255) NULL'],['channel_id','VARCHAR(45) NULL']]) {
    if(!(await columns(c,'store')).has(name)) await c.query(`ALTER TABLE store ADD COLUMN \`${name}\` ${type}`);
  }
  for(const table of ['sold_products_pair','sold_products_box','stock_additions']) {
    const cols=await columns(c,table);
    if(!cols.has('isCancelled')) await c.query(`ALTER TABLE \`${table}\` ADD COLUMN isCancelled BOOLEAN NOT NULL DEFAULT FALSE`);
    if(cols.has('isCanceled')) await c.query(`UPDATE \`${table}\` SET isCancelled = (isCancelled OR isCanceled) WHERE isCanceled = TRUE`);
  }
  if(!(await columns(c,'sold_products_box')).has('overall_price')) await c.query('ALTER TABLE sold_products_box ADD COLUMN overall_price DECIMAL(10,2) GENERATED ALWAYS AS (sold_price * quantity) STORED');
  const [indexes]=await c.query("SELECT INDEX_NAME AS name FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='products' AND INDEX_NAME<>'PRIMARY' GROUP BY INDEX_NAME HAVING MAX(NON_UNIQUE)=0 AND GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX)='art_no'");
  for(const row of indexes) await c.query(`ALTER TABLE products DROP INDEX \`${row.name.replace(/`/g,'``')}\``);
  // Verify all runtime-used columns; preserve wider columns and optional additions.
  for(const statement of statements()) {
    const table=statement.match(/^CREATE TABLE ([a-z_]+)/)[1];
    const actual=await columns(c,table);
    const required=[...statement.matchAll(/^\s+([a-zA-Z_]+)\s+(?:INT|BIGINT|VARCHAR|CHAR|ENUM|DECIMAL|DATETIME|BOOLEAN|TEXT)\b/gm)].map(m=>m[1]).filter(n=>n!=='description');
    if(required.some(n=>!actual.has(n))) throw fail('SCHEMA_COLUMN_RECONCILIATION_REQUIRED');
  }
}
module.exports={up,columns,statements,schemaPath};
