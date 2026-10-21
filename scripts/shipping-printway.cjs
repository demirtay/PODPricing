// Printway: ürün sayfasının "Shipping" sekmesindeki servisler (giriş gerekmez):
//   get-carrier { productTypeId, locationChoose } -> taşıyıcılar ve gönderdikleri ülkeler (US Standard, EU Standard, International)
//   fetch-avg-shipping-price { option, productTypeId, locationChoose, supplierChoose, carrierChoose } -> renk başına minShippingFee
// Üretim yeri: ürün ayrıntısındaki location[] (taban fiyatı en düşük olan; katalog fiyatı da Titanium en düşük varyant).
// Varışlar: US, GB, EU (= Almanya); yalnız taşıyıcının ülke listesinde açıkça olan varış yazılır. -> data/shipping/estimate-printway.json
// Kullanım: node scripts/shipping-printway.cjs   (karşılaştırmadaki Printway ürünleri; data/compare-ids.json)
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { cachedGet } = require('./connectors/http.cjs');

const root = path.join(__dirname, '..');
const OUT = path.join(root, 'data/shipping/estimate-printway.json');
const API = 'https://apis.printway.io/v1';
// servis tarayıcı dışı isteklere "Access denied" veriyor; sitenin kendi isteğindeki başlıklar (connectors/printway.cjs ile aynı)
const HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Requested-With': 'en', Origin: 'https://printway.io', Referer: 'https://printway.io/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', 'Sec-Fetch-Site': 'same-site', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Dest': 'empty' };
const DEST = { US: 'US', GB: 'GB', EU: 'DE' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function post(ep, body) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(API + ep, { method: 'POST', headers: HEADERS, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
      if (r.status === 429 && attempt < 4) { await sleep(20000 * attempt); continue; }
      if (!r.ok) throw Error('HTTP ' + r.status);
      const j = await r.json();
      if (!j.success) throw Error(j.message || 'başarısız');
      return j.data;
    } catch (e) { if (attempt >= 3) throw e; await sleep(3000 * attempt); }
  }
}

(async () => {
  const ids = new Set(JSON.parse(fs.readFileSync(path.join(root, 'data/compare-ids.json'), 'utf8')));
  const all = process.argv.includes('--all');
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8')).products.filter(p => p.providerId === 'printway' && (all || ids.has(p.id)));
  const list = JSON.parse((await cachedGet('printway', API + '/product-type/home/catalog', { headers: HEADERS })).text).data;
  const bySlug = new Map(list.map(x => [x.slug, x]));
  const out = {};
  let failed = 0;
  for (const p of catalog) {
    const slug = p.sourceUrl.split('/product/')[1];
    const item = bySlug.get(slug);
    if (!item) continue;
    try {
      const d = JSON.parse((await cachedGet('printway', `${API}/product-type/home/detail-product?slug=${encodeURIComponent(slug)}`, { headers: HEADERS })).text).data;
      const loc = (d.location || []).filter(l => l.minTitaniumPrice > 0).sort((a, b) => a.minTitaniumPrice - b.minTitaniumPrice)[0];
      const supplier = loc && (loc.suppliers.find(s => s.default) || loc.suppliers[0]);
      const opt = (item.option || [])[0];
      if (!loc || !supplier || !opt) continue;
      const carriers = await post('/product-type/home/get-carrier', { productTypeId: d._id || item._id, locationChoose: loc.locationId });
      const rec = {};
      for (const [dest, cc] of Object.entries(DEST)) {
        // aynı varışa giden taşıyıcılardan "standard" türü önce, sonra uluslararası
        const c = carriers.filter(c => (c.country || []).includes(cc)).sort((a, b) => (a.type === 'standard' ? 0 : 1) - (b.type === 'standard' ? 0 : 1))[0];
        if (!c) continue;
        await sleep(300);
        const fees = await post('/product-type/home/fetch-avg-shipping-price', { option: { label: opt.label, value: opt.values.map(v => v.name) }, productTypeId: d._id || item._id, locationChoose: loc.locationId, supplierChoose: supplier._id, carrierChoose: c._id });
        const min = Math.min(...fees.map(f => f.minShippingFee).filter(x => x > 0));
        if (Number.isFinite(min)) rec[dest] = [['Printway ' + c.name, Math.round(min * 100), loc.code === 'EU' ? 'EU' : loc.code]];
      }
      if (Object.keys(rec).length) out[p.id] = rec;
    } catch (e) { failed++; }
    await sleep(300);
  }
  if (!Object.keys(out).length) throw Error('Printway: hiç kargo ücreti gelmedi');
  fs.writeFileSync(OUT, JSON.stringify({ source: 'printway.io ürün sayfası Shipping sekmesi (get-carrier + fetch-avg-shipping-price); en düşük fiyatlı üretim yeri, renkler içinde en düşük ilk ürün ücreti; EU = Almanya', checked: new Date().toISOString().slice(0, 10), currency: 'USD', products: out }));
  console.log('Printway: ' + Object.keys(out).length + '/' + catalog.length + ' ürün' + (failed ? ` (${failed} hata)` : ''));
})().catch(e => { console.error(e.message); process.exitCode = 1; });
