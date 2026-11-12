const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { createCodeDigest, safeEqualDigest } = require('./code-digest');
const { normalizeEmail, normalizePhone, validatePasswordPair } = require('./identifiers');

const TEN_MINUTES = 10 * 60 * 1000;
const ONE_MINUTE = 60 * 1000;

const failure = (code, statusCode = 400) => Object.assign(new Error(code), { code, statusCode, expose: true });
const sqlDate = (milliseconds) => new Date(milliseconds).toISOString().replace('T', ' ').replace('Z', '');
const dateMs = (value) => Date.parse(String(value).replace(' ', 'T') + 'Z');
const payloadOf = (value) => typeof value === 'string' ? JSON.parse(value) : value;

function createChallengeService({ pool, mailer, clock = Date.now, randomInt = crypto.randomInt, randomBytes = crypto.randomBytes, digestSecret }) {
  const makeCode = () => String(randomInt(100000, 1000000)).padStart(6, '0');
  const digest = (purpose, email, code) => createCodeDigest({ secret: digestSecret, namespace: purpose, subject: email, code });
  const resetTokenDigest = (token) => createCodeDigest({ secret: digestSecret, namespace: 'reset-token', subject: 'reset', code: token });

  async function rateLimit(action, subject, ip) {
    const now = clock();
    const windowStart = Math.floor(now / TEN_MINUTES) * TEN_MINUTES;
    const dimensions = [[`subject:${subject}`, 5], [`ip:${ip || 'unknown'}`, 20]];
    for (const [dimension, maximum] of dimensions) {
      const bucket = crypto.createHmac('sha256', digestSecret).update(`${action}\0${dimension}`).digest('hex');
      await pool.execute(
        `INSERT INTO auth_rate_limits (bucket_key,action,window_started_at,attempts)
         VALUES (?,?,?,1)
         ON DUPLICATE KEY UPDATE attempts=attempts+1`,
        [bucket, action, sqlDate(windowStart)]
      );
      const [[row]] = await pool.execute(
        'SELECT attempts FROM auth_rate_limits WHERE bucket_key=? AND action=? AND window_started_at=?',
        [bucket, action, sqlDate(windowStart)]
      );
      if (row.attempts > maximum) throw failure('RATE_LIMITED', 429);
    }
  }

  async function createChallenge({ purpose, email, userId = null, payload = null, ip }) {
    await rateLimit(`${purpose}_start`, email, ip);
    const id = crypto.randomUUID();
    const code = makeCode();
    const now = clock();
    await pool.execute(
      'UPDATE auth_challenges SET consumed_at=? WHERE purpose=? AND email=? AND consumed_at IS NULL',
      [sqlDate(now), purpose, email]
    );
    await pool.execute(
      `INSERT INTO auth_challenges
       (id,purpose,email,user_id,code_digest,payload_json,attempts,request_ip,expires_at,next_resend_at)
       VALUES (?,?,?,?,?,?,0,?,?,?)`,
      [id, purpose, email, userId, digest(purpose, email, code), payload ? JSON.stringify(payload) : null, ip || null,
        sqlDate(now + TEN_MINUTES), sqlDate(now + ONE_MINUTE)]
    );
    try {
      await mailer.sendVerification({ to: email, code, purpose, expiresInMinutes: 10 });
    } catch (error) {
      await pool.execute('DELETE FROM auth_challenges WHERE id=?', [id]);
      throw error;
    }
    return { challengeId: id, expiresAt: new Date(now + TEN_MINUTES).toISOString() };
  }

  async function lockedChallenge(connection, challengeId, purpose) {
    const [rows] = await connection.execute(
      `SELECT id,purpose,email,user_id AS userId,code_digest AS codeDigest,payload_json AS payload,
              attempts,expires_at AS expiresAt,next_resend_at AS nextResendAt,consumed_at AS consumedAt
         FROM auth_challenges WHERE id=? AND purpose=? FOR UPDATE`,
      [challengeId, purpose]
    );
    if (!rows.length) throw failure('CHALLENGE_NOT_FOUND', 404);
    return rows[0];
  }

  async function validateLockedCode(connection, row, code) {
    if (row.consumedAt) throw failure('CHALLENGE_CONSUMED', 409);
    if (row.attempts >= 5) throw failure('CHALLENGE_LOCKED', 429);
    if (dateMs(row.expiresAt) <= clock()) throw failure('CHALLENGE_EXPIRED', 410);
    if (!safeEqualDigest(row.codeDigest, digest(row.purpose, row.email, String(code || '')))) {
      const attempts = row.attempts + 1;
      await connection.execute('UPDATE auth_challenges SET attempts=? WHERE id=?', [attempts, row.id]);
      return attempts >= 5 ? failure('CHALLENGE_LOCKED', 429) : failure('INVALID_CODE', 400);
    }
    return null;
  }

  async function startSignup(input, context = {}) {
    const fname = typeof input?.fname === 'string' ? input.fname.trim() : '';
    const lname = typeof input?.lname === 'string' ? input.lname.trim() : '';
    const email = normalizeEmail(input?.email);
    const phoneNumber = normalizePhone(input?.phoneNumber);
    const passwordCheck = validatePasswordPair(input?.password, input?.passwordConfirmation);
    if (!fname || fname.length > 20 || !lname || lname.length > 20 || !email || !phoneNumber || !passwordCheck.valid) {
      throw failure(passwordCheck.error || 'INVALID_SIGNUP');
    }
    const [existing] = await pool.execute('SELECT id FROM users WHERE email=? OR phone_number=? LIMIT 1', [email, phoneNumber]);
    if (existing.length) throw failure('ACCOUNT_EXISTS', 409);
    const passwordHash = await bcrypt.hash(input.password, 12);
    return createChallenge({ purpose: 'signup', email, payload: { fname, lname, email, phoneNumber, passwordHash }, ip: context.ip });
  }

  async function verifySignup({ challengeId, code }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const row = await lockedChallenge(connection, challengeId, 'signup');
      const invalid = await validateLockedCode(connection, row, code);
      if (invalid) { await connection.commit(); throw invalid; }
      const payload = payloadOf(row.payload);
      const [created] = await connection.execute(
        `INSERT INTO users (fname,lname,email,email_verified_at,phone_number,password_hash,session_version,role)
         VALUES (?,?,?,? ,?,?,1,'seller')`,
        [payload.fname, payload.lname, payload.email, sqlDate(clock()), payload.phoneNumber, payload.passwordHash]
      );
      await connection.execute('UPDATE auth_challenges SET consumed_at=? WHERE id=?', [sqlDate(clock()), row.id]);
      await connection.commit();
      return { id: created.insertId, fname: payload.fname, lname: payload.lname, email: payload.email,
        phoneNumber: payload.phoneNumber, role: 'seller', sessionVersion: 1 };
    } catch (error) {
      try { await connection.rollback(); } catch {}
      if (error.code === 'ER_DUP_ENTRY') throw failure('ACCOUNT_EXISTS', 409);
      throw error;
    } finally { connection.release(); }
  }

  async function resend({ challengeId }, context = {}) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        `SELECT id,purpose,email,user_id AS userId,attempts,expires_at AS expiresAt,
                next_resend_at AS nextResendAt,consumed_at AS consumedAt
           FROM auth_challenges WHERE id=? FOR UPDATE`,
        [challengeId]
      );
      if (!rows.length) throw failure('CHALLENGE_NOT_FOUND', 404);
      const row = rows[0];
      if (row.consumedAt) throw failure('CHALLENGE_CONSUMED', 409);
      if (row.attempts >= 5) throw failure('CHALLENGE_LOCKED', 429);
      if (dateMs(row.nextResendAt) > clock()) throw failure('RESEND_TOO_SOON', 429);
      await rateLimit(`${row.purpose}_resend`, row.email, context.ip);
      const code = makeCode();
      const now = clock();
      await connection.execute(
        'UPDATE auth_challenges SET code_digest=?,expires_at=?,next_resend_at=? WHERE id=?',
        [digest(row.purpose, row.email, code), sqlDate(now + TEN_MINUTES), sqlDate(now + ONE_MINUTE), row.id]
      );
      await mailer.sendVerification({ to: row.email, code, purpose: row.purpose, expiresInMinutes: 10 });
      await connection.commit();
      return { challengeId: row.id, expiresAt: new Date(now + TEN_MINUTES).toISOString() };
    } catch (error) {
      try { await connection.rollback(); } catch {}
      throw error;
    } finally { connection.release(); }
  }

  async function startPasswordReset({ email: rawEmail }, context = {}) {
    const email = normalizeEmail(rawEmail) || String(rawEmail || '').trim().toLowerCase();
    await rateLimit('password_reset_request', email || 'invalid', context.ip);
    const [users] = await pool.execute('SELECT id FROM users WHERE email=? AND email_verified_at IS NOT NULL LIMIT 1', [email]);
    if (users.length) await createChallenge({ purpose: 'password_reset', email, userId: users[0].id, ip: context.ip });
    return { accepted: true };
  }

  async function verifyPasswordReset({ challengeId, code }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const row = await lockedChallenge(connection, challengeId, 'password_reset');
      const invalid = await validateLockedCode(connection, row, code);
      if (invalid) { await connection.commit(); throw invalid; }
      const token = randomBytes(32).toString('base64url');
      const now = clock();
      await connection.execute(
        'INSERT INTO password_reset_tokens (id,user_id,token_digest,expires_at) VALUES (?,?,?,?)',
        [crypto.randomUUID(), row.userId, resetTokenDigest(token), sqlDate(now + TEN_MINUTES)]
      );
      await connection.execute('UPDATE auth_challenges SET consumed_at=? WHERE id=?', [sqlDate(now), row.id]);
      await connection.commit();
      return { resetToken: token, expiresAt: new Date(now + TEN_MINUTES).toISOString() };
    } catch (error) {
      try { await connection.rollback(); } catch {}
      throw error;
    } finally { connection.release(); }
  }

  async function consumeResetToken({ resetToken, password, passwordConfirmation }) {
    const passwordCheck = validatePasswordPair(password, passwordConfirmation);
    if (!passwordCheck.valid) throw failure(passwordCheck.error);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        `SELECT id,user_id AS userId,expires_at AS expiresAt,consumed_at AS consumedAt
           FROM password_reset_tokens WHERE token_digest=? FOR UPDATE`,
        [resetTokenDigest(String(resetToken || ''))]
      );
      const row = rows[0];
      if (!row || row.consumedAt || dateMs(row.expiresAt) <= clock()) throw failure('RESET_TOKEN_INVALID', 400);
      const passwordHash = await bcrypt.hash(password, 12);
      await connection.execute('UPDATE users SET password_hash=?,session_version=session_version+1 WHERE id=?', [passwordHash, row.userId]);
      await connection.execute('UPDATE password_reset_tokens SET consumed_at=? WHERE id=?', [sqlDate(clock()), row.id]);
      await connection.commit();
      return { completed: true };
    } catch (error) {
      try { await connection.rollback(); } catch {}
      throw error;
    } finally { connection.release(); }
  }

  async function startEmailAttachment({ userId, email: rawEmail }, context = {}) {
    const email = normalizeEmail(rawEmail);
    if (!email) throw failure('INVALID_EMAIL');
    const [existing] = await pool.execute('SELECT id FROM users WHERE email=? AND id<>? LIMIT 1', [email, userId]);
    if (existing.length) throw failure('EMAIL_EXISTS', 409);
    return createChallenge({ purpose: 'email_attachment', email, userId, payload: { userId }, ip: context.ip });
  }

  async function verifyEmailAttachment({ userId, challengeId, code }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const row = await lockedChallenge(connection, challengeId, 'email_attachment');
      if (row.userId !== userId) throw failure('CHALLENGE_NOT_FOUND', 404);
      const invalid = await validateLockedCode(connection, row, code);
      if (invalid) { await connection.commit(); throw invalid; }
      await connection.execute('UPDATE users SET email=?,email_verified_at=? WHERE id=?', [row.email, sqlDate(clock()), userId]);
      await connection.execute('UPDATE auth_challenges SET consumed_at=? WHERE id=?', [sqlDate(clock()), row.id]);
      await connection.commit();
      return { email: row.email, verified: true };
    } catch (error) {
      try { await connection.rollback(); } catch {}
      if (error.code === 'ER_DUP_ENTRY') throw failure('EMAIL_EXISTS', 409);
      throw error;
    } finally { connection.release(); }
  }

  return { startSignup, verifySignup, resend, startPasswordReset, verifyPasswordReset, consumeResetToken, startEmailAttachment, verifyEmailAttachment };
}

module.exports = { createChallengeService };
