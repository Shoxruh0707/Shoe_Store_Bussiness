const mysql=require('mysql2/promise');
const {runMigrations}=require('../src/db/migrate');
async function main(args=process.argv.slice(2),env=process.env) {
  if(args.length!==1 || !['status','apply'].includes(args[0])) throw new Error('Usage: node scripts/migrate.js status|apply');
  for(const key of ['HOST','PORT','USER','PASSWORD','NAME']) if(env[`MIGRATION_DB_${key}`]===undefined) throw new Error(`Missing MIGRATION_DB_${key}`);
  const port=Number(env.MIGRATION_DB_PORT);
  if(!Number.isInteger(port)||port<1||port>65535||!env.MIGRATION_DB_NAME)throw new Error('Invalid migration database configuration');
  const connection=await mysql.createConnection({host:env.MIGRATION_DB_HOST,port,user:env.MIGRATION_DB_USER,password:env.MIGRATION_DB_PASSWORD,database:env.MIGRATION_DB_NAME,connectTimeout:5000});
  try{return await runMigrations({connection,migrations:require('../src/db/migrations'),mode:args[0]});}
  finally{await connection.end();}
}
module.exports={main};
if(require.main===module) {
  require('dotenv').config();
  main().then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error('Migration failed:',error.code||'INVALID_CONFIGURATION');process.exitCode=1;});
}
