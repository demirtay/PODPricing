// Merchize: merchize.com/product/<ürün>/ sayfasına gömülü varyant verisi (base_cost.tier1, shipping_prices, fulfillment_location_code)
// ürün sayfasındaki "Fulfillment Price" tablosuyla aynı veri. -> data/shipping/facilities.json (products alanına eklenir)
// Kargo bölgeleri: US, EU, ROW (İngiltere/Kanada/Avustralya için ayrı satır yoksa ROW). Boş ücret = o bölgeye gönderim yok; 0 = fiyata dahil.
// Not: 4 Eki 2026 - 17 Ocak 2027 arası ABD'ye paket başına +$0,50 bayram ek ücreti (sayfada yazıyor) eklenir.
// Kullanım: node scripts/shipping-merchize.cjs   (karşılaştırmadaki ürünler; data/compare-ids.json)
'use strict';
const fs = require('node:fs'), path = require('node:path');

const root = path.join(__dirname, '..');
const OUT = path.join(root, 'data/shipping/facilities.json');
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; POD-Atlas/1.0; fiyat karsilastirma)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HOLIDAY_US = Date.now() >= Date.parse('2026-10-04') && Date.now() < Date.parse('2027-01-18') ? 50 : 0;

function variants(html) {
  const out = [];
  // varyantta tesis kodu yoksa sayfadaki "Fulfillment location" alanı
  const pageLoc = (html.match(/id="fulfillment_location"[^>]*>\s*([A-Z]{2,3})\s*</) || [])[1];
  for (const chunk of html.split('"sku":"').slice(1)) { // her varyantta bir sku; alanların sırası sayfadan sayfaya değişiyor
    // taban maliyet: tier1 ya da baskı yöntemine göre dtf_tier1 / dtg_tier1 ...; en düşüğü
    const bc = (chunk.match(/"base_cost":\{([^}]*)\}/) || [])[1] || '', tiers = [...bc.matchAll(/"(?:[a-z]+_)?tier1":([\d.]+)/g)].map(m => parseFloat(m[1]));
    const base = tiers.length ? [, Math.min(...tiers)] : null, loc = chunk.match(/"fulfillment_location_code":"([A-Z]+)"/) || (pageLoc && [, pageLoc]);
    const sp = chunk.match(/"shipping_prices":(\[[^\]]*\])/);
    if (!base || !loc || !sp) continue;
    let ship; try { ship = JSON.parse(sp[1]); } catch { continue; }
    out.push({ base: Math.round(parseFloat(base[1]) * 100), loc: loc[1], ship });
  }
  return out;
}

(async () => {
  const ids = new Set(JSON.parse(fs.readFileSync(path.join(root, 'data/compare-ids.json'), 'utf8')));
  const cat = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8')).products.filter(p => p.providerId === 'merchize' && ids.has(p.id));
  const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { products: {} };
  out.merchize = { source: 'merchize.com ürün sayfası (Fulfillment Price tablosu verisi)', checked: new Date().toISOString().slice(0, 10), holidayUS: HOLIDAY_US };
  let n = 0, ok = 0;
  for (const p of cat) {
    try {
      const html = await (await fetch(p.sourceUrl, { headers: UA, signal: AbortSignal.timeout(30000) })).text();
      const fac = new Map();
      for (const v of variants(html)) {
        const a = fac.get(v.loc) || { price: v.base, ship: {} }; fac.set(v.loc, a);
        a.price = Math.min(a.price, v.base);
        const at = k => { const r = v.ship.find(s => s.ship_location === k); return r && r.first_item_price !== '' && r.first_item_price != null ? Math.round(parseFloat(r.first_item_price) * 100) : undefined; };
        const row = at('ROW');
        const set = { US: at('US'), EU: at('EU') ?? row, GB: at('UK') ?? at('GB') ?? row, CA: at('CA') ?? row, AU: at('AU') ?? row };
        if (set.US != null) set.US += HOLIDAY_US;
        for (const [d, s] of Object.entries(set)) if (Number.isFinite(s) && !(a.ship[d] <= s)) a.ship[d] = s;
      }
      if (fac.size) { out.products[p.id] = [...fac].map(([loc, a]) => ['Merchize ' + loc, loc, a.price, a.ship]); ok++; }
    } catch (e) { console.error(p.id, e.message); }
    n++;
    await sleep(800);
  }
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log('bitti', n, 'eşleşen', ok);
})();
