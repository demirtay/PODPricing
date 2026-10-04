// FinerWorks: sabit fiyatlı ürün kategorileri (kupa, karo, kayrak taş, ahşap panel, bardak altlığı, kart...).
// Her ürünün "Bulk Prices & Details" penceresinde başlık, görsel, "Starting at $X" ve ürün kodu var.
// Kanvas, kağıt, metal baskı gibi ölçüye göre hesaplanan ürünler sipariş aracında; fiyat tablosu yayınlanmadığı için alınmaz.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { fetchText, decode } = require('./http.cjs');

const BASE = 'https://finerworks.com/products/';
const PAGES = ['ceramic-tile/', 'christmas-ornaments/', 'coasters/', 'cutting-boards/', 'Drinkware/', 'easel-back-canvas/', 'giclee-cards/', 'maple-wood-prints/',
  'mouse-pads/', 'personalized-bags/', 'photo-panels/', 'pillows-blankets/', 'slates/', 'standout-panel-prints/'];
// sınıflandırmaya yardımcı kategori etiketi (başlıklarda ürün türü yazmıyor)
const LEAF = { 'christmas-ornaments/': 'Christmas Ornament', 'easel-back-canvas/': 'Easel Back Canvas Print', 'ceramic-tile/': 'Ceramic Photo Tile', 'slates/': 'Photo Slate' };
const CAT = { 'ceramic-tile/': 'wall-art', 'easel-back-canvas/': 'wall-art', 'maple-wood-prints/': 'wall-art', 'photo-panels/': 'wall-art', 'slates/': 'wall-art', 'standout-panel-prints/': 'wall-art',
  'Drinkware/': 'drinkware', 'giclee-cards/': 'stationery', 'mouse-pads/': 'phone', 'personalized-bags/': 'bags' };
const cents = s => Math.round(Number(String(s).replace(/[^0-9.]/g, '')) * 100);

async function collect(progress = () => {}) {
  const checkedAt = new Date().toISOString();
  const products = [], perPage = {};
  for (const [i, page] of PAGES.entries()) {
    const url = BASE + page, html = (await fetchText(url)).text;
    const items = [...html.matchAll(/myModalLabel_(\d+)">([^<]+)<\/h4>([\s\S]{0,2500}?)Starting at \$([\d.,]+)([\s\S]{0,400}?)Product Code:\s*([A-Z0-9-]+)/g)];
    perPage[page] = items.length;
    for (const m of items) {
      const [, num, rawTitle, before, price, , code] = m;
      const title = decode(rawTitle).replace(/\s+/g, ' ').trim();
      const img = before.match(/<img[^>]+src="([^"]+)"/)?.[1];
      const pack = title.match(/(?:stack|pack|set|box) of (\d+)/i);
      if (products.some(p => p.sourceProductId === code)) continue;
      products.push({
        id: 'finerworks-' + code.toLowerCase(), providerId: 'finerworks', sourceProductId: code, family: 'finerworks-' + page.replace(/\W+/g, '').toLowerCase(), category: CAT[page] || 'home',
        title, leafLabel: LEAF[page], aliases: [], baseMinor: cents(price), currency: 'USD', imageUrl: img ? new URL(img, 'https://finerworks.com').href : null, sourceUrl: url + '#myModalDetails_' + num,
        sizes: (title.match(/\d+(?:\.\d+)?\s*"?\s*x\s*\d+(?:\.\d+)?\s*(?:in|")?|\d+\s*oz\.?/i) || ['Tek ölçü'])[0].trim(), material: null,
        priceBasis: 'FinerWorks ürün fiyatı · tek adet başlangıç fiyatı, baskı dahil' + (pack ? ` · ${pack[1]} adetlik paket fiyatı` : '') + ' · kargo ayrıca',
        minimumQuantity: 1, shipping: null, deliveryDays: null, availableCountries: ['US'],
        checkedOn: checkedAt.slice(0, 10), checkedAt, sourceKind: 'catalog', importedBy: 'finerworks-pages-v1', priceVerified: true, priceVerification: 'public-product-page',
      });
    }
    progress(i + 1, PAGES.length);
  }
  fs.writeFileSync(path.resolve(__dirname, '../../data/finerworks-coverage.json'), JSON.stringify({ checkedAt, perPage, imported: products.length, skipped: 'canvas, paper, metal, acrylic, wood prints, posters, cards, stickers, murals: priced only in the order tool' }, null, 2));
  if (products.length < 40) throw Error('FinerWorks: beklenenden az ürün (' + products.length + ')');
  return { products, pages: PAGES.length, reportedTotal: products.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect };
