// OwnPrint: kişiye özel kolye, bileklik ve anahtarlık kataloğu (/print-on-demand-jewelry).
// Kartlarda "From € X" başlangıç fiyatı (en ucuz kaplama, gravür dahil); kargo ilk ürün €6,95.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { fetchText, decode } = require('./http.cjs');
const { exchange } = require('../store-connectors.cjs');

const BASE = 'https://ownprint.co';
const PAGE = BASE + '/print-on-demand-jewelry';
const SHIP_EUR = 695; // pricing sayfası: ilk ürün kargosu €6,95

async function collect() {
  const checkedAt = new Date().toISOString();
  const html = (await fetchText(PAGE)).text;
  const fx = await exchange('EUR');
  const products = [];
  for (const m of html.matchAll(/<a class="prod" href="([^"]+)" data-type="([^"]*)"[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<h3>([^<]+)<\/h3>[\s\S]*?<span class="pv">€(?:&nbsp;|\s)*([\d.,]+)<\/span>/g)) {
    const [, rel, kind, img, rawTitle, price] = m;
    const slug = rel.split('/').filter(Boolean).pop();
    if (products.some(p => p.sourceProductId === slug)) continue;
    const minor = Math.round(Number(price.replace(/\./g, '').replace(',', '.')) * 100);
    const title = decode(rawTitle).trim();
    products.push({
      id: 'ownprint-' + slug, providerId: 'ownprint', sourceProductId: slug, family: 'ownprint-' + kind.toLowerCase(), category: 'accessories',
      title: /keychain|bracelet|necklace/i.test(title) ? title : `${title} ${kind.replace(/s$/, '')}`, aliases: [kind], baseMinor: Math.round(minor * fx.rate), currency: 'USD',
      sourceMinor: minor, sourceCurrency: 'EUR', exchangeRate: fx.rate, exchangeDate: fx.date,
      imageUrl: new URL(img, BASE).href, sourceUrl: new URL(rel, BASE).href, sizes: 'Tek ölçü; kaplama seçenekleri üreticide', material: 'Stainless steel; 18k gold or rose gold plating',
      priceBasis: 'OwnPrint katalog başlangıç fiyatı · gravür/baskı dahil, en uygun kaplama · kargo ayrıca',
      shipping: { EU: Math.round(SHIP_EUR * fx.rate) }, deliveryDays: null, availableCountries: ['EU'],
      checkedOn: checkedAt.slice(0, 10), checkedAt, sourceKind: 'catalog', importedBy: 'ownprint-catalog-v1', priceVerified: true, priceVerification: 'public-catalog-page',
    });
  }
  fs.writeFileSync(path.resolve(__dirname, '../../data/ownprint-coverage.json'), JSON.stringify({ checkedAt, imported: products.length }, null, 2));
  if (products.length < 15) throw Error('OwnPrint: beklenenden az ürün (' + products.length + ')');
  return { products, pages: 1, reportedTotal: products.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect };
