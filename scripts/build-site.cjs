// POD Pricing herkese açık site üreticisi: data/catalog.json -> site/
// İngilizce (kök) ve Türkçe (/tr/) sayfalar üretir. Ürün sayfaları yalnızca İngilizce.
// Kullanım: node scripts/build-site.cjs
'use strict';
const fs = require('node:fs'), path = require('node:path');
const tx = require('./pod-taxonomy.cjs');
const EN = require('./pod-taxonomy-en.cjs');
const PB = require('./print-basis.cjs');
const I18N = require('./i18n-data.cjs');

const root = path.resolve(__dirname, '..');
const finalOut = path.join(root, 'site');
const out = path.join(root, 'site.__build'); // derleme bitince site/ ile yer değiştirir
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'site.config.json'), 'utf8'));
const SITE = (cfg.siteUrl || '').replace(/\/$/, '');
const BRAND = cfg.siteName || 'POD Pricing';

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
    return { ...p, title: decode(p.title), type: c.type, group: c.group, model: m && m.key ? m : null, pb: PB.printBasis(p) };
  })
  .sort((a, b) => a.baseMinor - b.baseMinor);
const typeGroup = id => id === 'diger' ? 'diger' : tx.TYPE_BY_ID.get(id)?.group || 'diger';
const byType = groupBy(products, p => p.type);
const byGroup = groupBy(products, p => p.group);
const byProvider = groupBy(products, p => p.providerId);
const byModel = groupBy(products.filter(p => p.model), p => p.model.key);
// karşılaştırma: en az iki üreticide bulunan boş ürün modelleri
const models = [...byModel].map(([key, list]) => ({ key, list, brandName: list[0].model.brandName, model: list[0].model.model, providers: new Set(list.map(p => p.providerId)) }))
  .filter(m => m.providers.size >= 2)
  .map(m => ({ ...m, type: mostCommon(m.list.map(p => p.type)) }))
  .sort((a, b) => b.providers.size - a.providers.size || a.list[0].baseMinor - b.list[0].baseMinor);
const modelByKey = new Map(models.map(m => [m.key, m]));
function modelPrices(m) { const o = { dahil: [], bos: [], toplu: [], belirsiz: [] }; for (const p of m.list) o[p.pb].push(p); return o; }
const groupsOrdered = tx.GROUPS.filter(([g]) => byGroup.has(g)).map(([g]) => g);
const typesOf = g => [...byType.keys()].filter(t => typeGroup(t) === g).sort((a, b) => byType.get(b).length - byType.get(a).length);
const connected = catalog.providers.filter(p => byProvider.has(p.id));
const lastCheck = products.reduce((a, p) => (p.checkedAt || '') > a ? p.checkedAt : a, '');
const provName = id => providers.get(id)?.name || id;

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
};
const reasonOf = (p, L) => { const r = p.connection?.blockedReason; if (!r || /henüz tamamlanmadı/.test(r)) return L.notAdded; return L.lang === 'en' ? (REASON_EN[r] || L.notAdded) : r; };

// ---------- dil sözlükleri ve adresler
const LOCALES = {
  en: {
    lang: 'en', intl: 'en-US', prefix: '',
    path: { home: '', categories: 'categories/', cat: id => `category/${id === 'diger' ? EN.TYPES.diger[1] : (EN.TYPES[id] || EN.GROUPS[id])[1]}/`, models: 'models/', model: k => `model/${k}/`,
      makers: 'manufacturers/', maker: id => `manufacturer/${id}/`, product: id => `product/${id}/`, search: 'search/', about: 'about/', privacy: 'privacy/', contact: 'contact/' },
    type: id => (EN.TYPES[id] || ['Other Products'])[0], group: g => (EN.GROUPS[g] || ['Other'])[0],
    pbLabel: PB.LABEL_EN, pbNote: PB.NOTE_EN,
    basis: I18N.basisEn, sizes: I18N.sizesEn, production: I18N.productionEn, method: I18N.methodEn,
    notAdded: 'Prices not added yet',
    t: {
      home: 'Home', categories: 'Categories', models: 'Blank Exchange', makers: 'Manufacturers', search: 'Search', searchBtn: 'Search',
      searchPh: 'Search products, blanks or manufacturers (e.g. gildan 5000, hoodie, mug)', searchBig: 'What do you want to print? (e.g. oversized tee, 11oz mug, tote bag)',
      product: 'Product', maker: 'Manufacturer', type: 'Type', price: 'Price', go: 'Go to store ↗', from: v => `from ${v}`, products: n => `${n} products`, makersN: n => `${n} manufacturers`,
      tagline: 'Print-on-demand price comparison',
      heroH: 'Compare print-on-demand prices',
      heroP: (m, n) => `Compare <b>${n}</b> products from ${m} print-on-demand manufacturers. Sorted cheapest first — click through to the manufacturer's own page.`,
      stats: [['manufacturers'], ['products'], ['blanks compared'], ['twice', 'daily updates']],
      how: [['Search', 'Type the product or blank you want to print.'], ['Compare', 'Cheapest first; print-included and blank prices are labeled separately.'], ['Go to the manufacturer', 'Open the best offer on the manufacturer site in one click.']],
      modelsH: 'Blank exchange: same blank, different manufacturers', modelsP: 'The same blank (e.g. Gildan 5000, Bella+Canvas 3001) is sold by many POD companies. Print-included prices are compared separately from blank prices.',
      allModels: n => `All blanks (${n}) →`, catsH: 'Categories',
      mt: ['Blank', 'Type', 'Makers', 'Print incl. lowest', 'Print incl. highest', 'Saving', 'Blank lowest'],
      ladder: [['dahil', 'Print-included prices', 'Production cost with one print area/design. Start here for a fair comparison.'], ['bos', 'Blank prices', 'Unprinted product price; the manufacturer charges printing separately.'], ['toplu', 'Bulk order prices', 'Bulk printing prices with a minimum order.'], ['belirsiz', 'Prices with terms at source', 'The source does not state whether printing is included.']],
      ladderN: n => `${n} manufacturers`, offers: n => `${n} offers`, lowestPrint: v => `lowest print-included ${v}`, lowestBlank: v => `lowest blank ${v}`,
      sameBlankNote: 'The same blank can be priced differently by print method (DTG, DTF, embroidery), print area, shipping and tax. See each product page for details.',
      allOffers: 'All offers', top30: 'Best 30 deals in this category', blanksInCat: 'Blanks in this category', lowest: v => `lowest ${v}`,
      catTitle: (l, n) => `${l} prices: compare ${n} print-on-demand manufacturers`, catDesc: (l, n, v, m) => `${n} print-on-demand ${l.toLowerCase()} sorted by price. Cheapest: ${v} (${m}).`,
      groupTitle: l => `${l} print-on-demand prices`, groupDesc: (l, n, m, v) => `${n} print-on-demand products in ${l}, ${m} manufacturers. Lowest price ${v}.`,
      modelTitle: (t, n) => `${t} prices: ${n} print-on-demand manufacturers compared`,
      modelDesc: (b, d, bl, n) => `${b} lowest print-included price ${d}${bl ? `, blank ${bl}` : ''}. ${n} print-on-demand manufacturers compared, cheapest first.`,
      modelsTitle: 'Blank exchange: Gildan, Bella+Canvas, Comfort Colors prices across POD companies', modelsDesc: n => `Prices of ${n} blank models across print-on-demand manufacturers: Gildan 5000, Bella+Canvas 3001, Comfort Colors 1717 and more.`,
      modelsIntro: 'Manufacturers selling the same blank. Print-included and blank prices are shown in separate columns; Saving compares the cheapest and most expensive print-included offer.',
      catsTitle: 'All print-on-demand product categories', catsDesc: 'Print-on-demand product categories with the lowest manufacturer price in each.',
      makersTitle: 'Print-on-demand manufacturers', makersDesc: n => `${n} print-on-demand manufacturers: product counts, categories and lowest prices.`,
      makersIntro: (c, r) => `Prices from ${c} manufacturers are compared. ${r} more are listed as links because their prices require login or have not been added yet.`,
      mk: ['Manufacturer', 'Products', 'Lowest', 'Status'], compared: 'Prices compared', visit: 'visit site ↗',
      makerTitle: n => `${n} product prices and catalog`, makerDesc: (n, c, v) => c ? `${c} products in the ${n} print-on-demand catalog; lowest price ${v}. Compare with other manufacturers.` : `${n} print-on-demand manufacturer. Prices not yet in the comparison.`,
      makerStats: (n, t, v) => `${n} products · ${t} product types · lowest ${v}`, top40: 'Best 40 deals', noPrices: r => `This manufacturer's prices are not in the comparison: ${r}. Visit the manufacturer site for products and prices.`,
      productTitle: (t, m, v) => `${t} · ${m} · ${v}`, productDesc: (m, t, v, l, n, r) => `${m} ${t}: ${v}. Ranked #${r} cheapest of ${n} ${l.toLowerCase()}. Sizes, materials and pricing terms.`,
      rankNote: (l, n, r) => `#${r} cheapest of ${n} products in ${l}.`, cta: m => `Go to ${m} ↗`,
      sameModel: (b) => `Same blank at other offers (${b})`, otherMakers: l => `${l} from other manufacturers`,
      f: { type: 'Product type', maker: 'Manufacturer', blank: 'Blank model', pbt: 'Price type', basis: 'Pricing basis', src: 'Source price', fx: (r, d) => `(rate ${r}, ${d})`, range: 'Price range',
        orig: 'Before discount', member: 'Membership price', memberNote: '(on the manufacturer\'s paid plan)', methods: 'Print methods', sizes: 'Sizes / variants', material: 'Material',
        moq: 'Minimum quantity', mov: 'Minimum order value', prod: 'Production time', print: 'Printing', printNote: 'Price is for the blank product; printing is charged separately', ship: 'Shipping',
        shipIncl: 'Shipping included (as stated at source)', shipFrom: (k, v) => `${k}: from ${v}`, total: v => `(approx. total ${v})`, region: 'Production / shipping region', facilities: 'Production facilities', checked: 'Last checked' },
      searchTitle: 'Search', searchDesc: 'Search print-on-demand products and compare manufacturer prices.', searching: 'Searching…',
      aboutTitle: 'About and methodology', aboutDesc: `How ${BRAND} collects and compares prices.`,
      about: (c, n, d, badges) => `<p>${BRAND} is an independent price comparison site that helps Etsy, Shopify and marketplace sellers compare print-on-demand production costs. We do not sell anything or take orders.</p>
<h2>Where do prices come from?</h2><p>Prices are collected automatically from manufacturers' public catalog pages, store feeds and public APIs, and refreshed regularly. Prices behind a login are not included; we never estimate or invent prices.</p>
<h2>What does a price include?</h2><p>The price shown is the starting price or the selected standard variant price shown at the source. Printing, shipping, tax and minimum order terms vary by manufacturer and are listed on each product page. Always confirm the final amount on the manufacturer site.</p>
<h2>Price types</h2><ul>${badges}</ul><p>For a fair comparison, blank pages list print-included and blank prices separately.</p>
<h2>Currencies</h2><p>Non-USD prices are converted to approximate USD with daily reference rates (Frankfurter) for sorting; the source price is shown as well.</p>
<p>Coverage: ${n} products from ${c} manufacturers. Last updated: ${d}.</p>`,
      privacyTitle: 'Privacy and cookie policy', contactTitle: 'Contact', contactPending: '<em>(contact address will be added before launch)</em>',
      privacy: c => `<p>${BRAND} has no accounts, orders or payments, and does not collect names, addresses or payment details.</p>
<h2>Cookies and advertising</h2><p>We may use third-party advertising such as Google AdSense. Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this and other websites. Google's use of advertising cookies enables it and its partners to serve ads based on your visits to this site and/or other sites on the Internet. You can opt out of personalized advertising in <a href="https://adssettings.google.com" target="_blank" rel="noopener">Google Ads Settings</a>, and learn more about third-party cookies at <a href="https://www.aboutads.info" target="_blank" rel="noopener">aboutads.info</a>. Visitors in the EEA and UK are asked for consent to advertising cookies.</p>
<h2>Links and affiliate programs</h2><p>Some links to manufacturers may be affiliate links; ${BRAND} may earn a commission on sign-ups through them. This never affects prices or ranking — ranking is by price only. Sponsored placements are labeled "Sponsored".</p>
<h2>Server logs</h2><p>Our hosting provider may keep standard access logs (IP address, browser) for a limited time for security and performance.</p>
<h2>Contact</h2><p>${c}</p>`,
      contact: c => `<p>To suggest a manufacturer, report a wrong price, or ask about sponsorship and partnerships, write to us: ${c}</p><p>Manufacturers: share a public catalog, product feed or API so your products are listed with accurate prices.</p>`,
      contactDesc: `Contact ${BRAND}: add a manufacturer, fix a price or partner with us.`,
      notFound: 'Page not found', notFoundP: 'The product may have been removed from the catalog. <a href="/">Go to the homepage</a> or search.',
      footer: `${BRAND} compares prices from print-on-demand manufacturers' public catalogs. We don't sell anything — clicking a product takes you to the manufacturer's own page.`,
      footer2: d => `Prices are the starting or selected-variant prices shown at the source; printing, shipping, tax and minimum quantities vary by manufacturer. Other currencies are converted to approximate USD with daily reference rates for sorting. Last updated: ${d}.`,
      foot: ['About & methodology', 'Manufacturers', 'Privacy & cookies', 'Contact'],
      ad: 'Ad', adPreview: s => `Ad slot · ${s}`, adSize: { ust: 'Leaderboard · 728×90 / mobile 320×100', liste: 'In-list · responsive', urun: 'Rectangle · 300×250', alt: 'Leaderboard · 728×90' },
      sponsored: 'Sponsored', sponsorPreview: 'Sponsored manufacturer slot · for direct partnerships', review: 'View ↗',
      homeTitle: `${BRAND} · Compare print-on-demand prices`, homeDesc: (m, n) => `Compare ${n} products from ${m} print-on-demand manufacturers, cheapest first: t-shirts, hoodies, mugs, posters, phone cases and more.`,
    },
  },
  tr: {
    lang: 'tr', intl: 'tr-TR', prefix: 'tr/',
    path: { home: 'tr/', categories: 'tr/kategoriler/', cat: id => `tr/kategori/${id}/`, models: 'tr/borsa/', model: k => `tr/model/${k}/`,
      makers: 'tr/ureticiler/', maker: id => `tr/uretici/${id}/`, product: id => `product/${id}/`, search: 'tr/ara/', about: 'tr/hakkinda/', privacy: 'tr/gizlilik/', contact: 'tr/iletisim/' },
    type: id => id === 'diger' ? 'Diğer Ürünler' : tx.TYPE_BY_ID.get(id)?.label || id, group: g => tx.GROUP_LABEL.get(g) || 'Diğer',
    pbLabel: PB.LABEL, pbNote: PB.NOTE,
    basis: s => s, sizes: s => s, production: s => s, method: m => m,
    notAdded: 'Fiyatlar henüz eklenmedi',
    t: {
      home: 'Ana sayfa', categories: 'Kategoriler', models: 'Model Borsası', makers: 'Üreticiler', search: 'Arama', searchBtn: 'Ara',
      searchPh: 'Ürün, model veya üretici ara (ör. gildan 5000, hoodie, mug)', searchBig: 'Ne basmak istiyorsunuz? (ör. oversized tişört, 11oz kupa, tote bag)',
      product: 'Ürün', maker: 'Üretici', type: 'Tip', price: 'Fiyat', go: 'Satış sayfası ↗', from: v => `${v}'dan`, products: n => `${n} ürün`, makersN: n => `${n} üretici`,
      tagline: 'Print-on-demand fiyat karşılaştırma',
      heroH: 'POD üreticilerinin fiyat borsası',
      heroP: (m, n) => `${m} üreticinin <b>${n}</b> ürününü tek ekranda karşılaştırın. Ürünler ucuzdan pahalıya sıralanır, tıklayınca üreticinin satış sayfasına gidersiniz.`,
      stats: [['üretici'], ['ürün'], ['karşılaştırılan model'], ['günde 2 kez', 'güncellenir']],
      how: [['Ara', 'Basmak istediğin ürünü ya da modeli yaz.'], ['Karşılaştır', 'Üreticiler ucuzdan pahalıya; baskı dahil ve boş ürün fiyatları ayrı etiketli.'], ['Üreticiye git', 'Beğendiğin teklifin satış sayfasına tek tıkla geç.']],
      modelsH: 'Model borsası: aynı ürün, farklı üreticiler', modelsP: 'Aynı boş ürün modeli (ör. Gildan 5000, Bella+Canvas 3001) birden fazla üreticide satılıyor. Baskı dahil fiyatlar boş ürün fiyatlarından ayrı karşılaştırılır.',
      allModels: n => `Tüm modeller (${n}) →`, catsH: 'Kategoriler',
      mt: ['Model', 'Tip', 'Üretici', 'Baskı dahil en düşük', 'Baskı dahil en yüksek', 'Fark', 'Boş ürün en düşük'],
      ladder: [['dahil', 'Baskı dahil fiyatlar', 'Tek baskı alanı/tasarım dahil üretim maliyeti. Gerçek karşılaştırma için önce buraya bakın.'], ['bos', 'Boş ürün fiyatları', 'Baskısız ürün bedeli; üreticinin baskı ücreti ayrıca eklenir.'], ['toplu', 'Toplu sipariş fiyatları', 'Minimum adet şartı olan toplu baskı fiyatları.'], ['belirsiz', 'Koşulları üreticide belirtilen fiyatlar', 'Kaynak, fiyatın baskıyı içerip içermediğini açıkça belirtmiyor.']],
      ladderN: n => `${n} üretici`, offers: n => `${n} teklif`, lowestPrint: v => `baskı dahil en düşük ${v}`, lowestBlank: v => `boş ürün en düşük ${v}`,
      sameBlankNote: 'Aynı model kodu, farklı üreticilerde baskı yöntemi (DTG, DTF, nakış), baskı alanı, kargo ve vergi koşullarıyla farklı fiyatlanabilir. Ayrıntılar için ürün sayfasına bakın.',
      allOffers: 'Tüm teklifler', top30: 'Bu kategorideki en uygun 30 ürün', blanksInCat: 'Bu kategorideki modeller', lowest: v => `en düşük ${v}`,
      catTitle: (l, n) => `${l} fiyatları: ${n} POD üreticisi karşılaştırması`, catDesc: (l, n, v, m) => `${l} için ${n} print-on-demand ürünü ucuzdan pahalıya. En düşük fiyat ${v} (${m}).`,
      groupTitle: l => `${l} POD ürün fiyatları`, groupDesc: (l, n, m, v) => `${l} kategorisinde ${n} print-on-demand ürünü, ${m} üretici. En düşük fiyat ${v}.`,
      modelTitle: (t, n) => `${t} fiyatları: ${n} üretici karşılaştırması`,
      modelDesc: (b, d, bl, n) => `${b} baskı dahil en ucuz ${d}${bl ? `, boş ürün ${bl}` : ''}. ${n} print-on-demand üreticisinin fiyatları ucuzdan pahalıya.`,
      modelsTitle: 'Boş ürün model borsası: Gildan, Bella+Canvas, Comfort Colors fiyatları', modelsDesc: n => `${n} boş ürün modelinin farklı POD üreticilerindeki fiyatları: Gildan 5000, Bella+Canvas 3001, Comfort Colors 1717 ve diğerleri.`,
      modelsIntro: 'Aynı boş ürün modelini satan üreticiler. Baskı dahil fiyatlar ile boş ürün fiyatları ayrı sütunlarda; fark sütunu baskı dahil tekliflerde en ucuzun en pahalıya göre tasarrufunu gösterir.',
      catsTitle: 'Tüm POD ürün kategorileri', catsDesc: 'Print-on-demand ürün kategorileri ve her kategorideki en düşük üretici fiyatı.',
      makersTitle: 'Print-on-demand üreticileri listesi', makersDesc: n => `${n} print-on-demand üreticisi: ürün sayıları, kategoriler ve en düşük fiyatlar.`,
      makersIntro: (c, r) => `${c} üreticinin fiyatları karşılaştırmada. ${r} üreticinin fiyatları üye girişi gerektirdiği ya da henüz eklenmediği için listede yalnızca bağlantı olarak yer alıyor.`,
      mk: ['Üretici', 'Ürün', 'En düşük', 'Durum'], compared: 'Fiyatlar karşılaştırmada', visit: 'siteye git ↗',
      makerTitle: n => `${n} ürün fiyatları ve katalog`, makerDesc: (n, c, v) => c ? `${n} print-on-demand kataloğunda ${c} ürün; en düşük fiyat ${v}. Diğer üreticilerle karşılaştırın.` : `${n} print-on-demand üreticisi. Fiyat bilgisi henüz karşılaştırmaya eklenmedi.`,
      makerStats: (n, t, v) => `${n} ürün · ${t} ürün tipi · en düşük ${v}`, top40: 'En uygun 40 ürün', noPrices: r => `Bu üreticinin fiyatları karşılaştırmada yok: ${r.charAt(0).toLocaleLowerCase('tr') + r.slice(1)}. Ürünler ve fiyatlar için üreticinin sitesini ziyaret edin.`,
      searchTitle: 'Ara', searchDesc: 'Print-on-demand ürünlerini ara ve üretici fiyatlarını karşılaştır.', searching: 'Aranıyor…',
      aboutTitle: 'Hakkında ve yöntem', aboutDesc: `${BRAND} fiyatları nasıl toplar ve karşılaştırır.`,
      about: (c, n, d, badges) => `<p>${BRAND}, Etsy ve diğer pazaryerlerinde satış yapanların print-on-demand üretim maliyetlerini karşılaştırmasına yardım eden bağımsız bir fiyat karşılaştırma sitesidir. Satış yapmaz, sipariş almaz.</p>
<h2>Fiyatlar nereden geliyor?</h2><p>Fiyatlar üreticilerin herkese açık katalog sayfalarından, mağaza beslemelerinden ve açık API'lerinden otomatik olarak alınır ve düzenli aralıklarla yenilenir. Üye girişi gerektiren fiyatlar eklenmez; tahmini veya uydurma fiyat kullanılmaz.</p>
<h2>Fiyat neyi kapsıyor?</h2><p>Gösterilen fiyat, üreticinin kaynakta gösterdiği başlangıç fiyatı veya seçili standart varyantın fiyatıdır. Baskı ücreti, kargo, vergi ve minimum adet koşulları üreticiye göre değişir ve her ürünün sayfasında belirtilir. Kesin tutarı üreticinin sayfasında doğrulayın.</p>
<h2>Fiyat türleri</h2><ul>${badges}</ul><p>Adil karşılaştırma için model sayfalarında baskı dahil fiyatlar ve boş ürün fiyatları ayrı sıralanır.</p>
<h2>Para birimleri</h2><p>USD dışındaki fiyatlar günlük referans kuruyla (Frankfurter) yaklaşık USD'ye çevrilerek sıralanır; kaynak fiyatı da ayrıca gösterilir.</p>
<p>Kapsam: ${c} üreticiden ${n} ürün. Son güncelleme: ${d}.</p><p>Ürün sayfaları İngilizcedir.</p>`,
      privacyTitle: 'Gizlilik ve çerez politikası', contactTitle: 'İletişim', contactPending: '<em>(iletişim adresi yayından önce eklenecek)</em>',
      privacy: c => `<p>${BRAND} üyelik, sipariş veya ödeme almaz; ziyaretçilerden ad, adres ya da ödeme bilgisi toplamaz.</p>
<h2>Çerezler ve reklamlar</h2><p>Sitede Google AdSense gibi üçüncü taraf reklam hizmetleri kullanılabilir. Google dahil üçüncü taraf sağlayıcılar, bu siteye ve diğer sitelere yaptığınız önceki ziyaretlere dayalı reklam sunmak için çerez kullanabilir. Kişiselleştirilmiş reklamcılığı <a href="https://adssettings.google.com" target="_blank" rel="noopener">Google Reklam Ayarları</a> üzerinden devre dışı bırakabilir, üçüncü taraf çerezleri hakkında <a href="https://www.aboutads.info" target="_blank" rel="noopener">aboutads.info</a> adresinden bilgi alabilirsiniz. Avrupa Ekonomik Alanı ve Birleşik Krallık'taki ziyaretçilerden reklam çerezleri için onay istenir.</p>
<h2>Bağlantılar ve ortaklık programları</h2><p>Üreticilere verilen bazı bağlantılar ortaklık (affiliate) bağlantısı olabilir; bu bağlantılar üzerinden yapılan kayıtlardan ${BRAND} komisyon alabilir. Bu, gösterilen fiyatları ve sıralamayı etkilemez: sıralama yalnızca fiyata göredir. Sponsorlu alanlar "Sponsorlu" etiketiyle belirtilir.</p>
<h2>Sunucu kayıtları</h2><p>Barındırma sağlayıcımız, güvenlik ve performans amacıyla IP adresi ve tarayıcı bilgisi gibi standart erişim kayıtlarını sınırlı süre tutabilir.</p>
<h2>İletişim</h2><p>${c}</p>`,
      contact: c => `<p>Listede olmayan bir üreticiyi önermek, hatalı bir fiyatı bildirmek veya sponsorluk ve iş birliği için bize yazın: ${c}</p><p>Üreticiyseniz: ürünlerinizin doğru fiyatla listelenmesi için herkese açık bir katalog, ürün beslemesi veya API bağlantısı paylaşabilirsiniz.</p>`,
      contactDesc: `${BRAND} ile iletişim: üretici eklemek, fiyat düzeltmek veya iş birliği için.`,
      footer: `${BRAND}, print-on-demand üreticilerinin herkese açık kataloglarındaki fiyatları karşılaştırır. Satış yapmaz; ürüne tıklayınca üreticinin kendi sayfasına gidersiniz.`,
      footer2: d => `Fiyatlar üreticinin kaynakta gösterdiği başlangıç veya seçili varyant bedelidir; baskı, kargo, vergi ve minimum adet koşulları üreticiye göre değişir. Farklı para birimleri günlük referans kuruyla yaklaşık USD'ye çevrilerek sıralanır. Son güncelleme: ${d}.`,
      foot: ['Hakkında ve yöntem', 'Üreticiler', 'Gizlilik ve çerezler', 'İletişim'],
      ad: 'Reklam', adPreview: s => `Reklam alanı · ${s}`, adSize: { ust: 'Yatay afiş · 728×90 / mobil 320×100', liste: 'Liste arası · duyarlı', urun: 'Kare · 300×250', alt: 'Yatay afiş · 728×90' },
      sponsored: 'Sponsorlu', sponsorPreview: 'Sponsorlu üretici alanı · üreticilerle doğrudan anlaşmalar için', review: 'İncele ↗',
      homeTitle: `${BRAND} · Print-on-demand fiyatlarını karşılaştır`, homeDesc: (m, n) => `${m} print-on-demand üreticisinin ${n} ürününü ucuzdan pahalıya karşılaştırın: tişört, hoodie, kupa, poster, telefon kılıfı ve daha fazlası.`,
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
  const modelTitle = m => `${m.brandName} ${m.model} ${L.type(m.type)}`;
  const pbBadge = pb => `<span class="pb pb-${pb}" title="${esc(L.pbNote[pb])}">${esc(L.pbLabel[pb])}</span>`;
  const priceHtml = (p, { badge = true } = {}) => {
    const src = p.sourceCurrency && p.sourceCurrency !== 'USD' && Number.isInteger(p.sourceMinor) ? `<small>${esc(fmt(p.sourceMinor, p.sourceCurrency))}</small>` : '';
    const old = Number.isInteger(p.originalMinor) && p.originalMinor > p.baseMinor && (!p.sourceCurrency || p.sourceCurrency === 'USD') ? `<s>${esc(fmt(p.originalMinor))}</s>` : '';
    return `${old}<b>${esc(fmt(p.baseMinor))}</b>${src}${badge ? pbBadge(p.pb) : ''}`;
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
  const img = (p, cls = '') => p.imageUrl ? `<img class="${cls}" src="${esc(p.imageUrl)}" alt="${esc(p.title)}" loading="lazy" referrerpolicy="no-referrer">` : `<span class="noimg ${cls}"></span>`;
  const rowsTable = (list, { showType = false } = {}) => `<div class="tbl"><table><thead><tr><th></th><th>${t.product}</th><th>${t.maker}</th>${showType ? `<th>${t.type}</th>` : ''}<th class="num">${t.price}</th><th class="lk"></th></tr></thead><tbody>${list.map(p => `<tr>
<td class="th">${img(p)}</td><td><a href="${href(P.product(p.id))}">${esc(p.title)}</a><div class="muted sm">${esc(L.sizes(p.sizes || ''))}</div></td>
<td><a href="${href(P.maker(p.providerId))}">${esc(provName(p.providerId))}</a></td>${showType ? `<td class="sm"><a href="${href(P.cat(p.type))}">${esc(L.type(p.type))}</a></td>` : ''}
<td class="num price">${priceHtml(p)}</td><td class="lk"><a class="go" href="${esc(outbound(p))}" target="_blank" rel="nofollow sponsored noopener">${t.go}</a></td></tr>`).join('')}</tbody></table></div>`;
  const modelTable = (list, { showType = false } = {}) => `<div class="tbl"><table><thead><tr><th>${t.mt[0]}</th>${showType ? `<th>${t.mt[1]}</th>` : ''}${t.mt.slice(2).map(h => `<th class="num">${h}</th>`).join('')}</tr></thead><tbody>
${list.map(m => { const pr = modelPrices(m), d = pr.dahil, b = pr.bos; const lo = d[0]?.baseMinor, hi = d[d.length - 1]?.baseMinor;
    return `<tr><td><a href="${href(P.model(m.key))}">${esc(showType ? m.brandName + ' ' + m.model : modelTitle(m))}</a></td>${showType ? `<td class="sm">${esc(L.type(m.type))}</td>` : ''}<td class="num">${m.providers.size}</td><td class="num price">${lo ? `<b>${fmt(lo)}</b>` : '–'}</td><td class="num">${hi ? fmt(hi) : '–'}</td><td class="num">${lo && hi > lo ? Math.round((1 - lo / hi) * 100) + '%' : '–'}</td><td class="num">${b[0] ? fmt(b[0].baseMinor) : '–'}</td></tr>`; }).join('')}
</tbody></table></div>`;
  const ladder = list => t.ladder.map(([pb, title, note]) => {
    const best = [...groupBy(list.filter(p => p.pb === pb), p => p.providerId)].map(([, l]) => l[0]).sort((a, b) => a.baseMinor - b.baseMinor);
    if (!best.length) return '';
    return `<h2>${esc(title)} <span class="muted sm">· ${t.ladderN(best.length)}</span></h2><p class="muted sm">${esc(note)}</p><ol class="ladder">${best.map((p, i) => `<li><span class="rank">${i + 1}</span><a href="${href(P.maker(p.providerId))}">${esc(provName(p.providerId))}</a><span class="price">${priceHtml(p, { badge: false })}</span><a class="go" href="${esc(outbound(p))}" target="_blank" rel="nofollow sponsored noopener">${t.go}</a></li>`).join('')}</ol>`;
  }).join('');
  return { t, P, fmt, numFmt, dateFmt, lastText, modelTitle, pbBadge, priceHtml, ad, sponsor, img, rowsTable, modelTable, ladder };
}

// ---------- sayfa şablonu
const sitemap = [];
// alt: { en: rel, tr: rel } — hreflang ve dil geçişi için
function page(L, H, { rel, title, description, body, jsonld, crumbs, alt, noindex }) {
  const t = H.t;
  const canonical = SITE ? `<link rel="canonical" href="${esc(abs(rel))}">` : '';
  const alts = alt ? Object.entries(alt).map(([lg, r]) => `<link rel="alternate" hreflang="${lg}" href="${esc(SITE + href(r))}">`).join('') + (alt.en ? `<link rel="alternate" hreflang="x-default" href="${esc(SITE + href(alt.en))}">` : '') : '';
  const ads = cfg.adsenseClient ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(cfg.adsenseClient)}" crossorigin="anonymous"></script>` : '';
  const bc = crumbs ? `<nav class="crumbs" aria-label="Breadcrumb"><a href="${href(H.P.home)}">${t.home}</a>${crumbs.map(([c, h]) => h ? ` › <a href="${esc(h)}">${esc(c)}</a>` : ` › <span>${esc(c)}</span>`).join('')}</nav>` : '';
  const other = L.lang === 'en' ? 'tr' : 'en';
  const switchTo = alt?.[other] ?? LOCALES[other].path.home;
  const [b1, ...bRest] = BRAND.split(' ');
  return `<!doctype html><html lang="${L.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}">${canonical}${alts}${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="website"><meta property="og:site_name" content="${esc(BRAND)}">
<link rel="stylesheet" href="/assets/site.css"><link rel="icon" href="/assets/icon.svg" type="image/svg+xml">${ads}
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}</head><body data-lang="${L.lang}">
<header class="top"><div class="wrap"><a class="brand" href="${href(H.P.home)}">${esc(b1)}<span>${esc(bRest.join(' '))}</span></a>
<form class="search" action="${href(H.P.search)}" role="search"><input name="q" type="search" placeholder="${esc(t.searchPh)}" aria-label="${esc(t.searchBtn)}" autocomplete="off"><button>${t.searchBtn}</button></form>
<nav class="topnav"><a href="${href(H.P.categories)}">${t.categories}</a><a href="${href(H.P.models)}">${t.models}</a><a href="${href(H.P.makers)}">${t.makers}</a><a class="lang" href="${href(switchTo)}" hreflang="${other}" lang="${other}">${other.toUpperCase()}</a></nav></div></header>
<main class="wrap">${bc}${H.ad('ust')}${body}${H.ad('alt')}</main>
<footer class="foot"><div class="wrap"><p>${esc(t.footer)}</p>
<p class="muted">${esc(t.footer2(H.lastText))}</p>
<p class="muted"><a href="${href(H.P.about)}">${t.foot[0]}</a> · <a href="${href(H.P.makers)}">${t.foot[1]}</a> · <a href="${href(H.P.privacy)}">${t.foot[2]}</a> · <a href="${href(H.P.contact)}">${t.foot[3]}</a></p></div></footer>
<script src="/assets/site.js" defer></script></body></html>`;
}

// ---------- üret
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync(path.join(root, 'web'), path.join(out, 'assets'), { recursive: true });
const add = (rel, html) => { write(rel, html); sitemap.push(rel); };

// istemci tarafı ortak veri: [id, başlık, üreticiId, fiyat, kaynakFiyat, görsel, ölçü, tip, satışLinki, fiyatTürü]
const srcPrice = p => p.sourceCurrency && p.sourceCurrency !== 'USD' && Number.isInteger(p.sourceMinor) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: p.sourceCurrency }).format(p.sourceMinor / 100) : '';
const row = p => [p.id, p.title, p.providerId, p.baseMinor, srcPrice(p), p.imageUrl || '', p.sizes || '', p.type, outbound(p), p.pb];
for (const [t, list] of byType) write(`data/k/${t}.json`, JSON.stringify(list.map(row)));
write('data/search.json', JSON.stringify(products.map(p => [p.id, p.title, p.providerId, p.baseMinor, p.imageUrl || '', p.type, p.model ? p.model.brandName + ' ' + p.model.model : '', p.pb])));

for (const lg of LANGS) {
  const L = LOCALES[lg], H = makeHelpers(L), t = H.t, P = H.P;
  const fmt = H.fmt, n = x => H.numFmt.format(x);
  const altAll = f => Object.fromEntries(LANGS.map(k => [k, f(LOCALES[k].path)]));
  const stat = list => ({ n: list.length, min: list[0].baseMinor, prov: new Set(list.map(p => p.providerId)).size });

  write(`data/meta-${lg}.json`, JSON.stringify({
    lang: lg, providers: Object.fromEntries(catalog.providers.map(p => [p.id, p.name])),
    types: Object.fromEntries([...byType.keys()].map(k => [k, L.type(k)])), pb: L.pbLabel, pbNote: L.pbNote,
    paths: { product: '/' + P.product('ID').replace('ID/', ''), maker: '/' + P.maker('ID').replace('ID/', '') },
    ui: lg === 'en'
      ? { listSearch: 'Search this list', sortAsc: 'Price: low to high', sortDesc: 'Price: high to low', allTypes: 'All price types', more: 'Show more', left: 'left', none: 'No results.', products: 'products', details: 'Details', results: 'Results for', searchTitle: 'Search', typeQuery: 'Type a product, blank or manufacturer.', noHits: 'No results. Try a broader word or browse the categories.', failed: 'Search could not load.', allMakersLabel: 'All manufacturers', th: ['Product', 'Manufacturer', 'Price'], go: 'Go to store ↗' }
      : { listSearch: 'Bu listede ara', sortAsc: 'Fiyat: ucuzdan pahalıya', sortDesc: 'Fiyat: pahalıdan ucuza', allTypes: 'Tüm fiyat türleri', more: 'Daha fazla göster', left: 'kaldı', none: 'Sonuç bulunamadı.', products: 'ürün', details: 'Detay', results: 'Sonuçlar:', searchTitle: 'Arama', typeQuery: 'Ürün, model veya üretici adı yazın.', noHits: 'Sonuç bulunamadı. Daha genel bir kelime deneyin ya da kategorilere göz atın.', failed: 'Arama yüklenemedi.', allMakersLabel: 'Tüm üreticiler', th: ['Ürün', 'Üretici', 'Fiyat'], go: 'Satış sayfası ↗' },
  }));

  // ana sayfa
  add(P.home + 'index.html', page(L, H, {
    rel: P.home + 'index.html', alt: altAll(p => p.home), title: t.homeTitle, description: t.homeDesc(connected.length, n(products.length)),
    body: `<section class="hero"><h1>${esc(t.heroH)}</h1><p>${t.heroP(connected.length, n(products.length))}</p>
<form class="search big" action="${href(P.search)}" role="search"><input name="q" type="search" placeholder="${esc(t.searchBig)}" aria-label="${esc(t.searchBtn)}" autocomplete="off"><button>${t.searchBtn}</button></form>
<ul class="stats">${[connected.length, n(products.length), models.length, null].map((v, i) => `<li><b>${v ?? t.stats[i][0]}</b><span>${v == null ? t.stats[i][1] : t.stats[i][0]}</span></li>`).join('')}</ul></section>
<ol class="how">${t.how.map(([h, s]) => `<li><b>${esc(h)}</b><span>${esc(s)}</span></li>`).join('')}</ol>
<h2>${esc(t.modelsH)}</h2><p class="muted">${esc(t.modelsP)}</p>
${H.modelTable(models.slice(0, 15))}<p><a href="${href(P.models)}">${t.allModels(models.length)}</a></p>
<h2>${t.catsH}</h2><div class="groups">${groupsOrdered.map(g => `<section class="group"><h3><a href="${href(P.cat(g))}">${esc(L.group(g))}</a></h3><ul>${typesOf(g).slice(0, 8).map(k => { const s = stat(byType.get(k)); return `<li><a href="${href(P.cat(k))}">${esc(L.type(k))}</a> <span class="muted sm">${t.products(s.n)} · ${t.from(fmt(s.min))}</span></li>`; }).join('')}</ul></section>`).join('')}</div>`,
    jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', name: BRAND, url: SITE || undefined, inLanguage: lg, potentialAction: { '@type': 'SearchAction', target: SITE + href(P.search) + '?q={q}', 'query-input': 'required name=q' } },
  }));

  // kategoriler dizini
  add(P.categories + 'index.html', page(L, H, {
    rel: P.categories + 'index.html', alt: altAll(p => p.categories), title: `${t.catsTitle} · ${BRAND}`, description: t.catsDesc, crumbs: [[t.categories]],
    body: `<h1>${t.categories}</h1><div class="groups">${groupsOrdered.map(g => `<section class="group"><h3><a href="${href(P.cat(g))}">${esc(L.group(g))}</a> <span class="muted sm">${t.products(byGroup.get(g).length)}</span></h3><ul>${typesOf(g).map(k => { const s = stat(byType.get(k)); return `<li><a href="${href(P.cat(k))}">${esc(L.type(k))}</a> <span class="muted sm">${t.products(s.n)} · ${t.makersN(s.prov)} · ${t.from(fmt(s.min))}</span></li>`; }).join('')}</ul></section>`).join('')}</div>`,
  }));

  // grup sayfaları
  for (const g of groupsOrdered) {
    if (g === 'diger') continue; // "Diğer" grubu tek tip; tip sayfası yeterli
    const list = byGroup.get(g), label = L.group(g);
    add(P.cat(g) + 'index.html', page(L, H, {
      rel: P.cat(g) + 'index.html', alt: altAll(p => p.cat(g)), title: `${t.groupTitle(label)} · ${BRAND}`, description: t.groupDesc(label, list.length, new Set(list.map(p => p.providerId)).size, fmt(list[0].baseMinor)),
      crumbs: [[t.categories, href(P.categories)], [label]],
      body: `<h1>${esc(label)}</h1><div class="chips">${typesOf(g).map(k => { const s = stat(byType.get(k)); return `<a class="chip" href="${href(P.cat(k))}"><b>${esc(L.type(k))}</b><span>${t.products(s.n)} · ${t.from(fmt(s.min))}</span></a>`; }).join('')}</div>
<h2>${t.top30}</h2>${H.rowsTable(list.slice(0, 30), { showType: true })}${H.ad('liste')}`,
    }));
  }

  // tip sayfaları
  for (const [k, list] of byType) {
    const label = L.type(k), g = typeGroup(k), provN = new Set(list.map(p => p.providerId)).size;
    const tModels = models.filter(m => m.type === k).slice(0, 12);
    add(P.cat(k) + 'index.html', page(L, H, {
      rel: P.cat(k) + 'index.html', alt: altAll(p => p.cat(k)), title: `${t.catTitle(label, provN)} · ${BRAND}`, description: t.catDesc(label, list.length, fmt(list[0].baseMinor), provName(list[0].providerId)),
      crumbs: [[t.categories, href(P.categories)], [L.group(g), g === 'diger' ? null : href(P.cat(g))], [label]],
      body: `<h1>${esc(label)}</h1><p class="muted">${t.products(list.length)} · ${t.makersN(provN)} · ${t.lowest(fmt(list[0].baseMinor))}</p>
${tModels.length ? `<h2>${t.blanksInCat}</h2><div class="chips">${tModels.map(m => `<a class="chip" href="${href(P.model(m.key))}"><b>${esc(m.brandName + ' ' + m.model)}</b><span>${t.makersN(m.providers.size)} · ${t.from(fmt(m.list[0].baseMinor))}</span></a>`).join('')}</div>` : ''}
${H.sponsor(k)}<div class="list" data-src="/data/k/${k}.json">${H.rowsTable(list.slice(0, 50))}</div>${H.ad('liste')}`,
      jsonld: { '@context': 'https://schema.org', '@type': 'ItemList', name: label, numberOfItems: list.length, itemListElement: list.slice(0, 10).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + href(LOCALES.en.path.product(p.id)), name: p.title })) },
    }));
  }

  // model borsası
  add(P.models + 'index.html', page(L, H, {
    rel: P.models + 'index.html', alt: altAll(p => p.models), title: `${t.modelsTitle} · ${BRAND}`, description: t.modelsDesc(models.length), crumbs: [[t.models]],
    body: `<h1>${t.models}</h1><p class="muted">${esc(t.modelsIntro)}</p>${H.modelTable(models, { showType: true })}`,
  }));
  for (const m of models) {
    const pr = modelPrices(m), lo = pr.dahil[0] || m.list[0], title = H.modelTitle(m);
    add(P.model(m.key) + 'index.html', page(L, H, {
      rel: P.model(m.key) + 'index.html', alt: altAll(p => p.model(m.key)),
      title: `${t.modelTitle(title, m.providers.size)} · ${BRAND}`,
      description: t.modelDesc(`${m.brandName} ${m.model}`, pr.dahil[0] ? `${fmt(pr.dahil[0].baseMinor)} (${provName(pr.dahil[0].providerId)})` : '—', pr.bos[0] ? fmt(pr.bos[0].baseMinor) : '', m.providers.size),
      crumbs: [[t.models, href(P.models)], [m.brandName + ' ' + m.model]],
      body: `<h1>${esc(title)}</h1><p class="muted">${t.makersN(m.providers.size)} · ${t.offers(m.list.length)}${pr.dahil[0] ? ' · ' + t.lowestPrint(fmt(pr.dahil[0].baseMinor)) : ''}${pr.bos[0] ? ' · ' + t.lowestBlank(fmt(pr.bos[0].baseMinor)) : ''}</p>
${H.sponsor(m.type)}${H.ladder(m.list)}<p class="muted sm">${esc(t.sameBlankNote)}</p>
${H.ad('liste')}<h2>${t.allOffers}</h2>${H.rowsTable(m.list)}`,
      jsonld: { '@context': 'https://schema.org', '@type': 'Product', name: title, brand: { '@type': 'Brand', name: m.brandName }, image: lo.imageUrl || undefined, offers: { '@type': 'AggregateOffer', priceCurrency: 'USD', lowPrice: (lo.baseMinor / 100).toFixed(2), highPrice: (m.list[m.list.length - 1].baseMinor / 100).toFixed(2), offerCount: m.list.length } },
    }));
  }

  // üreticiler
  const provRows = catalog.providers.map(p => ({ p, list: byProvider.get(p.id) || [] })).sort((a, b) => b.list.length - a.list.length || a.p.name.localeCompare(b.p.name));
  add(P.makers + 'index.html', page(L, H, {
    rel: P.makers + 'index.html', alt: altAll(p => p.makers), title: `${t.makersTitle} · ${BRAND}`, description: t.makersDesc(catalog.providers.length), crumbs: [[t.makers]],
    body: `<h1>${t.makers}</h1><p class="muted">${esc(t.makersIntro(connected.length, catalog.providers.length - connected.length))}</p>
<div class="tbl"><table><thead><tr><th>${t.mk[0]}</th><th class="num">${t.mk[1]}</th><th class="num">${t.mk[2]}</th><th>${t.mk[3]}</th></tr></thead><tbody>
${provRows.map(({ p, list }) => `<tr><td><a href="${href(P.maker(p.id))}">${esc(p.name)}</a></td><td class="num">${list.length || '–'}</td><td class="num">${list.length ? fmt(list[0].baseMinor) : '–'}</td><td class="sm">${list.length ? t.compared : esc(reasonOf(p, L)) + ` · <a href="${esc(p.homepage)}" target="_blank" rel="nofollow noopener">${t.visit}</a>`}</td></tr>`).join('')}
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
<h2>${t.top40}</h2>${H.rowsTable(list.slice(0, 40), { showType: true })}` : `<p class="muted">${esc(t.noPrices(reasonOf(p, L)))}</p>`}`,
    }));
  }

  // arama, hakkında, gizlilik, iletişim
  add(P.search + 'index.html', page(L, H, {
    rel: P.search + 'index.html', alt: altAll(p => p.search), title: `${t.searchTitle} · ${BRAND}`, description: t.searchDesc, crumbs: [[t.search]], noindex: true,
    body: `<h1 id="sq">${t.search}</h1><div id="search-app" class="list"><p class="muted">${t.searching}</p></div>`,
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

  // ürün sayfaları (yalnızca İngilizce)
  if (lg === 'en') {
    const features = p => {
      const f = [], F = t.f, push = (k, v) => { if (v != null && v !== '' && v !== false) f.push([k, v]); };
      push(F.type, `<a href="${href(P.cat(p.type))}">${esc(L.type(p.type))}</a>`);
      push(F.maker, `<a href="${href(P.maker(p.providerId))}">${esc(provName(p.providerId))}</a>`);
      if (p.model) push(F.blank, modelByKey.has(p.model.key) ? `<a href="${href(P.model(p.model.key))}">${esc(p.model.brandName + ' ' + p.model.model)}</a>` : esc(p.model.brandName + ' ' + p.model.model));
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
    const rankIn = new Map();
    for (const [, list] of byType) list.forEach((p, i) => rankIn.set(p.id, i + 1));
    for (const p of products) {
      const prov = provName(p.providerId), label = L.type(p.type), g = typeGroup(p.type), total = byType.get(p.type).length, rank = rankIn.get(p.id);
      let similar = p.model && modelByKey.has(p.model.key) ? modelByKey.get(p.model.key).list.filter(x => x.id !== p.id) : [];
      const simTitle = similar.length ? t.sameModel(`${p.model.brandName} ${p.model.model}`) : t.otherMakers(label);
      if (!similar.length) { const seen = new Set([p.providerId]); similar = byType.get(p.type).filter(x => !seen.has(x.providerId) && seen.add(x.providerId)); }
      const rel = P.product(p.id) + 'index.html';
      write(rel, page(L, H, {
        rel, title: `${t.productTitle(p.title, prov, fmt(p.baseMinor))} · ${BRAND}`, description: t.productDesc(prov, p.title, fmt(p.baseMinor), label, total, rank),
        crumbs: [[t.categories, href(P.categories)], [L.group(g), g === 'diger' ? null : href(P.cat(g))], [label, href(P.cat(p.type))], [p.title]],
        body: `<article class="product"><div class="pimg">${H.img(p, 'big')}</div><div class="pinfo">
<p class="muted"><a href="${href(P.maker(p.providerId))}">${esc(prov)}</a></p><h1>${esc(p.title)}</h1>
<p class="bigprice">${H.priceHtml(p)}</p><p class="muted sm">${esc(t.rankNote(label, total, rank))}</p>
<a class="cta" href="${esc(outbound(p))}" target="_blank" rel="nofollow sponsored noopener">${esc(t.cta(prov))}</a>
<dl class="feat">${features(p).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>${H.ad('urun')}</div></article>
${similar.length ? `<h2>${esc(simTitle)}</h2>${H.rowsTable(similar.slice(0, 12))}` : ''}`,
        jsonld: { '@context': 'https://schema.org', '@type': 'Product', name: p.title, image: p.imageUrl || undefined, brand: p.model ? { '@type': 'Brand', name: p.model.brandName } : undefined, offers: { '@type': 'Offer', price: (p.baseMinor / 100).toFixed(2), priceCurrency: 'USD', url: p.sourceUrl, seller: { '@type': 'Organization', name: prov } } },
      }));
      sitemap.push(rel);
    }
    write('404.html', page(L, H, { rel: '404.html', title: `${t.notFound} · ${BRAND}`, description: t.notFound, noindex: true, body: `<h1>${t.notFound}</h1><p>${t.notFoundP}</p>` }));
  }
}

// barındırma: önbellek başlıkları (Netlify _headers), eski Türkçe adreslerden yönlendirme ve AdSense ads.txt
write('_headers', `/assets/*\n  Cache-Control: public, max-age=86400\n/data/*\n  Cache-Control: public, max-age=1800\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`);
write('_redirects', `/urun/*  /product/:splat  301\n/kategori/*  /tr/kategori/:splat  301\n/borsa/  /tr/borsa/  301\n/ureticiler/  /tr/ureticiler/  301\n/uretici/*  /tr/uretici/:splat  301\n`);
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

console.log(`Site üretildi: ${products.length} ürün, ${byType.size} kategori, ${models.length} model, ${catalog.providers.length} üretici, ${sitemap.length} sayfa (EN+TR)${SITE ? '' : ' · siteUrl boş: sitemap üretilmedi'}`);
