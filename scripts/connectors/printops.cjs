// PrintOps: /pricing sayfasındaki ölçü bazlı baskı tabloları (standart, A, kare, çerçeveli).
// Adet kademeli kargo tabloları ürün sayılmaz; ilk kademe ABD kargo ücreti ölçü grubuna göre eklenir.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { fetchText, decode } = require('./http.cjs');

const PAGE = 'https://printops.com/pricing';
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
const cents = s => Math.round(Number(String(s).replace(/[^0-9.]/g, '')) * 100);

// ilk kademe kargo: "8.5x11 and Smaller" 1-15 adet, "9x12 to 18x27" 1-25, "20x30 and Larger" 1-6
function shipFor(size, ship) {
  const d = size.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i);
  if (!d) return null;
  const [a, b] = [Number(d[1]), Number(d[2])].sort((x, y) => x - y);
  if (a <= 8.5 && b <= 11) return ship.small;
  if (b <= 27) return ship.mid;
  return ship.large;
}

async function collect() {
  const checkedAt = new Date().toISOString();
  const html = (await fetchText(PAGE)).text;
  const tables = html.split(/<table/).slice(1).map(t => [...t.split('</table>')[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(c => decode(c[1].replace(/<[^>]+>/g, ' '))));
  const shipTbl = tables.find(c => c.includes('Qty') && c.some(x => /and Smaller/.test(x))) || [];
  const tier = label => { const i = shipTbl.findIndex(x => x.startsWith(label)); return i >= 0 ? cents(shipTbl[i + 2]) : null; };
  const ship = { small: tier('8.5x11 and Smaller'), mid: tier('9x12 to 18x27'), large: tier('20x30 and Larger') };
  const products = [];
  for (const cells of tables.filter(c => !c.includes('Qty'))) {
    for (let i = 0; i + 1 < cells.length; i++) {
      if (!/Print$/i.test(cells[i]) || !/^\$\d/.test(cells[i + 1])) continue;
      const name = cells[i].replace(/\s+/g, ' ').trim();
      if (products.some(p => p.title === name)) continue;
      const s = shipFor(name, ship);
      products.push({
        id: 'printops-' + slug(name), providerId: 'printops', sourceProductId: slug(name), family: 'printops-wall-art', category: 'wall-art',
        title: name, aliases: ['art print', 'poster'], baseMinor: cents(cells[i + 1]), currency: 'USD', imageUrl: null, sourceUrl: PAGE,
        sizes: name.replace(/\s*(Black |White |Natural )?(Framed )?(Square )?Print$/i, '').trim(), material: 'Acid-free commercial paper',
        priceBasis: 'PrintOps fiyat çizelgesi · tek baskı, baskı dahil' + (s != null ? '' : ' · kargo ayrıca'),
        shipping: s != null ? { US: s } : null, deliveryDays: null, availableCountries: ['US'],
        checkedOn: checkedAt.slice(0, 10), checkedAt, sourceKind: 'catalog', importedBy: 'printops-pricing-v1', priceVerified: true, priceVerification: 'public-pricing-table',
      });
    }
  }
  fs.writeFileSync(path.resolve(__dirname, '../../data/printops-coverage.json'), JSON.stringify({ checkedAt, shippingTiers: ship, imported: products.length }, null, 2));
  if (products.length < 20) throw Error('PrintOps: beklenenden az ürün (' + products.length + ')');
  return { products, pages: 1, reportedTotal: products.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect };
