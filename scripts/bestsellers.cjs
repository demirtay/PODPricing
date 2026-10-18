// Üreticilerin kendi "çok satanlar" listeleri -> data/bestsellers.json (ana sayfada üretici üretici vitrin).
// Otomatik: Printify (katalog servisi, popülerliğe göre), Yoycol (Best Sellers sayfası).
// Elle: data/bestsellers-manual.json (Printful, Merchize — liste JavaScript ile yükleniyor, tarayıcıdan okunur).
// Bir üretici okunamazsa önceki listesi korunur. Kullanım: node scripts/bestsellers.cjs
'use strict';
const fs = require('node:fs'), path = require('node:path');

const root = path.resolve(__dirname, '..');
const outFile = path.join(root, 'data/bestsellers.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36';
const today = new Date().toISOString().slice(0, 10);

async function get(url) {
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/json' }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return r.text();
}

const AUTO = {
  // sourceProductId = blueprint kimliği
  async printify() {
    const url = 'https://printify.com/product-catalog-service/api/v1/blueprints/search?limit=40&offset=0&tags[]=Bestsellers&target_market=USA&show_other_target_markets=true&show_other_sales_channels=true&sort[popularity]=desc';
    const j = JSON.parse(await get(url));
    const keys = (j.data || []).map(b => String(b.blueprintId)).filter(Boolean);
    return { source: 'https://printify.com/app/products/bestsellers', match: 'sourceProductId', keys };
  },
  // sourceProductId = /product_detail/<kod>/ içindeki kod
  async yoycol() {
    const html = await get('https://www.yoycol.com/spu_list/Best-Sellers/-2');
    const keys = [...new Set([...html.matchAll(/\/product_detail\/([A-Z0-9]+)\//g)].map(m => m[1]))];
    return { source: 'https://www.yoycol.com/spu_list/Best-Sellers/-2', match: 'sourceProductId', keys };
  },
};

(async () => {
  const prev = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : {};
  const manual = JSON.parse(fs.readFileSync(path.join(root, 'data/bestsellers-manual.json'), 'utf8'));
  const out = {};
  for (const [id, fn] of Object.entries(AUTO)) {
    try {
      const r = await fn();
      if (r.keys.length < 5) throw new Error(`yalnızca ${r.keys.length} ürün`);
      out[id] = { checkedOn: today, ...r };
      console.log(`${id}: ${r.keys.length} çok satan`);
    } catch (e) {
      if (prev[id]) out[id] = prev[id];
      console.warn(`${id}: okunamadı (${e.message})${prev[id] ? ', önceki liste korundu' : ''}`);
    }
  }
  for (const [id, v] of Object.entries(manual)) if (!id.startsWith('_')) out[id] = v;
  fs.writeFileSync(outFile, JSON.stringify(out, null, 1) + '\n');
})();
