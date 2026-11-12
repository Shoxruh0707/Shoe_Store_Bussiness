const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEmail, normalizePhone, validatePasswordPair } = require('../../src/auth/identifiers');

test('email normalization is case-insensitive and rejects malformed or oversized input', () => {
  assert.equal(normalizeEmail('  Owner@Example.COM '), 'owner@example.com');
  for (const value of ['', 'owner', '@example.com', 'owner @example.com', `${'a'.repeat(245)}@example.com`]) {
    assert.equal(normalizeEmail(value), null);
  }
});

test('phone normalization accepts only canonical international numbers', () => {
  assert.equal(normalizePhone('+998901234567'), '+998901234567');
  for (const value of ['998901234567', '+01234567', '+998 90 123 45 67', '+123456', '+123456789012345']) {
    assert.equal(normalizePhone(value), null);
  }
});

test('password validation requires confirmation and enforces bcrypt byte limits', () => {
  assert.deepEqual(validatePasswordPair('correct-horse', 'correct-horse'), { valid: true });
  assert.deepEqual(validatePasswordPair('short', 'short'), { valid: false, error: 'PASSWORD_LENGTH' });
  assert.deepEqual(validatePasswordPair('correct-horse', 'different'), { valid: false, error: 'PASSWORD_MISMATCH' });
  assert.deepEqual(validatePasswordPair('é'.repeat(37), 'é'.repeat(37)), { valid: false, error: 'PASSWORD_LENGTH' });
});
