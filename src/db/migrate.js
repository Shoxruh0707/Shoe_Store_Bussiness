const crypto = require('node:crypto');
const fail = code => Object.assign(new Error(code), {code});
const migrationLockName = database => 'shoe:migrate:' + crypto.createHash('sha256').update(database).digest('hex').slice(0,40);
async function runMigrations({connection,migrations,mode}) {
  if (!['status','apply'].includes(mode)) throw fail('INVALID_MIGRATION_MODE');
  let previous='';
  for (const m of migrations) {
    if (!/^[0-9][a-z0-9_-]*$/.test(m.id) || m.id <= previous || !/^[a-f0-9]{64}$/.test(m.checksum) || typeof m.up !== 'function') throw fail('INVALID_MIGRATION_REGISTRY');
    previous=m.id;
  }
  const [[{database}]] = await connection.query('SELECT DATABASE() AS `database`');
  if (!database) throw fail('MIGRATION_DATABASE_REQUIRED');
  const lock=migrationLockName(database);
  let locked=false;
  try {
    if(mode==='apply') {
      const [[row]]=await connection.execute('SELECT GET_LOCK(?, 0) AS acquired',[lock]);
      if(row.acquired!==1) throw fail('MIGRATION_LOCKED');
      locked=true;
    }
    const [[exists]]=await connection.execute("SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='schema_migrations'");
    let rows=[];
    if(exists.n) [rows]=await connection.query('SELECT id, checksum FROM schema_migrations ORDER BY id');
    for(let i=0;i<rows.length;i++) {
      if(rows[i].id!==migrations[i]?.id) throw fail('MIGRATION_HISTORY_MISMATCH');
      if(rows[i].checksum!==migrations[i].checksum) throw fail('MIGRATION_CHECKSUM_MISMATCH');
    }
    const pending=migrations.slice(rows.length);
    if(mode==='status') return {applied:[],pending:pending.map(m=>m.id)};
    if(!exists.n) await connection.query('CREATE TABLE schema_migrations (id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY, checksum CHAR(64) CHARACTER SET ascii NOT NULL, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB');
    const applied=[];
    for(const migration of pending) {
      await migration.up(connection);
      await connection.execute('INSERT INTO schema_migrations (id, checksum) VALUES (?,?)',[migration.id,migration.checksum]);
      applied.push(migration.id);
    }
    return {applied,pending:[]};
  } finally {if(locked) await connection.execute('SELECT RELEASE_LOCK(?)',[lock]);}
}
module.exports={runMigrations,migrationLockName};
