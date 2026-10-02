const crypto = require('node:crypto');
const { readConfig } = require('../config');

function digest(value) {
  return crypto.createHash('sha256').update(value).digest();
}

function mountSwagger(app, config) {
  if (config.SWAGGER_ENABLED !== 'true') return;
  // Validate here too because createApp can be called without the runtime config reader.
  readConfig(config);
  const expected = digest(`${config.SWAGGER_USERNAME}:${config.SWAGGER_PASSWORD}`);
  function protect(request, response, next) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Vary', 'Authorization');
    const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(request.get('Authorization') || '');
    const supplied = match ? Buffer.from(match[1], 'base64').toString('utf8') : '';
    if (!match || !crypto.timingSafeEqual(digest(supplied), expected)) {
      response.setHeader('WWW-Authenticate', 'Basic realm="Swagger documentation", charset="UTF-8"');
      return response.status(401).json({ success: false, error: 'Swagger authentication required.', message: 'Swagger authentication required.' });
    }
    next();
  }
  const swaggerUi = require('swagger-ui-express');
  const specification = require('./openapi');
  app.get('/api/openapi.json', protect, (_request, response) => response.json(specification));
  app.use('/api/docs', protect, swaggerUi.serve, swaggerUi.setup(null, {
    customSiteTitle: 'Admin Shoe Store API',
    swaggerOptions: {
      url: '/api/openapi.json',
      validatorUrl: null,
      withCredentials: true,
      persistAuthorization: false,
      displayRequestDuration: true,
    },
  }));
}

module.exports = { mountSwagger };
