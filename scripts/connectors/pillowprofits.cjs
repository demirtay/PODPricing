// PillowProfits: /product-specs-and-pricing/ tabloları (Ürün, Ölçü, Regular, USA Tariff Price, Express, USA Tariff Express).
// Ürün başına en düşük Regular fiyat; ayrı ürün sayfası ve görsel yok (bağlantı fiyat sayfasıdır).
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { fetchText, decode } = require('./http.cjs');

const PAGE = 'https://pillowprofits.com/product-specs-and-pricing/';
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
const cents = s => Math.round(Number(String(s).replace(/[^0-9.]/g, '')) * 100);
const isPrice = s => /^\$\d/.test(s);

async function collect() {
  const checkedAt = new Date().toISOString();
  const html = (await fetchText(PAGE)).text;
  const byName = new Map();
  for (const tb of html.split(/<table/).slice(1)) {
    let current = null;
    for (const r of tb.split('</table>')[0].matchAll(/<tr[\s\S]*?<\/tr>/g)) {
      const c = [...r[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(x => decode(x[1].replace(/<[^>]+>/g, ' ')));
      let name, size, prices;
      if (c.length >= 6 && !isPrice(c[0]) && isPrice(c[2])) { name = c[0]; size = c[1]; prices = c.slice(2, 6); current = name; }
      else if (c.length >= 5 && isPrice(c[1]) && current) { name = current; size = c[0]; prices = c.slice(1, 5); }
      else continue;
      const e = byName.get(name) || { name, sizes: [] };
      if (!e.sizes.some(s => s.size === size)) e.sizes.push({ size, regular: cents(prices[0]), tariff: cents(prices[1]), express: cents(prices[2]) });
      byName.set(name, e);
    }
  }
  const products = [];
  for (const e of byName.values()) {
    const best = e.sizes.filter(s => s.regular > 0).sort((a, b) => a.regular - b.regular)[0];
    if (!best) continue;
    products.push({
      id: 'pillowprofits-' + slug(e.name), providerId: 'pillowprofits', sourceProductId: slug(e.name), family: 'pillowprofits-other', category: 'other',
      title: e.name, aliases: [], baseMinor: best.regular, currency: 'USD', imageUrl: null, sourceUrl: PAGE,
      sizes: e.sizes.map(s => s.size).join(' / '), material: null,
      priceBasis: `PillowProfits Regular başlangıç fiyatı (${best.size}) · baskı dahil · ABD'ye gümrük vergili fiyat ${(best.tariff / 100).toFixed(2)} USD · ekspres ${(best.express / 100).toFixed(2)} USD · kargo ayrıca`,
      shipping: null, deliveryDays: null, checkedOn: checkedAt.slice(0, 10), checkedAt, sourceKind: 'catalog',
      importedBy: 'pillowprofits-pricing-v1', priceVerified: true, priceVerification: 'public-pricing-table',
    });
  }
  fs.writeFileSync(path.resolve(__dirname, '../../data/pillowprofits-coverage.json'), JSON.stringify({ checkedAt, imported: products.length, products: products.map(p => p.title) }, null, 2));
  if (products.length < 10) throw Error('PillowProfits: beklenenden az ürün (' + products.length + ')');
  return { products, pages: 1, reportedTotal: products.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect };
