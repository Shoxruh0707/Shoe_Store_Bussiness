const crypto = require('node:crypto');

function createCodeDigest({ secret, namespace, subject, code }) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) throw new TypeError('A strong digest secret is required');
  for (const [name, value] of Object.entries({ namespace, subject, code })) {
    if (typeof value !== 'string' || !value) throw new TypeError(`${name} is required`);
  }
  return crypto.createHmac('sha256', secret).update(namespace).update('\0').update(subject).update('\0').update(code).digest('hex');
}

function safeEqualDigest(left, right) {
  if (!/^[a-f0-9]{64}$/.test(left || '') || !/^[a-f0-9]{64}$/.test(right || '')) return false;
  return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

module.exports = { createCodeDigest, safeEqualDigest };
