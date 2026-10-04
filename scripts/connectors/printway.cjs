// Printway: herkese açık katalog sayfasının kullandığı API (apis.printway.io/v1/product-type/home/...).
// Liste: /catalog (ad, slug, görsel, displayPrice). Ayrıntı: /detail-product?slug= (minTitanium = standart seviye,
// minDiamond = üst üyelik seviyesi). Ana fiyat Titanium; Diamond üyelik fiyatı olarak gösterilir.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { cachedGet, crawl, decode } = require('./http.cjs');

const API = 'https://apis.printway.io/v1/product-type/home';
const SITE = 'https://printway.io/en/product/';
const cents = n => Math.round(Number(n) * 100);
function category(slugs, name) {
  const s = (slugs.join(' ') + ' ' + name).toLowerCase();
  if (/kid|baby|youth|toddler/.test(s)) return 'kids';
  if (/\bpet|dog|cat\b/.test(s)) return 'pets';
  if (/mug|tumbler|drinkware|bottle|cup\b|glass/.test(s)) return 'drinkware';
  if (/phone|case|airpod|mouse|tech/.test(s)) return 'phone';
  if (/poster|canvas|wall|frame|print\b|tapestry/.test(s)) return 'wall-art';
  if (/\bbag|tote|backpack|pouch/.test(s)) return 'bags';
  if (/sticker|card|notebook|journal|stationer|calendar/.test(s)) return 'stationery';
  if (/home|living|pillow|blanket|towel|rug|mat\b|curtain|bedding|ornament|decor|kitchen|apron|flag/.test(s)) return 'home';
  if (/hat|cap|beanie|jewel|necklace|keychain|sock|shoe|slipper|accessor|mask|scarf/.test(s)) return 'accessories';
  if (/cloth|shirt|tee|hoodie|sweat|apparel|jacket|dress|pants|short|legging|polo|tank|jersey|sweater|pajama|swim/.test(s)) return 'clothing';
  return 'other';
}

async function collect(progress = () => {}) {
  const checkedAt = new Date().toISOString();
  const list = JSON.parse((await cachedGet('printway', API + '/catalog', { headers: { Accept: 'application/json' } })).text).data;
  if (!Array.isArray(list) || list.length < 300) throw Error('Printway: katalog listesi beklenenden kısa');
  const details = await crawl(list, async item => {
    const r = await cachedGet('printway', `${API}/detail-product?slug=${encodeURIComponent(item.slug)}`, { headers: { Accept: 'application/json' } });
    try { return { item, d: JSON.parse(r.text).data }; } catch { return { item, d: null }; }
  }, { concurrency: 3, delayMs: 300, progress });
  const products = [], skipped = [];
  for (const { item, d } of details) {
    const titanium = d?.minTitanium, diamond = d?.minDiamond;
    if (!(titanium > 0)) { skipped.push({ slug: item.slug, reason: 'Titanium fiyatı yok' }); continue; }
    const locs = Object.keys(item.displayPrice || {});
    const name = decode(item.name).replace(/\s*\|\s*/g, ' | ').trim();
    const cat = category((d.categories || []).map(c => c.slug || c.name || ''), name);
    const sizes = (item.option || []).find(o => /size/i.test(o.label))?.values?.map(v => v.name).filter(Boolean);
    products.push({
      id: 'printway-' + item.slug, providerId: 'printway', sourceProductId: item.productCode || item.slug, family: 'printway-' + cat, category: cat,
      title: name, aliases: [], baseMinor: cents(titanium), baseMaxMinor: d.maxPrice > titanium ? cents(d.maxPrice) : undefined,
      subscriptionMinor: diamond > 0 && diamond < titanium ? cents(diamond) : undefined, currency: 'USD',
      imageUrl: item.mockupUrls?.[0] || null, sourceUrl: SITE + item.slug,
      sizes: sizes?.length ? (sizes.length > 1 ? `${sizes[0]}–${sizes[sizes.length - 1]}` : sizes[0]) : 'Tek ölçü', material: null,
      priceBasis: 'Printway katalog fiyatı · Titanium seviyesi en düşük varyant, baskı dahil · kargo ayrıca',
      shipping: null, deliveryDays: null, availableCountries: locs, fulfillmentProvider: locs.length ? 'Production: ' + locs.join(', ') : undefined,
      checkedOn: checkedAt.slice(0, 10), checkedAt, sourceKind: 'catalog', importedBy: 'printway-api-v1', priceVerified: true, priceVerification: 'public-catalog-api',
    });
  }
  fs.writeFileSync(path.resolve(__dirname, '../../data/printway-coverage.json'), JSON.stringify({ checkedAt, listed: list.length, imported: products.length, skipped }, null, 2));
  if (products.length < list.length * 0.8) throw Error(`Printway: ayrıntı alınamayan çok ürün (${products.length}/${list.length})`);
  return { products, pages: 1, reportedTotal: list.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect };
