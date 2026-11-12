const nodemailer = require('nodemailer');

const subjects = {
  signup: 'Verify your shoe-store account',
  password_reset: 'Reset your shoe-store password',
  email_attachment: 'Verify your email address'
};

function deliveryDisabled() {
  return Object.assign(new Error('Email delivery is not configured.'), {
    code: 'EMAIL_DELIVERY_DISABLED', statusCode: 503, expose: true
  });
}

function createSmtpMailer(config = {}, dependencies = {}) {
  if (config.EMAIL_DELIVERY_MODE !== 'smtp') {
    return { sendVerification: async () => { throw deliveryDisabled(); } };
  }

  const transportFactory = dependencies.transportFactory || nodemailer.createTransport;
  const logger = dependencies.logger || console;
  const transport = transportFactory({
    host: config.SMTP_HOST,
    port: Number(config.SMTP_PORT),
    secure: config.SMTP_SECURE === true || config.SMTP_SECURE === 'true',
    auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD }
  });

  return {
    async sendVerification({ to, code, purpose, expiresInMinutes }) {
      const result = await transport.sendMail({
        from: `${config.EMAIL_FROM_NAME || 'noreply'} <${config.EMAIL_FROM}>`,
        to,
        subject: subjects[purpose] || 'Your shoe-store verification code',
        text: `Your verification code is ${code}. It expires in ${expiresInMinutes} minutes. If you did not request this, ignore this email.`
      });
      logger.info?.({ event: 'verification_email_sent', purpose, messageId: result?.messageId || null });
      return { messageId: result?.messageId || null };
    }
  };
}

module.exports = { createSmtpMailer };
