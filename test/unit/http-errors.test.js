const test=require('node:test');const assert=require('node:assert/strict');const express=require('express');
const {withApp}=require('../support/http');
const {createErrorHandler}=require('../../src/http/errors');
test('unexpected exceptions never expose SQL, credentials or stack',async()=>{
 const logs=[];const app=express();app.get('/',()=>{throw Object.assign(new Error('password=secret-token SELECT * FROM users'),{code:'ER_BAD_FIELD_ERROR'});});app.use(createErrorHandler({logger:{error:r=>logs.push(r)}}));
 await withApp(app,async origin=>{const r=await fetch(origin);assert.equal(r.status,500);const body=await r.json();assert.equal(body.success,false);assert.ok(body.requestId);assert.equal(body.detail,undefined);assert.doesNotMatch(JSON.stringify({body,logs}),/secret-token|SELECT|stack/);});
});
test('safe validation, malformed JSON and body limit use appropriate errors',async()=>{
 const app=express();app.use(express.json({limit:32}));app.post('/',()=>{throw Object.assign(new Error('safe validation'),{statusCode:400,expose:true});});app.use(createErrorHandler({logger:{error:()=>{}}}));
 await withApp(app,async origin=>{for(const [body,status,message] of [['{',400,null],[JSON.stringify({x:'a'.repeat(40)}),413,null],['{}',400,'safe validation']]){const r=await fetch(origin,{method:'POST',headers:{'Content-Type':'application/json'},body});assert.equal(r.status,status);const result=await r.json();if(message)assert.equal(result.message,message);}});
});
test('database failures outside route try blocks return sanitized 500 responses',async()=>{
 const {createApp}=require('../../server');
 const app=createApp({pool:{getConnection:async()=>{throw Error('password=secret-token');}},config:{API_AUTH_REQUIRED:'false'},logger:{error:()=>{}}});
 await withApp(app,async origin=>{const r=await fetch(origin+'/api/products/1',{method:'DELETE'});assert.equal(r.status,500);assert.doesNotMatch(await r.text(),/secret-token/);});
});
