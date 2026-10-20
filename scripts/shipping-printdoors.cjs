// Printdoors: ürün sayfasındaki kargo hesaplayıcısı (/req/frontend/logisticsCal) ile en ucuz varyantın varışa göre
// en ucuz kargo ücreti (sayfada gösterilen tutar) -> data/shipping/estimate-printdoors.json (estimate.json ile aynı biçim)
// Çıkış: ürünün produce_country alanı. EU = Almanya.
// Kullanım: node scripts/shipping-printdoors.cjs   (karşılaştırmadaki ürünler; data/compare-ids.json)
'use strict';
const fs = require('node:fs'), path = require('node:path');

const root = path.join(__dirname, '..');
const OUT = path.join(root, 'data/shipping/estimate-printdoors.json');
const BASE = 'https://www.printdoors.com/req/frontend';
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; POD-Atlas/1.0; fiyat karsilastirma)', Accept: 'application/json' };
const DEST = { US: 'US', GB: 'GB', EU: 'DE', CA: 'CA', AU: 'AU' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
  const ids = JSON.parse(fs.readFileSync(path.join(root, 'data/compare-ids.json'), 'utf8')).filter(id => id.startsWith('printdoors-'));
  const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { products: {}, checkedOn: {} };
  const today = new Date().toISOString().slice(0, 10);
  out.printdoors = { source: 'printdoors.com ürün sayfası kargo hesaplayıcısı (/req/frontend/logisticsCal)', checked: today };
  let n = 0, fail = 0;
  for (const id of ids) {
    if (out.checkedOn[id] === today) continue;
    const pid = id.slice(11);
    try {
      const d = (await get(`${BASE}/basicProduct/${pid}?id=${pid}&product_id=0`)).data;
      const color = (d.colors || [])[0]?.id, size = [...(d.sizes || [])].sort((a, b) => a.sort - b.sort)[0]?.id;
      const origin = d.produce_country || null;
      if (color == null || size == null || !origin) { out.checkedOn[id] = today; continue; }
      const rec = {};
      for (const [k, c] of Object.entries(DEST)) {
        await sleep(600);
        const r = (await get(`${BASE}/logisticsCal/${pid}?post_code=&country=${c}&num=1&color_id=${color}&size_id=${size}`)).data;
        const amt = parseFloat(r?.amount);
        if (r?.logistics?.length && Number.isFinite(amt)) rec[k] = [['', Math.round(amt * 100), origin]]; // sayfanın gösterdiği en ucuz tutar; yöntem adı yanıtta tutara bağlanmıyor
      }
      out.products[id] = rec; out.checkedOn[id] = today;
    } catch (e) { fail++; console.error(id, e.message); }
    if (++n % 10 === 0) { fs.writeFileSync(OUT, JSON.stringify(out)); console.log(n, '/', ids.length); }
  }
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log('bitti', n, 'hata', fail);
})();
