const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const os = require('node:os');
const { withApp } = require('../support/http');

const signup = { fname: 'Test', lname: 'Owner', phoneNumber: '+998901234567', password: 'test-password-123', storeName: 'Test Store' };
const postSignup = (origin, payload) => fetch(origin + '/api/auth/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });

test('signup validates input before accessing the database', async () => {
  await withApp(makeApp({}), async origin => {
    for (const payload of [null, {}, { ...signup, fname: 'x'.repeat(21) }, { ...signup, phoneNumber: 'invalid' }, { ...signup, password: 'short' }, { ...signup, password: 'é'.repeat(37) }, { ...signup, storeName: '' }]) {
      assert.equal((await postSignup(origin, payload)).status, 400);
    }
  });
});

test('signup hashes the password, creates an owner store, and authenticates the user', async () => {
  const events = [];
  let storedHash;
  const connection = {
    beginTransaction: async () => events.push('begin'),
    execute: async (sql, values) => {
      if (sql.includes('INSERT INTO users')) {
        assert.deepEqual(values.slice(0, 3), [signup.fname, signup.lname, signup.phoneNumber]);
        storedHash = values[3];
        assert.match(sql, /'seller'/);
        return [{ insertId: 7 }];
      }
      if (sql.includes('INSERT INTO store_users')) { assert.deepEqual(values, [7, 2]); assert.match(sql, /'owner'/); return [{}]; }
      if (sql.includes('INSERT INTO store')) { assert.deepEqual(values, [signup.storeName]); return [{ insertId: 2 }]; }
      throw new Error('Unexpected query');
    },
    commit: async () => events.push('commit'), rollback: async () => events.push('rollback'), release: () => events.push('release'),
  };
  await withApp(makeApp({ ...authPool(), getConnection: async () => connection }), async origin => {
    const response = await postSignup(origin, { ...signup, role: 'admin', storeId: 999 });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.user.role, 'seller'); assert.equal(body.store.id, 2); assert.equal(body.store.storeRole, 'owner');
    assert.doesNotMatch(JSON.stringify(body), /password|\$2[aby]\$/);
    assert.ok(await bcrypt.compare(signup.password, storedHash));
    const cookie = response.headers.get('set-cookie'); assert.match(cookie, /HttpOnly/);
    assert.equal((await fetch(origin + '/api/auth/me', { headers: { cookie: cookie.split(';')[0] } })).status, 200);
    assert.deepEqual(events, ['begin', 'commit', 'release']);
  });
});

test('signup rolls back duplicate phones and membership failures without setting a session', async () => {
  for (const code of ['ER_DUP_ENTRY', 'ER_NO_REFERENCED_ROW_2']) {
    const events = [];
    const connection = {
      beginTransaction: async () => {},
      execute: async sql => {
        if (code === 'ER_DUP_ENTRY' || sql.includes('INSERT INTO store_users')) throw Object.assign(new Error('sensitive database details'), { code });
        return [{ insertId: 1 }];
      },
      commit: async () => events.push('commit'), rollback: async () => events.push('rollback'), release: () => events.push('release'),
    };
    await withApp(makeApp({ getConnection: async () => connection }), async origin => {
      const response = await postSignup(origin, signup);
      assert.equal(response.status, code === 'ER_DUP_ENTRY' ? 409 : 500);
      assert.equal(response.headers.get('set-cookie'), null);
      assert.doesNotMatch(await response.text(), /sensitive database details/);
      assert.deepEqual(events, ['rollback', 'release']);
    });
  }
});

test('password verification accepts bcrypt and rejects malformed hashes', async () => {
  const { verifyPassword } = require('../../src/auth/password');
  const hash = await bcrypt.hash('correct horse', 4);
  assert.equal(await verifyPassword('correct horse', hash), true);
  assert.equal(await verifyPassword('wrong password', hash), false);
  assert.equal(await verifyPassword('correct horse', 'not-a-bcrypt-hash'), false);
});

function authPool({ withUser = true, withStore = true } = {}) {
  const hash = bcrypt.hashSync('correct horse', 4);
  return {
    execute: async (sql, values) => {
      if (sql.includes('FROM users') && sql.includes('phone_number = ?')) {
        return [withUser ? [{ id: 7, fname: 'API', lname: 'User', phoneNumber: values[0], passwordHash: hash, role: 'seller' }] : []];
      }
      if (sql.includes('FROM users') && sql.includes('WHERE id = ?')) {
        return [[{ id: 7, fname: 'API', lname: 'User', phoneNumber: '+998901234567', role: 'seller' }]];
      }
      if (sql.includes('FROM store_users')) {
        return [withStore ? [{ id: 2, storeName: 'Test Store', storeRole: 'owner', storeImage: null }] : []];
      }
      throw new Error(`Unexpected query: ${sql}`);
    }
  };
}

function makeApp(pool, logger = { error: () => {} }) {
  const { createApp } = require('../../server');
  const { readConfig } = require('../../src/config');
  return createApp({
    pool,
    config: readConfig({ SESSION_SECRET: 'synthetic-test-secret-for-cookie-signing' }),
    uploads: { rootDir: os.tmpdir(), tempDir: os.tmpdir() },
    logger
  });
}

test('login returns a generic 401 for unknown phone and wrong password', async () => {
  for (const attempt of [
    { pool: authPool({ withUser: false }), password: 'correct horse' },
    { pool: authPool(), password: 'wrong password' }
  ]) {
    const logs = [];
    await withApp(makeApp(attempt.pool, { error: value => logs.push(value) }), async origin => {
      const response = await fetch(origin + '/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phoneNumber: '+998901234567', password: attempt.password })
      });
      const body = await response.json();
      assert.equal(response.status, 401);
      assert.deepEqual(body, { success: false, error: 'Invalid phone number or password.', message: 'Invalid phone number or password.' });
      assert.doesNotMatch(JSON.stringify({ body, logs }), /correct horse|wrong password|passwordHash/);
    });
  }
});

test('login establishes an authenticated session', async () => {
  await withApp(makeApp(authPool()), async origin => {
    const login = await fetch(origin + '/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+998901234567', password: 'correct horse' })
    });
    assert.equal(login.status, 200);
    assert.match(login.headers.get('set-cookie'), /HttpOnly/);
    const cookie = login.headers.get('set-cookie').split(';', 1)[0];
    const me = await fetch(origin + '/api/auth/me', { headers: { cookie } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).user.id, 7);
  });
});

test('authenticated user without membership cannot access store data', async () => {
  await withApp(makeApp(authPool({ withStore: false })), async origin => {
    const login = await fetch(origin + '/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+998901234567', password: 'correct horse' })
    });
    const cookie = login.headers.get('set-cookie').split(';', 1)[0];
    const store = await fetch(origin + '/api/store', { headers: { cookie } });
    assert.equal(store.status, 403);
  });
});
