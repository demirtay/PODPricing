#!/usr/bin/env node
// Karşılaştırmalı ürünlerin (grupların) günlük en ucuz fiyat geçmişi: data/group-history.json
// Biçim: { dates: ['YYYY-MM-DD', ...], lo: { <slug>: [kuruş|null, ...] } } — dates ile aynı sırada, en çok 120 gün.
// Günlük kaydı build-site.cjs yazar (upsert); bu betik geçmişi git'teki eski data/catalog.json'lardan geri doldurur.
// Kullanım: node scripts/group-history.cjs [--days 30]
const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
const tx = require('./pod-taxonomy.cjs');
const PB = require('./print-basis.cjs');
const PG = require('./product-groups.cjs');
const EN = require('./pod-taxonomy-en.cjs');

const root = path.join(__dirname, '..');
const FILE = path.join(root, 'data/group-history.json');
const KEEP = 120;

// build-site.cjs ile aynı kural: en az iki üreticide bulunan grup; en ucuz fiyat baskılı tekliflerden, yoksa boş ürün fiyatı
function groupLows(catalog) {
  const decode = s => String(s ?? '').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").trim();
  const by = new Map();
  for (const p of catalog.products) {
    if (!Number.isSafeInteger(p.baseMinor) || p.baseMinor <= 0 || !p.sourceUrl) continue;
    const c = tx.classify(p), m = tx.detectModel(p);
    const q = { ...p, title: decode(p.title), type: c.type, model: m && m.key ? m : null, pb: PB.printBasis(p) };
    const k = PG.groupKey(q);
    if (!k) continue;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(q);
  }
  const out = {};
  for (const [k, list] of by) {
    if (new Set(list.map(p => p.providerId)).size < 2) continue;
    const printed = list.filter(p => p.pb !== 'bos' && p.pb !== 'toplu'), pool = printed.length ? printed : list;
    out[PG.slugOf(k, t => (EN.TYPES[t] || ['', t])[1])] = Math.min(...pool.map(p => p.baseMinor));
  }
  return out;
}

function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { dates: [], lo: {} }; } }

// bir günün kaydını ekler/değiştirir, eski günleri atar
function upsert(hist, date, lows) {
  const map = new Map(hist.dates.map((d, i) => [d, Object.fromEntries(Object.entries(hist.lo).map(([s, a]) => [s, a[i]]))]));
  map.set(date, lows);
  const dates = [...map.keys()].sort().slice(-KEEP);
  const slugs = new Set(dates.flatMap(d => Object.keys(map.get(d))));
  const lo = {};
  for (const s of [...slugs].sort()) {
    const row = dates.map(d => map.get(d)[s] ?? null);
    if (row.some(v => v != null)) lo[s] = row;
  }
  return { dates, lo };
}

// her slug bir satırda: git günlük değişimi küçük tutar
const save = hist => fs.writeFileSync(FILE, '{"dates":' + JSON.stringify(hist.dates) + ',"lo":{\n' + Object.entries(hist.lo).map(([s, a]) => JSON.stringify(s) + ':' + JSON.stringify(a)).join(',\n') + '\n}}\n');

module.exports = { groupLows, load, upsert, save };

if (require.main === module) {
  const i = process.argv.indexOf('--days'), days = i > 0 ? +process.argv[i + 1] : 30;
  const git = (...a) => execFileSync('git', a, { cwd: root, maxBuffer: 1 << 30, encoding: 'utf8' });
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  // her günün son katalog commit'i
  const perDay = new Map();
  for (const line of git('log', `--since=${since}`, '--format=%H %cI', '--', 'data/catalog.json').trim().split('\n').filter(Boolean)) {
    const [sha, iso] = line.split(' '), d = iso.slice(0, 10);
    if (!perDay.has(d)) perDay.set(d, sha); // log yeniden eskiye: ilk görülen o günün sonuncusu
  }
  let hist = load();
  for (const [d, sha] of [...perDay].sort()) {
    const lows = groupLows(JSON.parse(git('show', `${sha}:data/catalog.json`)));
    hist = upsert(hist, d, lows);
    console.log(d, Object.keys(lows).length, 'grup');
  }
  save(hist);
  console.log('Yazıldı:', path.relative(root, FILE), hist.dates.length, 'gün,', Object.keys(hist.lo).length, 'grup');
}
