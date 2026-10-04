// BAGLANTI-DURUMU.md dosyasını güncel katalogdan üretir.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const c = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8'));
const pending = JSON.parse(fs.readFileSync(path.join(root, 'data/price-review-pending.json'), 'utf8'));
const n = {}; for (const p of c.products) n[p.providerId] = (n[p.providerId] || 0) + 1;
const rows = c.providers.map(p => ({ p, n: n[p.id] || 0 })).sort((a, b) => b.n - a.n || a.p.name.localeCompare(b.p.name));
const connected = rows.filter(r => r.n), waiting = rows.filter(r => !r.n);
const why = r => r.p.connection?.blockedReason || 'Henüz incelenmedi';
const groups = {}; for (const r of waiting) (groups[why(r)] = groups[why(r)] || []).push(r.p.name);
const md = `# POD Atlas bağlantı durumu

Güncelleme: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · ${connected.length}/${c.providers.length} üretici bağlı · ${c.products.length.toLocaleString('tr-TR')} fiyatlı ürün · ${pending.length} kayıt fiyat incelemesinde

## Bağlı üreticiler

| Üretici | Ürün | Kapsam | Son başarılı |
|---|---:|---|---|
${connected.map(r => `| ${r.p.name} | ${r.n} | ${r.p.connection?.coverage || r.p.connection?.state || ''} | ${r.p.connection?.lastSuccess || ''} |`).join('\n')}

## Bağlı olmayanlar (${waiting.length})

${Object.entries(groups).sort((a, b) => b[1].length - a[1].length).map(([k, v]) => `**${k}** (${v.length}): ${v.join(', ')}`).join('\n\n')}
`;
fs.writeFileSync(path.join(root, 'BAGLANTI-DURUMU.md'), md);
console.log(`${connected.length}/${c.providers.length} bağlı`);
