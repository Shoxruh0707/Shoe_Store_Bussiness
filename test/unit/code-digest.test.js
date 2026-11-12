const test = require('node:test');
const assert = require('node:assert/strict');

test('code digests are deterministic and separated by namespace and subject', () => {
  const { createCodeDigest } = require('../../src/auth/code-digest');
  const input = { secret: 'a'.repeat(32), namespace: 'signup', subject: 'user@example.com', code: '123456' };
  const digest = createCodeDigest(input);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(createCodeDigest(input), digest);
  assert.notEqual(createCodeDigest({ ...input, namespace: 'password-reset' }), digest);
  assert.notEqual(createCodeDigest({ ...input, subject: 'other@example.com' }), digest);
});

test('digest comparison rejects malformed values and compares valid digests', () => {
  const { safeEqualDigest } = require('../../src/auth/code-digest');
  const digest = 'a'.repeat(64);
  assert.equal(safeEqualDigest(digest, digest), true);
  assert.equal(safeEqualDigest(digest, 'b'.repeat(64)), false);
  assert.equal(safeEqualDigest(digest, 'bad'), false);
  assert.equal(safeEqualDigest(null, digest), false);
});
