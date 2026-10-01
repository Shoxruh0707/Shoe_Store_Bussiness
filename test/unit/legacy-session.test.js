const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {createLegacySessionCodec} = require('../../src/auth/legacy-session');
const secret='synthetic-test-secret-not-a-real-credential';
const now=1800000000000;
function cookie(payload, suffix='') {
  const body=Buffer.from(JSON.stringify(payload)).toString('base64url');
  return 'session='+body+'.'+crypto.createHmac('sha256',secret).update(body).digest('base64url')+suffix;
}
const codec=createLegacySessionCodec({secret,clock:()=>now});
test('session expiry and future timestamp boundaries',()=>{
  for(const [issuedAt,valid] of [[now-604799999,true],[now-604800000,false],[now+30000,true],[now+30001,false],[null,false],['yesterday',false]]) {
    assert.equal(Boolean(codec.decode(cookie({userId:1,role:'seller',issuedAt}))),valid);
  }
});
test('malformed cookies and tampering fail closed',()=>{
  const valid=cookie({userId:1,role:'seller',issuedAt:now});
  for(const value of ['session=%zz',valid+'; '+valid,valid+'.extra',valid.replace('session=','session=x'),cookie({userId:-1,role:'seller',issuedAt:now}),cookie({userId:1,role:'unknown',issuedAt:now})]) assert.equal(codec.decode(value),null);
  assert.equal(codec.decode('other=%zz; '+valid).userId,1);
});
test('encoder emits existing signed-cookie format',()=>{
  assert.deepEqual(codec.decode('session='+encodeURIComponent(codec.encode({userId:8,role:'admin'}))),{userId:8,role:'admin',issuedAt:now});
});
