const test = require('node:test');
const assert = require('node:assert/strict');
const { withTestDatabase } = require('../support/test-database');
const { runMigrations } = require('../../src/db/migrate');
const migrations = require('../../src/db/migrations');
const { withApp } = require('../support/http');
const { createApp } = require('../../server');
const { readConfig } = require('../../src/config');
const os = require('node:os');

const registration = {
  fname: 'API', lname: 'Owner', email: 'owner@example.com', phoneNumber: '+998901234567',
  password: 'correct-horse', passwordConfirmation: 'correct-horse'
};

function post(origin, path, body, cookie) {
  const headers = { 'content-type': 'application/json' };
  if (cookie) headers.cookie = cookie;
  return fetch(origin + path, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}

test('verified signup creates an unaffiliated account and the legacy signup cannot bypass verification', () => withTestDatabase(async ({ pool }) => {
  const connection = await pool.getConnection();
  try { await runMigrations({ connection, migrations, mode: 'apply' }); } finally { connection.release(); }
  const sent = [];
  const app = createApp({
    pool,
    config: readConfig({ SESSION_SECRET: 's'.repeat(32), OTP_SECRET: 'o'.repeat(32) }),
    mailer: { sendVerification: async (message) => sent.push(message) },
    uploads: { rootDir: os.tmpdir(), tempDir: os.tmpdir() }, logger: { error: () => {} }
  });
  await withApp(app, async (origin) => {
    const legacy = await post(origin, '/api/auth/signup', { ...registration, storeName: 'Bypass' });
    assert.equal(legacy.status, 410);

    const start = await post(origin, '/api/auth/signup/start', registration);
    assert.equal(start.status, 202);
    const started = await start.json();
    assert.match(started.challengeId, /^[0-9a-f-]{36}$/);
    assert.equal((await pool.query('SELECT COUNT(*) AS n FROM users'))[0][0].n, 0);
    assert.equal(sent.length, 1);

    const verify = await post(origin, '/api/auth/signup/verify', { challengeId: started.challengeId, code: sent[0].code });
    assert.equal(verify.status, 201);
    const cookie = verify.headers.get('set-cookie').split(';', 1)[0];
    const verified = await verify.json();
    assert.equal(verified.user.email, 'owner@example.com');
    assert.equal(verified.store, null);
    assert.equal(verified.onboardingRequired, true);

    const me = await fetch(origin + '/api/auth/me', { headers: { cookie } });
    assert.equal(me.status, 200);
    const session = await me.json();
    assert.equal(session.store, null);
    assert.equal(session.onboardingRequired, true);
    assert.equal(session.permissions.viewInventory, false);
  });
}));

test('password reset is non-enumerating, one-use, and revokes every existing session', () => withTestDatabase(async ({ pool }) => {
  const connection = await pool.getConnection();
  try { await runMigrations({ connection, migrations, mode: 'apply' }); } finally { connection.release(); }
  const sent = [];
  const app = createApp({
    pool,
    config: readConfig({ SESSION_SECRET: 's'.repeat(32), OTP_SECRET: 'o'.repeat(32) }),
    mailer: { sendVerification: async (message) => sent.push(message) },
    uploads: { rootDir: os.tmpdir(), tempDir: os.tmpdir() }, logger: { error: () => {} }
  });
  await withApp(app, async (origin) => {
    const start = await post(origin, '/api/auth/signup/start', registration);
    const challengeId = (await start.json()).challengeId;
    const signup = await post(origin, '/api/auth/signup/verify', { challengeId, code: sent.at(-1).code });
    const oldCookie = signup.headers.get('set-cookie').split(';', 1)[0];

    const missing = await post(origin, '/api/auth/password-reset/start', { email: 'missing@example.com' });
    const existing = await post(origin, '/api/auth/password-reset/start', { email: registration.email });
    assert.equal(missing.status, 202);
    assert.equal(existing.status, 202);
    assert.deepEqual(await missing.json(), await existing.json());

    const [[resetChallenge]] = await pool.query("SELECT id FROM auth_challenges WHERE purpose='password_reset' AND consumed_at IS NULL");
    const resetCode = sent.at(-1).code;
    const verified = await post(origin, '/api/auth/password-reset/verify', { challengeId: resetChallenge.id, code: resetCode });
    assert.equal(verified.status, 200);
    const { resetToken } = await verified.json();
    const complete = await post(origin, '/api/auth/password-reset/complete', {
      resetToken, password: 'new-password', passwordConfirmation: 'new-password'
    });
    assert.equal(complete.status, 204);
    assert.match(complete.headers.get('set-cookie'), /Max-Age=0/);
    assert.equal((await fetch(origin + '/api/auth/me', { headers: { cookie: oldCookie } })).status, 401);
    assert.equal((await post(origin, '/api/auth/login', { phoneNumber: registration.phoneNumber, password: registration.password })).status, 401);
    assert.equal((await post(origin, '/api/auth/login', { phoneNumber: registration.phoneNumber, password: 'new-password' })).status, 200);
    assert.equal((await post(origin, '/api/auth/password-reset/complete', {
      resetToken, password: 'third-password', passwordConfirmation: 'third-password'
    })).status, 400);
  });
}));
