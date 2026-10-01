function readConfig(env = {}) {
  const config = { ...env, API_AUTH_REQUIRED: env.API_AUTH_REQUIRED || 'true' };
  if (!['true', 'false'].includes(config.API_AUTH_REQUIRED)) throw new Error('Invalid API_AUTH_REQUIRED');
  if (env.NODE_ENV === 'production') {
    if (config.API_AUTH_REQUIRED !== 'true') throw new Error('API_AUTH_REQUIRED must be true in production');
    const secret = String(env.SESSION_SECRET || '');
    const placeholders = new Set(['change-this-session-secret', 'replace_with_at_least_32_random_bytes', 'replace_with_a_long_random_value']);
    if (Buffer.byteLength(secret.trim()) < 32 || placeholders.has(secret.trim())) throw new Error('Invalid SESSION_SECRET');
    const domain = String(env.DOMAIN || '').replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim();
    const publicUrl = env.PUBLIC_URL || (domain ? `https://${domain}` : '');
    let url;
    try { url = new URL(publicUrl); } catch { throw new Error('Invalid PUBLIC_URL'); }
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('PUBLIC_URL must use HTTPS');
    if (env.SESSION_COOKIE_SECURE && env.SESSION_COOKIE_SECURE !== 'true') throw new Error('SESSION_COOKIE_SECURE must be true');
    config.PUBLIC_URL = url.toString().replace(/\/$/, '');
    config.SESSION_COOKIE_SECURE = 'true';
  }
  return Object.freeze(config);
}
module.exports = { readConfig };
