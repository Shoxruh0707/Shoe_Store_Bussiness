const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "shoes_store_app",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "shoes_store_db",
  max: 10
});

function quoteCamelAliases(sql) {
  return sql.replace(/\bAS\s+([A-Za-z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*)\b/g, 'AS "$1"');
}

function translatePlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function addReturningId(sql) {
  if (!/^\s*INSERT\s+INTO\s+/i.test(sql) || /\bRETURNING\b/i.test(sql)) {
    return sql;
  }
  return `${sql} RETURNING id`;
}

function normalizeSql(sql) {
  return translatePlaceholders(addReturningId(quoteCamelAliases(sql)));
}

function writeResult(result) {
  const summary = {
    affectedRows: result.rowCount || 0,
    insertId: result.rows?.[0]?.id
  };

  return [summary, result.fields];
}

async function executeWith(client, sql, params = []) {
  const normalizedSql = normalizeSql(sql);
  const result = await client.query(normalizedSql, params);

  if (/^\s*SELECT\b/i.test(sql)) {
    return [result.rows, result.fields];
  }

  return writeResult(result);
}

async function execute(sql, params = []) {
  return executeWith(pool, sql, params);
}

async function query(sql, params = []) {
  return execute(sql, params);
}

async function getConnection() {
  const client = await pool.connect();

  return {
    execute: (sql, params = []) => executeWith(client, sql, params),
    query: (sql, params = []) => executeWith(client, sql, params),
    beginTransaction: () => client.query("BEGIN"),
    commit: () => client.query("COMMIT"),
    rollback: () => client.query("ROLLBACK"),
    release: () => client.release()
  };
}

async function testConnection() {
  await pool.query("SELECT 1");
}

module.exports = {
  pool: {
    execute,
    query,
    getConnection
  },
  testConnection
};
