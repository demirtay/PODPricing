// Art of Where (Kanada, all-over print): herkese açık /products sayfasının gömülü verisi (PRELOADED_STORE.appData)
// ve /info/pricing fiyat tablosu. viewProducts[].price = sitede "from" diye gösterilen drop ship başlangıç fiyatı
// (tek adet, tasarımınla basılı). Her fiyat /info/pricing tablosunun "Drop ship" sütunuyla çapraz doğrulanır;
// tabloda karşılığı olmayan fiyat alınmaz. Wholesale (6 adet minimum) sütunu kullanılmaz.
// Kendini tanıtan User-Agent ile okunur; robots.txt yalnızca /api, /account, /ajax vb. yolları kapatıyor.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const https = require('node:https');
const { record } = require('../public-connectors.cjs');

const BASE = 'https://artofwhere.com';
const HEADERS = { 'User-Agent': 'PODPricingBot/1.0 (+https://podpricing.com)', Accept: '*/*' };
// Düz HTTPS isteği (fetch/undici, tarayıcı olmadığı hâlde sec-fetch-* başlıkları ekliyor ve Cloudflare bunu tutarsız buluyor).
function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: HEADERS, timeout: 45000 }, res => {
      let body = ''; res.setEncoding('utf8');
      res.on('data', d => { body += d; });
      res.on('end', () => res.statusCode === 200 ? resolve(body) : reject(Error('Art of Where HTTP ' + res.statusCode + ' ' + url)));
    });
    req.on('timeout', () => req.destroy(Error('Art of Where zaman aşımı ' + url)));
    req.on('error', reject);
  });
}
const BASIS = 'Art of Where drop ship fiyatı · tasarımınla basılı, tek adet · kargo ve vergiler hariç';

function preloadedStore(html) {
  const marker = 'var PRELOADED_STORE = ';
  const s = html.indexOf(marker) + marker.length;
  if (s < marker.length) throw Error('Art of Where: sayfa verisi (PRELOADED_STORE) bulunamadı');
  let depth = 0, inString = false, escaped = false, i = s;
  for (; i < html.length; i++) {
    const c = html[i];
    if (inString) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') inString = false; continue; }
    if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) { i++; break; }
  }
  return JSON.parse(html.slice(s, i)).appData;
}

// /info/pricing tablolarındaki "Drop ship" (son sütun) değerleri, sent cinsinden
function dropShipPrices(html) {
  const out = new Set();
  for (const table of html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)) {
    const head = [...table[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(m => m[1].replace(/<[^>]*>/g, '').trim());
    if (!/drop ship/i.test(head[head.length - 1] || '')) continue;
    for (const row of table[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
      const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1].replace(/<[^>]*>/g, '').trim());
      const m = (cells[cells.length - 1] || '').match(/^\$(\d+(?:\.\d{2})?)$/);
      if (m) out.add(Math.round(Number(m[1]) * 100));
    }
  }
  return out;
}

async function collect(progress = () => {}) {
  const checkedAt = new Date().toISOString();
  const pricing = await get(BASE + '/info/pricing');
  const allowed = dropShipPrices(pricing);
  if (allowed.size < 50) throw Error('Art of Where: fiyat tablosu okunamadı (' + allowed.size + ' değer)');
  const store = preloadedStore(await get(BASE + '/products'));
  const views = Object.values(store.viewProducts || {}), bases = store.products || {};
  if (views.length < 50) throw Error('Art of Where: ürün listesi eksik (' + views.length + ')');
  const products = [], skipped = [];
  for (const v of views) {
    const base = bases[v.id_product];
    const amount = v.price?.amount;
    if (!base || !base.visible) { skipped.push({ id: v.id, name: v.name, reason: 'Ürün yayında değil' }); continue; }
    if (v.price?.currency !== 'USD') throw Error('Art of Where: beklenmeyen para birimi ' + v.price?.currency);
    if (!(amount > 0)) { skipped.push({ id: v.id, name: v.name, reason: 'Fiyat yok' }); continue; }
    if (!allowed.has(amount)) { skipped.push({ id: v.id, name: v.name, amount, reason: 'Fiyat, /info/pricing drop ship tablosunda yok' }); continue; }
    const image = (base.previews || []).find(p => p.url && !p.deleted)?.url;
    if (!image || !v.url_slug) { skipped.push({ id: v.id, name: v.name, reason: 'Görsel veya bağlantı yok' }); continue; }
    const fabric = base.slug === 'fabric';
    const title = fabric ? `${v.name.replace(/ Fabric$/i, '')} Fabric (1 m)` : v.name;
    const r = record('artofwhere', String(v.id), title, amount, image, BASE + '/products/' + v.url_slug, null, null);
    if (v.name !== base.name) r.aliases = [...new Set([...r.aliases, base.name])];
    r.priceBasis = fabric ? BASIS.replace('tek adet', '1 metre kumaş') : BASIS;
    r.includesPrint = true;
    r.priceVerified = true; r.priceVerification = 'public-pricing-table';
    r.importedBy = 'artofwhere-public-v1'; r.checkedAt = checkedAt; r.checkedOn = checkedAt.slice(0, 10);
    products.push(r);
  }
  progress(views.length, views.length);
  fs.writeFileSync(path.resolve(__dirname, '../../data/artofwhere-coverage.json'), JSON.stringify({ checkedAt, listed: views.length, imported: products.length, skipped }, null, 2));
  if (products.length < views.length * 0.8) throw Error(`Art of Where: çok az ürün doğrulandı (${products.length}/${views.length})`);
  return { products, pages: 1, reportedTotal: views.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect, preloadedStore, dropShipPrices };
