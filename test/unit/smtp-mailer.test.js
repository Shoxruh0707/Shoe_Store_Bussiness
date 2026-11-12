const test = require('node:test');
const assert = require('node:assert/strict');

test('disabled delivery fails safely instead of pretending to send', async () => {
  const { createSmtpMailer } = require('../../src/email/smtp-mailer');
  const mailer = createSmtpMailer({ EMAIL_DELIVERY_MODE: 'disabled' });
  await assert.rejects(
    mailer.sendVerification({ to: 'user@example.com', code: '123456', purpose: 'signup', expiresInMinutes: 10 }),
    (error) => error.code === 'EMAIL_DELIVERY_DISABLED' && error.statusCode === 503 && error.expose === true
  );
});

test('SMTP mailer builds a noreply verification message without logging its code', async () => {
  const sent = [];
  const logs = [];
  const transportFactory = (options) => ({
    sendMail: async (message) => { sent.push({ options, message }); return { messageId: 'message-1' }; }
  });
  const { createSmtpMailer } = require('../../src/email/smtp-mailer');
  const mailer = createSmtpMailer({
    EMAIL_DELIVERY_MODE: 'smtp', EMAIL_FROM: 'noreply@example.com', EMAIL_FROM_NAME: 'noreply',
    SMTP_HOST: 'smtp.example.com', SMTP_PORT: 587, SMTP_SECURE: 'false',
    SMTP_USER: 'smtp-user', SMTP_PASSWORD: 'smtp-password'
  }, { transportFactory, logger: { info: (value) => logs.push(value), error: (value) => logs.push(value) } });

  await mailer.sendVerification({ to: 'user@example.com', code: '123456', purpose: 'signup', expiresInMinutes: 10 });
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].options, {
    host: 'smtp.example.com', port: 587, secure: false,
    auth: { user: 'smtp-user', pass: 'smtp-password' }
  });
  assert.equal(sent[0].message.from, 'noreply <noreply@example.com>');
  assert.equal(sent[0].message.to, 'user@example.com');
  assert.match(sent[0].message.text, /123456/);
  assert.match(sent[0].message.text, /10 minutes/);
  assert.doesNotMatch(JSON.stringify(logs), /123456|smtp-password/);
});
