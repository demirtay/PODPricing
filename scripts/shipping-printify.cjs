#!/usr/bin/env node
// Printify baskı ortaklarının herkese açık kargo tabloları (printify.com/shipping-rates/<ortak>/) -> data/shipping/printify.json
// Her sayfada gömülü JSON var: ortağın ülkesi (çıkış ülkesi), kategori grupları, varış yeri, ilk ürün / ek ürün ücreti (USD), teslim süresi.
// Kullanım: node scripts/shipping-printify.cjs [ortak-slug ...]   (boşsa dizindeki bütün ortaklar; istekler arası 1,5 sn)
const fs = require('node:fs'), path = require('node:path');

const root = path.join(__dirname, '..');
const OUT = path.join(root, 'data/shipping/printify.json');
const UA = { 'user-agent': 'Mozilla/5.0 (podpricing.com shipping research)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

// sayfadaki "shipping-rate-provider" kaydının data nesnesi: {"country":...,"sections":[...]}
function providerData(html) {
  const i = html.indexOf('"model":"shipping-rate-provider"');
  if (i < 0) return null;
  const j = html.indexOf('"data":{', i);
  if (j < 0) return null;
  const { value } = rawDecode(html, j + '"data":'.length);
  return value;
}

// JSON.parse'ın raw_decode karşılığı: verilen konumdan başlayan tek bir JSON değerini (nesne) okur
function rawDecode(s, start) {
  let depth = 0, inStr = false, esc = false;
  for (let k = start; k < s.length; k++) {
    const c = s[k];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') { depth--; if (depth === 0) return { value: JSON.parse(s.slice(start, k + 1)), end: k + 1 }; }
  }
  throw new Error('JSON sonu bulunamadı');
}

const stripHtml = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const days = s => { const m = String(s || '').match(/(\d+)\s*\D+\s*(\d+)\s*business days/); return m ? [+m[1], +m[2]] : null; };

function simplify(slug, d) {
  return {
    slug, name: d.name || slug, country: d.country || null,
    notes: (d.notes || []).map(n => stripHtml(n.text)).filter(Boolean),
    syncedAt: d.lastSyncedAt || null,
    methods: (d.sections || []).map(sec => ({
      method: sec.label || sec.id,
      groups: (sec.groups || []).map(g => ({
        category: g.name,
        rows: (g.rows || []).filter(r => typeof r.firstItemUsd === 'number').map(r => ({
          to: String(r.destination || '').replace(/\*+$/, '').trim(),
          sizes: (r.sizes || []).map(x => x.value).filter(Boolean).join(', ') || 'All',
          first: r.firstItemUsd, additional: r.additionalItemUsd ?? null,
          days: days(r.deliveryWindow),
        })),
      })).filter(g => g.rows.length),
    })).filter(m => m.groups.length),
  };
}

(async () => {
  let slugs = process.argv.slice(2);
  if (!slugs.length) {
    const idx = await get('https://printify.com/shipping-rates/');
    slugs = [...new Set([...idx.matchAll(/\/shipping-rates\/([a-z0-9-]+)\/?["']/g)].map(m => m[1]))].sort();
  }
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { providers: [] };
  const bySlug = new Map(prev.providers.map(p => [p.slug, p]));
  let ok = 0, fail = 0;
  for (const slug of slugs) {
    try {
      const d = providerData(await get(`https://printify.com/shipping-rates/${slug}/`));
      if (!d) throw new Error('veri yok');
      // ad, Builder kaydının üst düzeyinde; data içinde yoksa slug kalır
      const p = simplify(slug, d);
      bySlug.set(slug, p); ok++;
      console.log(slug, '|', p.country, '|', p.methods.reduce((a, m) => a + m.groups.length, 0), 'kategori');
    } catch (e) { fail++; console.log(slug, 'HATA', e.message); }
    await sleep(1500);
  }
  const out = { source: 'https://printify.com/shipping-rates/', checked: new Date().toISOString().slice(0, 10), currency: 'USD',
    note: 'first = first item, additional = each additional item; country = print provider location (ship-from)', providers: [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug)) };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(`Bitti: ${ok} ortak, ${fail} hata -> ${path.relative(root, OUT)}`);
})();
