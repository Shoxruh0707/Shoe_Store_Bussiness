const test=require('node:test');
const assert=require('node:assert/strict');
const {withTestDatabase}=require('../support/test-database');
const {runMigrations}=require('../../src/db/migrate');
test('migration status is read-only; apply is ordered, checksummed and repeatable',()=>withTestDatabase(async({pool})=>{
 const connection=await pool.getConnection();
 try {
 const migrations=[{id:'0001-test',checksum:'a'.repeat(64),up:async c=>c.query('CREATE TABLE example (id INT PRIMARY KEY)')}];
 assert.deepEqual(await runMigrations({connection,migrations,mode:'status'}),{applied:[],pending:['0001-test']});
 const [tables]=await connection.query('SHOW TABLES');assert.equal(tables.length,0);
 assert.deepEqual((await runMigrations({connection,migrations,mode:'apply'})).applied,['0001-test']);
 assert.deepEqual((await runMigrations({connection,migrations,mode:'apply'})).applied,[]);
 await assert.rejects(runMigrations({connection,migrations:[{...migrations[0],checksum:'b'.repeat(64)}],mode:'apply'}),{code:'MIGRATION_CHECKSUM_MISMATCH'});
 }finally{connection.release();}
}));
test('failed DDL is resumable and migration lock excludes a second connection',()=>withTestDatabase(async({pool,database})=>{
 const connection=await pool.getConnection(),other=await pool.getConnection();
 try {
 let crash=true;
 const migrations=[{id:'0001-test',checksum:'a'.repeat(64),up:async c=>{await c.query('CREATE TABLE IF NOT EXISTS example (id INT PRIMARY KEY)');if(crash)throw Error('injected interruption');}}];
 await assert.rejects(runMigrations({connection,migrations,mode:'apply'}),/injected interruption/);
 const [rows]=await connection.query('SELECT * FROM schema_migrations');assert.equal(rows.length,0);
 crash=false;assert.equal((await runMigrations({connection,migrations,mode:'apply'})).applied.length,1);
 const {migrationLockName}=require('../../src/db/migrate');
 await other.execute('SELECT GET_LOCK(?, 0)',[migrationLockName(database)]);
 await assert.rejects(runMigrations({connection,migrations,mode:'apply'}),{code:'MIGRATION_LOCKED'});
 await other.execute('SELECT RELEASE_LOCK(?)',[migrationLockName(database)]);
 }finally{connection.release();other.release();}
}));
