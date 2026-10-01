const test=require('node:test');
const assert=require('node:assert/strict');
const {runMigrations}=require('../../src/db/migrate');
test('invalid mode and duplicate migration IDs fail before database access',async()=>{
 const connection={execute:()=>{throw Error('unexpected SQL');}};
 await assert.rejects(runMigrations({connection,migrations:[],mode:'erase'}),{code:'INVALID_MIGRATION_MODE'});
 const m={id:'0001',checksum:'a'.repeat(64),up:async()=>{}};
 await assert.rejects(runMigrations({connection,migrations:[m,m],mode:'apply'}),{code:'INVALID_MIGRATION_REGISTRY'});
});
