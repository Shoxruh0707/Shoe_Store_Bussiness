const bcrypt = require('bcryptjs');

async function verifyPassword(password, passwordHash) {
  if (typeof password !== 'string' || !password || typeof passwordHash !== 'string' || !/^\$2[aby]\$\d{2}\$/.test(passwordHash)) {
    return false;
  }
  try {
    return await bcrypt.compare(password, passwordHash);
  } catch {
    return false;
  }
}

module.exports = { verifyPassword };
