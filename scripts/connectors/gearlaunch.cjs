// GearLaunch: ürün sayfalarındaki "Pricing and Requirements" tablosu (Shopify platformu).
// Giriş seviyesi (Blue) fiyatı ve ilk ürün ABD kargo ücreti alınır; sayfadaki en ucuz ölçü kaydedilir.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { record } = require('../public-connectors.cjs');
const { cachedGet, fetchText, crawl, locs, decode } = require('./http.cjs');

const cents = s => Math.round(Number(String(s).replace(/[^0-9.]/g, '')) * 100);

function parse(url, html, checkedAt) {
  const start = html.indexOf('Pricing and Requirements');
  if (start < 0) return { skip: 'Fiyat tablosu yok' };
  // İlk tablo gövdesi (Shopify platformu); ikinci gövde başka platformun fiyatlarıdır.
  const bodyStart = html.indexOf('gl-pricing-and-requirements-body-ctn', start);
  const bodyEnd = html.indexOf('gl-pricing-and-requirements-body-ctn', bodyStart + 10);
  const body = html.slice(bodyStart, bodyEnd > 0 ? bodyEnd : undefined);
  const rows = [];
  for (const item of body.split('gl-pricing-and-requirements-product-item-ctn').slice(1)) {
    const cells = [...item.matchAll(/gl-product-price-text">([^<]*)</g)].map(m => decode(m[1]));
    // [ad, Blue, Bronze, Silver, Gold, Platinum, Diamond, ABD kargo, ABD ek, Dünya kargo, Dünya ek, DPI, G, Y]
    if (cells.length >= 8 && /^\$/.test(cells[1])) rows.push({ name: cells[0], blue: cents(cells[1]), diamond: cents(cells[6]), shipUS: /^\$/.test(cells[7]) ? cents(cells[7]) : null });
  }
  if (!rows.length) return { skip: 'Fiyat satırı yok' };
  rows.sort((a, b) => a.blue - b.blue);
  const best = rows[0];
  const image = (html.match(/<img src="(https:\/\/cdn\.prod\.website-files\.com\/660d0573aac44e36d36a0685\/[^"]+)"/) || [])[1];
  if (!image) return { skip: 'Görsel yok' };
  const slug = url.replace(/\/$/, '').split('/').pop();
  const r = record('gearlaunch', slug, best.name, best.blue, image, url, rows.map(x => x.name).join(' / '));
  r.priceBasis = 'GearLaunch Shopify platformu, giriş seviyesi (Blue) fiyatı · baskı dahil · satış hacmi arttıkça seviye fiyatı düşer'
    + (best.diamond && best.diamond < best.blue ? ` (en üst seviye ${(best.diamond / 100).toFixed(2)} USD)` : '');
  if (best.shipUS) r.shipping = { US: best.shipUS };
  r.availableCountries = ['US'];
  r.sourceKind = 'catalog'; r.priceVerified = true; r.priceVerification = 'public-pricing-table';
  r.importedBy = 'gearlaunch-pricing-v1'; r.checkedAt = checkedAt; r.checkedOn = checkedAt.slice(0, 10);
  return { product: r };
}

async function collect(progress = () => {}) {
  const checkedAt = new Date().toISOString();
  const urls = [...new Set(locs((await fetchText('https://www.gearlaunch.com/sitemap.xml')).text).filter(u => /^https:\/\/www\.gearlaunch\.com\/product\/[^/]+$/.test(u)))];
  if (urls.length < 20) throw Error('GearLaunch site haritası beklenenden kısa: ' + urls.length);
  const results = await crawl(urls, async u => {
    const res = await cachedGet('gearlaunch', u);
    return { ...(res.text ? parse(u, res.text, checkedAt) : { skip: 'HTTP ' + res.status }), url: u, cached: res.cached };
  }, { concurrency: 2, delayMs: 800, progress });
  const products = [], skipped = [];
  for (const x of results) { if (x.product && !products.some(p => p.id === x.product.id)) products.push(x.product); else skipped.push({ url: x.url, reason: x.skip || 'Tekrar kayıt' }); }
  fs.writeFileSync(path.resolve(__dirname, '../../data/gearlaunch-coverage.json'), JSON.stringify({ checkedAt, sitemapProductUrls: urls.length, imported: products.length, skipped }, null, 2));
  if (!products.length) throw Error('GearLaunch: ürün ayrıştırılamadı');
  return { products, pages: urls.length, reportedTotal: urls.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect, parse };
