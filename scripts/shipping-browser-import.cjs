// Tarayıcıda çekilen kargo sonuçlarını data/shipping/estimate-<üretici>.json biçimine çevirir (shipping-estimate.cjs ile aynı biçim).
//  lumaprints: scripts/shipping-lumaprints*.pw.js -> window.__luma.out kaydı ({ürünId: {US|GB|EU|CA|AU: [[yöntem, kuruş, 'US']]}})
//  neatopod:   NeatoPOD panelinde deneme ürünleri + sipariş ekranı "Calculate Shipping" -> window.__nj.res ({ad: {US|CA|AU: [yöntem, dolar]}})
//              ad -> ürün kimliği eşlemesi katalog başlığının " | " öncesi kısmıyla. Çıkış: Tualatin, Oregon (ABD).
// Kullanım: node scripts/shipping-browser-import.cjs lumaprints <sonuç.json>
//           node scripts/shipping-browser-import.cjs neatopod <sonuç.json>
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '..');
const [, , provider, file] = process.argv;
let raw = JSON.parse(fs.readFileSync(file, 'utf8'));
if (typeof raw === 'string') raw = JSON.parse(raw); // Playwright evaluate çıktısı JSON metni olarak kaydedilir
const today = new Date().toISOString().slice(0, 10);
let products = {};
if (provider === 'lumaprints') {
  products = raw;
} else if (provider === 'neatopod') {
  const cat = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8')).products.filter(p => p.providerId === 'neatopod');
  for (const p of cat) {
    const r = raw[p.title.split(' | ')[0].trim()];
    if (!r) continue;
    const rec = {};
    for (const d of ['US', 'CA', 'AU']) if (r[d]) rec[d] = [[r[d][0], Math.round(r[d][1] * 100), 'US']];
    if (Object.keys(rec).length) products[p.id] = rec;
  }
} else throw Error('üretici: lumaprints | neatopod');
const SRC = {
  lumaprints: 'lumaprints.com/pricing kargo hesaplayıcısı (/wp-json/lumaprints-sc/v1/shipping/get-rates); örnek adresler: New York 10001, Londra SW1A 1AA, Berlin 10115, Toronto M5V 2T6, Sydney 2000; en ucuz yöntem',
  neatopod: 'NeatoPOD paneli (Ali\'nin hesabı) sipariş ekranı Calculate Shipping; deneme ürünleri, en küçük beden; örnek adresler: New York 10118, Toronto M5V 2T6, Sydney 2000; standart baskı sırası, en ucuz yöntem; İngiltere/AB için ücret dönmedi',
};
const out = path.join(root, `data/shipping/estimate-${provider}.json`);
fs.writeFileSync(out, JSON.stringify({ source: SRC[provider], checked: today, currency: 'USD', products }));
console.log(provider, Object.keys(products).length, 'ürün ->', path.relative(root, out));
