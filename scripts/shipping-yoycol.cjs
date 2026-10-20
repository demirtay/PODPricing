// Yoycol: ürün sayfasındaki kargo tablosu servisi (/api/logistic/cate/log_calculator?skuCode=) -> data/shipping/estimate-yoycol.json
// Varyant: ürünün en hafif SKU'su (/api/product/attribute/sku/skuAttributeValue?spuCode=). firstPrice = ilk ürün kargo ücreti.
// Bölgeler: US, "GB/DE/FR" (İngiltere ve AB), Canada, Australia. "Remote areas" yöntemi alınmaz.
// Çıkış: adı "US " ile başlayan yöntem (ABD'de basılan ürünler) ABD, diğerleri Çin (Yoycol fulfillment merkezi; origins.json).
// Kullanım: node scripts/shipping-yoycol.cjs   (karşılaştırmadaki ürünler; data/compare-ids.json)
'use strict';
const fs = require('node:fs'), path = require('node:path');

const root = path.join(__dirname, '..');
const OUT = path.join(root, 'data/shipping/estimate-yoycol.json');
const API = 'https://www.yoycol.com/api';
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; POD-Atlas/1.0; fiyat karsilastirma)', Accept: 'application/json' };
const REGION = { US: ['US'], 'GB/DE/FR': ['GB', 'EU'], Canada: ['CA'], Australia: ['AU'] };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw Error('HTTP ' + r.status);
      const j = await r.json();
      if (j.code !== '100000') throw Error('kod ' + j.code);
      return j.data;
    } catch (e) { if (attempt >= 3) throw e; await sleep(5000 * attempt); }
  }
}

(async () => {
  const ids = new Set(JSON.parse(fs.readFileSync(path.join(root, 'data/compare-ids.json'), 'utf8')));
  const cat = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8')).products.filter(p => p.providerId === 'yoycol' && ids.has(p.id));
  const out = { source: 'yoycol.com ürün sayfası kargo tablosu (/api/logistic/cate/log_calculator); en hafif varyant', checked: new Date().toISOString().slice(0, 10), currency: 'USD', products: {} };
  let n = 0, fail = 0;
  for (const p of cat) {
    try {
      const skus = await get(`${API}/product/attribute/sku/skuAttributeValue?spuCode=${p.sourceProductId}`);
      const sku = [...skus].sort((a, b) => a.weight - b.weight)[0];
      await sleep(500);
      const regions = await get(`${API}/logistic/cate/log_calculator?skuCode=${encodeURIComponent(sku.skuCode)}`);
      const rec = {};
      for (const r of regions) for (const dest of REGION[r.ename] || []) {
        const rows = (r.lgFeeNewDTO || []).filter(x => Number.isFinite(x.firstPrice) && x.firstPrice > 0 && !/remote/i.test(x.lgLevelName))
          .map(x => [x.lgLevelName, Math.round(x.firstPrice * 100), /^US\s/i.test(x.lgLevelName) ? 'US' : 'CN']);
        if (rows.length) rec[dest] = rows;
      }
      out.products[p.id] = rec;
    } catch (e) { fail++; console.error(p.id, e.message); }
    n++;
    await sleep(500);
  }
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log('bitti', n, 'hata', fail, 'ABD verili', Object.values(out.products).filter(v => v.US).length);
})();
