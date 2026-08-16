async function storeColumnExists(pool, columnName) {
  const [rows] = await pool.execute(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'store'
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [columnName]
  );

  return rows.length > 0;
}

async function ensureStoreTelegramColumns(pool) {
  const columns = [
    ["store_image", "VARCHAR(500) NULL"],
    ["channel_name_telegram", "VARCHAR(100) NULL"],
    ["channel_link_telegram", "VARCHAR(255) NULL"],
    ["channel_id", "VARCHAR(20) NULL"]
  ];

  for (const [columnName, definition] of columns) {
    if (!(await storeColumnExists(pool, columnName))) {
      await pool.query(`ALTER TABLE store ADD COLUMN \`${columnName}\` ${definition}`);
    }
  }
}

module.exports = {
  ensureStoreTelegramColumns
};
