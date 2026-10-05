// Subliminator: uygulamanın herkese açık katalog listesi (app.subliminator.com/products/list).
// minPrice = en ucuz varyant (sent, USD, tüm yüzey baskı dahil); minPriceWithSubscription = ücretli üyelik fiyatı.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { fetchText } = require('./http.cjs');

const LIST = 'https://app.subliminator.com/products/list?pagination=' + encodeURIComponent(JSON.stringify({ start: 0, number: 1000 }));
const CDN = 'https://cdn.subliminator.com/prod';
function category(name) {
  const s = name.toLowerCase();
  if (/kid|youth|baby|toddler/.test(s)) return 'kids';
  if (/\bdog|pet\b|cat\b/.test(s)) return 'pets';
  if (/tumbler|mug|bottle/.test(s)) return 'drinkware';
  if (/bag|backpack|duffel|tote|pouch/.test(s)) return 'bags';
  if (/blanket|towel|pillow|rug|mat\b|curtain|bedding|apron|seat cover|tapestry/.test(s)) return 'home';
  if (/puzzle|poster|canvas/.test(s)) return 'wall-art';
  if (/mask|hat|cap|sock|shoe|slipper|scarf|bandana|gaiter/.test(s)) return 'accessories';
  return 'clothing';
}

async function collect() {
  const checkedAt = new Date().toISOString();
  const j = JSON.parse((await fetchText(LIST, { headers: { Accept: 'application/json' } })).text);
  const list = j?.data?.results || [];
  if (list.length < j?.data?.pagination?.totalItemCount) throw Error('Subliminator: liste eksik geldi');
  const products = list.filter(p => p.isAvailable !== false && p.minPrice > 0).map(p => ({
    id: 'subliminator-' + p.id, providerId: 'subliminator', sourceProductId: String(p.id), family: 'subliminator-' + category(p.name), category: category(p.name),
    title: p.name, aliases: ['all-over print'], baseMinor: p.minPrice, baseMaxMinor: p.maxPrice > p.minPrice ? p.maxPrice : undefined,
    subscriptionMinor: p.minPriceWithSubscription > 0 && p.minPriceWithSubscription < p.minPrice ? p.minPriceWithSubscription : undefined, currency: 'USD',
    imageUrl: p.mainImageUrl || (p.productImageCollection?.[0] ? CDN + p.productImageCollection[0] : null), sourceUrl: 'https://app.subliminator.com/catalog',
    sizes: p.sizeRange || 'Tek ölçü', material: p.material || null, decorationMethods: ['Sublimation'],
    priceBasis: 'Subliminator katalog fiyatı · en ucuz varyant, tüm yüzey baskı dahil · kargo ayrıca',
    shipping: null, deliveryDays: null, availableCountries: [],
    checkedOn: checkedAt.slice(0, 10), checkedAt, sourceKind: 'catalog', importedBy: 'subliminator-api-v1', priceVerified: true, priceVerification: 'public-catalog-api',
  }));
  fs.writeFileSync(path.resolve(__dirname, '../../data/subliminator-coverage.json'), JSON.stringify({ checkedAt, listed: list.length, imported: products.length }, null, 2));
  if (products.length < 100) throw Error('Subliminator: beklenenden az ürün (' + products.length + ')');
  return { products, pages: 1, reportedTotal: list.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect };
