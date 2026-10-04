// Bağlı olmayan üreticilerin açık veri kaynaklarını yoklar (salt okunur, az istek).
// Kullanım: node scripts/probe-providers.cjs [id ...]  → data/provider-probe.json
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const c = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8'));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const ids = process.argv.slice(2);
const targets = c.providers.filter(p => ids.length ? ids.includes(p.id) : p.connection?.state === 'pending');

async function get(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/json;q=0.9,*/*;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    const text = r.ok ? (await r.text()).slice(0, 3_000_000) : '';
    return { status: r.status, url: r.url, text };
  } catch (e) { return { status: 0, error: e.cause?.code || e.name, text: '' }; }
}

async function probe(p) {
  const origin = new URL(p.homepage).origin;
  const home = await get(origin + '/');
  const out = { id: p.id, name: p.name, home: home.status || home.error, final: home.url ? new URL(home.url).origin : null };
  const base = out.final || origin;
  const h = home.text;
  out.platform = /cdn\.shopify\.com|Shopify\.theme/.test(h) ? 'shopify' : /wp-content|woocommerce/i.test(h) ? 'wordpress' : /__NEXT_DATA__|self\.__next_f/.test(h) ? 'nextjs' : /__NUXT__|_nuxt\//.test(h) ? 'nuxt' : /cf-challenge|challenge-platform/.test(h) ? 'cloudflare-challenge' : '';
  if (out.platform === 'shopify') {
    const j = await get(base + '/products.json?limit=250');
    try { out.shopifyProducts = JSON.parse(j.text).products.length; } catch { out.shopifyProducts = j.status; }
  }
  if (out.platform === 'wordpress') {
    const w = await get(base + '/wp-json/wc/store/v1/products?per_page=1');
    out.wooStoreApi = w.status;
  }
  const sm = await get(base + '/sitemap.xml');
  out.sitemap = sm.status;
  if (sm.text) out.sitemapProductLinks = (sm.text.match(/<loc>[^<]*(product|products|catalog)[^<]*<\/loc>/gi) || []).length + (/<sitemapindex/.test(sm.text) ? ' (index)' : '');
  out.pricesOnHome = (h.match(/\$\s?\d{1,3}\.\d{2}|£\s?\d{1,3}\.\d{2}|€\s?\d{1,3}[.,]\d{2}/g) || []).length;
  out.jsonLdProducts = (h.match(/"@type"\s*:\s*"Product"/g) || []).length;
  return out;
}

(async () => {
  const results = [];
  for (let i = 0; i < targets.length; i += 4) {
    const batch = await Promise.all(targets.slice(i, i + 4).map(probe));
    for (const r of batch) { results.push(r); console.log(JSON.stringify(r)); }
  }
  fs.writeFileSync(path.join(root, 'data/provider-probe.json'), JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
})();
