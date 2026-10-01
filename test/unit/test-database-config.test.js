const test=require('node:test');
const assert=require('node:assert/strict');
const {readTestDbConfig}=require('../support/test-database');
test('test database configuration never falls back to application credentials',()=>{
 for(const env of [{},{DB_NAME:'shoes_store_db'},{TEST_DB_NAME:'shoes_store_db'},{TEST_DB_NAME:'shoe_migration_test_a;DROP DATABASE x'}])assert.throws(()=>readTestDbConfig(env));
 const base={TEST_DB_HOST:'127.0.0.1',TEST_DB_PORT:'3306',TEST_DB_USER:'test',TEST_DB_PASSWORD:'',TEST_DB_NAME:'shoe_migration_test_local'};
 assert.equal(readTestDbConfig(base).database,'shoe_migration_test_local');
 assert.throws(()=>readTestDbConfig({...base,TEST_DB_PORT:'NaN'}));
});
