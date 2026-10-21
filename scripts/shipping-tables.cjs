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

// Snapwear: ülke + ağırlık bandı tablosu (shipping-rates sayfasına gömülü CSV, EUR) + ürün sayfasındaki "Weight: ... (370 g)" ve
// "Product available in the U.S. and Europe" beyanı. Merkez belirtilmeyen varışlar (CA, AU) yazılmaz.
async function snapwear() {
  const page = 'https://snapwear.pro/shipping-rates';
  const m = (await fetchText(page)).text.match(/CSV_URL\s*=\s*"data:text\/csv;charset=utf-8;base64,([^"]+)"/);
  if (!m) throw Error('Snapwear: kargo tablosu bulunamadı');
  const rows = Buffer.from(m[1], 'base64').toString('utf8').replace(/^﻿/, '').split(/\r?\n/).slice(1).map(l => l.split(';')).filter(r => r.length >= 3)
    .map(([country, band, price]) => { const [lo, hi] = (band.match(/\d+/g) || []).map(Number); return { country, lo, hi, eur: Number(price.replace(',', '.')) }; });
  const rate = (country, g) => rows.find(r => r.country === country && g >= r.lo && g <= r.hi)?.eur;
  if (!rate('United States', 300) || !rate('Germany', 300)) throw Error('Snapwear: tablo biçimi değişti');
  const out = {};
  for (const p of catalog.filter(p => p.providerId === 'snapwear')) {
    const fx = p.sourceCurrency === 'EUR' && p.exchangeRate > 0 ? p.exchangeRate : null;
    if (!fx) continue;
    let t;
    try { t = text((await fetchText(p.sourceUrl)).text); } catch { continue; }
    await new Promise(r => setTimeout(r, 400));
    // ürün ağırlığı (gram birimi açıkça yazılı olan); bedene göre değişiyorsa en hafifi (taban fiyat da en düşük varyant). g/m² kumaş ağırlığı sayılmaz
    const w = Number((t.match(/Weight[^:]{0,30}:\s*(?:approx\.?\s*)?(?:(?:size\s*)?[A-Z0-9]{1,4}\s*-\s*)?(\d+)\s?(?:g|gr)\b(?!\s?\/)/i)
      || t.match(/Weight:.{0,40}?\((\d+)\s?g\)/i) || t.match(/Total Weight[^:]{0,30}:.{0,60}?-\s*(\d+)\s?(?:g|gr)\b(?!\s?\/)/i) || [])[1]);
    const av = (t.match(/available in (?:the )?(.{0,40})/i) || t.match(/Produced in the (.{0,30})/i) || [])[1] || '';
    if (!(w > 0) || !av) continue;
    const usd = eur => Math.round(eur * 100 * fx), o = {};
    if (/U\.?S\.?|United States|USA/i.test(av) && rate('United States', w)) o.US = [['Snapwear Local Post', usd(rate('United States', w)), 'US']];
    if (/Europe|\bEU\b/i.test(av)) {
      if (rate('Germany', w)) o.EU = [['Snapwear Courier (Germany)', usd(rate('Germany', w)), 'EU']];
      if (rate('United Kingdom', w)) o.GB = [['Snapwear Local Post', usd(rate('United Kingdom', w)), 'EU']];
    }
    if (Object.keys(o).length) out[p.id] = o;
  }
  save('snapwear', page + ' (ülke × ağırlık bandı) + ürün sayfasındaki ağırlık ve bölge beyanı; EU = Almanya', out);
}

// PodHut: SSS sayfasındaki standart ücretler (USPS, ABD'den): yalnız "T-shirt" ve "Hoodie"; uluslararası gönderi başı sabit ücret
async function podhut() {
  const page = 'https://podhut.com/pages/faq';
  const t = text((await fetchText(page)).text);
  const tee = t.match(/T-shirt shipping \$([\d.]+)/i), hood = t.match(/Hoodie shipping \$([\d.]+)/i), intl = t.match(/International shipping is a flat \$([\d.]+)/i);
  if (!tee || !hood || !/USPS/.test(t)) throw Error('PodHut: kargo ücretleri okunamadı');
  const group = { 'giyim-tisort': minor(tee[1]), 'giyim-kapusonlu': minor(hood[1]) };
  const out = {};
  for (const p of catalog.filter(p => p.providerId === 'podhut')) {
    const sh = group[tx.classify(p).type];
    if (sh == null) continue;
    out[p.id] = { US: [['USPS (PodHut standard)', sh, 'US']] };
    if (intl) for (const d of ['GB', 'EU', 'CA', 'AU']) out[p.id][d] = [['PodHut international (flat)', minor(intl[1]), 'US']];
  }
  save('podhut', page + ' (T-shirt / Hoodie standart ücreti; uluslararası sabit)', out);
}

// Gearment: yardım merkezindeki "How Shipping Fee Is Calculated" makalesinin bağlantı verdiği fiyat listesi (Google E-Tablo, herkese açık).
// Sütunlar: ürün, Standard taban fiyat, ..., US Standard, ..., International Standard. Eşleşme: giyimde model kodu (5000, 3001Y...),
// diğerlerinde aynı taban fiyat + ad kelimeleri. ABD'deki tesislerden (origins.json).
const csvRows = t => {
  const rows = []; let cur = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { cur.push(f); f = ''; }
    else if (ch === '\n') { cur.push(f); rows.push(cur); cur = []; f = ''; }
    else if (ch !== '\r') f += ch;
  }
  if (f || cur.length) { cur.push(f); rows.push(cur); }
  return rows;
};
async function gearment() {
  const sheet = 'https://docs.google.com/spreadsheets/d/1BTqEk0BA8mYUQeKiJZm0IskBqiOO1kaB';
  const rows = csvRows((await fetchText(sheet + '/export?format=csv&gid=426300731')).text);
  const head = rows.findIndex(r => /Product and Sizes/i.test(r[0] || ''));
  if (head < 0 || !/US Shipping/i.test(rows[head].join(',')) || !/International Shipping/i.test(rows[head].join(','))) throw Error('Gearment: fiyat listesi biçimi değişti');
  const col = name => rows[head].findIndex(c => new RegExp(name, 'i').test(c));
  const cUS = col('US Shipping'), cINT = col('International Shipping');
  const words = s => new Set(s.toLowerCase().replace(/[™®”"'']/g, '').split(/[^a-z0-9]+/).filter(w => w.length > 1));
  const list = rows.slice(head + 2).filter(r => r[0] && /^\$/.test(r[1] || '') && /^\$/.test(r[cUS] || ''))
    .map(r => ({ name: r[0], base: minor(r[1].slice(1)), us: minor(r[cUS].slice(1)), intl: /^\$/.test(r[cINT] || '') ? minor(r[cINT].slice(1)) : null, code: (r[0].match(/[-–]\s*([0-9][0-9A-Z]{2,})\s*$/) || [])[1], w: words(r[0]) }));
  const out = {};
  for (const p of catalog.filter(p => p.providerId === 'gearment')) {
    const code = (p.title.match(/[-–]?\s*([0-9][0-9A-Z]{2,})\s*$/) || [])[1];
    let hit = code && list.filter(r => r.code && r.code.toUpperCase() === code.toUpperCase());
    if (!hit || hit.length !== 1) {
      const pw = words(p.title);
      hit = list.filter(r => r.base === p.baseMinor && [...pw].filter(w => r.w.has(w)).length >= Math.min(3, pw.size));
    }
    if (hit.length !== 1) continue;
    const r = hit[0];
    out[p.id] = { US: [['Gearment Standard', r.us, 'US']] };
    if (r.intl) for (const d of ['GB', 'EU', 'CA', 'AU']) out[p.id][d] = [['Gearment International Standard', r.intl, 'US']];
  }
  save('gearment', sheet + ' (Gearment fiyat listesi; help.gearment.com bağlantısı)', out);
}

(async () => {
  let failed = 0;
  for (const f of [printgenie, treatpod, snapwear, podhut, gearment]) { try { await f(); } catch (e) { failed++; console.error(f.name + ': ' + e.message); } }
  if (failed) process.exitCode = 1;
})();
