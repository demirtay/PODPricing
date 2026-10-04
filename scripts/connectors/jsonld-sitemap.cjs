// Ortak bağlayıcı: site haritasındaki ürün sayfalarının JSON-LD Product/Offer verisinden fiyat alır.
// Her üretici için yalnızca yapılandırma gerekir (aşağıdaki SITES).
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { record } = require('../public-connectors.cjs');
const { exchange } = require('../store-connectors.cjs');
const { cachedGet, fetchText, crawl, locs, decode, meta, jsonLd } = require('./http.cjs');

const SITES = {
  simpleprint: {
    sitemap: 'https://www.simpleprint.com/sitemap.xml',
    match: u => /^https:\/\/www\.simpleprint\.com\/products\/[^/]+$/.test(u),
    basis: 'SimplePrint "printed for as low as" fiyatı · tek baskı dahil, kargo ve vergi hariç',
  },
};

const money = v => { const n = Number(String(v ?? '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null; };

function productFrom(html) {
  const p = jsonLd(html).find(x => x && (x['@type'] === 'Product' || (Array.isArray(x['@type']) && x['@type'].includes('Product'))));
  if (!p) return null;
  const offers = [].concat(p.offers || []);
  let minor = null, currency = null;
  for (const o of offers) {
    const v = money(o.lowPrice ?? o.price ?? o.priceSpecification?.price);
    if (v && (minor === null || v < minor)) { minor = v; currency = o.priceCurrency || o.priceSpecification?.priceCurrency; }
  }
  return { name: decode(p.name), image: [].concat(p.image || [])[0]?.url || [].concat(p.image || [])[0], brand: typeof p.brand === 'string' ? p.brand : p.brand?.name, minor, currency, sku: p.sku || p.mpn };
}

async function collect(id, progress = () => {}) {
  const cfg = SITES[id];
  const checkedAt = new Date().toISOString();
  let xml = (await fetchText(cfg.sitemap)).text, urls = locs(xml);
  if (/<sitemapindex/.test(xml)) { const subs = urls.filter(cfg.subSitemap || (() => true)); urls = []; for (const s of subs) urls.push(...locs((await fetchText(s)).text)); }
  urls = [...new Set(urls.filter(cfg.match))];
  if (!urls.length) throw Error(id + ': site haritasında ürün yok');
  const fxCache = {};
  const results = await crawl(urls, async u => {
    const res = await cachedGet(id, u);
    if (!res.text) return { url: u, skip: 'HTTP ' + res.status, cached: res.cached };
    const x = productFrom(res.text);
    if (!x) return { url: u, skip: 'JSON-LD ürün verisi yok', cached: res.cached };
    if (!x.minor) return { url: u, skip: 'Fiyat yok', cached: res.cached };
    const image = x.image || meta(res.text, 'og:image');
    if (!x.name || !image) return { url: u, skip: 'Başlık veya görsel yok', cached: res.cached };
    return { url: u, x: { ...x, image }, cached: res.cached };
  }, { concurrency: cfg.concurrency || 2, delayMs: cfg.delayMs || 800, progress });

  const products = [], skipped = [];
  for (const r of results) {
    if (!r.x) { skipped.push({ url: r.url, reason: r.skip }); continue; }
    const cur = (r.x.currency || cfg.currency || 'USD').toUpperCase();
    const fx = fxCache[cur] || (fxCache[cur] = await exchange(cur));
    const slug = r.url.replace(/\/$/, '').split('/').pop().slice(0, 120);
    const p = record(id, slug, r.x.name, r.x.minor * fx.rate, new URL(r.x.image, r.url).href, r.url, cfg.sizes || 'Ölçü ve renkler üreticide seçilir');
    if (cur !== 'USD') { p.sourceMinor = r.x.minor; p.sourceCurrency = cur; p.exchangeRate = fx.rate; p.exchangeDate = fx.date; }
    if (r.x.brand) p.aliases = [...new Set([...p.aliases, r.x.brand])];
    p.priceBasis = cfg.basis;
    p.sourceKind = 'catalog'; p.priceVerified = true; p.priceVerification = 'public-product-jsonld';
    p.importedBy = id + '-jsonld-v1'; p.checkedAt = checkedAt; p.checkedOn = checkedAt.slice(0, 10);
    if (!products.some(q => q.id === p.id)) products.push(p);
  }
  fs.writeFileSync(path.resolve(__dirname, `../../data/${id}-coverage.json`), JSON.stringify({ checkedAt, sitemapProductUrls: urls.length, imported: products.length, skipped }, null, 2));
  if (!products.length) throw Error(id + ': ürün ayrıştırılamadı');
  return { products, pages: urls.length, reportedTotal: urls.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { SITES, collect, productFrom };
