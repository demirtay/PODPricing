// Artelo: /pricing sayfasındaki fiyat hesaplayıcısı tamamen tarayıcıda çalışır (sunucuya fiyat sorgusu yok).
// Sayfanın kendi JS paketleri yalıtılmış bir Node VM içinde çalıştırılır ve sitenin kullandığı üretim maliyeti ve kargo
// fonksiyonları yaygın ölçüler için çağrılır. Ekim 2026'dan beri dışa aktarma adları kısaltıldığı için fonksiyonlar, sayfanın
// "Production / Shipping Cost Per-Unit" hesaplayan bloğundan bulunur (modül numarası + dışa aktarma harfi).
// Kargo: sitenin kendi kargo fonksiyonu, tek adet; US, GB, DE (AB), CA, AU.
// Doğrulama: sayfanın sunucuda basılmış varsayılan değeri (6x6, mat poster, standart çerçeve) hesapla karşılaştırılır.
'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { fetchText, cachedGet } = require('./http.cjs');

const SITE = 'https://www.artelo.com';
const PAGE = SITE + '/pricing';
// karşılaştırılabilir olsun diye yaygın ölçüler (inç)
const COMMON = ['4x6', '5x7', '6x6', '8x8', '8x10', '8x12', '8.5x11', '10x10', '11x14', '11x17', '12x12', '12x16', '12x18', '16x16', '16x20', '16x24',
  '18x18', '18x24', '20x20', '20x30', '24x24', '24x30', '24x32', '24x36', '30x40', '36x48'];
const PRINTS = [
  ['MattePoster', 'Matte Poster Print', 'Poster paper, matte'],
  ['LusterPhoto', 'Luster Photo Print', 'Photo paper, luster'],
  ['ArchivalMatteFineArt', 'Archival Matte Fine Art Print', 'Archival fine art paper'],
  ['SatinCanvas', 'Satin Canvas Print (rolled, unframed)', 'Canvas, satin'],
];
const sizeKey = s => s.replace(/^x/, '').replace(/dot/g, '.');

async function loadModules(chunks) {
  const all = chunks.map(c => c.code).join('\n');
  // fiyat sayfasının maliyet bloğu: let l=(0,t.f)((0,r.a)(i),"USD",e)..., p=...(0,a.g)({canvasDesignedFor:...,countryCode:n,...})
  const anchor = all.indexOf('discountedCost:"-",productionCost:"-",shippingCost:"-"');
  if (anchor < 0) throw Error('Artelo: maliyet bloğu bulunamadı');
  const head = all.lastIndexOf('e=>{var ', anchor);
  const vars = Object.fromEntries([...all.slice(head, anchor).matchAll(/(\w)=e\.i\((\d+)\)/g)].map(m => [m[1], +m[2]]));
  const body = all.slice(anchor, anchor + 1500);
  const prod = body.match(/\(0,(\w)\.(\w+)\)\(i\),"USD"/), ship = body.match(/\(0,(\w)\.(\w+)\)\(\{canvasDesignedFor/);
  if (!prod || !ship || !vars[prod[1]] || !vars[ship[1]]) throw Error('Artelo: maliyet fonksiyonları çözülemedi');
  const ids = { price: vars[prod[1]], ship: vars[ship[1]] };
  const noop = () => {};
  const el = () => ({ setAttribute: noop, appendChild: noop, addEventListener: noop, style: {}, getAttribute: () => null });
  const script = n => ({ src: SITE + n, getAttribute: k => k === 'src' ? SITE + n : null });
  const ctx = { console: { log: noop, warn: noop, error: noop, info: noop, debug: noop }, setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, URL, URLSearchParams, TextEncoder, TextDecoder, Promise,
    document: { currentScript: null, createElement: el, head: el(), body: el(), querySelector: () => null, querySelectorAll: () => [], addEventListener: noop, cookie: '', documentElement: el() },
    navigator: { userAgent: 'node' }, location: { href: PAGE, origin: SITE, protocol: 'https:', host: 'www.artelo.com', pathname: '/pricing', search: '' },
    addEventListener: noop, removeEventListener: noop, localStorage: { getItem: () => null, setItem: noop }, sessionStorage: { getItem: () => null, setItem: noop },
    matchMedia: () => ({ matches: false, addListener: noop, addEventListener: noop }), fetch: async () => { throw Error('ağ kapalı'); }, requestAnimationFrame: noop, performance: { now: () => Date.now() } };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  const runtime = chunks.find(c => /turbopack-/.test(c.name));
  for (const c of chunks) if (c !== runtime) { ctx.document.currentScript = script(c.name); vm.runInContext(c.code, ctx, { filename: c.name, timeout: 20000 }); }
  ctx.__S = script('/_next/static/immutable/chunks/zz-podpricing.js');
  vm.runInContext(`TURBOPACK.push([__S,9999991,t=>{globalThis.__P=t.i(${ids.price});globalThis.__H=t.i(${ids.ship})}]);TURBOPACK.push([__S,{otherChunks:[],runtimeModuleIds:[9999991]}]);`, ctx);
  ctx.document.currentScript = script(runtime.name);
  vm.runInContext(runtime.code, ctx, { filename: runtime.name, timeout: 20000 });
  // çalışma zamanı modülleri eşzamansız başlatır; en çok 5 sn beklenir
  for (let i = 0; i < 50 && !ctx.__P; i++) await new Promise(r => setTimeout(r, 100));
  const P = ctx.__P?.[prod[2]], S = ctx.__H?.[ship[2]];
  if (typeof P !== 'function' || typeof S !== 'function') throw Error('Artelo: fiyat modülü yüklenemedi (' + JSON.stringify(ids) + ')');
  return { P, S };
}

async function collect() {
  const checkedAt = new Date().toISOString();
  const html = (await fetchText(PAGE)).text;
  const srcs = [...new Set([...html.matchAll(/<script[^>]*src="(\/_next\/[^"]+\.js)"/g)].map(m => m[1]))];
  if (!srcs.some(s => /turbopack-/.test(s))) throw Error('Artelo: sayfa yapısı değişmiş (turbopack çalışma zamanı yok)');
  const chunks = [];
  for (const s of srcs) chunks.push({ name: s, code: (await cachedGet('artelo', SITE + s)).text });
  const { P, S } = await loadModules(chunks);
  const item = (paperType, size, frameStyle = 'Unframed', frameColor = 'Unframed') => ({ catalogProductId: 'IndividualArtPrint', size, paperType, frameStyle, frameColor, includeMats: false, canvasDesignedFor: null });
  const cost = (...a) => P(item(...a));
  const DEST = { US: 'US', GB: 'GB', EU: 'DE', CA: 'CA', AU: 'AU' };
  const shipping = (...a) => Object.fromEntries(Object.entries(DEST).map(([k, cc]) => [k, Math.round(S({ ...item(...a), countryCode: cc, quantity: 1 }) * 100)]).filter(([, v]) => Number.isFinite(v) && v > 0));
  // sayfada sunucuda basılmış varsayılan tutar ile hesaplanan tutar aynı olmalı
  const shown = html.match(/Production Cost Per-Unit[\s\S]{0,4000}?<span>\$([\d.]+)<\/span>/)?.[1];
  const calc = cost('MattePoster', 'x6x6', 'Oak', 'BlackOak');
  if (shown && Math.abs(+shown - calc) > 0.005) throw Error(`Artelo: doğrulama tutmadı (sayfa $${shown}, hesap $${calc})`);
  const shipShown = html.match(/Shipping Cost Per-Unit[\s\S]{0,4000}?<span>\$([\d.]+)<\/span>/)?.[1];
  const shipCalc = shipping('MattePoster', 'x6x6', 'Oak', 'BlackOak').US / 100;
  if (shipShown && Math.abs(+shipShown - shipCalc) > 0.01) throw Error(`Artelo: kargo doğrulaması tutmadı (sayfa $${shipShown}, hesap $${shipCalc})`);
  // ölçüler sitenin ölçü listesinden (5 Ekim 2026): kağıt/kanvas baskıda yaygın ölçülerin hepsi, çerçevelide 30x40 ve 36x48 yok
  const sizesFor = framed => COMMON.filter(s => !framed || !['30x40', '36x48'].includes(s)).map(s => 'x' + s.replace('.', 'dot'));
  const products = [];
  const push = (id, title, size, price, material, framed, ship) => products.push({
    id: 'artelo-' + id, providerId: 'artelo', sourceProductId: id, family: 'artelo-wall-art', category: 'wall-art',
    title: `${title} ${sizeKey(size)}in`, aliases: ['art print'], baseMinor: Math.round(price * 100), currency: 'USD', imageUrl: null, sourceUrl: PAGE,
    sizes: sizeKey(size) + ' in', material,
    priceBasis: 'Artelo fiyat hesaplayıcısı · üretim maliyeti, tek baskı' + (framed ? ', standart siyah meşe çerçeve' : '') + ' · kargo ayrıca',
    shipping: ship, deliveryDays: null, availableCountries: ['US'],
    checkedOn: checkedAt.slice(0, 10), checkedAt, sourceKind: 'catalog', importedBy: 'artelo-calculator-v1', priceVerified: true, priceVerification: shown ? 'public-calculator-verified' : 'public-calculator',
  });
  for (const [paper, title, material] of PRINTS) {
    for (const size of sizesFor(false)) push(`${paper}-${sizeKey(size)}`.toLowerCase(), title, size, cost(paper, size), material, false, shipping(paper, size));
  }
  for (const size of sizesFor(true)) {
    push(`framed-oak-${sizeKey(size)}`.toLowerCase(), 'Framed Poster Print, Black Oak Frame', size, cost('MattePoster', size, 'Oak', 'BlackOak'), 'Matte poster paper, oak wood frame', true, shipping('MattePoster', size, 'Oak', 'BlackOak'));
  }
  fs.writeFileSync(path.resolve(__dirname, '../../data/artelo-coverage.json'), JSON.stringify({ checkedAt, chunks: chunks.length, verification: { shown, calc, shipShown, shipCalc }, imported: products.length }, null, 2));
  if (products.length < 50) throw Error('Artelo: beklenenden az ürün (' + products.length + ')');
  return { products, pages: 1, reportedTotal: products.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect };
