const crypto = require('node:crypto');
const { createCodeDigest } = require('../auth/code-digest');
const { normalizePhone } = require('../auth/identifiers');
const { canAssignRole, canRemoveRole } = require('./permissions');

function httpError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode, expose: true });
}

function cleanOptional(value, maximum, field) {
  if (value === undefined || value === null || value === '') return null;
  const result = String(value).trim();
  if (!result || result.length > maximum) throw httpError(400, `${field} is invalid.`);
  return result;
}

function normalizeEntryCode(value) {
  const code = String(value || '').trim().toUpperCase().replace(/[\s-]/g, '');
  if (!/^[A-F0-9]{10}$/.test(code)) throw httpError(400, 'Invalid store entry code.');
  return code;
}

function createMembershipService({ pool, digestSecret }) {
  const digest = (code) => createCodeDigest({ secret: digestSecret, namespace: 'store-entry', subject: 'global', code });

  async function transaction(work) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const value = await work(connection);
      await connection.commit();
      return value;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function assertUnaffiliated(connection, userId) {
    const [users] = await connection.execute('SELECT id FROM users WHERE id=? FOR UPDATE', [userId]);
    if (!users.length) throw httpError(404, 'User not found.');
    const [memberships] = await connection.execute('SELECT store_id FROM store_users WHERE user_id=? LIMIT 1 FOR UPDATE', [userId]);
    if (memberships.length) throw httpError(409, 'User already belongs to a store.');
  }

  async function closePending(connection, userId) {
    await connection.execute("UPDATE store_invitations SET status='cancelled', resolved_at=NOW(3) WHERE user_id=? AND status='pending'", [userId]);
    await connection.execute("UPDATE seller_store_requests SET status='rejected', resolved_at=NOW() WHERE seller_user_id=? AND status='pending'", [userId]);
  }

  async function createStore(userId, input) {
    const storeName = String(input.storeName || '').trim();
    if (!storeName || storeName.length > 50) throw httpError(400, 'Store name must contain 1-50 characters.');
    const description = cleanOptional(input.description, 5000, 'Description');
    const storeImage = cleanOptional(input.storeImagePath, 500, 'Store image');
    const telegramName = cleanOptional(input.telegramName, 100, 'Telegram name');
    const telegramLink = cleanOptional(input.telegramLink, 255, 'Telegram link');
    const telegramId = cleanOptional(input.telegramId, 45, 'Telegram ID');
    const instagram = cleanOptional(input.instagram, 255, 'Instagram');
    return transaction(async (connection) => {
      await assertUnaffiliated(connection, userId);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const entryCode = crypto.randomBytes(5).toString('hex').toUpperCase();
        try {
          const [inserted] = await connection.execute(
            `INSERT INTO store (owner_user_id, entry_code_digest, store_name, store_image, channel_name_telegram,
              channel_link_telegram, channel_id, description, instagram, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
            [userId, digest(entryCode), storeName, storeImage, telegramName, telegramLink, telegramId, description, instagram]
          );
          await connection.execute("INSERT INTO store_users (user_id, store_id, role) VALUES (?, ?, 'owner')", [userId, inserted.insertId]);
          await closePending(connection, userId);
          return { storeId: inserted.insertId, entryCode };
        } catch (error) {
          if (error.code !== 'ER_DUP_ENTRY') throw error;
        }
      }
      throw httpError(503, 'Could not generate a store entry code. Try again.');
    });
  }

  async function regenerateEntryCode(storeId) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const entryCode = crypto.randomBytes(5).toString('hex').toUpperCase();
      try {
        await pool.execute('UPDATE store SET entry_code_digest=? WHERE id=?', [digest(entryCode), storeId]);
        return { entryCode };
      } catch (error) {
        if (error.code !== 'ER_DUP_ENTRY') throw error;
      }
    }
    throw httpError(503, 'Could not generate a store entry code. Try again.');
  }

  async function requestJoin(userId, input) {
    const entryCode = normalizeEntryCode(input.entryCode);
    return transaction(async (connection) => {
      await assertUnaffiliated(connection, userId);
      const [stores] = await connection.execute('SELECT id FROM store WHERE entry_code_digest=? AND is_active=TRUE LIMIT 1', [digest(entryCode)]);
      if (!stores.length) throw httpError(404, 'Store not found.');
      const [pending] = await connection.execute("SELECT id FROM seller_store_requests WHERE seller_user_id=? AND store_id=? AND status='pending' LIMIT 1 FOR UPDATE", [userId, stores[0].id]);
      if (pending.length) throw httpError(409, 'A join request is already pending.');
      const [inserted] = await connection.execute('INSERT INTO seller_store_requests (seller_user_id, store_id) VALUES (?, ?)', [userId, stores[0].id]);
      return { id: inserted.insertId, storeId: stores[0].id, status: 'pending' };
    });
  }

  async function invite(storeId, actorId, actorRole, input) {
    let phoneNumber;
    try { phoneNumber = normalizePhone(input.phoneNumber); } catch { throw httpError(400, 'Invalid phone number.'); }
    const role = String(input.role || '');
    if (!canAssignRole(actorRole, role)) throw httpError(403, 'You cannot invite this role.');
    return transaction(async (connection) => {
      const [users] = await connection.execute('SELECT id, fname, lname, phone_number AS phoneNumber FROM users WHERE phone_number=? LIMIT 1 FOR UPDATE', [phoneNumber]);
      if (!users.length) throw httpError(404, 'There is no user with this phone number.');
      const user = users[0];
      await assertUnaffiliated(connection, user.id);
      const [pending] = await connection.execute("SELECT id FROM store_invitations WHERE store_id=? AND user_id=? AND status='pending' LIMIT 1 FOR UPDATE", [storeId, user.id]);
      if (pending.length) throw httpError(409, 'An invitation is already pending.');
      const [inserted] = await connection.execute('INSERT INTO store_invitations (store_id, user_id, invited_by_user_id, role) VALUES (?, ?, ?, ?)', [storeId, user.id, actorId, role]);
      return { id: inserted.insertId, user, role, status: 'pending' };
    });
  }

  async function listInvitations(userId) {
    const [rows] = await pool.execute(
      `SELECT i.id, i.role, i.created_at AS createdAt, s.id AS storeId, s.store_name AS storeName
         FROM store_invitations i JOIN store s ON s.id=i.store_id
        WHERE i.user_id=? AND i.status='pending' ORDER BY i.created_at DESC`, [userId]
    );
    return rows;
  }

  async function resolveInvitation(userId, invitationId, accepted) {
    return transaction(async (connection) => {
      const [rows] = await connection.execute("SELECT id, store_id AS storeId, role FROM store_invitations WHERE id=? AND user_id=? AND status='pending' FOR UPDATE", [invitationId, userId]);
      if (!rows.length) throw httpError(404, 'Pending invitation not found.');
      if (accepted) {
        await assertUnaffiliated(connection, userId);
        await connection.execute('INSERT INTO store_users (user_id, store_id, role) VALUES (?, ?, ?)', [userId, rows[0].storeId, rows[0].role]);
        await closePending(connection, userId);
        await connection.execute("UPDATE store_invitations SET status='accepted', resolved_at=NOW(3) WHERE id=?", [invitationId]);
      } else {
        await connection.execute("UPDATE store_invitations SET status='rejected', resolved_at=NOW(3) WHERE id=?", [invitationId]);
      }
      return { accepted, storeId: accepted ? rows[0].storeId : null };
    });
  }

  async function listJoinRequests(storeId) {
    const [rows] = await pool.execute(
      `SELECT r.id, r.requested_at AS requestedAt, u.id AS userId, u.fname, u.lname, u.phone_number AS phoneNumber
         FROM seller_store_requests r JOIN users u ON u.id=r.seller_user_id
        WHERE r.store_id=? AND r.status='pending' ORDER BY r.requested_at`, [storeId]
    );
    return rows;
  }

  async function resolveJoinRequest(storeId, actorId, actorRole, requestId, role) {
    const approved = role !== null;
    if (approved && !canAssignRole(actorRole, role)) throw httpError(403, 'You cannot approve this role.');
    return transaction(async (connection) => {
      const [rows] = await connection.execute("SELECT id, seller_user_id AS userId FROM seller_store_requests WHERE id=? AND store_id=? AND status='pending' FOR UPDATE", [requestId, storeId]);
      if (!rows.length) throw httpError(404, 'Pending join request not found.');
      if (approved) {
        await assertUnaffiliated(connection, rows[0].userId);
        await connection.execute('INSERT INTO store_users (user_id, store_id, role) VALUES (?, ?, ?)', [rows[0].userId, storeId, role]);
        await connection.execute("UPDATE seller_store_requests SET status='approved', resolved_role=?, resolved_at=NOW(), resolved_by_user_id=? WHERE id=?", [role, actorId, requestId]);
        await closePending(connection, rows[0].userId);
      } else {
        await connection.execute("UPDATE seller_store_requests SET status='rejected', resolved_at=NOW(), resolved_by_user_id=? WHERE id=?", [actorId, requestId]);
      }
      return { approved, role: approved ? role : null };
    });
  }

  async function listMembers(storeId) {
    const [rows] = await pool.execute(
      `SELECT u.id AS userId, u.fname, u.lname, u.phone_number AS phoneNumber, u.email, su.role, su.created_at AS joinedAt
         FROM store_users su JOIN users u ON u.id=su.user_id WHERE su.store_id=?
        ORDER BY FIELD(su.role, 'owner','manager','seller'), u.fname, u.lname`, [storeId]
    );
    return rows;
  }

  async function changeRole(storeId, userId, role) {
    if (!['manager', 'seller'].includes(role)) throw httpError(400, 'Role must be manager or seller.');
    const [result] = await pool.execute("UPDATE store_users SET role=? WHERE store_id=? AND user_id=? AND role<>'owner'", [role, storeId, userId]);
    if (!result.affectedRows) throw httpError(404, 'Editable member not found.');
    return { userId, role };
  }

  async function removeMember(storeId, actorRole, userId) {
    return transaction(async (connection) => {
      const [rows] = await connection.execute('SELECT role FROM store_users WHERE store_id=? AND user_id=? FOR UPDATE', [storeId, userId]);
      if (!rows.length) throw httpError(404, 'Member not found.');
      if (!canRemoveRole(actorRole, rows[0].role)) throw httpError(403, 'You cannot remove this member.');
      await connection.execute('DELETE FROM store_users WHERE store_id=? AND user_id=?', [storeId, userId]);
      return { removed: true, userId };
    });
  }

  return { createStore, regenerateEntryCode, requestJoin, invite, listInvitations, resolveInvitation, listJoinRequests, resolveJoinRequest, listMembers, changeRole, removeMember };
}

module.exports = { createMembershipService, normalizeEntryCode };
