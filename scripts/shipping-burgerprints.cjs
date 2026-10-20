// BurgerPrints: ürün başına üretim seçenekleri (tesis) ve tesisin ülke ülke kargo tablosu
// (burgerprints.com/catalog ürün sayfasının kullandığı herkese açık servis) -> data/shipping/facilities.json
// Kayıt: { "<ürünId>": [[tesis, ülke, en düşük fiyat (kuruş), {US,GB,EU,CA,AU: ilk ürün standart kargo (kuruş)}]] }; EU = Almanya.
// "Platform Label" seçenekleri alınmaz (pazar yerinin kendi kargo etiketiyle gönderim; Etsy satıcısı kullanamaz).
// Kullanım: node scripts/shipping-burgerprints.cjs   (karşılaştırmadaki ürünler; data/compare-ids.json)
'use strict';
const fs = require('node:fs'), path = require('node:path');

const root = path.join(__dirname, '..');
const OUT = path.join(root, 'data/shipping/facilities.json');
const API = 'https://burgerprints.com/catalog/api';
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; POD-Atlas/1.0; fiyat karsilastirma)', Accept: 'application/json' };
const DEST = { US: 'US', GB: 'GB', EU: 'DE', CA: 'CA', AU: 'AU' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url, headers = UA) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
      if (r.status === 429 && attempt < 5) { await sleep(30000 * attempt); continue; }
      if (!r.ok) throw Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) { if (attempt >= 3) throw e; await sleep(5000 * attempt); }
  }
}

(async () => {
  const ids = new Set(JSON.parse(fs.readFileSync(path.join(root, 'data/compare-ids.json'), 'utf8')));
  const want = new Set([...ids].filter(id => id.startsWith('burgerprints-')).map(id => id.slice(13)));
  // katalog kimliği -> shortCode
  const codes = new Map();
  for (let n = 1; ; n++) {
    const d = (await get(`https://catalog-api.burgerprints.com/api/v1/catalogsV2/search?pageIndex=${n}&pageSize=100`, { 'api-key': 'burgerprints' })).data;
    for (const p of d.content) codes.set(p.id, p.shortCode);
    if (d.last || !d.content.length) break;
    await sleep(800);
  }
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  const out = { ...prev, burgerprints: { source: 'burgerprints.com/catalog (fulfillment-option + detail/tabs?tab=shipping)', checked: new Date().toISOString().slice(0, 10), currency: 'USD' }, products: prev.products || {} };
  let n = 0, fail = 0;
  for (const id of want) {
    const sc = codes.get(id);
    if (!sc) continue;
    try {
      const opts = (await get(`${API}/catalog/catalogsV2/fulfillment-option?shortCode=${sc}&option=MANUAL`)).data?.manualOptionList || [];
      const rows = [];
      for (const o of opts) {
        if ((o.highlights || []).some(h => /platform label/i.test(h)) || !(o.price > 0)) continue;
        await sleep(600);
        const tab = (await get(`${API}/catalogsV2/detail/tabs?option=manual&short_code=${sc}&tab=shipping&partnerId=${o.id}`)).data?.data || [];
        const ship = {};
        for (const [k, cc] of Object.entries(DEST)) {
          const c = tab.find(x => x.countryCode === cc), v = (c?.details || []).filter(x => /standard/i.test(x.method)).map(x => Math.round(parseFloat(x.firstItemPrice) * 100)).filter(Number.isFinite);
          if (v.length) ship[k] = Math.min(...v);
        }
        rows.push([o.name, (o.locations || [])[0] || null, Math.round(o.price * 100), ship]);
      }
      out.products['burgerprints-' + id] = rows;
    } catch (e) { fail++; console.error(id, e.message); }
    if (++n % 10 === 0) { fs.writeFileSync(OUT, JSON.stringify(out)); console.log(n, '/', want.size); }
    await sleep(600);
  }
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log('bitti', n, 'hata', fail);
})();
