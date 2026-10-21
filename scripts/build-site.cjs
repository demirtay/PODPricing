// POD Pricing herkese açık site üreticisi: data/catalog.json -> site/
// Akakçe/Cimri mantığı: aynı ürünü satan üreticiler tek "ürün karşılaştırma" sayfasında ucuzdan pahalıya.
// İngilizce (kök) ve Türkçe (/tr/). Tekil ürün sayfaları yalnızca İngilizce.
// Kullanım: node scripts/build-site.cjs
'use strict';
const fs = require('node:fs'), path = require('node:path');
const tx = require('./pod-taxonomy.cjs');
const EN = require('./pod-taxonomy-en.cjs');
const PB = require('./print-basis.cjs');
const I18N = require('./i18n-data.cjs');
const PG = require('./product-groups.cjs');
const EM = require('./etsy-map.cjs');

const root = path.resolve(__dirname, '..');
const finalOut = path.join(root, 'site');
const out = path.join(root, 'site.__build'); // derleme bitince site/ ile yer değiştirir
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'site.config.json'), 'utf8'));
const SITE = (cfg.siteUrl || '').replace(/\/$/, '');
const BRAND = cfg.siteName || 'POD Pricing';
// tasarım dosyası değişince tarayıcılar eskisini kullanmasın diye sürüm etiketi
const VER = require('node:crypto').createHash('md5').update(fs.readFileSync(path.join(root, 'web/site.css'))).update(fs.readFileSync(path.join(root, 'web/site.js'))).digest('hex').slice(0, 8);

// ---------- yardımcılar
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const decode = s => String(s ?? '').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").trim();
function write(rel, text) { const f = path.join(out, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); }
const href = rel => '/' + rel.replace(/index\.html$/, '');
const abs = rel => SITE + href(rel);
const groupBy = (arr, key) => { const m = new Map(); for (const x of arr) { const k = key(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };
function mostCommon(a) { const c = {}; for (const x of a) c[x] = (c[x] || 0) + 1; return Object.entries(c).sort((x, y) => y[1] - x[1])[0][0]; }

// üreticiye giden bağlantı: affiliate ayarı varsa onun üzerinden
function affiliateUrl(providerId, url) {
  const a = cfg.affiliate?.[providerId];
  if (!a) return url;
  if (a.template) return a.template.replace('{url}', encodeURIComponent(url));
  // yolun sonuna ek (Printful: /custom/product/938/a/KOD)
  if (a.pathSuffix) { const u = new URL(url); u.pathname = u.pathname.replace(/\/$/, '') + a.pathSuffix; return u.toString(); }
  if (a.param) { const u = new URL(url); u.searchParams.set(a.param, a.value); return u.toString(); }
  // birden çok parametre (Contrado: utm_source=KOD&utm_medium=Affiliate)
  if (a.params) { const u = new URL(url); for (const [k, v] of Object.entries(a.params)) u.searchParams.set(k, v); return u.toString(); }
  // kodlanmadan eklenen sorgu (Yoycol shareCode'u adresten ham okuyor; %2F/%3D bozar)
  if (a.rawQuery) { const u = new URL(url); u.search = ''; return u.toString() + '?' + a.rawQuery; }
  return url;
}
// tıklama sayacı: dış bağlantıların alan adları; her biri için /go/<alan>/ ara sayfası üretilir (site.js tıklamayı oradan geçirir)
const goHosts = new Set();
const reg = u => { try { goHosts.add(new URL(u).hostname); } catch (e) { } return u; };
const outbound = p => reg(affiliateUrl(p.providerId, p.sourceUrl));
// üretici ana sayfası bağlantısı (affiliate olanlarda rel="sponsored")
// "home": yalnızca ana sayfa bağlantısının yerine geçen kayıt linki (Teelaunch: signup?ref=KOD)
const homeLink = (p, text) => `<a class="go" href="${esc(reg(cfg.affiliate?.[p.id]?.home || affiliateUrl(p.id, p.homepage)))}" target="_blank" rel="nofollow${cfg.affiliate?.[p.id] ? ' sponsored' : ''} noopener">${text}</a>`;

// ---------- veriyi hazırla
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8'));
const providers = new Map(catalog.providers.map(p => [p.id, p]));
const products = catalog.products
  .filter(p => Number.isSafeInteger(p.baseMinor) && p.baseMinor > 0 && p.sourceUrl)
  .map(p => {
    const c = tx.classify(p), m = tx.detectModel(p);
    const q = { ...p, title: decode(p.title), type: c.type, group: c.group, etsy: EM.etsyOf(p, c) || 'other', model: m && m.key ? m : null, pb: PB.printBasis(p) };
    q.gkey = PG.groupKey(q);
    return q;
  })
  .sort((a, b) => a.baseMinor - b.baseMinor);
const isBlank = p => p.pb === 'bos' || p.pb === 'toplu';
const typeGroup = id => id === 'diger' ? 'diger' : tx.TYPE_BY_ID.get(id)?.group || 'diger';
const byType = groupBy(products, p => p.type);
const byGroup = groupBy(products, p => p.group);
const byProvider = groupBy(products, p => p.providerId);
const connected = catalog.providers.filter(p => byProvider.has(p.id));
const lastCheck = products.reduce((a, p) => (p.checkedAt || '') > a ? p.checkedAt : a, '');
const provName = id => providers.get(id)?.name || id;

// Görseli güvenilir üreticiler: kategori/ürün kapak görseli seçerken öncelikli
const GOOD_IMG = ['printify', 'printful', 'gearment', 'dreamship', 'merchize', 'burgerprints', 'simpleprint', 'yoycol', 'prodigi', 'contrado'];
function repImage(list) {
  const withImg = list.filter(p => p.imageUrl);
  for (const id of GOOD_IMG) { const p = withImg.find(x => x.providerId === id); if (p) return p.imageUrl; }
  return withImg[Math.floor(withImg.length / 3)]?.imageUrl || null;
}

// Ürün grupları (karşılaştırma sayfaları): en az iki üreticide bulunan aynı ürün
const groups = [...groupBy(products.filter(p => p.gkey), p => p.gkey)]
  .map(([key, list]) => ({ key, list, providers: new Set(list.map(p => p.providerId)), type: mostCommon(list.map(p => p.type)), sample: list.find(p => p.model) || list[0] }))
  .filter(g => g.providers.size >= 2)
  .map(g => {
    // "en ucuz" fiyat baskılı tekliflerden; hiç baskılı teklif yoksa boş ürün fiyatı
    const pool = g.list.filter(p => !isBlank(p)).length ? g.list.filter(p => !isBlank(p)) : g.list;
    const bestPer = [...groupBy(pool, p => p.providerId)].map(([, l]) => l[0]);
    return { ...g, slug: PG.slugOf(g.key, t => (EN.TYPES[t] || ['', t])[1]), image: repImage(g.list), lo: pool[0], hi: bestPer.reduce((a, p) => p.baseMinor > a.baseMinor ? p : a, pool[0]) };
  })
  .sort((a, b) => b.providers.size - a.providers.size || b.list.length - a.list.length);
const groupOf = new Map();
for (const g of groups) for (const p of g.list) groupOf.set(p.id, g);
// karşılaştırmadaki ürünler: kargo çekicileri (scripts/shipping-*.cjs) önce bunları tarar
fs.writeFileSync(path.join(root, 'data/compare-ids.json'), JSON.stringify([...groupOf.keys()].sort()));
// grupların günlük en ucuz fiyat geçmişi (scripts/group-history.cjs): bugünün kaydı her derlemede yazılır, sayfada grafik olur
const GH = require('./group-history.cjs');
const DDP = require('./ddp-page.cjs');
const LC = require('./landed-cost.cjs');
// kâr sayfalarındaki örnek Etsy satış fiyatı (ABD $); kullanıcı hesaplayıcıda kendi fiyatını yazar
const SAMPLE_PRICE = { 'giyim-tisort': 24.99, 'giyim-uzun-kollu': 29.99, 'giyim-atlet': 24.99, 'giyim-raglan': 29.99, 'giyim-crop': 24.99, 'giyim-forma': 24.99, 'giyim-polo': 32.99,
  'giyim-kapusonlu': 44.99, 'giyim-fermuarli-kapusonlu': 49.99, 'giyim-sweatshirt': 39.99, 'cocuk-giyim': 21.99, 'bebek-body': 21.99,
  'mutfak-kupa': 18.99, 'mutfak-termos': 29.99, 'mutfak-bardak': 22.99, 'mutfak-matara': 27.99, 'duvar-poster': 19.99, 'duvar-kanvas': 39.99, 'duvar-cerceveli': 44.99,
  'ev-battaniye': 54.99, 'ev-yastik': 29.99, 'canta-bez': 29.99, 'aksesuar-sapka': 27.99, 'aksesuar-bere': 24.99, 'teknoloji-telefon-kilifi': 24.99, 'kirtasiye-sticker': 6.99 };
// ABD'deki alıcıya teslim maliyeti (kuruş): ürün + ABD kargosu + gümrük vergisi; ikisinden biri bilinmiyorsa null
const deliveredUS = p => { const lc = LC.landedUS(p); return lc.shipMinor != null && lc.dutyRate != null ? Math.round(lc.baseMinor * (1 + lc.dutyRate / 100) + lc.shipMinor) : null; };
// kâr sayfası olan karşılaştırmalar: en az 3 üreticinin ABD teslim maliyeti biliniyor (profitGroups ile aynı koşul)
const hasProfit = g => [...groupBy(g.list.filter(p => !isBlank(p)), p => p.providerId)].filter(([, l]) => l.some(p => deliveredUS(p) != null)).length >= 3;
const gHist = GH.upsert(GH.load(), new Date().toISOString().slice(0, 10), Object.fromEntries(groups.map(g => [g.slug, g.lo.baseMinor])));
GH.save(gHist);
const groupsByType = groupBy(groups, g => g.type);

// Etsy kategori ağacı (18 Eki 2026): kategori sayfaları Etsy düğümlerinden (scripts/etsy-map.cjs), yalnızca ürünü olan düğümler.
// Önceki başlık-regex türleri (pod-taxonomy) karşılaştırma grupları ve rehberler için duruyor.
const OTHER = { id: 'other', label: 'Other', labelTr: 'Diğer', parentId: null, depth: 0, path: ['Other'] };
const enode = id => id === 'other' ? OTHER : EM.nodes.get(id);
const eList = new Map(), eKids = new Map(); // düğüm -> alt ağacındaki ürünler (ucuzdan pahalıya) / ürünü olan alt düğümler
for (const p of products) {
  for (let id = p.etsy, prev = null; id; prev = id, id = enode(id).parentId) {
    if (!eList.has(id)) { eList.set(id, []); eKids.set(id, new Set()); }
    eList.get(id).push(p);
    if (prev) eKids.get(id).add(prev);
  }
}
const eCount = id => eList.get(id).length;
const eTops = [...eList.keys()].filter(id => !enode(id).parentId).sort((a, b) => (a === 'other') - (b === 'other') || eCount(b) - eCount(a));
const eChildren = id => [...eKids.get(id)].sort((a, b) => eCount(b) - eCount(a));
const eAnc = id => { const a = []; for (let x = enode(id).parentId; x; x = enode(x).parentId) a.unshift(x); return a; };
// adres: Etsy adı; aynı ad birden çok dalda varsa ayırt eden üst kategori önde (womens-clothing-t-shirts)
const slugify = s => s.toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const eSlug = new Map();
for (const [s, ids] of groupBy([...eList.keys()], id => slugify(enode(id).label))) {
  if (ids.length === 1) { eSlug.set(ids[0], s); continue; }
  const cand = id => eAnc(id).filter(a => enode(a).depth >= 1).concat(eAnc(id).filter(a => enode(a).depth < 1)).map(a => slugify(enode(a).label) + '-' + s);
  for (const id of ids) {
    const others = new Set(ids.filter(o => o !== id).flatMap(cand));
    eSlug.set(id, cand(id).find(c => !others.has(c)) || eAnc(id).map(a => slugify(enode(a).label)).concat(s).join('-'));
  }
}
if (new Set(eSlug.values()).size !== eSlug.size) throw new Error('Etsy kategori adresleri çakışıyor');
const ETR = (() => { try { return JSON.parse(fs.readFileSync(path.join(root, 'data/etsy-tr.json'), 'utf8')); } catch { return {}; } })();
// İngilizce etiketin aranan yazımı (Etsy 'Mousepads' der, aramalar 'mouse pad'); URL slug'ı ham etiketten gelir, değişmez
const ENL = { Mousepads: 'Mouse Pads' };
const eLabel = (id, lg) => { const n = enode(id); return lg === 'tr' ? (ETR[n.label] || (n.labelTr && n.labelTr !== n.label ? n.labelTr : n.label)) : (ENL[n.label] || n.label); };
// eski tür sayfası / karşılaştırma grubu -> en çok ürününün düştüğü Etsy düğümü
const typeNode = new Map([...byType].map(([k, l]) => [k, mostCommon(l.map(p => p.etsy))]));
for (const g of groups) g.etsy = mostCommon(g.list.map(p => p.etsy));
const eGroups = new Map(); // düğüm -> alt ağacında ürünü olan karşılaştırma grupları
for (const g of groups) {
  const seen = new Set();
  for (const p of g.list) for (let id = p.etsy; id && !seen.has(id); id = enode(id).parentId) { seen.add(id); if (!eGroups.has(id)) eGroups.set(id, []); eGroups.get(id).push(g); }
}

// Üretici ikilisi karşılaştırmaları ("Printful vs Printify") ve rehberler: yalnızca baskısı kesin dahil (pb=dahil) teklifler
const bestByGroup = new Map(groups.map(g => {
  const m = new Map();
  for (const p of g.list) if (p.pb === 'dahil' && (!m.has(p.providerId) || m.get(p.providerId).baseMinor > p.baseMinor)) m.set(p.providerId, p);
  return [g.key, m];
}));
const vsPairs = (() => {
  const pairs = new Map();
  for (const g of groups) {
    const m = bestByGroup.get(g.key), ids = [...m.keys()].sort((x, y) => provName(x).localeCompare(provName(y), 'en', { sensitivity: 'base' }));
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const k = ids[i] + '|' + ids[j];
      if (!pairs.has(k)) pairs.set(k, []);
      pairs.get(k).push({ g, a: m.get(ids[i]), b: m.get(ids[j]) });
    }
  }
  return [...pairs].filter(([, rows]) => rows.length >= 5).map(([k, rows]) => {
    const [a, b] = k.split('|');
    rows.sort((x, y) => y.g.providers.size - x.g.providers.size || x.a.baseMinor - y.a.baseMinor);
    const sumA = rows.reduce((s, r) => s + r.a.baseMinor, 0), sumB = rows.reduce((s, r) => s + r.b.baseMinor, 0);
    return { a, b, slug: `${a}-vs-${b}`, rows, aWins: rows.filter(r => r.a.baseMinor < r.b.baseMinor).length, bWins: rows.filter(r => r.b.baseMinor < r.a.baseMinor).length, sumA, sumB };
  }).sort((x, y) => y.rows.length - x.rows.length);
})();
// ikili karşılaştırmayı ürün tipine böl: tip başına ürün sayısı, kazanılan ürün, toplam fiyat (en az 3 ürünlü tipler)
const vsByType = v => [...groupBy(v.rows.filter(r => r.g.type && r.g.type !== 'diger'), r => r.g.type)].filter(([, l]) => l.length >= 3)
  .map(([type, l]) => ({ type, n: l.length, aWins: l.filter(r => r.a.baseMinor < r.b.baseMinor).length, bWins: l.filter(r => r.b.baseMinor < r.a.baseMinor).length, sumA: l.reduce((x, r) => x + r.a.baseMinor, 0), sumB: l.reduce((x, r) => x + r.b.baseMinor, 0) }))
  .sort((x, y) => y.n - x.n);
const vsOf = new Map();
for (const v of vsPairs) for (const id of [v.a, v.b]) { if (!vsOf.has(id)) vsOf.set(id, []); vsOf.get(id).push(v); }

// "En ucuz ... " rehberleri: ürün tipi başına hangi üretici kaç üründe en ucuz, ortalamaya göre ne kadar ucuz
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : 0; };
const mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const guideTypes = [...groupsByType].filter(([t, l]) => t !== 'diger' && l.length >= 5).sort((a, b) => b[1].length - a[1].length).slice(0, 40).map(([t]) => t);
const guides = new Map(guideTypes.map(t => {
  const rows = [], wins = new Map(), ratio = new Map();
  for (const g of groupsByType.get(t)) {
    const offers = [...bestByGroup.get(g.key).values()].sort((a, b) => a.baseMinor - b.baseMinor);
    if (offers.length < 2) continue;
    const med = median(offers.map(o => o.baseMinor));
    wins.set(offers[0].providerId, (wins.get(offers[0].providerId) || 0) + 1);
    for (const o of offers) { if (!ratio.has(o.providerId)) ratio.set(o.providerId, []); ratio.get(o.providerId).push(o.baseMinor / med); }
    rows.push({ g, offers, med });
  }
  rows.sort((a, b) => b.offers.length - a.offers.length);
  const suppliers = [...ratio].filter(([, r]) => r.length >= Math.min(3, rows.length)).map(([id, r]) => ({ id, n: r.length, wins: wins.get(id) || 0, index: mean(r) })).sort((a, b) => a.index - b.index);
  const pf = rows.filter(r => r.offers.some(o => o.providerId === 'printful') && r.offers.some(o => o.providerId === 'printify'))
    .map(r => r.offers.find(o => o.providerId === 'printful').baseMinor - r.offers.find(o => o.providerId === 'printify').baseMinor);
  return [t, { rows, suppliers, med: median(rows.map(r => r.med)), lo: rows.reduce((a, r) => !a || r.offers[0].baseMinor < a.baseMinor ? r.offers[0] : a, null), pf: { n: pf.length, printful: pf.filter(d => d < 0).length, printify: pf.filter(d => d > 0).length } }];
  // en az 3 ürün grubunda görünen üretici yoksa rehber sayfası anlamsız (ve başlık hesabı yapılamaz)
}).filter(([, s]) => s.rows.length >= 3 && s.suppliers.length));
// "X alternatifleri": büyük üreticiler için aynı ürünlerde daha ucuz olan rakipler
const altProviders = [...vsOf].filter(([, l]) => l.length >= 5).sort((a, b) => b[1].length - a[1].length).slice(0, 15).map(([id]) => id);
const altOf = id => vsOf.get(id).map(v => {
  const mine = v.a === id ? v.sumA : v.sumB, theirs = v.a === id ? v.sumB : v.sumA, other = v.a === id ? v.b : v.a;
  return { other, v, n: v.rows.length, cheaperOn: v.a === id ? v.bWins : v.aWins, pct: Math.round((mine - theirs) / mine * 100) };
}).sort((a, b) => b.pct - a.pct || b.n - a.n);

// POD fiyat endeksi: en az 3 üreticinin baskı dahil sattığı bütün ürünlerde üretici endeksi, popüler boş ürünler, tip başına tipik fiyat.
// Her derlemede günlük anlık görüntü data/price-history.json'a yazılır; "değişim" sütunları buradan hesaplanır.
// Üreticilerin kendi çok satan listeleri (scripts/bestsellers.cjs -> data/bestsellers.json): ana sayfada üretici üretici vitrin.
// Ürün katalogdaki ürüne bağlanır; aynı ürün başka sitelerde daha ucuzsa kartta yazar.
const BS_ORDER = ['printful', 'printify', 'merchize', 'yoycol'];
const bestsellers = (() => {
  let raw = {};
  try { raw = JSON.parse(fs.readFileSync(path.join(root, 'data/bestsellers.json'), 'utf8')); } catch { return []; }
  const nt = x => String(x).toLowerCase().replace(/[®™]/g, '').replace(/[’']/g, "'").replace(/[^a-z0-9']+/g, ' ').trim();
  return Object.keys(raw).sort((a, b) => (BS_ORDER.indexOf(a) + 1 || 99) - (BS_ORDER.indexOf(b) + 1 || 99)).map(id => {
    const b = raw[id], list = byProvider.get(id) || [], seen = new Set(), items = [];
    for (const k of b.keys) {
      const p = b.match === 'title' ? list.find(x => nt(x.title) === nt(k)) : list.find(x => String(x.sourceProductId) === String(k));
      if (!p || seen.has(p.id)) continue;
      seen.add(p.id); items.push(p);
      if (items.length >= 12) break;
    }
    return { id, checkedOn: b.checkedOn, items };
  }).filter(x => x.items.length >= 4);
})();

const pidx = (() => {
  const ratio = new Map(), wins = new Map(), gaps = [], rows = [];
  for (const g of groups) {
    const offers = [...bestByGroup.get(g.key).values()].sort((a, b) => a.baseMinor - b.baseMinor);
    if (offers.length < 3) continue;
    const med = median(offers.map(o => o.baseMinor));
    rows.push({ g, offers, med });
    gaps.push(offers[offers.length - 1].baseMinor / offers[0].baseMinor - 1);
    wins.set(offers[0].providerId, (wins.get(offers[0].providerId) || 0) + 1);
    for (const o of offers) { if (!ratio.has(o.providerId)) ratio.set(o.providerId, []); ratio.get(o.providerId).push(o.baseMinor / med); }
  }
  const minN = 20;
  const suppliers = [...ratio].filter(([, r]) => r.length >= minN).map(([id, r]) => ({ id, n: r.length, wins: wins.get(id) || 0, index: mean(r) })).sort((a, b) => a.index - b.index || b.n - a.n);
  const models = rows.filter(r => r.g.sample.model).sort((a, b) => b.offers.length - a.offers.length).slice(0, 40);
  const today = new Date().toISOString().slice(0, 10);
  const histFile = path.join(root, 'data/price-history.json');
  let hist = [];
  try { hist = JSON.parse(fs.readFileSync(histFile, 'utf8')); } catch { /* ilk kayıt */ }
  hist = hist.filter(h => h.date !== today).concat({ date: today, suppliers: Object.fromEntries(suppliers.map(s => [s.id, +s.index.toFixed(4)])), models: Object.fromEntries(models.map(m => [m.g.slug, m.med])) })
    .sort((a, b) => a.date.localeCompare(b.date)).slice(-400);
  fs.writeFileSync(histFile, JSON.stringify(hist));
  // karşılaştırma noktası: ~30 gün önceki kayıt; yoksa en az 7 gün önceki en eski kayıt
  const daysAgo = d => new Date(Date.parse(today) - d * 864e5).toISOString().slice(0, 10);
  const past = hist.filter(h => h.date <= daysAgo(30)).pop() || hist.find(h => h.date <= daysAgo(7)) || null;
  return { rows, suppliers, models, minN, gap: median(gaps), past, since: hist[0].date };
})();

// Yorumlar (Supabase; içerik tarayıcıda site.js ile yüklenir): üretici sayfalarında yıldızlı, karşılaştırma sayfalarında yıldızsız
const rvOk = thread => cfg.reviews && /^(maker|group):[a-z0-9-]{1,80}$/.test(thread);
const rvBox = (thread, name, rate) => rvOk(thread) ? `<section class="rv" data-thread="${thread}" data-name="${esc(name)}" data-url="${esc(cfg.reviews.url)}" data-key="${esc(cfg.reviews.key)}"${rate ? ' data-rate="1"' : ''}></section>` : '';
const rvSum = thread => rvOk(thread) ? `<p class="rv-sum" data-thread="${thread}"></p>` : '';

// Haftalık fiyat raporları (scripts/weekly-report.cjs), en yenisi önde
const reports = (() => {
  const dir = path.join(root, 'data/reports');
  try { return fs.readdirSync(dir).filter(f => /^\d{4}-\d\d-\d\d\.json$/.test(f)).sort().reverse().map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))); } catch { return []; }
})();
const groupSlugs = new Set(groups.map(g => g.slug));

// Bağlanamayan üreticilerin gerekçeleri (katalogda Türkçe tutulur)
const REASON_EN = {
  'Site otomatik erişimi engelliyor (bot koruması); güncel fiyatlar üreticinin sitesinde': 'The site blocks automated access; see current prices on the manufacturer site',
  'Fiyatlar üye girişi veya uygulama içinde gösteriliyor': 'Prices are shown only after login or inside the app',
  'Site şu an erişilemiyor (kapanmış veya taşınmış olabilir)': 'The site is currently unreachable (it may have closed or moved)',
  'Fiyatlar sayfada tarayıcıda oluşturuluyor; yalnızca birkaç ürün': 'Prices are rendered in the browser; only a few products',
  'Açık mağaza kataloğu boş': 'The public store catalog is empty',
  'Fiyatlar adet kademeli; tek ürün fiyatı doğrulanmadı': 'Quantity-tiered prices; single-item price not verified',
  'Resmi site erişimi reddediyor; uygun veri erişimi gerekli': 'The site refuses automated access',
  'Site istek sınırı uyguluyor; yeniden deneme gerekli': 'The site rate-limits requests; retry pending',
  'Fiyatlar etkileşimli hesaplayıcıda; fiyat tablosu yayınlanmıyor': 'Prices are only in an interactive calculator; no published price list',
  'Toplu baskı firması; fiyatlar adet kademeli ve teklif bazlı': 'Bulk printer; quantity-tiered, quote-based prices',
  'Toplu promosyon ürünleri; minimum adetli': 'Bulk promotional products with minimum quantities',
  'Tasarım pazaryeri; üretim maliyeti değil perakende fiyat gösteriyor': 'Design marketplace showing retail prices, not production costs',
  'Açık katalogda bütün fiyatlar 0,00; gerçek fiyat doğrulanamıyor': 'All public catalog prices show 0.00; real prices cannot be verified',
  'Katalog sayfası fiyatları güvenilir biçimde göstermiyor': 'The catalog page does not show prices reliably',
  'Açık katalog yalnızca kategori tanıtım kayıtları içeriyor': 'The public catalog only lists category promo entries',
  'Açık katalogda yalnızca birkaç kayıt var': 'Only a few entries in the public catalog',
  'Fiyatlar herkese açık sayfalarda yayınlanmıyor (üye girişi veya teklif ile)': 'Prices are not published publicly (login or quote required)',
  'Tek ürün fiyatı sayfada hesaplanıyor; yalnızca toplu alım fiyatı görünüyor': 'Single-item price is only calculated in the designer; only bulk prices are shown',
  'Yayınlanan fiyatlar eski başlangıç fiyatı; nihai fiyat adede göre belirleniyor': 'Published prices are outdated start-up prices; final price depends on volume',
  'Açık sitede perakende mağaza fiyatları var; üretim maliyeti üye panelinde': 'The public site shows retail store prices; production costs are in the member dashboard',
  'Fiyatlar yalnızca örnek aralıklar; ürün bazlı fiyat yayınlanmıyor': 'Only illustrative price ranges are published, not per-product prices',
  'Katalog sayfasında yalnızca şablon fiyatlar var; gerçek fiyat doğrulanamıyor': 'The catalog page only shows placeholder prices; real prices cannot be verified',
};
const reasonOf = (p, L) => { const r = p.connection?.blockedReason; if (!r || /henüz tamamlanmadı/.test(r)) return L.notAdded; return L.lang === 'en' ? (REASON_EN[r] || L.notAdded) : r; };

// ---------- dil sözlükleri ve adresler
const QUICK = ['t-shirt', 'hoodie', 'mug', 'tumbler', 'poster', 'canvas', 'tote bag', 'phone case', 'hat', 'blanket'];
const LOCALES = {
  en: {
    lang: 'en', intl: 'en-US',
    path: { home: '', categories: 'categories/', cat: id => `category/${eSlug.get(id)}/`, oldCat: id => `category/${id === 'diger' ? EN.TYPES.diger[1] : (EN.TYPES[id] || EN.GROUPS[id])[1]}/`, compare: 'compare/', group: s => `compare/${s}/`,
      makers: 'manufacturers/', maker: id => `manufacturer/${id}/`, product: id => `product/${id}/`, search: 'search/', about: 'about/', privacy: 'privacy/', contact: 'contact/',
      vsIndex: 'vs/', vs: s => `vs/${s}/`, calc: 'profit-calculator/', profitIndex: 'profit/', profit: s => `profit/${s}/`,
      guides: 'cheapest/', guide: t => `cheapest/${(EN.TYPES[t] || ['', t])[1]}/`, alts: 'alternatives/', alt: id => `alternatives/${id}/`, widget: 'price-widget/', index: 'price-index/' },
    type: id => (EN.TYPES[id] || ['Other Products'])[0], group: g => (EN.GROUPS[g] || ['Other'])[0], node: id => eLabel(id, 'en'),
    pbLabel: PB.LABEL_EN, pbNote: PB.NOTE_EN, basis: I18N.basisEn, sizes: I18N.sizesEn, production: I18N.productionEn, method: I18N.methodEn,
    notAdded: 'Prices not added yet', quick: QUICK,
    t: {
      home: 'Home', categories: 'Categories', compare: 'Compare', makers: 'Manufacturers', search: 'Search', searchBtn: 'Search',
      searchPh: 'Search products or blanks (e.g. 11oz mug, gildan 5000, hoodie)', searchBig: 'What do you want to print?',
      heroH: 'POD Pricing: Compare Print-on-Demand Prices',
      heroP: (m, n) => `Compare ${n} products from ${m} POD manufacturers — cheapest first. For Etsy, Amazon, Shopify, TikTok Shop and eBay sellers.`,
      topGroups: 'Most compared products', bs: { h: n => `${n} bestsellers`, at: n => `at ${n}`, sites: n => `Sold at ${n} stores`, cheaper: (v, m) => `from ${v} at ${m}`, src: (n, d) => `From ${n}'s own bestseller list · updated ${d}` }, seeAll: 'See all', catsH: 'Shop by category', allCats: 'All categories',
      vs: {
        typeH: (a, b) => `${a} or ${b}: which is cheaper by product type?`, tth: ['Product type', 'Products', 'Cheaper overall'], typeWin: (x, p) => p < 3 ? 'about the same' : `${x}, ${p}% less`, faqH: 'Questions',
        q1: (a, b) => `Is ${a} cheaper than ${b}?`, a1: (w, tot, a, an, b, bn, n) => `${w}. ${tot} ${a} is cheaper on ${an} and ${b} on ${bn} of the ${n} products.`,
        qT: (a, b, l) => `Is ${a} or ${b} cheaper for ${l.toLowerCase()}?`, aT: (l, n, x, p, a, an, b, bn) => `On the ${n} ${l.toLowerCase()} both sell, ${p < 3 ? 'they cost about the same overall' : `${x} is cheaper overall (about ${p}% less)`}: ${a} is cheaper on ${an}, ${b} on ${bn}.`,
        nav: 'X vs Y', indexTitle: 'Print-on-demand manufacturer comparisons', indexDesc: n => `${n} head-to-head price comparisons between print-on-demand manufacturers, based on products both of them sell.`,
        indexIntro: 'Each comparison only uses products that both manufacturers sell (same blank model or same product type and size), with the cheapest print-included price of each.',
        title: (a, b, m) => `${a} vs ${b} prices (${m}): which is cheaper?`, desc: (a, b, n, w) => `${a} vs ${b} on ${n} identical products: ${w}. Updated twice a day from public catalogs.`,
        h1: (a, b) => `${a} vs ${b}`, sub: 'Price comparison on products both manufacturers sell',
        verdictA: (a, b, pct) => `${a} is cheaper overall, about ${pct}% less than ${b} on the same products`,
        verdictTie: (a, b) => `${a} and ${b} cost about the same overall`,
        wins: (x, n, total) => `${x} is cheaper on ${n} of ${total} products`,
        totals: (n, a, va, b, vb) => `Buying one of each of the ${n} shared products costs ${va} at ${a} and ${vb} at ${b}.`,
        th: ['Product', 'Difference'], same: 'same', cheaper: 'cheaper', products: 'products', lowest: 'Lowest price', basis: 'Price type',
        others: 'More comparisons', makerH: n => `Compare ${n} with other manufacturers`, shared: n => `${n} shared products`,
        note: 'Prices are the cheapest print-included offer of each manufacturer for that product, before shipping and tax. Print area, quality and shipping can differ — check the store before ordering.',
      },
      widget: {
        title: 'Free price widget for your blog', desc: 'Embed a live print-on-demand price table on your blog or website. Free, updated twice a day.', embedLink: 'Embed this price table on your site →',
        intro: 'Writing about print-on-demand? Add a live price table for any product to your blog post. It updates automatically twice a day and is free to use.',
        pick: 'Choose a product', code: 'Copy this code into your page', copy: 'Copy code', copied: 'Copied!', preview: 'Preview',
        note: 'Keep the link under the table — it credits the data source. The table shows the cheapest offer of each supplier, print-included offers first.',
      },
      guide: {
        indexTitle: 'Cheapest print-on-demand suppliers by product', indexDesc: 'Which print-on-demand supplier is cheapest for t-shirts, hoodies, mugs, posters and more — updated twice a day from supplier catalogs.',
        title: (l, m) => `Cheapest print-on-demand ${l.toLowerCase()} (${m})`, desc: (l, s, v, n) => `${s} is the cheapest print-on-demand supplier for ${l.toLowerCase()} on average. Lowest price ${v}; ${n} products compared across suppliers, updated twice a day.`,
        h1: (l, m) => `Cheapest print-on-demand ${l.toLowerCase()}`, upd: m => `Updated ${m} · prices refresh twice a day`,
        lead: (l, n, s, w, v, med) => `We compared ${n} ${l.toLowerCase()} that several print-on-demand suppliers sell (same blank or same size). ${s} is the cheapest on average, about ${w}% below the typical price for the same product. The lowest print-included price we found is ${v}; a typical (median) price is ${med}.`,
        rankH: 'Cheapest suppliers on average', rankP: 'Price index: 100 = the typical price for the same product. Lower is cheaper. Only suppliers with at least 3 comparable products are listed.',
        rth: ['Supplier', 'Price index', 'Cheapest on', 'Products compared'], vsMed: p => p <= 0 ? `${-p}% below typical` : `${p}% above typical`,
        topH: l => `Most compared ${l.toLowerCase()}`, tth: ['Product', 'Suppliers', 'Cheapest', 'Typical price'],
        faqH: 'Questions', q1: l => `What is the cheapest print-on-demand supplier for ${l.toLowerCase()}?`,
        a1: (l, s, w, n, s2) => `Across ${n} comparable ${l.toLowerCase()}, ${s} is the cheapest on average (about ${w}% below the typical price)${s2 ? `, followed by ${s2}` : ''}. The cheapest supplier changes by product, so check the product page before ordering.`,
        q2: l => `How much does a print-on-demand ${l.toLowerCase().replace(/s$/, '')} cost?`, a2: (v, med) => `Print-included base costs start at ${v}; the typical price is around ${med}, before shipping and tax.`,
        q3: l => `Is Printful or Printify cheaper for ${l.toLowerCase()}?`, a3: (n, a, b) => `On the ${n} ${n === 1 ? 'product' : 'products'} both sell in this category, Printful is cheaper on ${a} and Printify on ${b}.`,
        more: 'Other guides', calcCta: 'Calculate your profit per sale →', allProducts: l => `All ${l.toLowerCase()} →`,
      },
      alt: {
        titleN: (s, c, m) => `${s} alternatives: ${c} cheaper print-on-demand suppliers (${m})`,
        typeH: s => `Cheapest ${s} alternative by product type`, tth: ['Product type', 'Cheapest alternative', 'vs', 'Products compared'], faqH: 'Questions',
        q1: s => `What is the cheapest alternative to ${s}?`, a1: (s, o, p, n, next) => `${o}: about ${p}% cheaper than ${s} on the ${n} products both sell.${next ? ` Next come ${next}.` : ''}`,
        q2: s => `How many print-on-demand suppliers are cheaper than ${s}?`, a2: (s, n, c, e, m) => `Of the ${n} suppliers we compared with ${s} on identical products, ${c} are cheaper overall, ${e} cost about the same and ${m} are more expensive.`,
        qT: (s, l) => `What is the cheapest ${s} alternative for ${l.toLowerCase()}?`, aT: (s, l, o, p, n) => `${o}, about ${p}% cheaper than ${s} on ${n} comparable ${l.toLowerCase()}.`,
        indexTitle: 'Print-on-demand supplier alternatives', indexDesc: 'Cheaper alternatives to Printful, Printify and other print-on-demand suppliers, based on products they both sell.',
        title: (s, m) => `${s} alternatives: cheaper print-on-demand suppliers (${m})`, desc: (s, n, top) => `${n} print-on-demand suppliers compared with ${s} on identical products. ${top}`,
        h1: s => `${s} alternatives`, lead: (s, n) => `Suppliers compared with ${s} on products both of them sell. Sorted by how much cheaper they are overall on those shared products.`,
        th: ['Supplier', 'Overall vs', 'Cheaper on', 'Shared products'], cheaper: p => `${p}% cheaper`, pricier: p => `${p}% more expensive`, same: 'about the same',
        top: (o, p) => `${o} is ${p}% cheaper on the same products.`, none: s => `No supplier is cheaper than ${s} overall on shared products.`, details: 'details',
      },
      pidx: {
        nav: 'POD Price Index', homeCta: gap => `The same product costs ${gap}% more at the most expensive supplier than at the cheapest. See the POD Price Index →`, title: (m, s) => `POD Price Index (${m}): print-on-demand prices from ${s} suppliers`,
        desc: (m, n, s, gap) => `Print-on-demand price report for ${m}: ${n} products from ${s} suppliers. For the same product, the most expensive supplier typically charges ${gap}% more than the cheapest.`,
        h1: m => `POD Price Index — ${m}`, upd: d => `Data as of ${d} · refreshed twice a day · free to cite`,
        kpi: ['Products tracked', 'Suppliers', 'Products sold by 3+ suppliers', 'Typical price gap'], gapP: 'Median difference between the cheapest and the most expensive supplier for the same product.',
        lead: (n, g, gap, top, w) => `We track ${n} print-on-demand products from public supplier catalogs. ${g} of them are sold by at least three suppliers, which lets us compare like for like. For the same product, the most expensive supplier typically charges ${gap}% more than the cheapest. Across all shared products, ${top} is the cheapest supplier overall, about ${w}% below the typical price.`,
        supH: 'Supplier price ranking', supP: n => `Price index: 100 = the typical (median) price for the same product; lower is cheaper. Each supplier's index is its average over its comparable products. Suppliers with at least ${n} comparable products are listed.`,
        sth: ['Supplier', 'Price index', 'Cheapest on', 'Products compared', 'Change'],
        modH: 'Popular blanks: price range across suppliers', mth: ['Blank', 'Suppliers', 'Lowest', 'Typical', 'Highest', 'Cheapest at', 'Change'],
        typH: 'Typical price by product type', tth: ['Product type', 'Products compared', 'Lowest', 'Typical', 'Cheapest on average'],
        chgNone: d => `The change columns fill in once we have at least a week of daily snapshots (tracking since ${d}).`, chgSince: d => `Change: versus the snapshot of ${d} (index points for suppliers, typical price for blanks).`,
        citeH: 'Using this data', cite: 'You are welcome to quote these numbers in articles, videos and posts. Please credit and link "POD Pricing (podpricing.com)".', csv: ['Supplier ranking (CSV)', 'Blank prices (CSV)'],
        method: 'Method: prices are print-included base costs from each supplier\'s public catalog in USD, before shipping and tax. Products are matched by blank model (e.g. Gildan 5000) or by product type and size. For each product we take each supplier\'s cheapest offer; the typical price is the median across suppliers.',
      },
      profitPages: { nav: 'Profit by product', title: (n, p) => `${n} on Etsy at ${p}: profit by POD supplier (shipping included)`, h1: (n, p) => `How much do you make selling ${n} on Etsy at ${p}?`,
        desc: (n, p, lo, hi, b, k) => `Sell ${n} at ${p} on Etsy to a US buyer and keep ${lo} to ${hi} per sale depending on the supplier; ${b} leaves the most. Real published shipping and import duty for ${k} suppliers.`,
        answer: (p, hi, hn, lo, ln) => `At ${p}, you keep ${hi} per sale with ${hn} and ${lo} with ${ln}.`, basis: (p, f) => `Example Etsy price ${p}, buyer in the US. Etsy fees ${f} (6.5% transaction + 3% + $0.25 payment + $0.20 listing). Cost = product + the supplier's published US shipping + import duty.`,
        th: ['Supplier', 'Your cost', 'Your profit'], from: c => `Ships from ${c}`, parts: (b, s) => `product ${b} + shipping ${s}`, pct: n => `${n}% margin`, go: 'Go to store ↗',
        cta: 'Try your own price in the profit calculator →', note: (n, k) => `${n} suppliers make this product; ${k} publish US shipping rates and are shown above.`, allLink: n => `Compare all ${n} suppliers →`,
        q: (n, p) => `How much profit is there in selling ${n} on Etsy at ${p}?`, a: (p, hi, hn, lo, ln) => `At ${p} to a US buyer, after Etsy fees, product cost, shipping and import duty you keep about ${hi} with ${hn} and ${lo} with ${ln}.`,
        indexTitle: 'Etsy profit by product and POD supplier', indexDesc: k => `What you keep per sale on Etsy for ${k} popular print-on-demand products, supplier by supplier, with real shipping included.` },
      hc: { h: 'What will you earn on each sale?', p: 'Product cost, shipping to your buyer, import duty and marketplace fees, from every manufacturer that makes it. Real published rates, no estimates.', price: 'Your selling price ($)', btn: 'Calculate my profit', note: (a, n) => `Real shipping and duty data for ${a} of ${n} compared products; more manufacturers are added every week.` },
      calc: {
        nav: 'Profit calculator', title: 'Print-on-demand profit calculator', desc: 'Calculate your profit per sale on Etsy, Shopify or Amazon for every print-on-demand manufacturer that sells the product.',
        intro: 'Pick a product and your price. See what you keep with each manufacturer after shipping, import duty and marketplace fees.',
        product: 'Product', price: 'Your selling price ($)', shipIn: 'Shipping you charge the customer ($)', adv: 'Advanced', platform: 'Where you sell', dest: 'Buyer in', margin: 'Target margin (%)', dests: [['US', 'United States'], ['GB', 'United Kingdom'], ['EU', 'European Union'], ['CA', 'Canada'], ['AU', 'Australia']],
        custom: 'Custom fee', pct: 'Fee %', fixed: 'Fixed fee ($)',
        th: ['Manufacturer', 'Product cost', 'Fees', 'Profit', 'Margin'], pick: 'Choose a product to see results.', loading: 'Loading…',
        fees: 'Fees used: Etsy 6.5% transaction + 3% + $0.25 payment processing + $0.20 listing; Shopify 2.9% + $0.30 (Basic plan, Shopify Payments); Amazon Handmade 15% (min $1). Shipping: only the manufacturer’s own published rate; where none is published we show ‘no data’ and do not calculate profit. US import duty: 0 when the item ships from the US; otherwise the HTS rate for the product type plus the 2026 Section 301 surcharge for the ship-from country (rates checked 20 Oct 2026). UK, Australia: no duty on low-value parcels and VAT/GST is collected from the buyer at checkout. EU: flat €3 per item since 1 July 2026 (none if shipped from inside the EU). Canada: duty-free up to C$150 by courier from the US or Mexico. Duty is estimated on the product cost; it is not legal advice.',
      },
      blankH: 'Blank products (printing charged separately)', blankP: 'These prices are for the unprinted product or bulk orders, so they are listed apart from the print-included offers above.',
      sitesN: n => `Sold at ${n} stores`, cheapest: 'cheapest', catMenu: 'Categories', subAll: n => `All ${n} subcategories →`, itemsH: 'Products',
      makersFrom: (n, v) => `${n} manufacturers · from ${v}`, from: v => `from ${v}`, products: n => `${n} products`, makersN: n => `${n} manufacturers`,
      offersH: n => `Prices from ${n} manufacturers`, bestOf: n => `Cheapest of ${n} manufacturers`, dlv: { best: (m, v, a, n) => `Delivered to a US buyer (shipping + import duty), among the ${a} of ${n} manufacturers that publish shipping: ${m} ≈ ${v}`, row: v => `≈ ${v} delivered to the US`, parts: (s, d) => `shipping ${s} + import duty ${d}%`, more: 'See profit and suggested price →', keep: 'What you keep per Etsy sale →' }, histH: 'Cheapest price history', histFlat: (d, v) => `The cheapest price has stayed at ${v} for the last ${d} days.`, histMove: (lo, ld, hi, now) => `Lowest ${lo} (${ld}), highest ${hi}. Today ${now}.`, histNote: 'Lowest price across all manufacturers each day, print included where listed.', range: (a, b) => `Price range ${a} – ${b}`, cheapestFirst: 'Sorted from cheapest to most expensive.',
      groupNoteModel: 'Same blank garment at every manufacturer. Print method, print area and shipping can differ — check details at the store.',
      groupNoteSpec: 'Same product type and size at every manufacturer. Exact materials and options can differ slightly — check details at the store.',
      allOffersOf: n => `Show all ${n} offers`, groupsInCat: 'Compare prices across manufacturers', allInCat: 'All products',
      compareTitle: 'Compare print-on-demand product prices', compareDesc: n => `${n} print-on-demand products sold by several manufacturers, with prices sorted cheapest first.`,
      compareIntro: 'Each product below is sold by at least two print-on-demand manufacturers. Open one to see every price side by side.',
      groupTitle: (t, n, v) => `${t} price comparison: ${n} print-on-demand suppliers from ${v}`, groupDesc: (t, n, v, m) => `${t}: cheapest ${v} at ${m}. Prices from ${n} print-on-demand manufacturers, sorted cheapest first.`,
      catTitle: (l, n, v) => `${l} price comparison: ${n} print-on-demand suppliers from ${v}`, catDesc: (l, n, v, d) => d ? `Compare ${n} print-on-demand ${l.toLowerCase()} from ${d.n} suppliers. Cheapest ${v} at ${d.loP}; typical starting price ${d.med}. Updated twice a day.` : `${n} print-on-demand ${l.toLowerCase()} compared. Lowest price ${v}.`,
      catH1: l => `${l}: print-on-demand prices`,
      catAbout: (l, d) => `We track ${d.N} print-on-demand ${l.toLowerCase()} from ${d.n} suppliers. The cheapest starts at ${d.lo} at ${d.loP}; the typical supplier's cheapest option is ${d.med}. Prices are base costs from each supplier's public catalog in USD, before shipping and tax, and refresh twice a day.`,
      catFaq: (l, d) => { const x = l.toLowerCase(); return [[`How much do print-on-demand ${x} cost?`, `From ${d.lo} at ${d.loP}. Across the ${d.n} suppliers that sell them printed, the typical cheapest option is ${d.med}; shipping is added at checkout.`], [`Which print-on-demand supplier is cheapest for ${x}?`, `${d.loP} (${d.lo}), followed by ${d.p2}.`], [`How many print-on-demand suppliers sell ${x}?`, `${d.n} of the suppliers we track sell them with printing, out of ${d.N} products in total (blanks included).`]]; }, catFaqH: 'Questions about prices',
      groupPageTitle: l => `${l} print-on-demand prices`, catsTitle: 'All print-on-demand product categories', catsDesc: 'Print-on-demand product categories with the lowest manufacturer price in each.',
      makersTitle: 'Print-on-demand manufacturers', makersDesc: n => `${n} print-on-demand manufacturers: product counts, categories and lowest prices.`,
      makersIntro: (c, r) => `Prices from ${c} manufacturers are compared. ${r} more are listed as links because their prices require login or are not public.`,
      mk: ['Manufacturer', 'Products', 'Lowest', 'Status'], compared: 'Prices compared', visit: 'visit site ↗',
      makerTitle: (n, c, m) => c ? `${n} pricing (${m}): ${c} product base prices` : `${n}: print-on-demand products and pricing`, makerDesc: (n, c, v, tops = []) => c ? `${n} pricing: ${c} print-on-demand products${tops.length ? ' — ' + tops.map(([l, p]) => `${l.toLowerCase()} from ${p}`).join(', ') : `, lowest base price ${v}`}. Compare every ${n} price with other suppliers, updated twice a day.` : `${n} print-on-demand manufacturer. Prices not yet in the comparison.`,
      makerStats: (n, t, v) => `${n} products · ${t} product types · lowest ${v}`, makerTop: 'Cheapest products', noPrices: r => `This manufacturer's prices are not in the comparison: ${r}. Visit the manufacturer site for products and prices.`,
      go: 'Go to store ↗', goAt: m => `Check price at ${m} →`, cta: m => `Check price at ${m} →`, inGroup: (n) => `Sold by ${n} manufacturers — compare all prices`,
      productTitle: (t, m, v) => `${t.toLowerCase().startsWith(m.toLowerCase()) ? t : `${m} ${t}`}: ${v} base price`, productDesc: (m, t, v, l) => `${m} ${t}: ${v}. Compare ${l.toLowerCase()} prices across print-on-demand manufacturers.`,
      sameGroup: 'Same product at other manufacturers', otherMakers: l => `More ${l.toLowerCase()}`,
      f: { type: 'Product type', maker: 'Manufacturer', blank: 'Blank model', pbt: 'Price type', basis: 'Pricing basis', src: 'Source price', fx: (r, d) => `(rate ${r}, ${d})`, range: 'Price range',
        orig: 'Before discount', member: 'Membership price', memberNote: "(on the manufacturer's paid plan)", methods: 'Print methods', sizes: 'Sizes / variants', material: 'Material',
        moq: 'Minimum quantity', mov: 'Minimum order value', prod: 'Production time', print: 'Printing', printNote: 'Price is for the blank product; printing is charged separately', ship: 'Shipping',
        shipIncl: 'Shipping included (as stated at source)', shipFrom: (k, v) => `${k}: from ${v}`, total: v => `(approx. total ${v})`, region: 'Production / shipping region', facilities: 'Production facilities', checked: 'Last checked' },
      shipShort: v => `+ ${v} shipping`, sellL: 'Your selling price', sellNote: 'Profit = your price − product price − shipping (when listed). Marketplace fees and taxes are not included.', 
      searchTitle: 'Search', searchDesc: 'Search print-on-demand products and compare manufacturer prices.', searching: 'Searching…',
      aboutTitle: 'About and methodology', aboutDesc: `How ${BRAND} collects and compares prices.`,
      about: (c, n, d, badges) => `<p>${BRAND} is an independent price comparison site that helps Etsy, Shopify and marketplace sellers find the cheapest print-on-demand manufacturer for each product. We do not sell anything or take orders.</p>
<h2>How products are compared</h2><p>When the same product is sold by several manufacturers, it gets one product page with every offer sorted from cheapest to most expensive. Products are matched by the blank garment model (e.g. Gildan 5000) or by product type and size (e.g. 11oz mug, 16×20 canvas).</p>
<h2>Where do prices come from?</h2><p>Prices are collected automatically from manufacturers' public catalog pages, store feeds and public APIs, and refreshed twice a day. Prices behind a login are not included; we never estimate or invent prices.</p>
<h2>Price types</h2><ul>${badges}</ul>
<h2>Currencies</h2><p>Non-USD prices are converted to approximate USD with daily reference rates (Frankfurter) for sorting; the source price is shown as well.</p>
<p>Coverage: ${n} products from ${c} manufacturers. Last updated: ${d}.</p>`,
      privacyTitle: 'Privacy and cookie policy', contactTitle: 'Contact', contactPending: '<em>(contact address will be added before launch)</em>',
      privacy: c => `<p>${BRAND} has no accounts, orders or payments, and does not collect names, addresses or payment details.</p>
<h2>Weekly newsletter</h2><p>If you subscribe to our weekly price newsletter, your email address is stored by our email provider, MailerLite (MailerLite Limited, Ireland), and used only to send that newsletter. You confirm your subscription through a link we email you, and every newsletter has an unsubscribe link. We do not sell or share your address. To have it deleted, unsubscribe or write to us.</p>
<h2>Reviews and comments</h2><p>When you post a review or comment, we store the name you enter, your text, your rating and the time, using our database provider Supabase. To limit spam we also store a one-way hash of your IP address, which cannot be turned back into the address and is never shown. Posts are checked before they appear. To have a post removed, write to us.</p>
<h2>Cookies and advertising</h2><p>We use third-party advertising such as Google AdSense. Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this and other websites. Google's use of advertising cookies enables it and its partners to serve ads based on your visits to this site and/or other sites on the Internet. You can opt out of personalized advertising in <a href="https://adssettings.google.com" target="_blank" rel="noopener">Google Ads Settings</a>, and learn more about third-party cookies at <a href="https://www.aboutads.info" target="_blank" rel="noopener">aboutads.info</a>. Visitors in the EEA, UK and Switzerland are asked for consent to advertising cookies.</p>
<h2>Links and affiliate programs</h2><p>Some links to manufacturers may be affiliate links; ${BRAND} may earn a commission on sign-ups through them. This never affects prices or ranking — ranking is by price only. Sponsored placements are labeled "Sponsored".</p>
<h2>Server logs</h2><p>Our hosting provider may keep standard access logs (IP address, browser) for a limited time for security and performance.</p>
<h2>Contact</h2><p>${c}</p>`,
      contact: c => `<p>To suggest a manufacturer, report a wrong price, or ask about sponsorship and partnerships, write to us: ${c}</p><p>Manufacturers: share a public catalog, product feed or API so your products are listed with accurate prices.</p>`,
      contactDesc: `Contact ${BRAND}: add a manufacturer, fix a price or partner with us.`,
      notFound: 'Page not found', notFoundP: 'The product may have been removed from the catalog. <a href="/">Go to the homepage</a> or search.',
      footer: `${BRAND} compares prices from print-on-demand manufacturers' public catalogs. We don't sell anything — clicking an offer takes you to the manufacturer's own page.`,
      footer2: d => `Prices are the starting or selected-variant prices shown at the source; printing, shipping, tax and minimum quantities vary by manufacturer. Last updated: ${d}.`,
      nl: { h: 'Weekly POD price newsletter', p: 'Every Monday: which suppliers raised or cut prices, the biggest moves, and where the cheapest supplier changed. Free, one email a week, unsubscribe anytime.', ph: 'Your email', btn: 'Subscribe', ok: 'Almost done: check your inbox and click the confirmation link.', err: 'Something went wrong. Please try again.' },
      fbGroup: { h: 'Join our free Facebook group', p: 'Weekly supplier price changes, bestseller lists vs the cheapest alternative, and answers to "who prints X cheapest?"', btn: 'Join the group' },
      foot: ['About & methodology', 'Manufacturers', 'Privacy & cookies', 'Contact'],
      ad: 'Ad', adPreview: s => `Ad slot · ${s}`, adSize: { ust: 'Leaderboard', liste: 'In-list', urun: 'Rectangle', alt: 'Leaderboard' },
      sponsored: 'Sponsored', sponsorPreview: 'Sponsored manufacturer slot', review: 'View ↗',
      homeTitle: `POD Pricing | Print-on-Demand Price Comparison`, 
      grpAboutH: t => `${t}: print-on-demand price comparison`,
      grpAbout: d => [`We compared ${d.n} print-on-demand suppliers that sell the ${d.t} with printing included. Prices range from ${d.lo} at ${d.loP} to ${d.hi} at ${d.hiP}; the typical (median) price is ${d.med}. ${d.gap > 0 ? `The most expensive supplier charges ${d.gap}% more than the cheapest one for the same product.` : ''}`, `Prices are base costs from each supplier's public catalog in USD, before shipping and tax, and refresh twice a day. Enter your selling price above to see your profit per sale with every supplier.`],
      grpFaqH: 'Questions about this product', sibH: l => `Other ${l.toLowerCase()} compared`, sibGuide: l => `Cheapest ${l.toLowerCase()} supplier overall →`,
      grpFaq: d => [[`What is the cheapest ${d.t} for print on demand?`, `${d.loP} at ${d.lo} (print included), the lowest of the ${d.n} suppliers we compared. ${d.p2 ? `The next cheapest are ${d.p2}.` : ''}`], [`How much does the ${d.t} cost for print on demand?`, `Between ${d.lo} and ${d.hi} depending on the supplier; the typical price is ${d.med}. Shipping is added at checkout.`]].concat(d.pf ? [[`Is Printful or Printify cheaper for the ${d.t}?`, d.pf]] : []),
      homeAboutH: 'Compare print-on-demand prices before you pick a supplier',
      homeAbout: d => [`POD Pricing is an independent print-on-demand price comparison site. We track ${d.n} products from ${d.m} print-on-demand suppliers — Printful, Printify, BurgerPrints, Merchize, Yoycol, Gearment and many more — and line up the same product side by side, cheapest first.`, `For the same product, the most expensive supplier typically charges ${d.gap}% more than the cheapest one. That gap is your margin: on a t-shirt you sell for $24.99, a few dollars of base cost decides whether the listing is worth it.`, `Search a product or a blank (for example "Gildan 5000", "11oz mug" or "canvas 16x24"), compare every supplier that makes it, enter your selling price to see your profit per sale, then go straight to the supplier.`],
      homeFaqH: 'Print-on-demand price comparison: common questions',
      homeFaq: d => [['What is a print-on-demand price comparison?', `It lists the base price of the same product at different print-on-demand suppliers so you can see who makes it cheapest. POD Pricing compares ${d.n} products from ${d.m} suppliers.`], ['Which print-on-demand company is the cheapest?', `It depends on the product. Across the ${d.g} products sold by three or more suppliers, ${d.top} is the cheapest supplier overall in our data, about ${d.w}% below the typical price. Check the product you sell, because the cheapest supplier changes from product to product.`], ['How much cheaper can the same product be?', `For the same product, the most expensive supplier typically charges ${d.gap}% more than the cheapest one.`], ['Where do the prices come from?', "From the suppliers' public catalogs and price lists. Prices are refreshed automatically twice a day; every listing shows when it was last checked. Shipping, taxes and size or color surcharges can change the final cost."], ['Is POD Pricing free?', 'Yes. Ranking is by price only. Some links to suppliers are affiliate links, which can earn us a commission at no extra cost to you; this never changes the order.']], homeDesc: (m, n) => `Compare POD prices across ${m} print-on-demand manufacturers and ${n} products. Find the cheapest supplier for t-shirts, hoodies, mugs, posters, phone cases and more.`,
    },
  },
  tr: {
    lang: 'tr', intl: 'tr-TR',
    path: { home: 'tr/', categories: 'tr/kategoriler/', cat: id => `tr/kategori/${eSlug.get(id)}/`, oldCat: id => `tr/kategori/${id}/`, compare: 'tr/karsilastir/', group: s => `tr/karsilastir/${s}/`,
      makers: 'tr/ureticiler/', maker: id => `tr/uretici/${id}/`, product: id => `product/${id}/`, search: 'tr/ara/', about: 'tr/hakkinda/', privacy: 'tr/gizlilik/', contact: 'tr/iletisim/',
      vsIndex: 'tr/vs/', vs: s => `tr/vs/${s}/`, calc: 'tr/kar-hesaplayici/', profitIndex: 'tr/kar/', profit: s => `tr/kar/${s}/`,
      guides: 'tr/en-ucuz/', guide: t => `tr/en-ucuz/${t}/`, alts: 'tr/alternatifler/', alt: id => `tr/alternatifler/${id}/`, widget: 'tr/fiyat-kutusu/', index: 'tr/fiyat-endeksi/' },
    type: id => id === 'diger' ? 'Diğer Ürünler' : tx.TYPE_BY_ID.get(id)?.label || id, group: g => tx.GROUP_LABEL.get(g) || 'Diğer', node: id => eLabel(id, 'tr'),
    pbLabel: PB.LABEL, pbNote: PB.NOTE, basis: s => s, sizes: s => s, production: s => s, method: m => m,
    notAdded: 'Fiyatlar henüz eklenmedi', quick: ['tişört', 'hoodie', 'kupa', 'termos', 'poster', 'kanvas', 'bez çanta', 'telefon kılıfı', 'şapka', 'battaniye'],
    t: {
      home: 'Ana sayfa', categories: 'Kategoriler', compare: 'Karşılaştır', makers: 'Üreticiler', search: 'Arama', searchBtn: 'Ara',
      searchPh: 'Ürün ya da model ara (ör. 11oz kupa, gildan 5000, hoodie)', searchBig: 'Ne basmak istiyorsun?',
      heroH: 'POD (Print on Demand) fiyat karşılaştırması',
      heroP: (m, n) => `${m} POD üreticisinin ${n} ürününü karşılaştır, en ucuzu en üstte. Etsy, Amazon, Shopify, TikTok Shop ve eBay satıcıları için.`,
      topGroups: 'En çok üreticide satılan ürünler', bs: { h: n => `${n} çok satanları`, at: n => `${n}'da`, sites: n => `${n} sitede satılıyor`, cheaper: (v, m) => `en ucuzu ${v}, ${m}`, src: (n, d) => `${n}'ın kendi çok satanlar listesinden · ${d}` }, seeAll: 'Tümünü gör', catsH: 'Kategoriler', allCats: 'Tüm kategoriler',
      vs: {
        typeH: (a, b) => `${a} mı ${b} mi: ürün tipine göre hangisi daha ucuz?`, tth: ['Ürün tipi', 'Ürün', 'Toplamda ucuz olan'], typeWin: (x, p) => p < 3 ? 'aşağı yukarı aynı' : `${x}, %${p} daha ucuz`, faqH: 'Sorular',
        q1: (a, b) => `${a} mı ${b} mi daha ucuz?`, a1: (w, tot, a, an, b, bn, n) => `${w}. ${tot} ${n} ürünün ${an} tanesinde ${a}, ${bn} tanesinde ${b} daha ucuz.`,
        qT: (a, b, l) => `${l} için ${a} mı ${b} mi daha ucuz?`, aT: (l, n, x, p, a, an, b, bn) => `İkisinin de sattığı ${n} üründe (${l}) ${p < 3 ? 'toplam fiyat aşağı yukarı aynı' : `toplamda ${x} daha ucuz (yaklaşık %${p})`}: ${an} üründe ${a}, ${bn} üründe ${b} ucuz.`,
        nav: 'X vs Y', indexTitle: 'POD üreticisi karşılaştırmaları', indexDesc: n => `Print-on-demand üreticileri arasında ${n} ikili fiyat karşılaştırması; iki üreticinin de sattığı ürünlere göre.`,
        indexIntro: 'Her karşılaştırma yalnızca iki üreticinin de sattığı ürünleri (aynı boş ürün modeli ya da aynı ürün tipi ve ölçü) ve her birinin en ucuz baskı dahil fiyatını kullanır.',
        title: (a, b, m) => `${a} mı ${b} mı? Hangisi daha ucuz (${m})`, desc: (a, b, n, w) => `${a} ile ${b}, ${n} aynı üründe: ${w}. Fiyatlar günde iki kez yenilenir.`,
        h1: (a, b) => `${a} vs ${b}`, sub: 'İki üreticinin de sattığı ürünlerde fiyat karşılaştırması',
        verdictA: (a, b, pct) => `Genel olarak ${a} daha ucuz; aynı ürünlerde ${b}'den yaklaşık %${pct} daha az`,
        verdictTie: (a, b) => `${a} ve ${b} genel olarak aşağı yukarı aynı fiyatta`,
        wins: (x, n, total) => `${x}, ${total} üründen ${n} tanesinde daha ucuz`,
        totals: (n, a, va, b, vb) => `Ortak ${n} ürünün her birinden birer tane almak ${a}'da ${va}, ${b}'de ${vb} tutuyor.`,
        th: ['Ürün', 'Fark'], same: 'aynı', cheaper: 'daha ucuz', products: 'ürün', lowest: 'En düşük fiyat', basis: 'Fiyat türü',
        others: 'Diğer karşılaştırmalar', makerH: n => `${n} ile diğer üreticileri karşılaştır`, shared: n => `${n} ortak ürün`,
        note: 'Fiyatlar her üreticinin o üründeki en ucuz baskı dahil teklifidir; kargo ve vergi hariçtir. Baskı alanı, kalite ve kargo farklı olabilir; sipariş öncesi mağazaya bakın.',
      },
      widget: {
        title: 'Blogun için ücretsiz fiyat kutusu', desc: 'Blogunda ya da sitende canlı bir print-on-demand fiyat tablosu göster. Ücretsiz, günde iki kez güncellenir.', embedLink: 'Bu fiyat tablosunu kendi sitene ekle →',
        intro: 'Print-on-demand hakkında mı yazıyorsun? Yazına herhangi bir ürünün canlı fiyat tablosunu ekle. Günde iki kez kendiliğinden güncellenir, ücretsizdir.',
        pick: 'Ürün seç', code: 'Bu kodu sayfana yapıştır', copy: 'Kodu kopyala', copied: 'Kopyalandı!', preview: 'Önizleme',
        note: 'Tablonun altındaki bağlantıyı silme; veri kaynağını belirtir. Tablo her üreticinin en ucuz teklifini gösterir, baskı dahil olanlar önce.',
      },
      guide: {
        indexTitle: 'Ürüne göre en ucuz POD üreticileri', indexDesc: 'Tişört, hoodie, kupa, poster ve daha fazlası için en ucuz print-on-demand üreticisi; günde iki kez güncellenir.',
        title: (l, m) => `En ucuz POD ${l} üreticileri (${m})`, desc: (l, s, v, n) => `${l} için ortalamada en ucuz üretici ${s}. En düşük fiyat ${v}; ${n} ürün üreticiler arasında karşılaştırıldı, günde iki kez güncellenir.`,
        h1: (l, m) => `En ucuz POD ${l} üreticileri`, upd: m => `Güncelleme: ${m} · fiyatlar günde iki kez yenilenir`,
        lead: (l, n, s, w, v, med) => `Birden fazla üreticinin sattığı ${n} ${l} ürününü (aynı boş ürün ya da aynı ölçü) karşılaştırdık. Ortalamada en ucuz üretici ${s}: aynı ürünün tipik fiyatından yaklaşık %${w} daha ucuz. Bulduğumuz en düşük baskı dahil fiyat ${v}; tipik (ortanca) fiyat ${med}.`,
        rankH: 'Ortalamada en ucuz üreticiler', rankP: 'Fiyat endeksi: 100 = aynı ürünün tipik fiyatı. Düşük olan daha ucuz. Yalnızca en az 3 karşılaştırılabilir ürünü olan üreticiler listelenir.',
        rth: ['Üretici', 'Fiyat endeksi', 'En ucuz olduğu', 'Karşılaştırılan ürün'], vsMed: p => p <= 0 ? `tipik fiyattan %${-p} ucuz` : `tipik fiyattan %${p} pahalı`,
        topH: l => `En çok karşılaştırılan ${l} ürünleri`, tth: ['Ürün', 'Üretici', 'En ucuz', 'Tipik fiyat'],
        faqH: 'Sık sorulanlar', q1: l => `${l} için en ucuz print-on-demand üreticisi hangisi?`,
        a1: (l, s, w, n, s2) => `Karşılaştırılabilir ${n} üründe ortalamada en ucuz üretici ${s} (tipik fiyattan yaklaşık %${w} ucuz)${s2 ? `, ardından ${s2}` : ''}. En ucuz üretici ürüne göre değiştiği için sipariş öncesi ürün sayfasına bakın.`,
        q2: l => `Print-on-demand ${l} kaça mal olur?`, a2: (v, med) => `Baskı dahil taban fiyatlar ${v}'dan başlıyor; tipik fiyat ${med} civarında (kargo ve vergi hariç).`,
        q3: l => `${l} için Printful mı Printify mı daha ucuz?`, a3: (n, a, b) => `Bu kategoride ikisinin de sattığı ${n} üründe Printful ${a}, Printify ${b} üründe daha ucuz.`,
        more: 'Diğer rehberler', calcCta: 'Satış başına kârını hesapla →', allProducts: l => `Tüm ${l} ürünleri →`,
      },
      alt: {
        titleN: (s, c, m) => `${s} alternatifleri: ${c} daha ucuz POD üreticisi (${m})`,
        typeH: s => `Ürün tipine göre en ucuz ${s} alternatifi`, tth: ['Ürün tipi', 'En ucuz alternatif', 'Fark:', 'Karşılaştırılan ürün'], faqH: 'Sorular',
        q1: s => `En ucuz ${s} alternatifi hangisi?`, a1: (s, o, p, n, next) => `${o}: ikisinin de sattığı ${n} üründe ${s} fiyatlarından yaklaşık %${p} ucuz.${next ? ` Ardından ${next} geliyor.` : ''}`,
        q2: s => `Kaç POD üreticisi ${s} fiyatlarından ucuz?`, a2: (s, n, c, e, m) => `Aynı ürünlerde ${s} ile karşılaştırdığımız ${n} üreticiden ${c} tanesi toplamda daha ucuz, ${e} tanesi aşağı yukarı aynı, ${m} tanesi daha pahalı.`,
        qT: (s, l) => `${l} için en ucuz ${s} alternatifi hangisi?`, aT: (s, l, o, p, n) => `${o}; karşılaştırılabilir ${n} üründe (${l}) ${s} fiyatlarından yaklaşık %${p} ucuz.`,
        indexTitle: 'POD üreticisi alternatifleri', indexDesc: 'Printful, Printify ve diğer print-on-demand üreticilerine, ikisinin de sattığı ürünlere göre daha ucuz alternatifler.',
        title: (s, m) => `${s} alternatifleri: daha ucuz POD üreticileri (${m})`, desc: (s, n, top) => `${n} print-on-demand üreticisi aynı ürünlerde ${s} ile karşılaştırıldı. ${top}`,
        h1: s => `${s} alternatifleri`, lead: (s, n) => `İkisinin de sattığı ürünlerde ${s} ile karşılaştırılan üreticiler; bu ortak ürünlerde toplamda ne kadar ucuz olduklarına göre sıralı.`,
        th: ['Üretici', 'Genel fark', 'Daha ucuz olduğu', 'Ortak ürün'], cheaper: p => `%${p} daha ucuz`, pricier: p => `%${p} daha pahalı`, same: 'aşağı yukarı aynı',
        top: (o, p) => `${o} aynı ürünlerde %${p} daha ucuz.`, none: s => `Ortak ürünlerde ${s}'dan genel olarak daha ucuz üretici yok.`, details: 'ayrıntı',
      },
      pidx: {
        nav: 'POD Fiyat Endeksi', homeCta: gap => `Aynı ürün en pahalı üreticide en ucuzdan %${gap} daha pahalı. POD Fiyat Endeksi'ni gör →`, title: (m, s) => `POD Fiyat Endeksi (${m}): ${s} üreticinin print-on-demand fiyatları`,
        desc: (m, n, s, gap) => `${m} print-on-demand fiyat raporu: ${s} üreticiden ${n} ürün. Aynı ürün için en pahalı üretici, en ucuzdan tipik olarak %${gap} daha fazla istiyor.`,
        h1: m => `POD Fiyat Endeksi — ${m}`, upd: d => `Veri tarihi: ${d} · günde iki kez yenilenir · kaynak göstererek kullanılabilir`,
        kpi: ['Takip edilen ürün', 'Üretici', '3+ üreticinin sattığı ürün', 'Tipik fiyat farkı'], gapP: 'Aynı ürün için en ucuz ve en pahalı üretici arasındaki ortanca fark.',
        lead: (n, g, gap, top, w) => `Üreticilerin herkese açık kataloglarından ${n} print-on-demand ürününü takip ediyoruz. Bunların ${g} tanesini en az üç üretici satıyor; böylece aynı ürünü birebir karşılaştırabiliyoruz. Aynı ürün için en pahalı üretici, en ucuzdan tipik olarak %${gap} daha fazla istiyor. Bütün ortak ürünlerde genel olarak en ucuz üretici ${top}: tipik fiyatın yaklaşık %${w} altında.`,
        supH: 'Üretici fiyat sıralaması', supP: n => `Fiyat endeksi: 100 = aynı ürünün tipik (ortanca) fiyatı; düşük olan daha ucuz. Her üreticinin endeksi, karşılaştırılabilir ürünlerindeki ortalamadır. En az ${n} karşılaştırılabilir ürünü olan üreticiler listelenir.`,
        sth: ['Üretici', 'Fiyat endeksi', 'En ucuz olduğu', 'Karşılaştırılan ürün', 'Değişim'],
        modH: 'Popüler boş ürünler: üreticiler arası fiyat aralığı', mth: ['Boş ürün', 'Üretici', 'En düşük', 'Tipik', 'En yüksek', 'En ucuz', 'Değişim'],
        typH: 'Ürün tipine göre tipik fiyat', tth: ['Ürün tipi', 'Karşılaştırılan ürün', 'En düşük', 'Tipik', 'Ortalamada en ucuz'],
        chgNone: d => `Değişim sütunları en az bir haftalık günlük kayıt birikince dolacak (kayıt başlangıcı: ${d}).`, chgSince: d => `Değişim: ${d} tarihli kayda göre (üreticilerde endeks puanı, boş ürünlerde tipik fiyat).`,
        citeH: 'Bu veriyi kullanmak', cite: 'Bu rakamları yazı, video ve paylaşımlarınızda kullanabilirsiniz. Lütfen "POD Pricing (podpricing.com)" diye kaynak gösterip bağlantı verin.', csv: ['Üretici sıralaması (CSV)', 'Boş ürün fiyatları (CSV)'],
        method: 'Yöntem: fiyatlar her üreticinin herkese açık kataloğundaki baskı dahil taban fiyatlardır (USD, kargo ve vergi hariç). Ürünler boş ürün modeline (ör. Gildan 5000) ya da ürün tipi ve ölçüsüne göre eşleştirilir. Her ürün için her üreticinin en ucuz teklifi alınır; tipik fiyat üreticiler arasındaki ortancadır.',
      },
      profitPages: { nav: 'Ürün ürün kâr', title: (n, p) => `${n} Etsy'de ${p}: üretici üretici kâr (kargo dahil)`, h1: (n, p) => `${n} Etsy'de ${p}'a satılırsa ne kazanırsın?`,
        desc: (n, p, lo, hi, b, k) => `${n} Etsy'de ${p}'a ABD'ye satılırsa üreticiye göre satış başına ${lo} ile ${hi} arası kalır; en çok ${b}'de. ${k} üreticinin gerçek kargo ve gümrük verisiyle.`,
        answer: (p, hi, hn, lo, ln) => `${p}'a satarsan satış başına ${hn} ile ${hi}, ${ln} ile ${lo} kalır.`, basis: (p, f) => `Örnek Etsy fiyatı ${p}, alıcı ABD'de. Etsy komisyonu ${f} (%6,5 işlem + %3 + $0,25 ödeme + $0,20 listeleme). Maliyet = ürün + üreticinin yayınladığı ABD kargosu + gümrük.`,
        th: ['Üretici', 'Maliyetin', 'Kârın'], from: c => `${c}'den gönderiliyor`, parts: (b, s) => `ürün ${b} + kargo ${s}`, pct: n => `%${n} kâr`, go: 'Mağazaya git ↗',
        cta: 'Kendi fiyatınla kâr hesaplayıcıda dene →', note: (n, k) => `Bu ürünü ${n} üretici yapıyor; ${k} tanesi ABD kargo ücretini yayınlıyor ve yukarıda.`, allLink: n => `${n} üreticinin hepsini karşılaştır →`,
        q: (n, p) => `${n} Etsy'de ${p}'a satılırsa ne kadar kâr kalır?`, a: (p, hi, hn, lo, ln) => `${p}'a ABD'ye satışta Etsy komisyonu, ürün, kargo ve gümrük düşünce ${hn} ile yaklaşık ${hi}, ${ln} ile ${lo} kalır.`,
        indexTitle: 'Etsy kârı: ürün ürün, üretici üretici', indexDesc: k => `${k} popüler print-on-demand ürününde Etsy'de satış başına cebine ne kaldığı, gerçek kargo dahil, üretici üretici.` },
      hc: { h: 'Bu ürünü satarsan ne kazanırsın?', p: 'Ürün maliyeti, alıcıya kargo, gümrük vergisi ve pazar yeri komisyonu; ürünü yapan her üretici için. Üreticilerin yayınladığı gerçek ücretler, tahmin yok.', price: 'Satış fiyatın ($)', btn: 'Kârımı hesapla', note: (a, n) => `Karşılaştırdığımız ${n} ürünün ${a} tanesinde gerçek kargo ve vergi verisi var; her hafta yeni üreticiler ekleniyor.` },
      calc: {
        nav: 'Kâr hesaplayıcı', title: 'POD kâr hesaplayıcı', desc: 'Etsy, Shopify veya Amazon\'da satış başına kârını, ürünü satan her print-on-demand üreticisi için hesapla.',
        intro: 'Ürünü ve satış fiyatını seç; her üreticide kargo, gümrük ve komisyondan sonra cebine ne kaldığını gör.',
        product: 'Ürün', price: 'Satış fiyatın ($)', shipIn: 'Müşteriden aldığın kargo ($)', adv: 'Gelişmiş', platform: 'Nerede satıyorsun', dest: 'Alıcı ülkesi', margin: 'Hedef kâr oranı (%)', dests: [['US', 'ABD'], ['GB', 'İngiltere'], ['EU', 'Avrupa Birliği'], ['CA', 'Kanada'], ['AU', 'Avustralya']],
        custom: 'Özel komisyon', pct: 'Komisyon %', fixed: 'Sabit ücret ($)',
        th: ['Üretici', 'Ürün maliyeti', 'Komisyon', 'Kâr', 'Kâr oranı'], pick: 'Sonuçları görmek için bir ürün seç.', loading: 'Yükleniyor…',
        fees: 'Kullanılan komisyonlar: Etsy %6,5 işlem + %3 + $0,25 ödeme + $0,20 listeleme; Shopify %2,9 + $0,30 (Basic plan, Shopify Payments); Amazon Handmade %15 (en az $1). Kargo: yalnız üreticinin yayınladığı ücret; yayınlanmamışsa ‘veri yok’ yazar ve kâr hesaplanmaz. ABD gümrük vergisi: ürün ABD’den çıkıyorsa 0; değilse ürün tipinin HTS oranı + çıkış ülkesinin 2026 Section 301 ek vergisi (oranlar 20 Ekim 2026). İngiltere, Avustralya: düşük değerli pakette gümrük yok, KDV/GST alıcıdan ödemede alınır. AB: 1 Temmuz 2026’dan beri ürün başına sabit €3 (AB içinden gönderimde yok). Kanada: ABD veya Meksika’dan kuryeyle C$150’a kadar vergisiz. Vergi ürün maliyeti üzerinden tahmindir, hukuki tavsiye değildir.',
      },
      blankH: 'Boş ürünler (baskı ücreti ayrıca)', blankP: 'Bu fiyatlar baskısız ürün veya toplu alım fiyatı olduğu için yukarıdaki baskı dahil tekliflerden ayrı listelenir.',
      sitesN: n => `${n} sitede satılıyor`, cheapest: 'en ucuz', catMenu: 'Kategoriler', subAll: n => `${n} alt kategorinin hepsi →`, itemsH: 'Ürünler',
      makersFrom: (n, v) => `${n} üretici · ${v}'dan`, from: v => `${v}'dan`, products: n => `${n} ürün`, makersN: n => `${n} üretici`,
      offersH: n => `${n} üreticinin fiyatları`, bestOf: n => `${n} üretici arasında en ucuz`, dlv: { best: (m, v, a, n) => `ABD'deki alıcıya teslim (kargo + gümrük vergisi), kargo ücretini yayınlayan ${a}/${n} üretici arasında en ucuz: ${m} ≈ ${v}`, row: v => `ABD'ye teslim ≈ ${v}`, parts: (s, d) => `kargo ${s} + gümrük %${d}`, more: 'Kârı ve önerilen satış fiyatını gör →', keep: "Etsy'de satış başına ne kalır →" }, histH: 'En ucuz fiyat geçmişi', histFlat: (d, v) => `En ucuz fiyat son ${d} gündür ${v}, değişmedi.`, histMove: (lo, ld, hi, now) => `En düşük ${lo} (${ld}), en yüksek ${hi}. Bugün ${now}.`, histNote: 'Her gün tüm üreticiler arasındaki en düşük fiyat; varsa baskı dahil fiyat.', range: (a, b) => `Fiyat aralığı ${a} – ${b}`, cheapestFirst: 'En ucuzdan en pahalıya sıralı.',
      groupNoteModel: 'Bütün üreticilerde aynı boş ürün modeli. Baskı yöntemi, baskı alanı ve kargo farklı olabilir; ayrıntılar üreticinin sayfasında.',
      groupNoteSpec: 'Bütün üreticilerde aynı ürün tipi ve ölçü. Malzeme ve seçenekler küçük farklar gösterebilir; ayrıntılar üreticinin sayfasında.',
      allOffersOf: n => `${n} teklifin hepsini göster`, groupsInCat: 'Üreticiler arasında fiyat karşılaştır', allInCat: 'Tüm ürünler',
      compareTitle: 'POD ürün fiyatlarını karşılaştır', compareDesc: n => `Birden fazla üreticide satılan ${n} print-on-demand ürünü, fiyatlar ucuzdan pahalıya.`,
      compareIntro: 'Aşağıdaki her ürün en az iki üreticide satılıyor. Birini açınca bütün fiyatları yan yana görürsün.',
      groupTitle: (t, n, v) => `${t} fiyat karşılaştırması: ${n} POD üreticisi, en düşük ${v}`, groupDesc: (t, n, v, m) => `${t} en ucuz ${v} (${m}). ${n} print-on-demand üreticisinin fiyatları ucuzdan pahalıya.`,
      catTitle: (l, n, v) => `${l} fiyat karşılaştırması: ${n} POD üreticisi, en düşük ${v}`, catDesc: (l, n, v, d) => d ? `${l}: ${d.n} üreticiden ${n} print-on-demand ürünü. En ucuz ${v} (${d.loP}); tipik başlangıç fiyatı ${d.med}. Günde iki kez güncellenir.` : `${l} için ${n} print-on-demand ürünü. En düşük fiyat ${v}.`,
      catH1: l => `${l}: POD fiyatları`,
      catAbout: (l, d) => `${l} kategorisinde ${d.n} üreticiden ${d.N} print-on-demand ürününü takip ediyoruz. En ucuzu ${d.loP}'da ${d.lo}; tipik bir üreticinin en ucuz seçeneği ${d.med}. Fiyatlar üreticilerin herkese açık kataloglarındaki USD taban fiyatlarıdır; kargo ve vergi hariçtir, günde iki kez yenilenir.`,
      catFaq: (l, d) => { const x = l.toLocaleLowerCase('tr'); return [[`Print-on-demand ${x} ne kadar?`, `${d.loP}'da ${d.lo}'dan başlıyor. Baskılı satan ${d.n} üreticide tipik en ucuz seçenek ${d.med}; kargo ödeme sırasında eklenir.`], [`${l} için en ucuz POD üreticisi hangisi?`, `${d.loP} (${d.lo}); ardından ${d.p2}.`], [`Kaç POD üreticisi ${x} satıyor?`, `Takip ettiğimiz üreticilerden ${d.n} tanesi baskılı satıyor; baskısızlar dahil toplam ${d.N} ürün.`]]; }, catFaqH: 'Fiyatlarla ilgili sorular',
      groupPageTitle: l => `${l} POD fiyatları`, catsTitle: 'Tüm POD ürün kategorileri', catsDesc: 'Print-on-demand ürün kategorileri ve her kategorideki en düşük fiyat.',
      makersTitle: 'Print-on-demand üreticileri', makersDesc: n => `${n} print-on-demand üreticisi: ürün sayıları, kategoriler ve en düşük fiyatlar.`,
      makersIntro: (c, r) => `${c} üreticinin fiyatları karşılaştırmada. ${r} üretici, fiyatları üye girişi gerektirdiği ya da yayınlanmadığı için yalnızca bağlantı olarak listeleniyor.`,
      mk: ['Üretici', 'Ürün', 'En düşük', 'Durum'], compared: 'Fiyatlar karşılaştırmada', visit: 'siteye git ↗',
      makerTitle: (n, c, m) => c ? `${n} fiyatları (${m}): ${c} ürünün baz fiyatı` : `${n}: print-on-demand ürünleri ve fiyatları`, makerDesc: (n, c, v, tops = []) => c ? `${n} fiyatları: ${c} print-on-demand ürünü${tops.length ? ' — ' + tops.map(([l, p]) => `${l.toLocaleLowerCase('tr')} en düşük ${p}`).join(', ') : `, en düşük baz fiyat ${v}`}. ${n} fiyatlarını diğer üreticilerle karşılaştır; günde iki kez güncellenir.` : `${n} print-on-demand üreticisi. Fiyat bilgisi henüz karşılaştırmada yok.`,
      makerStats: (n, t, v) => `${n} ürün · ${t} ürün tipi · en düşük ${v}`, makerTop: 'En uygun ürünler', noPrices: r => `Bu üreticinin fiyatları karşılaştırmada yok: ${r.charAt(0).toLocaleLowerCase('tr') + r.slice(1)}. Ürünler ve fiyatlar için üreticinin sitesine bakın.`,
      go: 'Mağazaya git ↗', goAt: m => `${m} fiyatını gör →`, inGroup: (n) => `${n} üreticide satılıyor, bütün fiyatları karşılaştır`,
      searchTitle: 'Ara', searchDesc: 'Print-on-demand ürünlerini ara ve üretici fiyatlarını karşılaştır.', searching: 'Aranıyor…',
      shipShort: v => `+ ${v} kargo`, sellL: 'Satış fiyatın', sellNote: 'Kâr = satış fiyatın − ürün fiyatı − kargo (biliniyorsa). Pazar yeri komisyonu ve vergiler dahil değil.', 
      aboutTitle: 'Hakkında ve yöntem', aboutDesc: `${BRAND} fiyatları nasıl toplar ve karşılaştırır.`,
      about: (c, n, d, badges) => `<p>${BRAND}, Etsy ve diğer pazaryerlerinde satış yapanların her ürün için en ucuz print-on-demand üreticisini bulmasına yardım eden bağımsız bir fiyat karşılaştırma sitesidir. Satış yapmaz, sipariş almaz.</p>
<h2>Ürünler nasıl karşılaştırılıyor?</h2><p>Aynı ürün birden fazla üreticide satılıyorsa tek bir ürün sayfası oluşur ve bütün teklifler ucuzdan pahalıya sıralanır. Ürünler boş ürün modeline (ör. Gildan 5000) ya da ürün tipi ve ölçüsüne (ör. 11oz kupa, 16×20 kanvas) göre eşleştirilir.</p>
<h2>Fiyatlar nereden geliyor?</h2><p>Fiyatlar üreticilerin herkese açık katalog sayfalarından, mağaza beslemelerinden ve açık API'lerinden otomatik alınır ve günde iki kez yenilenir. Üye girişi gerektiren fiyatlar eklenmez; tahmini ya da uydurma fiyat kullanılmaz.</p>
<h2>Fiyat türleri</h2><ul>${badges}</ul>
<p>Kapsam: ${c} üreticiden ${n} ürün. Son güncelleme: ${d}. Tekil ürün sayfaları İngilizcedir.</p>`,
      privacyTitle: 'Gizlilik ve çerez politikası', contactTitle: 'İletişim', contactPending: '<em>(iletişim adresi yayından önce eklenecek)</em>',
      privacy: c => `<p>${BRAND} üyelik, sipariş veya ödeme almaz; ziyaretçilerden ad, adres ya da ödeme bilgisi toplamaz.</p>
<h2>Haftalık bülten</h2><p>Haftalık fiyat bültenimize abone olursanız e-posta adresiniz e-posta hizmet sağlayıcımız MailerLite (MailerLite Limited, İrlanda) tarafından saklanır ve yalnızca bu bülteni göndermek için kullanılır. Aboneliğinizi size gönderdiğimiz bağlantıyla onaylarsınız; her bültende abonelikten çıkma bağlantısı bulunur. Adresinizi satmaz ve kimseyle paylaşmayız. Silinmesi için abonelikten çıkabilir ya da bize yazabilirsiniz.</p>
<h2>Yorumlar</h2><p>Yorum ya da değerlendirme yazdığınızda girdiğiniz ad, metin, puan ve tarih veritabanı sağlayıcımız Supabase'te saklanır. Spam'i sınırlamak için IP adresinizin geri çevrilemeyen bir özeti (hash) de tutulur; bu özet adrese dönüştürülemez ve hiçbir yerde gösterilmez. Yorumlar yayından önce kontrol edilir. Bir yorumun kaldırılması için bize yazabilirsiniz.</p>
<h2>Çerezler ve reklamlar</h2><p>Sitede Google AdSense gibi üçüncü taraf reklam hizmetleri kullanılır. Google dahil üçüncü taraf sağlayıcılar, bu siteye ve diğer sitelere yaptığınız önceki ziyaretlere dayalı reklam sunmak için çerez kullanabilir. Kişiselleştirilmiş reklamcılığı <a href="https://adssettings.google.com" target="_blank" rel="noopener">Google Reklam Ayarları</a> üzerinden kapatabilir, üçüncü taraf çerezleri hakkında <a href="https://www.aboutads.info" target="_blank" rel="noopener">aboutads.info</a> adresinden bilgi alabilirsiniz. AEA, Birleşik Krallık ve İsviçre'deki ziyaretçilerden reklam çerezleri için onay istenir.</p>
<h2>Bağlantılar ve ortaklık programları</h2><p>Üreticilere verilen bazı bağlantılar ortaklık (affiliate) bağlantısı olabilir; bu bağlantılar üzerinden yapılan kayıtlardan ${BRAND} komisyon alabilir. Bu, fiyatları ve sıralamayı etkilemez: sıralama yalnızca fiyata göredir. Sponsorlu alanlar "Sponsorlu" etiketiyle belirtilir.</p>
<h2>Sunucu kayıtları</h2><p>Barındırma sağlayıcımız, güvenlik ve performans amacıyla IP adresi ve tarayıcı bilgisi gibi standart erişim kayıtlarını sınırlı süre tutabilir.</p>
<h2>İletişim</h2><p>${c}</p>`,
      contact: c => `<p>Listede olmayan bir üreticiyi önermek, hatalı bir fiyatı bildirmek veya sponsorluk ve iş birliği için bize yazın: ${c}</p><p>Üreticiyseniz: ürünlerinizin doğru fiyatla listelenmesi için herkese açık bir katalog, ürün beslemesi veya API bağlantısı paylaşabilirsiniz.</p>`,
      contactDesc: `${BRAND} ile iletişim: üretici eklemek, fiyat düzeltmek veya iş birliği için.`,
      footer: `${BRAND}, print-on-demand üreticilerinin herkese açık kataloglarındaki fiyatları karşılaştırır. Satış yapmaz; bir teklife tıklayınca üreticinin kendi sayfasına gidersiniz.`,
      footer2: d => `Fiyatlar üreticinin kaynakta gösterdiği başlangıç veya seçili varyant bedelidir; baskı, kargo, vergi ve minimum adet koşulları üreticiye göre değişir. Son güncelleme: ${d}.`,
      nl: { h: 'Haftalık POD fiyat bülteni', p: 'Her pazartesi: hangi üretici zam yaptı ya da indirdi, en büyük değişimler ve en ucuz üreticinin değiştiği ürünler. Ücretsiz, haftada bir e-posta, istediğin an çık (İngilizce).', ph: 'E-posta adresin', btn: 'Abone ol', ok: 'Neredeyse bitti: gelen kutuna bak ve onay linkine tıkla.', err: 'Bir sorun oldu. Lütfen tekrar dene.' },
      fbGroup: { h: 'Ücretsiz Facebook grubumuza katılın', p: 'Haftalık üretici fiyat değişimleri, çok satanlar ve en ucuz alternatifleri, "X\'i en ucuza kim basıyor?" sorularının cevapları (İngilizce).', btn: 'Gruba katıl' },
      foot: ['Hakkında ve yöntem', 'Üreticiler', 'Gizlilik ve çerezler', 'İletişim'],
      ad: 'Reklam', adPreview: s => `Reklam alanı · ${s}`, adSize: { ust: 'Yatay afiş', liste: 'Liste arası', urun: 'Kare', alt: 'Yatay afiş' },
      sponsored: 'Sponsorlu', sponsorPreview: 'Sponsorlu üretici alanı', review: 'İncele ↗',
      homeTitle: `POD (Print on Demand) Fiyat Karşılaştırması | ${BRAND}`,
      grpAboutH: t => `${t}: print-on-demand fiyat karşılaştırma`,
      grpAbout: d => [`${d.t} ürününü baskı dahil satan ${d.n} print-on-demand üreticisini karşılaştırdık. Fiyatlar ${d.loP}'da ${d.lo} ile ${d.hiP}'da ${d.hi} arasında; tipik (medyan) fiyat ${d.med}. ${d.gap > 0 ? `Aynı ürün için en pahalı üretici en ucuzdan %${d.gap} daha fazla istiyor.` : ''}`, `Fiyatlar üreticilerin herkese açık kataloglarındaki USD taban fiyatlarıdır; kargo ve vergi hariçtir, günde iki kez yenilenir. Yukarıya satış fiyatını yazarak her üreticideki kârını görebilirsin.`],
      grpFaqH: 'Bu ürünle ilgili sorular', sibH: l => `Diğer ${l} karşılaştırmaları`, sibGuide: l => `${l}: genelde en ucuz üretici →`,
      grpFaq: d => [[`En ucuz ${d.t} hangi print-on-demand üreticisinde?`, `${d.loP}, ${d.lo} (baskı dahil) ile karşılaştırdığımız ${d.n} üretici arasında en düşük fiyat. ${d.p2 ? `Sonraki en ucuzlar: ${d.p2}.` : ''}`], [`${d.t} print-on-demand fiyatı ne kadar?`, `Üreticiye göre ${d.lo} ile ${d.hi} arasında; tipik fiyat ${d.med}. Kargo ödeme sırasında eklenir.`]].concat(d.pf ? [[`${d.t} için Printful mu Printify mı ucuz?`, d.pf]] : []),
      homeAboutH: 'Üretici seçmeden önce print-on-demand fiyatlarını karşılaştır',
      homeAbout: d => [`POD Pricing bağımsız bir print-on-demand fiyat karşılaştırma sitesidir. ${d.m} POD üreticisinin ${d.n} ürününü takip ediyoruz (Printful, Printify, BurgerPrints, Merchize, Yoycol, Gearment ve daha fazlası) ve aynı ürünü yan yana, en ucuzdan başlayarak sıralıyoruz.`, `Aynı ürün için en pahalı üretici, en ucuzdan genelde %${d.gap} daha fazla istiyor. Bu fark senin kâr marjın.`, `Bir ürün ya da boş ürün ara (ör. "Gildan 5000", "11oz kupa"), onu yapan bütün üreticileri karşılaştır, satış fiyatını yazıp satış başı kârını gör, sonra doğrudan üreticiye git.`],
      homeFaqH: 'Print-on-demand fiyat karşılaştırma: sık sorulanlar',
      homeFaq: d => [['Print-on-demand fiyat karşılaştırma nedir?', `Aynı ürünün farklı POD üreticilerindeki taban fiyatını listeler; kimin daha ucuza ürettiğini görürsün. POD Pricing ${d.m} üreticinin ${d.n} ürününü karşılaştırır.`], ['En ucuz print-on-demand şirketi hangisi?', `Ürüne göre değişir. En az üç üreticinin sattığı ${d.g} üründe verimize göre genel olarak en ucuz üretici ${d.top}; tipik fiyatın yaklaşık %${d.w} altında.`], ['Aynı ürün ne kadar ucuz olabilir?', `Aynı ürün için en pahalı üretici, en ucuzdan genelde %${d.gap} daha fazla istiyor.`], ['Fiyatlar nereden geliyor?', 'Üreticilerin herkese açık katalog ve fiyat listelerinden. Fiyatlar günde iki kez otomatik yenilenir; her teklifte son kontrol tarihi yazar. Kargo, vergi ve beden/renk farkları son maliyeti değiştirebilir.'], ['POD Pricing ücretsiz mi?', 'Evet. Sıralama yalnızca fiyata göredir. Üreticilere giden bazı linkler ortaklık (affiliate) linkidir; sana ek maliyeti yoktur ve sıralamayı değiştirmez.']], homeDesc: (m, n) => `En ucuz baskı üreticisini bul: ${m} POD üreticisinin ${n} ürününü karşılaştır; tişört, hoodie, kupa, poster, telefon kılıfı ve daha fazlası.`,
    },
  },
};
const LANGS = Object.keys(LOCALES);

// ---------- dil bağımlı parçalar
function makeHelpers(L) {
  const t = L.t, P = L.path;
  const numFmt = new Intl.NumberFormat(L.intl);
  const fmtCache = new Map();
  const fmt = (minor, cur = 'USD') => {
    if (!fmtCache.has(cur)) { try { fmtCache.set(cur, new Intl.NumberFormat(L.intl, { style: 'currency', currency: cur })); } catch { fmtCache.set(cur, null); } }
    const f = fmtCache.get(cur);
    return f ? f.format(minor / 100) : (minor / 100).toFixed(2) + ' ' + cur;
  };
  const dateFmt = new Intl.DateTimeFormat(L.intl, { dateStyle: 'long' });
  const lastText = lastCheck ? new Date(lastCheck).toLocaleString(L.intl, { dateStyle: 'long', timeStyle: 'short', timeZone: L.lang === 'tr' ? 'Europe/Istanbul' : 'UTC' }) + (L.lang === 'tr' ? '' : ' UTC') : '';
  const gTitle = g => PG.groupName(g.key, g.sample, L.lang, L.type);
  const pbBadge = pb => `<span class="pb pb-${pb}" title="${esc(L.pbNote[pb])}">${esc(L.pbLabel[pb])}</span>`;
  const srcSmall = p => p.sourceCurrency && p.sourceCurrency !== 'USD' && Number.isInteger(p.sourceMinor) ? `<small>${esc(fmt(p.sourceMinor, p.sourceCurrency))}</small>` : '';
  const priceHtml = (p, { badge = true } = {}) => {
    const old = Number.isInteger(p.originalMinor) && p.originalMinor > p.baseMinor && (!p.sourceCurrency || p.sourceCurrency === 'USD') ? `<s>${esc(fmt(p.originalMinor))}</s>` : '';
    return `${old}<b>${esc(fmt(p.baseMinor))}</b>${srcSmall(p)}${badge ? pbBadge(p.pb) : ''}`;
  };
  const ad = slot => {
    if (cfg.adsenseClient && cfg.adSlots?.[slot]) return `<div class="ad ad-${slot}"><span class="ad-label">${t.ad}</span><ins class="adsbygoogle" style="display:block" data-ad-client="${esc(cfg.adsenseClient)}" data-ad-slot="${esc(cfg.adSlots[slot])}" data-ad-format="auto" data-full-width-responsive="true"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>`;
    if (cfg.adsPreview) return `<div class="ad ad-${slot} ad-preview" aria-hidden="true">${esc(t.adPreview(t.adSize[slot]))}</div>`;
    return '';
  };
  // Sponsorlu üretici: site.config.json sponsors = [{ providerId, types?: [tip], text, url }]
  const sponsor = type => {
    const s = (cfg.sponsors || []).find(x => !x.types || x.types.includes(type));
    if (s) return `<aside class="sponsor"><span class="ad-label">${t.sponsored}</span><b>${esc(provName(s.providerId))}</b> <span>${esc(s.text)}</span> <a class="go" href="${esc(reg(s.url))}" target="_blank" rel="sponsored noopener">${t.review}</a></aside>`;
    if (cfg.adsPreview) return `<aside class="sponsor ad-preview" aria-hidden="true">${esc(t.sponsorPreview)}</aside>`;
    return '';
  };
  const imgTag = (src, alt) => src ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" referrerpolicy="no-referrer">` : `<span class="noimg"></span>`;
  const img = p => imgTag(p.imageUrl, p.title);
  // tekil ürün kartı
  const card = p => `<a class="card" href="${href(P.product(p.id))}"><div class="ci">${img(p)}</div><div class="cb"><div class="ct">${esc(p.title)}</div><div class="cm">${esc(provName(p.providerId))}</div><div class="cp"><b>${esc(fmt(p.baseMinor))}</b>${pbBadge(p.pb)}</div></div></a>`;
  // karşılaştırmalı ürün kartı (grup)
  const gcard = g => `<a class="card" href="${href(P.group(g.slug))}"><div class="ci">${imgTag(g.image, gTitle(g))}</div><div class="cb"><div class="ct">${esc(gTitle(g))}</div><div class="cm">${esc(t.makersN(g.providers.size))}</div><div class="cp"><small>${L.lang === 'en' ? 'from' : 'en ucuz'}</small><b>${esc(fmt(g.lo.baseMinor))}</b></div></div></a>`;
  // grup içinde üretici başına en ucuz teklif (baskılı olanlar; yoksa boş ürün fiyatı) — kategori listesinin üretici filtresi için
  const offersOf = g => { const pool = g.list.filter(p => !isBlank(p)).length ? g.list.filter(p => !isBlank(p)) : g.list; return [...groupBy(pool, p => p.providerId)].map(([id, l]) => [id, l[0].baseMinor]); };
  // Kategori listesindeki "ürün": birden çok sitede satılıyorsa karşılaştırma sayfası, tek sitedeyse kendi sayfası
  const itemsOf = (groupList, singles) => [
    ...groupList.map(g => ({ href: href(P.group(g.slug)), name: gTitle(g), image: g.image, price: g.lo.baseMinor, n: g.providers.size, maker: '', pb: '', best: g.lo.providerId, hi: g.hi.baseMinor, offers: offersOf(g) })),
    ...singles.map(p => ({ href: href(P.product(p.id)), name: p.title, image: p.imageUrl, price: p.baseMinor, n: 1, maker: p.providerId, pb: p.pb, best: p.providerId, hi: p.baseMinor, offers: [[p.providerId, p.baseMinor]] })),
  ].sort((a, b) => b.n - a.n || a.price - b.price);
  const icard = it => `<a class="card" href="${it.href}"><div class="ci">${imgTag(it.image, it.name)}</div><div class="cb"><div class="ct">${esc(it.name)}</div><div class="cm">${it.n > 1 ? `<span class="sites">${esc(t.sitesN(it.n))}</span>` : esc(provName(it.maker))}</div><div class="cp">${it.n > 1 ? `<small>${esc(t.cheapest)}</small>` : ''}<b>${esc(fmt(it.price))}</b></div></div></a>`;
  const icards = list => `<div class="cards">${list.map(icard).join('')}</div>`;
  const cards = list => `<div class="cards">${list.map(card).join('')}</div>`;
  const gcards = list => `<div class="cards">${list.map(gcard).join('')}</div>`;
  const tile = (hrefTo, image, title, sub) => `<a class="tile" href="${hrefTo}"><div class="ti">${imgTag(image, title)}</div><div class="tb"><b>${esc(title)}</b><span>${esc(sub)}</span></div></a>`;
  // Akakçe tarzı teklif listesi: üretici başına en ucuz teklif, ucuzdan pahalıya
  // boş ürün ve toplu alım fiyatları baskılı tekliflerle aynı sırada yarışmaz; ayrı listede gösterilir
  const offers = list => {
    const printed = list.filter(p => !isBlank(p)), blanks = list.filter(isBlank);
    if (!printed.length || !blanks.length) return ladderOf(list);
    return ladderOf(printed) + `<h3 class="blank-h">${esc(t.blankH)}</h3><p class="muted sm">${esc(t.blankP)}</p>` + ladderOf(blanks);
  };
  const delivered = deliveredUS;
  const ladderOf = list => {
    const best = [...groupBy(list, p => p.providerId)].map(([, l]) => l[0]).sort((a, b) => a.baseMinor - b.baseMinor);
    const row = (p, i) => { const sh = p.shipping ? Object.values(p.shipping)[0] : null; const dv = deliveredUS(p); return `<li data-c="${p.baseMinor}"${sh != null ? ` data-s="${sh}"` : ''}${dv != null ? ` data-d="${dv}"` : ''}><span class="rank">${i + 1}</span>${img(p)}<div><a href="${href(P.maker(p.providerId))}"><b>${esc(provName(p.providerId))}</b></a><div class="muted sm"><a href="${href(P.product(p.id))}">${esc(p.title)}</a></div><div class="pf"></div></div><span class="price">${priceHtml(p)}${p.shipping && Object.values(p.shipping)[0] != null ? `<small>${esc(t.shipShort(fmt(Object.values(p.shipping)[0])))}</small>` : ''}${(() => { const d = delivered(p); return d != null ? `<small class="dlv">${esc(t.dlv.row(fmt(d)))}</small>` : ''; })()}</span><a class="go" href="${esc(outbound(p))}" target="_blank" rel="nofollow sponsored noopener">${esc((t.goAt || (() => t.go))(provName(p.providerId)))}</a></li>`; };
    const rest = list.filter(p => !best.includes(p));
    return `<ol class="ladder">${best.map(row).join('')}</ol>` + (rest.length ? `<details class="more-offers"><summary>${esc(t.allOffersOf(list.length))}</summary><ol class="ladder">${list.map(row).join('')}</ol></details>` : '');
  };
  // çok satan kartı: üreticinin kendi fiyatı; aynı ürün başka sitelerde daha ucuzsa en ucuzu
  const bsCard = (p, maker) => {
    const g = groupOf.get(p.id), lo = g && g.lo.providerId !== p.providerId && g.lo.baseMinor < p.baseMinor ? g.lo : null;
    return `<a class="card" href="${g ? href(P.group(g.slug)) : href(P.product(p.id))}"><div class="ci">${img(p)}</div><div class="cb"><div class="ct">${esc(p.title)}</div>`
      + `<div class="cm">${g ? `<span class="sites">${esc(t.bs.sites(g.providers.size))}</span>` : esc(maker)}</div><div class="cp"><small>${esc(t.bs.at(maker))}</small><b>${esc(fmt(p.baseMinor))}</b></div>`
      + (lo ? `<div class="cm bs-lo">${esc(t.bs.cheaper(fmt(lo.baseMinor), provName(lo.providerId)))}</div>` : '') + '</div></a>';
  };
  const bsRow = b => { const name = provName(b.id); return `<div class="sec-head"><h2>${esc(t.bs.h(name))}</h2><a href="${href(P.maker(b.id))}">${t.seeAll} →</a></div><div class="cards hscroll">${b.items.map(p => bsCard(p, name)).join('')}</div><p class="muted sm">${esc(t.bs.src(name, H_date(b.checkedOn)))}</p>`; };
  const H_date = d => dateFmt.format(new Date(d + 'T12:00:00Z'));
  return { bsRow, delivered, t, P, fmt, numFmt, dateFmt, lastText, gTitle, pbBadge, priceHtml, ad, sponsor, img, imgTag, card, gcard, cards, gcards, tile, offers, itemsOf, icards };
}

// ---------- sayfa şablonu
const sitemap = [];
// alt: { en: rel, tr: rel } — hreflang ve dil geçişi için
// cat: sayfanın Etsy kategorisi (düğüm kimliği) — ziyaretçinin ilgisi tarayıcısında tutulur, ana sayfada "Senin için"
function page(L, H, { rel, title, description, body, jsonld, crumbs, alt, noindex, cat }) {
  const t = H.t;
  const canonical = SITE ? `<link rel="canonical" href="${esc(abs(rel))}">` : '';
  const alts = alt ? Object.entries(alt).map(([lg, r]) => `<link rel="alternate" hreflang="${lg}" href="${esc(SITE + href(r))}">`).join('') + (alt.en ? `<link rel="alternate" hreflang="x-default" href="${esc(SITE + href(alt.en))}">` : '') : '';
  // Cloudflare Web Analytics (çerezsiz ziyaretçi istatistiği): site.config.json cloudflareAnalyticsToken
  // Otomatik reklamların sabit (anchor) reklamı üstte çıkınca bütün sayfayı aşağı itiyordu (CLS ~0.97);
  // alta sabitlenince içeriğin üstüne biner, sayfa kaymaz.
  // 18 Eki 2026: betik adresindeki ?client= otomatik reklamları kendisi açıyordu; ardından gelen push
  // "Only one 'enable_page_level_ads' allowed" hatasıyla reddedilip overlays:{bottom} hiç uygulanmıyordu.
  // Betik client'sız yüklenir, otomatik reklamları tek push açar; hesap doğrulaması meta etiketiyle.
  const ads = (cfg.adsenseClient ? `<meta name="google-adsense-account" content="${esc(cfg.adsenseClient)}"><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js" crossorigin="anonymous"></script>`
    + `<script>(adsbygoogle=window.adsbygoogle||[]).push({google_ad_client:"${esc(cfg.adsenseClient)}",enable_page_level_ads:true,overlays:{bottom:true}});</script>` : '')
    + (cfg.cloudflareAnalyticsToken ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${esc(cfg.cloudflareAnalyticsToken)}"}'></script>` : '');
  const bc = crumbs ? `<nav class="crumbs" aria-label="Breadcrumb"><a href="${href(H.P.home)}">${t.home}</a>${crumbs.map(([c, h]) => h ? ` › <a href="${esc(h)}">${esc(c)}</a>` : ` › <span>${esc(c)}</span>`).join('')}</nav>` : '';
  const other = L.lang === 'en' ? 'tr' : 'en';
  const switchTo = alt?.[other] ?? LOCALES[other].path.home;
  const [b1, ...bRest] = BRAND.split(' ');
  return `<!doctype html><html lang="${L.lang}"><head><meta charset="utf-8"><meta name="saashub-verification" content="d9vo67gpscln"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}">${canonical}${alts}${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="website"><meta property="og:site_name" content="${esc(BRAND)}">${SITE ? `<meta property="og:image" content="${esc(SITE)}/assets/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">` : ''}<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/assets/site.css?v=${VER}"><link rel="icon" href="/assets/icon.svg" type="image/svg+xml">${ads}
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}</head><body data-lang="${L.lang}"${cat && eList.has(cat) && enode(cat).parentId ? ` data-cat="${esc(eSlug.get(cat))}" data-cat-label="${esc(L.node(cat))}"` : ''}>
<header class="top"><div class="wrap"><a class="brand" href="${href(H.P.home)}">${esc(b1)}<span>${esc(bRest.join(' '))}</span></a>
<form class="search" action="${href(H.P.search)}" role="search"><input name="q" type="search" placeholder="${esc(t.searchPh)}" aria-label="${esc(t.searchBtn)}" autocomplete="off"><button>${t.searchBtn}</button></form>
<nav class="topnav"><a href="${href(H.P.categories)}">${t.categories}</a><a href="${href(H.P.compare)}">${t.compare}</a><a href="${href(H.P.makers)}">${t.makers}</a><a href="${href(H.P.calc)}">${t.calc.nav}</a><a class="lang" href="${href(switchTo)}" hreflang="${other}" lang="${other}">${other.toUpperCase()}</a></nav></div></header>
<main class="wrap">${bc}${body}<div class="joins">${cfg.newsletterAction ? `<form class="nl" action="${esc(cfg.newsletterAction)}" method="post" data-ok="${esc(t.nl.ok)}" data-err="${esc(t.nl.err)}"><div><b>${esc(t.nl.h)}</b><p>${esc(t.nl.p)}</p></div><div class="nl-row"><input type="email" name="fields[email]" required placeholder="${esc(t.nl.ph)}" aria-label="${esc(t.nl.ph)}" autocomplete="email"><input type="hidden" name="ml-submit" value="1"><input type="hidden" name="anticsrf" value="true"><button class="cta">${esc(t.nl.btn)}</button></div><p class="nl-msg" role="status"></p></form>` : ''}${cfg.facebookGroup ? `<aside class="fbgroup"><div><b>${esc(t.fbGroup.h)}</b><p>${esc(t.fbGroup.p)}</p></div><a class="cta" href="${esc(cfg.facebookGroup)}" target="_blank" rel="noopener">${esc(t.fbGroup.btn)}</a></aside>` : ''}</div>${H.ad('alt')}</main>
<footer class="foot"><div class="wrap"><p>${esc(t.footer)}</p>
<p class="muted">${esc(t.footer2(H.lastText))}</p>
<p class="muted"><a href="${href(H.P.about)}">${t.foot[0]}</a> · <a href="${href(H.P.makers)}">${t.foot[1]}</a> · <a href="${href(H.P.vsIndex)}">${esc(t.vs.indexTitle)}</a> · <a href="${href(H.P.guides)}">${esc(t.guide.indexTitle)}</a> · <a href="${href(H.P.alts)}">${esc(t.alt.indexTitle)}</a> · <a href="${href(H.P.calc)}">${t.calc.nav}</a> · <a href="${href(H.P.profitIndex)}">${esc(t.profitPages.nav)}</a> · <a href="${href(H.P.index)}">${esc(t.pidx.nav)}</a>${L.lang === 'en' && reports.length ? ' · <a href="/reports/">Weekly price report</a>' : ''}${L.lang === 'tr' ? ` · <a href="${href(DDP.path)}">${esc(DDP.nav)}</a>` : ''} ·<a href="${href(H.P.widget)}">${esc(t.widget.title)}</a> · <a href="${href(H.P.privacy)}">${t.foot[2]}</a> · <a href="${href(H.P.contact)}">${t.foot[3]}</a></p>
<p><a href="https://fazier.com/" target="_blank" rel="noopener noreferrer"><img src="https://fazier.com/api/v1//public/badges/launch_badges.svg?badge_type=launched&amp;theme=light" width="105" alt="Launched on Fazier" loading="lazy" style="max-width:100%;height:auto"></a></p></div></footer>
<script src="/assets/site.js?v=${VER}" defer></script></body></html>`;
}

// ---------- üret
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync(path.join(root, 'web'), path.join(out, 'assets'), { recursive: true });
// pazar fiyat özetleri (ClickScrape ilan fiyatları; scripts/market-import.py) -> /data/market/<pazar>/<grup>.json
if (fs.existsSync(path.join(root, 'data/market'))) fs.cpSync(path.join(root, 'data/market'), path.join(out, 'data/market'), { recursive: true });
const add = (rel, html) => { write(rel, html); sitemap.push(rel); };

// istemci tarafı ortak veri: [id, başlık, üreticiId, fiyat, kaynakFiyat, görsel, (boş), tip, satışLinki, fiyatTürü]
const singlesOf = list => list.filter(p => !groupOf.has(p.id));
// kâr hesaplayıcı: ürün başına üretici teklifleri [üreticiId, ad, fiyat, fiyatTürü, ilkKargo|null, satışLinki] (baskılı olanlar önce)
for (const g of groups) {
  // üretici başına teklif: ABD'ye teslimde en ucuz baskılı ürün (tahmin edilemiyorsa en ucuz baskılı); karşılaştırma kutusuyla aynı seçim
  const best = [...groupBy(g.list, p => p.providerId)].map(([, l]) => {
    const printed = l.filter(p => !isBlank(p)), withD = printed.map(p => [p, deliveredUS(p)]).filter(z => z[1] != null).sort((u, v) => u[1] - v[1]);
    return withD.length ? withD[0][0] : printed[0] || l[0];
  });
  // [üretici, ad, fiyat, fiyat türü, kaynaktaki kargo, bağlantı, çıkış ülkesi, ABD kargosu (kuruş), kargo kaynağı, ABD vergi %, vergi notu] — 6+ alanlar scripts/landed-cost.cjs
  write(`data/g/${g.slug}.json`, JSON.stringify(best.map(p => { const lc = LC.landedUS(p); // 11: diğer varışlar {GB|EU|CA|AU: [çıkış, kargo, kaynak, vergi %, sabit vergi (kuruş), not, tesis fiyatı, tesis]}; 12-13: ABD için tesis fiyatı ve tesis (Printify)
    const other = Object.fromEntries(LC.DESTS.filter(d => d !== 'US').map(d => { const x = LC.landed(p, d); return [d, [x.origin, x.shipMinor, x.shipSrc, x.dutyRate, x.dutyFlatMinor, x.dutyNote, x.baseMinor, x.facility || null]]; }));
    return [p.providerId, provName(p.providerId), p.baseMinor, p.pb, p.shipping ? Object.values(p.shipping)[0] ?? null : null, outbound(p), lc.origin, lc.shipMinor, lc.shipSrc, lc.dutyRate, lc.dutyNote, other, lc.baseMinor, lc.facility || null]; })));
}
write('data/search.json', JSON.stringify(products.map(p => [p.id, p.title, p.providerId, p.baseMinor, p.imageUrl || '', p.type, p.model ? p.model.brandName + ' ' + p.model.model : '', p.pb])));

const typeOrder = [...byType.keys()].filter(k => k !== 'diger').sort((a, b) => (groupsByType.get(b)?.length || 0) - (groupsByType.get(a)?.length || 0) || byType.get(b).length - byType.get(a).length);
const typesOf = g => [...byType.keys()].filter(k => typeGroup(k) === g).sort((a, b) => byType.get(b).length - byType.get(a).length);
const groupsOrdered = tx.GROUPS.filter(([g]) => byGroup.has(g)).map(([g]) => g);

for (const lg of LANGS) {
  const L = LOCALES[lg], H = makeHelpers(L), t = H.t, P = H.P;
  const fmt = H.fmt, n = x => H.numFmt.format(x);
  const altAll = f => Object.fromEntries(LANGS.map(k => [k, f(LOCALES[k].path)]));
  const nodeTile = id => H.tile(href(P.cat(id)), repImage(eList.get(id)), L.node(id), t.products(n(eCount(id))));
  // ana sayfa kategori menüsü: Etsy ana kategorisi + en kalabalık alt kategorileri
  const catBox = id => {
    const subs = eChildren(id), top = subs.slice(0, 8), gh = href(P.cat(id));
    return `<div class="catbox"><a class="cbh" href="${gh}">${H.imgTag(repImage(eList.get(id)), L.node(id))}<b>${esc(L.node(id))}</b></a><ul>${top.map(k => `<li><a href="${href(P.cat(k))}">${esc(L.node(k))}</a><span>${n(eCount(k))}</span></li>`).join('')}</ul>${subs.length > 8 ? `<a class="cball" href="${gh}">${esc(t.subAll(subs.length))}</a>` : ''}</div>`;
  };

  write(`data/meta-${lg}.json`, JSON.stringify({
    lang: lg, providers: Object.fromEntries(catalog.providers.map(p => [p.id, p.name])),
    types: Object.fromEntries([...byType.keys()].map(k => [k, L.type(k)])), pb: L.pbLabel, pbNote: L.pbNote,
    // arama sonucunun türü -> ilgi kaydı için Etsy kategorisi [adres, ad]
    typeCat: Object.fromEntries([...typeNode].filter(([, id]) => enode(id).parentId).map(([k, id]) => [k, [eSlug.get(id), L.node(id)]])),
    paths: { cat: '/' + P.cat(eTops[0]).replace(/[^/]+\/$/, ''), product: '/' + P.product('ID').replace('ID/', ''), maker: '/' + P.maker('ID').replace('ID/', ''), group: '/' + P.group('ID').replace('ID/', '') },
    ui: lg === 'en'
      ? { sortAsc: 'Price: low to high', sortDesc: 'Price: high to low', allTypes: 'All price types', more: 'Show more', left: 'left', none: 'No results.', products: 'products', results: 'Results for', searchTitle: 'Search', typeQuery: 'Type a product, blank or manufacturer.', noHits: 'No results. Try a broader word or browse the categories.', failed: 'Search could not load.', allMakersLabel: 'All manufacturers', forYou: 'For you', forYouNote: 'Based on what you viewed', seeAll: 'See all', groupsH: 'Compare prices', productsH: 'Products', makers: 'manufacturers', sortSites: 'Sold at most stores', viewCards: 'Cards', viewTable: 'Price board', sitesN: 'Sold at {n} stores', cheapest: 'cheapest', th: ['Product', 'Stores', 'Lowest', 'Highest', 'Cheapest at'] }
      : { sortAsc: 'Fiyat: ucuzdan pahalıya', sortDesc: 'Fiyat: pahalıdan ucuza', allTypes: 'Tüm fiyat türleri', more: 'Daha fazla göster', left: 'kaldı', none: 'Sonuç bulunamadı.', products: 'ürün', results: 'Sonuçlar:', searchTitle: 'Arama', typeQuery: 'Ürün, model veya üretici adı yazın.', noHits: 'Sonuç bulunamadı. Daha genel bir kelime deneyin ya da kategorilere göz atın.', failed: 'Arama yüklenemedi.', allMakersLabel: 'Tüm üreticiler', forYou: 'Senin için', forYouNote: 'Baktığın ürünlere göre', seeAll: 'Hepsini gör', groupsH: 'Fiyat karşılaştır', productsH: 'Ürünler', makers: 'üretici', sortSites: 'En çok sitede satılan', viewCards: 'Kartlar', viewTable: 'Fiyat borsası', sitesN: '{n} sitede satılıyor', cheapest: 'en ucuz', th: ['Ürün', 'Site', 'En düşük', 'En yüksek', 'En ucuz site'] },
  }));
  // kategori listeleri: [adres, ad, görsel, en düşük, site sayısı, tek sitedeyse üretici, en yüksek, en ucuz site, [[üretici, fiyat]...]]
  const itemRow = it => [it.href, it.name, it.image || '', it.price, it.n, it.maker, it.hi, it.best, it.offers];
  // arama için ürün grupları: [slug, ad, görsel, en düşük fiyat, üretici sayısı, tip]
  write(`data/groups-${lg}.json`, JSON.stringify(groups.map(g => [g.slug, H.gTitle(g), g.image || '', g.lo.baseMinor, g.providers.size, g.type])));

  // ana sayfa (açıklama + SSS rakamları gerçek veriden)
  const topS = pidx.suppliers[0];
  const homeD = { m: connected.length, n: n(products.length), g: pidx.rows.length, gap: Math.round(pidx.gap * 100), top: topS ? provName(topS.id) : '', w: topS ? Math.max(0, Math.round((1 - topS.index) * 100)) : 0 };
  // ana sayfa kâr hesaplayıcı kutusu: yalnız en az bir üreticisinin gerçek teslim maliyeti bilinen ürünler (en çok üreticili önce)
  const withData = groups.filter(g => g.list.some(p => deliveredUS(p) != null)), homeCalc = withData.slice(0, 40), homeCalcN = withData.length;
  add(P.home + 'index.html', page(L, H, {
    rel: P.home + 'index.html', alt: altAll(p => p.home), title: t.homeTitle, description: t.homeDesc(connected.length, n(products.length)),
    jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', name: BRAND, alternateName: 'PODPricing', url: SITE + href(P.home + 'index.html') },
    body: `<section class="hero"><h1>${esc(t.heroH)}</h1><p>${esc(t.heroP(connected.length, n(products.length)))}</p>
<form class="search big" action="${href(P.search)}" role="search"><input name="q" type="search" placeholder="${esc(t.searchBig)}" aria-label="${esc(t.searchBtn)}" autocomplete="off"><button>${t.searchBtn}</button></form>
<div class="quick">${L.quick.map(q => `<a href="${href(P.search)}?q=${encodeURIComponent(q)}">${esc(q)}</a>`).join('')}</div></section>
<section class="hcalc"><div class="hcalc-t"><h2>${esc(t.hc.h)}</h2><p>${esc(t.hc.p)}</p></div>
<form class="hcalc-f" action="${href(P.calc)}" method="get">
<label>${esc(t.calc.product)}<select name="p">${homeCalc.map(g => `<option value="${esc(g.slug)}">${esc(H.gTitle(g))} · ${g.providers.size} ${L.lang === 'tr' ? 'üretici' : 'manufacturers'}</option>`).join('')}</select></label>
<label>${esc(t.calc.platform)}<select name="platform"><option value="etsy">Etsy</option><option value="shopify">Shopify</option><option value="amazon">Amazon Handmade</option></select></label>
<label>${esc(t.calc.dest)}<select name="dest">${t.calc.dests.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select></label>
<label>${esc(t.hc.price)}<input name="price" type="number" min="0" step="0.01" value="24.99"></label>
<button>${esc(t.hc.btn)}</button></form>
<p class="muted sm">${esc(t.hc.note(homeCalcN, groups.length))}</p></section>
<section id="foryou" hidden></section>
<div class="sec-head"><h2>${t.catMenu}</h2><a href="${href(P.categories)}">${t.seeAll} →</a></div><div class="catmenu compact">${eTops.map(catBox).join('')}</div>
<a class="verdict" style="display:block" href="${href(P.index)}"><b>${esc(t.pidx.homeCta(Math.round(pidx.gap * 100)))}</b></a>
${H.ad('ust')}
${bestsellers.slice(0, 1).map(b => H.bsRow(b)).join('')}${bestsellers.length > 1 ? `<div class="chips">${bestsellers.slice(1).map(b => `<a class="chip" href="${href(P.maker(b.id))}"><b>${esc(t.bs.h(provName(b.id)))}</b></a>`).join('')}</div>` : ''}
<div class="sec-head"><h2>${t.topGroups}</h2><a href="${href(P.compare)}">${t.seeAll} →</a></div>${H.icards(H.itemsOf(groups.slice(0, 8), []))}
<div class="sec-head"><h2>${esc(t.guide.indexTitle)}</h2><a href="${href(P.guides)}">${t.seeAll} →</a></div><div class="chips">${[...guides.keys()].slice(0, 10).map(k => `<a class="chip" href="${href(P.guide(k))}"><b>${esc(L.type(k))}</b><span>${esc(t.from(fmt(guides.get(k).lo.baseMinor)))}</span></a>`).join('')}</div>
<h2>${esc(t.homeAboutH)}</h2><div class="prose">${t.homeAbout(homeD).map(x => `<p>${esc(x)}</p>`).join('')}</div>
<h2>${esc(t.homeFaqH)}</h2><div class="prose">${t.homeFaq(homeD).map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('')}</div>`,
    // alternateName: Google "podpricing" (bitişik) aramasını markayla eşleştirsin; Organization + logo site adı/ikonu için
    jsonld: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'WebSite', '@id': SITE + '/#website', name: BRAND, alternateName: ['PodPricing', 'podpricing.com'], url: SITE || undefined, inLanguage: lg, publisher: { '@id': SITE + '/#org' }, potentialAction: { '@type': 'SearchAction', target: SITE + href(P.search) + '?q={q}', 'query-input': 'required name=q' } },
      // sameAs: markanın doğrulanmış hesapları (Google bilgi grafiğinde siteyle aynı varlık olarak bağlasın)
      { '@type': 'Organization', '@id': SITE + '/#org', name: BRAND, alternateName: ['PodPricing', 'podpricing.com'], url: SITE || undefined, logo: SITE + '/assets/logo.png', sameAs: ['https://www.youtube.com/@podpricing', 'https://www.instagram.com/podpricing/'] },
      { '@type': 'FAQPage', '@id': SITE + href(P.home) + '#faq', mainEntity: t.homeFaq(homeD).map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    ] },
  }));

  // kategoriler dizini: Etsy ana kategorileri ve ilk alt kategorileri
  add(P.categories + 'index.html', page(L, H, {
    rel: P.categories + 'index.html', alt: altAll(p => p.categories), title: `${t.catsTitle} · ${BRAND}`, description: t.catsDesc, crumbs: [[t.categories]],
    body: `<h1>${t.categories}</h1>${eTops.map(id => `<div class="sec-head"><h2>${esc(L.node(id))}</h2><a href="${href(P.cat(id))}">${t.seeAll} →</a></div><div class="tiles">${(eChildren(id).length ? eChildren(id) : [id]).map(nodeTile).join('')}</div>`).join('')}`,
  }));

  // Etsy kategori sayfaları: alt kategori kutuları + alt ağaçtaki bütün ürünler (ana kategoride en çok karşılaştırılanlar)
  for (const [id, list] of eList) {
    const label = L.node(id), kids = eChildren(id), provN = new Set(list.map(p => p.providerId)).size, root = !enode(id).parentId;
    const items = H.itemsOf(eGroups.get(id) || [], list.filter(p => !groupOf.has(p.id)));
    // açıklama + SSS: üretici başına en ucuz (boş/toplu ürün hariç) teklif, en az 3 üretici varsa
    const cBest = [...groupBy(list.filter(p => !isBlank(p)), p => p.providerId)].map(([, l]) => l.reduce((a, b) => a.baseMinor <= b.baseMinor ? a : b)).sort((a, b) => a.baseMinor - b.baseMinor);
    const cd = cBest.length >= 3 ? { N: n(list.length), n: cBest.length, lo: fmt(cBest[0].baseMinor), loP: provName(cBest[0].providerId), med: fmt(median(cBest.map(x => x.baseMinor))), p2: cBest.slice(1, 3).map(x => `${provName(x.providerId)} (${fmt(x.baseMinor)})`).join(lg === 'tr' ? ' ve ' : ' and ') } : null;
    const cFaq = cd ? t.catFaq(label, cd) : [];
    if (!root) write(`data/k/${lg}/${eSlug.get(id)}.json`, JSON.stringify(items.map(itemRow)));
    add(P.cat(id) + 'index.html', page(L, H, {
      rel: P.cat(id) + 'index.html', alt: altAll(p => p.cat(id)), cat: id, title: `${t.catTitle(label, cd ? cd.n : provN, cd ? cd.lo : fmt(list[0].baseMinor))} · ${BRAND}`, description: t.catDesc(label, list.length, cd ? cd.lo : fmt(list[0].baseMinor), cd),
      crumbs: [[t.categories, href(P.categories)], ...eAnc(id).map(a => [L.node(a), href(P.cat(a))]), [label]],
      body: `<h1>${esc(t.catH1(label))}</h1><p class="muted">${t.products(n(list.length))} · ${t.makersN(provN)} · ${t.from(fmt(list[0].baseMinor))}</p>${cd ? `<p class="prose">${esc(t.catAbout(label, cd))}</p>` : ''}
${kids.length ? `<div class="tiles">${kids.map(nodeTile).join('')}</div>` : ''}${H.sponsor(mostCommon(list.map(p => p.type)))}${H.ad('liste')}
${root ? (eGroups.get(id) || []).length ? `<h2>${t.topGroups}</h2>${H.icards(H.itemsOf(eGroups.get(id).slice(0, 24), []))}` : ''
    : `${kids.length ? `<h2>${esc(t.itemsH)}</h2>` : ''}<div class="list" data-items="/data/k/${lg}/${eSlug.get(id)}.json">${H.icards(items.slice(0, 48))}</div>`}${cFaq.length ? `<h2>${esc(t.catFaqH)}</h2><div class="prose">${cFaq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('')}</div>` : ''}`,
      jsonld: { '@context': 'https://schema.org', '@graph': [{ '@type': 'ItemList', name: label, numberOfItems: list.length, itemListElement: list.slice(0, 10).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + href(LOCALES.en.path.product(p.id)), name: p.title })) }].concat(cFaq.length ? [{ '@type': 'FAQPage', mainEntity: cFaq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }] : []) },
    }));
  }

  // karşılaştırma dizini ve ürün karşılaştırma sayfaları (sitenin ana sayfa türü)
  add(P.compare + 'index.html', page(L, H, {
    rel: P.compare + 'index.html', alt: altAll(p => p.compare), title: `${t.compareTitle} · ${BRAND}`, description: t.compareDesc(groups.length), crumbs: [[t.compare]],
    body: `<h1>${t.compare}</h1><p class="muted">${esc(t.compareIntro)}</p>${H.gcards(groups)}`,
  }));
  for (const gp of groups) {
    const title = H.gTitle(gp), lo = gp.lo, hi = gp.hi;
    // açıklama + SSS: yalnızca 'baskı dahil' tekliflerden üretici başına en ucuz (boş/toplu/belirsiz hariç), gerçek veriden
    const bestP = [...groupBy(gp.list.filter(p => p.pb === 'dahil'), p => p.providerId)].map(([, l]) => l.reduce((a, b) => a.baseMinor <= b.baseMinor ? a : b)).sort((a, b) => a.baseMinor - b.baseMinor);
    const gd = bestP.length >= 2 ? (() => {
      const f = bestP[0], l = bestP[bestP.length - 1], pfo = bestP.find(x => x.providerId === 'printful'), pyo = bestP.find(x => x.providerId === 'printify');
      const pf = pfo && pyo ? (lg === 'tr'
        ? (pfo.baseMinor === pyo.baseMinor ? `İkisi de ${fmt(pfo.baseMinor)}.` : `${pfo.baseMinor < pyo.baseMinor ? 'Printful' : 'Printify'} daha ucuz: Printful ${fmt(pfo.baseMinor)}, Printify ${fmt(pyo.baseMinor)}.`)
        : (pfo.baseMinor === pyo.baseMinor ? `They cost the same, ${fmt(pfo.baseMinor)}.` : `${pfo.baseMinor < pyo.baseMinor ? 'Printful' : 'Printify'} is cheaper: Printful ${fmt(pfo.baseMinor)}, Printify ${fmt(pyo.baseMinor)}.`)) : '';
      return { t: title, n: bestP.length, lo: fmt(f.baseMinor), loP: provName(f.providerId), hi: fmt(l.baseMinor), hiP: provName(l.providerId), med: fmt(median(bestP.map(x => x.baseMinor))), gap: Math.round((l.baseMinor / f.baseMinor - 1) * 100), p2: bestP.slice(1, 3).map(x => `${provName(x.providerId)} (${fmt(x.baseMinor)})`).join(lg === 'tr' ? ' ve ' : ' and '), pf };
    })() : null;
    // Cimri tarzı: en üstte "N üretici arasında en ucuz" kutusu + kaydırınca üstte sabit kalan aynı şerit (site.js gösterir)
    const gbest = (gp, title) => {
      const pool = gp.list.filter(p => !isBlank(p)).length ? gp.list.filter(p => !isBlank(p)) : gp.list, b = pool.reduce((a, c) => c.baseMinor < a.baseMinor ? c : a), m = provName(b.providerId);
      const box = cls => `<div class="${cls}"><div class="gb-t"><span class="gb-badge">${esc(t.bestOf(gp.providers.size))}</span><span class="gb-m">${esc(m)}</span><b class="gb-p">${esc(fmt(b.baseMinor))}</b>${cls === 'gstick' ? `<span class="gb-n">${esc(title)}</span>` : ''}</div><a class="cta gb-go" href="${esc(outbound(b))}" target="_blank" rel="nofollow sponsored noopener">${esc(t.goAt(m))}</a></div>`;
      // kargo + vergi sonrası en ucuz (yalnız tahmin edilebilen teklifler arasında)
      const perProv = [...groupBy(pool, x => x.providerId)].map(([, l]) => l.map(x => [x, H.delivered(x)]).filter(z => z[1] != null).sort((u, v) => u[1] - v[1])[0]).filter(Boolean);
      const dl = perProv.sort((u, v) => u[1] - v[1])[0];
      const dline = dl ? `<p class="gb-dlv">${esc(t.dlv.best(provName(dl[0].providerId), fmt(dl[1]), perProv.length, gp.providers.size))} · <a href="${href(P.calc)}?p=${encodeURIComponent(gp.slug)}">${esc(t.dlv.more)}</a>${hasProfit(gp) ? ` · <a href="${href(P.profit(gp.slug))}">${esc(t.dlv.keep)}</a>` : ''}</p>` : '';
      return box('gbest').replace(/<\/div>$/, dline + '</div>') + box('gstick');
    };
    // en ucuz fiyat geçmişi: sunucuda çizilen basamaklı SVG (en az 5 gün veri varsa)
    const ghist = slug => {
      const row = gHist.lo[slug]; if (!row) return '';
      const pts = gHist.dates.map((d, i) => [d, row[i]]).filter(x => x[1] != null);
      if (pts.length < 5) return '';
      const vals = pts.map(x => x[1]), lo = Math.min(...vals), hi = Math.max(...vals), W = 600, H = 120, pad = 8;
      const t0 = Date.parse(pts[0][0]), t1 = Date.parse(pts.at(-1)[0]), x = d => pad + (W - 2 * pad) * (t1 > t0 ? (Date.parse(d) - t0) / (t1 - t0) : 1);
      // ölçek en az fiyatın %20'si: kur kaynaklı birkaç sentlik oynama uçurum gibi görünmesin
      const span = Math.max(hi - lo, hi * 0.2), top = (hi + lo) / 2 + span / 2, y = v => pad + (H - 2 * pad) * (top - v) / span;
      const path = pts.map(([d, v], i) => (i ? `H${x(d).toFixed(1)}V${y(v).toFixed(1)}` : `M${x(d).toFixed(1)} ${y(v).toFixed(1)}`)).join('');
      const days = Math.round((t1 - t0) / 864e5) + 1, ld = pts.find(p => p[1] === lo)[0], day = dt => new Intl.DateTimeFormat(L.intl, { day: 'numeric', month: 'short' }).format(new Date(dt + 'T12:00:00Z'));
      const txt = hi === lo ? t.histFlat(days, fmt(lo)) : t.histMove(fmt(lo), day(ld), fmt(hi), fmt(vals.at(-1)));
      return `<section class="ghist"><h2>${esc(t.histH)}</h2><p>${esc(txt)}</p><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(txt)}" preserveAspectRatio="none"><path d="${path}H${W - pad}" fill="none" stroke="var(--price)" stroke-width="3" vector-effect="non-scaling-stroke"/></svg><div class="gh-ax"><span>${esc(day(pts[0][0]))}</span><span>${esc(day(pts.at(-1)[0]))}</span></div><p class="muted sm">${esc(t.histNote)}</p></section>`;
    };
    const gFaq = gd ? t.grpFaq(gd) : [];
    const sibs = gp.type && gp.type !== 'diger' ? (groupsByType.get(gp.type) || []).filter(x => x !== gp).sort((a, b) => b.providers.size - a.providers.size).slice(0, 12) : [];
    const sibBox = sibs.length ? `<h2>${esc(t.sibH(L.type(gp.type)))}</h2><div class="chips">${sibs.map(x => `<a class="chip" href="${href(P.group(x.slug))}"><b>${esc(H.gTitle(x))}</b><span>${esc(t.from(fmt(x.lo.baseMinor)))} · ${esc(t.makersN(x.providers.size))}</span></a>`).join('')}</div>${guides.has(gp.type) ? `<p><a class="go" href="${href(P.guide(gp.type))}">${esc(t.sibGuide(L.type(gp.type)))}</a></p>` : ''}` : '';
    add(P.group(gp.slug) + 'index.html', page(L, H, {
      rel: P.group(gp.slug) + 'index.html', alt: altAll(p => p.group(gp.slug)), cat: gp.etsy,
      title: `${t.groupTitle(title, gp.providers.size, fmt(lo.baseMinor))} · ${BRAND}`, description: t.groupDesc(title, gp.providers.size, fmt(lo.baseMinor), provName(lo.providerId)),
      crumbs: [...eAnc(gp.etsy).slice(-1).map(a => [L.node(a), href(P.cat(a))]), [L.node(gp.etsy), href(P.cat(gp.etsy))], [title]],
      body: `<section class="ghead"><div class="gimg">${H.imgTag(gp.image, title)}</div><div><h1>${esc(title)}</h1>
${gbest(gp, title)}
<p class="muted sm">${esc(t.range(fmt(lo.baseMinor), fmt(hi.baseMinor)))} · ${esc(gp.key.startsWith('m:') ? t.groupNoteModel : t.groupNoteSpec)}</p></div></section>
${H.sponsor(gp.type)}<h2>${esc(t.offersH(gp.providers.size))}</h2><p class="muted sm">${esc(t.cheapestFirst)}</p><div class="sellbox"><label>${esc(t.sellL)} <span class="cur">$<input id="sell" type="number" min="0" step="0.01" inputmode="decimal" placeholder="24.99"></span></label><span class="muted sm">${esc(t.sellNote)}</span></div>${H.offers(gp.list)}${ghist(gp.slug)}${H.ad('liste')}
<p class="muted sm"><a class="go" href="${href(P.widget)}?p=${encodeURIComponent(gp.slug)}">${esc(t.widget.embedLink)}</a></p>
${gd ? `<h2>${esc(t.grpAboutH(title))}</h2><div class="prose">${t.grpAbout(gd).map(x => `<p>${esc(x.trim())}</p>`).join('')}</div><h2>${esc(t.grpFaqH)}</h2><div class="prose">${gFaq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a.trim())}</p>`).join('')}</div>` : ''}${sibBox}${rvBox('group:' + gp.slug, title, false)}`,
      jsonld: { '@context': 'https://schema.org', '@graph': [{ '@type': 'Product', name: title, image: gp.image || undefined, brand: gp.sample.model ? { '@type': 'Brand', name: gp.sample.model.brandName } : undefined,
        offers: { '@type': 'AggregateOffer', priceCurrency: 'USD', lowPrice: (lo.baseMinor / 100).toFixed(2), highPrice: (hi.baseMinor / 100).toFixed(2), offerCount: gp.list.length } }]
        .concat(gFaq.length ? [{ '@type': 'FAQPage', mainEntity: gFaq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a.trim() } })) }] : []) },
    }));
  }

  // Bloglar için gömülebilir fiyat kutusu: /embed/<slug>/ (yalnızca İngilizce, noindex) + kutu oluşturma sayfası
  if (lg === 'en') {
    const day = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(lastCheck || Date.now()));
    for (const gp of groups) {
      const best = [...groupBy(gp.list, p => p.providerId)].map(([, l]) => l.find(p => !isBlank(p)) || l[0]).sort((a, b) => isBlank(a) - isBlank(b) || a.baseMinor - b.baseMinor).slice(0, 8);
      const title = H.gTitle(gp), full = SITE + href(P.group(gp.slug));
      write(`embed/${gp.slug}/index.html`, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><link rel="canonical" href="${esc(full)}"><title>${esc(title)} prices · ${BRAND}</title>
<style>body{margin:0;font:14px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1a1d23;background:#fff}.w{border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}.h{padding:10px 12px;background:#f5f6f8;font-weight:700;display:flex;justify-content:space-between;gap:8px}.h span{font-weight:400;color:#6b7280;font-size:12px}
ol{list-style:none;margin:0;padding:0}li{display:flex;align-items:center;gap:8px;padding:7px 12px;border-top:1px solid #eef0f3}li:first-child b{color:#0b8a5c}.r{width:18px;color:#6b7280;font-size:12px}.n{flex:1}.n a{color:inherit;text-decoration:none}.p{font-weight:700}.t{font-size:11px;color:#6b7280}
.f{padding:8px 12px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;display:flex;justify-content:space-between;gap:8px}.f a{color:#0f9d6b;font-weight:600;text-decoration:none}</style></head><body><div class="w">
<div class="h">${esc(title)} <span>${esc(t.makersN(gp.providers.size))}</span></div><ol>
${best.map((p, i) => `<li><span class="r">${i + 1}</span><span class="n"><a href="${esc(outbound(p))}" target="_blank" rel="nofollow sponsored noopener">${esc(provName(p.providerId))}</a>${isBlank(p) ? ' <span class="t">blank</span>' : ''}</span><b class="p">${esc(fmt(p.baseMinor))}</b></li>`).join('')}
</ol><div class="f"><span>Base cost · updated ${esc(day)}</span><a href="${esc(full)}" target="_blank" rel="noopener">All prices on POD Pricing →</a></div></div></body></html>`);
    }
  }
  const W = t.widget;
  add(P.widget + 'index.html', page(L, H, {
    rel: P.widget + 'index.html', alt: altAll(p => p.widget), title: `${W.title} · ${BRAND}`, description: W.desc, crumbs: [[W.title]],
    body: `<h1>${esc(W.title)}</h1><p class="muted">${esc(W.intro)}</p>
<form id="widget" class="calc" onsubmit="return false"><label class="wide">${esc(W.pick)}<select name="g"><option value="">—</option></select></label></form>
<div id="widget-out" hidden><h2>${esc(W.code)}</h2><textarea id="widget-code" readonly rows="5" class="code"></textarea><p><button type="button" id="widget-copy" class="more" style="margin:8px 0">${esc(W.copy)}</button></p>
<h2>${esc(W.preview)}</h2><div id="widget-preview"></div></div>
<p class="muted sm">${esc(W.note)}</p>`,
  }));

  // üreticiler
  const monthNow = new Intl.DateTimeFormat(L.intl, { month: 'long', year: 'numeric' }).format(new Date());
  const provRows = catalog.providers.map(p => ({ p, list: byProvider.get(p.id) || [] })).sort((a, b) => b.list.length - a.list.length || a.p.name.localeCompare(b.p.name));
  add(P.makers + 'index.html', page(L, H, {
    rel: P.makers + 'index.html', alt: altAll(p => p.makers), title: `${t.makersTitle} · ${BRAND}`, description: t.makersDesc(catalog.providers.length), crumbs: [[t.makers]],
    body: `<h1>${t.makers}</h1><p class="muted">${esc(t.makersIntro(connected.length, catalog.providers.length - connected.length))}</p>
<p><a class="go" href="${href(P.vsIndex)}">${esc(t.vs.indexTitle)} →</a></p>
<div class="tbl"><table><thead><tr><th>${t.mk[0]}</th><th class="num">${t.mk[1]}</th><th class="num">${t.mk[2]}</th><th>${t.mk[3]}</th></tr></thead><tbody>
${provRows.map(({ p, list }) => `<tr><td><a href="${href(P.maker(p.id))}"><b>${esc(p.name)}</b></a></td><td class="num">${list.length || '–'}</td><td class="num">${list.length ? fmt(list[0].baseMinor) : '–'}</td><td class="sm">${list.length ? t.compared : esc(reasonOf(p, L)) + ` · ${homeLink(p, t.visit)}`}</td></tr>`).join('')}
</tbody></table></div>`,
  }));
  for (const { p, list } of provRows) {
    const types = [...groupBy(list, x => x.type)].sort((a, b) => b[1].length - a[1].length);
    add(P.maker(p.id) + 'index.html', page(L, H, {
      rel: P.maker(p.id) + 'index.html', alt: altAll(x => x.maker(p.id)), title: `${t.makerTitle(p.name, list.length, monthNow)} · ${BRAND}`, description: t.makerDesc(p.name, list.length, list.length ? fmt(list[0].baseMinor) : '', types.filter(([k]) => k !== 'diger').slice(0, 3).map(([k, l]) => [L.type(k), fmt(l[0].baseMinor)])),
      crumbs: [[t.makers, href(P.makers)], [p.name]],
      body: `<h1>${esc(p.name)}</h1>${rvSum('maker:' + p.id)}<p>${homeLink(p, `${esc(new URL(p.homepage).hostname.replace(/^www\./, ''))} ↗`)}</p>
${list.length ? `<p class="muted">${t.makerStats(list.length, types.length, fmt(list[0].baseMinor))}</p>
<div class="chips">${[...groupBy(list, x => x.etsy)].sort((a, b) => b[1].length - a[1].length).map(([k, l]) => `<a class="chip" href="${href(P.cat(k))}"><b>${esc(L.node(k))}</b><span>${t.products(l.length)} · ${t.from(fmt(l[0].baseMinor))}</span></a>`).join('')}</div>
${altProviders.includes(p.id) ? `<p><a class="go" href="${href(P.alt(p.id))}">${esc(t.alt.h1(p.name))} →</a></p>` : ''}${vsOf.has(p.id) ? `<h2>${esc(t.vs.makerH(p.name))}</h2><div class="chips">${vsOf.get(p.id).slice(0, 20).map(v => `<a class="chip" href="${href(P.vs(v.slug))}"><b>${esc(provName(v.a))} vs ${esc(provName(v.b))}</b><span>${esc(t.vs.shared(v.rows.length))}</span></a>`).join('')}</div>` : ''}
<h2>${t.makerTop}</h2>${H.cards(list.slice(0, 40))}` : `<p class="muted">${esc(t.noPrices(reasonOf(p, L)))}</p>`}${rvBox('maker:' + p.id, p.name, true)}`,
    }));
  }

  // üretici ikilisi karşılaştırmaları
  const V = t.vs;
  const pctOf = v => Math.round(Math.abs(v.sumA - v.sumB) / Math.max(v.sumA, v.sumB) * 100);
  const verdict = v => pctOf(v) < 3 ? V.verdictTie(provName(v.a), provName(v.b)) : v.sumA < v.sumB ? V.verdictA(provName(v.a), provName(v.b), pctOf(v)) : V.verdictA(provName(v.b), provName(v.a), pctOf(v));
  const vsLink = v => `<a class="chip" href="${href(P.vs(v.slug))}"><b>${esc(provName(v.a))} vs ${esc(provName(v.b))}</b><span>${esc(V.shared(v.rows.length))}</span></a>`;
  add(P.vsIndex + 'index.html', page(L, H, {
    rel: P.vsIndex + 'index.html', alt: altAll(p => p.vsIndex), title: `${V.indexTitle} · ${BRAND}`, description: V.indexDesc(vsPairs.length), crumbs: [[V.indexTitle]],
    body: `<h1>${esc(V.indexTitle)}</h1><p class="muted">${esc(V.indexIntro)}</p><div class="chips">${vsPairs.map(vsLink).join('')}</div>`,
  }));
  for (const v of vsPairs) {
    const A = provName(v.a), B = provName(v.b), cnt = v.rows.length;
    const side = (id, sum) => { const l = byProvider.get(id) || []; return `<div class="vs-side"><a href="${href(P.maker(id))}"><b>${esc(provName(id))}</b></a><span>${esc(t.products(n(l.length)))} · ${esc(V.lowest)} ${esc(fmt(l[0].baseMinor))}</span><span>${H.pbBadge(PB.printBasis({ providerId: id, title: '' }))}</span><span class="sm muted">${esc(V.wins(provName(id), id === v.a ? v.aWins : v.bWins, cnt))}</span>${homeLink(providers.get(id), `${esc(new URL(providers.get(id).homepage).hostname.replace(/^www\./, ''))} ↗`)}</div>`; };
    const rowHtml = r => {
      const d = r.a.baseMinor - r.b.baseMinor, win = d < 0 ? 'a' : d > 0 ? 'b' : '';
      return `<tr><td><a href="${href(P.group(r.g.slug))}">${esc(H.gTitle(r.g))}</a></td><td class="num${win === 'a' ? ' win' : ''}"><a href="${esc(outbound(r.a))}" target="_blank" rel="nofollow sponsored noopener">${esc(fmt(r.a.baseMinor))}</a></td><td class="num${win === 'b' ? ' win' : ''}"><a href="${esc(outbound(r.b))}" target="_blank" rel="nofollow sponsored noopener">${esc(fmt(r.b.baseMinor))}</a></td><td class="num sm">${d === 0 ? esc(V.same) : `${esc(provName(win === 'a' ? v.a : v.b))} −${esc(fmt(Math.abs(d)))}`}</td></tr>`;
    };
    const others = [...new Set([...(vsOf.get(v.a) || []), ...(vsOf.get(v.b) || [])])].filter(x => x !== v).slice(0, 16);
    const winnerLine = verdict(v);
    const tps = vsByType(v), tpct = x => Math.round(Math.abs(x.sumA - x.sumB) / Math.max(x.sumA, x.sumB) * 100), twin = x => provName(x.sumA <= x.sumB ? v.a : v.b);
    const vFaq = [[V.q1(A, B), V.a1(winnerLine, V.totals(cnt, A, fmt(v.sumA), B, fmt(v.sumB)), A, v.aWins, B, v.bWins, cnt)]]
      .concat(tps.slice(0, 3).map(x => [V.qT(A, B, L.type(x.type)), V.aT(L.type(x.type), x.n, twin(x), tpct(x), A, x.aWins, B, x.bWins)]));
    add(P.vs(v.slug) + 'index.html', page(L, H, {
      rel: P.vs(v.slug) + 'index.html', alt: altAll(p => p.vs(v.slug)), title: `${V.title(A, B, monthNow)} · ${BRAND}`, description: V.desc(A, B, cnt, winnerLine),
      crumbs: [[V.indexTitle, href(P.vsIndex)], [`${A} vs ${B}`]],
      body: `<h1>${esc(V.h1(A, B))}</h1><p class="muted">${esc(V.sub)} · ${esc(V.shared(cnt))}</p>
<div class="verdict"><b>${esc(winnerLine)}.</b><p>${esc(V.totals(cnt, A, fmt(v.sumA), B, fmt(v.sumB)))}</p></div>
<div class="vs-sides">${side(v.a)}${side(v.b)}</div>${H.ad('liste')}
<div class="tbl"><table class="vs-table"><thead><tr><th>${esc(V.th[0])}</th><th class="num">${esc(A)}</th><th class="num">${esc(B)}</th><th class="num">${esc(V.th[1])}</th></tr></thead><tbody>${v.rows.map(rowHtml).join('')}</tbody></table></div>
<p class="muted sm">${esc(V.note)}</p>${tps.length >= 2 ? `<h2>${esc(V.typeH(A, B))}</h2><div class="tbl"><table><thead><tr><th>${esc(V.tth[0])}</th><th class="num">${esc(V.tth[1])}</th><th>${esc(V.tth[2])}</th></tr></thead><tbody>${tps.map(x => `<tr><td>${esc(L.type(x.type))}</td><td class="num">${x.n}</td><td>${esc(V.typeWin(twin(x), tpct(x)))}</td></tr>`).join('')}</tbody></table></div>` : ''}<h2>${esc(V.faqH)}</h2><div class="prose">${vFaq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('')}</div>${others.length ? `<h2>${esc(V.others)}</h2><div class="chips">${others.map(vsLink).join('')}</div>` : ''}`,
      jsonld: { '@context': 'https://schema.org', '@graph': [{ '@type': 'WebPage', name: V.title(A, B, monthNow), about: [A, B].map(name => ({ '@type': 'Organization', name })) }, { '@type': 'FAQPage', mainEntity: vFaq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }] },
    }));
  }

  // "En ucuz ..." rehberleri
  const GU = t.guide, month = new Intl.DateTimeFormat(L.intl, { month: 'long', year: 'numeric' }).format(new Date());
  const guideChip = k => `<a class="chip" href="${href(P.guide(k))}"><b>${esc(L.type(k))}</b><span>${esc(t.from(fmt(guides.get(k).lo.baseMinor)))}</span></a>`;
  add(P.guides + 'index.html', page(L, H, {
    rel: P.guides + 'index.html', alt: altAll(p => p.guides), title: `${GU.indexTitle} · ${BRAND}`, description: GU.indexDesc, crumbs: [[GU.indexTitle]],
    body: `<h1>${esc(GU.indexTitle)}</h1><p class="muted">${esc(GU.indexDesc)}</p><div class="chips">${[...guides.keys()].map(guideChip).join('')}</div>`,
  }));
  for (const [k, s] of guides) {
    // başlık: yeterli sayıda üründe karşılaştırılmış, ortalamada en ucuz üretici (az ürünle şişen sonuçlar öne çıkmasın)
    const solid = s.suppliers.filter(x => x.n >= Math.max(5, Math.round(s.rows.length * 0.1)));
    const label = L.type(k), top = solid[0] || s.suppliers[0], second = (solid[1] || s.suppliers[1]);
    const faq = [[GU.q1(label), GU.a1(label, provName(top.id), Math.max(0, Math.round((1 - top.index) * 100)), s.rows.length, second?.wins ? provName(second.id) : '')], [GU.q2(label), GU.a2(fmt(s.lo.baseMinor), fmt(s.med))]];
    if (s.pf.n) faq.push([GU.q3(label), GU.a3(s.pf.n, s.pf.printful, s.pf.printify)]);
    add(P.guide(k) + 'index.html', page(L, H, {
      rel: P.guide(k) + 'index.html', alt: altAll(p => p.guide(k)), title: `${GU.title(label, month)} · ${BRAND}`, description: GU.desc(label, provName(top.id), fmt(s.lo.baseMinor), s.rows.length),
      crumbs: [[GU.indexTitle, href(P.guides)], [label]],
      body: `<h1>${esc(GU.h1(label, month))}</h1><p class="muted sm">${esc(GU.upd(month))}</p>
<div class="verdict"><p style="color:var(--ink);margin:0">${esc(GU.lead(label, s.rows.length, provName(top.id), Math.max(0, Math.round((1 - top.index) * 100)), fmt(s.lo.baseMinor), fmt(s.med)))}</p></div>
<h2>${esc(GU.rankH)}</h2><p class="muted sm">${esc(GU.rankP)}</p>
<div class="tbl"><table><thead><tr><th>${GU.rth[0]}</th><th class="num">${GU.rth[1]}</th><th class="num">${GU.rth[2]}</th><th class="num">${GU.rth[3]}</th></tr></thead><tbody>
${s.suppliers.slice(0, 15).map((x, i) => `<tr><td>${i + 1}. <a href="${href(P.maker(x.id))}"><b>${esc(provName(x.id))}</b></a></td><td class="num${x.index < 1 ? ' win' : ''}">${Math.round(x.index * 100)} <span class="muted sm">(${esc(GU.vsMed(Math.round((x.index - 1) * 100)))})</span></td><td class="num">${x.wins}</td><td class="num">${x.n}</td></tr>`).join('')}
</tbody></table></div>${H.ad('liste')}
<h2>${esc(GU.topH(label))}</h2>
<div class="tbl"><table><thead><tr><th>${GU.tth[0]}</th><th class="num">${GU.tth[1]}</th><th>${GU.tth[2]}</th><th class="num">${GU.tth[3]}</th></tr></thead><tbody>
${s.rows.slice(0, 20).map(r => `<tr><td><a href="${href(P.group(r.g.slug))}">${esc(H.gTitle(r.g))}</a></td><td class="num">${r.offers.length}</td><td><b class="lo">${esc(fmt(r.offers[0].baseMinor))}</b> <span class="muted sm">${esc(provName(r.offers[0].providerId))}</span></td><td class="num">${esc(fmt(r.med))}</td></tr>`).join('')}
</tbody></table></div>
<p><a class="go" href="${href(P.cat(typeNode.get(k)))}">${esc(GU.allProducts(label))}</a> · <a class="go" href="${href(P.calc)}">${esc(GU.calcCta)}</a></p>
<h2>${esc(GU.faqH)}</h2><div class="prose">${faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('')}</div>
<h2>${esc(GU.more)}</h2><div class="chips">${[...guides.keys()].filter(x => x !== k).slice(0, 16).map(guideChip).join('')}</div>`,
      jsonld: { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    }));
  }

  // "X alternatifleri"
  const AL = t.alt;
  add(P.alts + 'index.html', page(L, H, {
    rel: P.alts + 'index.html', alt: altAll(p => p.alts), title: `${AL.indexTitle} · ${BRAND}`, description: AL.indexDesc, crumbs: [[AL.indexTitle]],
    body: `<h1>${esc(AL.indexTitle)}</h1><p class="muted">${esc(AL.indexDesc)}</p><div class="chips">${altProviders.map(id => `<a class="chip" href="${href(P.alt(id))}"><b>${esc(AL.h1(provName(id)))}</b><span>${esc(V.shared(vsOf.get(id).length))}</span></a>`).join('')}</div>`,
  }));
  for (const id of altProviders) {
    const S = provName(id), list = altOf(id), best = list.find(x => x.pct > 0 && x.n >= 10) || list.find(x => x.pct > 0);
    const cheaperN = list.filter(x => x.pct >= 3).length, pricierN = list.filter(x => x.pct <= -3).length;
    // tip başına: bu üreticiye göre o tipte en çok tasarruf ettiren alternatif (en az 3 ortak ürün)
    const aTypes = [...groupBy(list.flatMap(x => vsByType(x.v).map(tp => { const mine = x.v.a === id ? tp.sumA : tp.sumB, theirs = x.v.a === id ? tp.sumB : tp.sumA; return { type: tp.type, other: x.other, n: tp.n, pct: Math.round((mine - theirs) / mine * 100) }; })), r => r.type)]
      .map(([, l]) => l.sort((a, b) => b.pct - a.pct || b.n - a.n)[0]).filter(r => r.pct >= 3).sort((a, b) => b.n - a.n).slice(0, 12);
    const nextAlt = list.filter(x => x.pct >= 3 && x !== best).slice(0, 2).map(x => lg === 'tr' ? `${provName(x.other)} (%${x.pct})` : `${provName(x.other)} (${x.pct}%)`).join(lg === 'tr' ? ' ve ' : ' and ');
    const aFaq = (best ? [[AL.q1(S), AL.a1(S, provName(best.other), best.pct, best.n, nextAlt)]] : []).concat([[AL.q2(S), AL.a2(S, list.length, cheaperN, list.length - cheaperN - pricierN, pricierN)]])
      .concat(aTypes.slice(0, 3).map(r => [AL.qT(S, L.type(r.type)), AL.aT(S, L.type(r.type), provName(r.other), r.pct, r.n)]));
    const diff = x => x.pct >= 3 ? `<span class="win">${esc(AL.cheaper(x.pct))}</span>` : x.pct <= -3 ? esc(AL.pricier(-x.pct)) : esc(AL.same);
    add(P.alt(id) + 'index.html', page(L, H, {
      rel: P.alt(id) + 'index.html', alt: altAll(p => p.alt(id)), title: `${cheaperN >= 3 ? AL.titleN(S, cheaperN, month) : AL.title(S, month)} · ${BRAND}`, description: AL.desc(S, list.length, best ? AL.top(provName(best.other), best.pct) : AL.none(S)),
      crumbs: [[AL.indexTitle, href(P.alts)], [S]],
      body: `<h1>${esc(AL.h1(S))}</h1><p class="muted">${esc(AL.lead(S, list.length))}</p>
${best ? `<div class="verdict"><b>${esc(AL.top(provName(best.other), best.pct))}</b></div>` : `<div class="verdict">${esc(AL.none(S))}</div>`}
<div class="tbl"><table><thead><tr><th>${AL.th[0]}</th><th class="num">${AL.th[1]} ${esc(S)}</th><th class="num">${AL.th[2]}</th><th class="num">${AL.th[3]}</th><th></th></tr></thead><tbody>
${list.map((x, i) => `<tr><td>${i + 1}. <a href="${href(P.maker(x.other))}"><b>${esc(provName(x.other))}</b></a></td><td class="num">${diff(x)}</td><td class="num">${x.cheaperOn} / ${x.n}</td><td class="num">${x.n}</td><td><a class="go" href="${href(P.vs(x.v.slug))}">${esc(AL.details)} →</a></td></tr>`).join('')}
</tbody></table></div><p class="muted sm">${esc(V.note)}</p>${aTypes.length >= 2 ? `<h2>${esc(AL.typeH(S))}</h2><div class="tbl"><table><thead><tr><th>${esc(AL.tth[0])}</th><th>${esc(AL.tth[1])}</th><th class="num">${esc(AL.tth[2])} ${esc(S)}</th><th class="num">${esc(AL.tth[3])}</th></tr></thead><tbody>${aTypes.map(r => `<tr><td>${esc(L.type(r.type))}</td><td><a href="${href(P.maker(r.other))}">${esc(provName(r.other))}</a></td><td class="num"><span class="win">${esc(AL.cheaper(r.pct))}</span></td><td class="num">${r.n}</td></tr>`).join('')}</tbody></table></div>` : ''}<h2>${esc(AL.faqH)}</h2><div class="prose">${aFaq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('')}</div>`,
      jsonld: { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: aFaq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    }));
  }

  // POD fiyat endeksi (aylık rapor; alıntılanabilir veri sayfası)
  const PI = t.pidx, PX = pidx, hasPast = !!PX.past;
  const sign = x => x > 0 ? `+${x}` : x < 0 ? `−${-x}` : '0';
  const solidSup = PX.suppliers.filter(x => x.n >= Math.max(50, Math.round(PX.rows.length * 0.05)));
  const topSup = solidSup[0] || PX.suppliers[0];
  const gapPct = Math.round(PX.gap * 100), csvBase = '/' + LOCALES.en.path.index;
  const supRow = (x, i) => {
    const b = PX.past?.suppliers[x.id];
    return `<tr><td>${i + 1}. <a href="${href(P.maker(x.id))}"><b>${esc(provName(x.id))}</b></a></td><td class="num${x.index < 1 ? ' win' : ''}">${Math.round(x.index * 100)}</td><td class="num">${x.wins}</td><td class="num">${x.n}</td>${hasPast ? `<td class="num">${b == null ? '–' : sign(Math.round((x.index - b) * 100))}</td>` : ''}</tr>`;
  };
  const modRow = r => {
    const b = PX.past?.models[r.g.slug];
    return `<tr><td><a href="${href(P.group(r.g.slug))}">${esc(H.gTitle(r.g))}</a></td><td class="num">${r.offers.length}</td><td class="num"><b class="lo">${esc(fmt(r.offers[0].baseMinor))}</b></td><td class="num">${esc(fmt(r.med))}</td><td class="num">${esc(fmt(r.offers[r.offers.length - 1].baseMinor))}</td><td>${esc(provName(r.offers[0].providerId))}</td>${hasPast ? `<td class="num">${b ? sign(Math.round((r.med / b - 1) * 100)) + '%' : '–'}</td>` : ''}</tr>`;
  };
  const typRows = [...guides].map(([k, s]) => ({ k, s, top: s.suppliers.filter(x => x.n >= Math.max(5, Math.round(s.rows.length * 0.1)))[0] || s.suppliers[0] }));
  // textCols: sola yaslı (metin) sütunların sırası; diğerleri sayı
  const th = (cols, textCols) => `<thead><tr>${cols.map((c, i) => `<th${textCols.includes(i) ? '' : ' class="num"'}>${esc(c)}</th>`).join('')}</tr></thead>`;
  add(P.index + 'index.html', page(L, H, {
    rel: P.index + 'index.html', alt: altAll(p => p.index), title: `${PI.title(month, connected.length)} · ${BRAND}`, description: PI.desc(month, n(products.length), connected.length, gapPct),
    crumbs: [[PI.nav]],
    body: `<h1>${esc(PI.h1(month))}</h1><p class="muted sm">${esc(PI.upd(H.lastText))}</p>
<div class="kpis"><div><b>${n(products.length)}</b><span>${esc(PI.kpi[0])}</span></div><div><b>${connected.length}</b><span>${esc(PI.kpi[1])}</span></div><div><b>${n(PX.rows.length)}</b><span>${esc(PI.kpi[2])}</span></div><div title="${esc(PI.gapP)}"><b>${gapPct}%</b><span>${esc(PI.kpi[3])}</span></div></div>
<div class="verdict"><p style="color:var(--ink);margin:0">${esc(PI.lead(n(products.length), n(PX.rows.length), gapPct, provName(topSup.id), Math.max(0, Math.round((1 - topSup.index) * 100))))}</p></div>
<p class="muted sm">${esc(hasPast ? PI.chgSince(H.dateFmt.format(new Date(PX.past.date))) : PI.chgNone(H.dateFmt.format(new Date(PX.since))))}</p>
<h2>${esc(PI.supH)}</h2><p class="muted sm">${esc(PI.supP(PX.minN))}</p>
<div class="tbl"><table>${th(hasPast ? PI.sth : PI.sth.slice(0, 4), [0])}<tbody>${PX.suppliers.map(supRow).join('')}</tbody></table></div>${H.ad('liste')}
<h2>${esc(PI.modH)}</h2>
<div class="tbl"><table>${th(hasPast ? PI.mth : PI.mth.slice(0, 6), [0, 5])}<tbody>${PX.models.slice(0, 15).map(modRow).join('')}</tbody></table></div>
<h2>${esc(PI.typH)}</h2>
<div class="tbl"><table>${th(PI.tth, [0, 4])}<tbody>${typRows.map(({ k, s, top }) => `<tr><td><a href="${href(P.guide(k))}">${esc(L.type(k))}</a></td><td class="num">${s.rows.length}</td><td class="num"><b class="lo">${esc(fmt(s.lo.baseMinor))}</b></td><td class="num">${esc(fmt(s.med))}</td><td>${esc(provName(top.id))}</td></tr>`).join('')}</tbody></table></div>
<h2>${esc(PI.citeH)}</h2><div class="prose"><p>${esc(PI.cite)}</p><p><a class="go" href="${csvBase}pod-price-index-suppliers.csv" download>${esc(PI.csv[0])}</a> · <a class="go" href="${csvBase}pod-price-index-blanks.csv" download>${esc(PI.csv[1])}</a></p><p class="muted sm">${esc(PI.method)}</p></div>`,
    jsonld: { '@context': 'https://schema.org', '@type': 'Dataset', name: PI.title(month, connected.length), description: PI.desc(month, n(products.length), connected.length, gapPct), url: abs(P.index + 'index.html'), isAccessibleForFree: true, dateModified: lastCheck || undefined,
      creator: { '@type': 'Organization', name: BRAND, url: SITE }, distribution: ['suppliers', 'blanks'].map(f => ({ '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${SITE}${csvBase}pod-price-index-${f}.csv` })) },
  }));
  if (lg === 'en') {
    const q = v => `"${String(v).replace(/"/g, '""')}"`, usd = m => (m / 100).toFixed(2);
    write(P.index + 'pod-price-index-suppliers.csv', ['rank,supplier,price_index,cheapest_on,products_compared', ...PX.suppliers.map((x, i) => [i + 1, q(provName(x.id)), Math.round(x.index * 100), x.wins, x.n].join(','))].join('\n') + '\n');
    write(P.index + 'pod-price-index-blanks.csv', ['blank,suppliers,lowest_usd,typical_usd,highest_usd,cheapest_supplier', ...PX.models.map(r => [q(H.gTitle(r.g)), r.offers.length, usd(r.offers[0].baseMinor), usd(r.med), usd(r.offers[r.offers.length - 1].baseMinor), q(provName(r.offers[0].providerId))].join(','))].join('\n') + '\n');

    // Haftalık fiyat raporları (yalnızca İngilizce): veri scripts/weekly-report.cjs -> data/reports/<tarih>.json, giriş yazısı elle
    if (reports.length) {
      const day = d => H.dateFmt.format(new Date(d + 'T12:00:00Z'));
      const pct = x => `${x > 0 ? '+' : '−'}${Math.abs(Math.round(x * 100))}%`;
      const link = c => c.group && groupSlugs.has(c.group) ? href(P.group(c.group)) : products.some(p => p.id === c.id) ? href(P.product(c.id)) : '';
      const chgRow = c => { const h = link(c); return `<tr><td>${esc(provName(c.providerId))}</td><td>${h ? `<a href="${h}">${esc(c.title)}</a>` : esc(c.title)}</td><td class="num">${esc(fmt(c.old))}</td><td class="num"><b${c.pct < 0 ? ' class="lo"' : ''}>${esc(fmt(c.new))}</b></td><td class="num">${pct(c.pct)}</td></tr>`; };
      const chgTh = th(['Supplier', 'Product', 'Before', 'Now', 'Change'], [0, 1]);
      const titleOf = r => `POD price report, week of ${day(r.date)}: ${r.totals.down} price drops, ${r.totals.up} increases`;
      for (const r of reports) {
        const rel = `reports/${r.date}/index.html`, T = r.totals;
        add(rel, page(L, H, {
          rel, title: `${titleOf(r)} · ${BRAND}`, description: `Which print-on-demand suppliers changed prices between ${day(r.baseDate)} and ${day(r.date)}: ${T.changed} price changes across ${n(T.products)} products from ${T.suppliers} suppliers.`,
          crumbs: [['Weekly price reports', '/reports/'], [day(r.date)]],
          body: `<h1>${esc(titleOf(r))}</h1><p class="muted sm">Compared: ${esc(day(r.baseDate))} → ${esc(day(r.date))} · base cost with print included, before shipping and tax</p>
<div class="kpis"><div><b>${T.changed}</b><span>price changes</span></div><div><b>${T.down}</b><span>price drops</span></div><div><b>${T.up}</b><span>price increases</span></div><div><b>${n(T.products)}</b><span>products tracked</span></div></div>
${r.intro ? `<div class="prose">${r.intro.split(/\n{2,}/).map(p => `<p>${esc(p)}</p>`).join('')}</div>` : ''}
${r.suppliers.length ? `<h2>Who changed prices</h2><div class="tbl"><table>${th(['Supplier', 'Drops', 'Increases', 'Average change'], [0])}<tbody>${r.suppliers.map(s => `<tr><td><a href="${href(P.maker(s.id))}"><b>${esc(s.name)}</b></a></td><td class="num">${s.down}</td><td class="num">${s.up}</td><td class="num">${pct(s.avgPct)}</td></tr>`).join('')}</tbody></table></div>` : ''}
${r.drops.length ? `<h2>Biggest price drops</h2><div class="tbl"><table>${chgTh}<tbody>${r.drops.map(chgRow).join('')}</tbody></table></div>` : ''}${H.ad('liste')}
${r.rises.length ? `<h2>Biggest price increases</h2><div class="tbl"><table>${chgTh}<tbody>${r.rises.map(chgRow).join('')}</tbody></table></div>` : ''}
${r.leaders.length ? `<h2>New cheapest supplier</h2><p class="muted sm">Products sold by at least 3 suppliers where the cheapest one changed this week.</p><div class="tbl"><table>${th(['Product', 'Suppliers', 'Was cheapest', 'Now cheapest'], [0, 2, 3])}<tbody>${r.leaders.map(x => `<tr><td>${groupSlugs.has(x.group) ? `<a href="${href(P.group(x.group))}">${esc(x.name)}</a>` : esc(x.name)}</td><td class="num">${x.suppliers}</td><td>${esc(x.was.name)} (${esc(fmt(x.was.price))})</td><td><b>${esc(x.now.name)}</b> (${esc(fmt(x.now.price))})</td></tr>`).join('')}</tbody></table></div>` : ''}
<h2>How we measure</h2><div class="prose"><p>We read the public catalogs of ${T.suppliers} print-on-demand suppliers twice a day and compare the same product's base cost one week apart. Only offers where printing is included in the price are counted. Moves smaller than 3% or 10 cents are ignored, and jumps above 60% are left out because they are usually catalog corrections rather than real price changes. Shipping and tax are not included. See the <a href="${href(P.index)}">POD Price Index</a> for the overall supplier ranking.</p></div>`,
          jsonld: { '@context': 'https://schema.org', '@type': 'Article', headline: titleOf(r), datePublished: r.date, dateModified: r.date, author: { '@type': 'Organization', name: BRAND, url: SITE }, publisher: { '@type': 'Organization', name: BRAND, url: SITE } },
        }));
      }
      add('reports/index.html', page(L, H, {
        rel: 'reports/index.html', title: `Weekly print-on-demand price reports · ${BRAND}`, description: 'Every week: which print-on-demand suppliers raised or cut prices, the biggest moves, and where the cheapest supplier changed.',
        crumbs: [['Weekly price reports']],
        body: `<h1>Weekly print-on-demand price reports</h1><p>Every week we compare the base cost of ${n(products.length)} products from ${connected.length} print-on-demand suppliers with the week before: who raised prices, who cut them, and where the cheapest supplier changed.</p>
<ul class="reports">${reports.map(r => `<li><a href="/reports/${r.date}/"><b>${esc(titleOf(r))}</b></a></li>`).join('')}</ul>`,
      }));
    }
  }

  // kâr hesaplayıcı (istemci tarafı; veri: data/groups-<dil>.json + data/g/<slug>.json)
  const C = t.calc;
  add(P.calc + 'index.html', page(L, H, {
    rel: P.calc + 'index.html', alt: altAll(p => p.calc), title: `${C.title} · ${BRAND}`, description: C.desc, crumbs: [[C.nav]],
    body: `<h1>${esc(C.title)}</h1><p class="muted">${esc(C.intro)}</p>
<form id="calc" class="calc" onsubmit="return false">
<label class="wide">${esc(C.product)}<select name="g"><option value="">—</option></select></label>
<label>${esc(C.platform)}<select name="platform"><option value="etsy">Etsy</option><option value="shopify">Shopify</option><option value="amazon">Amazon Handmade</option><option value="custom">${esc(C.custom)}</option></select></label>
<label>${esc(C.dest)}<select name="dest">${C.dests.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select></label>
<input type="hidden" name="margin" value="30">
<label>${esc(C.price)}<input name="price" type="number" min="0" step="0.01" value="24.99"></label>
<label class="custom" hidden>${esc(C.pct)}<input name="pct" type="number" min="0" step="0.1" value="10"></label>
<label class="custom" hidden>${esc(C.fixed)}<input name="fixed" type="number" min="0" step="0.01" value="0.30"></label>
<details class="wide adv"><summary>${esc(C.adv)}</summary><label>${esc(C.shipIn)}<input name="shipIn" type="number" min="0" step="0.01" value="0"></label></details>
</form><div id="calc-out"><p class="muted">${esc(C.pick)}</p></div>
<details class="others"><summary>${lg === 'tr' ? 'Hesap nasıl yapılıyor?' : 'How is this calculated?'}</summary><p class="muted sm">${esc(C.fees)}</p></details>${lg === 'tr' ? `<p><a class="go" href="${href(DDP.path)}">Türkiye'den ABD'ye gönderiyor musunuz? Kargo + gümrük vergisi hesaplayıcı →</a></p>` : ''}`,
  }));

  // ürün başına kâr sayfaları (arama trafiği): "X'i Etsy'de $Y'ye satarsan hangi üreticide ne kazanırsın" — yalnız en az 3 üreticinin
  // gerçek ABD teslim maliyeti bilinen ürünler; satış fiyatı ürün tipinin örnek Etsy fiyatı (sayfada açıkça "örnek" yazar)
  const PF = t.profitPages, etsyFee = r => 0.20 + r * 0.065 + r * 0.03 + 0.25;
  const profitGroups = groups.map(g => {
    const per = [...groupBy(g.list.filter(p => !isBlank(p)), p => p.providerId)].map(([, l]) => l.map(p => [p, deliveredUS(p)]).filter(z => z[1] != null).sort((a, b) => a[1] - b[1])[0]).filter(Boolean);
    return { g, per, price: SAMPLE_PRICE[g.type] || 24.99 };
  }).filter(x => x.per.length >= 3);
  for (const { g, per, price } of profitGroups) {
    const name = H.gTitle(g), fee = etsyFee(price);
    const rows = per.map(([p, d]) => { const lc = LC.landedUS(p); return { p, cost: d / 100, base: lc.baseMinor / 100, ship: lc.shipMinor / 100, profit: price - fee - d / 100, from: lc.origin }; }).sort((a, b) => b.profit - a.profit);
    const best = rows[0], worst = rows[rows.length - 1], pct = r => Math.round(r.profit / price * 100);
    const calcUrl = `${href(P.calc)}?p=${encodeURIComponent(g.slug)}&price=${price}`;
    add(P.profit(g.slug) + 'index.html', page(L, H, {
      rel: P.profit(g.slug) + 'index.html', alt: altAll(p => p.profit(g.slug)), title: `${PF.title(name, fmt(price * 100))} · ${BRAND}`,
      description: PF.desc(name, fmt(price * 100), fmt(Math.round(worst.profit * 100)), fmt(Math.round(best.profit * 100)), provName(best.p.providerId), rows.length),
      crumbs: [[PF.nav, href(P.profitIndex)], [name]],
      body: `<h1>${esc(PF.h1(name, fmt(price * 100)))}</h1>
<div class="pcard">${g.image ? `<img src="${esc(g.image)}" alt="" loading="lazy">` : ''}<div><p class="cs-main">${PF.answer(fmt(price * 100), `<b class="win">${esc(fmt(Math.round(best.profit * 100)))}</b>`, esc(provName(best.p.providerId)), `<b>${esc(fmt(Math.round(worst.profit * 100)))}</b>`, esc(provName(worst.p.providerId)))}</p><p class="muted sm">${esc(PF.basis(fmt(price * 100), fmt(Math.round(fee * 100))))}</p></div></div>
<div class="tbl"><table class="lc lc2"><thead><tr><th>${esc(PF.th[0])}</th><th class="num">${esc(PF.th[1])}</th><th class="num">${esc(PF.th[2])}</th><th></th></tr></thead><tbody>${rows.map((r, i) => `<tr><td>${i + 1}. <b>${esc(provName(r.p.providerId))}</b><br><small class="muted">${esc(PF.from(L.lang === 'tr' ? ({ US: 'ABD', CN: 'Çin', EU: 'AB', GB: 'İngiltere', AU: 'Avustralya', CA: 'Kanada', VN: 'Vietnam' })[r.from] || r.from : ({ US: 'the US', CN: 'China', EU: 'the EU', GB: 'the UK', AU: 'Australia', CA: 'Canada', VN: 'Vietnam' })[r.from] || r.from))}</small></td><td class="num"><b>${esc(fmt(Math.round(r.cost * 100)))}</b><br><small class="muted">${esc(PF.parts(fmt(Math.round(r.base * 100)), fmt(Math.round(r.ship * 100))))}</small></td><td class="num ${r.profit >= 0 ? 'win' : 'loss'}"><b class="big">${esc(fmt(Math.round(r.profit * 100)))}</b><br><small>${esc(PF.pct(pct(r)))}</small></td><td><a class="go" href="${esc(outbound(r.p))}" target="_blank" rel="nofollow sponsored noopener">${esc(PF.go)}</a></td></tr>`).join('')}</tbody></table></div>
<p><a class="cta" href="${calcUrl}">${esc(PF.cta)}</a></p>
<p class="muted sm">${esc(PF.note(g.providers.size, rows.length))} <a href="${href(P.group(g.slug))}">${esc(PF.allLink(g.providers.size))}</a></p>`,
      jsonld: { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: PF.q(name, fmt(price * 100)), acceptedAnswer: { '@type': 'Answer', text: PF.a(fmt(price * 100), fmt(Math.round(best.profit * 100)), provName(best.p.providerId), fmt(Math.round(worst.profit * 100)), provName(worst.p.providerId)) } }] },
    }));
  }
  // kâr sayfaları dizini
  add(P.profitIndex + 'index.html', page(L, H, {
    rel: P.profitIndex + 'index.html', alt: altAll(p => p.profitIndex), title: `${PF.indexTitle} · ${BRAND}`, description: PF.indexDesc(profitGroups.length), crumbs: [[PF.nav]],
    body: `<h1>${esc(PF.indexTitle)}</h1><p class="muted">${esc(PF.indexDesc(profitGroups.length))}</p><ul class="reports">${profitGroups.sort((a, b) => b.g.providers.size - a.g.providers.size).map(({ g, price }) => `<li><a href="${href(P.profit(g.slug))}"><b>${esc(PF.h1(H.gTitle(g), fmt(price * 100)))}</b></a></li>`).join('')}</ul>`,
  }));

  // Türkçe: ABD'ye kargo + gümrük vergisi (DDP) hesaplayıcı ve rehber (scripts/ddp-page.cjs)
  if (lg === 'tr') add(DDP.path + 'index.html', page(L, H, {
    rel: DDP.path + 'index.html', title: `${DDP.title} · ${BRAND}`, description: DDP.description, crumbs: [[DDP.nav]], body: DDP.body(), jsonld: DDP.jsonld(),
  }));

  // arama, hakkında, gizlilik, iletişim
  write(P.search + 'index.html', page(L, H, {
    rel: P.search + 'index.html', alt: altAll(p => p.search), title: `${t.searchTitle} · ${BRAND}`, description: t.searchDesc, crumbs: [[t.search]], noindex: true,
    body: `<h1 id="sq">${t.search}</h1><div id="search-groups"></div><div id="search-app" class="list"><p class="muted">${t.searching}</p></div>`,
  }));
  const badges = Object.keys(L.pbLabel).map(k => `<li>${H.pbBadge(k)} ${esc(L.pbNote[k])}</li>`).join('');
  add(P.about + 'index.html', page(L, H, {
    rel: P.about + 'index.html', alt: altAll(p => p.about), title: `${t.aboutTitle} · ${BRAND}`, description: t.aboutDesc, crumbs: [[t.aboutTitle]],
    body: `<h1>${t.aboutTitle}</h1><div class="prose">${t.about(connected.length, n(products.length), esc(H.lastText), badges)}</div>`,
  }));
  const contact = cfg.contactEmail ? `<a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a>` : t.contactPending;
  add(P.privacy + 'index.html', page(L, H, {
    rel: P.privacy + 'index.html', alt: altAll(p => p.privacy), title: `${t.privacyTitle} · ${BRAND}`, description: t.privacyTitle, crumbs: [[t.privacyTitle]],
    body: `<h1>${t.privacyTitle}</h1><div class="prose">${t.privacy(contact)}</div>`,
  }));
  add(P.contact + 'index.html', page(L, H, {
    rel: P.contact + 'index.html', alt: altAll(p => p.contact), title: `${t.contactTitle} · ${BRAND}`, description: t.contactDesc, crumbs: [[t.contactTitle]],
    body: `<h1>${t.contactTitle}</h1><div class="prose">${t.contact(contact)}</div>`,
  }));

  // tekil ürün sayfaları (yalnızca İngilizce)
  if (lg === 'en') {
    const features = p => {
      const f = [], F = t.f, push = (k, v) => { if (v != null && v !== '' && v !== false) f.push([k, v]); };
      push(F.type, `<a href="${href(P.cat(p.etsy))}">${esc(L.node(p.etsy))}</a>`);
      push(F.maker, `<a href="${href(P.maker(p.providerId))}">${esc(provName(p.providerId))}</a>`);
      if (p.model) push(F.blank, esc(p.model.brandName + ' ' + p.model.model));
      push(F.pbt, `${H.pbBadge(p.pb)} <span class="muted sm">${esc(L.pbNote[p.pb])}</span>`);
      push(F.basis, esc(L.basis(p.priceBasis)));
      if (p.sourceCurrency && p.sourceCurrency !== 'USD' && Number.isInteger(p.sourceMinor)) push(F.src, `${esc(fmt(p.sourceMinor, p.sourceCurrency))} <span class="muted sm">${esc(F.fx(+Number(p.exchangeRate).toFixed(4), p.exchangeDate || ''))}</span>`);
      if (Number.isInteger(p.baseMaxMinor) && p.baseMaxMinor > p.baseMinor) push(F.range, `${esc(fmt(p.baseMinor))} – ${esc(fmt(p.baseMaxMinor))}`);
      if (Number.isInteger(p.originalMinor) && p.originalMinor > p.baseMinor) push(F.orig, esc(fmt(p.originalMinor, p.sourceCurrency || 'USD')));
      if (Number.isInteger(p.subscriptionMinor) && p.subscriptionMinor < p.baseMinor) push(F.member, `${esc(fmt(p.subscriptionMinor))} <span class="muted sm">${F.memberNote}</span>`);
      if (p.decorationMethods?.length) push(F.methods, esc(p.decorationMethods.map(L.method).join(', ')));
      push(F.sizes, esc(L.sizes(p.sizes)));
      push(F.material, p.material ? esc(p.material.replace(/\s*,\s*/g, ', ').replace(/(, )+$/, '')) : null);
      if (p.minimumQuantity > 1) push(F.moq, esc(p.minimumQuantity));
      if (Number.isInteger(p.minimumOrderMinor)) push(F.mov, esc(fmt(p.minimumOrderMinor)));
      push(F.prod, p.production ? esc(L.production(p.production)) : null);
      if (p.includesPrint === false) push(F.print, F.printNote);
      if (p.sourcePricePrefix && /shipping/.test(p.sourcePricePrefix)) push(F.ship, F.shipIncl);
      else if (p.shipping && Object.keys(p.shipping).length) push(F.ship, Object.entries(p.shipping).map(([k, v]) => esc(F.shipFrom(k, fmt(v)))).join(' · ') + ` <span class="muted sm">${esc(F.total(fmt(p.baseMinor + Object.values(p.shipping)[0])))}</span>`);
      if (p.availableCountries?.length) push(F.region, esc(p.availableCountries.join(', ')));
      if (p.fulfillmentProvider) push(F.facilities, esc(p.fulfillmentProvider.replace(/(\d+) baskı tesisi/, '$1 print providers').split(',').join(', ')));
      push(F.checked, esc(H.dateFmt.format(new Date(p.checkedAt || p.checkedOn))));
      return f;
    };
    for (const p of products) {
      const prov = provName(p.providerId), label = L.type(p.type), g = typeGroup(p.type), gp = groupOf.get(p.id);
      const similar = gp ? null : (() => { const seen = new Set([p.providerId]); return byType.get(p.type).filter(x => !seen.has(x.providerId) && seen.add(x.providerId)).slice(0, 12); })();
      const rel = P.product(p.id) + 'index.html';
      write(rel, page(L, H, {
        // tekil ürün sayfaları noindex (2026-10-13): 35 bin ince sayfa Google'ın site güvenini düşürüyordu;
        // arama trafiği karşılaştırma/kategori/rehber sayfalarında toplanır, linkler takip edilmeye devam eder
        rel, noindex: true, cat: p.etsy, title: `${t.productTitle(p.title, prov, fmt(p.baseMinor))} · ${BRAND}`, description: t.productDesc(prov, p.title, fmt(p.baseMinor), label),
        crumbs: [...eAnc(p.etsy).slice(-1).map(a => [L.node(a), href(P.cat(a))]), [L.node(p.etsy), href(P.cat(p.etsy))], [p.title]],
        body: `<article class="product"><div class="pimg">${H.img(p)}</div><div class="pinfo">
<p class="muted"><a href="${href(P.maker(p.providerId))}">${esc(prov)}</a></p><h1>${esc(p.title)}</h1>
<p class="bigprice">${H.priceHtml(p)}</p>
${(() => { const dv = deliveredUS(p); if (dv == null) return ''; const lc = LC.landedUS(p); return `<p class="dlvbox"><b>${esc(t.dlv.row(fmt(dv)))}</b> <span class="muted">${esc(t.dlv.parts(fmt(lc.shipMinor), String(lc.dutyRate).replace('.', L.lang === 'tr' ? ',' : '.')))}</span>${gp ? ` · <a href="${href(P.calc)}?p=${encodeURIComponent(gp.slug)}">${esc(t.dlv.more)}</a>` : ''}</p>`; })()}
${gp ? `<a class="ingroup" href="${href(P.group(gp.slug))}">${esc(t.inGroup(gp.providers.size))} →</a>` : ''}
<a class="cta" href="${esc(outbound(p))}" target="_blank" rel="nofollow sponsored noopener">${esc(t.cta(prov))}</a>
<dl class="feat">${features(p).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>${H.ad('urun')}</div></article>
${gp ? `<h2>${esc(t.sameGroup)}</h2>${H.offers(gp.list)}` : similar.length ? `<h2>${esc(t.otherMakers(label))}</h2>${H.cards(similar)}` : ''}`,
        jsonld: { '@context': 'https://schema.org', '@type': 'Product', name: p.title, image: p.imageUrl || undefined, brand: p.model ? { '@type': 'Brand', name: p.model.brandName } : undefined, offers: { '@type': 'Offer', price: (p.baseMinor / 100).toFixed(2), priceCurrency: 'USD', url: p.sourceUrl, seller: { '@type': 'Organization', name: prov } } },
      }));
    }
    write('404.html', page(L, H, { rel: '404.html', title: `${t.notFound} · ${BRAND}`, description: t.notFound, noindex: true, body: `<h1>${t.notFound}</h1><p>${t.notFoundP}</p>` }));
  }
}

// barındırma: önbellek başlıkları, eski adreslerden yönlendirme ve AdSense ads.txt
write('_headers', `/assets/*\n  Cache-Control: public, max-age=86400\n/data/*\n  Cache-Control: public, max-age=1800\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`);
const modelRedirects = groups.filter(g => g.key.startsWith('m:')).map(g => `/model/${g.slug}/  /compare/${g.slug}/  301\n/tr/model/${g.slug}/  /tr/karsilastir/${g.slug}/  301`).join('\n');
write('_redirects', `/models/  /compare/  301\n/tr/borsa/  /tr/karsilastir/  301\n${modelRedirects}\n/model/*  /compare/  301\n/tr/model/*  /tr/karsilastir/  301\n/urun/*  /product/:splat  301\n/kategori/*  /tr/kategori/:splat  301\n/borsa/  /tr/karsilastir/  301\n/ureticiler/  /tr/ureticiler/  301\n/uretici/*  /tr/uretici/:splat  301\n`);
// GitHub Pages _redirects okumaz: eski adresler için küçük yönlendirme sayfaları (yalnızca o adreste sayfa yoksa)
const stub = (from, to) => { if (!fs.existsSync(path.join(out, from, 'index.html'))) write(from + 'index.html', `<!doctype html><meta charset="utf-8"><title>Moved</title><link rel="canonical" href="${SITE}${to}"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0; url=${to}"><a href="${to}">${to}</a>`); };
stub('models/', '/compare/'); stub('tr/borsa/', '/tr/karsilastir/'); stub('borsa/', '/tr/karsilastir/'); stub('ureticiler/', '/tr/ureticiler/');
for (const g of groups.filter(g => g.key.startsWith('m:'))) { stub(`model/${g.slug}/`, `/compare/${g.slug}/`); stub(`tr/model/${g.slug}/`, `/tr/karsilastir/${g.slug}/`); }
// 18 Eki 2026 öncesi tür/grup kategori adresleri -> Etsy kategori sayfası
const groupNode = new Map([...byGroup].map(([g, l]) => [g, mostCommon(l.map(p => { const a = eAnc(p.etsy); return a[0] || p.etsy; }))]));
for (const lg of LANGS) {
  const P = LOCALES[lg].path;
  for (const [k, id] of typeNode) stub(P.oldCat(k), '/' + P.cat(id));
  for (const [g, id] of groupNode) if (g !== 'diger') stub(P.oldCat(g), '/' + P.cat(id));
}
if (SITE) write('CNAME', new URL(SITE).hostname + '\n');
// IndexNow (Bing, Yandex vb.): anahtar dosyası site kökünde olmalı; bildirim scripts/indexnow.cjs ile
if (cfg.indexNowKey) write(cfg.indexNowKey + '.txt', cfg.indexNowKey);
if (cfg.adsenseClient) write('ads.txt', `google.com, ${cfg.adsenseClient.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`);

// üretici rozetleri: en az 3 üreticinin sattığı üründe en ucuz olduğu ürün sayısı (pidx verisinden).
// Üreticiler sitelerine koyabilir: <a href=".../manufacturer/<id>/"><img src=".../badge/<id>.svg"></a>
const winsBy = new Map();
for (const r of pidx.rows) { const id = r.offers[0].providerId; if (!winsBy.has(id)) winsBy.set(id, []); winsBy.get(id).push(r.g.slug); }
const badgeSvg = (n) => { const l1 = `Cheapest for ${n} product${n === 1 ? '' : 's'}`, w = Math.max(230, 30 + l1.length * 8.6); return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w)}" height="54" viewBox="0 0 ${Math.round(w)} 54" role="img" aria-label="${esc(l1)} on POD Pricing"><rect width="100%" height="100%" rx="10" fill="#0f9d6b"/><text x="14" y="23" font-family="Segoe UI,Arial,sans-serif" font-size="14" font-weight="700" fill="#fff">${esc(l1)}</text><text x="14" y="42" font-family="Segoe UI,Arial,sans-serif" font-size="12" fill="#d7f5e9">on POD Pricing · podpricing.com</text></svg>`; };
for (const [id, list] of winsBy) write(`badge/${id}.svg`, badgeSvg(list.length));
write('data/wins.json', JSON.stringify([...winsBy].map(([id, l]) => [id, provName(id), l.length, l.slice(0, 8)]).sort((a, b) => b[2] - a[2])));

// tıklama sayacı ara sayfaları: Cloudflare Web Analytics bunları sayfa görüntüleme olarak sayar (/go/<alan>/),
// sonra ziyaretçi hash'teki adrese gider. Yalnızca o alan adına yönlendirir (açık yönlendirme olmasın).
const goPage = host => `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer-when-downgrade"><title>Redirecting to ${esc(host)}…</title>
<style>body{font:16px system-ui,sans-serif;margin:40px;color:#334}</style></head><body><p>Redirecting to <b>${esc(host)}</b>… <a id="l" href="https://${esc(host)}/" rel="nofollow">continue</a></p>
<script>(function(){var u='';try{u=decodeURIComponent(location.hash.slice(1));var h=new URL(u).hostname;if(h!==${JSON.stringify(host)})u='';}catch(e){u='';}
if(!u)u='https://${host}/';document.getElementById('l').href=u;var done=false;function go(){if(done)return;done=true;location.replace(u);}
if(document.readyState==='complete')setTimeout(go,400);else addEventListener('load',function(){setTimeout(go,400);});setTimeout(go,1500);})();</script>
${cfg.cloudflareAnalyticsToken ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${esc(cfg.cloudflareAnalyticsToken)}"}'></script>` : ''}</body></html>`;
for (const h of goHosts) if (/^[a-z0-9.-]+$/i.test(h)) write(`go/${h}/index.html`, goPage(h));

// sitemap / robots
if (SITE) {
  const chunks = [];
  for (let i = 0; i < sitemap.length; i += 40000) chunks.push(sitemap.slice(i, i + 40000));
  chunks.forEach((c, i) => write(`sitemap-${i + 1}.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${c.map(r => `<url><loc>${esc(abs(r))}</loc></url>`).join('')}</urlset>`));
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${chunks.map((_, i) => `<sitemap><loc>${SITE}/sitemap-${i + 1}.xml</loc></sitemap>`).join('')}</sitemapindex>`);
  write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /search/\nDisallow: /tr/ara/\nDisallow: /go/\nSitemap: ${SITE}/sitemap.xml\n`);
} else {
  write('robots.txt', 'User-agent: *\nAllow: /\n');
}

// site/ ile yer değiştir
const old = path.join(root, 'site.__old');
fs.rmSync(old, { recursive: true, force: true });
try {
  if (fs.existsSync(finalOut)) fs.renameSync(finalOut, old);
  fs.renameSync(out, finalOut);
  fs.rmSync(old, { recursive: true, force: true });
} catch (e) {
  // Windows'ta klasör açık tutuluyorsa: yeni dosyaları üzerine kopyala, artık olmayanları sil.
  if (fs.existsSync(old) && !fs.existsSync(finalOut)) fs.renameSync(old, finalOut);
  fs.cpSync(out, finalOut, { recursive: true, force: true });
  const keep = new Set();
  (function walk(d, rel) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const r = path.join(rel, e.name); if (e.isDirectory()) walk(path.join(d, e.name), r); else keep.add(r); } })(out, '');
  (function prune(d, rel) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = path.join(rel, e.name), full = path.join(d, e.name);
      if (e.isDirectory()) { prune(full, r); if (!fs.readdirSync(full).length) fs.rmdirSync(full); }
      else if (!keep.has(r)) fs.unlinkSync(full);
    }
  })(finalOut, '');
  fs.rmSync(out, { recursive: true, force: true });
}

console.log(`Site üretildi: ${products.length} ürün, ${groups.length} karşılaştırmalı ürün, ${byType.size} kategori, ${catalog.providers.length} üretici, ${sitemap.length} sayfa (EN+TR)`);
