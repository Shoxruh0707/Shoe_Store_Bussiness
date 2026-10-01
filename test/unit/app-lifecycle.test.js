const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('import has no listeners, database calls or filesystem effects', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shoe-import-'));
  try {
    fs.writeFileSync(path.join(dir,'.env'),'SHOE_IMPORT_SENTINEL=unexpected\n');
    const script = `const {createApp}=require(${JSON.stringify(path.resolve('server.js'))}); if(typeof createApp!=='function')process.exit(4); if(process.env.SHOE_IMPORT_SENTINEL)process.exit(5);`;
    const result = spawnSync(process.execPath, ['-e', script], {cwd:dir, timeout:2500, env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot}});
    assert.equal(result.status, 0, String(result.stderr));
    assert.deepEqual(fs.readdirSync(dir), ['.env']);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('pending schema prevents startup before constructing or polling', async () => {
  const {startServer}=require('../../src/runtime');
  let constructed=false;
  const pool={getConnection:async()=>({ping:async()=>{},release:()=>{}}),end:async()=>{}};
  await assert.rejects(startServer({pool,config:{},createApp:()=>{constructed=true;},checkSchema:async()=>{throw Object.assign(new Error('pending'),{code:'SCHEMA_MIGRATION_REQUIRED'});}}),{code:'SCHEMA_MIGRATION_REQUIRED'});
  assert.equal(constructed,false);
});

test('database failure prevents app construction and releases owned pool', async () => {
  const {startServer}=require('../../src/runtime');
  let constructed=false, ended=false;
  const pool={getConnection:async()=>{throw new Error('offline');},end:async()=>{ended=true;}};
  await assert.rejects(startServer({pool,config:{},createApp:()=>{constructed=true;}}),/offline/);
  assert.equal(constructed,false); assert.equal(ended,true);
});

test('separate apps use separate configuration and close listeners', async () => {
  const {createApp}=require('../../server');
  const {readConfig}=require('../../src/config');
  const {withApp}=require('../support/http');
  const make = id => createApp({pool:{},config:readConfig({API_AUTH_REQUIRED:'false',DEFAULT_STORE_ID:String(id)}), uploads:{rootDir:os.tmpdir(),tempDir:os.tmpdir()}});
  await withApp(make(7), async origin => {const r=await fetch(origin+'/api/auth/me');assert.equal((await r.json()).store.id,7);});
  await withApp(make(9), async origin => {const r=await fetch(origin+'/api/auth/me');assert.equal((await r.json()).store.id,9);});
});

test('unknown routes return JSON 404 without redirects', async () => {
  const {createApp}=require('../../server');
  const {readConfig}=require('../../src/config');
  const {withApp}=require('../support/http');
  const app=createApp({pool:{},config:readConfig({API_AUTH_REQUIRED:'false'}),uploads:{rootDir:os.tmpdir(),tempDir:os.tmpdir()}});
  await withApp(app,async origin=>{
    const response=await fetch(origin+'/inventory',{redirect:'manual'});
    assert.equal(response.status,404);
    assert.match(response.headers.get('content-type'),/application\/json/);
  });
});

test('runtime close releases resources', async () => {
  const {startServer}=require('../../src/runtime');
  const express=require('express');
  let ended=0,released=0;
  const pool={getConnection:async()=>({ping:async()=>{},release:()=>{released++;}}),end:async()=>{ended++;}};
  const runtime=await startServer({pool,config:{port:0,host:'127.0.0.1'},createApp:()=>express(),checkSchema:async()=>{},prepareUploads:async()=>{}});
  assert.ok(runtime.server.listening); await runtime.close();assert.equal(runtime.server.listening,false);assert.equal(ended,1);assert.equal(released,1);
});

test('deployment contains only api, migrator, mysql and caddy', () => {
  const dockerfile=fs.readFileSync(path.resolve('Dockerfile'),'utf8');
  const compose=fs.readFileSync(path.resolve('docker-compose.yml'),'utf8');
  const caddy=fs.readFileSync(path.resolve('docker/caddy/Caddyfile'),'utf8');
  assert.doesNotMatch(dockerfile,/AS (?:frontend|bot)\b/i);
  assert.doesNotMatch(compose,/^  (?:frontend|bot|channel-bot):/m);
  for(const service of ['mysql','migrate','backend','caddy'])assert.match(compose,new RegExp(`^  ${service}:`,'m'));
  assert.match(compose,/migrate:\s*[\s\S]*?condition: service_completed_successfully/);
  assert.match(compose,/mysql_data:\/var\/lib\/mysql/);
  assert.match(compose,/uploads:\/app\/public\/uploads/);
  assert.equal((caddy.match(/reverse_proxy backend:3000/g)||[]).length,2);
  assert.doesNotMatch(caddy,/reverse_proxy frontend/);
});
