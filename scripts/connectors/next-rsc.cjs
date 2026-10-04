// Next.js (app router) sayfalarına gömülü React sunucu bileşeni verisini çözer
// ve verilen koşula uyan bütün nesneleri döndürür.
'use strict';

function decode(html) {
  let s = '';
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)) s += JSON.parse('"' + m[1] + '"');
  return s;
}

function findObjects(html, test) {
  const out = [], seen = new Set();
  const walk = v => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) { for (const x of v) walk(x); return; }
    if (test(v) && !seen.has(v)) { seen.add(v); out.push(v); }
    for (const k in v) walk(v[k]);
  };
  for (const line of decode(html).split('\n')) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const body = line.slice(i + 1);
    if (body[0] !== '[' && body[0] !== '{') continue;
    try { walk(JSON.parse(body)); } catch { /* JSON olmayan satırlar (ör. modül referansları) */ }
  }
  return out;
}

module.exports = { decode, findObjects };
