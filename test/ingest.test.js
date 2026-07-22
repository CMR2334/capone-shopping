const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeOffers } = require('../ingestor/ingest');

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

test('keeps the highest active percentage even when a lower offer expires later', () => {
  const now = new Date('2026-07-23T12:00:00.000Z');
  const high = offer(35, '2026-07-25T07:00:00.000Z', '2026-07-21T23:02:43.000Z');
  const lower = offer(14, '2026-07-26T07:00:00.000Z', '2026-07-22T05:14:52.000Z');

  assert.equal(mergeOffers([high, lower], now)[0], high);
  assert.equal(mergeOffers([lower, high], now)[0], high);
});

test('falls back to the lower active percentage after the higher offer expires', () => {
  const now = new Date('2026-07-25T08:00:00.000Z');
  const expiredHigh = offer(35, '2026-07-25T07:00:00.000Z', '2026-07-21T23:02:43.000Z');
  const activeLower = offer(14, '2026-07-26T07:00:00.000Z', '2026-07-22T05:14:52.000Z');

  assert.deepEqual(mergeOffers([expiredHigh, activeLower], now), [activeLower]);
});

test('uses later expiry and then newer email to break equal-rate ties', () => {
  const now = new Date('2026-07-23T12:00:00.000Z');
  const earlierExpiry = offer(20, '2026-07-25T07:00:00.000Z', '2026-07-22T01:00:00.000Z');
  const olderEmail = offer(20, '2026-07-26T07:00:00.000Z', '2026-07-22T02:00:00.000Z');
  const newerEmail = offer(20, '2026-07-26T07:00:00.000Z', '2026-07-22T03:00:00.000Z');

  assert.deepEqual(mergeOffers([earlierExpiry, olderEmail, newerEmail], now), [newerEmail]);
});

test('keeps the highest active flat-dollar offer', () => {
  const now = new Date('2026-07-23T12:00:00.000Z');
  const high = offer(null, '2026-07-25T07:00:00.000Z', '2026-07-21T23:02:43.000Z', { dollarBack: 24 });
  const lower = offer(null, '2026-07-26T07:00:00.000Z', '2026-07-22T05:14:52.000Z', { dollarBack: 10 });

  assert.deepEqual(mergeOffers([high, lower], now), [high]);
});
