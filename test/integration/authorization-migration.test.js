const test = require('node:test');
const assert = require('node:assert/strict');
const { withTestDatabase } = require('../support/test-database');
const { runMigrations } = require('../../src/db/migrate');
const migrations = require('../../src/db/migrations');

test('authorization migration adds recoverable auth and single-store membership schema', () => withTestDatabase(async ({ pool }) => {
  const connection = await pool.getConnection();
  try {
    await runMigrations({ connection, migrations, mode: 'apply' });
    const [userColumns] = await connection.query("SHOW COLUMNS FROM users WHERE Field IN ('email','email_verified_at','session_version')");
    assert.deepEqual(userColumns.map((column) => column.Field).sort(), ['email', 'email_verified_at', 'session_version']);
    const [storeColumns] = await connection.query("SHOW COLUMNS FROM store WHERE Field IN ('owner_user_id','entry_code_digest','instagram')");
    assert.deepEqual(storeColumns.map((column) => column.Field).sort(), ['entry_code_digest', 'instagram', 'owner_user_id']);
    const [tables] = await connection.query(
      "SELECT TABLE_NAME AS name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('auth_challenges','password_reset_tokens','auth_rate_limits','store_invitations') ORDER BY TABLE_NAME"
    );
    assert.deepEqual(tables.map((row) => row.name), ['auth_challenges', 'auth_rate_limits', 'password_reset_tokens', 'store_invitations']);
    await connection.execute(
      "INSERT INTO users (id,fname,lname,phone_number,password_hash,role,email,email_verified_at) VALUES (501,'Legacy','Owner','+998900000501',?,'seller',NULL,NULL)",
      ['x'.repeat(60)]
    );
    await connection.execute("INSERT INTO store (id,store_name,is_active) VALUES (501,'First',TRUE),(502,'Second',TRUE)");
    await connection.execute("INSERT INTO store_users (user_id,store_id,role) VALUES (501,501,'seller')");
    await assert.rejects(
      connection.execute("INSERT INTO store_users (user_id,store_id,role) VALUES (501,502,'seller')"),
      (error) => error.code === 'ER_DUP_ENTRY'
    );
    await connection.execute(
      "INSERT INTO users (id,fname,lname,phone_number,password_hash,role,email,email_verified_at) VALUES (502,'Email','One','+998900000502',?,'seller','case@example.com',NOW())",
      ['x'.repeat(60)]
    );
    await assert.rejects(
      connection.execute(
        "INSERT INTO users (id,fname,lname,phone_number,password_hash,role,email,email_verified_at) VALUES (503,'Email','Two','+998900000503',?,'seller','CASE@example.com',NOW())",
        ['x'.repeat(60)]
      ),
      (error) => error.code === 'ER_DUP_ENTRY'
    );
  } finally {
    connection.release();
  }
}));

test('authorization migration refuses ambiguous legacy memberships before altering users', () => withTestDatabase(async ({ pool }) => {
  const connection = await pool.getConnection();
  try {
    await runMigrations({ connection, migrations: migrations.slice(0, 2), mode: 'apply' });
    await connection.execute(
      "INSERT INTO users (id,fname,lname,phone_number,password_hash,role) VALUES (601,'Multi','Store','+998900000601',?,'seller')",
      ['x'.repeat(60)]
    );
    await connection.query("INSERT INTO store (id,store_name,is_active) VALUES (601,'One',TRUE),(602,'Two',TRUE)");
    await connection.query("INSERT INTO store_users (user_id,store_id,role) VALUES (601,601,'owner'),(601,602,'manager')");
    await assert.rejects(
      runMigrations({ connection, migrations, mode: 'apply' }),
      (error) => error.code === 'MEMBERSHIP_RECONCILIATION_REQUIRED'
    );
    const [emailColumn] = await connection.query("SHOW COLUMNS FROM users LIKE 'email'");
    assert.equal(emailColumn.length, 0);
  } finally {
    connection.release();
  }
}));
