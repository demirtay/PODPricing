// MarketPrint (Almanya): /en/catalog sayfasındaki ürün kartları (/en/design?product=ID, görsel, ad, "€X").
// Fiyatlar KDV hariç net; baskının fiyata dahil olup olmadığı açıkça yazmadığı için fiyat türü "belirsiz" kalır.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { fetchText, decode } = require('./http.cjs');
const { exchange } = require('../store-connectors.cjs');

const BASE = 'https://marketprint.de';
function category(s) {
  s = s.toLowerCase();
  if (/kid|baby|children/.test(s)) return 'kids';
  if (/bag|tote|backpack|pouch|gym/.test(s)) return 'bags';
  if (/hat|cap|beanie|sock|scarf|bandana/.test(s)) return 'accessories';
  if (/mug|cup|bottle/.test(s)) return 'drinkware';
  if (/pillow|towel|blanket|apron|poster/.test(s)) return 'home';
  return 'clothing';
}

async function collect() {
  const checkedAt = new Date().toISOString();
  const html = (await fetchText(BASE + '/en/catalog')).text;
  const fx = await exchange('EUR');
  const products = [];
  for (const m of html.matchAll(/<a href="(\/en\/design\?product=([a-f0-9]+))"[^>]*>([\s\S]*?)<\/a>/g)) {
    const [, rel, id, inner] = m;
    const price = inner.match(/text-secondary-bold">€\s*([\d.,]+)</)?.[1];
    const name = decode(inner.match(/<h3[^>]*>([^<]+)<\/h3>/)?.[1] || inner.match(/alt="([^"]+)"/)?.[1] || '').trim();
    if (!price || !name || products.some(p => p.sourceProductId === id)) continue;
    const minor = Math.round(Number(price.replace(/,/g, '')) * 100);
    const img = inner.match(/srcset="([^" ]+)/)?.[1] || inner.match(/src="(https[^"]+)"/)?.[1];
    const cat = category(name);
    products.push({
      id: 'marketprint-' + id, providerId: 'marketprint', sourceProductId: id, family: 'marketprint-' + cat, category: cat,
      title: name, aliases: [], baseMinor: Math.round(minor * fx.rate), currency: 'USD', sourceMinor: minor, sourceCurrency: 'EUR', exchangeRate: fx.rate, exchangeDate: fx.date,
      imageUrl: img || null, sourceUrl: BASE + rel.replace(/&amp;/g, '&'), sizes: 'Ölçü ve renkler üreticide seçilir', material: null,
      priceBasis: 'MarketPrint katalog fiyatı · KDV hariç net · baskının dahil olup olmadığı kaynakta belirtilmiyor · kargo ayrıca',
      shipping: null, deliveryDays: null, availableCountries: ['EU'],
      checkedOn: checkedAt.slice(0, 10), checkedAt, sourceKind: 'catalog', importedBy: 'marketprint-catalog-v1', priceVerified: true, priceVerification: 'public-catalog-page',
    });
  }
  fs.writeFileSync(path.resolve(__dirname, '../../data/marketprint-coverage.json'), JSON.stringify({ checkedAt, imported: products.length }, null, 2));
  if (products.length < 30) throw Error('MarketPrint: beklenenden az ürün (' + products.length + ')');
  return { products, pages: 1, reportedTotal: products.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect };
