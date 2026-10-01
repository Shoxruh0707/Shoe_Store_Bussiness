const {runMigrations}=require('./migrate');
async function assertSchemaReady(pool) {
  const connection=await pool.getConnection();
  try {
    const status=await runMigrations({connection,migrations:require('./migrations'),mode:'status'});
    if(status.pending.length) throw Object.assign(new Error('Run explicit database migrations before starting services'),{code:'SCHEMA_MIGRATION_REQUIRED'});
    const {statements,columns}=require('./migrations/0001-current-inventory');
    for(const statement of statements()) {
      const table=statement.match(/^CREATE TABLE ([a-z_]+)/)[1];
      const actual=await columns(connection,table);
      const names=[...statement.matchAll(/^\s+([a-zA-Z_]+)\s+(?:INT|BIGINT|VARCHAR|CHAR|ENUM|DECIMAL|DATETIME|BOOLEAN|TEXT)\b/gm)].map(m=>m[1]).filter(n=>n!=='description');
      if(names.some(n=>!actual.has(n))) throw Object.assign(new Error('Required database columns are missing'),{code:'SCHEMA_MIGRATION_REQUIRED'});
    }
  }finally{connection.release();}
}
module.exports={assertSchemaReady};
