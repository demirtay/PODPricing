// NeatoPOD: /products-pricing.html ürün kartları. Sayfa: "Prices include one side (either front or back) printing".
// Kart: görsel, ad, "N colors • $X+", boş ürün modeli/markası. Ürünlerin ayrı sayfası yok; bağlantı fiyat sayfasıdır.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { record } = require('../public-connectors.cjs');
const { fetchText, decode } = require('./http.cjs');

const PAGE = 'https://www.neatopod.com/products-pricing.html';
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

async function collect() {
  const checkedAt = new Date().toISOString();
  const html = (await fetchText(PAGE)).text;
  if (!/Prices include one side/i.test(html)) throw Error('NeatoPOD fiyat açıklaması değişti; baskı dahil varsayımı doğrulanamadı');
  const products = [], skipped = [];
  let section = '';
  for (const chunk of html.split(/(?=<h2 id=|<div class="shirtcolumn">)/)) {
    const h2 = chunk.match(/^<h2 id="[^"]*">([\s\S]*?)<\/h2>/);
    if (h2) { section = decode(h2[1]); continue; }
    if (!chunk.startsWith('<div class="shirtcolumn">')) continue;
    const body = chunk.slice(0, chunk.indexOf('</div>') + 6);
    const price = body.match(/(\d+)\s*colou?rs?\s*•\s*\$([\d.]+)\+/);
    const name = decode((body.match(/<strong>([\s\S]*?)<\/strong>/) || [])[1]);
    const img = (body.match(/<img src="([^"]+)"/) || [])[1];
    if (!price || !name || !img) { if (/\$/.test(body)) skipped.push({ name, reason: 'Kart ayrıştırılamadı' }); continue; }
    const tail = decode(body.slice(body.indexOf(price[0]) + price[0].length).replace(/<br\s*\/?>/g, ' / ').replace(/<[^>]+>/g, ' ')).replace(/^\s*\/\s*|\s*\/\s*$/g, '').replace(/\s*\/\s*\/\s*/g, ' / ');
    const blank = tail.replace(/\s*\/\s*$/, '').trim();
    const title = blank ? `${name} | ${blank.split(' / ')[0]}` : name;
    const id = slug(name + ' ' + blank);
    if (products.some(p => p.id === 'neatopod-' + id)) continue;
    const p = record('neatopod', id, title, Math.round(Number(price[2]) * 100), new URL(img, PAGE).href, `${PAGE}#${slug(section || name)}`, `${price[1]} renk`);
    if (blank) p.aliases = [...new Set([...p.aliases, ...blank.split(' / ')])];
    p.priceBasis = 'NeatoPOD başlangıç fiyatı · tek yüz baskı dahil (sayfada belirtildiği gibi) · kargo ayrıca';
    p.availableCountries = ['US'];
    p.sourceKind = 'catalog'; p.priceVerified = true; p.priceVerification = 'public-pricing-page';
    p.importedBy = 'neatopod-pricing-v1'; p.checkedAt = checkedAt; p.checkedOn = checkedAt.slice(0, 10);
    products.push(p);
  }
  fs.writeFileSync(path.resolve(__dirname, '../../data/neatopod-coverage.json'), JSON.stringify({ checkedAt, imported: products.length, skipped }, null, 2));
  if (products.length < 50) throw Error('NeatoPOD: beklenenden az ürün (' + products.length + ')');
  return { products, pages: 1, reportedTotal: products.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect };
