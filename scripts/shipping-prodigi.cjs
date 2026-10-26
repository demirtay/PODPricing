// Prodigi: panelin "Pricing" sayfasındaki herkese açık fiyat listeleri (kargo dahil CSV; kategori × alt kategori × varış ülkesi)
// prodigipricingpublic.blob.core.windows.net/public/live/prodigi-<kategori>-<alt kategori>-<ülke>.csv -> data/shipping/prodigi/ (git dışı)
// Ürün eşleşmesi: prodigi.com ürün sayfasındaki SKU kodları (ör. GLOBAL-MUG-W) CSV'deki SKU ile.
// Tesis = CSV'deki "Source country"; fiyat ve kargo o tesisin satırından, en ucuz kargo yöntemi (en alt "Budget" kademesi alınmaz).
// Para birimleri ECB günlük kuruyla USD'ye çevrilir (kur ve tarih dosyaya yazılır). Sonuç: data/shipping/facilities.json (products alanına eklenir).
// Kullanım: node scripts/shipping-prodigi.cjs   (eksik ya da 6 günden eski CSV'leri kendisi indirir)
'use strict';
const fs = require('node:fs'), path = require('node:path');

const root = path.join(__dirname, '..');
const DIR = path.join(root, 'data/shipping/prodigi');
const OUT = path.join(root, 'data/shipping/facilities.json');
const DEST = { US: 'US', GB: 'GB', DE: 'EU', CA: 'CA', AU: 'AU' };
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; POD-Atlas/1.0; fiyat karsilastirma)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// basit CSV (tırnaklı alanlar)
function parse(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const head = rows.shift().map(h => h.replace(/^﻿/, '').trim());
  return rows.filter(r => r.length === head.length).map(r => Object.fromEntries(head.map((h, i) => [h, r[i].trim()])));
}

// indirilecek dosyalar: data/shipping/prodigi-files.txt (yerel ad; '-and-' panelde '-&-' olarak yazılır)
async function download() {
  fs.mkdirSync(DIR, { recursive: true });
  const names = fs.readFileSync(path.join(root, 'data/shipping/prodigi-files.txt'), 'utf8').split(/\r?\n/).filter(Boolean);
  for (const n of names) {
    const f = path.join(DIR, n + '.csv');
    if (fs.existsSync(f) && Date.now() - fs.statSync(f).mtimeMs < 6 * 864e5) continue;
    const r = await fetch(`https://prodigipricingpublic.blob.core.windows.net/public/live/prodigi-${n.replace(/-and-/g, '-%26-')}.csv`, { headers: UA });
    if (r.ok) fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
    await sleep(300);
  }
}

(async () => {
  await download();
  // ECB kuru: 1 EUR = x birim
  const xml = await (await fetch('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml', { headers: UA })).text();
  const fx = { EUR: 1 }; for (const m of xml.matchAll(/currency='([A-Z]{3})' rate='([\d.]+)'/g)) fx[m[1]] = +m[2];
  const fxDate = (xml.match(/time='([\d-]+)'/) || [])[1];
  const usd = (v, cur) => fx[cur] && fx.USD ? Math.round(v / fx[cur] * fx.USD * 100) : null;

  // SKU -> { tesis ülkesi -> { price (USD kuruş), ship: { varış: kuruş } } }
  const idx = new Map();
  for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.csv'))) {
    const dest = DEST[f.slice(-6, -4).toUpperCase()];
    if (!dest) continue;
    for (const r of parse(fs.readFileSync(path.join(DIR, f), 'utf8'))) {
      if (/budget/i.test(r['Shipping method'] || '')) continue;
      const price = usd(parseFloat(r['Product price']), r['Product currency']), ship = usd(parseFloat(r['Shipping price']), r['Shipping currency']);
      if (!(price > 0) || !(ship >= 0)) continue;
      const src = r['Source country'];
      const s = idx.get(r.SKU) || new Map(); idx.set(r.SKU, s);
      const e = s.get(src) || { price, ship: {} }; s.set(src, e);
      e.price = Math.min(e.price, price);
      if (!(e.ship[dest] <= ship)) e.ship[dest] = ship;
    }
  }
  console.log('SKU', idx.size, 'kur', fxDate);

  const cat = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8')).products.filter(p => p.providerId === 'prodigi');
  const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { products: {} };
  out.prodigi = { source: 'dashboard.prodigi.com/pricing (herkese açık CSV: prodigipricingpublic.blob.core.windows.net)', checked: new Date().toISOString().slice(0, 10), fx: { source: 'ECB', date: fxDate } };
  let matched = 0;
  for (const p of cat) {
    let html = '';
    try { html = await (await fetch(p.sourceUrl, { headers: UA, signal: AbortSignal.timeout(30000) })).text(); } catch { continue; }
    await sleep(700);
    const skus = [...new Set(html.match(/\b[A-Z0-9]+(?:-[A-Z0-9]+){1,6}\b/g) || [])].filter(s => idx.has(s));
    if (!skus.length) continue;
    // tesis başına en düşük fiyat ve varış başına en düşük kargo (ürünün SKU'ları arasında)
    const fac = new Map();
    for (const s of skus) for (const [src, e] of idx.get(s)) {
      const a = fac.get(src) || { price: e.price, ship: {} }; fac.set(src, a);
      a.price = Math.min(a.price, e.price);
      for (const [d, v] of Object.entries(e.ship)) if (!(a.ship[d] <= v)) a.ship[d] = v;
    }
    out.products[p.id] = [...fac].map(([src, a]) => ['Prodigi ' + src, src, a.price, a.ship]);
    matched++;
  }
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log('eşleşen ürün', matched, '/', cat.length);
})();
