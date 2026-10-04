// Site haritasındaki örnek ürün sayfalarında fiyat verisinin biçimini yoklar.
// Kullanım: node scripts/probe-product-pages.cjs id1 id2 ...
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const probe = JSON.parse(fs.readFileSync(path.join(root, 'data/provider-probe.json'), 'utf8')).results;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const get = async u => { try { const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) }); return r.ok ? await r.text() : ''; } catch { return ''; } };
const locs = x => [...x.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1]);

async function productUrls(base) {
  let xml = await get(base + '/sitemap.xml');
  let urls = locs(xml);
  if (/<sitemapindex/.test(xml)) {
    const subs = urls.filter(u => /product/i.test(u)).slice(0, 2);
    urls = [];
    for (const s of subs) urls.push(...locs(await get(s)));
  }
  return urls.filter(u => /\/(products?|catalog|item|shop)\/[^/]+/i.test(u) && !/category|collections?\/?$/i.test(u));
}

(async () => {
  for (const id of process.argv.slice(2)) {
    const p = probe.find(r => r.id === id);
    const base = p?.final;
    if (!base) { console.log(id, 'adres yok'); continue; }
    const urls = await productUrls(base);
    const sample = [urls[0], urls[Math.floor(urls.length / 2)]].filter(Boolean);
    const out = { id, productUrls: urls.length, samples: [] };
    for (const u of sample) {
      const h = await get(u);
      const ld = [...h.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join(' ');
      out.samples.push({
        url: u,
        ldProduct: /"@type"\s*:\s*"Product"/.test(ld),
        ldPrice: (ld.match(/"(price|lowPrice)"\s*:\s*"?[\d.]+/g) || []).slice(0, 2),
        ldCurrency: (ld.match(/"priceCurrency"\s*:\s*"[A-Z]+"/) || [''])[0],
        ogPrice: (h.match(/product:price:amount"\s+content="[^"]+"/) || [''])[0],
        visible: (h.match(/(from|starting at|starts at|base price|price)[^<$£€]{0,25}[$£€]\s?\d+[.,]\d{2}/gi) || []).slice(0, 2),
        anyMoney: (h.match(/[$£€]\s?\d{1,3}[.,]\d{2}/g) || []).slice(0, 4),
        nextData: /__NEXT_DATA__|self\.__next_f/.test(h),
      });
    }
    console.log(JSON.stringify(out));
  }
})();
