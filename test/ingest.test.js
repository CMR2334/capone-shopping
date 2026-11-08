const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeOffers, isRetryableGmailError } = require('../ingestor/ingest');

function offer(percentBack, expiresAt, emailDate, overrides = {}) {
  return {
    merchant: 'CVS',
    percentBack,
    dollarBack: null,
    expiresAt,
    emailDate,
    ...overrides,
  };
}

test('keeps the newest active percentage when a later email lowers the rate', () => {
  const now = new Date('2026-07-23T12:00:00.000Z');
  const high = offer(35, '2026-07-25T07:00:00.000Z', '2026-07-21T23:02:43.000Z');
  const lower = offer(14, '2026-07-26T07:00:00.000Z', '2026-07-22T05:14:52.000Z');

  assert.equal(mergeOffers([high, lower], now)[0], lower);
  assert.equal(mergeOffers([lower, high], now)[0], lower);
});

test('falls back to the lower active percentage after the higher offer expires', () => {
  const now = new Date('2026-07-25T08:00:00.000Z');
  const expiredHigh = offer(35, '2026-07-25T07:00:00.000Z', '2026-07-21T23:02:43.000Z');
  const activeLower = offer(14, '2026-07-26T07:00:00.000Z', '2026-07-22T05:14:52.000Z');

  assert.deepEqual(mergeOffers([expiredHigh, activeLower], now), [activeLower]);
});

test('uses later expiry only when competing records have the same email date', () => {
  const now = new Date('2026-07-23T12:00:00.000Z');
  const earlierExpiry = offer(20, '2026-07-25T07:00:00.000Z', '2026-07-22T03:00:00.000Z');
  const laterExpiry = offer(20, '2026-07-26T07:00:00.000Z', '2026-07-22T03:00:00.000Z');

  assert.deepEqual(mergeOffers([earlierExpiry, laterExpiry], now), [laterExpiry]);
});

test('keeps the newest active flat-dollar offer', () => {
  const now = new Date('2026-07-23T12:00:00.000Z');
  const high = offer(null, '2026-07-25T07:00:00.000Z', '2026-07-21T23:02:43.000Z', { dollarBack: 24 });
  const lower = offer(null, '2026-07-26T07:00:00.000Z', '2026-07-22T05:14:52.000Z', { dollarBack: 10 });

  assert.deepEqual(mergeOffers([high, lower], now), [lower]);
});

test('retries Gmail quota and transient service errors, but not authentication errors', () => {
  assert.equal(isRetryableGmailError({ code: 429, message: 'Quota exceeded' }), true);
  assert.equal(isRetryableGmailError({ response: { status: 503 } }), true);
  assert.equal(isRetryableGmailError({ code: 401, message: 'Invalid Credentials' }), false);
});
