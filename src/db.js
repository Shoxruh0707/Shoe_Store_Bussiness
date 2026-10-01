const mysql = require("mysql2/promise");

function createPool(env = {}) { return mysql.createPool({
  host: env.DB_HOST || "127.0.0.1",
  port: Number(env.DB_PORT || 3306),
  user: env.DB_USER || "root",
  password: env.DB_PASSWORD || "",
  database: env.DB_NAME || "shoes_store_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
  dateStrings: true
}); }
let singleton;
function getPool() { return singleton || (singleton = createPool(process.env)); }

async function testConnection() {
  const connection = await getPool().getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}

module.exports = {
  get pool() { return getPool(); },
  createPool,
  testConnection
};
