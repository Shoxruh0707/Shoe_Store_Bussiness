const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const { withTestDatabase } = require('../support/test-database');
const { runMigrations } = require('../../src/db/migrate');
const migrations = require('../../src/db/migrations');
const { withApp } = require('../support/http');
const { createApp } = require('../../server');
const { readConfig } = require('../../src/config');

function request(origin, method, path, body, cookie) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  return fetch(origin + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

test('store membership enforces invitation acceptance, one store, and role hierarchy', () => withTestDatabase(async ({ pool }) => {
  const connection = await pool.getConnection();
  try { await runMigrations({ connection, migrations, mode: 'apply' }); } finally { connection.release(); }
  const sent = [];
  const app = createApp({
    pool,
    config: readConfig({ SESSION_SECRET: 's'.repeat(32), OTP_SECRET: 'o'.repeat(32) }),
    mailer: { sendVerification: async message => sent.push(message) },
    uploads: { rootDir: os.tmpdir(), tempDir: os.tmpdir() }, logger: { error: () => {} }
  });
  await withApp(app, async origin => {
    let sequence = 0;
    async function register(label) {
      sequence += 1;
      const fields = {
        fname: label.slice(0, 20), lname: 'User', email: `${label.toLowerCase()}${sequence}@example.com`,
        phoneNumber: `+99890000${String(sequence).padStart(4, '0')}`,
        password: 'correct-horse', passwordConfirmation: 'correct-horse'
      };
      const started = await request(origin, 'POST', '/api/auth/signup/start', fields);
      assert.equal(started.status, 202);
      const challengeId = (await started.json()).challengeId;
      const verified = await request(origin, 'POST', '/api/auth/signup/verify', { challengeId, code: sent.at(-1).code });
      assert.equal(verified.status, 201);
      return { ...fields, cookie: verified.headers.get('set-cookie').split(';', 1)[0] };
    }

    const owner = await register('Owner');
    const manager = await register('Manager');
    const seller = await register('Seller');
    const joiner = await register('Joiner');
    const futureManager = await register('FutureManager');
    const staleCodeUser = await register('Stale');

    const createdResponse = await request(origin, 'POST', '/api/store', { storeName: 'Central Shoes', description: 'Main stock' }, owner.cookie);
    assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json()).data;
    assert.equal(created.store.storeRole, 'owner');
    assert.match(created.entryCode, /^[A-F0-9]{10}$/);
    assert.equal((await request(origin, 'POST', '/api/store', { storeName: 'Second' }, owner.cookie)).status, 409);

    const missing = await request(origin, 'POST', '/api/store/invitations', { phoneNumber: '+998999999999', role: 'seller' }, owner.cookie);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error, 'There is no user with this phone number.');

    assert.equal((await request(origin, 'POST', '/api/store/invitations', { phoneNumber: manager.phoneNumber, role: 'manager' }, owner.cookie)).status, 201);
    assert.equal((await request(origin, 'GET', '/api/store', undefined, manager.cookie)).status, 403);
    const managerInvitations = (await (await request(origin, 'GET', '/api/auth/store-invitations', undefined, manager.cookie)).json()).data;
    assert.equal(managerInvitations.length, 1);
    assert.equal((await request(origin, 'POST', `/api/auth/store-invitations/${managerInvitations[0].id}/accept`, {}, manager.cookie)).status, 200);
    assert.equal((await request(origin, 'GET', '/api/store', undefined, manager.cookie)).status, 200);
    assert.equal((await request(origin, 'PUT', '/api/store', { storeName: 'Manager Edit' }, manager.cookie)).status, 403);
    const ownerUpdate = await request(origin, 'PUT', '/api/store', { storeName: 'Central Shoes', instagram: '@centralshoes', telegramLink: 'https://t.me/centralshoes' }, owner.cookie);
    assert.equal(ownerUpdate.status, 200);
    assert.equal((await ownerUpdate.json()).data.instagram, '@centralshoes');

    assert.equal((await request(origin, 'POST', '/api/store/invitations', { phoneNumber: seller.phoneNumber, role: 'manager' }, manager.cookie)).status, 403);
    assert.equal((await request(origin, 'POST', '/api/store/invitations', { phoneNumber: seller.phoneNumber, role: 'seller' }, manager.cookie)).status, 201);
    const sellerInvitations = (await (await request(origin, 'GET', '/api/auth/store-invitations', undefined, seller.cookie)).json()).data;
    assert.equal((await request(origin, 'POST', `/api/auth/store-invitations/${sellerInvitations[0].id}/accept`, {}, seller.cookie)).status, 200);
    assert.equal((await request(origin, 'POST', '/api/store', { storeName: 'Forbidden' }, seller.cookie)).status, 409);

    const joinRequest = await request(origin, 'POST', '/api/store/join-requests', { entryCode: created.entryCode }, joiner.cookie);
    assert.equal(joinRequest.status, 201);
    const joinRequestId = (await joinRequest.json()).data.id;
    assert.equal((await request(origin, 'POST', `/api/store/join-requests/${joinRequestId}/approve`, { role: 'manager' }, manager.cookie)).status, 403);
    assert.equal((await request(origin, 'POST', `/api/store/join-requests/${joinRequestId}/approve`, { role: 'seller' }, manager.cookie)).status, 200);

    const nextRequest = await request(origin, 'POST', '/api/store/join-requests', { entryCode: created.entryCode }, futureManager.cookie);
    const nextRequestId = (await nextRequest.json()).data.id;
    assert.equal((await request(origin, 'POST', `/api/store/join-requests/${nextRequestId}/approve`, { role: 'manager' }, owner.cookie)).status, 200);

    const members = (await (await request(origin, 'GET', '/api/store/members', undefined, owner.cookie)).json()).data;
    assert.deepEqual(members.map(item => item.role).sort(), ['manager', 'manager', 'owner', 'seller', 'seller'].sort());
    const futureManagerRow = members.find(item => item.phoneNumber === futureManager.phoneNumber);
    assert.equal((await request(origin, 'DELETE', `/api/store/members/${futureManagerRow.userId}`, undefined, manager.cookie)).status, 403);
    assert.equal((await request(origin, 'DELETE', `/api/store/members/${futureManagerRow.userId}`, undefined, owner.cookie)).status, 200);
    const ownerRow = members.find(item => item.role === 'owner');
    assert.equal((await request(origin, 'DELETE', `/api/store/members/${ownerRow.userId}`, undefined, owner.cookie)).status, 403);

    const regenerated = await request(origin, 'POST', '/api/store/entry-code/regenerate', {}, owner.cookie);
    assert.equal(regenerated.status, 200);
    assert.notEqual((await regenerated.json()).data.entryCode, created.entryCode);
    assert.equal((await request(origin, 'POST', '/api/store/join-requests', { entryCode: created.entryCode }, staleCodeUser.cookie)).status, 404);
  });
}));
