// Toaddit: sitenin "All Products" sayfasının kullandığı herkese açık liste
// (POST api.toaddit.com/toadditbusiness/productService/productPrototype/list).
// Her ölçünün adet kademeli fiyatı var; tek ürün fiyatı = 1-9 adet kademesi (level 1). En ucuz ölçü alınır.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { UA, sleep } = require('./http.cjs');

const API = 'https://api.toaddit.com/toadditbusiness/productService/productPrototype/list';
const SIZE = 100;
function category(name, cat) {
  const s = (name + ' ' + cat).toLowerCase();
  if (/kid|youth|baby|toddler|children/.test(s)) return 'kids';
  if (/\bpet|dog|cat\b/.test(s)) return 'pets';
  if (/shoe|sneaker|slipper|sandal|boot|sock|hat|cap|mask|scarf|jewel|necklace|watch|wallet|glasses|umbrella|keychain/.test(s)) return 'accessories';
  if (/mug|tumbler|bottle|cup\b|drink/.test(s)) return 'drinkware';
  if (/phone|case|airpod|mouse|tablet|laptop sleeve/.test(s)) return 'phone';
  if (/bag|backpack|tote|purse|pouch/.test(s)) return 'bags';
  if (/canvas|poster|wall|frame|tapestry|puzzle/.test(s)) return 'wall-art';
  if (/home|pillow|blanket|towel|rug|mat\b|curtain|bedding|apron|kitchen|seat cover|car /.test(s)) return 'home';
  return 'clothing';
}

async function page(n) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'User-Agent': UA, Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ page: { pageIndex: n, pageSize: SIZE } }), signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) { if (attempt >= 3) throw e; await sleep(3000 * attempt); }
  }
}

async function collect(progress = () => {}) {
  const checkedAt = new Date().toISOString();
  const first = await page(1);
  const total = first.page.total, pages = Math.ceil(total / SIZE), rows = [...first.data];
  for (let n = 2; n <= pages; n++) { rows.push(...(await page(n)).data); progress(n, pages); await sleep(500); }
  const products = [], skipped = [];
  for (const d of rows) {
    if (d.status !== 1) { skipped.push({ id: d.id, reason: 'pasif' }); continue; }
    const tier1 = (d.sizeList || []).filter(s => s.status !== 0).map(s => (s.sizeLevelCategoryPriceList || []).find(x => x.levelCategoryItem?.minCount === 1)?.price).filter(p => p > 0);
    if (!tier1.length) { skipped.push({ id: d.id, reason: 'tek adet fiyatı yok' }); continue; }
    const min = Math.min(...tier1), max = Math.max(...tier1);
    const name = (d.productPrototypePlatform?.name || d.englishName || '').trim();
    const cat = category(name, d.productCategory?.name || '');
    const sizes = (d.sizeList || []).map(s => s.sizeName).filter(Boolean);
    products.push({
      id: 'toaddit-' + d.id, providerId: 'toaddit', sourceProductId: String(d.id), family: 'toaddit-' + cat, category: cat,
      title: name, aliases: [d.productCategory?.name].filter(Boolean), baseMinor: Math.round(min * 100), baseMaxMinor: max > min ? Math.round(max * 100) : undefined, currency: 'USD',
      imageUrl: d.styleList?.[0]?.displayImageUrl || null, sourceUrl: `https://www.toaddit.com/productsDetail/${name.split(/\s+/).join('-')}-${d.id}`,
      sizes: sizes.length > 1 ? `${sizes[0]}–${sizes[sizes.length - 1]}` : sizes[0] || 'Tek ölçü', material: null,
      priceBasis: 'Toaddit katalog fiyatı · 1-9 adet kademesi, en ucuz ölçü, baskı dahil · kargo ayrıca',
      production: d.deliveryTimeMin ? `Üretim: ${d.deliveryTimeMin}–${d.deliveryTimeMax} gün` : null,
      shipping: null, deliveryDays: null, availableCountries: [],
      checkedOn: checkedAt.slice(0, 10), checkedAt, sourceKind: 'catalog', importedBy: 'toaddit-api-v1', priceVerified: true, priceVerification: 'public-catalog-api',
    });
  }
  fs.writeFileSync(path.resolve(__dirname, '../../data/toaddit-coverage.json'), JSON.stringify({ checkedAt, listed: total, fetched: rows.length, imported: products.length, skipped: skipped.slice(0, 100) }, null, 2));
  if (rows.length < total * 0.95) throw Error(`Toaddit: liste eksik (${rows.length}/${total})`);
  return { products, pages, reportedTotal: total, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect };
