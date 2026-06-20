const cheerio = require('cheerio');

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function parseCaponeEmail(html, meta = {}) {
  const $ = cheerio.load(html);
  const fullText = $('body').text().replace(/\s+/g, ' ').trim();
  const baseDate = meta.date ? new Date(meta.date) : new Date();

  const headerExpiryMatch = fullText.match(/Expiring (\w+)\s+(\d{1,2})/);
  const defaultExpiry = headerExpiryMatch
    ? resolveDate(headerExpiryMatch[1], headerExpiryMatch[2], baseDate)
    : null;

  const topMatch = fullText.match(/Rewards offer ends on (\w+)\s+(\d{1,2})/);
  const todaysTopExpiry = topMatch
    ? resolveDate(topMatch[1], topMatch[2], baseDate)
    : null;

  const offers = [];
  const seen = new Set();

  $('*').each((_, el) => {
    const $el = $(el);
    const text = $el.text().replace(/\s+/g, ' ').trim();
    if (!text || text.length > 160) return;

    const match = matchOfferText(text);
    if (!match) return;

    let descendantMatches = false;
    $el.find('*').each((__, child) => {
      const childText = $(child).text().replace(/\s+/g, ' ').trim();
      if (childText && childText.length <= 160 && matchOfferText(childText)) {
        descendantMatches = true;
        return false;
      }
    });
    if (descendantMatches) return;

    const { merchant, percentBack, dollarBack, isEarn, capAmount } = match;
    const merchantKey = merchant.toLowerCase().trim();
    if (seen.has(merchantKey)) return;
    seen.add(merchantKey);

    const cardCtx = contextText($el, 4);
    const isTodaysTop = !isEarn;

    const wasMatch = cardCtx.match(/Was\s+(\d+(?:\.\d+)?)%\s*back/i);
    const lastViewedMatch = cardCtx.match(/You last viewed (\w+\s+\d{1,2})/);

    const activationUrl = nearestActivationLink($el);
    const logoUrl = nearestLogoUrl($el);

    const expiry = isTodaysTop && todaysTopExpiry ? todaysTopExpiry : defaultExpiry;

    offers.push({
      merchant,
      percentBack,
      dollarBack: dollarBack || null,
      capAmount: capAmount || null,
      wasPercent: wasMatch ? parseFloat(wasMatch[1]) : null,
      lastViewed: lastViewedMatch ? lastViewedMatch[1] : null,
      expiresAt: expiry ? expiry.toISOString() : null,
      activationUrl,
      logoUrl,
      source: isTodaysTop ? 'todays-top' : (capAmount ? 'personalized' : 'single-use'),
      emailMessageId: meta.messageId || null,
      emailDate: meta.date || null,
    });
  });

  return { offers, upcomingReveals: [] };
}

function matchOfferText(text) {
  // Percent offer: "(Earn) (up to) N% back (, up to $cap) at Merchant"
  const pct = text.match(/^(Earn\s+)?(?:up\s+to\s+)?(\d+(?:\.\d+)?)%\s*back(?:,\s*up\s+to\s+\$(\d+(?:\.\d+)?))?\s+at\s+(.+?)(?:\s*[-—]\s*single.use.*)?$/i);
  if (pct) {
    return {
      isEarn: !!pct[1],
      percentBack: parseFloat(pct[2]),
      dollarBack: null,
      capAmount: pct[3] ? parseFloat(pct[3]) : null,
      merchant: pct[4].trim(),
    };
  }
  // Flat-dollar offer: "(Earn) (up to) $N back at Merchant" (no percentage)
  const dol = text.match(/^(Earn\s+)?(?:up\s+to\s+)?\$(\d+(?:\.\d+)?)\s*back\s+at\s+(.+?)(?:\s*[-—]\s*single.use.*)?$/i);
  if (dol) {
    return {
      isEarn: !!dol[1],
      percentBack: null,
      dollarBack: parseFloat(dol[2]),
      capAmount: null,
      merchant: dol[3].trim(),
    };
  }
  return null;
}

function contextText($el, maxHops) {
  let cur = $el;
  for (let i = 0; i < maxHops; i++) {
    if (!cur.parent().length) break;
    cur = cur.parent();
  }
  return cur.text().replace(/\s+/g, ' ').trim();
}

function nearestActivationLink($el) {
  const ancestor = $el.closest('a[href]');
  if (ancestor.length) return ancestor.attr('href');
  let cur = $el.parent();
  for (let i = 0; i < 8; i++) {
    if (!cur.length) break;
    const a = cur.find('a[href]').first();
    if (a.length) return a.attr('href');
    cur = cur.parent();
  }
  return null;
}

function nearestLogoUrl($el) {
  let cur = $el.parent();
  for (let i = 0; i < 8; i++) {
    if (!cur.length) break;
    const img = cur.find('img[src]').first();
    if (img.length) return img.attr('src');
    cur = cur.parent();
  }
  return null;
}

function resolveDate(monthName, day, baseDate) {
  const monthIdx = MONTHS.findIndex(m => m.toLowerCase().startsWith(monthName.toLowerCase().slice(0, 3)));
  if (monthIdx < 0) return null;
  const dayNum = parseInt(day, 10);
  let year = baseDate.getUTCFullYear();
  const candidate = new Date(Date.UTC(year, monthIdx, dayNum));
  if (candidate < baseDate && (baseDate - candidate) > 60 * 24 * 60 * 60 * 1000) {
    year++;
  }
  return new Date(Date.UTC(year, monthIdx, dayNum + 1, 7, 0, 0));
}

module.exports = { parseCaponeEmail };
