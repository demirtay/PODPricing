// Prodigi: site haritasındaki İngilizce ürün sayfaları. Sayfadaki "From" fiyatının
// Prodigi'nin kendi USD karşılığı (para birimi seçicisindeki değer) alınır.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { record } = require('../public-connectors.cjs');
const { cachedGet, fetchText, crawl, locs, decode, meta } = require('./http.cjs');

const LOCALES = /\/(de|fr|es|it|nl|pt|pl|sv|da|ja)\//;

function specs(html) {
  const out = {};
  for (const m of html.matchAll(/<dt>\s*([^<]{1,40}?)\s*<\/dt>\s*<dd>([\s\S]{0,400}?)<\/dd>/g)) {
    const k = decode(m[1]), v = decode(m[2].replace(/<[^>]+>/g, ' '));
    if (k && v && !(k in out)) out[k] = v;
  }
  return out;
}

function parse(url, html, checkedAt) {
  const usd = html.match(/data-currencynewunit="usd"\s+data-currencynewvalue="\$([\d,]+\.\d{2})"/);
  if (!usd) return { skip: />\s*Discontinued\s*</.test(html) ? 'Üretimden kalkmış ürün' : 'Sayfada fiyat yok (kategori/bilgi sayfası)' };
  const title = decode((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1]?.replace(/<[^>]+>/g, ' ')) || meta(html, 'og:title');
  const image = meta(html, 'og:image');
  if (!title || !image) return { skip: 'Başlık veya görsel yok' };
  const s = specs(html);
  const slug = url.replace(/\/$/, '').split('/').pop();
  const r = record('prodigi', slug, title, Math.round(Number(usd[1].replace(/,/g, '')) * 100), image, url, s['Available sizes'] || s['Sizes'] || s['Size'] || 'Ölçüler üreticide', s['Materials'] || s['Material'] || s['Weight'] || null);
  const gbp = html.match(/data-currencynewunit="gbp"\s+data-currencynewvalue="£([\d,]+\.\d{2})"/);
  r.priceBasis = 'Prodigi "From" başlangıç fiyatı (Prodigi\'nin USD karşılığı)' + (gbp ? ` · kaynak ${gbp[1]} GBP` : '') + ' · kargo ve vergi hariç · Prodigi Pro üyelikte indirimli';
  if (gbp) { r.sourceMinor = Math.round(Number(gbp[1].replace(/,/g, '')) * 100); r.sourceCurrency = 'GBP'; r.exchangeRate = r.baseMinor / r.sourceMinor; /* Prodigi'nin kendi kuru; fiyat politikası tam eşleşme bekler */ r.exchangeDate = checkedAt.slice(0, 10); }
  if (s['Brand']) r.aliases = [...new Set([...r.aliases, s['Brand']])];
  if (s['Printing method']) r.decorationMethods = [s['Printing method']];
  if (s['Production time']) r.production = 'Üretim: ' + s['Production time'].replace(/hours?/i, 'saat');
  if (s['Fulfilled from']) r.availableCountries = s['Fulfilled from'].split(/,\s*/);
  r.sourceKind = 'catalog'; r.priceVerified = true; r.priceVerification = 'public-product-page';
  r.importedBy = 'prodigi-pages-v1'; r.checkedAt = checkedAt; r.checkedOn = checkedAt.slice(0, 10);
  return { product: r };
}

async function collect(progress = () => {}) {
  const checkedAt = new Date().toISOString();
  const xml = (await fetchText('https://www.prodigi.com/sitemap.xml')).text;
  const urls = [...new Set(locs(xml).filter(u => /^https:\/\/www\.prodigi\.com\/products\/.+\/.+/.test(u) && !LOCALES.test(u)))];
  if (urls.length < 100) throw Error('Prodigi site haritası beklenenden kısa: ' + urls.length);
  const results = await crawl(urls, async u => {
    const res = await cachedGet('prodigi', u);
    return { ...(res.text ? parse(u, res.text, checkedAt) : { skip: 'HTTP ' + res.status }), url: u, cached: res.cached };
  }, { concurrency: 2, delayMs: 700, progress });
  const products = [], skipped = [], seen = new Set();
  for (const x of results) {
    if (x.product && !seen.has(x.product.id)) { seen.add(x.product.id); products.push(x.product); }
    else skipped.push({ url: x.url, reason: x.skip || 'Tekrar kayıt' });
  }
  fs.writeFileSync(path.resolve(__dirname, '../../data/prodigi-coverage.json'), JSON.stringify({ checkedAt, sitemapProductUrls: urls.length, imported: products.length, skipped }, null, 2));
  if (products.length < 100) throw Error('Prodigi: çok az ürün ayrıştırıldı (' + products.length + ')');
  return { products, pages: urls.length, reportedTotal: urls.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect, parse };
