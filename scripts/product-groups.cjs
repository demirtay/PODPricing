// Akakçe/Cimri mantığı: farklı üreticilerdeki "aynı ürünü" tek ürün sayfasında toplar.
// 1) Boş ürün modeli (ör. Gildan 5000) -> kesin eşleşme
// 2) Ürün tipi + ölçü/hacim (+ kupada renk) -> özellik eşleşmesi (ör. 11oz beyaz kupa, 16x20 kanvas)
'use strict';

// özellik eşleşmesi yapılan tipler: [ölçü türü, EN ad, TR ad]
const SPEC = {
  'mutfak-kupa': ['oz', 'Mug', 'Kupa'], 'mutfak-termos': ['oz', 'Tumbler', 'Termos Bardak'], 'mutfak-matara': ['oz', 'Water Bottle', 'Matara'],
  'mutfak-bardak': ['oz', 'Glass', 'Bardak'], 'duvar-kanvas': ['dim', 'Canvas Print', 'Kanvas Tablo'], 'duvar-poster': ['dim', 'Poster', 'Poster'],
  'duvar-cerceveli': ['dim', 'Framed Print', 'Çerçeveli Baskı'], 'duvar-metal': ['dim', 'Metal Print', 'Metal Baskı'], 'duvar-akrilik': ['dim', 'Acrylic Print', 'Akrilik Baskı'],
  'duvar-ahsap': ['dim', 'Wood Print', 'Ahşap Baskı'], 'duvar-duvar-halisi': ['dim', 'Tapestry', 'Duvar Halısı'], 'ev-yastik': ['dim', 'Pillow', 'Yastık'],
  'ev-battaniye': ['dim', 'Blanket', 'Battaniye'], 'teknoloji-mousepad': ['dim', 'Mouse Pad', 'Mouse Pad'], 'ev-bayrak': ['dim', 'Flag', 'Bayrak'],
  'ev-hali': ['dim', 'Rug', 'Halı'], 'oyun-puzzle': ['dim', 'Jigsaw Puzzle', 'Yapboz'], 'ev-havlu': ['dim', 'Towel', 'Havlu'],
};
const COLOR = { magic: ['Color-Changing', 'Isıyla Renk Değiştiren'], black: ['Black', 'Siyah'], accent: ['Two-Tone', 'İçi Renkli'], enamel: ['Enamel', 'Emaye'], white: ['White', 'Beyaz'] };

const oz = t => { const m = t.match(/(\d{1,2})\s?-?\s?oz\b/i); return m ? m[1] + 'oz' : ''; };
function dim(t) {
  const m = t.match(/(\d{1,3}(?:\.\d)?)\s?(?:″|"|in|inch|'')?\s?[x×*]\s?(\d{1,3}(?:\.\d)?)\s?(″|"|in|inch|cm|'')?/i);
  if (!m) return '';
  let a = +m[1], b = +m[2];
  if (/cm/i.test(m[3] || '')) { a = Math.round(a / 2.54); b = Math.round(b / 2.54); }
  if (!(a > 1 && b > 1)) return '';
  const [x, y] = [a, b].sort((p, q) => p - q);
  return `${x}x${y}`;
}
const color = t => /(color|colour)[- ]?chang|magic/i.test(t) ? 'magic' : /\bblack\b/i.test(t) ? 'black' : /\baccent|two[- ]?tone|inner colou?r/i.test(t) ? 'accent' : /\benamel\b/i.test(t) ? 'enamel' : /\bwhite\b/i.test(t) ? 'white' : '';

// p: { title, sizes, type, model } -> grup anahtarı (yoksa null)
function groupKey(p) {
  if (p.model?.key) return 'm:' + p.model.key;
  const s = SPEC[p.type];
  if (!s) return null;
  if (s[0] === 'oz') { const o = oz(p.title + ' ' + (p.sizes || '')); return o ? `s:${p.type}:${o}:${p.type === 'mutfak-kupa' ? color(p.title) : ''}` : null; }
  const d = dim(p.title);
  return d ? `s:${p.type}:${d}` : null;
}

// grup adı (dile göre); typeLabel: dil için tip etiketi fonksiyonu
function groupName(key, sample, lang, typeLabel) {
  if (key.startsWith('m:')) return `${sample.model.brandName} ${sample.model.model} ${typeLabel(sample.type)}`;
  const [, type, spec, col] = key.split(':');
  const base = SPEC[type][lang === 'tr' ? 2 : 1];
  const c = col && COLOR[col] ? COLOR[col][lang === 'tr' ? 1 : 0] + ' ' : '';
  return SPEC[type][0] === 'oz' ? `${spec} ${c}${base}` : `${base} ${spec.replace('x', '×')} in`;
}

const slugOf = (key, enSlug) => key.startsWith('m:') ? key.slice(2) : (() => { const [, type, spec, col] = key.split(':'); return [enSlug(type), spec, col].filter(Boolean).join('-'); })();

module.exports = { groupKey, groupName, slugOf, SPEC };
