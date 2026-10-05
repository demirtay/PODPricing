// Promio (NL/EU) ve Eco Merch (UK) aynı mağaza altyapısını kullanır: /products?page=N sayfalarında ürün kartları
// (bağlantı, görsel data-src, ad, "From €/£X"). Promio ürün sayfası "Includes print" diyor (baskı dahil, KDV hariç);
// Eco Merch fiyatları KDV dahil ve baskı ifadesi yok (fiyat türü belirsiz).
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { cachedGet, decode, sleep } = require('./http.cjs');
const { exchange } = require('../store-connectors.cjs');

const SITES = {
  promio: { base: 'https://promio.eu', currency: 'EUR', vat: 'excl', basis: 'Promio katalog "From" fiyatı · baskı dahil (ürün sayfası: "Includes print") · KDV hariç · kargo ayrıca', countries: ['EU'] },
  ecomerch: { base: 'https://ecomerch.com', currency: 'GBP', vat: 'incl', basis: 'Eco Merch katalog "From" fiyatı · KDV dahil · baskının dahil olup olmadığı kaynakta belirtilmiyor · kargo ayrıca', countries: ['GB'] },
};
function category(s) {
  s = s.toLowerCase();
  if (/kid|baby|toddler|youth|junior/.test(s)) return 'kids';
  if (/bag|tote|backpack|pouch|sack/.test(s)) return 'bags';
  if (/cap|hat|beanie|sock|scarf|bandana|apron/.test(s)) return 'accessories';
  if (/mug|cup|bottle/.test(s)) return 'drinkware';
  if (/towel|blanket|cushion|pillow/.test(s)) return 'home';
  return 'clothing';
}

function parse(html, base) {
  const out = [];
  for (const sec of html.split('<section class="product-item').slice(1)) {
    const rel = sec.match(/href="(\/[^"?#]+)"/)?.[1];
    const title = decode(sec.match(/class="product-title"[\s\S]*?<span>([^<]+)<\/span>/)?.[1] || '').replace(/­/g, '').trim();
    const price = sec.match(/product-price-(?:exc|inc)-vat-value"[^>]*>([^<]+)</)?.[1];
    const img = sec.match(/data-src="([^"]+)"/)?.[1];
    if (!rel || !title || !price) continue;
    const num = decode(price).replace(/[^\d.,]/g, '').replace(/,(\d{2})$/, '.$1').replace(/,/g, '');
    out.push({ rel, title, minor: Math.round(Number(num) * 100), img: img ? new URL(decode(img), base).href : null, colors: +(sec.match(/Available in (\d+) colou?rs/)?.[1] || 0) });
  }
  return out;
}

async function collect(id, progress = () => {}) {
  const s = SITES[id];
  const checkedAt = new Date().toISOString();
  const fx = await exchange(s.currency);
  const first = (await cachedGet(id, s.base + '/products')).text;
  const total = +(first.match(/of (\d+) items/)?.[1] || 0);
  const items = parse(first, s.base);
  for (let n = 2; items.length < total && n <= 40; n++) {
    const more = parse((await cachedGet(id, `${s.base}/products?page=${n}`)).text, s.base);
    if (!more.length) break;
    items.push(...more); progress(n); await sleep(500);
  }
  const products = [];
  for (const x of items) {
    const slug = x.rel.replace(/^\//, '').replace(/\//g, '-');
    if (products.some(p => p.sourceProductId === slug)) continue;
    const cat = category(x.title);
    products.push({
      id: `${id}-${slug}`, providerId: id, sourceProductId: slug, family: `${id}-${cat}`, category: cat,
      title: x.title, aliases: [], baseMinor: Math.round(x.minor * fx.rate), currency: 'USD', sourceMinor: x.minor, sourceCurrency: s.currency, exchangeRate: fx.rate, exchangeDate: fx.date,
      imageUrl: x.img, sourceUrl: s.base + x.rel, sizes: x.colors ? `${x.colors} renk; ölçüler üreticide` : 'Ölçü ve renkler üreticide seçilir', material: null,
      priceBasis: s.basis, shipping: null, deliveryDays: null, availableCountries: s.countries,
      checkedOn: checkedAt.slice(0, 10), checkedAt, sourceKind: 'catalog', importedBy: 'promio-platform-v1', priceVerified: true, priceVerification: 'public-catalog-page',
    });
  }
  fs.writeFileSync(path.resolve(__dirname, `../../data/${id}-coverage.json`), JSON.stringify({ checkedAt, listed: total, imported: products.length }, null, 2));
  if (!total || products.length < total * 0.7) throw Error(`${id}: liste eksik (${products.length}/${total})`);
  return { products, pages: Math.ceil(total / 24), reportedTotal: total, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect, SITES };
