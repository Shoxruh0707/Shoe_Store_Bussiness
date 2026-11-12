function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function normalizePhone(value) {
  if (typeof value !== 'string') return null;
  const phone = value.trim();
  return /^\+[1-9][0-9]{6,13}$/.test(phone) ? phone : null;
}

function validatePasswordPair(password, confirmation) {
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    return { valid: false, error: 'PASSWORD_LENGTH' };
  }
  if (password !== confirmation) return { valid: false, error: 'PASSWORD_MISMATCH' };
  return { valid: true };
}

module.exports = { normalizeEmail, normalizePhone, validatePasswordPair };
