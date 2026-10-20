// Interestprint ve ArtsAdd: ürün sayfasındaki "Shipping Calculate" servisi (/shop/shipping_pirce_estimate) ile
// ürün başına, varış ülkesine göre kargo yöntemleri ve ilk ürün ücreti -> data/shipping/estimate.json
// Kayıt: { "<ürünId>": { US|GB|EU|CA|AU: [[yöntem, ücret (kuruş), çıkış]] } }; EU = Almanya.
// Çıkış yöntem adından: interestprint.com/help/shipping tablosunda Queens / Long Island yöntemleri ABD, Australia Express/Post
// Avustralya, diğerleri Çin tesisi. Takipsiz ya da yalnız bazı posta kodlarına giden yöntemler alınmaz.
// Kullanım: node scripts/shipping-estimate.cjs [interestprint|artsadd]   (karşılaştırmadaki ürünler; data/compare-ids.json)
'use strict';
const fs = require('node:fs'), path = require('node:path');

const root = path.join(__dirname, '..');
const OUT = path.join(root, 'data/shipping/estimate.json');
const SITES = { interestprint: 'https://www.interestprint.com', artsadd: 'https://www.artsadd.com' };
const DEST = { US: 'US', GB: 'GB', EU: 'DE', CA: 'CA', AU: 'AU' };
const UA = 'Mozilla/5.0 (compatible; POD-Atlas/1.0; fiyat karsilastirma)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const strip = s => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const originOf = m => /queen|long island|us shipping/i.test(m) ? 'US' : /australia (express|post)|auspost|fastway|aramex|sendle/i.test(m) ? 'AU' : 'CN';

async function estimate(base, pid, country) {
  const body = new URLSearchParams({ country, address_state: '', product_id: pid, container: 'shipping_estimate', qty: '1', cp: base + '/' });
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(base + '/shop/shipping_pirce_estimate?shipping_estimate', { method: 'POST', body, headers: { 'User-Agent': UA, 'content-type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw Error('HTTP ' + r.status);
      const html = (await r.text()).replace(/<style[\s\S]*?<\/style>/g, '');
      const rows = [];
      for (const b of html.split(/<div class="row p-select1?"/).slice(1)) {
        const name = strip((b.match(/<p[^>]*>([\s\S]*?)<\/p>/) || [])[1] || ''), price = (b.match(/\$\s*([\d,]+\.\d{2})/) || [])[1];
        if (!name || !price || /partial zip|without (final )?tracking|no tracking/i.test(strip(b))) continue;
        rows.push([name, Math.round(parseFloat(price.replace(/,/g, '')) * 100), originOf(name)]);
      }
      return rows;
    } catch (e) { if (attempt >= 3) throw e; await sleep(5000 * attempt); }
  }
}

(async () => {
  const only = process.argv.slice(2);
  const ids = new Set(JSON.parse(fs.readFileSync(path.join(root, 'data/compare-ids.json'), 'utf8')));
  const cat = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8')).products;
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  const today = new Date().toISOString().slice(0, 10);
  const out = { source: 'ürün sayfası Shipping Calculate (/shop/shipping_pirce_estimate)', checked: today, currency: 'USD', products: prev.products || {}, checkedOn: prev.checkedOn || {} };
  const todo = cat.filter(p => SITES[p.providerId] && (!only.length || only.includes(p.providerId)) && ids.has(p.id) && out.checkedOn[p.id] !== today);
  let n = 0, fail = 0;
  for (const p of todo) {
    const pid = (p.sourceUrl.match(/-(\d+)\.html/) || [])[1];
    if (!pid) continue;
    try {
      const rec = {};
      for (const [k, c] of Object.entries(DEST)) { const r = await estimate(SITES[p.providerId], pid, c); if (r.length) rec[k] = r; await sleep(600); }
      out.products[p.id] = rec; out.checkedOn[p.id] = today;
    } catch (e) { fail++; console.error(p.id, e.message); }
    if (++n % 20 === 0) { fs.writeFileSync(OUT, JSON.stringify(out)); console.log(n, '/', todo.length); }
  }
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log('bitti', n, 'hata', fail);
})();
