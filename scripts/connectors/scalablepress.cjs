// Scalable Press: herkese açık ürün API'si (api.scalablepress.com/v2/categories -> v3 kategori -> v3 ürün).
// properties.startingAtPrice boş ürünün (baskısız) başlangıç fiyatıdır (ör. Gildan 5000 = $2.16);
// baskı teklifi API anahtarı gerektirir, bu yüzden kayıtlar "boş ürün" olarak işaretlenir.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { cachedGet, crawl } = require('./http.cjs');

const SKIP_CATS = new Set(['generic-dropoff', 'swatch', 'third-party']);
const FAMILY = { Accessories: 'accessories', Bags: 'bags', Home: 'home', Wall: 'wall-art', Drinkware: 'drinkware', Tech: 'phone', Jewelry: 'accessories' };
function category(cat) {
  const id = cat.categoryId;
  if (/infant|toddler|youth/.test(id)) return 'kids';
  if (/mug/.test(id)) return 'drinkware';
  if (/bag|backpack/.test(id)) return 'bags';
  if (/poster|metal-print/.test(id)) return 'wall-art';
  if (/phone|mousepad/.test(id)) return 'phone';
  if (/coaster|cutting|pillow|towel|apron|magnet/.test(id)) return 'home';
  if (/hat|beanie|bracelet|earring|necklace|scarf|sock|sandal|tie/.test(id)) return 'accessories';
  return FAMILY[cat.family] || 'clothing';
}
// ~6000 ürün ayrıntısı: boş ürün fiyatları seyrek değiştiği için önbellek 3 gün
const json = async u => JSON.parse((await cachedGet('scalablepress', u, { ttlHours: 72, headers: { Accept: 'application/json' } })).text || 'null');
const https = u => u ? String(u).replace(/^http:\/\//, 'https://') : null;

async function collect(progress = () => {}) {
  const checkedAt = new Date().toISOString();
  const cats = (await json('https://api.scalablepress.com/v2/categories')).filter(c => !SKIP_CATS.has(c.categoryId));
  const listed = new Map();
  for (const cat of cats) {
    const c = await json(cat.url);
    for (const p of c?.products || []) if (!listed.has(p.id)) listed.set(p.id, { ...p, cat });
  }
  const items = [...listed.values()];
  const details = await crawl(items, async p => ({ p, d: await json(p.url).catch(() => null) }), { concurrency: 3, delayMs: 250, progress });
  const products = [], skipped = [];
  for (const { p, d } of details) {
    const price = d?.properties?.startingAtPrice;
    if (!(price > 0) || d.available === false) { skipped.push({ id: p.id, reason: !d ? 'ayrıntı yok' : d.available === false ? 'satışta değil' : 'fiyat yok' }); continue; }
    const brand = d.properties.brand, style = d.properties.style;
    // kaynakta bozuk kodlanmış ®/™ işaretleri ("Ã‚Â®") ve tekrar eden marka adı ("Port Authority Port Authority")
    const clean = String(d.name).replace(/[ÃÂ][^\s\w]*|[®™]/g, '').replace(/\s+/g, ' ').trim()
      .replace(/^(.+?) \1\b/, '$1');
    const title = brand && style && !clean.includes(style) ? `${clean} | ${brand} ${style}` : clean;
    const cat = category(p.cat);
    const methods = [d.properties.dtg && 'DTG', d.properties.screenprint && 'Screen print', d.properties.embr && 'Embroidery'].filter(Boolean);
    products.push({
      id: 'scalablepress-' + p.id, providerId: 'scalablepress', sourceProductId: p.id, family: 'scalablepress-' + cat, category: cat,
      title, aliases: [p.cat.name], baseMinor: price, currency: 'USD', includesPrint: false,
      imageUrl: https(d.image?.url || p.image?.url), sourceUrl: 'https://scalablepress.com/catalog',
      sizes: 'Ölçü ve renkler üreticide seçilir', material: d.properties.material || null, decorationMethods: methods,
      priceBasis: 'Scalable Press ürün API "startingAtPrice" · boş ürün başlangıç fiyatı; baskı ücreti ayrıca (teklif API anahtarı ister) · kargo ayrıca',
      production: d.properties.sla?.days ? `Üretim: ${d.properties.sla.days} gün` : null,
      shipping: null, deliveryDays: null, availableCountries: ['US'],
      checkedOn: checkedAt.slice(0, 10), checkedAt, sourceKind: 'catalog', importedBy: 'scalablepress-api-v1', priceVerified: true, priceVerification: 'public-product-api',
    });
  }
  fs.writeFileSync(path.resolve(__dirname, '../../data/scalablepress-coverage.json'), JSON.stringify({ checkedAt, categories: cats.length, listed: items.length, imported: products.length, skippedCount: skipped.length, skipped: skipped.slice(0, 200) }, null, 2));
  if (products.length < 200) throw Error('Scalable Press: beklenenden az ürün (' + products.length + ')');
  return { products, pages: cats.length, reportedTotal: items.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect };
