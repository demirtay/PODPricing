// Derin yoklama: ana sayfadaki katalog/ürün/fiyat bağlantılarını izler, fiyat verisinin
// biçimini (JSON-LD, Shopify, Woo, Next/Nuxt verisi, görünen tutar) raporlar. Salt okunur.
// Kullanım: node scripts/probe-deep.cjs id1 id2 ...  → data/provider-probe-deep.json (birleştirir)
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const c = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8'));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const outFile = path.join(root, 'data/provider-probe-deep.json');
const prev = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : {};

async function get(url, accept = 'text/html') {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    return { status: r.status, url: r.url, text: r.ok ? (await r.text()).slice(0, 2_500_000) : '' };
  } catch (e) { return { status: 0, text: '', error: e.cause?.code || e.name }; }
}
const money = h => (h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').match(/(?:[$£€]|USD|EUR|GBP)\s?\d{1,4}(?:[.,]\d{2})|\d{1,4}[.,]\d{2}\s?(?:€|EUR)/g) || []);
function analyze(h) {
  const ld = (h.match(/"@type"\s*:\s*"(Product|ProductGroup|Offer|AggregateOffer)"/g) || []).length;
  const next = /self\.__next_f|__NEXT_DATA__/.test(h), nuxt = /__NUXT__|_payload\.json/.test(h);
  const priceKeys = [...new Set((h.match(/\\?"(price|minPrice|min_price|basePrice|base_price|lowestPrice|startingPrice|starting_price|cost|retail_price|salePrice|regular_price)\\?"\s*:\s*\\?"?\d/g) || []).map(s => s.replace(/[\\"\s:]|\d/g, '')))];
  const m = money(h);
  return { ld, next, nuxt, priceKeys, money: m.length, sample: [...new Set(m)].slice(0, 5) };
}

async function probe(p) {
  const home = await get(new URL(p.homepage).origin + '/');
  const base = home.url ? new URL(home.url).origin : new URL(p.homepage).origin;
  const out = { id: p.id, base, home: home.status || home.error, homeA: home.text ? analyze(home.text) : null, pages: [] };
  if (/cdn\.shopify\.com/.test(home.text)) { const j = await get(base + '/products.json?limit=250', 'application/json'); try { out.shopify = JSON.parse(j.text).products.length; } catch { out.shopify = 'no:' + j.status; } }
  if (/wp-content/.test(home.text)) { const w = await get(base + '/wp-json/wc/store/v1/products?per_page=5', 'application/json'); out.woo = w.status + (w.text.startsWith('[') ? ':' + JSON.parse(w.text).length : ''); }
  // aday sayfalar
  const links = [...new Set([...home.text.matchAll(/href=["']([^"'#?]+)["']/g)].map(m => { try { return new URL(m[1], base).href; } catch { return null; } })
    .filter(u => u && u.startsWith(base) && /(catalog|products?|shop|pricing|price|collections|all-|store)/i.test(u) && !/\.(css|js|png|jpe?g|svg|webp|ico|pdf)$/i.test(u)))];
  const pick = links.sort((a, b) => (/(catalog|pricing|all)/i.test(b) - /(catalog|pricing|all)/i.test(a)) || a.length - b.length).slice(0, 4);
  for (const u of pick) {
    const r = await get(u);
    out.pages.push({ url: u, status: r.status, ...(r.text ? analyze(r.text) : {}) });
    // sayfadaki ilk ürün bağlantısını da dene
    const prod = [...r.text.matchAll(/href=["']([^"'#?]+)["']/g)].map(m => { try { return new URL(m[1], base).href; } catch { return null; } })
      .find(x => x && x.startsWith(base) && /\/(product|products|item|p)\/[^/]+\/?$/i.test(x) && x !== u);
    if (prod && out.pages.length < 6) { const pr = await get(prod); out.pages.push({ url: prod, product: true, status: pr.status, ...(pr.text ? analyze(pr.text) : {}) }); }
  }
  return out;
}

(async () => {
  const ids = process.argv.slice(2);
  const targets = c.providers.filter(p => ids.includes(p.id));
  const res = { ...prev };
  for (let i = 0; i < targets.length; i += 3) {
    for (const r of await Promise.all(targets.slice(i, i + 3).map(probe))) {
      res[r.id] = r;
      const best = [r.homeA, ...r.pages].filter(Boolean).reduce((a, x) => Math.max(a, (x.ld || 0) * 10 + (x.priceKeys?.length || 0) * 5 + Math.min(x.money || 0, 50)), 0);
      console.log(`${r.id.padEnd(16)} skor ${String(best).padStart(4)} shop:${r.shopify ?? '-'} woo:${r.woo ?? '-'} | ${r.pages.map(x => `${x.product ? 'ÜRÜN ' : ''}${x.url.replace(r.base, '')} [${x.status}] ld${x.ld ?? 0} $${x.money ?? 0} ${(x.priceKeys || []).join('/')}${x.next ? ' next' : ''}${x.nuxt ? ' nuxt' : ''}`).join(' ; ').slice(0, 330)}`);
    }
    fs.writeFileSync(outFile, JSON.stringify(res, null, 1));
  }
})();
