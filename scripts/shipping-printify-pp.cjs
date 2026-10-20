// Printify: ürün (blueprint) başına baskı tesislerinin fiyatı, ülkesi ve ülke ülke ilk ürün kargosu
// (printify.com/app/products/<id> sayfasının kullandığı herkese açık servis) -> data/shipping/printify-pp.json
// Kayıt: { "<blueprintId>": [[tesisId, tesisAdı, ülkeKodu, enDüşükFiyat (kuruş), {US,GB,EU,CA,AU: ilk ürün standart kargo (kuruş)}], ...] }
// Kargo tesisin tam tablosundan (…/print-providers/<tesis>/shipping): EU = Almanya; tesis bir ülkeyi ayrı yazmamışsa
// kendi "Rest of the World" ücreti (tablonun kuralı). Varyantlar arasında en düşük ilk ürün ücreti. Yayınlanmamış varış yazılmaz.
// Kullanım: node scripts/shipping-printify-pp.cjs [blueprintId ...]   (boşsa katalogdaki bütün Printify ürünleri; kaldığı yerden devam eder)
'use strict';
const fs = require('node:fs'), path = require('node:path');

const root = path.join(__dirname, '..');
const OUT = path.join(root, 'data/shipping/printify-pp.json');
const BASE = 'https://printify.com/product-catalog-service/api/v2/blueprints';
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; POD-Atlas/1.0; fiyat karsilastirma)', Accept: 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DEST = { US: 'United States', GB: 'United Kingdom', EU: 'Germany', CA: 'Canada', AU: 'Australia' };

async function get(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
      if (r.status === 429 && attempt < 5) { await sleep(30000 * attempt); continue; }
      if (r.status === 404) return null;
      if (!r.ok) throw Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) { if (attempt >= 3) throw e; await sleep(5000 * attempt); }
  }
}

async function facility(id, p) {
  await sleep(700);
  const t = (await get(`${BASE}/${id}/print-providers/${p.id}/shipping`))?.data || [];
  const std = t.filter(s => s.method === 'standard' && Number.isFinite(s.first));
  const at = name => { const v = std.filter(s => s.country === name).map(s => s.first); return v.length ? Math.min(...v) : undefined; };
  const rest = at('Rest of the World'), ship = {};
  for (const [k, name] of Object.entries(DEST)) { const v = at(name) ?? rest; if (Number.isFinite(v)) ship[k] = v; }
  return [p.id, p.name, p.location?.country_code || null, p.min_price, ship];
}

(async () => {
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { blueprints: {} };
  let ids = process.argv.slice(2);
  if (!ids.length) {
    const c = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8'));
    ids = c.products.filter(p => p.providerId === 'printify').map(p => p.id.replace(/^printify-/, ''));
  }
  const today = new Date().toISOString().slice(0, 10);
  const out = { source: 'https://printify.com/product-catalog-service/api/v2/blueprints/<id>/print-providers', checked: today, currency: 'USD',
    note: 'tesis başına en düşük maliyet (standart plan) ve ilk ürün standart kargo; EU = Almanya', blueprints: prev.blueprints || {}, checkedOn: prev.checkedOn || {} };
  let n = 0, fail = 0;
  for (const id of ids) {
    if (out.checkedOn[id] === today) continue;
    try {
      const d = (await get(`${BASE}/${id}/print-providers?target_market=USA`))?.data;
      if (d) { const rows = []; for (const p of d.filter(p => p.min_price > 0)) rows.push(await facility(id, p)); out.blueprints[id] = rows; }
      out.checkedOn[id] = today;
    } catch (e) { fail++; console.error(id, e.message); }
    if (++n % 20 === 0) { fs.writeFileSync(OUT, JSON.stringify(out)); console.log(n, '/', ids.length); }
    await sleep(700);
  }
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log('bitti', n, 'hata', fail, 'kayıt', Object.keys(out.blueprints).length);
})();
