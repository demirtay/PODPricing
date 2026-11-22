// Yayınlanmış sayfa kaydı (22 Kas 2026): Search Console'da 6.656 "Bulunamadı (404)".
// Neden: ürün/karşılaştırma/vs sayfaları katalogdan türetiliyor; bir ürün kaynağından düşünce, üretici 7 günden uzun
// yenilenemeyip gizlenince ya da bir karşılaştırma grubu 2 üreticinin altına inince sayfası bir sonraki derlemede kalkıyordu.
// Çözüm: bir kez yayınlanan her yol data/yayinlanmis-yollar.json'da tutulur; artık üretilmeyen yol için
// en yakın canlı sayfaya (karşılaştırma -> kategori -> bölüm dizini) noindex + canonical + meta-refresh yönlendirme sayfası yazılır.
// Kayıt biçimi: { "<yol>/": ["g:<grup slug>", "e:<etsy düğümü>", "m:<üretici>", "t:<ürün tipi>"] } — ipuçları sırayla denenir.
'use strict';
const fs = require('node:fs'), path = require('node:path');

const FILE = path.join(__dirname, '..', 'data', 'yayinlanmis-yollar.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; }
}
// satır başına bir yol: git diff'i okunur kalsın
function save(reg) {
  const keys = Object.keys(reg).sort();
  fs.writeFileSync(FILE, '{\n' + keys.map(k => JSON.stringify(k) + ':' + JSON.stringify(reg[k])).join(',\n') + '\n}\n');
}

// yol ailesi -> bölüm dizini (ipuçlarından hiçbiri canlı değilse)
const FAMILY = [
  [/^product\//, 'compare/'], [/^embed\//, 'compare/'],
  [/^compare\//, 'compare/'], [/^tr\/karsilastir\//, 'tr/karsilastir/'],
  [/^vs\//, 'vs/'], [/^tr\/vs\//, 'tr/vs/'],
  [/^category\//, 'categories/'], [/^tr\/kategori\//, 'tr/kategoriler/'],
  [/^manufacturer\//, 'manufacturers/'], [/^tr\/uretici\//, 'tr/ureticiler/'],
  [/^alternatives\//, 'alternatives/'], [/^tr\/alternatifler\//, 'tr/alternatifler/'],
  [/^profit\//, 'profit/'], [/^tr\/kar\//, 'tr/kar/'],
  [/^cheapest\//, 'cheapest/'], [/^tr\/en-ucuz\//, 'tr/en-ucuz/'],
  [/^model\//, 'compare/'], [/^tr\/model\//, 'tr/karsilastir/'],
];
const langOf = rel => rel.startsWith('tr/') ? 'tr' : 'en';

// rel: 'product/x/' ; exists(rel) -> bool ; P: { en: pathObj, tr: pathObj } ; catPath(lang, etsyId) -> rel|null
function resolve(rel, hints, { exists, P, catPath }) {
  const lg = langOf(rel), L = P[lg];
  for (const h of hints || []) {
    const i = h.indexOf(':'), k = h.slice(0, i), v = h.slice(i + 1);
    let to = null;
    if (k === 'g') to = L.group(v);
    else if (k === 'e') to = catPath(lg, v);
    else if (k === 'm') to = L.maker(v);
    else if (k === 't') to = L.guide(v);
    if (to && to !== rel && exists(to)) return to;
  }
  for (const [re, to] of FAMILY) if (re.test(rel) && to !== rel && exists(to)) return to;
  // üst klasör, yoksa dilin ana sayfası
  const up = rel.replace(/[^/]+\/$/, '');
  if (up && up !== rel && exists(up)) return up;
  return lg === 'tr' ? 'tr/' : '';
}

module.exports = { FILE, load, save, resolve, langOf };
