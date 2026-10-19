#!/usr/bin/env node
// Haftalık fiyat raporu verisi: bugünkü katalog ile ~7 gün önceki katalog (git geçmişindeki data/catalog.json) karşılaştırılır.
// Yalnızca baskısı kesin dahil (pb=dahil) teklifler; %3'ten ve 10 sentten küçük oynamalar ile %60'tan büyük sıçramalar
// (çoğunlukla veri düzeltmesi) sayılmaz. Çıktı: data/reports/<tarih>.json — "intro" alanı elle yazılır, betik korur.
// Kullanım: node scripts/weekly-report.cjs [--days 7] [--date YYYY-MM-DD]
const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
const tx = require('./pod-taxonomy.cjs');
const PB = require('./print-basis.cjs');
const PG = require('./product-groups.cjs');
const EN = require('./pod-taxonomy-en.cjs');

const root = path.join(__dirname, '..');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const days = +(arg('--days') || 7);
const date = arg('--date') || new Date().toISOString().slice(0, 10);
const git = (...a) => execFileSync('git', a, { cwd: root, maxBuffer: 1 << 30, encoding: 'utf8' });

// karşılaştırma noktası: tarihten en az `days` gün önceki son katalog commit'i
const before = new Date(Date.parse(date) - days * 864e5).toISOString().slice(0, 10) + 'T23:59:59Z';
const base = git('log', '-1', `--before=${before}`, '--format=%H %cI', '--', 'data/catalog.json').trim();
if (!base) { console.error('Karşılaştırılacak eski katalog bulunamadı'); process.exit(1); }
const [baseSha, baseDate] = base.split(' ');
const oldCat = JSON.parse(git('show', `${baseSha}:data/catalog.json`));
const newCat = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8'));

const decode = s => String(s ?? '').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").trim();
const prep = cat => new Map(cat.products.filter(p => Number.isSafeInteger(p.baseMinor) && p.baseMinor > 0 && p.sourceUrl).map(p => {
  const c = tx.classify(p), m = tx.detectModel(p);
  const q = { ...p, title: decode(p.title), type: c.type, model: m && m.key ? m : null, pb: PB.printBasis(p) };
  q.gkey = PG.groupKey(q);
  return [p.id, q];
}));
const oldP = prep(oldCat), newP = prep(newCat);
const provName = id => newCat.providers.find(p => p.id === id)?.name || oldCat.providers.find(p => p.id === id)?.name || id;
const slugOf = k => PG.slugOf(k, t => (EN.TYPES[t] || ['', t])[1]);

// 1) aynı ürünün fiyat değişimleri
const changes = [];
for (const [id, n] of newP) {
  const o = oldP.get(id);
  if (!o || n.pb !== 'dahil' || o.pb !== 'dahil' || o.currency !== n.currency) continue;
  const d = n.baseMinor - o.baseMinor, pct = d / o.baseMinor;
  if (Math.abs(d) < 10 || Math.abs(pct) < 0.03 || Math.abs(pct) > 0.6) continue;
  changes.push({ id, providerId: n.providerId, title: n.title, old: o.baseMinor, new: n.baseMinor, pct: +pct.toFixed(4), group: n.gkey ? slugOf(n.gkey) : null });
}

// 2) üretici özeti
const bySup = new Map();
for (const c of changes) {
  const s = bySup.get(c.providerId) || { id: c.providerId, name: provName(c.providerId), up: 0, down: 0, pcts: [] };
  c.pct > 0 ? s.up++ : s.down++; s.pcts.push(c.pct); bySup.set(c.providerId, s);
}
const suppliers = [...bySup.values()].map(s => ({ id: s.id, name: s.name, up: s.up, down: s.down, avgPct: +(s.pcts.reduce((a, b) => a + b, 0) / s.pcts.length).toFixed(4) }))
  .sort((a, b) => (b.up + b.down) - (a.up + a.down));

// 3) en ucuz üreticinin değiştiği karşılaştırmalar (en az 3 üretici, baskı dahil)
const cheapest = map => {
  const g = new Map();
  for (const p of map.values()) {
    if (!p.gkey || p.pb !== 'dahil') continue;
    if (!g.has(p.gkey)) g.set(p.gkey, new Map());
    const m = g.get(p.gkey);
    if (!m.has(p.providerId) || m.get(p.providerId).baseMinor > p.baseMinor) m.set(p.providerId, p);
  }
  return new Map([...g].filter(([, m]) => m.size >= 3).map(([k, m]) => [k, [...m.values()].sort((a, b) => a.baseMinor - b.baseMinor)]));
};
const oldC = cheapest(oldP), newC = cheapest(newP);
const leaders = [];
for (const [k, offers] of newC) {
  const prev = oldC.get(k);
  if (!prev || prev[0].providerId === offers[0].providerId) continue;
  const name = offers.find(p => p.model)?.model ? `${offers.find(p => p.model).model.brandName} ${offers.find(p => p.model).model.model}` : offers[0].title;
  leaders.push({ group: slugOf(k), name, suppliers: offers.length, was: { id: prev[0].providerId, name: provName(prev[0].providerId), price: prev[0].baseMinor },
    now: { id: offers[0].providerId, name: provName(offers[0].providerId), price: offers[0].baseMinor } });
}
leaders.sort((a, b) => b.suppliers - a.suppliers);

// 4) katalog büyümesi
const provsOf = map => new Set([...map.values()].map(p => p.providerId));
const oldProvs = provsOf(oldP), newProvs = provsOf(newP);

const file = path.join(root, 'data/reports', `${date}.json`);
let intro = '';
try { intro = JSON.parse(fs.readFileSync(file, 'utf8')).intro || ''; } catch { /* yeni rapor */ }
const report = {
  date, baseDate: baseDate.slice(0, 10), intro,
  totals: { products: newP.size, productsBefore: oldP.size, suppliers: newProvs.size, newSuppliers: [...newProvs].filter(id => !oldProvs.has(id)).map(provName),
    changed: changes.length, up: changes.filter(c => c.pct > 0).length, down: changes.filter(c => c.pct < 0).length },
  suppliers,
  drops: changes.filter(c => c.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, 15),
  rises: changes.filter(c => c.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 15),
  leaders: leaders.slice(0, 20),
};
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
console.log(`Rapor ${date} (karşılaştırma ${report.baseDate}): ${changes.length} fiyat değişimi (${report.totals.down} düşüş, ${report.totals.up} artış), ${leaders.length} üründe en ucuz değişti, yeni üretici: ${report.totals.newSuppliers.join(', ') || '-'}`);
