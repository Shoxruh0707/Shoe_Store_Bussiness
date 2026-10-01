const crypto = require('node:crypto');
function createLegacySessionCodec({ secret, clock = Date.now, maxAgeMs = 604800000, futureSkewMs = 30000 }) {
  const mac = body => crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return {
    encode({ userId, role }) {
      const body = Buffer.from(JSON.stringify({ userId, role, issuedAt: clock() })).toString('base64url');
      return `${body}.${mac(body)}`;
    },
    decode(header = '') {
      try {
        const cookies = String(header).split(';').map(p => p.trim()).filter(p => p.startsWith('session='));
        if (cookies.length !== 1) return null;
        const token = decodeURIComponent(cookies[0].slice(8));
        if (token.length > 4096 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return null;
        const [body, signature] = token.split('.');
        const expected = mac(body);
        if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        if (!Number.isSafeInteger(payload.userId) || payload.userId <= 0 || !['admin', 'seller', 'customer'].includes(payload.role)) return null;
        if (!Number.isSafeInteger(payload.issuedAt) || payload.issuedAt <= 0) return null;
        const age = clock() - payload.issuedAt;
        if (age >= maxAgeMs || age < -futureSkewMs) return null;
        return { userId: payload.userId, role: payload.role, issuedAt: payload.issuedAt };
      } catch { return null; }
    }
  };
}
module.exports = { createLegacySessionCodec };
