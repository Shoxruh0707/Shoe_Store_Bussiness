const test=require('node:test');
const assert=require('node:assert/strict');
const {readConfig}=require('../../src/config');
const valid={NODE_ENV:'production',SESSION_SECRET:'s'.repeat(32),PUBLIC_URL:'https://inventory.example'};
test('production refuses insecure authentication configuration',()=>{
 for(const override of [{API_AUTH_REQUIRED:'false'},{SESSION_SECRET:''},{SESSION_SECRET:'short'},{SESSION_SECRET:'replace_with_at_least_32_random_bytes'},{SESSION_SECRET:' '.repeat(32)},{PUBLIC_URL:'http://inventory.example'},{SESSION_COOKIE_SECURE:'false'}])assert.throws(()=>readConfig({...valid,...override}));
 assert.doesNotThrow(()=>readConfig(valid));
});
test('production canonicalizes HTTPS and forces secure cookie settings',()=>{
 const config=readConfig({...valid,PUBLIC_URL:'HTTPS://inventory.example'});
 assert.equal(config.PUBLIC_URL,'https://inventory.example');assert.equal(config.SESSION_COOKIE_SECURE,'true');
});
test('config does not read ambient env and errors do not reveal values',()=>{
 assert.equal(readConfig({}).API_AUTH_REQUIRED,'true');
 assert.throws(()=>readConfig({...valid,SESSION_SECRET:'secret-should-not-leak'}),e=>!e.message.includes('secret-should-not-leak'));
 assert.equal(readConfig({API_AUTH_REQUIRED:'false'}).API_AUTH_REQUIRED,'false');
});
