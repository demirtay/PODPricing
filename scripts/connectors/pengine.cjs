// Pengine (ABD POD): site haritasındaki /products/<slug> sayfaları; fiyat __NUXT_DATA__ içindeki
// ürünün variants[].basePrice.price alanı (stokta olan en düşük varyant). finance.suggestedPrice
// perakende öneri fiyatıdır, kullanılmaz.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { cachedGet, fetchText, crawl, locs, decode } = require('./http.cjs');

const WRAPPERS = new Set(['Reactive', 'ShallowReactive', 'Ref', 'ShallowRef', 'EmptyRef', 'NuxtError', 'Set', 'Map', 'Date']);
// Nuxt 3 "devalue" yükünü (dizi + indeks referansları) nesneye çevirir
function nuxtData(html) {
  const m = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  const a = JSON.parse(m[1]), memo = new Map();
  const r = i => {
    if (typeof i !== 'number') return i;
    if (memo.has(i)) return memo.get(i);
    const v = a[i];
    if (Array.isArray(v)) {
      if (typeof v[0] === 'string' && WRAPPERS.has(v[0])) { const o = v[0] === 'Date' ? v[1] : r(v[1]); memo.set(i, o); return o; }
      const out = []; memo.set(i, out); for (const x of v) out.push(r(x)); return out;
    }
    if (v && typeof v === 'object') { const out = {}; memo.set(i, out); for (const k in v) out[k] = r(v[k]); return out; }
    memo.set(i, v); return v;
  };
  return r(0);
}
function findProduct(o, d = 0) {
  if (!o || typeof o !== 'object' || d > 10) return null;
  if (Array.isArray(o.variants) && o.slug && o.name && 'basePrice' in o) return o;
  for (const k in o) { const f = findProduct(o[k], d + 1); if (f) return f; }
  return null;
}

async function collect(progress = () => {}) {
  const checkedAt = new Date().toISOString();
  const urls = [...new Set(locs((await fetchText('https://www.pengine.io/sitemap.xml')).text).filter(u => /^https:\/\/www\.pengine\.io\/products\/[^/]+$/.test(u)))];
  if (urls.length < 50) throw Error('Pengine: site haritasında beklenenden az ürün (' + urls.length + ')');
  const { record } = require('../public-connectors.cjs');
  const results = await crawl(urls, async u => {
    const res = await cachedGet('pengine', u);
    if (!res.text) return { url: u, skip: 'HTTP ' + res.status };
    let p; try { p = findProduct(nuxtData(res.text)); } catch { p = null; }
    if (!p) return { url: u, skip: 'Ürün verisi yok' };
    if (p.isDiscontinued) return { url: u, skip: 'Üretimden kalkmış' };
    const prices = p.variants.filter(v => !v.isOutOfStock && !v.isDiscontinued && v.basePrice?.price > 0).map(v => v.basePrice.price);
    if (!prices.length) return { url: u, skip: 'Stokta fiyatlı varyant yok' };
    const img = p.thumbnails?.[0]?.image?.url || p.thumbnail?.url || p.thumbnail;
    return { url: u, p, minor: Math.round(Math.min(...prices) * 100), img };
  }, { concurrency: 2, delayMs: 700, progress });
  const products = [], skipped = [];
  for (const r of results) {
    if (!r.p || typeof r.img !== 'string') { skipped.push({ url: r.url, reason: r.skip || 'Görsel yok' }); continue; }
    const p = record('pengine', r.p.slug, decode(r.p.name), r.minor, r.img, r.url, [...new Set(r.p.variants.map(v => v.size).filter(Boolean))].join(' / '));
    p.aliases = [...new Set([...p.aliases, r.p.brand, r.p.style].filter(Boolean))];
    p.priceBasis = 'Pengine taban fiyatı (basePrice) · stokta olan en düşük varyant, tek adet · kargo ayrıca';
    p.priceVerified = true; p.priceVerification = 'public-product-page-data';
    p.importedBy = 'pengine-nuxt-v1'; p.checkedAt = checkedAt; p.checkedOn = checkedAt.slice(0, 10);
    if (!products.some(q => q.id === p.id)) products.push(p);
  }
  fs.writeFileSync(path.resolve(__dirname, '../../data/pengine-coverage.json'), JSON.stringify({ checkedAt, sitemapProductUrls: urls.length, imported: products.length, skipped }, null, 2));
  if (!products.length) throw Error('Pengine: ürün ayrıştırılamadı');
  return { products, pages: urls.length, reportedTotal: urls.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect, nuxtData };
