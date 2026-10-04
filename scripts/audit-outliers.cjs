// Aykırı fiyat denetimi: aynı ürün tipi ve fiyat türündeki tekliflerin ortancasına göre
// olağandışı düşük (< %20) veya yüksek (> 6 kat) fiyatları listeler. Kayıtları değiştirmez.
// Kullanım: node scripts/audit-outliers.cjs  → data/outlier-audit.json
'use strict';
const fs = require('node:fs'), path = require('node:path');
const tx = require('./pod-taxonomy.cjs'), PB = require('./print-basis.cjs');
const root = path.resolve(__dirname, '..');
const c = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8'));
const groups = {};
for (const p of c.products) {
  const t = tx.classify(p).type, pb = PB.printBasis(p);
  if (t === 'diger') continue;
  (groups[t + '|' + pb] = groups[t + '|' + pb] || []).push(p);
}
const flagged = [];
for (const [k, list] of Object.entries(groups)) {
  if (list.length < 15) continue;
  const s = list.map(p => p.baseMinor).sort((a, b) => a - b), med = s[s.length >> 1];
  for (const p of list) {
    const r = p.baseMinor / med;
    if (r < 0.2 || r > 6) flagged.push({ group: k, median: med, ratio: +r.toFixed(2), id: p.id, providerId: p.providerId, title: p.title, baseMinor: p.baseMinor, basis: p.priceBasis, url: p.sourceUrl });
  }
}
flagged.sort((a, b) => a.ratio - b.ratio);
fs.writeFileSync(path.join(root, 'data/outlier-audit.json'), JSON.stringify({ checkedAt: new Date().toISOString(), count: flagged.length, flagged }, null, 2));
const byProv = {};
for (const f of flagged) byProv[f.providerId] = (byProv[f.providerId] || 0) + 1;
console.log('aykırı:', flagged.length, byProv);
for (const f of flagged.slice(0, 25)) console.log(`düşük x${f.ratio} ${f.providerId.padEnd(14)} $${(f.baseMinor / 100).toFixed(2).padStart(7)} (ortanca $${(f.median / 100).toFixed(2)}) ${f.group.padEnd(28)} ${f.title.slice(0, 60)}`);
for (const f of flagged.slice(-12)) console.log(`yüksek x${f.ratio} ${f.providerId.padEnd(14)} $${(f.baseMinor / 100).toFixed(2).padStart(7)} (ortanca $${(f.median / 100).toFixed(2)}) ${f.group.padEnd(28)} ${f.title.slice(0, 60)}`);
