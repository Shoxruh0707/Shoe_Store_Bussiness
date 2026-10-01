const mysql = require('mysql2/promise');
const crypto = require('node:crypto');
function readTestDbConfig(env) {
  for (const key of ['HOST','PORT','USER','PASSWORD','NAME']) if (env[`TEST_DB_${key}`] === undefined) throw new Error(`Missing TEST_DB_${key}; application DB configuration is never used`);
  if (!/^shoe_migration_test_[a-z0-9_]{1,25}$/.test(env.TEST_DB_NAME)) throw new Error('Unsafe TEST_DB_NAME');
  const port = Number(env.TEST_DB_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid TEST_DB_PORT');
  if (!env.TEST_DB_HOST || !env.TEST_DB_USER) throw new Error('Invalid test database configuration');
  return {host:env.TEST_DB_HOST,port,user:env.TEST_DB_USER,password:env.TEST_DB_PASSWORD,database:env.TEST_DB_NAME};
}
async function withTestDatabase(run) {
  const config = readTestDbConfig(process.env);
  const database = `${config.database}_${crypto.randomBytes(5).toString('hex')}`;
  const admin = await mysql.createConnection({...config,database:undefined,connectTimeout:3000});
  let pool, created=false;
  try {
    // CREATE without IF NOT EXISTS refuses to claim a pre-existing schema.
    await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    created=true;
    pool=mysql.createPool({...config,database,connectionLimit:6,decimalNumbers:true,dateStrings:true});
    await run({pool,database,config:{...config,database}});
  } finally {
    if(pool) await pool.end();
    if(created) await admin.query(`DROP DATABASE \`${database}\``);
    await admin.end();
  }
}
module.exports={readTestDbConfig,withTestDatabase};
