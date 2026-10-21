// Kargo ücretini ürün türü / ağırlık tablosu olarak yayınlayan üreticiler (her biri kendi sayfasından, her çalışmada yeniden okunur).
// Çıktı: data/shipping/estimate-<üretici>.json (landed-cost.cjs estimate*.json biçimi: { ürünId: { varış: [[yöntem, kuruş, çıkış]] } })
// Tahmin yok: tablonun açıkça kapsamadığı ürün türü (ör. Printgenie çocuk giyim, TreatPOD ağırlığı yayınlanmamış ürünler) yazılmaz.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const tx = require('./pod-taxonomy.cjs');
const { fetchText } = require('./connectors/http.cjs');

const root = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8')).products;
const text = html => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
const minor = s => Math.round(Number(String(s).replace(/,/g, '')) * 100);
const save = (id, source, products) => {
  fs.writeFileSync(path.join(root, `data/shipping/estimate-${id}.json`), JSON.stringify({ source, checked: new Date().toISOString().slice(0, 10), currency: 'USD', products }));
  console.log(id + ': ' + Object.keys(products).length + ' ürün');
};

// Printgenie: ürün türü başına ilk ürün ücreti; ABD içi, Kanada, uluslararası (ABD'den gönderiyor)
async function printgenie() {
  const page = 'https://www.printgenie.com/resources/shipping-rates-and-info';
  const t = text((await fetchText(page)).text);
  if (!/We ship from the US/i.test(t)) throw Error('Printgenie: çıkış ülkesi beyanı bulunamadı');
  const block = (from, to) => { const s = t.indexOf(from), e = to ? t.indexOf(to, s) : t.length; return s < 0 ? '' : t.slice(s, e < 0 ? t.length : e); };
  const row = (b, label) => { const m = b.match(new RegExp(label + '\\s*\\$([\\d.]+)\\s*\\$([\\d.]+)', 'i')); return m ? minor(m[1]) : null; };
  const zones = { US: block('Domestic (Within the United States)', 'Canada Shipping'), CA: block('Canada Shipping', 'International Shipping'), INT: block('International Shipping', 'All shipping will') };
  const rates = {
    tee: Object.fromEntries(Object.entries(zones).map(([z, b]) => [z, row(b, 'T-shirts, tank tops, long sleeves, polos, crop tops')])),
    sweat: Object.fromEntries(Object.entries(zones).map(([z, b]) => [z, row(b, 'Sweatshirts, Hoodies, Zip ups')])),
  };
  if (!rates.tee.US || !rates.sweat.US) throw Error('Printgenie: tablo okunamadı');
  // yalnız tablodaki türler (çocuk/bebek, forma, aksesuar vb. tabloda yok)
  const group = { 'giyim-tisort': 'tee', 'giyim-atlet': 'tee', 'giyim-uzun-kollu': 'tee', 'giyim-polo': 'tee', 'giyim-crop': 'tee', 'giyim-sweatshirt': 'sweat', 'giyim-kapusonlu': 'sweat', 'giyim-fermuarli-kapusonlu': 'sweat' };
  const out = {};
  for (const p of catalog.filter(p => p.providerId === 'printgenie')) {
    const g = group[tx.classify(p).type];
    if (!g) continue;
    const r = rates[g], m = 'Printgenie standard';
    out[p.id] = { US: [[m, r.US, 'US']] };
    if (r.CA) out[p.id].CA = [[m, r.CA, 'US']];
    if (r.INT) for (const d of ['GB', 'EU', 'AU']) out[p.id][d] = [[m, r.INT, 'US']];
  }
  save('printgenie', page + ' (ilk ürün, türe göre tablo)', out);
}

// TreatPOD (Watford, İngiltere): ağırlığa göre ücret (GBP, KDV dahil) + sayfadaki örnek ürün ağırlıkları
async function treatpod() {
  const page = 'https://treatpod.co.uk/pages/shipping-costs';
  const t = text((await fetchText(page)).text);
  const num = re => { const m = t.match(re); return m ? Number(m[1]) : null; };
  const uk100 = num(/0g - 100g £([\d.]+)/), uk2k = num(/100g - 2\.0kg £([\d.]+)/);
  const us = t.match(/USA £([\d.]+) [\d-]+ days £([\d.]+)/), de = num(/Germany £([\d.]+)/);
  const wsec = t.slice(t.indexOf('Item Weight (g)'));
  const weight = name => { const m = wsec.match(new RegExp(name + ' (\\d+)', 'i')); return m ? Number(m[1]) : null; };
  if (!uk100 || !uk2k || !us || !de || t.indexOf('Item Weight (g)') < 0) throw Error('TreatPOD: kargo tablosu okunamadı');
  // sayfadaki örnek ağırlıklar -> ürün adıyla eşleşme (yalnız açıkça aynı ürün)
  const items = [
    ['11oz Ceramic Mug', p => /\b11 ?oz\b/i.test(p.title) && /mug/i.test(p.title) && !/enamel|metal|steel|glass|travel|latte|magic|colour|color/i.test(p.title)],
    ['Apron', p => /\bapron\b/i.test(p.title)],
    ['Bottle Opener', p => /bottle opener/i.test(p.title)],
    ['Cushion Cover', p => /cushion cover/i.test(p.title)],
    ['Ceramic Dog Bowl', p => /ceramic/i.test(p.title) && /dog bowl|pet bowl/i.test(p.title)],
    ['Metal Keyring', p => /\bmetal\b/i.test(p.title) && /key ?ring|keychain/i.test(p.title)],
    ['MDF Coaster', p => /\bMDF\b/i.test(p.title) && /coaster/i.test(p.title)],
    ['Socks', p => /\bsocks?\b/i.test(p.title)],
    ['Tote Bags', p => /\btote\b/i.test(p.title)],
    ['Water Bottle', p => /water bottle/i.test(p.title) && !/glass|ceramic|steel|insulated|vacuum/i.test(p.title)],
  ].map(([n, f]) => [n, weight(n), f]).filter(([, w]) => w);
  const out = {};
  for (const p of catalog.filter(p => p.providerId === 'treatpod')) {
    const hit = items.find(([, , f]) => f(p));
    const fx = p.sourceCurrency === 'GBP' && p.exchangeRate > 0 ? p.exchangeRate : null;
    if (!hit || !fx) continue;
    const w = hit[1], usd = gbp => Math.round(gbp * 100 * fx);
    out[p.id] = {
      GB: [['Royal Mail Tracked', usd(w <= 100 ? uk100 : uk2k), 'GB']],
      ...(w <= 500 ? { US: [['Royal Mail Tracked (0-500g)', usd(Number(us[1])), 'GB']] } : w <= 2000 ? { US: [['Royal Mail Tracked (upto 2kg)', usd(Number(us[2])), 'GB']] } : {}),
      EU: [['Royal Mail Tracked (Germany)', usd(de), 'GB']],
    };
  }
  save('treatpod', page + ' (ağırlık tablosu + sayfadaki örnek ürün ağırlıkları; EU = Almanya)', out);
}

(async () => {
  let failed = 0;
  for (const f of [printgenie, treatpod]) { try { await f(); } catch (e) { failed++; console.error(f.name + ': ' + e.message); } }
  if (failed) process.exitCode = 1;
})();
