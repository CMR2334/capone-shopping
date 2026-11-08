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
  const seenIndex = new Map(); // merchantKey -> index into offers[]
  let inTodaysTopOffer = false;

  $('*').each((_, el) => {
    const $el = $(el);
    const text = $el.text().replace(/\s+/g, ' ').trim();
    if (!text || text.length > 160) return;

    // The email is traversed in document order. Keep the daily deal section
    // narrow: it begins at its heading and ends before the preview strip for
    // future daily offers. This avoids attributing the heading to every later
    // ordinary offer in the email.
    if (/^Today\s*'?\s*s\s+Top\s+Offer$/i.test(text)) {
      inTodaysTopOffer = true;
      return;
    }
    if (/^Top\s+offers\s+revealed\s+daily:?$/i.test(text)) {
      inTodaysTopOffer = false;
      return;
    }

    const cardCtx = contextText($el, 4);
    // The merchant name and the rate in gift-card cards often live in
    // different, deeply nested table cells. Search their nearest shared card
    // container rather than assuming the four-hop display context reaches it.
    const giftCardMerchant = nearestGiftCardMerchant($, $el);
    const match = matchOfferText(text) || matchGiftCardTopOffer(text, giftCardMerchant);
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
    // Newer emails use "Earn N% back at Merchant" even for the explicitly
    // labeled Today's Top card. Its section carries an overnight expiry that
    // must win over the email-wide "Expiring [date]" header.
    const isTodaysTop = match.isTodaysTop || !isEarn || inTodaysTopOffer;

    // Emails often carry a hidden preheader/preview copy of the top offer, phrased as
    // "Earn N% back at Merchant", ahead of the real "Today's Top Offer" card in the DOM.
    // A plain first-match dedup would lock in that copy and its generic expiry. Once the
    // real Today's Top card for the same merchant shows up, prefer it — it carries the
    // correct (often single-day) expiry rather than the catalog-wide default.
    const existingIdx = seenIndex.get(merchantKey);
    if (existingIdx !== undefined && !(isTodaysTop && offers[existingIdx].source !== 'todays-top')) {
      return;
    }

    const wasMatch = cardCtx.match(/Was\s+(\d+(?:\.\d+)?)%\s*back/i);
    const lastViewedMatch = cardCtx.match(/You last viewed (\w+\s+\d{1,2})/);

    const activationUrl = match.isGiftCardTopOffer
      ? giftCardOfferActivationLink($, $el, percentBack)
      : nearestActivationLink($el);
    const logoUrl = nearestLogoUrl($el);

    const expiry = isTodaysTop && todaysTopExpiry ? todaysTopExpiry : defaultExpiry;

    const offer = {
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
    };

    if (existingIdx !== undefined) {
      offers[existingIdx] = offer;
    } else {
      seenIndex.set(merchantKey, offers.length);
      offers.push(offer);
    }
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

function matchGiftCardTopOffer(text, merchant) {
  // A current "Today's Top Offer" layout separates the merchant from the reward:
  // "Redeem $25 Chewy gift card" appears above "+ Earn 25% back". It is not
  // captured by the regular "Earn N% back at Merchant" grammar.
  const reward = text.match(/^\+?\s*Earn\s+(\d+(?:\.\d+)?)%\s*back$/i);
  if (!reward) return null;

  if (!merchant) return null;

  return {
    isEarn: true,
    isTodaysTop: true,
    isGiftCardTopOffer: true,
    percentBack: parseFloat(reward[1]),
    dollarBack: null,
    capAmount: null,
    merchant,
  };
}

function nearestGiftCardMerchant($, $el) {
  let cur = $el;
  // Capital One's email markup uses several nested tables between the rate
  // and its "Redeem $… Merchant gift card" title. Do not climb to body/html:
  // that could accidentally associate a different card elsewhere in the email.
  for (let i = 0; i < 12; i++) {
    if (!cur.length || cur.is('body, html')) break;
    const text = cur.text().replace(/\s+/g, ' ').trim();
    const merchant = text.match(/Redeem\s+(?:up\s+to\s+)?\$[\d,.]+\s+(.+?)\s+gift\s+card\b/i)?.[1]?.trim();
    if (merchant) return merchant;
    cur = cur.parent();
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

function giftCardOfferActivationLink($, $el, percentBack) {
  const earnPattern = new RegExp(`(?:no thanks,?\\s*)?(?:only\\s*)?earn\\s+${percentBack}%\\s+back`, 'i');
  let cur = $el;
  for (let i = 0; i < 12; i++) {
    if (!cur.length || cur.is('body, html')) break;
    const link = cur.find('a[href]').filter((_, anchor) => earnPattern.test($(anchor).text().replace(/\s+/g, ' ').trim())).first();
    if (link.length) return link.attr('href');
    cur = cur.parent();
  }
  return nearestActivationLink($el);
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
