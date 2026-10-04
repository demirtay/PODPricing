// Shirtee (AB): /print-on-demand-products/<kategori> sayfalarındaki ürün kartları; KDV hariç € fiyatı.
// Baskının fiyata dahil olup olmadığı açıkça yazmadığı için "koşullar üreticide" olarak işaretlenir.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { record } = require('../public-connectors.cjs');
const { exchange } = require('../store-connectors.cjs');
const { fetchText, decode } = require('./http.cjs');

const BASE = 'https://shirtee.cloud';
const CATS = ['men', 'women', 'kids', 'home', 'accessories', 'organic'];

async function collect(progress = () => {}) {
  const checkedAt = new Date().toISOString();
  const fx = await exchange('EUR');
  const seen = new Map(), skipped = [];
  for (const [i, cat] of CATS.entries()) {
    const html = (await fetchText(`${BASE}/print-on-demand-products/${cat}`)).text.replace(/<div class=.changeimgColor[^>]*><\/div>/g, '');
    for (const card of html.split("<div class='product-text-four-box'>").slice(1)) {
      const url = (card.match(/href='(https:\/\/shirtee\.cloud\/pod-product\/[^']+)'/) || [])[1];
      const name = decode((card.match(/class='product-name'>([\s\S]*?)<\/div>/) || [])[1]);
      const price = card.match(/class='price-box'>\s*([\d.,]+)\s*€/);
      const img = (card.match(/<noscript><img src='([^']+)'/) || card.match(/<img src="(https:[^"]+)"/) || [])[1];
      const sizes = decode((card.match(/class='product-size'>([\s\S]*?)<\/span>/) || [])[1]);
      if (!url || !name || !price) { if (name) skipped.push({ name, reason: 'Fiyat/bağlantı yok' }); continue; }
      if (seen.has(url)) continue;
      const minor = Math.round(Number(price[1].replace(',', '.')) * 100);
      const p = record('shirtee', url.split('/pod-product/')[1].replace(/\//g, '-'), name, minor * fx.rate, img ? decode(img).replace(/&#038;/g, '&') : null, url, sizes || 'Ölçüler üreticide');
      p.sourceMinor = minor; p.sourceCurrency = 'EUR'; p.exchangeRate = fx.rate; p.exchangeDate = fx.date;
      const code = name.split('|')[1]?.trim();
      if (code) p.aliases = [...new Set([...p.aliases, code])];
      p.availableCountries = ['EU'];
      p.priceBasis = 'Shirtee başlangıç fiyatı · KDV hariç · baskı ve kargo koşulları kaynakta';
      p.sourceKind = 'catalog'; p.priceVerified = true; p.priceVerification = 'public-catalog-page';
      p.importedBy = 'shirtee-cards-v1'; p.checkedAt = checkedAt; p.checkedOn = checkedAt.slice(0, 10);
      seen.set(url, p);
    }
    progress(i + 1, CATS.length);
    await new Promise(r => setTimeout(r, 1000));
  }
  const products = [...seen.values()];
  fs.writeFileSync(path.resolve(__dirname, '../../data/shirtee-coverage.json'), JSON.stringify({ checkedAt, categories: CATS, imported: products.length, skipped }, null, 2));
  if (products.length < 50) throw Error('Shirtee: beklenenden az ürün (' + products.length + ')');
  return { products, pages: CATS.length, reportedTotal: products.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect };
