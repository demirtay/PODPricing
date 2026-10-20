// PrintKK: ürün sayfasındaki fiyat/kargo hesaplayıcısının servisi (/v1/api/pkk-design/www/product-bulk/shipping-cost)
// -> data/shipping/estimate-printkk.json (shipping-estimate.cjs ile aynı biçim).
// Ürün kodu (product_code) ve en hafif varyant (skuData) ürün sayfasından; istek başlıkları sayfanın herkese açık ön yüz
// istemcisinin her ziyaretçide gönderdiği başlıklar (request.min.js). "cost" = tam kapsama standart ücret
// ("partialCost" yalnız bazı posta kodları içindir, alınmaz). Yanıttaki region varış bölgesidir, çıkış değil:
// çıkış PrintKK varsayılanı Çin (origins.json; 19 Eki Etsy siparişi Yanwen ile Çin'den); "Made in USA" ürünlerde motor ürün adını kullanır.
// Kullanım: node scripts/shipping-printkk.cjs   (karşılaştırmadaki ürünler; data/compare-ids.json)
'use strict';
const fs = require('node:fs'), path = require('node:path');

const root = path.join(__dirname, '..');
const OUT = path.join(root, 'data/shipping/estimate-printkk.json');
const API = 'https://www.printkk.com/v1/api/pkk-design/www/product-bulk/shipping-cost';
const UA = 'Mozilla/5.0 (compatible; POD-Atlas/1.0; fiyat karsilastirma)';
const HEAD = { 'User-Agent': UA, Authorization: 'Basic ' + Buffer.from('printkk_frontend:9W7ZWAO7KDY371h1Nh1quwJsAYCnTOun').toString('base64'), 'Tenant-Id': '000000', 'Pixel-Currency': 'USD' };
const DEST = { US: 'US', GB: 'GB', EU: 'DE', CA: 'CA', AU: 'AU' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url, headers, json = true) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw Error('HTTP ' + r.status);
      return json ? await r.json() : await r.text();
    } catch (e) { if (attempt >= 3) throw e; await sleep(5000 * attempt); }
  }
}

(async () => {
  const ids = new Set(JSON.parse(fs.readFileSync(path.join(root, 'data/compare-ids.json'), 'utf8')));
  const cat = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8')).products.filter(p => p.providerId === 'printkk' && ids.has(p.id));
  const out = { source: 'printkk.com ürün sayfası fiyat hesaplayıcısı (product-bulk/shipping-cost); en hafif varyant', checked: new Date().toISOString().slice(0, 10), currency: 'USD', products: {} };
  let n = 0, fail = 0;
  for (const p of cat) {
    try {
      const html = await get(p.sourceUrl, { 'User-Agent': UA }, false);
      const code = (html.match(/product_code\s*=\s*`([^`]+)`/) || [])[1];
      const skus = JSON.parse((html.match(/skuData\s*=\s*JSON\.parse\(`(\[[\s\S]*?\])`\)/) || [])[1] || '[]');
      const sku = skus.filter(s => s.status === 1).sort((a, b) => a.packageWeight - b.packageWeight)[0] || skus[0];
      if (!code || !sku || !sku.skuId) { n++; continue; }
      const rec = {};
      for (const [k, cc] of Object.entries(DEST)) {
        await sleep(500);
        // id 19 haneli: JSON sayı olarak okununca yuvarlanır, metin olan skuId kullanılır
        const j = await get(`${API}?specificationTemplateId=${sku.skuId}&code=${code}&quantity=1&recipientCountryCode=${cc}&currency=USD`, HEAD);
        const rows = (Array.isArray(j.data) ? j.data : []).filter(r => r.currency === 'USD' && r.cost != null)
          .map(r => [r.shippingType || 'standard', Math.round(parseFloat(r.cost) * 100), 'CN']).filter(r => Number.isFinite(r[1]));
        if (rows.length) rec[k] = rows;
      }
      out.products[p.id] = rec;
    } catch (e) { fail++; console.error(p.id, e.message); }
    n++;
    await sleep(500);
  }
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log('bitti', n, 'hata', fail, 'ABD verili', Object.values(out.products).filter(v => v.US).length);
})();
