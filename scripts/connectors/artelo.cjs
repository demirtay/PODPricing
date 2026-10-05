// Artelo: /pricing sayfasındaki fiyat hesaplayıcısı tamamen tarayıcıda çalışır (sunucuya fiyat sorgusu yok).
// Sayfanın kendi JS paketleri yalıtılmış bir Node VM içinde çalıştırılır ve sitenin kullandığı
// getProductionCost() fonksiyonu yaygın ölçüler için çağrılır. Modül numaraları her sürümde değiştiği için
// dışa aktarılan adlardan (getProductionCost, makeSizeOptions) bulunur.
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
  // dışa aktarma listesi: t.s(["ad",0,değer,...],MODÜL_NO) — değer satır içi fonksiyon olabilir, ilk "],NO)" kapanışı aranır
  const idOf = name => {
    const i = all.indexOf(`"${name}",0,`);
    const m = i < 0 ? null : all.slice(i).match(/\],(\d{3,7})\)/);
    if (!m) throw Error('Artelo: modül bulunamadı: ' + name);
    return +m[1];
  };
  const ids = { price: idOf('getProductionCost'), options: idOf('makeSizeOptions') };
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
  vm.runInContext(`TURBOPACK.push([__S,9999991,t=>{globalThis.__P=t.i(${ids.price});globalThis.__O=t.i(${ids.options})}]);TURBOPACK.push([__S,{otherChunks:[],runtimeModuleIds:[9999991]}]);`, ctx);
  ctx.document.currentScript = script(runtime.name);
  vm.runInContext(runtime.code, ctx, { filename: runtime.name, timeout: 20000 });
  // çalışma zamanı modülleri eşzamansız başlatır; en çok 5 sn beklenir
  for (let i = 0; i < 50 && !ctx.__P; i++) await new Promise(r => setTimeout(r, 100));
  if (!ctx.__P?.getProductionCost || !ctx.__O?.makeSizeOptions) throw Error('Artelo: fiyat modülü yüklenemedi (' + JSON.stringify(ids) + ')');
  return { P: ctx.__P, O: ctx.__O };
}

async function collect() {
  const checkedAt = new Date().toISOString();
  const html = (await fetchText(PAGE)).text;
  const srcs = [...new Set([...html.matchAll(/<script[^>]*src="(\/_next\/[^"]+\.js)"/g)].map(m => m[1]))];
  if (!srcs.some(s => /turbopack-/.test(s))) throw Error('Artelo: sayfa yapısı değişmiş (turbopack çalışma zamanı yok)');
  const chunks = [];
  for (const s of srcs) chunks.push({ name: s, code: (await cachedGet('artelo', SITE + s)).text });
  const { P, O } = await loadModules(chunks);
  const cost = (paperType, size, frameStyle = 'Unframed', frameColor = 'Unframed') =>
    P.getProductionCost({ catalogProductId: 'IndividualArtPrint', size, paperType, frameStyle, frameColor, includeMats: false, canvasDesignedFor: null });
  // sayfada sunucuda basılmış varsayılan tutar ile hesaplanan tutar aynı olmalı
  const shown = html.match(/Production Cost Per-Unit[\s\S]{0,4000}?<span>\$([\d.]+)<\/span>/)?.[1];
  const calc = cost('MattePoster', 'x6x6', 'Oak', 'BlackOak');
  if (shown && Math.abs(+shown - calc) > 0.005) throw Error(`Artelo: doğrulama tutmadı (sayfa $${shown}, hesap $${calc})`);
  const sizesFor = (frameStyle, paperType) => O.makeSizeOptions('IndividualArtPrint', frameStyle, paperType).flatMap(g => g.options);
  const products = [];
  const push = (id, title, size, price, material, framed) => products.push({
    id: 'artelo-' + id, providerId: 'artelo', sourceProductId: id, family: 'artelo-wall-art', category: 'wall-art',
    title: `${title} ${sizeKey(size)}in`, aliases: ['art print'], baseMinor: Math.round(price * 100), currency: 'USD', imageUrl: null, sourceUrl: PAGE,
    sizes: sizeKey(size) + ' in', material,
    priceBasis: 'Artelo fiyat hesaplayıcısı · üretim maliyeti, tek baskı' + (framed ? ', standart siyah meşe çerçeve' : '') + ' · kargo ayrıca',
    shipping: null, deliveryDays: null, availableCountries: ['US'],
    checkedOn: checkedAt.slice(0, 10), checkedAt, sourceKind: 'catalog', importedBy: 'artelo-calculator-v1', priceVerified: true, priceVerification: shown ? 'public-calculator-verified' : 'public-calculator',
  });
  for (const [paper, title, material] of PRINTS) {
    for (const size of sizesFor('Unframed', paper).filter(s => COMMON.includes(sizeKey(s)))) push(`${paper}-${sizeKey(size)}`.toLowerCase(), title, size, cost(paper, size), material, false);
  }
  for (const size of sizesFor('Oak', 'MattePoster').filter(s => COMMON.includes(sizeKey(s)))) {
    push(`framed-oak-${sizeKey(size)}`.toLowerCase(), 'Framed Poster Print, Black Oak Frame', size, cost('MattePoster', size, 'Oak', 'BlackOak'), 'Matte poster paper, oak wood frame', true);
  }
  fs.writeFileSync(path.resolve(__dirname, '../../data/artelo-coverage.json'), JSON.stringify({ checkedAt, chunks: chunks.length, verification: { shown, calc }, imported: products.length }, null, 2));
  if (products.length < 50) throw Error('Artelo: beklenenden az ürün (' + products.length + ')');
  return { products, pages: 1, reportedTotal: products.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect };
