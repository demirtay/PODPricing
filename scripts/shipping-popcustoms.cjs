// PopCustoms: ürün ayrıntısındaki kargo notu (i.popcustoms.com/api/v1/basics/<id>: shipping_notices, manufacturer.shipping_from).
// Yardım merkezi: "the listed product price already includes shipping to the USA" — yalnız ürünün kendi notu "Free US Shipping"
// ya da "Free Shipping" ise ABD kargosu 0 yazılır; diğer varışlar ve notsuz ürünler yazılmaz (tahmin yok).
// Çıkış: üreticinin (manufacturer) shipping_from değeri. -> data/shipping/estimate-popcustoms.json
// Kullanım: node scripts/shipping-popcustoms.cjs
'use strict';
const fs = require('node:fs'), path = require('node:path');

const root = path.join(__dirname, '..');
const OUT = path.join(root, 'data/shipping/estimate-popcustoms.json');
const CACHE = path.join(root, 'data/source-cache/popcustoms');
const FREE = new Set(['us_free_shipping', 'free_shipping']);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function detail(id) {
  const file = path.join(CACHE, id + '.json');
  try { if (Date.now() - fs.statSync(file).mtimeMs < 7 * 864e5) return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { }
  const r = await fetch('https://i.popcustoms.com/api/v1/basics/' + id, { headers: { Accept: 'application/json', Referer: 'https://popcustoms.com/', 'accept-language': 'en' }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw Error('HTTP ' + r.status);
  const j = await r.json();
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(j));
  await sleep(300);
  return j;
}

(async () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8')).products.filter(p => p.providerId === 'popcustoms');
  const out = {};
  let failed = 0;
  for (const p of catalog) {
    let d;
    try { d = await detail(p.sourceProductId); } catch (e) { failed++; continue; }
    d = d.data || d;
    const notes = (d.shipping_notices || []).map(n => n.type);
    if (!notes.some(t => FREE.has(t))) continue;
    const from = d.manufacturer?.shipping_from;
    if (!from) continue;
    out[p.id] = { US: [['PopCustoms (free US shipping, included in price)', 0, from]] };
  }
  if (!Object.keys(out).length) throw Error('PopCustoms: hiç kargo notu okunamadı');
  fs.writeFileSync(OUT, JSON.stringify({ source: 'i.popcustoms.com/api/v1/basics/<id> shipping_notices (Free US Shipping) + popcustoms.com/help-center: liste fiyatına ABD kargosu dahil', checked: new Date().toISOString().slice(0, 10), currency: 'USD', products: out }));
  console.log('PopCustoms: ' + Object.keys(out).length + '/' + catalog.length + ' ürün' + (failed ? ` (${failed} ayrıntı alınamadı)` : ''));
})().catch(e => { console.error(e.message); process.exitCode = 1; });
