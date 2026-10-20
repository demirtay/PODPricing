// Kârlılık motoru (derleme tarafı): her teklif için ABD'deki alıcıya teslim maliyeti tahmini.
// - çıkış ülkesi: ürünün availableCountries'i (ABD varsa ABD) > ürün adındaki açık işaret > üretici varsayılanı (data/shipping/origins.json)
// - ABD kargosu: ürünün kendi kargo bilgisi > üreticinin kategori tablosu (Printful, Printify tesisleri) > bilinmiyor
// - ABD gümrük vergisi: çıkış ABD ise 0; değilse ürün tipinin HTS temel oranı + çıkış ülkesinin Section 301 ek vergisi
//   (AB: temel + ek toplamı en fazla %10). Çin için eski 301 listeleri (%7,5-25) ürün bazında doğrulanmadığından ayrıca uyarılır.
// Oranlar 20 Ekim 2026'da hts.usitc.gov ve USTR/Zonos'tan kontrol edildi.
'use strict';
const fs = require('node:fs'), path = require('node:path');

const root = path.join(__dirname, '..');
const readJson = f => { try { return JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')); } catch { return null; } };

// ürün tipi -> [HTS, ABD temel oranı %]; malzemeye göre değişebilir, en yaygın malzeme alındı
const HTS = {
  'giyim-tisort': ['6109.10.00', 16.5], 'giyim-uzun-kollu': ['6109.10.00', 16.5], 'giyim-atlet': ['6109.10.00', 16.5], 'giyim-raglan': ['6109.10.00', 16.5],
  'giyim-crop': ['6109.10.00', 16.5], 'giyim-ust': ['6109.10.00', 16.5], 'cocuk-giyim': ['6109.10.00', 16.5],
  'giyim-kapusonlu': ['6110.20.20', 16.5], 'giyim-sweatshirt': ['6110.20.20', 16.5], 'giyim-fermuarli-kapusonlu': ['6110.20.20', 16.5], 'giyim-hirka-kazak': ['6110.20.20', 16.5],
  'giyim-polo': ['6105.10.00', 19.7], 'giyim-elbise': ['6104.42.00', 11.5], 'giyim-tayt': ['6104.63.20', 28.2], 'giyim-mayo': ['6112.41.00', 24.9],
  'giyim-corap': ['6115.95.90', 13.5], 'bebek-body': ['6111.20.60', 8.1],
  'aksesuar-sapka': ['6505.00.15', 7.9], 'aksesuar-bere': ['6505.00.15', 7.9], 'aksesuar-taki': ['7117.19.90', 11],
  'mutfak-kupa': ['6912.00.48', 9.8], 'mutfak-termos': ['9617.00.10', 7.2], 'mutfak-matara': ['7323.93.00', 2],
  'duvar-poster': ['4911.91', 0], 'duvar-kanvas': ['4911.91', 0], 'duvar-cerceveli': ['4911.91', 0],
  'ev-battaniye': ['6301.40.00', 8.5], 'ev-yastik': ['9404.90.20', 6], 'ev-perde': ['6303.92.20', 11.3], 'ev-havlu': ['6302.60.00', 9.1],
  'ev-mum': ['3406.00.00', 0], 'ev-lamba': ['9405.21.60', 6],
  'canta-bez': ['4202.92.15', 6.3], 'canta-sirt': ['4202.92.31', 17.6],
  'teknoloji-telefon-kilifi': ['3926.90.99', 5.3], 'ayakkabi-sneaker': ['6404.19.15', 10.5],
  'kirtasiye-kart': ['4909.00', 0], 'kirtasiye-defter': ['4820.10.20', 0], 'oyun-puzzle': ['9503.00.00', 0], 'oyun-kart': ['9504.40.00', 0],
};
// çıkış ülkesine göre ABD Section 301 (zorla çalıştırma) ek vergisi, 24 Temmuz 2026'dan beri; 'EU' = temel+ek en fazla %10
const EXTRA = { CN: 12.5, VN: 12.5, TR: 12.5, AU: 12.5, IN: 10, GB: 10, UK: 10, CA: 10, MX: 10, PK: 10, BD: 10, EU: 'cap10', DE: 'cap10', FR: 'cap10', NL: 'cap10', LV: 'cap10', CZ: 'cap10' };

// katalogdaki ülke yazımlarını tek koda indir
const CODE = { us: 'US', usa: 'US', 'united states': 'US', china: 'CN', cn: 'CN', vn: 'VN', vietnam: 'VN', eu: 'EU', europe: 'EU', eu_lv: 'EU', uk: 'GB', gb: 'GB', 'united kingdom': 'GB', au: 'AU', 'australia/nz': 'AU', australia: 'AU', ca: 'CA', canada: 'CA', mx: 'MX', mexico: 'MX', tr: 'TR', in: 'IN', india: 'IN' };
const code = s => CODE[String(s || '').trim().toLowerCase()] || null;

const ORIGINS = readJson('data/shipping/origins.json') || { providers: {}, titleRules: [] };
const RULES = ORIGINS.titleRules.map(r => [r.to, new RegExp(r.pattern, 'i')]);

function originOf(p) {
  const ac = (p.availableCountries || []).map(code).filter(Boolean);
  if (ac.includes('US')) return { origin: 'US', how: 'catalog' };
  const t = RULES.find(([, re]) => re.test(p.title || ''));
  if (t) return { origin: t[0], how: 'title' };
  if (ac.length) return { origin: ac[0], how: 'catalog' };
  const d = ORIGINS.providers[p.providerId];
  return d && d.default ? { origin: d.default, how: 'provider', confidence: d.confidence } : { origin: null, how: 'unknown' };
}

// --- kargo tabloları
const PF = readJson('data/shipping/printful.json');
const PY = readJson('data/shipping/printify.json');
// ürün tipi -> kategori adında aranacak kelime(ler) (ilk eşleşen tablo)
const KW = {
  'giyim-tisort': ['t-shirt', 'shirts'], 'giyim-uzun-kollu': ['t-shirt', 'long sleeve', 'shirts'], 'giyim-atlet': ['tank', 't-shirt', 'shirts'], 'giyim-polo': ['polo', 't-shirt', 'shirts'],
  'giyim-kapusonlu': ['hoodie'], 'giyim-sweatshirt': ['sweatshirt', 'hoodie'], 'giyim-fermuarli-kapusonlu': ['hoodie'],
  'aksesuar-sapka': ['hat', 'cap', 'headwear'], 'aksesuar-bere': ['beanie', 'hat'],
  'mutfak-kupa': ['mugs (11oz)', '11oz', 'mug'], 'mutfak-termos': ['tumbler', 'drinkware'], 'mutfak-matara': ['water bottle', 'bottle', 'drinkware'],
  'duvar-poster': ['small sizes (in.) 5', 'poster'], 'duvar-kanvas': ['thin canvas', 'canvas'], 'duvar-cerceveli': ['small sizes (in.) 8 ', 'framed'],
  'ev-battaniye': ['blankets (30', 'blanket'], 'ev-yastik': ['throw pillow', 'pillow'], 'ev-perde': ['shower curtain', 'curtain'], 'ev-havlu': ['towel'],
  'canta-bez': ['tote'], 'canta-sirt': ['backpack'], 'teknoloji-telefon-kilifi': ['phone case', 'case'], 'kirtasiye-sticker': ['sticker'], 'kirtasiye-kart': ['postcard', 'card'],
  'ev-mum': ['candle'], 'oyun-puzzle': ['puzzle'],
};
const findGroup = (groups, type, nameOf) => {
  for (const kw of KW[type] || []) { const g = groups.find(x => nameOf(x).toLowerCase().includes(kw)); if (g) return g; }
  return null;
};
const PY_BY_NAME = new Map((PY?.providers || []).map(p => [p.name.toLowerCase(), p]));
const usRow = rows => rows.find(r => /^(usa|united states|us)$/i.test(r.to));

// Printify'daki tesislerin ülkesine göre, ürün tipi başına ABD'ye ortanca ilk ürün kargosu (kendi tablosu olmayan üreticiler için tahmin)
const provCode = c => { const t = String(c || '').toLowerCase();
  if (/united states|^usa?/.test(t)) return 'US'; if (/china/.test(t)) return 'CN'; if (/united kingdom/.test(t)) return 'GB';
  if (/germany|france|latvia|czech|europe|netherlands/.test(t)) return 'EU'; if (/canada/.test(t)) return 'CA'; if (/australia/.test(t)) return 'AU'; if (/india/.test(t)) return 'IN';
  return null; };
const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };
const EST = (() => {
  const acc = {};
  for (const prov of PY?.providers || []) {
    const cc = provCode(prov.country); if (!cc) continue;
    const std = prov.methods.find(m => /standard/i.test(m.method)) || prov.methods[0]; if (!std) continue;
    for (const type of Object.keys(KW)) {
      const g = findGroup(std.groups, type, x => x.category), r = g && usRow(g.rows);
      if (r) ((acc[cc] = acc[cc] || {})[type] = acc[cc][type] || []).push(r.first);
    }
  }
  const out = {};
  for (const [cc, t] of Object.entries(acc)) for (const [type, v] of Object.entries(t)) (out[cc] = out[cc] || {})[type] = { usd: median(v), n: v.length };
  return out;
})();

// ABD'ye ilk ürün kargosu (kuruş) ve kaynağı
function shipUS(p, origin) {
  if (p.shipping && Number.isFinite(p.shipping.US)) return { minor: p.shipping.US, src: 'product' };
  if (p.providerId === 'printful' && PF) {
    const g = findGroup(PF.categories, p.type, x => x.category);
    if (g && g.rates.US) return { minor: Math.round(g.rates.US[0] * 100), src: 'table' };
  }
  if (p.providerId === 'printify' && p.printProvider) {
    const prov = PY_BY_NAME.get(String(p.printProvider).toLowerCase());
    const std = prov && prov.methods.find(m => /standard/i.test(m.method)) || prov?.methods[0];
    const g = std && findGroup(std.groups, p.type, x => x.category);
    const r = g && usRow(g.rows);
    if (r) return { minor: Math.round(r.first * 100), src: 'table' };
  }
  const e = origin && EST[origin === 'GB' ? 'GB' : origin]?.[p.type];
  if (e && e.usd != null) return { minor: Math.round(e.usd * 100), src: 'estimate', n: e.n };
  return { minor: null, src: null };
}

// ABD gümrük vergisi oranı (%) ve notu
function dutyUS(p, origin) {
  if (origin === 'US') return { rate: 0, note: 'us' };
  if (!origin) return { rate: null, note: 'origin-unknown' };
  const h = HTS[p.type];
  if (!h) return { rate: null, note: 'type-unknown' };
  const x = EXTRA[origin];
  if (x === 'cap10') return { rate: Math.max(h[1], 10), note: 'eu', hts: h[0] };
  if (x == null) return { rate: null, note: 'origin-rate-unknown', hts: h[0] };
  return { rate: +(h[1] + x).toFixed(2), note: origin === 'CN' ? 'cn-extra' : 'ok', hts: h[0] };
}

function landedUS(p) {
  const o = originOf(p), s = shipUS(p, o.origin), d = dutyUS(p, o.origin);
  return { origin: o.origin, originHow: o.how, shipMinor: s.minor, shipSrc: s.src, dutyRate: d.rate, dutyNote: d.note };
}

module.exports = { landedUS, originOf, shipUS, dutyUS, HTS, EXTRA, EST };
