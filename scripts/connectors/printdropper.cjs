// PrintDropper (ABD, duvar sanatı/çerçeve): /products listesindeki her ürün sayfasında ölçü başına
// fiyat tablosu var (Product Price + kargo sütunları). Kayıt fiyatı tablodaki en düşük ürün fiyatıdır.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { cachedGet, fetchText, crawl, decode } = require('./http.cjs');

const BASE = 'https://printdropper.com';
const usd = s => Math.round(Number(String(s).replace(/[^0-9.]/g, '')) * 100);

function parse(html) {
  const title = decode(html.match(/<h1[^>]*>([^<]+)/)?.[1] || '').replace(/\s+/g, ' ').trim();
  const image = html.match(/<img src="(https:\/\/printdropper\.com\/print-fulfillment\/product-files\/[^"]+)"/)?.[1];
  const head = html.match(/<tr class="heading">([\s\S]*?)<\/tr>/)?.[1] || '';
  const cols = [...head.matchAll(/<td>([^<]*)<\/td>/g)].map(m => m[1].trim());
  if (cols[0] !== 'Product Name' || cols[1] !== 'Product Price') return { title, image, rows: [] };
  const ship = cols.indexOf('Domestic Shipping');
  const rows = [...html.matchAll(/<tr class="rowitem(?:even|odd)">([\s\S]*?)<\/tr>/g)].map(m => {
    const td = [...m[1].matchAll(/<td>([^<]*)<\/td>/g)].map(x => decode(x[1]).trim());
    return { size: td[0], minor: usd(td[1]), ship: ship > 0 ? usd(td[ship]) : null };
  }).filter(r => r.size && r.minor > 0);
  return { title, image, rows };
}

async function collect(progress = () => {}) {
  const checkedAt = new Date().toISOString();
  const list = (await fetchText(BASE + '/products')).text;
  const urls = [...new Set([...list.matchAll(/href="(https:\/\/printdropper\.com\/products\/print-on-demand-[a-z0-9-]+)"/g)].map(m => m[1]))];
  if (urls.length < 50) throw Error('PrintDropper: ürün listesi eksik (' + urls.length + ')');
  const { record } = require('../public-connectors.cjs');
  const results = await crawl(urls, async u => {
    const res = await cachedGet('printdropper', u);
    return { url: u, ...(res.text ? parse(res.text) : { rows: [], err: 'HTTP ' + res.status }) };
  }, { concurrency: 2, delayMs: 600, progress });
  const products = [], skipped = [];
  for (const r of results) {
    if (!r.title || !r.image || !r.rows.length) { skipped.push({ url: r.url, reason: r.err || (!r.rows.length ? 'Fiyat tablosu yok' : 'Başlık veya görsel yok') }); continue; }
    const low = r.rows.reduce((a, b) => b.minor < a.minor ? b : a);
    const slug = r.url.split('/').pop().replace(/^print-on-demand-/, '');
    const p = record('printdropper', slug, r.title, low.minor, r.image, r.url, r.rows.map(x => x.size).slice(0, 12).join(' / ') + (r.rows.length > 12 ? ' …' : ''));
    p.priceBasis = `PrintDropper tablo fiyatı · en küçük seçenek (${low.size}), tek adet${low.ship ? ` · ABD kargo $${(low.ship / 100).toFixed(2)} ayrıca` : ' · kargo ayrıca'}`;
    p.priceVerified = true; p.priceVerification = 'public-product-price-table';
    p.importedBy = 'printdropper-table-v1'; p.checkedAt = checkedAt; p.checkedOn = checkedAt.slice(0, 10);
    products.push(p);
  }
  fs.writeFileSync(path.resolve(__dirname, '../../data/printdropper-coverage.json'), JSON.stringify({ checkedAt, productUrls: urls.length, imported: products.length, skipped }, null, 2));
  if (!products.length) throw Error('PrintDropper: ürün ayrıştırılamadı');
  return { products, pages: urls.length, reportedTotal: urls.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect, parse };
