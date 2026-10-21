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
  printpartners: {
    page: 'https://printpartners.com/products',
    currency: 'USD',
    // katalog kartı: <a href="3005"> marka (h4) + ürün adı (p) + "Starting at: $X" + görsel; ürün sayfası /<model>
    cards: html => [...html.matchAll(/<a href="([^"]+)">\s*<div class="portfolio-item">\s*<div class="item-caption">\s*<h4>([^<]+)<\/h4>\s*<p>([^<]+)<\/p>\s*<h4>Starting at: \$([\d.,]+)<\/h4>\s*<\/div>\s*<div class="item-image">\s*<img[^>]*src="([^"]+)"/g)]
      .map(m => ({ href: new URL(m[1], 'https://printpartners.com/').href, image: new URL(m[5], 'https://printpartners.com/').href, title: `${m[2].trim()} ${m[3].trim()} (${m[1]})`, price: m[4] })),
    basis: 'Print Partners "Starting at" başlangıç fiyatı (tek adet) · kargo ayrıca',
    min: 20,
  },
  beautyboss: {
    page: 'https://beautyboss.com/product-catalog',
    currency: 'USD',
    cards: html => [...html.matchAll(/<img src="([^"]+)"[^>]*class="catalog-card-image"[\s\S]*?class="product-name">([^<]+)<\/div>[\s\S]*?As Low As:<\/div><div[^>]*>\$([\d.,]+)<\/div>[\s\S]*?href="(\/products\/[^"]+)"/g)]
      .map(m => ({ href: 'https://beautyboss.com' + m[4], image: m[1], title: m[2], price: m[3] })),
    basis: 'BeautyBoss "As Low As" fiyatı · kendi markanla kozmetik, fulfillment dahil · kargo ayrıca',
    min: 8,
  },
  slaitepod: {
    page: 'https://slaitepod.com/catalogue',
    currency: 'USD',
    cards: html => [...html.matchAll(/<img class="pic-1" src="([^"]+)">\s*<\/a>\s*<\/div>\s*<div class="product-content">\s*<a href="([^"]+)">\s*<h2>([^<]+)<\/h2>\s*<h3>From \$([\d.,]+) USD<\/h3>/g)]
      .map(m => ({ href: m[2], image: new URL(m[1], 'https://slaitepod.com/').href, title: m[3], price: m[4] })),
    basis: 'Slaite POD katalog "From" fiyatı · kaynak kargo/baskı koşullarını kartta belirtmiyor, üreticide kontrol edin',
    min: 20,
  },
  colouroo: {
    page: 'https://www.colouroo.com.au/catalogue.html',
    currency: 'AUD',
    cards: html => [...html.matchAll(/<article class="product"[^>]*data-code="([^"]+)">\s*<div class="ph"><img src="([^"]+)"[\s\S]*?<span class="code">([^<]+)<\/span>\s*<h3>([^<]+)<\/h3>[\s\S]*?<div class="price"><small>With 1 print<\/small>\$([\d.,]+)<\/div>/g)]
      .map(m => ({ href: 'https://www.colouroo.com.au/catalogue.html#' + m[1], image: new URL(m[2], 'https://www.colouroo.com.au/').href, title: `${m[4].trim()} (${m[3].trim()})`, price: m[5] })),
    basis: 'Colouroo fiyatı · tek baskı dahil, tek adet · ek baskı yeri ayrıca, kargo ayrıca',
    min: 80,
    // yalnız Avustralya içine gönderiyor (Brisbane); fiyat sayfasındaki sipariş başı standart posta ücreti
    shipping: { page: 'https://www.colouroo.com.au/pricing.html', origin: 'AU', rates: html => { const m = html.replace(/<[^>]*>/g, ' ').match(/Postage per order\s+\$([\d.,]+)\s+Standard/i); return m ? { AU: m[1] } : null; } },
  },
  zonkraft: {
    page: 'https://zonkraft.com/pricing',
    currency: 'USD',
    // tek tablo: ölçü başına üretim maliyeti (ürün türü belirtilmiyor) → en küçük ölçünün fiyatıyla tek kayıt
    cards: html => {
      const rows = [...html.replace(/<!-- -->/g, '').matchAll(/<td[^>]*>(\d+)&quot;<\/td><td[^>]*>\$([\d.,]+)<\/td>/g)].map(m => ({ size: Number(m[1]), price: m[2] }));
      const first = rows.find(r => r.size === Math.min(...rows.map(x => x.size)));
      return first ? [{ href: 'https://zonkraft.com/pricing', image: 'https://zonkraft-products.s3.amazonaws.com/dcs/1720454886369/fk07xz6nuh.png', title: `Custom Metal Wall Art Sign (${rows[0].size}"–${rows.at(-1).size}")`, price: first.price }] : [];
    },
    basis: 'Zonkraft ölçü tablosundaki üretim maliyeti · en küçük ölçü (8"), tek adet · tablo ürün türünü (die-cut/akrilik/renkli/titanyum) ayırmıyor · kargo ayrıca',
    min: 1,
  },
  zelaprint: {
    page: 'https://zelaprint.com/pricing',
    currency: 'GBP',
    // ölçü tabloları (A serisi / inç / cm): sütun 3 = tek adet fiyatı (sonraki sütunlar adet indirimi)
    cards: html => [...html.replace(/<!-- -->/g, '').matchAll(/<tr[^>]*>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>£([\d.]+)<\/td>/g)]
      .map(m => ({ href: 'https://zelaprint.com/pricing#' + m[1].toLowerCase().replace(/[^a-z0-9]+/g, '-'), image: 'https://zelaprint.com/gallery/user-03-clouds-poster.png', title: `Poster ${m[1].trim().replace(/ x /i, ' × ')} (${m[2].trim()})`, price: m[3] })),
    basis: 'Zela Print poster fiyatı · tek adet sütunu (adet indirimi ayrıca) · baskı dahil · kargo ayrıca (sabit varış ücreti)',
    min: 10,
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
  // kaynağın yayınladığı kargo ücreti (varış -> kuruş, USD); bulunamazsa kargo bilinmiyor kalır
  let ship = null;
  if (cfg.shipping) {
    const rates = cfg.shipping.rates((await fetchText(cfg.shipping.page)).text);
    if (rates) ship = Object.fromEntries(Object.entries(rates).map(([d, v]) => [d, Math.round(money(v) * fx.rate)]));
  }
  const products = [];
  for (const c of cards) {
    const minor = money(c.price), title = decode(c.title).replace(/\s+/g, ' ').trim();
    if (!(minor > 0) || !title) continue;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const r = record(id, slug, title, minor * fx.rate, c.image, c.href, 'Ölçü ve seçenekler üreticide seçilir');
    if (cfg.currency !== 'USD') { r.sourceMinor = minor; r.sourceCurrency = cfg.currency; r.exchangeRate = fx.rate; r.exchangeDate = fx.date; }
    if (ship) { r.shipping = ship; r.availableCountries = [cfg.shipping.origin]; }
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
