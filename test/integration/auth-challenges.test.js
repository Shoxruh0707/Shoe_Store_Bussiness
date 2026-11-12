const test = require('node:test');
const assert = require('node:assert/strict');
const { withTestDatabase } = require('../support/test-database');
const { runMigrations } = require('../../src/db/migrate');
const migrations = require('../../src/db/migrations');

const signup = {
  fname: 'New', lname: 'Owner', email: 'Owner@Example.com', phoneNumber: '+998901112233',
  password: 'correct-horse', passwordConfirmation: 'correct-horse'
};

async function fixture(pool, overrides = {}) {
  let now = Date.UTC(2026, 10, 12, 8, 0, 0);
  const sent = [];
  const { createChallengeService } = require('../../src/auth/challenges');
  const service = createChallengeService({
    pool,
    mailer: { sendVerification: async (message) => { sent.push(message); } },
    clock: () => now,
    randomInt: () => 123456,
    randomBytes: () => Buffer.alloc(32, 7),
    digestSecret: 'o'.repeat(32),
    ...overrides
  });
  return { service, sent, advance: (milliseconds) => { now += milliseconds; } };
}

test('signup challenge stores no plaintext secret and creates the account only after verification', () => withTestDatabase(async ({ pool }) => {
  const connection = await pool.getConnection();
  try { await runMigrations({ connection, migrations, mode: 'apply' }); } finally { connection.release(); }
  const { service, sent } = await fixture(pool);
  const started = await service.startSignup(signup, { ip: '127.0.0.1' });
  assert.match(started.challengeId, /^[0-9a-f-]{36}$/);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].code, '123456');
  assert.equal((await pool.query('SELECT COUNT(*) AS n FROM users'))[0][0].n, 0);
  const [[challenge]] = await pool.query('SELECT code_digest AS codeDigest,payload_json AS payload FROM auth_challenges');
  assert.notEqual(challenge.codeDigest, '123456');
  assert.doesNotMatch(JSON.stringify(challenge.payload), /correct-horse|123456/);

  const attempts = await Promise.allSettled([
    service.verifySignup({ challengeId: started.challengeId, code: '123456' }),
    service.verifySignup({ challengeId: started.challengeId, code: '123456' })
  ]);
  assert.equal(attempts.filter(item => item.status === 'fulfilled').length, 1);
  const user = attempts.find(item => item.status === 'fulfilled').value;
  assert.equal(user.email, 'owner@example.com');
  assert.equal(user.phoneNumber, '+998901112233');
  assert.equal((await pool.query('SELECT COUNT(*) AS n FROM users'))[0][0].n, 1);
  await assert.rejects(service.verifySignup({ challengeId: started.challengeId, code: '123456' }), (error) => error.code === 'CHALLENGE_CONSUMED');
}));

test('challenge expiry, resend cooldown and five-attempt lock are enforced', () => withTestDatabase(async ({ pool }) => {
  const connection = await pool.getConnection();
  try { await runMigrations({ connection, migrations, mode: 'apply' }); } finally { connection.release(); }
  const state = await fixture(pool);
  const first = await state.service.startSignup(signup, { ip: '127.0.0.1' });
  await assert.rejects(state.service.resend({ challengeId: first.challengeId }, { ip: '127.0.0.1' }), (error) => error.code === 'RESEND_TOO_SOON');
  state.advance(60_000);
  await state.service.resend({ challengeId: first.challengeId }, { ip: '127.0.0.1' });
  assert.equal(state.sent.length, 2);
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await assert.rejects(state.service.verifySignup({ challengeId: first.challengeId, code: '000000' }), (error) => error.code === (attempt === 5 ? 'CHALLENGE_LOCKED' : 'INVALID_CODE'));
  }
  await assert.rejects(state.service.verifySignup({ challengeId: first.challengeId, code: '123456' }), (error) => error.code === 'CHALLENGE_LOCKED');

  const second = await state.service.startSignup({ ...signup, email: 'second@example.com', phoneNumber: '+998901112234' }, { ip: '127.0.0.2' });
  state.advance(10 * 60_000 + 1);
  await assert.rejects(state.service.verifySignup({ challengeId: second.challengeId, code: '123456' }), (error) => error.code === 'CHALLENGE_EXPIRED');
}));

test('password-reset initiation is non-enumerating and reset tokens are one-use', () => withTestDatabase(async ({ pool }) => {
  const connection = await pool.getConnection();
  try {
    await runMigrations({ connection, migrations, mode: 'apply' });
    await connection.execute(
      "INSERT INTO users (fname,lname,email,email_verified_at,phone_number,password_hash,session_version,role) VALUES ('Existing','User','existing@example.com',NOW(),'+998901112235',?,1,'seller')",
      ['x'.repeat(60)]
    );
  } finally { connection.release(); }
  const state = await fixture(pool);
  const missing = await state.service.startPasswordReset({ email: 'missing@example.com' }, { ip: '127.0.0.3' });
  const existing = await state.service.startPasswordReset({ email: 'existing@example.com' }, { ip: '127.0.0.4' });
  assert.deepEqual(missing, { accepted: true });
  assert.deepEqual(existing, { accepted: true });
  assert.equal(state.sent.length, 1);
  const [[challenge]] = await pool.query("SELECT id FROM auth_challenges WHERE purpose='password_reset'");
  const verified = await state.service.verifyPasswordReset({ challengeId: challenge.id, code: '123456' });
  assert.match(verified.resetToken, /^[A-Za-z0-9_-]+$/);
  await state.service.consumeResetToken({ resetToken: verified.resetToken, password: 'new-password', passwordConfirmation: 'new-password' });
  await assert.rejects(
    state.service.consumeResetToken({ resetToken: verified.resetToken, password: 'another-password', passwordConfirmation: 'another-password' }),
    (error) => error.code === 'RESET_TOKEN_INVALID'
  );
  const [[user]] = await pool.query("SELECT session_version AS sessionVersion,password_hash AS passwordHash FROM users WHERE email='existing@example.com'");
  assert.equal(user.sessionVersion, 2);
  assert.notEqual(user.passwordHash, 'x'.repeat(60));
}));
