// data/yayinlanmis-yollar.json'u git geçmişinden doldurur (bir kerelik; tekrar çalıştırmak zararsız).
// Her data/catalog.json sürümünden o gün yayınlanmış olması gereken ürün (/product/<id>/), karşılaştırma
// (/compare/<slug>/ + TR), gömme kutusu (/embed/<slug>/), vs (/vs/<a>-vs-<b>/ + TR) ve üretici sayfalarını çıkarır.
// Adlar bugünkü derleme kurallarıyla hesaplanır (slug kuralı değişen eski adresler kapsanmaz).
// --extra <dosya>: Search Console dışa aktarması (CSV/TXT, satır başına URL) — listedeki yollar da kayda girer.
// Kullanım: node scripts/seed-published-paths.cjs [--limit N] [--extra 404-ornekleri.csv]
'use strict';
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const tx = require('./pod-taxonomy.cjs');
const EN = require('./pod-taxonomy-en.cjs');
const PB = require('./print-basis.cjs');
const PG = require('./product-groups.cjs');
const EM = require('./etsy-map.cjs');
const PUB = require('./published-paths.cjs');

const root = path.resolve(__dirname, '..');
const git = (...a) => execFileSync('git', a, { cwd: root, maxBuffer: 512 * 1024 * 1024, encoding: 'utf8' });
const lim = process.argv.includes('--limit') ? +process.argv[process.argv.indexOf('--limit') + 1] : Infinity;
const commits = git('log', '--format=%h', '--', 'data/catalog.json').trim().split('\n').slice(0, lim);
const decode = s => String(s ?? '').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").trim();
const mostCommon = a => { const c = {}; for (const x of a) c[x] = (c[x] || 0) + 1; return Object.entries(c).sort((x, y) => y[1] - x[1])[0][0]; };

const cache = new Map(); // id|başlık|kategori -> sınıflandırma
const found = new Map(); // yol -> ipuçları (ilk görülen = en yeni sürüm, git log yeniden eskiye)
const put = (rel, hints) => { if (!found.has(rel)) found.set(rel, hints); };
let i = 0;
for (const c of commits) {
  i++;
  let cat;
  try { cat = JSON.parse(git('show', `${c}:data/catalog.json`)); } catch (e) { console.log(c, 'okunamadı', e.message.slice(0, 80)); continue; }
  const names = new Map((cat.providers || []).map(p => [p.id, p.name || p.id]));
  const prods = (cat.products || []).filter(p => Number.isSafeInteger(p.baseMinor) && p.baseMinor > 0 && p.sourceUrl).map(p => {
    const k = p.id + '|' + p.title + '|' + (p.category || '') + '|' + (p.family || '') + '|' + (p.priceBasis || '');
    let q = cache.get(k);
    if (!q) {
      try {
        const cl = tx.classify(p), m = tx.detectModel(p);
        q = { ...p, title: decode(p.title), type: cl.type, group: cl.group, etsy: EM.etsyOf(p, cl) || 'other', model: m && m.key ? m : null, pb: PB.printBasis(p) };
        q.gkey = PG.groupKey(q);
        q = { id: p.id, providerId: p.providerId, etsy: q.etsy, gkey: q.gkey, pb: q.pb, baseMinor: p.baseMinor };
      } catch { q = { id: p.id, providerId: p.providerId, etsy: 'other', gkey: null, pb: null, baseMinor: p.baseMinor }; }
      cache.set(k, q);
    }
    return { ...q, providerId: p.providerId, baseMinor: p.baseMinor };
  });
  // gruplar (>= 2 üretici)
  const byKey = new Map();
  for (const p of prods) if (p.gkey) { if (!byKey.has(p.gkey)) byKey.set(p.gkey, []); byKey.get(p.gkey).push(p); }
  const slugOfP = new Map(), pairs = new Map();
  for (const [key, list] of byKey) {
    if (new Set(list.map(p => p.providerId)).size < 2) continue;
    const slug = PG.slugOf(key, t => (EN.TYPES[t] || ['', t])[1]), etsy = mostCommon(list.map(p => p.etsy));
    for (const p of list) slugOfP.set(p.id, slug);
    put(`compare/${slug}/`, ['e:' + etsy]); put(`tr/karsilastir/${slug}/`, ['e:' + etsy]); put(`embed/${slug}/`, ['g:' + slug, 'e:' + etsy]);
    // kâr sayfası yalnız kargo verisi olan gruplarda vardı; geçmişte hangisi olduğunu bilmek için kargo verisi gerekir -> hepsi kayda (fazlası zararsız: yalnız noindex yönlendirme)
    put(`profit/${slug}/`, ['g:' + slug, 'e:' + etsy]); put(`tr/kar/${slug}/`, ['g:' + slug, 'e:' + etsy]);
    const dahil = [...new Set(list.filter(p => p.pb === 'dahil').map(p => p.providerId))].sort((x, y) => String(names.get(x)).localeCompare(String(names.get(y)), 'en', { sensitivity: 'base' }));
    for (let a = 0; a < dahil.length; a++) for (let b = a + 1; b < dahil.length; b++) { const k = dahil[a] + '|' + dahil[b]; pairs.set(k, (pairs.get(k) || 0) + 1); }
  }
  for (const [k, n] of pairs) if (n >= 5) { const [a, b] = k.split('|'); put(`vs/${a}-vs-${b}/`, ['m:' + a, 'm:' + b]); put(`tr/vs/${a}-vs-${b}/`, ['m:' + a, 'm:' + b]); }
  for (const p of prods) { const g = slugOfP.get(p.id); put(`product/${p.id}/`, g ? ['g:' + g, 'e:' + p.etsy] : ['e:' + p.etsy]); }
  for (const id of new Set(prods.map(p => p.providerId))) { put(`manufacturer/${id}/`, []); put(`tr/uretici/${id}/`, []); }
  console.log(`${i}/${commits.length} ${c}: ${prods.length} ürün, toplam ${found.size} yol`);
}
const ex = process.argv.includes('--extra') ? process.argv[process.argv.indexOf('--extra') + 1] : null;
if (ex) for (const m of require('node:fs').readFileSync(ex, 'utf8').matchAll(/https?:\/\/(?:www\.)?podpricing\.com(\/[^\s",;]*)/g)) {
  let p = m[1].split('#')[0].split('?')[0].replace(/^\//, '');
  try { p = decodeURIComponent(p); } catch { }
  if (!p || /^(assets|data|go|badge)\//.test(p) || /\.[a-z0-9]{2,4}$/i.test(p)) continue;
  if (!p.endsWith('/')) p += '/';
  const g = p.match(/^(?:tr\/)?(?:profit|kar|compare|karsilastir|embed)\/([^/]+)\/$/);
  put(p, g ? ['g:' + g[1]] : []);
}
const reg = PUB.load();
let added = 0;
for (const [rel, h] of found) if (!reg[rel]) { reg[rel] = h; added++; }
PUB.save(reg);
console.log(`kayda eklenen: ${added}, toplam ${Object.keys(reg).length}`);
