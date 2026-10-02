const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const { createApp } = require('../../server');
const { readConfig } = require('../../src/config');
const { withApp } = require('../support/http');

const credentials = { SWAGGER_ENABLED: 'true', SWAGGER_USERNAME: 'docs-user', SWAGGER_PASSWORD: 'docs-test-password' };
const authorization = 'Basic ' + Buffer.from('docs-user:docs-test-password').toString('base64');
const make = config => createApp({ pool: {}, config: readConfig(config), uploads: { rootDir: os.tmpdir(), tempDir: os.tmpdir() } });

test('Swagger requires explicit enablement and complete credentials', () => {
  assert.equal(readConfig({}).SWAGGER_ENABLED, 'false');
  for (const override of [{ SWAGGER_ENABLED: 'yes' }, { SWAGGER_USERNAME: '' }, { SWAGGER_PASSWORD: '' }, { SWAGGER_USERNAME: 'bad:user' }]) {
    assert.throws(() => readConfig({ ...credentials, ...override }), /SWAGGER/);
  }
});

test('disabled Swagger routes are not available', async () => {
  await withApp(make({}), async origin => {
    for (const url of ['/api/docs/', '/api/openapi.json', '/api/docs/swagger-ui.css']) {
      assert.equal((await fetch(origin + url)).status, 404);
    }
  });
});

test('Swagger protects the UI, assets, and specification without granting API access', async () => {
  await withApp(make(credentials), async origin => {
    for (const url of ['/api/docs', '/api/docs/', '/api/docs/swagger-ui.css', '/api/openapi.json']) {
      for (const value of ['', 'Basic invalid', 'Basic ' + Buffer.from('docs-user:wrong').toString('base64')]) {
        const response = await fetch(origin + url, { headers: { authorization: value }, redirect: 'manual' });
        assert.equal(response.status, 401, url);
        assert.match(response.headers.get('www-authenticate'), /^Basic /);
      }
      const response = await fetch(origin + url, { headers: { authorization } });
      assert.equal(response.status, 200, url);
      assert.match(response.headers.get('cache-control'), /no-store/);
      const body = await response.text();
      assert.ok(!body.includes(credentials.SWAGGER_PASSWORD));
    }
    assert.equal((await fetch(origin + '/api/auth/me', { headers: { authorization } })).status, 401);
    const script = await fetch(origin + '/api/docs/swagger-ui-init.js', { headers: { authorization } });
    assert.match(await script.text(), /withCredentials/);
  });
});

test('OpenAPI covers every application route and resolves every schema reference', async () => {
  await withApp(make(credentials), async origin => {
    const spec = await (await fetch(origin + '/api/openapi.json', { headers: { authorization } })).json();
    assert.equal(spec.openapi, '3.0.3');
    assert.deepEqual(spec.servers, [{ url: '/' }]);
    const routes = [...fs.readFileSync(require.resolve('../../server'), 'utf8').matchAll(/route\("(get|post|put|delete)", "([^"]+)"/g)];
    const ids = new Set();
    for (const [, method, route] of routes) {
      const path = route.replace(/:([A-Za-z]+)/g, '{$1}');
      const operation = spec.paths[path]?.[method];
      assert.ok(operation, `${method} ${path}`);
      assert.ok(operation.responses);
      assert.ok(operation.operationId);
      assert.ok(!ids.has(operation.operationId));
      ids.add(operation.operationId);
      for (const [, name] of path.matchAll(/\{([^}]+)\}/g)) {
        assert.ok(operation.parameters.some(p => p.in === 'path' && p.name === name && p.required));
      }
    }
    for (const [, name] of JSON.stringify(spec).matchAll(/"\$ref":"#\/components\/schemas\/([^"\s]+)"/g)) {
      assert.ok(spec.components.schemas[name], name);
    }
    assert.deepEqual(spec.paths['/api/auth/login'].post.security, []);
    assert.equal(spec.components.securitySchemes.sessionCookie.in, 'cookie');
  });
});
