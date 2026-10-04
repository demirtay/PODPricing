// MerchOne (AB): /products-catalog/ sayfasındaki ürünlerin JSON-LD Offer fiyatı (EUR) ve ülke bazlı kargo.
// robots.txt ile kapatılan yollar atlanır.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { record } = require('../public-connectors.cjs');
const { exchange } = require('../store-connectors.cjs');
const { cachedGet, fetchText, crawl, decode, jsonLd } = require('./http.cjs');

const BASE = 'https://merchone.com';
const cents = v => Math.round(Number(v) * 100);

function parse(url, html) {
  const p = jsonLd(html).find(x => x && x['@type'] === 'Product');
  const o = p && [].concat(p.offers || [])[0];
  if (!o || !(Number(o.price) > 0)) return { skip: 'Fiyat yok' };
  if (o.priceCurrency !== 'EUR') return { skip: 'Beklenmeyen para birimi ' + o.priceCurrency };
  const ship = {};
  for (const s of [].concat(o.shippingDetails || [])) {
    const c = s.shippingDestination?.addressCountry, v = s.shippingRate?.value;
    if (c && Number(v) >= 0 && s.shippingRate?.currency === 'EUR') ship[c] = cents(v);
  }
  const t = [].concat(o.shippingDetails || [])[0]?.deliveryTime;
  return { name: decode(p.name), image: [].concat(p.image || [])[0], minor: cents(o.price), ship, handling: t?.handlingTime && `${t.handlingTime.minValue}–${t.handlingTime.maxValue}` };
}

async function collect(progress = () => {}) {
  const checkedAt = new Date().toISOString();
  const robots = (await fetchText(BASE + '/robots.txt')).text;
  const disallow = [...robots.matchAll(/^Disallow:\s*(\/[^\s?]+\/)\s*$/gm)].map(m => m[1]);
  const cat = (await fetchText(BASE + '/products-catalog/')).text;
  const urls = [...new Set([...cat.matchAll(/href="(https:\/\/merchone\.com\/[a-z0-9-]+\/[a-z0-9-]+\/)"/g)].map(m => m[1]))]
    .filter(u => !disallow.some(d => new URL(u).pathname.startsWith(d)));
  if (urls.length < 30) throw Error('MerchOne katalog bağlantıları beklenenden az: ' + urls.length);
  const fx = await exchange('EUR');
  const results = await crawl(urls, async u => { const r = await cachedGet('merchone', u); return { url: u, cached: r.cached, ...(r.text ? parse(u, r.text) : { skip: 'HTTP ' + r.status }) }; }, { concurrency: 2, delayMs: 800, progress });
  const products = [], skipped = [];
  for (const x of results) {
    if (x.skip || !x.image) { skipped.push({ url: x.url, reason: x.skip || 'Görsel yok' }); continue; }
    const slug = x.url.replace(/\/$/, '').split('/').slice(-2).join('-');
    const p = record('merchone', slug, x.name, x.minor * fx.rate, new URL(x.image, BASE).href, x.url, 'Ölçü ve renkler üreticide seçilir');
    
    p.sourceMinor = x.minor; p.sourceCurrency = 'EUR'; p.exchangeRate = fx.rate; p.exchangeDate = fx.date;
    if (x.ship.DE != null) p.shipping = { DE: Math.round(x.ship.DE * fx.rate) };
    p.availableCountries = ['EU'];
    if (x.handling) p.production = `Üretim: ${x.handling} iş günü`;
    p.priceBasis = 'MerchOne başlangıç fiyatı · baskı dahil · KDV ve kargo koşulları kaynakta';
    p.sourceKind = 'catalog'; p.priceVerified = true; p.priceVerification = 'public-product-jsonld';
    p.importedBy = 'merchone-jsonld-v1'; p.checkedAt = checkedAt; p.checkedOn = checkedAt.slice(0, 10);
    if (!products.some(q => q.id === p.id)) products.push(p);
  }
  fs.writeFileSync(path.resolve(__dirname, '../../data/merchone-coverage.json'), JSON.stringify({ checkedAt, catalogUrls: urls.length, robotsExcluded: disallow, imported: products.length, skipped }, null, 2));
  if (!products.length) throw Error('MerchOne: ürün ayrıştırılamadı');
  return { products, pages: urls.length, reportedTotal: urls.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect, parse };
