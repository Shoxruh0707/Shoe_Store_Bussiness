const {withTestDatabase}=require('./test-database');
const {runMigrations}=require('../../src/db/migrate');
const {seedFixtures}=require('./fixtures');
const {withApp}=require('./http');
const {createApp}=require('../../server');
const {readConfig}=require('../../src/config');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const secret='synthetic-test-secret-for-cookie-signing';
async function withInventory(run, overrides = {}) {
 return withTestDatabase(async({pool})=>{
 const c=await pool.getConnection();try{await runMigrations({connection:c,migrations:require('../../src/db/migrations'),mode:'apply'});}finally{c.release();}
 const fixtures=await seedFixtures(pool);
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'shoe-api-'));
 try {
 const app=createApp({pool,config:readConfig({SESSION_SECRET:secret}),uploads:{rootDir:dir,tempDir:path.join(dir,'temp')},logger:{error:()=>{}},...overrides});
 await withApp(app,async origin=>{
 const cookies=new Map();
 const login=async id=>{
  const r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({phoneNumber:'+1000000000'+id,password:'test-password'})});
  const cookie=r.headers.get('set-cookie')?.split(';',1)[0];if(cookie)cookies.set(id,cookie);
  return {status:r.status,body:await r.json(),headers:r.headers};
 };
 const request=async(id,url,method='GET',body)=>{
 const headers={};if(id){if(!cookies.has(id))await login(id);headers.cookie=cookies.get(id);}
 if(body!==undefined)headers['Content-Type']='application/json';
 const r=await fetch(origin+'/api'+url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,body:r.status===204?null:await r.json(),headers:r.headers};
 };
 await run({pool,fixtures,request,login,origin});
 });
 }finally{await fs.rm(dir,{recursive:true,force:true});}
 });
}
const product={artNo:'NEW',name:'API shoe',type:'Tufli',seasons:['Summer'],colour:'Black',material:'Leather',price:120,landingPrice:60,price_unit:'thousands',inventory:[{size:38,quantity:2}],images:[]};
const sale={art_no:'ART1',colour_name:'Black',material_type:'Leather',size:'38',sold_price:100,price_unit:'thousands',quantity:1};
module.exports={withInventory,product,sale};
