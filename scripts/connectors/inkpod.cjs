// InkPOD (ayakkabı/giyim POD): site haritasındaki /products/<slug> sayfaları. Next.js verisindeki
// variants[].cost (sent) sayfada görünen güncel üretim fiyatıdır; displayCost üstü çizili eski fiyat,
// recommendRetailPrice perakende önerisidir (kullanılmaz).
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { cachedGet, fetchText, crawl, locs, decode, meta } = require('./http.cjs');

function parse(html) {
  const t = html.replace(/\\"/g, '"');
  const block = t.match(/"variants":\[(\{"id":\d+,"cost":[\s\S]*?)\]\s*[,}]/)?.[1] || '';
  const costs = [...block.matchAll(/"cost":(\d+)/g)].map(m => Number(m[1])).filter(n => n > 0);
  const title = decode(meta(html, 'og:title') || html.match(/<h1[^>]*>([^<]+)/)?.[1] || '').replace(/\s*\|\s*InkPOD\s*$/i, '').trim();
  // og:image yok; varyant görseli (test-cn-... OSS adresleri de gerçek ürün görselidir)
  const image = meta(html, 'og:image') || block.match(/"image":"(https:[^"]+)"/)?.[1];
  const sizes = t.match(/"sizes":\[([^\]]*)\]/)?.[1]?.match(/"([^"]+)"/g)?.map(s => s.slice(1, -1)) || [];
  return { title, image, minor: costs.length ? Math.min(...costs) : null, sizes };
}

async function collect(progress = () => {}) {
  const checkedAt = new Date().toISOString();
  const urls = [...new Set(locs((await fetchText('https://www.inkpodfulfillment.com/sitemap.xml')).text).filter(u => /^https:\/\/www\.inkpodfulfillment\.com\/products\/[^/]+$/.test(u)))];
  if (urls.length < 50) throw Error('InkPOD: site haritasında beklenenden az ürün (' + urls.length + ')');
  const { record } = require('../public-connectors.cjs');
  const results = await crawl(urls, async u => {
    const res = await cachedGet('inkpod', u);
    return { url: u, ...(res.text ? parse(res.text) : { err: 'HTTP ' + res.status }) };
  }, { concurrency: 2, delayMs: 700, progress });
  const products = [], skipped = [];
  for (const r of results) {
    if (!r.minor || !r.title || !r.image) { skipped.push({ url: r.url, reason: r.err || (!r.minor ? 'Fiyat (cost) yok' : 'Başlık veya görsel yok') }); continue; }
    const slug = r.url.split('/').pop();
    const p = record('inkpod', slug, r.title, r.minor, r.image, r.url, r.sizes.length ? r.sizes[0] + ' – ' + r.sizes.at(-1) : null);
    p.priceBasis = 'InkPOD güncel üretim fiyatı (cost) · en düşük varyant, tek adet · kargo ayrıca';
    p.priceVerified = true; p.priceVerification = 'public-product-page-data';
    p.importedBy = 'inkpod-next-v1'; p.checkedAt = checkedAt; p.checkedOn = checkedAt.slice(0, 10);
    if (!products.some(q => q.id === p.id)) products.push(p);
  }
  fs.writeFileSync(path.resolve(__dirname, '../../data/inkpod-coverage.json'), JSON.stringify({ checkedAt, sitemapProductUrls: urls.length, imported: products.length, skipped }, null, 2));
  if (!products.length) throw Error('InkPOD: ürün ayrıştırılamadı');
  return { products, pages: urls.length, reportedTotal: urls.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect, parse };
