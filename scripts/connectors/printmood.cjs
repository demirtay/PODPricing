// Printmood (ABD POD + lazer kazıma): site haritasındaki /products/<kategori>/<alt>/<ürün> sayfaları.
// Sayfada <del> liste fiyatı ve ardından güncel fiyat (h3) görünür; JSON-LD yalnızca liste fiyatını
// taşıdığı için görünen güncel fiyat kullanılır, liste fiyatı originalMinor olarak saklanır.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { cachedGet, fetchText, crawl, locs, decode, meta } = require('./http.cjs');

const usd = s => Math.round(Number(String(s).replace(/[^0-9.]/g, '')) * 100);
function parse(html) {
  const title = decode(html.match(/<h1 class="text-slate-900[^"]*">([^<]+)<\/h1>/)?.[1] || '').trim();
  // masaüstü fiyat bloğu: [<h4><del>$liste</del> ...</h4>] <h3> $güncel</h3>
  const block = html.match(/<div class="hidden md:block">([\s\S]*?)<\/div>/)?.[1] || '';
  const current = block.match(/<h3[^>]*>\s*\$([\d.,]+)\s*<\/h3>/)?.[1];
  const list = block.match(/<del[^>]*>\$([\d.,]+)<\/del>/)?.[1];
  return { title, image: meta(html, 'og:image'), minor: current ? usd(current) : null, original: list ? usd(list) : null };
}

async function collect(progress = () => {}) {
  const checkedAt = new Date().toISOString();
  const urls = [...new Set(locs((await fetchText('https://www.printmood.com/sitemap.xml')).text).filter(u => /^https:\/\/www\.printmood\.com\/products\/[^/]+\/[^/]+\/[^/]+$/.test(u)))];
  if (urls.length < 40) throw Error('Printmood: site haritasında beklenenden az ürün (' + urls.length + ')');
  const { record } = require('../public-connectors.cjs');
  const results = await crawl(urls, async u => {
    const res = await cachedGet('printmood', u);
    return { url: u, ...(res.text ? parse(res.text) : { err: 'HTTP ' + res.status }) };
  }, { concurrency: 2, delayMs: 700, progress });
  const products = [], skipped = [];
  for (const r of results) {
    if (!r.minor || !r.title || !r.image) { skipped.push({ url: r.url, reason: r.err || (!r.minor ? 'Fiyat yok' : 'Başlık veya görsel yok') }); continue; }
    const p = record('printmood', r.url.split('/').pop(), r.title, r.minor, r.image, r.url);
    if (r.original > r.minor) p.originalMinor = r.original;
    p.priceBasis = 'Printmood sayfada görünen güncel fiyat (liste fiyatından indirimli olabilir), tek adet · kargo ayrıca';
    p.priceVerified = true; p.priceVerification = 'public-product-page';
    p.importedBy = 'printmood-page-v1'; p.checkedAt = checkedAt; p.checkedOn = checkedAt.slice(0, 10);
    if (!products.some(q => q.id === p.id)) products.push(p);
  }
  fs.writeFileSync(path.resolve(__dirname, '../../data/printmood-coverage.json'), JSON.stringify({ checkedAt, sitemapProductUrls: urls.length, imported: products.length, skipped }, null, 2));
  if (!products.length) throw Error('Printmood: ürün ayrıştırılamadı');
  return { products, pages: urls.length, reportedTotal: urls.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect, parse };
