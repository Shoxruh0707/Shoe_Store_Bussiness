const test = require('node:test');
const assert = require('node:assert/strict');

test('authorization onboarding migration is registered after the immutable inventory migrations', () => {
  const migrations = require('../../src/db/migrations');
  assert.deepEqual(
    migrations.map((migration) => migration.id),
    ['0001-current-inventory', '0002-product-search-image-order', '0003-authorization-onboarding']
  );
});
