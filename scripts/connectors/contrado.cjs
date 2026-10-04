// Contrado: site haritasındaki /products/ sayfalarının "price-current" fiyatı (baskı dahil, tek adet),
// varsa indirim öncesi fiyat, üretim süresi ve ABD kargo başlangıcı.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { record } = require('../public-connectors.cjs');
const { cachedGet, fetchText, crawl, locs, decode, meta } = require('./http.cjs');

const cents = s => Math.round(Number(String(s).replace(/[^0-9.]/g, '')) * 100);

function parse(url, html) {
  const cur = html.match(/class='price-current'>\s*\$([\d,]+\.\d{2})/);
  if (!cur) return { skip: 'Fiyat yok' };
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const title = decode((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1]?.replace(/<[^>]+>/g, ' ')) || meta(html, 'og:title');
  const image = meta(html, 'og:image');
  const was = text.match(/Was \$([\d,]+\.\d{2})/), ships = text.match(/Ships in ([\d\s–-]+) days?/i), usShip = text.match(/USA Shipping from \$([\d.]+)/i);
  return { title, image, minor: cents(cur[1]), was: was ? cents(was[1]) : null, ships: ships?.[1].trim(), usShip: usShip ? cents(usShip[1]) : null };
}

async function collect(progress = () => {}) {
  const checkedAt = new Date().toISOString();
  const urls = [...new Set(locs((await fetchText('https://www.contrado.com/sitemap.xml')).text).filter(u => /^https:\/\/www\.contrado\.com\/products\/[^/]+$/.test(u)))];
  if (urls.length < 30) throw Error('Contrado ürün sayısı beklenenden az: ' + urls.length);
  const results = await crawl(urls, async u => { const r = await cachedGet('contrado', u); return { url: u, cached: r.cached, ...(r.text ? parse(u, r.text) : { skip: 'HTTP ' + r.status }) }; }, { concurrency: 2, delayMs: 900, progress });
  const products = [], skipped = [];
  for (const x of results) {
    if (x.skip || !x.title || !x.image) { skipped.push({ url: x.url, reason: x.skip || 'Başlık/görsel yok' }); continue; }
    const p = record('contrado', x.url.split('/').pop(), x.title.replace(/^Design Your Own /i, '').replace(/\s*\|.*$/, ''), x.minor, x.image, x.url, 'Ölçü ve seçenekler üreticide');
    if (x.was && x.was > x.minor) p.originalMinor = x.was;
    if (x.usShip) p.shipping = { US: x.usShip };
    if (x.ships) p.production = `Üretim: ${x.ships} iş günü`;
    p.availableCountries = ['UK', 'US'];
    p.priceBasis = 'Contrado başlangıç fiyatı · tek adet, baskı dahil · kargo ayrıca';
    p.sourceKind = 'catalog'; p.priceVerified = true; p.priceVerification = 'public-product-page';
    p.importedBy = 'contrado-pages-v1'; p.checkedAt = checkedAt; p.checkedOn = checkedAt.slice(0, 10);
    if (!products.some(q => q.id === p.id)) products.push(p);
  }
  fs.writeFileSync(path.resolve(__dirname, '../../data/contrado-coverage.json'), JSON.stringify({ checkedAt, sitemapProductUrls: urls.length, imported: products.length, skipped }, null, 2));
  if (!products.length) throw Error('Contrado: ürün ayrıştırılamadı');
  return { products, pages: urls.length, reportedTotal: urls.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect, parse };
