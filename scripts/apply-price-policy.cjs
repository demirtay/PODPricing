// Güncel fiyat politikasını mevcut kataloğa uygular. Bugün incelemeye alınan kayıtlar
// yeniden değerlendirilir (kural daraltılınca haksız elenenler geri döner).
// Kayıt silinmez: elenenler gerekçesiyle data/price-review-pending.json'a taşınır.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..'), pol = require('./price-policy.cjs'), imp = require('./catalog-import.cjs');
const f = path.join(root, 'data/catalog.json'), pf = path.join(root, 'data/price-review-pending.json');
const c = JSON.parse(fs.readFileSync(f, 'utf8'));
let pend = JSON.parse(fs.readFileSync(pf, 'utf8'));
const reconsider = pend.filter(p => p.priceReviewAt);
pend = pend.filter(p => !p.priceReviewAt);
const all = [...c.products, ...reconsider.map(({ priceReviewReason, priceReviewAt, ...p }) => p)];
const byP = {};
for (const p of all) (byP[p.providerId] = byP[p.providerId] || []).push(p);
const acc = [], pen = [];
for (const list of Object.values(byP)) { const r = pol.apply(list); acc.push(...r.accepted); pen.push(...r.pending); }
const order = new Map(c.products.map((p, i) => [p.id, i]));
acc.sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9));
c.products = acc;
imp.validate(c);
const prevAt = new Map(reconsider.map(p => [p.id, p.priceReviewAt]));
for (const p of pen) pend.push({ ...p, priceReviewAt: prevAt.get(p.id) || new Date().toISOString() });
const w = (file, t) => { fs.writeFileSync(file + '.tmp', t); fs.renameSync(file + '.tmp', file); };
w(pf, JSON.stringify(pend, null, 2));
w(f, JSON.stringify(c, null, 2));
w(path.join(root, 'dist/catalog.js'), 'globalThis.POD_CATALOG = ' + JSON.stringify(c) + ';');
const g = {};
for (const p of pen) { const k = p.providerId + ' · ' + p.priceReviewReason; g[k] = (g[k] || 0) + 1; }
console.log(g);
console.log('katalog:', c.products.length, '· inceleme bekleyen:', pend.length);
