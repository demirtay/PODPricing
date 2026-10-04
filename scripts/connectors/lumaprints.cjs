// LumaPrints: /pricing sayfasındaki herkese açık fiyat tabloları (kanvas, çerçeveli kanvas, fine art kağıt,
// çerçeveli kağıt (paspartusuz), köpük destekli kağıt, metal, yapışkanlı baskı). Her hücre = bir ölçü/malzeme ürünü.
// Kargo ayrıca hesaplanır; acil üretim ücretleri tablosu ürün sayılmaz.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { fetchText, decode } = require('./http.cjs');

const PAGE = 'https://lumaprints.com/pricing/';
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90);
const cents = s => Math.round(Number(String(s).replace(/[^0-9.]/g, '')) * 100);
const title = s => s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()).replace(/(\d)In\b/g, '$1in');

// tablo sırası sayfadakiyle aynı; başlığa göre tür belirlenir
function kindOf(head, index, frameNote) {
  if (head.includes('PEEL & STICK')) return { name: () => 'Peel and Stick Print', material: 'Self-adhesive fabric' };
  if (head.includes('METAL PRINTS')) return { name: () => 'Metal Print', material: 'Aluminum' };
  if (head.some(h => /STRETCHED CANVAS|ROLLED CANVAS/.test(h))) return { name: c => title(c).replace('Stretched Canvas', 'Stretched Canvas Print').replace('Rolled Canvas', 'Rolled Canvas Print'), material: 'Canvas' };
  if (head.some(h => /FRAMED CANVAS/.test(h))) return { name: c => title(c) + ' Print', material: 'Canvas, floater frame' };
  if (head.includes('No Mat')) return { only: 'No Mat', name: () => `Framed Fine Art Paper Print (${frameNote})`, material: 'Archival fine art paper, wood frame' };
  if (head.includes('ARCHIVAL MATTE')) return { name: c => `${title(c)} Fine Art Paper Print${index > 3 ? ', Foam-Mounted' : ''}`, material: index > 3 ? 'Fine art paper on foam board' : 'Fine art paper' };
  return null;
}

async function collect() {
  const checkedAt = new Date().toISOString();
  const html = (await fetchText(PAGE)).text;
  const parts = html.split(/<table/).slice(1);
  const products = [];
  let frames = 0;
  parts.forEach((t, index) => {
    const rows = [...t.split('</table>')[0].matchAll(/<tr[\s\S]*?<\/tr>/g)].map(r => [...r[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(c => decode(c[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()));
    const head = rows[0] || [];
    // çerçeve tabloları sırayla: ince (0.875in) ve geniş (1.25in) profil
    const frameNote = head.includes('No Mat') ? (frames++ ? 'wide 1.25in frame' : 'slim 0.875in frame') : '';
    const k = kindOf(head, index, frameNote);
    if (!k) return;
    for (const r of rows.slice(1)) {
      const size = (r[0] || '').replace(/[×x]/, 'x').replace(/[″"]/g, '');
      if (!/^\d+(\.\d+)?x\d+(\.\d+)?$/.test(size)) continue;
      head.forEach((col, ci) => {
        if (ci === 0 || (k.only && col !== k.only) || !/^\$\d/.test(r[ci] || '')) return;
        const name = `${k.name(col)} ${size}in`;
        const id = 'lumaprints-' + slug(name);
        if (products.some(p => p.id === id)) return;
        products.push({
          id, providerId: 'lumaprints', sourceProductId: slug(name), family: 'lumaprints-wall-art', category: 'wall-art',
          title: name, aliases: ['wall art', 'print'], baseMinor: cents(r[ci]), currency: 'USD', imageUrl: null, sourceUrl: PAGE,
          sizes: size + ' in', material: k.material,
          priceBasis: 'LumaPrints fiyat tablosu · tek baskı, baskı dahil · kargo ayrıca',
          shipping: null, deliveryDays: null, availableCountries: ['US'],
          checkedOn: checkedAt.slice(0, 10), checkedAt, sourceKind: 'catalog', importedBy: 'lumaprints-pricing-v1', priceVerified: true, priceVerification: 'public-pricing-table',
        });
      });
    }
  });
  fs.writeFileSync(path.resolve(__dirname, '../../data/lumaprints-coverage.json'), JSON.stringify({ checkedAt, tables: parts.length, imported: products.length }, null, 2));
  if (products.length < 100) throw Error('LumaPrints: beklenenden az ürün (' + products.length + ')');
  return { products, pages: 1, reportedTotal: products.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect };
