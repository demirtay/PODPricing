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

function outbound(p) {
  const a = cfg.affiliate?.[p.providerId];
  if (!a) return p.sourceUrl;
  if (a.template) return a.template.replace('{url}', encodeURIComponent(p.sourceUrl));
  if (a.param) { const u = new URL(p.sourceUrl); u.searchParams.set(a.param, a.value); return u.toString(); }
  return p.sourceUrl;
}

// ---------- veriyi hazırla
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8'));
const providers = new Map(catalog.providers.map(p => [p.id, p]));
const products = catalog.products
  .filter(p => Number.isSafeInteger(p.baseMinor) && p.baseMinor > 0 && p.sourceUrl)
  .map(p => {
    const c = tx.classify(p), m = tx.detectModel(p);
    const q = { ...p, title: decode(p.title), type: c.type, group: c.group, model: m && m.key ? m : null, pb: PB.printBasis(p) };
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
const groupsByType = groupBy(groups, g => g.type);

// Üretici ikilisi karşılaştırmaları ("Printful vs Printify"): ortak ürünlerde her üreticinin en ucuz baskılı teklifi
const bestByGroup = new Map(groups.map(g => {
  const m = new Map();
  for (const p of g.list) if (!isBlank(p) && (!m.has(p.providerId) || m.get(p.providerId).baseMinor > p.baseMinor)) m.set(p.providerId, p);
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
const vsOf = new Map();
for (const v of vsPairs) for (const id of [v.a, v.b]) { if (!vsOf.has(id)) vsOf.set(id, []); vsOf.get(id).push(v); }

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
    path: { home: '', categories: 'categories/', cat: id => `category/${id === 'diger' ? EN.TYPES.diger[1] : (EN.TYPES[id] || EN.GROUPS[id])[1]}/`, compare: 'compare/', group: s => `compare/${s}/`,
      makers: 'manufacturers/', maker: id => `manufacturer/${id}/`, product: id => `product/${id}/`, search: 'search/', about: 'about/', privacy: 'privacy/', contact: 'contact/',
      vsIndex: 'vs/', vs: s => `vs/${s}/`, calc: 'profit-calculator/' },
    type: id => (EN.TYPES[id] || ['Other Products'])[0], group: g => (EN.GROUPS[g] || ['Other'])[0],
    pbLabel: PB.LABEL_EN, pbNote: PB.NOTE_EN, basis: I18N.basisEn, sizes: I18N.sizesEn, production: I18N.productionEn, method: I18N.methodEn,
    notAdded: 'Prices not added yet', quick: QUICK,
    t: {
      home: 'Home', categories: 'Categories', compare: 'Compare', makers: 'Manufacturers', search: 'Search', searchBtn: 'Search',
      searchPh: 'Search products or blanks (e.g. 11oz mug, gildan 5000, hoodie)', searchBig: 'What do you want to print?',
      heroH: 'Find the cheapest print-on-demand supplier',
      heroP: (m, n) => `Compare ${n} products from ${m} POD manufacturers — cheapest first.`,
      topGroups: 'Most compared products', seeAll: 'See all', catsH: 'Shop by category', allCats: 'All categories',
      vs: {
        nav: 'X vs Y', indexTitle: 'Print-on-demand manufacturer comparisons', indexDesc: n => `${n} head-to-head price comparisons between print-on-demand manufacturers, based on products both of them sell.`,
        indexIntro: 'Each comparison only uses products that both manufacturers sell (same blank model or same product type and size), with the cheapest print-included price of each.',
        title: (a, b) => `${a} vs ${b}: print-on-demand price comparison`, desc: (a, b, n, w) => `${a} vs ${b} on ${n} identical products: ${w}. Updated twice a day from public catalogs.`,
        h1: (a, b) => `${a} vs ${b}`, sub: 'Price comparison on products both manufacturers sell',
        verdictA: (a, b, pct) => `${a} is cheaper overall, about ${pct}% less than ${b} on the same products`,
        verdictTie: (a, b) => `${a} and ${b} cost about the same overall`,
        wins: (x, n, total) => `${x} is cheaper on ${n} of ${total} products`,
        totals: (n, a, va, b, vb) => `Buying one of each of the ${n} shared products costs ${va} at ${a} and ${vb} at ${b}.`,
        th: ['Product', 'Difference'], same: 'same', cheaper: 'cheaper', products: 'products', lowest: 'Lowest price', basis: 'Price type',
        others: 'More comparisons', makerH: n => `Compare ${n} with other manufacturers`, shared: n => `${n} shared products`,
        note: 'Prices are the cheapest print-included offer of each manufacturer for that product, before shipping and tax. Print area, quality and shipping can differ — check the store before ordering.',
      },
      calc: {
        nav: 'Profit calculator', title: 'Print-on-demand profit calculator', desc: 'Calculate your profit per sale on Etsy, Shopify or Amazon for every print-on-demand manufacturer that sells the product.',
        intro: 'Pick a product and your selling price. We subtract the marketplace fees and each manufacturer\'s price, and rank manufacturers by your profit.',
        product: 'Product', price: 'Your selling price ($)', shipIn: 'Shipping you charge the customer ($)', shipOut: 'Shipping you pay the manufacturer ($)', platform: 'Where you sell',
        custom: 'Custom fee', pct: 'Fee %', fixed: 'Fixed fee ($)',
        th: ['Manufacturer', 'Product cost', 'Fees', 'Profit', 'Margin'], pick: 'Choose a product to see results.', loading: 'Loading…',
        fees: 'Fees used: Etsy 6.5% transaction + 3% + $0.25 payment processing + $0.20 listing; Shopify 2.9% + $0.30 (Basic plan, Shopify Payments); Amazon Handmade 15% (min $1). Taxes and currency conversion are not included.',
      },
      blankH: 'Blank products (printing charged separately)', blankP: 'These prices are for the unprinted product or bulk orders, so they are listed apart from the print-included offers above.',
      sitesN: n => `Sold at ${n} stores`, cheapest: 'cheapest', catMenu: 'Categories', subAll: n => `All ${n} subcategories →`, itemsH: 'Products',
      makersFrom: (n, v) => `${n} manufacturers · from ${v}`, from: v => `from ${v}`, products: n => `${n} products`, makersN: n => `${n} manufacturers`,
      offersH: n => `Prices from ${n} manufacturers`, cheapestFirst: 'Sorted from cheapest to most expensive.',
      groupNoteModel: 'Same blank garment at every manufacturer. Print method, print area and shipping can differ — check details at the store.',
      groupNoteSpec: 'Same product type and size at every manufacturer. Exact materials and options can differ slightly — check details at the store.',
      allOffersOf: n => `Show all ${n} offers`, groupsInCat: 'Compare prices across manufacturers', allInCat: 'All products',
      compareTitle: 'Compare print-on-demand product prices', compareDesc: n => `${n} print-on-demand products sold by several manufacturers, with prices sorted cheapest first.`,
      compareIntro: 'Each product below is sold by at least two print-on-demand manufacturers. Open one to see every price side by side.',
      groupTitle: (t, n) => `${t} — compare ${n} print-on-demand manufacturers`, groupDesc: (t, n, v, m) => `${t}: cheapest ${v} at ${m}. Prices from ${n} print-on-demand manufacturers, sorted cheapest first.`,
      catTitle: (l, n) => `${l} prices: compare ${n} print-on-demand manufacturers`, catDesc: (l, n, v) => `${n} print-on-demand ${l.toLowerCase()} compared. Lowest price ${v}.`,
      groupPageTitle: l => `${l} print-on-demand prices`, catsTitle: 'All print-on-demand product categories', catsDesc: 'Print-on-demand product categories with the lowest manufacturer price in each.',
      makersTitle: 'Print-on-demand manufacturers', makersDesc: n => `${n} print-on-demand manufacturers: product counts, categories and lowest prices.`,
      makersIntro: (c, r) => `Prices from ${c} manufacturers are compared. ${r} more are listed as links because their prices require login or are not public.`,
      mk: ['Manufacturer', 'Products', 'Lowest', 'Status'], compared: 'Prices compared', visit: 'visit site ↗',
      makerTitle: n => `${n} product prices and catalog`, makerDesc: (n, c, v) => c ? `${c} products in the ${n} print-on-demand catalog; lowest price ${v}.` : `${n} print-on-demand manufacturer. Prices not yet in the comparison.`,
      makerStats: (n, t, v) => `${n} products · ${t} product types · lowest ${v}`, makerTop: 'Cheapest products', noPrices: r => `This manufacturer's prices are not in the comparison: ${r}. Visit the manufacturer site for products and prices.`,
      go: 'Go to store ↗', cta: m => `Go to ${m} ↗`, inGroup: (n) => `Sold by ${n} manufacturers — compare all prices`,
      productTitle: (t, m, v) => `${t} · ${m} · ${v}`, productDesc: (m, t, v, l) => `${m} ${t}: ${v}. Compare ${l.toLowerCase()} prices across print-on-demand manufacturers.`,
      sameGroup: 'Same product at other manufacturers', otherMakers: l => `More ${l.toLowerCase()}`,
      f: { type: 'Product type', maker: 'Manufacturer', blank: 'Blank model', pbt: 'Price type', basis: 'Pricing basis', src: 'Source price', fx: (r, d) => `(rate ${r}, ${d})`, range: 'Price range',
        orig: 'Before discount', member: 'Membership price', memberNote: "(on the manufacturer's paid plan)", methods: 'Print methods', sizes: 'Sizes / variants', material: 'Material',
        moq: 'Minimum quantity', mov: 'Minimum order value', prod: 'Production time', print: 'Printing', printNote: 'Price is for the blank product; printing is charged separately', ship: 'Shipping',
        shipIncl: 'Shipping included (as stated at source)', shipFrom: (k, v) => `${k}: from ${v}`, total: v => `(approx. total ${v})`, region: 'Production / shipping region', facilities: 'Production facilities', checked: 'Last checked' },
      shipShort: v => `+ ${v} shipping`,
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
<h2>Cookies and advertising</h2><p>We use third-party advertising such as Google AdSense. Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this and other websites. Google's use of advertising cookies enables it and its partners to serve ads based on your visits to this site and/or other sites on the Internet. You can opt out of personalized advertising in <a href="https://adssettings.google.com" target="_blank" rel="noopener">Google Ads Settings</a>, and learn more about third-party cookies at <a href="https://www.aboutads.info" target="_blank" rel="noopener">aboutads.info</a>. Visitors in the EEA, UK and Switzerland are asked for consent to advertising cookies.</p>
<h2>Links and affiliate programs</h2><p>Some links to manufacturers may be affiliate links; ${BRAND} may earn a commission on sign-ups through them. This never affects prices or ranking — ranking is by price only. Sponsored placements are labeled "Sponsored".</p>
<h2>Server logs</h2><p>Our hosting provider may keep standard access logs (IP address, browser) for a limited time for security and performance.</p>
<h2>Contact</h2><p>${c}</p>`,
      contact: c => `<p>To suggest a manufacturer, report a wrong price, or ask about sponsorship and partnerships, write to us: ${c}</p><p>Manufacturers: share a public catalog, product feed or API so your products are listed with accurate prices.</p>`,
      contactDesc: `Contact ${BRAND}: add a manufacturer, fix a price or partner with us.`,
      notFound: 'Page not found', notFoundP: 'The product may have been removed from the catalog. <a href="/">Go to the homepage</a> or search.',
      footer: `${BRAND} compares prices from print-on-demand manufacturers' public catalogs. We don't sell anything — clicking an offer takes you to the manufacturer's own page.`,
      footer2: d => `Prices are the starting or selected-variant prices shown at the source; printing, shipping, tax and minimum quantities vary by manufacturer. Last updated: ${d}.`,
      foot: ['About & methodology', 'Manufacturers', 'Privacy & cookies', 'Contact'],
      ad: 'Ad', adPreview: s => `Ad slot · ${s}`, adSize: { ust: 'Leaderboard', liste: 'In-list', urun: 'Rectangle', alt: 'Leaderboard' },
      sponsored: 'Sponsored', sponsorPreview: 'Sponsored manufacturer slot', review: 'View ↗',
      homeTitle: `${BRAND} · Compare print-on-demand prices`, homeDesc: (m, n) => `Find the cheapest print-on-demand supplier: compare ${n} products from ${m} manufacturers — t-shirts, hoodies, mugs, posters, phone cases and more.`,
    },
  },
  tr: {
    lang: 'tr', intl: 'tr-TR',
    path: { home: 'tr/', categories: 'tr/kategoriler/', cat: id => `tr/kategori/${id}/`, compare: 'tr/karsilastir/', group: s => `tr/karsilastir/${s}/`,
      makers: 'tr/ureticiler/', maker: id => `tr/uretici/${id}/`, product: id => `product/${id}/`, search: 'tr/ara/', about: 'tr/hakkinda/', privacy: 'tr/gizlilik/', contact: 'tr/iletisim/',
      vsIndex: 'tr/vs/', vs: s => `tr/vs/${s}/`, calc: 'tr/kar-hesaplayici/' },
    type: id => id === 'diger' ? 'Diğer Ürünler' : tx.TYPE_BY_ID.get(id)?.label || id, group: g => tx.GROUP_LABEL.get(g) || 'Diğer',
    pbLabel: PB.LABEL, pbNote: PB.NOTE, basis: s => s, sizes: s => s, production: s => s, method: m => m,
    notAdded: 'Fiyatlar henüz eklenmedi', quick: ['tişört', 'hoodie', 'kupa', 'termos', 'poster', 'kanvas', 'bez çanta', 'telefon kılıfı', 'şapka', 'battaniye'],
    t: {
      home: 'Ana sayfa', categories: 'Kategoriler', compare: 'Karşılaştır', makers: 'Üreticiler', search: 'Arama', searchBtn: 'Ara',
      searchPh: 'Ürün ya da model ara (ör. 11oz kupa, gildan 5000, hoodie)', searchBig: 'Ne basmak istiyorsun?',
      heroH: 'En ucuz baskı üreticisini bul',
      heroP: (m, n) => `${m} POD üreticisinin ${n} ürününü karşılaştır, en ucuzu en üstte.`,
      topGroups: 'En çok üreticide satılan ürünler', seeAll: 'Tümünü gör', catsH: 'Kategoriler', allCats: 'Tüm kategoriler',
      vs: {
        nav: 'X vs Y', indexTitle: 'POD üreticisi karşılaştırmaları', indexDesc: n => `Print-on-demand üreticileri arasında ${n} ikili fiyat karşılaştırması; iki üreticinin de sattığı ürünlere göre.`,
        indexIntro: 'Her karşılaştırma yalnızca iki üreticinin de sattığı ürünleri (aynı boş ürün modeli ya da aynı ürün tipi ve ölçü) ve her birinin en ucuz baskı dahil fiyatını kullanır.',
        title: (a, b) => `${a} mı ${b} mı? POD fiyat karşılaştırması`, desc: (a, b, n, w) => `${a} ile ${b}, ${n} aynı üründe: ${w}. Fiyatlar günde iki kez yenilenir.`,
        h1: (a, b) => `${a} vs ${b}`, sub: 'İki üreticinin de sattığı ürünlerde fiyat karşılaştırması',
        verdictA: (a, b, pct) => `Genel olarak ${a} daha ucuz; aynı ürünlerde ${b}'den yaklaşık %${pct} daha az`,
        verdictTie: (a, b) => `${a} ve ${b} genel olarak aşağı yukarı aynı fiyatta`,
        wins: (x, n, total) => `${x}, ${total} üründen ${n} tanesinde daha ucuz`,
        totals: (n, a, va, b, vb) => `Ortak ${n} ürünün her birinden birer tane almak ${a}'da ${va}, ${b}'de ${vb} tutuyor.`,
        th: ['Ürün', 'Fark'], same: 'aynı', cheaper: 'daha ucuz', products: 'ürün', lowest: 'En düşük fiyat', basis: 'Fiyat türü',
        others: 'Diğer karşılaştırmalar', makerH: n => `${n} ile diğer üreticileri karşılaştır`, shared: n => `${n} ortak ürün`,
        note: 'Fiyatlar her üreticinin o üründeki en ucuz baskı dahil teklifidir; kargo ve vergi hariçtir. Baskı alanı, kalite ve kargo farklı olabilir; sipariş öncesi mağazaya bakın.',
      },
      calc: {
        nav: 'Kâr hesaplayıcı', title: 'POD kâr hesaplayıcı', desc: 'Etsy, Shopify veya Amazon\'da satış başına kârını, ürünü satan her print-on-demand üreticisi için hesapla.',
        intro: 'Bir ürün ve satış fiyatı seç. Pazaryeri komisyonlarını ve her üreticinin fiyatını düşüp üreticileri kârına göre sıralıyoruz.',
        product: 'Ürün', price: 'Satış fiyatın ($)', shipIn: 'Müşteriden aldığın kargo ($)', shipOut: 'Üreticiye ödediğin kargo ($)', platform: 'Nerede satıyorsun',
        custom: 'Özel komisyon', pct: 'Komisyon %', fixed: 'Sabit ücret ($)',
        th: ['Üretici', 'Ürün maliyeti', 'Komisyon', 'Kâr', 'Kâr oranı'], pick: 'Sonuçları görmek için bir ürün seç.', loading: 'Yükleniyor…',
        fees: 'Kullanılan komisyonlar: Etsy %6,5 işlem + %3 + $0,25 ödeme + $0,20 listeleme; Shopify %2,9 + $0,30 (Basic plan, Shopify Payments); Amazon Handmade %15 (en az $1). Vergi ve kur farkı dahil değildir.',
      },
      blankH: 'Boş ürünler (baskı ücreti ayrıca)', blankP: 'Bu fiyatlar baskısız ürün veya toplu alım fiyatı olduğu için yukarıdaki baskı dahil tekliflerden ayrı listelenir.',
      sitesN: n => `${n} sitede satılıyor`, cheapest: 'en ucuz', catMenu: 'Kategoriler', subAll: n => `${n} alt kategorinin hepsi →`, itemsH: 'Ürünler',
      makersFrom: (n, v) => `${n} üretici · ${v}'dan`, from: v => `${v}'dan`, products: n => `${n} ürün`, makersN: n => `${n} üretici`,
      offersH: n => `${n} üreticinin fiyatları`, cheapestFirst: 'En ucuzdan en pahalıya sıralı.',
      groupNoteModel: 'Bütün üreticilerde aynı boş ürün modeli. Baskı yöntemi, baskı alanı ve kargo farklı olabilir; ayrıntılar üreticinin sayfasında.',
      groupNoteSpec: 'Bütün üreticilerde aynı ürün tipi ve ölçü. Malzeme ve seçenekler küçük farklar gösterebilir; ayrıntılar üreticinin sayfasında.',
      allOffersOf: n => `${n} teklifin hepsini göster`, groupsInCat: 'Üreticiler arasında fiyat karşılaştır', allInCat: 'Tüm ürünler',
      compareTitle: 'POD ürün fiyatlarını karşılaştır', compareDesc: n => `Birden fazla üreticide satılan ${n} print-on-demand ürünü, fiyatlar ucuzdan pahalıya.`,
      compareIntro: 'Aşağıdaki her ürün en az iki üreticide satılıyor. Birini açınca bütün fiyatları yan yana görürsün.',
      groupTitle: (t, n) => `${t}: ${n} POD üreticisinin fiyatları`, groupDesc: (t, n, v, m) => `${t} en ucuz ${v} (${m}). ${n} print-on-demand üreticisinin fiyatları ucuzdan pahalıya.`,
      catTitle: (l, n) => `${l} fiyatları: ${n} POD üreticisi karşılaştırması`, catDesc: (l, n, v) => `${l} için ${n} print-on-demand ürünü. En düşük fiyat ${v}.`,
      groupPageTitle: l => `${l} POD fiyatları`, catsTitle: 'Tüm POD ürün kategorileri', catsDesc: 'Print-on-demand ürün kategorileri ve her kategorideki en düşük fiyat.',
      makersTitle: 'Print-on-demand üreticileri', makersDesc: n => `${n} print-on-demand üreticisi: ürün sayıları, kategoriler ve en düşük fiyatlar.`,
      makersIntro: (c, r) => `${c} üreticinin fiyatları karşılaştırmada. ${r} üretici, fiyatları üye girişi gerektirdiği ya da yayınlanmadığı için yalnızca bağlantı olarak listeleniyor.`,
      mk: ['Üretici', 'Ürün', 'En düşük', 'Durum'], compared: 'Fiyatlar karşılaştırmada', visit: 'siteye git ↗',
      makerTitle: n => `${n} ürün fiyatları ve katalog`, makerDesc: (n, c, v) => c ? `${n} print-on-demand kataloğunda ${c} ürün; en düşük fiyat ${v}.` : `${n} print-on-demand üreticisi. Fiyat bilgisi henüz karşılaştırmada yok.`,
      makerStats: (n, t, v) => `${n} ürün · ${t} ürün tipi · en düşük ${v}`, makerTop: 'En uygun ürünler', noPrices: r => `Bu üreticinin fiyatları karşılaştırmada yok: ${r.charAt(0).toLocaleLowerCase('tr') + r.slice(1)}. Ürünler ve fiyatlar için üreticinin sitesine bakın.`,
      go: 'Mağazaya git ↗', inGroup: (n) => `${n} üreticide satılıyor, bütün fiyatları karşılaştır`,
      searchTitle: 'Ara', searchDesc: 'Print-on-demand ürünlerini ara ve üretici fiyatlarını karşılaştır.', searching: 'Aranıyor…',
      shipShort: v => `+ ${v} kargo`,
      aboutTitle: 'Hakkında ve yöntem', aboutDesc: `${BRAND} fiyatları nasıl toplar ve karşılaştırır.`,
      about: (c, n, d, badges) => `<p>${BRAND}, Etsy ve diğer pazaryerlerinde satış yapanların her ürün için en ucuz print-on-demand üreticisini bulmasına yardım eden bağımsız bir fiyat karşılaştırma sitesidir. Satış yapmaz, sipariş almaz.</p>
<h2>Ürünler nasıl karşılaştırılıyor?</h2><p>Aynı ürün birden fazla üreticide satılıyorsa tek bir ürün sayfası oluşur ve bütün teklifler ucuzdan pahalıya sıralanır. Ürünler boş ürün modeline (ör. Gildan 5000) ya da ürün tipi ve ölçüsüne (ör. 11oz kupa, 16×20 kanvas) göre eşleştirilir.</p>
<h2>Fiyatlar nereden geliyor?</h2><p>Fiyatlar üreticilerin herkese açık katalog sayfalarından, mağaza beslemelerinden ve açık API'lerinden otomatik alınır ve günde iki kez yenilenir. Üye girişi gerektiren fiyatlar eklenmez; tahmini ya da uydurma fiyat kullanılmaz.</p>
<h2>Fiyat türleri</h2><ul>${badges}</ul>
<p>Kapsam: ${c} üreticiden ${n} ürün. Son güncelleme: ${d}. Tekil ürün sayfaları İngilizcedir.</p>`,
      privacyTitle: 'Gizlilik ve çerez politikası', contactTitle: 'İletişim', contactPending: '<em>(iletişim adresi yayından önce eklenecek)</em>',
      privacy: c => `<p>${BRAND} üyelik, sipariş veya ödeme almaz; ziyaretçilerden ad, adres ya da ödeme bilgisi toplamaz.</p>
<h2>Çerezler ve reklamlar</h2><p>Sitede Google AdSense gibi üçüncü taraf reklam hizmetleri kullanılır. Google dahil üçüncü taraf sağlayıcılar, bu siteye ve diğer sitelere yaptığınız önceki ziyaretlere dayalı reklam sunmak için çerez kullanabilir. Kişiselleştirilmiş reklamcılığı <a href="https://adssettings.google.com" target="_blank" rel="noopener">Google Reklam Ayarları</a> üzerinden kapatabilir, üçüncü taraf çerezleri hakkında <a href="https://www.aboutads.info" target="_blank" rel="noopener">aboutads.info</a> adresinden bilgi alabilirsiniz. AEA, Birleşik Krallık ve İsviçre'deki ziyaretçilerden reklam çerezleri için onay istenir.</p>
<h2>Bağlantılar ve ortaklık programları</h2><p>Üreticilere verilen bazı bağlantılar ortaklık (affiliate) bağlantısı olabilir; bu bağlantılar üzerinden yapılan kayıtlardan ${BRAND} komisyon alabilir. Bu, fiyatları ve sıralamayı etkilemez: sıralama yalnızca fiyata göredir. Sponsorlu alanlar "Sponsorlu" etiketiyle belirtilir.</p>
<h2>Sunucu kayıtları</h2><p>Barındırma sağlayıcımız, güvenlik ve performans amacıyla IP adresi ve tarayıcı bilgisi gibi standart erişim kayıtlarını sınırlı süre tutabilir.</p>
<h2>İletişim</h2><p>${c}</p>`,
      contact: c => `<p>Listede olmayan bir üreticiyi önermek, hatalı bir fiyatı bildirmek veya sponsorluk ve iş birliği için bize yazın: ${c}</p><p>Üreticiyseniz: ürünlerinizin doğru fiyatla listelenmesi için herkese açık bir katalog, ürün beslemesi veya API bağlantısı paylaşabilirsiniz.</p>`,
      contactDesc: `${BRAND} ile iletişim: üretici eklemek, fiyat düzeltmek veya iş birliği için.`,
      footer: `${BRAND}, print-on-demand üreticilerinin herkese açık kataloglarındaki fiyatları karşılaştırır. Satış yapmaz; bir teklife tıklayınca üreticinin kendi sayfasına gidersiniz.`,
      footer2: d => `Fiyatlar üreticinin kaynakta gösterdiği başlangıç veya seçili varyant bedelidir; baskı, kargo, vergi ve minimum adet koşulları üreticiye göre değişir. Son güncelleme: ${d}.`,
      foot: ['Hakkında ve yöntem', 'Üreticiler', 'Gizlilik ve çerezler', 'İletişim'],
      ad: 'Reklam', adPreview: s => `Reklam alanı · ${s}`, adSize: { ust: 'Yatay afiş', liste: 'Liste arası', urun: 'Kare', alt: 'Yatay afiş' },
      sponsored: 'Sponsorlu', sponsorPreview: 'Sponsorlu üretici alanı', review: 'İncele ↗',
      homeTitle: `${BRAND} · Print-on-demand fiyatlarını karşılaştır`, homeDesc: (m, n) => `En ucuz baskı üreticisini bul: ${m} POD üreticisinin ${n} ürününü karşılaştır; tişört, hoodie, kupa, poster, telefon kılıfı ve daha fazlası.`,
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
    if (s) return `<aside class="sponsor"><span class="ad-label">${t.sponsored}</span><b>${esc(provName(s.providerId))}</b> <span>${esc(s.text)}</span> <a class="go" href="${esc(s.url)}" target="_blank" rel="sponsored noopener">${t.review}</a></aside>`;
    if (cfg.adsPreview) return `<aside class="sponsor ad-preview" aria-hidden="true">${esc(t.sponsorPreview)}</aside>`;
    return '';
  };
  const imgTag = (src, alt) => src ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" referrerpolicy="no-referrer">` : `<span class="noimg"></span>`;
  const img = p => imgTag(p.imageUrl, p.title);
  // tekil ürün kartı
  const card = p => `<a class="card" href="${href(P.product(p.id))}"><div class="ci">${img(p)}</div><div class="cb"><div class="ct">${esc(p.title)}</div><div class="cm">${esc(provName(p.providerId))}</div><div class="cp"><b>${esc(fmt(p.baseMinor))}</b>${pbBadge(p.pb)}</div></div></a>`;
  // karşılaştırmalı ürün kartı (grup)
  const gcard = g => `<a class="card" href="${href(P.group(g.slug))}"><div class="ci">${imgTag(g.image, gTitle(g))}</div><div class="cb"><div class="ct">${esc(gTitle(g))}</div><div class="cm">${esc(t.makersN(g.providers.size))}</div><div class="cp"><small>${L.lang === 'en' ? 'from' : 'en ucuz'}</small><b>${esc(fmt(g.lo.baseMinor))}</b></div></div></a>`;
  // Kategori listesindeki "ürün": birden çok sitede satılıyorsa karşılaştırma sayfası, tek sitedeyse kendi sayfası
  const itemsOf = (groupList, singles) => [
    ...groupList.map(g => ({ href: href(P.group(g.slug)), name: gTitle(g), image: g.image, price: g.lo.baseMinor, n: g.providers.size, maker: '', pb: '', best: g.lo.providerId, hi: g.hi.baseMinor })),
    ...singles.map(p => ({ href: href(P.product(p.id)), name: p.title, image: p.imageUrl, price: p.baseMinor, n: 1, maker: p.providerId, pb: p.pb, best: p.providerId, hi: p.baseMinor })),
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
  const ladderOf = list => {
    const best = [...groupBy(list, p => p.providerId)].map(([, l]) => l[0]).sort((a, b) => a.baseMinor - b.baseMinor);
    const row = (p, i) => `<li><span class="rank">${i + 1}</span>${img(p)}<div><a href="${href(P.maker(p.providerId))}"><b>${esc(provName(p.providerId))}</b></a><div class="muted sm"><a href="${href(P.product(p.id))}">${esc(p.title)}</a></div></div><span class="price">${priceHtml(p)}${p.shipping && Object.values(p.shipping)[0] != null ? `<small>${esc(t.shipShort(fmt(Object.values(p.shipping)[0])))}</small>` : ''}</span><a class="go" href="${esc(outbound(p))}" target="_blank" rel="nofollow sponsored noopener">${t.go}</a></li>`;
    const rest = list.filter(p => !best.includes(p));
    return `<ol class="ladder">${best.map(row).join('')}</ol>` + (rest.length ? `<details class="more-offers"><summary>${esc(t.allOffersOf(list.length))}</summary><ol class="ladder">${list.map(row).join('')}</ol></details>` : '');
  };
  return { t, P, fmt, numFmt, dateFmt, lastText, gTitle, pbBadge, priceHtml, ad, sponsor, img, imgTag, card, gcard, cards, gcards, tile, offers, itemsOf, icards };
}

// ---------- sayfa şablonu
const sitemap = [];
// alt: { en: rel, tr: rel } — hreflang ve dil geçişi için
function page(L, H, { rel, title, description, body, jsonld, crumbs, alt, noindex }) {
  const t = H.t;
  const canonical = SITE ? `<link rel="canonical" href="${esc(abs(rel))}">` : '';
  const alts = alt ? Object.entries(alt).map(([lg, r]) => `<link rel="alternate" hreflang="${lg}" href="${esc(SITE + href(r))}">`).join('') + (alt.en ? `<link rel="alternate" hreflang="x-default" href="${esc(SITE + href(alt.en))}">` : '') : '';
  // Cloudflare Web Analytics (çerezsiz ziyaretçi istatistiği): site.config.json cloudflareAnalyticsToken
  const ads = (cfg.adsenseClient ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(cfg.adsenseClient)}" crossorigin="anonymous"></script>` : '')
    + (cfg.cloudflareAnalyticsToken ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${esc(cfg.cloudflareAnalyticsToken)}"}'></script>` : '');
  const bc = crumbs ? `<nav class="crumbs" aria-label="Breadcrumb"><a href="${href(H.P.home)}">${t.home}</a>${crumbs.map(([c, h]) => h ? ` › <a href="${esc(h)}">${esc(c)}</a>` : ` › <span>${esc(c)}</span>`).join('')}</nav>` : '';
  const other = L.lang === 'en' ? 'tr' : 'en';
  const switchTo = alt?.[other] ?? LOCALES[other].path.home;
  const [b1, ...bRest] = BRAND.split(' ');
  return `<!doctype html><html lang="${L.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}">${canonical}${alts}${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="website"><meta property="og:site_name" content="${esc(BRAND)}">
<link rel="stylesheet" href="/assets/site.css?v=${VER}"><link rel="icon" href="/assets/icon.svg" type="image/svg+xml">${ads}
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}</head><body data-lang="${L.lang}">
<header class="top"><div class="wrap"><a class="brand" href="${href(H.P.home)}">${esc(b1)}<span>${esc(bRest.join(' '))}</span></a>
<form class="search" action="${href(H.P.search)}" role="search"><input name="q" type="search" placeholder="${esc(t.searchPh)}" aria-label="${esc(t.searchBtn)}" autocomplete="off"><button>${t.searchBtn}</button></form>
<nav class="topnav"><a href="${href(H.P.categories)}">${t.categories}</a><a href="${href(H.P.compare)}">${t.compare}</a><a href="${href(H.P.makers)}">${t.makers}</a><a href="${href(H.P.calc)}">${t.calc.nav}</a><a class="lang" href="${href(switchTo)}" hreflang="${other}" lang="${other}">${other.toUpperCase()}</a></nav></div></header>
<main class="wrap">${bc}${body}${H.ad('alt')}</main>
<footer class="foot"><div class="wrap"><p>${esc(t.footer)}</p>
<p class="muted">${esc(t.footer2(H.lastText))}</p>
<p class="muted"><a href="${href(H.P.about)}">${t.foot[0]}</a> · <a href="${href(H.P.makers)}">${t.foot[1]}</a> · <a href="${href(H.P.vsIndex)}">${esc(t.vs.indexTitle)}</a> · <a href="${href(H.P.calc)}">${t.calc.nav}</a> · <a href="${href(H.P.privacy)}">${t.foot[2]}</a> · <a href="${href(H.P.contact)}">${t.foot[3]}</a></p>
<p><a href="https://fazier.com/" target="_blank" rel="noopener noreferrer"><img src="https://fazier.com/api/v1//public/badges/launch_badges.svg?badge_type=launched&amp;theme=light" width="105" alt="Launched on Fazier" loading="lazy" style="max-width:100%;height:auto"></a></p></div></footer>
<script src="/assets/site.js?v=${VER}" defer></script></body></html>`;
}

// ---------- üret
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync(path.join(root, 'web'), path.join(out, 'assets'), { recursive: true });
const add = (rel, html) => { write(rel, html); sitemap.push(rel); };

// istemci tarafı ortak veri: [id, başlık, üreticiId, fiyat, kaynakFiyat, görsel, (boş), tip, satışLinki, fiyatTürü]
const singlesOf = list => list.filter(p => !groupOf.has(p.id));
// kâr hesaplayıcı: ürün başına üretici teklifleri [üreticiId, ad, fiyat, fiyatTürü, ilkKargo|null, satışLinki] (baskılı olanlar önce)
for (const g of groups) {
  const best = [...groupBy(g.list, p => p.providerId)].map(([, l]) => l.find(p => !isBlank(p)) || l[0]);
  write(`data/g/${g.slug}.json`, JSON.stringify(best.map(p => [p.providerId, provName(p.providerId), p.baseMinor, p.pb, p.shipping ? Object.values(p.shipping)[0] ?? null : null, outbound(p)])));
}
write('data/search.json', JSON.stringify(products.map(p => [p.id, p.title, p.providerId, p.baseMinor, p.imageUrl || '', p.type, p.model ? p.model.brandName + ' ' + p.model.model : '', p.pb])));

const typeOrder = [...byType.keys()].filter(k => k !== 'diger').sort((a, b) => (groupsByType.get(b)?.length || 0) - (groupsByType.get(a)?.length || 0) || byType.get(b).length - byType.get(a).length);
const typesOf = g => [...byType.keys()].filter(k => typeGroup(k) === g).sort((a, b) => byType.get(b).length - byType.get(a).length);
const groupsOrdered = tx.GROUPS.filter(([g]) => byGroup.has(g)).map(([g]) => g);

for (const lg of LANGS) {
  const L = LOCALES[lg], H = makeHelpers(L), t = H.t, P = H.P;
  const fmt = H.fmt, n = x => H.numFmt.format(x);
  const altAll = f => Object.fromEntries(LANGS.map(k => [k, f(LOCALES[k].path)]));
  const typeTile = k => H.tile(href(P.cat(k)), repImage(byType.get(k)), L.type(k), t.products(n(byType.get(k).length)));
  // ana sayfa kategori menüsü: ana kategori kutusu + alt kategori bağlantıları
  const catBox = g => {
    const subs = typesOf(g), top = subs.slice(0, 8), gh = g === 'diger' ? href(P.cat('diger')) : href(P.cat(g));
    return `<div class="catbox"><a class="cbh" href="${gh}">${H.imgTag(repImage(byGroup.get(g)), L.group(g))}<b>${esc(L.group(g))}</b></a><ul>${top.map(k => `<li><a href="${href(P.cat(k))}">${esc(L.type(k))}</a><span>${n(byType.get(k).length)}</span></li>`).join('')}</ul>${subs.length > 8 ? `<a class="cball" href="${gh}">${esc(t.subAll(subs.length))}</a>` : ''}</div>`;
  };

  write(`data/meta-${lg}.json`, JSON.stringify({
    lang: lg, providers: Object.fromEntries(catalog.providers.map(p => [p.id, p.name])),
    types: Object.fromEntries([...byType.keys()].map(k => [k, L.type(k)])), pb: L.pbLabel, pbNote: L.pbNote,
    paths: { product: '/' + P.product('ID').replace('ID/', ''), maker: '/' + P.maker('ID').replace('ID/', ''), group: '/' + P.group('ID').replace('ID/', '') },
    ui: lg === 'en'
      ? { sortAsc: 'Price: low to high', sortDesc: 'Price: high to low', allTypes: 'All price types', more: 'Show more', left: 'left', none: 'No results.', products: 'products', results: 'Results for', searchTitle: 'Search', typeQuery: 'Type a product, blank or manufacturer.', noHits: 'No results. Try a broader word or browse the categories.', failed: 'Search could not load.', allMakersLabel: 'All manufacturers', groupsH: 'Compare prices', productsH: 'Products', makers: 'manufacturers', sortSites: 'Sold at most stores', viewCards: 'Cards', viewTable: 'Price board', sitesN: 'Sold at {n} stores', cheapest: 'cheapest', th: ['Product', 'Stores', 'Lowest', 'Highest', 'Cheapest at'] }
      : { sortAsc: 'Fiyat: ucuzdan pahalıya', sortDesc: 'Fiyat: pahalıdan ucuza', allTypes: 'Tüm fiyat türleri', more: 'Daha fazla göster', left: 'kaldı', none: 'Sonuç bulunamadı.', products: 'ürün', results: 'Sonuçlar:', searchTitle: 'Arama', typeQuery: 'Ürün, model veya üretici adı yazın.', noHits: 'Sonuç bulunamadı. Daha genel bir kelime deneyin ya da kategorilere göz atın.', failed: 'Arama yüklenemedi.', allMakersLabel: 'Tüm üreticiler', groupsH: 'Fiyat karşılaştır', productsH: 'Ürünler', makers: 'üretici', sortSites: 'En çok sitede satılan', viewCards: 'Kartlar', viewTable: 'Fiyat borsası', sitesN: '{n} sitede satılıyor', cheapest: 'en ucuz', th: ['Ürün', 'Site', 'En düşük', 'En yüksek', 'En ucuz site'] },
  }));
  // kategori listeleri: [adres, ad, görsel, en düşük, site sayısı, tek sitedeyse üretici, en yüksek, en ucuz site]
  const itemRow = it => [it.href, it.name, it.image || '', it.price, it.n, it.maker, it.hi, it.best];
  const typeItems = new Map([...byType].map(([k, list]) => [k, H.itemsOf(groupsByType.get(k) || [], singlesOf(list))]));
  for (const [k, items] of typeItems) write(`data/k/${lg}/${k}.json`, JSON.stringify(items.map(itemRow)));
  // arama için ürün grupları: [slug, ad, görsel, en düşük fiyat, üretici sayısı, tip]
  write(`data/groups-${lg}.json`, JSON.stringify(groups.map(g => [g.slug, H.gTitle(g), g.image || '', g.lo.baseMinor, g.providers.size, g.type])));

  // ana sayfa
  add(P.home + 'index.html', page(L, H, {
    rel: P.home + 'index.html', alt: altAll(p => p.home), title: t.homeTitle, description: t.homeDesc(connected.length, n(products.length)),
    body: `<section class="hero"><h1>${esc(t.heroH)}</h1><p>${esc(t.heroP(connected.length, n(products.length)))}</p>
<form class="search big" action="${href(P.search)}" role="search"><input name="q" type="search" placeholder="${esc(t.searchBig)}" aria-label="${esc(t.searchBtn)}" autocomplete="off"><button>${t.searchBtn}</button></form>
<div class="quick">${L.quick.map(q => `<a href="${href(P.search)}?q=${encodeURIComponent(q)}">${esc(q)}</a>`).join('')}</div></section>
${H.ad('ust')}
<h2>${t.catMenu}</h2><div class="catmenu">${groupsOrdered.map(catBox).join('')}</div>
<div class="sec-head"><h2>${t.topGroups}</h2><a href="${href(P.compare)}">${t.seeAll} →</a></div>${H.icards(H.itemsOf(groups.slice(0, 12), []))}`,
    jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', name: BRAND, url: SITE || undefined, inLanguage: lg, potentialAction: { '@type': 'SearchAction', target: SITE + href(P.search) + '?q={q}', 'query-input': 'required name=q' } },
  }));

  // kategoriler dizini: ana gruplara göre fotoğraflı kutular
  add(P.categories + 'index.html', page(L, H, {
    rel: P.categories + 'index.html', alt: altAll(p => p.categories), title: `${t.catsTitle} · ${BRAND}`, description: t.catsDesc, crumbs: [[t.categories]],
    body: `<h1>${t.categories}</h1>${groupsOrdered.map(g => `<div class="sec-head"><h2>${esc(L.group(g))}</h2>${g === 'diger' ? '' : `<a href="${href(P.cat(g))}">${t.seeAll} →</a>`}</div><div class="tiles">${typesOf(g).map(typeTile).join('')}</div>`).join('')}`,
  }));

  // ana grup sayfaları
  for (const g of groupsOrdered) {
    if (g === 'diger') continue;
    const list = byGroup.get(g), label = L.group(g);
    const gGroups = groups.filter(x => typeGroup(x.type) === g);
    add(P.cat(g) + 'index.html', page(L, H, {
      rel: P.cat(g) + 'index.html', alt: altAll(p => p.cat(g)), title: `${t.groupPageTitle(label)} · ${BRAND}`, description: t.catDesc(label, list.length, fmt(list[0].baseMinor)),
      crumbs: [[t.categories, href(P.categories)], [label]],
      body: `<h1>${esc(label)}</h1><div class="tiles">${typesOf(g).map(typeTile).join('')}</div>
${gGroups.length ? `<h2>${t.topGroups}</h2>${H.icards(H.itemsOf(gGroups.slice(0, 24), []))}` : ''}`,
    }));
  }

  // ürün tipi sayfaları: önce karşılaştırmalı ürünler, sonra bütün ürünler
  for (const [k, list] of byType) {
    const label = L.type(k), g = typeGroup(k), provN = new Set(list.map(p => p.providerId)).size, items = typeItems.get(k);
    add(P.cat(k) + 'index.html', page(L, H, {
      rel: P.cat(k) + 'index.html', alt: altAll(p => p.cat(k)), title: `${t.catTitle(label, provN)} · ${BRAND}`, description: t.catDesc(label, list.length, fmt(list[0].baseMinor)),
      crumbs: [[t.categories, href(P.categories)], [L.group(g), g === 'diger' ? null : href(P.cat(g))], [label]],
      body: `<h1>${esc(label)}</h1><p class="muted">${t.products(n(items.length))} · ${t.makersN(provN)} · ${t.from(fmt(list[0].baseMinor))}</p>
${H.sponsor(k)}${H.ad('liste')}<div class="list" data-items="/data/k/${lg}/${k}.json">${H.icards(items.slice(0, 48))}</div>`,
      jsonld: { '@context': 'https://schema.org', '@type': 'ItemList', name: label, numberOfItems: list.length, itemListElement: list.slice(0, 10).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + href(LOCALES.en.path.product(p.id)), name: p.title })) },
    }));
  }

  // karşılaştırma dizini ve ürün karşılaştırma sayfaları (sitenin ana sayfa türü)
  add(P.compare + 'index.html', page(L, H, {
    rel: P.compare + 'index.html', alt: altAll(p => p.compare), title: `${t.compareTitle} · ${BRAND}`, description: t.compareDesc(groups.length), crumbs: [[t.compare]],
    body: `<h1>${t.compare}</h1><p class="muted">${esc(t.compareIntro)}</p>${H.gcards(groups)}`,
  }));
  for (const gp of groups) {
    const title = H.gTitle(gp), lo = gp.lo, hi = gp.hi;
    add(P.group(gp.slug) + 'index.html', page(L, H, {
      rel: P.group(gp.slug) + 'index.html', alt: altAll(p => p.group(gp.slug)),
      title: `${t.groupTitle(title, gp.providers.size)} · ${BRAND}`, description: t.groupDesc(title, gp.providers.size, fmt(lo.baseMinor), provName(lo.providerId)),
      crumbs: [[L.type(gp.type), href(P.cat(gp.type))], [title]],
      body: `<section class="ghead"><div class="gimg">${H.imgTag(gp.image, title)}</div><div><h1>${esc(title)}</h1>
<p class="gfrom"><b>${esc(fmt(lo.baseMinor))}</b> <span>– ${esc(fmt(hi.baseMinor))}</span></p>
<p class="muted">${esc(t.makersN(gp.providers.size))} · ${esc(gp.key.startsWith('m:') ? t.groupNoteModel : t.groupNoteSpec)}</p></div></section>
${H.sponsor(gp.type)}<h2>${esc(t.offersH(gp.providers.size))}</h2><p class="muted sm">${esc(t.cheapestFirst)}</p>${H.offers(gp.list)}${H.ad('liste')}`,
      jsonld: { '@context': 'https://schema.org', '@type': 'Product', name: title, image: gp.image || undefined, brand: gp.sample.model ? { '@type': 'Brand', name: gp.sample.model.brandName } : undefined,
        offers: { '@type': 'AggregateOffer', priceCurrency: 'USD', lowPrice: (lo.baseMinor / 100).toFixed(2), highPrice: (hi.baseMinor / 100).toFixed(2), offerCount: gp.list.length } },
    }));
  }

  // üreticiler
  const provRows = catalog.providers.map(p => ({ p, list: byProvider.get(p.id) || [] })).sort((a, b) => b.list.length - a.list.length || a.p.name.localeCompare(b.p.name));
  add(P.makers + 'index.html', page(L, H, {
    rel: P.makers + 'index.html', alt: altAll(p => p.makers), title: `${t.makersTitle} · ${BRAND}`, description: t.makersDesc(catalog.providers.length), crumbs: [[t.makers]],
    body: `<h1>${t.makers}</h1><p class="muted">${esc(t.makersIntro(connected.length, catalog.providers.length - connected.length))}</p>
<p><a class="go" href="${href(P.vsIndex)}">${esc(t.vs.indexTitle)} →</a></p>
<div class="tbl"><table><thead><tr><th>${t.mk[0]}</th><th class="num">${t.mk[1]}</th><th class="num">${t.mk[2]}</th><th>${t.mk[3]}</th></tr></thead><tbody>
${provRows.map(({ p, list }) => `<tr><td><a href="${href(P.maker(p.id))}"><b>${esc(p.name)}</b></a></td><td class="num">${list.length || '–'}</td><td class="num">${list.length ? fmt(list[0].baseMinor) : '–'}</td><td class="sm">${list.length ? t.compared : esc(reasonOf(p, L)) + ` · <a class="go" href="${esc(p.homepage)}" target="_blank" rel="nofollow noopener">${t.visit}</a>`}</td></tr>`).join('')}
</tbody></table></div>`,
  }));
  for (const { p, list } of provRows) {
    const types = [...groupBy(list, x => x.type)].sort((a, b) => b[1].length - a[1].length);
    add(P.maker(p.id) + 'index.html', page(L, H, {
      rel: P.maker(p.id) + 'index.html', alt: altAll(x => x.maker(p.id)), title: `${t.makerTitle(p.name)} · ${BRAND}`, description: t.makerDesc(p.name, list.length, list.length ? fmt(list[0].baseMinor) : ''),
      crumbs: [[t.makers, href(P.makers)], [p.name]],
      body: `<h1>${esc(p.name)}</h1><p><a class="go" href="${esc(p.homepage)}" target="_blank" rel="nofollow noopener">${esc(new URL(p.homepage).hostname.replace(/^www\./, ''))} ↗</a></p>
${list.length ? `<p class="muted">${t.makerStats(list.length, types.length, fmt(list[0].baseMinor))}</p>
<div class="chips">${types.map(([k, l]) => `<a class="chip" href="${href(P.cat(k))}"><b>${esc(L.type(k))}</b><span>${t.products(l.length)} · ${t.from(fmt(l[0].baseMinor))}</span></a>`).join('')}</div>
${vsOf.has(p.id) ? `<h2>${esc(t.vs.makerH(p.name))}</h2><div class="chips">${vsOf.get(p.id).slice(0, 20).map(v => `<a class="chip" href="${href(P.vs(v.slug))}"><b>${esc(provName(v.a))} vs ${esc(provName(v.b))}</b><span>${esc(t.vs.shared(v.rows.length))}</span></a>`).join('')}</div>` : ''}
<h2>${t.makerTop}</h2>${H.cards(list.slice(0, 40))}` : `<p class="muted">${esc(t.noPrices(reasonOf(p, L)))}</p>`}`,
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
    const side = (id, sum) => { const l = byProvider.get(id) || []; return `<div class="vs-side"><a href="${href(P.maker(id))}"><b>${esc(provName(id))}</b></a><span>${esc(t.products(n(l.length)))} · ${esc(V.lowest)} ${esc(fmt(l[0].baseMinor))}</span><span>${H.pbBadge(PB.printBasis({ providerId: id, title: '' }))}</span><span class="sm muted">${esc(V.wins(provName(id), id === v.a ? v.aWins : v.bWins, cnt))}</span><a class="go" href="${esc(providers.get(id).homepage)}" target="_blank" rel="nofollow noopener">${esc(new URL(providers.get(id).homepage).hostname.replace(/^www\./, ''))} ↗</a></div>`; };
    const rowHtml = r => {
      const d = r.a.baseMinor - r.b.baseMinor, win = d < 0 ? 'a' : d > 0 ? 'b' : '';
      return `<tr><td><a href="${href(P.group(r.g.slug))}">${esc(H.gTitle(r.g))}</a></td><td class="num${win === 'a' ? ' win' : ''}"><a href="${esc(outbound(r.a))}" target="_blank" rel="nofollow sponsored noopener">${esc(fmt(r.a.baseMinor))}</a></td><td class="num${win === 'b' ? ' win' : ''}"><a href="${esc(outbound(r.b))}" target="_blank" rel="nofollow sponsored noopener">${esc(fmt(r.b.baseMinor))}</a></td><td class="num sm">${d === 0 ? esc(V.same) : `${esc(provName(win === 'a' ? v.a : v.b))} −${esc(fmt(Math.abs(d)))}`}</td></tr>`;
    };
    const others = [...new Set([...(vsOf.get(v.a) || []), ...(vsOf.get(v.b) || [])])].filter(x => x !== v).slice(0, 16);
    const winnerLine = verdict(v);
    add(P.vs(v.slug) + 'index.html', page(L, H, {
      rel: P.vs(v.slug) + 'index.html', alt: altAll(p => p.vs(v.slug)), title: `${V.title(A, B)} · ${BRAND}`, description: V.desc(A, B, cnt, winnerLine),
      crumbs: [[V.indexTitle, href(P.vsIndex)], [`${A} vs ${B}`]],
      body: `<h1>${esc(V.h1(A, B))}</h1><p class="muted">${esc(V.sub)} · ${esc(V.shared(cnt))}</p>
<div class="verdict"><b>${esc(winnerLine)}.</b><p>${esc(V.totals(cnt, A, fmt(v.sumA), B, fmt(v.sumB)))}</p></div>
<div class="vs-sides">${side(v.a)}${side(v.b)}</div>${H.ad('liste')}
<div class="tbl"><table class="vs-table"><thead><tr><th>${esc(V.th[0])}</th><th class="num">${esc(A)}</th><th class="num">${esc(B)}</th><th class="num">${esc(V.th[1])}</th></tr></thead><tbody>${v.rows.map(rowHtml).join('')}</tbody></table></div>
<p class="muted sm">${esc(V.note)}</p>${others.length ? `<h2>${esc(V.others)}</h2><div class="chips">${others.map(vsLink).join('')}</div>` : ''}`,
      jsonld: { '@context': 'https://schema.org', '@type': 'WebPage', name: V.title(A, B), about: [A, B].map(name => ({ '@type': 'Organization', name })) },
    }));
  }

  // kâr hesaplayıcı (istemci tarafı; veri: data/groups-<dil>.json + data/g/<slug>.json)
  const C = t.calc;
  add(P.calc + 'index.html', page(L, H, {
    rel: P.calc + 'index.html', alt: altAll(p => p.calc), title: `${C.title} · ${BRAND}`, description: C.desc, crumbs: [[C.nav]],
    body: `<h1>${esc(C.title)}</h1><p class="muted">${esc(C.intro)}</p>
<form id="calc" class="calc" onsubmit="return false">
<label class="wide">${esc(C.product)}<select name="g"><option value="">—</option></select></label>
<label>${esc(C.price)}<input name="price" type="number" min="0" step="0.01" value="24.99"></label>
<label>${esc(C.shipIn)}<input name="shipIn" type="number" min="0" step="0.01" value="0"></label>
<label>${esc(C.shipOut)}<input name="shipOut" type="number" min="0" step="0.01" value="0"></label>
<label>${esc(C.platform)}<select name="platform"><option value="etsy">Etsy</option><option value="shopify">Shopify</option><option value="amazon">Amazon Handmade</option><option value="custom">${esc(C.custom)}</option></select></label>
<label class="custom" hidden>${esc(C.pct)}<input name="pct" type="number" min="0" step="0.1" value="10"></label>
<label class="custom" hidden>${esc(C.fixed)}<input name="fixed" type="number" min="0" step="0.01" value="0.30"></label>
</form><div id="calc-out"><p class="muted">${esc(C.pick)}</p></div>
<p class="muted sm">${esc(C.fees)}</p>`,
  }));

  // arama, hakkında, gizlilik, iletişim
  add(P.search + 'index.html', page(L, H, {
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
      push(F.type, `<a href="${href(P.cat(p.type))}">${esc(L.type(p.type))}</a>`);
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
        rel, title: `${t.productTitle(p.title, prov, fmt(p.baseMinor))} · ${BRAND}`, description: t.productDesc(prov, p.title, fmt(p.baseMinor), label),
        crumbs: [[L.group(g), g === 'diger' ? null : href(P.cat(g))], [label, href(P.cat(p.type))], [p.title]],
        body: `<article class="product"><div class="pimg">${H.img(p)}</div><div class="pinfo">
<p class="muted"><a href="${href(P.maker(p.providerId))}">${esc(prov)}</a></p><h1>${esc(p.title)}</h1>
<p class="bigprice">${H.priceHtml(p)}</p>
${gp ? `<a class="ingroup" href="${href(P.group(gp.slug))}">${esc(t.inGroup(gp.providers.size))} →</a>` : ''}
<a class="cta" href="${esc(outbound(p))}" target="_blank" rel="nofollow sponsored noopener">${esc(t.cta(prov))}</a>
<dl class="feat">${features(p).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>${H.ad('urun')}</div></article>
${gp ? `<h2>${esc(t.sameGroup)}</h2>${H.offers(gp.list)}` : similar.length ? `<h2>${esc(t.otherMakers(label))}</h2>${H.cards(similar)}` : ''}`,
        jsonld: { '@context': 'https://schema.org', '@type': 'Product', name: p.title, image: p.imageUrl || undefined, brand: p.model ? { '@type': 'Brand', name: p.model.brandName } : undefined, offers: { '@type': 'Offer', price: (p.baseMinor / 100).toFixed(2), priceCurrency: 'USD', url: p.sourceUrl, seller: { '@type': 'Organization', name: prov } } },
      }));
      sitemap.push(rel);
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
if (SITE) write('CNAME', new URL(SITE).hostname + '\n');
// IndexNow (Bing, Yandex vb.): anahtar dosyası site kökünde olmalı; bildirim scripts/indexnow.cjs ile
if (cfg.indexNowKey) write(cfg.indexNowKey + '.txt', cfg.indexNowKey);
if (cfg.adsenseClient) write('ads.txt', `google.com, ${cfg.adsenseClient.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`);

// sitemap / robots
if (SITE) {
  const chunks = [];
  for (let i = 0; i < sitemap.length; i += 40000) chunks.push(sitemap.slice(i, i + 40000));
  chunks.forEach((c, i) => write(`sitemap-${i + 1}.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${c.map(r => `<url><loc>${esc(abs(r))}</loc></url>`).join('')}</urlset>`));
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${chunks.map((_, i) => `<sitemap><loc>${SITE}/sitemap-${i + 1}.xml</loc></sitemap>`).join('')}</sitemapindex>`);
  write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /search/\nDisallow: /tr/ara/\nSitemap: ${SITE}/sitemap.xml\n`);
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
