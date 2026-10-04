// Sellfy POD kataloğu: /pod-catalogue/<kategori>/ sayfalarındaki ürün kartları ("Starting from $X").
// Fiyat, tasarım basılmış tek ürün için başlangıç fiyatıdır; kargo ayrıca.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { fetchText, decode } = require('./http.cjs');

const BASE = 'https://sellfy.com/pod-catalogue/';
const CATS = ['accessories', 'bags', 'hats', 'home', 'kids-clothing', 'mens-clothing', 'womens-clothing'];
const CAT = { accessories: 'accessories', bags: 'bags', hats: 'accessories', home: 'home', 'kids-clothing': 'kids', 'mens-clothing': 'clothing', 'womens-clothing': 'clothing' };
const cents = s => Math.round(Number(String(s).replace(/[^0-9.]/g, '')) * 100);

async function collect(progress = () => {}) {
  const checkedAt = new Date().toISOString();
  const products = [], perCat = {};
  for (const [i, cat] of CATS.entries()) {
    const html = (await fetchText(BASE + cat + '/')).text;
    const cards = [...html.matchAll(/<a href="(\/pod-catalogue\/[^"]+\/([^"/]+)\/)"[^>]*>([\s\S]*?)<\/a>/g)];
    perCat[cat] = 0;
    for (const [, rel, slug, inner] of cards) {
      const price = inner.match(/Starting from \$([\d.,]+)/)?.[1];
      if (!price || products.some(p => p.sourceProductId === slug)) continue;
      const title = decode(inner.match(/<h\d[^>]*>([^<]+)<\/h\d>/)?.[1] || inner.match(/alt="([^"]+)"/)?.[1] || '').replace(/\s+/g, ' ').trim();
      if (!title) continue;
      perCat[cat]++;
      products.push({
        id: 'sellfy-' + slug, providerId: 'sellfy', sourceProductId: slug, family: 'sellfy-' + cat, category: CAT[cat],
        title, aliases: [], baseMinor: cents(price), currency: 'USD', imageUrl: inner.match(/<img src="([^"]+)"/)?.[1] || null, sourceUrl: 'https://sellfy.com' + rel,
        sizes: decode(inner.match(/Sizes:\s*([^<]+)/)?.[1] || '').trim(), material: null,
        priceBasis: 'Sellfy POD kataloğu · "Starting from" başlangıç fiyatı, baskı dahil · kargo ayrıca',
        shipping: null, deliveryDays: null, availableCountries: [],
        checkedOn: checkedAt.slice(0, 10), checkedAt, sourceKind: 'catalog', importedBy: 'sellfy-catalogue-v1', priceVerified: true, priceVerification: 'public-catalog-page',
      });
    }
    progress(i + 1, CATS.length);
  }
  fs.writeFileSync(path.resolve(__dirname, '../../data/sellfy-coverage.json'), JSON.stringify({ checkedAt, perCat, imported: products.length }, null, 2));
  if (products.length < 50) throw Error('Sellfy: beklenenden az ürün (' + products.length + ')');
  return { products, pages: CATS.length, reportedTotal: products.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect };
