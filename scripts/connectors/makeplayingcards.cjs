// MakePlayingCards: site haritasındaki /design/ ürün sayfaları. Her sayfada adet kademeli fiyat tablosu var
// (satır = adet kademesi, sütun = destedeki kart sayısı). Tek ürün fiyatı: ilk kademe (1-5 deste),
// ürünün varsayılan kart sayısı (hidd_pieces) sütunu; yoksa ilk kademenin en ucuz hücresi.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { cachedGet, crawl, decode } = require('./http.cjs');

const BASE = 'https://www.makeplayingcards.com';

function parse(url, html) {
  const title = decode(html.match(/<h1[^>]*itemprop="name"[^>]*>([^<]+)<\/h1>/)?.[1] || html.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1] || '').trim();
  const cells = [...html.matchAll(/id="p_r1_c(\d+)"\s+price="([\d.]+)"\s+pieces="(\d+)"/g)].map(m => ({ pieces: +m[3], price: +m[2] }));
  if (!title || !cells.length) return null;
  const minQty = +(html.match(/id="hidd_minQty"[^>]*value="(\d+)"/)?.[1] || 1);
  const tier = decode(html.match(/<td qty="\d+">([^<]+)<\/td>/)?.[1] || '').trim();
  const def = +(html.match(/id="hidd_pieces"[^>]*value="(\d+)"/)?.[1] || 0);
  const pick = cells.find(c => c.pieces === def) || cells.reduce((a, c) => c.price < a.price ? c : a);
  const img = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] || html.match(/itemprop="image"[^>]*src="([^"]+)"/)?.[1];
  return { title, minQty, tier, pieces: pick.pieces, price: pick.price, img: img ? new URL(img, BASE).href.replace(/^http:/, 'https:') : null };
}

async function collect(progress = () => {}) {
  const checkedAt = new Date().toISOString();
  const sm = await cachedGet('makeplayingcards', BASE + '/sitemap.xml');
  const urls = [...new Set([...sm.text.matchAll(/<loc>([^<]+)/g)].map(m => decode(m[1]).replace(/^http:/, 'https:')).filter(u => /\/design\/[^/]+\.html$/.test(u)))];
  const results = await crawl(urls, async u => { const r = await cachedGet('makeplayingcards', u); return { url: u, x: r.text ? parse(u, r.text) : null }; }, { concurrency: 2, delayMs: 700, progress });
  const products = [], skipped = [];
  for (const { url, x } of results) {
    if (!x) { skipped.push(url); continue; }
    if (x.minQty > 5) { skipped.push(url + ' (min ' + x.minQty + ')'); continue; }
    const slug = url.split('/').pop().replace(/\.html$/, '');
    products.push({
      id: 'makeplayingcards-' + slug, providerId: 'makeplayingcards', sourceProductId: slug, family: 'makeplayingcards-cards', category: 'stationery',
      title: x.title, leafLabel: /tuck box|box|case|tin/i.test(x.title) ? 'Playing Card Box' : 'Custom Playing Cards', aliases: ['custom cards'], baseMinor: Math.round(x.price * 100), currency: 'USD', imageUrl: x.img, sourceUrl: url,
      sizes: `${x.pieces} kart/deste`, material: null,
      priceBasis: `MakePlayingCards fiyat tablosu · ${x.tier || '1-5'} adet kademesi, deste başına (${x.pieces} kart), baskı dahil · kargo ayrıca`,
      shipping: null, deliveryDays: null, availableCountries: [],
      checkedOn: checkedAt.slice(0, 10), checkedAt, sourceKind: 'catalog', importedBy: 'makeplayingcards-pages-v1', priceVerified: true, priceVerification: 'public-price-table',
    });
  }
  fs.writeFileSync(path.resolve(__dirname, '../../data/makeplayingcards-coverage.json'), JSON.stringify({ checkedAt, pages: urls.length, imported: products.length, skipped }, null, 2));
  if (products.length < 50) throw Error('MakePlayingCards: beklenenden az ürün (' + products.length + ')');
  return { products, pages: urls.length, reportedTotal: urls.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect };
