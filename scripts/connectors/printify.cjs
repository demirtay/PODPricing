// Printify: herkese açık katalog servisi (printify.com/app/products sayfasının kullandığı uç nokta).
// Her blueprint için standart plan en düşük maliyeti alınır (tek baskı alanı dahil, kargo hariç).
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { record } = require('../public-connectors.cjs');

const BASE = 'https://printify.com/product-catalog-service/api/v1/blueprints/search';
const UA = 'Mozilla/5.0 (compatible; POD-Atlas/1.0; fiyat karsilastirma)';
const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function page(n) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(`${BASE}?page=${n}&limit=100`, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
      if (r.status === 429 && attempt < 4) { await sleep(30000 * attempt); continue; }
      if (!r.ok) throw Error('Printify HTTP ' + r.status);
      const d = await r.json();
      if (d.current_page !== n || !Array.isArray(d.data)) throw Error('Printify sayfa doğrulanamadı: ' + n);
      return d;
    } catch (e) { if (attempt >= 3) throw e; await sleep(5000 * attempt); }
  }
}

const METHOD = { dtg: 'DTG', dtf: 'DTF', embroidery: 'Nakış', sublimation: 'Süblimasyon', uv: 'UV baskı', 'all-over-print': 'Tüm yüzey baskı', screen: 'Serigrafi', laser: 'Lazer kazıma', engraving: 'Kazıma', 'puff-print': 'Kabarık baskı', 'glitter-print': 'Simli baskı', 'metallic-print': 'Metalik baskı' };
const MARKET = { usa: 'US', us: 'US', 'united kingdom': 'UK', uk: 'UK', europe: 'EU', eu: 'EU', canada: 'CA', can: 'CA', 'australia/nz': 'AU', aus: 'AU', international: 'Uluslararası' };

function normalize(b, checkedAt) {
  const r = record('printify', b.blueprintId, b.name, b.minPrice,
    `https://images.printify.com/api/catalog/${b.images[0].src}.jpg?s=320`,
    `https://printify.com/app/products/${b.blueprintId}/${slug(b.brandName) || 'generic'}/${slug(b.name)}`,
    [b.sizesCount ? b.sizesCount + ' beden' : '', b.colorsCount ? b.colorsCount + ' renk' : ''].filter(Boolean).join(' · ') || 'Seçenekler üreticide');
  const methods = (b.decoration_methods || []).map(m => METHOD[m] || m);
  // yalnızca marka+model (model borsası eşleşmesi için); pazarlama etiketleri aramayı kirletir
  r.aliases = [...new Set([...r.aliases, b.brandName && b.model ? `${b.brandName} ${b.model}` : ''].filter(Boolean))];
  r.priceBasis = `Printify standart plan en düşük maliyeti · tek baskı alanı dahil, kargo ve vergi hariç · ${b.printProviderCount} baskı tesisi arasındaki en düşük`
    + (b.minPriceSubscription && b.minPriceSubscription < b.minPrice ? ` · Printify Premium üyelikte ${(b.minPriceSubscription / 100).toFixed(2)} USD` : '');
  r.baseMaxMinor = Math.max(...Object.values(b.cost_ranges_by_decoration_method_standard || {}).map(x => x.max || 0), b.minPrice);
  r.subscriptionMinor = b.minPriceSubscription || null;
  r.decorationMethods = methods;
  r.availableCountries = [...new Set((b.targetMarkets || []).map(m => MARKET[String(m).toLowerCase()] || m).filter(Boolean))];
  r.fulfillmentProvider = b.printProviderCount ? `${b.printProviderCount} baskı tesisi` : null;
  r.sourceKind = 'api';
  r.priceVerified = true;
  r.priceVerification = 'public-catalog-service';
  r.importedBy = 'printify-catalog-v1';
  r.checkedAt = checkedAt; r.checkedOn = checkedAt.slice(0, 10);
  return r;
}

async function collect(progress = () => {}) {
  const checkedAt = new Date().toISOString();
  const first = await page(1);
  const raw = [...first.data];
  for (let n = 2; n <= first.last_page; n++) {
    await sleep(1500);
    const d = await page(n);
    if (d.total !== first.total) throw Error('Aktarım sırasında Printify kataloğu değişti');
    raw.push(...d.data);
    progress(n, first.last_page);
  }
  const ids = new Set(raw.map(b => b.blueprintId));
  if (ids.size !== first.total) throw Error(`Printify eksik/tekrar kayıt: ${ids.size}/${first.total}`);
  const products = [], skipped = [];
  for (const b of raw) {
    if (!(b.minPrice > 0)) { skipped.push({ id: b.blueprintId, name: b.name, reason: 'Fiyat bilgisi yok' }); continue; }
    if (!b.images?.length) { skipped.push({ id: b.blueprintId, name: b.name, reason: 'Görsel yok' }); continue; }
    products.push(normalize(b, checkedAt));
  }
  fs.writeFileSync(path.resolve(__dirname, '../../data/printify-coverage.json'), JSON.stringify({
    checkedAt, reportedTotal: first.total, uniqueFetched: ids.size, imported: products.length, skipped,
  }, null, 2));
  return { products, pages: first.last_page, reportedTotal: first.total, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { base: 'https://printify.com/app/products', collect, normalize };
