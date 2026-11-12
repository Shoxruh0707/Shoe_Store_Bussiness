const test = require('node:test');
const assert = require('node:assert/strict');
const { readConfig } = require('../../src/config');

const production = {
  NODE_ENV: 'production',
  API_AUTH_REQUIRED: 'true',
  SESSION_SECRET: 's'.repeat(32),
  OTP_SECRET: 'o'.repeat(32),
  PUBLIC_URL: 'https://inventory.example.com',
  EMAIL_DELIVERY_MODE: 'disabled'
};

test('production requires an independent strong OTP secret', () => {
  assert.throws(() => readConfig({ ...production, OTP_SECRET: '' }), /OTP_SECRET/);
  assert.throws(() => readConfig({ ...production, OTP_SECRET: 'short' }), /OTP_SECRET/);
  assert.equal(readConfig(production).OTP_SECRET, 'o'.repeat(32));
});

test('SMTP delivery requires a sender and complete connection settings', () => {
  assert.throws(() => readConfig({ ...production, EMAIL_DELIVERY_MODE: 'smtp' }), /EMAIL_FROM/);
  const config = readConfig({
    ...production,
    EMAIL_DELIVERY_MODE: 'smtp',
    EMAIL_FROM: 'noreply@example.com',
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '587',
    SMTP_USER: 'smtp-user',
    SMTP_PASSWORD: 'smtp-password'
  });
  assert.equal(config.SMTP_PORT, 587);
  assert.equal(config.EMAIL_FROM_NAME, 'noreply');
});
