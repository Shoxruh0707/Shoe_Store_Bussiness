function readConfig(env = {}) {
  const config = { ...env, API_AUTH_REQUIRED: env.API_AUTH_REQUIRED || 'true' };
  config.APP_TIMEZONE = env.APP_TIMEZONE === undefined ? 'Asia/Tashkent' : String(env.APP_TIMEZONE).trim();
  if (!require('./local-date').isValidTimeZone(config.APP_TIMEZONE)) throw new Error('Invalid APP_TIMEZONE');
  config.EMAIL_DELIVERY_MODE = String(env.EMAIL_DELIVERY_MODE || 'disabled').trim().toLowerCase();
  if (!['disabled', 'smtp'].includes(config.EMAIL_DELIVERY_MODE)) throw new Error('Invalid EMAIL_DELIVERY_MODE');
  config.EMAIL_FROM_NAME = String(env.EMAIL_FROM_NAME || 'noreply').trim() || 'noreply';
  config.OTP_SECRET = String(env.OTP_SECRET || env.SESSION_SECRET || '');
  if (config.EMAIL_DELIVERY_MODE === 'smtp') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(env.EMAIL_FROM || '').trim())) throw new Error('EMAIL_FROM is required for SMTP delivery');
    config.EMAIL_FROM = String(env.EMAIL_FROM).trim();
    config.SMTP_HOST = String(env.SMTP_HOST || '').trim();
    config.SMTP_USER = String(env.SMTP_USER || '').trim();
    config.SMTP_PASSWORD = String(env.SMTP_PASSWORD || '');
    config.SMTP_PORT = Number(env.SMTP_PORT || 0);
    config.SMTP_SECURE = String(env.SMTP_SECURE || 'false').toLowerCase();
    if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASSWORD || !Number.isInteger(config.SMTP_PORT) || config.SMTP_PORT < 1 || config.SMTP_PORT > 65535 || !['true', 'false'].includes(config.SMTP_SECURE)) {
      throw new Error('Complete SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and SMTP_SECURE settings are required');
    }
  }
  if (!['true', 'false'].includes(config.API_AUTH_REQUIRED)) throw new Error('Invalid API_AUTH_REQUIRED');
  config.SWAGGER_ENABLED = env.SWAGGER_ENABLED || 'false';
  if (!['true', 'false'].includes(config.SWAGGER_ENABLED)) throw new Error('Invalid SWAGGER_ENABLED');
  if (config.SWAGGER_ENABLED === 'true') {
    if (!String(env.SWAGGER_USERNAME || '').trim() || String(env.SWAGGER_USERNAME).includes(':')) {
      throw new Error('SWAGGER_USERNAME must be nonempty and cannot contain a colon');
    }
    if (!String(env.SWAGGER_PASSWORD || '').trim()) throw new Error('SWAGGER_PASSWORD is required when Swagger is enabled');
  }
  if (env.NODE_ENV === 'production') {
    if (config.API_AUTH_REQUIRED !== 'true') throw new Error('API_AUTH_REQUIRED must be true in production');
    const secret = String(env.SESSION_SECRET || '');
    const placeholders = new Set(['change-this-session-secret', 'replace_with_at_least_32_random_bytes', 'replace_with_a_long_random_value']);
    if (Buffer.byteLength(secret.trim()) < 32 || placeholders.has(secret.trim())) throw new Error('Invalid SESSION_SECRET');
    const otpSecret = String(env.OTP_SECRET || '');
    if (Buffer.byteLength(otpSecret.trim()) < 32 || placeholders.has(otpSecret.trim()) || otpSecret === secret) throw new Error('Invalid OTP_SECRET');
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
