const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidTimeZone, resolveLocalDateRange } = require('../../src/local-date');

test('timezone validation accepts IANA zones and rejects invalid identifiers', () => {
  assert.equal(isValidTimeZone('Asia/Tashkent'), true);
  assert.equal(isValidTimeZone('Europe/London'), true);
  assert.equal(isValidTimeZone('Not/A_Zone'), false);
  assert.equal(isValidTimeZone(''), false);
});

test('explicit calendar dates require exact real YYYY-MM-DD values', () => {
  assert.deepEqual(resolveLocalDateRange('2028-02-29', 'Asia/Tashkent', 0), {
    date: '2028-02-29',
    start: '2028-02-28 19:00:00',
    end: '2028-02-29 19:00:00'
  });
  for (const value of [
    '', '2026-2-01', '2026-02-1', '2026-02-29', '2026-04-31',
    '2026-00-10', '2026-13-10', '2026-01-01T00:00:00Z', 'text'
  ]) assert.equal(resolveLocalDateRange(value, 'Asia/Tashkent', 0), null, value);
});

test('omitted date resolves today in the configured timezone without host dependence', () => {
  const now = Date.parse('2026-10-16T20:30:00.000Z');
  assert.deepEqual(resolveLocalDateRange(undefined, 'Asia/Tashkent', now), {
    date: '2026-10-17',
    start: '2026-10-16 19:00:00',
    end: '2026-10-17 19:00:00'
  });
  assert.deepEqual(resolveLocalDateRange('2026-12-31', 'Asia/Tashkent', now), {
    date: '2026-12-31',
    start: '2026-12-30 19:00:00',
    end: '2026-12-31 19:00:00'
  });
});
