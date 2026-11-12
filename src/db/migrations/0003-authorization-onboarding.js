const fail = (code) => Object.assign(new Error(code), { code });

async function columns(connection, table) {
  const [rows] = await connection.execute(
    `SELECT COLUMN_NAME AS name
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return new Set(rows.map((row) => row.name));
}

async function indexes(connection, table) {
  const [rows] = await connection.execute(
    `SELECT INDEX_NAME AS name
       FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
      GROUP BY INDEX_NAME`,
    [table]
  );
  return new Set(rows.map((row) => row.name));
}

async function constraints(connection, table) {
  const [rows] = await connection.execute(
    `SELECT CONSTRAINT_NAME AS name
       FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return new Set(rows.map((row) => row.name));
}

async function addColumn(connection, table, name, definition) {
  if (!(await columns(connection, table)).has(name)) {
    await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${name}\` ${definition}`);
  }
}

async function addConstraint(connection, table, name, definition) {
  if (!(await constraints(connection, table)).has(name)) {
    await connection.query(`ALTER TABLE \`${table}\` ADD CONSTRAINT \`${name}\` ${definition}`);
  }
}

async function assertLegacyMembershipsAreUnambiguous(connection) {
  const [multiStore] = await connection.query(
    'SELECT user_id FROM store_users GROUP BY user_id HAVING COUNT(*) > 1 LIMIT 1'
  );
  const [multiOwner] = await connection.query(
    "SELECT store_id FROM store_users WHERE role = 'owner' GROUP BY store_id HAVING COUNT(*) > 1 LIMIT 1"
  );
  if (multiStore.length || multiOwner.length) throw fail('MEMBERSHIP_RECONCILIATION_REQUIRED');
}

async function up(connection) {
  await assertLegacyMembershipsAreUnambiguous(connection);

  await addColumn(connection, 'users', 'email', 'VARCHAR(254) NULL AFTER phone_number');
  await addColumn(connection, 'users', 'email_verified_at', 'DATETIME NULL AFTER email');
  await addColumn(connection, 'users', 'session_version', 'INT UNSIGNED NOT NULL DEFAULT 1 AFTER password_hash');
  if (!(await indexes(connection, 'users')).has('uq_users_email')) {
    await connection.query('ALTER TABLE users ADD UNIQUE INDEX uq_users_email (email)');
  }

  await addColumn(connection, 'store', 'owner_user_id', 'INT UNSIGNED NULL AFTER id');
  await addColumn(connection, 'store', 'entry_code_digest', 'CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER owner_user_id');
  await addColumn(connection, 'store', 'instagram', 'VARCHAR(255) NULL AFTER channel_id');
  await connection.query(
    `UPDATE store s
       JOIN store_users su ON su.store_id = s.id AND su.role = 'owner'
        SET s.owner_user_id = su.user_id
      WHERE s.owner_user_id IS NULL`
  );

  const storeIndexes = await indexes(connection, 'store');
  if (!storeIndexes.has('uq_store_owner_user')) {
    await connection.query('ALTER TABLE store ADD UNIQUE INDEX uq_store_owner_user (owner_user_id)');
  }
  if (!storeIndexes.has('uq_store_entry_code_digest')) {
    await connection.query('ALTER TABLE store ADD UNIQUE INDEX uq_store_entry_code_digest (entry_code_digest)');
  }
  await addConstraint(
    connection,
    'store',
    'fk_store_owner_user',
    'FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT'
  );

  await connection.query("ALTER TABLE store_users MODIFY role ENUM('owner','manager','staff','seller') NOT NULL DEFAULT 'seller'");
  await connection.query("UPDATE store_users SET role = 'seller' WHERE role = 'staff'");
  await connection.query("ALTER TABLE store_users MODIFY role ENUM('owner','manager','seller') NOT NULL DEFAULT 'seller'");
  if (!(await indexes(connection, 'store_users')).has('uq_store_users_user')) {
    await connection.query('ALTER TABLE store_users ADD UNIQUE INDEX uq_store_users_user (user_id)');
  }

  await addColumn(
    connection,
    'seller_store_requests',
    'resolved_role',
    "ENUM('manager','seller') NULL AFTER status"
  );

  await connection.query(`CREATE TABLE IF NOT EXISTS auth_challenges (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    purpose ENUM('signup','password_reset','email_attachment') NOT NULL,
    email VARCHAR(254) NOT NULL,
    user_id INT UNSIGNED NULL,
    code_digest CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    payload_json JSON NULL,
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    request_ip VARCHAR(45) NULL,
    expires_at DATETIME(3) NOT NULL,
    next_resend_at DATETIME(3) NOT NULL,
    consumed_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_auth_challenges_email_purpose (email, purpose, created_at),
    INDEX idx_auth_challenges_user_purpose (user_id, purpose, created_at),
    CONSTRAINT fk_auth_challenges_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);

  await connection.query(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    token_digest CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    expires_at DATETIME(3) NOT NULL,
    consumed_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_password_reset_user (user_id, created_at),
    CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);

  await connection.query(`CREATE TABLE IF NOT EXISTS auth_rate_limits (
    bucket_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    action VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    window_started_at DATETIME(3) NOT NULL,
    attempts INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (bucket_key, action, window_started_at)
  ) ENGINE=InnoDB`);

  await connection.query(`CREATE TABLE IF NOT EXISTS store_invitations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    store_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    invited_by_user_id INT UNSIGNED NULL,
    role ENUM('manager','seller') NOT NULL,
    status ENUM('pending','accepted','rejected','cancelled') NOT NULL DEFAULT 'pending',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    resolved_at DATETIME(3) NULL,
    INDEX idx_store_invitations_user_status (user_id, status, created_at),
    INDEX idx_store_invitations_store_status (store_id, status, created_at),
    CONSTRAINT fk_store_invitations_store FOREIGN KEY (store_id) REFERENCES store(id) ON DELETE CASCADE,
    CONSTRAINT fk_store_invitations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_store_invitations_inviter FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`);
}

module.exports = { up };
