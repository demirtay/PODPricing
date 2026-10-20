// Inkedjoy: ürün sayfasının kargo tablosu servisi (/prod-api/api/product/getshippingTemplateList?countrycode=&productid=)
// -> data/shipping/estimate-inkedjoy.json (shipping-estimate.cjs ile aynı biçim). ship_cost_basic = ilk ürün kargo ücreti.
// Çıkış ülkesi yöntemin taşıyıcısından: YANWEN, CNE, YUN, Wanb, 4PX, SF, Cainiao -> Çin; adı USPS/UPS/FedEx ile başlayan -> ABD
// ("US Express Shipping (USPS)" yalnız son teslimatı anlatır, çıkışı değil -> alınmaz); Auspost -> Avustralya;
// tanınmayan taşıyıcı alınmaz. Ürün adında açık çıkış işareti (Made in USA ...) varsa landed-cost onu kullanır.
// "For Partial ZIP" (yalnız bazı posta kodlarına giden) yöntemler alınmaz.
// Kullanım: node scripts/shipping-inkedjoy.cjs   (karşılaştırmadaki ürünler; data/compare-ids.json)
'use strict';
const fs = require('node:fs'), path = require('node:path');

const root = path.join(__dirname, '..');
const OUT = path.join(root, 'data/shipping/estimate-inkedjoy.json');
const API = 'https://inkedjoy.com/prod-api/api/product/getshippingTemplateList';
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; POD-Atlas/1.0; fiyat karsilastirma)', Accept: 'application/json' };
const DEST = { US: 'US', GB: 'GB', EU: 'DE', CA: 'CA', AU: 'AU' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const originOf = m => /yanwen|\bcne\b|\byun|wanb|4px|\bsf\b|cainiao|china/i.test(m) ? 'CN' : /^(usps|ups|fedex)\b/i.test(m.trim()) ? 'US' : /auspost|australia post/i.test(m) ? 'AU' : null;

async function get(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) { if (attempt >= 3) throw e; await sleep(5000 * attempt); }
  }
}

(async () => {
  const ids = JSON.parse(fs.readFileSync(path.join(root, 'data/compare-ids.json'), 'utf8')).filter(id => id.startsWith('inkedjoy-'));
  const out = { source: 'inkedjoy.com ürün sayfası kargo tablosu (/prod-api/api/product/getshippingTemplateList)', checked: new Date().toISOString().slice(0, 10), currency: 'USD', products: {} };
  const methods = new Set();
  let n = 0, fail = 0;
  for (const id of ids) {
    const pid = id.slice(9);
    try {
      const rec = {};
      for (const [k, cc] of Object.entries(DEST)) {
        const rows = (await get(`${API}?countrycode=${cc}&productid=${pid}`)).rows || [];
        const ok = rows.filter(r => !/partial zip/i.test(r.ship_method) && r.ratenameEN === 'USD' && Number.isFinite(r.ship_cost_basic))
          .map(r => { methods.add(r.ship_method); return [r.ship_method, Math.round(r.ship_cost_basic * 100), originOf(r.ship_method)]; })
          .filter(r => r[2]);
        if (ok.length) rec[k] = ok;
        await sleep(500);
      }
      out.products[id] = rec;
    } catch (e) { fail++; console.error(id, e.message); }
    if (++n % 20 === 0) console.log(n, '/', ids.length);
  }
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log('bitti', n, 'hata', fail, 'yöntemler:', [...methods].join(' | '));
})();
