// data/new-candidates.json'daki adayları katalogdaki üretici listesine (bağlantısız) ekler.
// Ürünler ardından refresh-once.cjs ile çekilir. Kullanım: node scripts/add-providers.cjs id [id ...]
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'data/catalog.json');
const ids = process.argv.slice(2);
if (!ids.length) throw Error('En az bir aday id gerekli');
const pool = JSON.parse(fs.readFileSync(path.join(root, 'data/new-candidates.json'), 'utf8')).candidates;
const c = JSON.parse(fs.readFileSync(file, 'utf8'));
const today = new Date().toISOString().slice(0, 10);
for (const id of ids) {
  const a = pool.find(p => p.id === id);
  if (!a) throw Error('Aday bulunamadı: ' + id);
  if (c.providers.some(p => p.id === id)) { console.log(id + ': zaten katalogda'); continue; }
  c.providers.push({ id, name: a.name, homepage: a.homepage, directorySource: 'data/new-candidates.json', discoveredOn: today, verification: 'directory-only', connection: { mode: 'unconfigured', state: 'pending', productCount: 0 } });
  console.log(id + ': eklendi');
}
const tmp = file + '.tmp';
fs.writeFileSync(tmp, JSON.stringify(c, null, 2));
fs.renameSync(tmp, file);
