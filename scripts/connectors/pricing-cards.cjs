// Ortak bağlayıcı: tek sayfada ürün türü kartları ve "From X" başlangıç fiyatı yayınlayan üreticiler
// (kitap/baskı API'leri gibi). Her kart bir kayıt olur; fiyat o ürün türünün en düşük başlangıç fiyatıdır.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { fetchText, decode } = require('./http.cjs');

// "5,20" (virgül ondalık) ve "1,299.00" (virgül binlik) biçimleri
const money = s => { const t = String(s).trim(); const n = /,\d{2}$/.test(t) && !t.includes('.') ? t.replace(',', '.') : t.replace(/,/g, ''); return Math.round(Number(n) * 100); };

const SITES = {
  peecho: {
    page: 'https://www.peecho.com/products',
    currency: 'EUR',
    cards: html => [...html.matchAll(/<a[^>]*href="(\/products\/[^"]+)"[^>]*>\s*<div[^>]*class="products-card"[^>]*>\s*<img src="([^"]+)"[^>]*>[\s\S]*?<h6[^>]*>([^<]+)<\/h6>[\s\S]*?From €([\d.,]+)<\/p>\s*<\/div>\s*<\/a>/g)]
      // sitedeki "Canvases" kartı yanlışlıkla alüminyum sayfasına bağlı; doğru sayfa /wall-art/canvases (200)
      .map(m => ({ href: 'https://www.peecho.com' + (m[3].trim() === 'Canvases' ? '/products/wall-art/canvases' : m[1]), image: m[2], title: m[3], price: m[4] })),
    basis: 'Peecho ürün türü "From" başlangıç fiyatı (en küçük seçenek, tek adet) · KDV ve kargo ayrıca olabilir',
    min: 11,
  },
  blurb: {
    page: 'https://www.blurb.com/pricing',
    currency: 'USD',
    cards: html => [...html.matchAll(/data-tabs-trigger="([^"]+)"[\s\S]*?<img src="([^"]+)"[\s\S]*?<h4[^>]*>([^<]+)<\/h4>[\s\S]*?From US \$([\d.,]+)/g)]
      .map(m => ({ href: 'https://www.blurb.com/pricing#' + m[1], image: m[2], title: m[3], price: m[4] })),
    basis: 'Blurb ürün türü "From" başlangıç fiyatı (en küçük ölçü, tek adet) · kargo ve vergi ayrıca',
    min: 4,
  },
};

async function collect(id, progress = () => {}) {
  // döngüsel bağımlılık olmasın diye burada yüklenir (index.cjs SITES'i açılışta okur)
  const { record } = require('../public-connectors.cjs'), { exchange } = require('../store-connectors.cjs');
  const cfg = SITES[id];
  const checkedAt = new Date().toISOString();
  const html = (await fetchText(cfg.page)).text;
  const cards = cfg.cards(html);
  const fx = await exchange(cfg.currency);
  const products = [];
  for (const c of cards) {
    const minor = money(c.price), title = decode(c.title).replace(/\s+/g, ' ').trim();
    if (!(minor > 0) || !title) continue;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const r = record(id, slug, title, minor * fx.rate, c.image, c.href, 'Ölçü ve seçenekler üreticide seçilir');
    if (cfg.currency !== 'USD') { r.sourceMinor = minor; r.sourceCurrency = cfg.currency; r.exchangeRate = fx.rate; r.exchangeDate = fx.date; }
    r.priceBasis = cfg.basis; r.priceVerified = true; r.priceVerification = 'public-pricing-page';
    r.importedBy = id + '-pricing-cards-v1'; r.checkedAt = checkedAt; r.checkedOn = checkedAt.slice(0, 10);
    if (!products.some(p => p.id === r.id)) products.push(r);
  }
  progress(1, 1);
  fs.writeFileSync(path.resolve(__dirname, `../../data/${id}-coverage.json`), JSON.stringify({ checkedAt, page: cfg.page, cards: cards.length, imported: products.length }, null, 2));
  if (products.length < cfg.min) throw Error(`${id}: beklenenden az kart (${products.length})`);
  return { products, pages: 1, reportedTotal: cards.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { SITES, collect };
