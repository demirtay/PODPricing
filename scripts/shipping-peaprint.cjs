// PeaPrint: ürün sayfasındaki kargo servisi (api.bigollo.com/logistics/noauth/merchant/priceByLogisticsType, giriş gerekmez)
// -> data/shipping/estimate-peaprint.json. Ürün başına (productParentId = katalogdaki sourceProductId) varyant ücretleri gelir;
// en ucuz varyantın standart ücreti alınır (katalog fiyatı da en düşük varyant). Ekspres alınmaz.
// Varışlar: US, GB, CA, AU, EU (= Almanya). Çıkış: data/shipping/origins.json (PeaPrint: CN); ürün adındaki işaret landed-cost'ta önce gelir.
// Kullanım: node scripts/shipping-peaprint.cjs
'use strict';
const fs = require('node:fs'), path = require('node:path');

const root = path.join(__dirname, '..');
const OUT = path.join(root, 'data/shipping/estimate-peaprint.json');
const API = 'https://api.bigollo.com/logistics/noauth/merchant/priceByLogisticsType';
// sitenin kendi isteğindeki site kodu başlığı olmadan servis boş yanıt döndürüyor
const HEADERS = { 'Content-Type': 'application/json', 'b-site-code': 'peaprint', 'Accept-Language': 'en-US', Origin: 'https://peaprint.com', 'User-Agent': 'Mozilla/5.0 (compatible; POD-Atlas/1.0; fiyat karsilastirma)' };
const DEST = { US: 'US', GB: 'GB', CA: 'CA', AU: 'AU', EU: 'DE' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function prices(ids, nation) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(API + '?t=' + Date.now(), { method: 'POST', headers: HEADERS, body: JSON.stringify({ logisticsType: 'standard', nationAbbreviation: nation, productParentIds: ids }), signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw Error('HTTP ' + r.status);
      const j = await r.json();
      if (j.code !== '0' || !Array.isArray(j.data)) throw Error('yanıt: ' + JSON.stringify(j).slice(0, 120));
      return j.data;
    } catch (e) {
      if (attempt >= 3) throw e;
      await sleep(2000 * attempt);
    }
  }
}

(async () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8')).products.filter(p => p.providerId === 'peaprint' && /^\d+$/.test(p.sourceProductId));
  const origin = JSON.parse(fs.readFileSync(path.join(root, 'data/shipping/origins.json'), 'utf8')).providers.peaprint?.default || null;
  const byParent = new Map(catalog.map(p => [Number(p.sourceProductId), p.id]));
  const ids = [...byParent.keys()], out = {};
  let failed = 0;
  for (const [dest, nation] of Object.entries(DEST)) {
    for (let i = 0; i < ids.length; i += 20) {
      let data;
      try { data = await prices(ids.slice(i, i + 20), nation); } catch (e) { failed++; console.error(dest, i, e.message); continue; }
      for (const d of data) {
        const std = (d.variantPriceList || []).map(v => v.standardLogistics?.logisticsPrice).filter(x => x > 0);
        if (!std.length) continue; // "Delivery is not supported"
        const id = byParent.get(d.productParentId);
        (out[id] ||= {})[dest] = [['PeaPrint standard', Math.round(Math.min(...std) * 100), origin]];
      }
      await sleep(300);
    }
    console.log(dest + ': ' + Object.values(out).filter(o => o[dest]).length + ' ürün');
  }
  if (!Object.keys(out).length) throw Error('PeaPrint: hiç kargo ücreti gelmedi');
  fs.writeFileSync(OUT, JSON.stringify({ source: 'peaprint.com ürün sayfası kargo servisi (priceByLogisticsType, standard); en ucuz varyant; EU = Almanya', checked: new Date().toISOString().slice(0, 10), currency: 'USD', products: out }));
  console.log('PeaPrint: ' + Object.keys(out).length + '/' + catalog.length + ' ürün' + (failed ? ` (${failed} istek başarısız)` : ''));
})().catch(e => { console.error(e.message); process.exitCode = 1; });
