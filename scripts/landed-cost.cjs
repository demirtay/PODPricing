// Kârlılık motoru (derleme tarafı): her teklif için ABD'deki alıcıya teslim maliyeti tahmini.
// - çıkış ülkesi: ürünün availableCountries'i (ABD varsa ABD) > ürün adındaki açık işaret > üretici varsayılanı (data/shipping/origins.json)
// - kargo: ürünün kendi kargo bilgisi > üreticinin yayınladığı kategori tablosu (Printful, Printify tesisleri) > bilinmiyor (tahmin yok)
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
// SimplePrint panelindeki kategori tablosu (data/shipping/simpleprint.json); ürün tipi -> kategori
const SP = readJson('data/shipping/simpleprint.json');
function spCategory(p) {
  const t = p.title || '', kid = /\b(youth|kid|toddler)/i.test(t);
  if (/\b(infant|baby|onesie|bodysuit|creeper)/i.test(t) || p.type === 'bebek-body') return 'Infant / Baby';
  if (kid || p.type === 'cocuk-giyim') return /hood/i.test(t) ? "Kid's Hoodies" : /sweatshirt|crew ?neck fleece/i.test(t) ? "Kid's Sweatshirts" : /long sleeve/i.test(t) ? "Kid's Long Sleeve Shirts" : /performance/i.test(t) ? "Kid's Performance Shirts" : "Kid's T-shirts";
  // forma/crop diye sınıflanan ürünler: adındaki açık işaretle (3/4 kollu raglan belirsiz, eşlenmez)
  if (/three-quarter|3\/4|raglan/i.test(t)) return null;
  if (/\btank\b/i.test(t)) return 'Tank Tops';
  if (/long sleeve/i.test(t)) return 'Long Sleeve Shirts';
  if (/\b(tee|t-shirt)\b/i.test(t) && /^giyim-(forma|crop)$/.test(p.type)) return 'T-Shirts';
  return ({ 'giyim-tisort': /performance/i.test(t) ? 'Performance Shirts' : 'T-Shirts', 'giyim-kapusonlu': 'Hoodies', 'giyim-fermuarli-kapusonlu': 'Hoodies', 'giyim-sweatshirt': 'Sweatshirts',
    'giyim-uzun-kollu': 'Long Sleeve Shirts', 'giyim-polo': 'Polo Shirts', 'giyim-atlet': 'Tank Tops', 'aksesuar-sapka': 'Hats', 'aksesuar-bere': 'Hats',
    'canta-bez': 'Tote Bags', 'mutfak-kupa': 'Mugs', 'ev-yastik': 'Pillows' })[p.type] || null;
}
const PY_BY_NAME = new Map((PY?.providers || []).map(p => [p.name.toLowerCase(), p]));
// varış bölgesi -> Printify satırındaki "to" yazımları; Printful tablosunda anahtarlar zaten US/EU/GB/CA/AU
const DEST_RE = { US: /^(usa|united states|us)$/i, GB: /^(uk|united kingdom|great britain)\b/i, EU: /^(europe|european|eu\b|european union)/i, CA: /^canada/i, AU: /^australia/i };
const DESTS = Object.keys(DEST_RE);
// varışa ait satır; yoksa (ABD dışı varışlarda) "Rest of the World / International" satırı
const destRow = (rows, dest) => rows.find(r => DEST_RE[dest].test(r.to)) || (dest !== 'US' ? rows.find(r => /rest of (the )?world|international|worldwide/i.test(r.to)) : null);

// varışa ilk ürün kargosu (kuruş) ve kaynağı
function shipTo(p, origin, dest) {
  const own = p.shipping && (dest === 'EU' ? p.shipping.EU ?? p.shipping.DE : p.shipping[dest]);
  if (Number.isFinite(own)) return { minor: own, src: 'product' };
  if (p.providerId === 'printful' && PF) {
    const g = findGroup(PF.categories, p.type, x => x.category);
    if (g && g.rates[dest]) return { minor: Math.round(g.rates[dest][0] * 100), src: 'table' };
  }
  if (p.providerId === 'printify' && p.printProvider) {
    const prov = PY_BY_NAME.get(String(p.printProvider).toLowerCase());
    const std = prov && prov.methods.find(m => /standard/i.test(m.method)) || prov?.methods[0];
    const g = std && findGroup(std.groups, p.type, x => x.category);
    const r = g && destRow(g.rows, dest);
    if (r) return { minor: Math.round(r.first * 100), src: 'table' };
  }
  if (p.providerId === 'simpleprint' && SP) {
    const c = SP.categories[spCategory(p)];
    if (c && Number.isFinite(c[dest])) return { minor: c[dest], src: 'table' };
  }
  // tahmin yok: üreticinin yayınladığı ücret bulunamazsa kargo bilinmiyor
  return { minor: null, src: null };
}
const shipUS = (p, origin) => shipTo(p, origin, 'US');

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

// AB'nin 1 Temmuz 2026'dan beri €150 altı paketlerde ürün başına sabit €3 gümrük vergisi (Konsey Tüzüğü 2026/382, 1 Temmuz 2028'e kadar)
const EUR_USD = (() => { try {
  const c = readJson('data/catalog.json'); let best = null;
  for (const p of c?.products || []) if (p.sourceCurrency === 'EUR' && p.exchangeRate > 0 && (!best || p.exchangeDate > best.exchangeDate)) best = p;
  return best ? best.exchangeRate : 1.12;
} catch { return 1.12; } })();
const EU_FLAT_MINOR = Math.round(3 * EUR_USD * 100);
const EU_ORIGINS = new Set(['EU', 'DE', 'FR', 'NL', 'LV', 'CZ']);

// varışa göre gümrük vergisi: oran (%) ya da sabit tutar (kuruş); KDV/GST'yi bu pazarlarda pazar yeri alıcıdan tahsil eder (satıcı maliyeti değil)
function dutyTo(p, origin, dest) {
  if (dest === 'US') { const d = dutyUS(p, origin); return { rate: d.rate, flatMinor: 0, note: d.note }; }
  if (dest === 'GB') return { rate: 0, flatMinor: 0, note: 'gb' };            // £135 altı gümrük muafiyeti sürüyor; %20 KDV pazar yerinde
  if (dest === 'AU') return { rate: 0, flatMinor: 0, note: 'au' };            // A$1.000 altı gümrük yok; %10 GST pazar yerinde
  if (dest === 'EU') return origin && EU_ORIGINS.has(origin) ? { rate: 0, flatMinor: 0, note: 'eu-inside' } : { rate: 0, flatMinor: EU_FLAT_MINOR, note: 'eu-flat' };
  if (dest === 'CA') return origin === 'US' || origin === 'MX' ? { rate: 0, flatMinor: 0, note: 'ca-cusma' } : { rate: null, flatMinor: 0, note: 'ca-unknown' };
  return { rate: null, flatMinor: 0, note: 'dest-unknown' };
}

// varış bölgesine göre çıkış: ürün o bölgeden de gönderiliyorsa (ör. Printful AB tesisi) oradan
function originFor(p, dest) {
  const ac = (p.availableCountries || []).map(code).filter(Boolean);
  if (dest !== 'US' && ac.includes(dest)) return { origin: dest, how: 'catalog' };
  return originOf(p);
}

// Printify: ürün başına baskı tesisleri (fiyat, ülke, varışa kargo) — scripts/shipping-printify-pp.cjs
const PP = readJson('data/shipping/printify-pp.json')?.blueprints || {};
const EU_CC = new Set('AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE'.split(' '));
const ccOrigin = cc => !cc ? null : EU_CC.has(cc) ? 'EU' : code(cc) || cc;
// varışa teslimde en ucuz tesis (fiyat + kargo + vergi); tesisin yayınlamadığı varış atlanır
// diğer üreticilerin tesis listeleri aynı biçimde (ör. scripts/shipping-burgerprints.cjs): { ürünId: [[tesis, ülke, fiyat, kargo]] }
const FAC = readJson('data/shipping/facilities.json')?.products || {};
function facilityFor(p, dest) {
  // BurgerPrints "(US Label)" sürümleri: kargo etiketini pazar yeri verir, tablodaki $0,50-1 yalnız etiket işleme ücreti -> karşılaştırılamaz
  if (p.providerId === 'burgerprints' && /\b(US|UK|EU) Label\b/i.test(p.title || '')) return null;
  const list = p.providerId === 'printify' ? PP[String(p.id).replace(/^printify-/, '')] : FAC[p.id] && FAC[p.id].map(r => [null, ...r]);
  if (!list) return null;
  let best = null;
  for (const [, name, cc, price, ship] of list) {
    const origin = ccOrigin(cc), sh = ship[dest];
    if (!origin || !Number.isFinite(sh)) continue;
    const d = dutyTo(p, origin, dest);
    if (d.rate == null) continue;
    const total = Math.round(price * (1 + d.rate / 100)) + d.flatMinor + sh;
    if (!best || total < best.total) best = { total, name, origin, price, sh, d };
  }
  return best;
}

// Interestprint / ArtsAdd / Printdoors: ürün başına kargo yöntemleri (scripts/shipping-estimate.cjs, shipping-printdoors.cjs); varışa teslimde en ucuz yöntem
// data/shipping/estimate*.json (her üreticinin çekicisi kendi dosyasına yazar)
const EST = Object.assign({}, ...fs.readdirSync(path.join(root, 'data/shipping')).filter(f => /^estimate.*\.json$/.test(f)).map(f => readJson('data/shipping/' + f)?.products || {}));
function estimateMethod(p, dest) {
  const rows = EST[p.id]?.[dest];
  if (!rows) return null;
  let best = null;
  // üründe açık çıkış işareti (katalog ülkesi, adında "(AU)", "Made in USA"...) varsa o; yoksa yöntemin tesisi
  const own = originOf(p), fixed = own.how === 'catalog' || own.how === 'title' ? own.origin : null;
  for (const [method, sh, mOrigin] of rows) {
    const origin = fixed || mOrigin, d = dutyTo(p, origin, dest);
    if (d.rate == null) continue;
    const total = Math.round(p.baseMinor * (1 + d.rate / 100)) + d.flatMinor + sh;
    if (!best || total < best.total) best = { total, method, origin, sh, d };
  }
  return best;
}

function landed(p, dest) {
  const e = estimateMethod(p, dest);
  if (e) return { origin: e.origin, originHow: 'method', facility: e.method || null, baseMinor: p.baseMinor, shipMinor: e.sh, shipSrc: 'product', dutyRate: e.d.rate, dutyFlatMinor: e.d.flatMinor, dutyNote: e.d.note };
  {
    const f = facilityFor(p, dest);
    if (f) return { origin: f.origin, originHow: 'facility', facility: f.name, baseMinor: f.price, shipMinor: f.sh, shipSrc: 'facility', dutyRate: f.d.rate, dutyFlatMinor: f.d.flatMinor, dutyNote: f.d.note };
  }
  const o = dest === 'US' ? originOf(p) : originFor(p, dest), s = shipTo(p, o.origin, dest), d = dutyTo(p, o.origin, dest);
  return { origin: o.origin, originHow: o.how, baseMinor: p.baseMinor, shipMinor: s.minor, shipSrc: s.src, dutyRate: d.rate, dutyFlatMinor: d.flatMinor, dutyNote: d.note };
}
const landedUS = p => landed(p, 'US');

module.exports = { landed, landedUS, originOf, shipTo, shipUS, dutyUS, dutyTo, HTS, EXTRA, DESTS, EU_FLAT_MINOR };
