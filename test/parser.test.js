const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCaponeEmail } = require('../ingestor/parser');

test("prefers the real Today's Top Offer card over a hidden preheader duplicate", () => {
  // Mirrors the real email layout: a hidden inbox-preview div repeats the top offer as
  // "Earn N% back at Merchant" ahead of the visible hero card in DOM order, and a
  // catalog-wide "Expiring Aug 23" banner sits near the top while the hero card's own
  // single-day expiry ("Rewards offer ends on Aug 20 at 11:59 PM PDT") is in its footer.
  const html = `
    <html><body>
      <div style="display:none">Earn 30% back at StubHub</div>
      <div>Expiring Aug 23 or as noted</div>
      <div class="hero">
        <a href="https://example.com/stubhub"><img src="https://example.com/stubhub.png"></a>
        <span>30% back at StubHub</span>
      </div>
      <p>Rewards offer ends on Aug 20 at 11:59 PM PDT. Limited availability, rate may vary.</p>
    </body></html>
  `;

  const { offers } = parseCaponeEmail(html, {
    messageId: 'abc123',
    date: '2026-08-20T12:14:51.000Z',
  });

  const stubhub = offers.find(o => o.merchant === 'StubHub');
  assert.ok(stubhub, 'expected a StubHub offer to be parsed');
  assert.equal(stubhub.source, 'todays-top');
  assert.equal(stubhub.expiresAt, '2026-08-21T07:00:00.000Z');
});

test("parses a gift-card Today's Top Offer whose merchant is separate from its rate", () => {
  const html = `
    <html><body>
      <div>Expiring Nov 11 or as noted</div>
      <div class="hero">
        <p>Today's Top Offer</p>
        <p>Redeem <span>$25 Chewy gift card</span></p>
        <p>PURINA PRO PLAN Adult Sensitive Skin</p>
        <p>+ Earn 25% back</p>
        <p>Rewards offer ends on Nov 8 at 11:59 PM PST.</p>
        <a href="https://example.com/gift-card">Redeem Gift Card</a>
        <a href="https://example.com/earn-rate">No thanks, only earn 25% back</a>
      </div>
    </body></html>
  `;

  const { offers } = parseCaponeEmail(html, {
    messageId: 'chewy123',
    date: '2026-11-08T09:36:56.000Z',
  });

  const chewy = offers.find(o => o.merchant === 'Chewy');
  assert.ok(chewy, 'expected the Chewy gift-card top offer to be parsed');
  assert.equal(chewy.percentBack, 25);
  assert.equal(chewy.source, 'todays-top');
  assert.equal(chewy.expiresAt, '2026-11-09T07:00:00.000Z');
  assert.equal(chewy.activationUrl, 'https://example.com/earn-rate');
});

test("parses a deeply nested gift-card Today's Top Offer", () => {
  const html = `
    <html><body>
      <div>Expiring Nov 11 or as noted</div>
      <div class="hero">
        <p>Today's Top Offer</p>
        <p>Redeem <span>$25 Chewy gift card</span></p>
        <div><div><div><div><div>
          <p>+ Earn 25% back</p>
          <a href="https://example.com/earn-rate">No thanks, only earn 25% back</a>
        </div></div></div></div></div>
        <p>Rewards offer ends on Nov 8 at 11:59 PM PST.</p>
      </div>
    </body></html>
  `;

  const { offers } = parseCaponeEmail(html, {
    messageId: 'deep-chewy123',
    date: '2026-11-08T09:36:56.000Z',
  });

  const chewy = offers.find(o => o.merchant === 'Chewy');
  assert.ok(chewy, 'expected the deeply nested Chewy offer to be parsed');
  assert.equal(chewy.percentBack, 25);
  assert.equal(chewy.activationUrl, 'https://example.com/earn-rate');
});

test("uses the overnight expiry for an Earn-prefixed Today's Top Offer", () => {
  const html = `
    <html><body>
      <div>Expiring Nov 11 or as noted</div>
      <section>
        <p>Today's Top Offer</p>
        <div><span>Earn 35% back at Serta</span></div>
        <p>Rewards offer ends on Nov 8 at 11:59 PM PST.</p>
      </section>
      <p>Top offers revealed daily:</p>
      <div>Earn 30% back at Free Country</div>
    </body></html>
  `;

  const { offers } = parseCaponeEmail(html, {
    messageId: 'serta123',
    date: '2026-11-08T00:37:49.000Z',
  });

  const serta = offers.find(o => o.merchant === 'Serta');
  const freeCountry = offers.find(o => o.merchant === 'Free Country');
  assert.equal(serta.source, 'todays-top');
  assert.equal(serta.expiresAt, '2026-11-09T07:00:00.000Z');
  assert.equal(freeCountry.source, 'single-use');
  assert.equal(freeCountry.expiresAt, '2026-11-12T07:00:00.000Z');
});
