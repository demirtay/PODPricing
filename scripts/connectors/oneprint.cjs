// OnePrint (Toulouse / Texas): /products sayfasındaki ürün kartları ("From $X").
// Kaynak baskının fiyata dahil olup olmadığını belirtmiyor; fiyat türü "belirsiz" kalır.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { fetchText, decode } = require('./http.cjs');

const BASE = 'https://oneprint.io';

async function collect() {
  const checkedAt = new Date().toISOString();
  const html = (await fetchText(BASE + '/products')).text;
  const products = [];
  for (const m of html.matchAll(/<a[^>]+href="(\/products\/([^"/]+))"[^>]*>([\s\S]*?)<\/a>/g)) {
    const [, rel, slug, inner] = m;
    const text = decode(inner.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    const price = text.match(/From \$([\d.,]+)/)?.[1];
    if (!price || products.some(p => p.sourceProductId === slug)) continue;
    const title = decode(inner.match(/<h\d[^>]*>([^<]+)<\/h\d>/)?.[1] || inner.match(/alt="([^"]+)"/)?.[1] || '').trim() || text.replace(/From \$.*/, '').replace(/^(Apparels|Home & Decor|Accessories)\s*/, '').trim();
    // "Gildan G5000" -> "Gildan 5000": diğer üreticilerle aynı model anahtarı
    const name = title.replace(/\b(Gildan) G(\d{4,5})\b/i, '$1 $2');
    const img = inner.match(/<img[^>]+src="([^"]+)"/)?.[1];
    products.push({
      id: 'oneprint-' + slug.toLowerCase(), providerId: 'oneprint', sourceProductId: slug, family: /mug/i.test(title) ? 'oneprint-drinkware' : 'oneprint-apparel', category: /mug/i.test(title) ? 'drinkware' : 'clothing',
      title: name, aliases: [], baseMinor: Math.round(Number(price.replace(/,/g, '')) * 100), currency: 'USD', imageUrl: img ? new URL(img, BASE).href : null, sourceUrl: BASE + rel,
      sizes: text.match(/(\d+) sizes?/)?.[0] || 'Tek ölçü', material: null, decorationMethods: (text.match(/\b(DTG|DTF|Sublimation)\b/g) || []),
      priceBasis: 'OnePrint katalog "From" başlangıç fiyatı · baskının dahil olup olmadığı kaynakta belirtilmiyor · kargo ayrıca',
      shipping: null, deliveryDays: null, availableCountries: ['US', 'EU'],
      checkedOn: checkedAt.slice(0, 10), checkedAt, sourceKind: 'catalog', importedBy: 'oneprint-catalog-v1', priceVerified: true, priceVerification: 'public-catalog-page',
    });
  }
  fs.writeFileSync(path.resolve(__dirname, '../../data/oneprint-coverage.json'), JSON.stringify({ checkedAt, imported: products.length }, null, 2));
  if (products.length < 3) throw Error('OnePrint: beklenenden az ürün (' + products.length + ')');
  return { products, pages: 1, reportedTotal: products.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect };
