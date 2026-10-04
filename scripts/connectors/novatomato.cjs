// NovaTomato: site haritasındaki ürün tanıtım sayfalarında (custom-*, products/*) ürün kutuları:
// /product/detail/?itemNumber=XXX bağlantısı, görsel, ad ve "1 Starting at $X" (tek adet, baskı dahil başlangıç fiyatı).
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { cachedGet, crawl, decode } = require('./http.cjs');

const BASE = 'https://www.novatomato.com';
const CAT = t => /hoodie|sweatshirt|polo|shirt|tee|tank|jacket|pants|shorts|skirt|dress|bra|leggings|sweater|jersey|vest|top\b/i.test(t) ? 'clothing'
  : /cushion|pillow|blanket|towel/i.test(t) ? 'home' : /bag|tote/i.test(t) ? 'bags' : 'accessories';

async function collect(progress = () => {}) {
  const checkedAt = new Date().toISOString();
  const sm = await cachedGet('novatomato', BASE + '/sitemap-xml/');
  const pages = [...sm.text.matchAll(/<loc>([^<]+)/g)].map(m => decode(m[1]))
    .filter(u => u.startsWith(BASE + '/') && !u.includes('/au/') && /\/(custom-[^/]+|products|print-on-demand|dropshipping|make-to-stock|fashion-brand)/.test(u) && !/\/product\/detail/.test(u));
  const found = new Map();
  await crawl(pages, async u => {
    const r = await cachedGet('novatomato', u);
    for (const m of (r.text || '').matchAll(/href="(\/product\/detail\/\?itemNumber=([A-Z0-9]+))"[^>]*>([\s\S]*?)<\/a>/g)) {
      const [, rel, item, inner] = m;
      const price = inner.match(/Starting at \$([\d.,]+)/)?.[1];
      const name = decode(inner.match(/standard-tile-name">([^<]+)</)?.[1] || '').trim();
      if (!price || !name || found.has(item)) continue;
      const img = inner.match(/<img src="([^"]+)"/)?.[1];
      found.set(item, { rel, item, name, price, img: img ? new URL(decode(img).replace(/^\/\//, 'https://'), BASE).href : null, page: u });
    }
    return null;
  }, { concurrency: 2, delayMs: 600, progress });
  const products = [...found.values()].map(x => ({
    id: 'novatomato-' + x.item.toLowerCase(), providerId: 'novatomato', sourceProductId: x.item, family: 'novatomato-' + CAT(x.name), category: CAT(x.name),
    title: x.name, aliases: [], baseMinor: Math.round(Number(x.price.replace(/,/g, '')) * 100), currency: 'USD', imageUrl: x.img, sourceUrl: BASE + x.rel,
    sizes: 'Ölçü ve renkler üreticide seçilir', material: (x.name.match(/\d+g\b/) || [null])[0] ? 'Fabric weight ' + x.name.match(/\d+g\b/)[0] : null,
    priceBasis: 'NovaTomato "Starting at" başlangıç fiyatı · tek adet, baskı dahil · kargo ayrıca',
    shipping: null, deliveryDays: null, availableCountries: [],
    checkedOn: checkedAt.slice(0, 10), checkedAt, sourceKind: 'catalog', importedBy: 'novatomato-tiles-v1', priceVerified: true, priceVerification: 'public-catalog-page',
  }));
  fs.writeFileSync(path.resolve(__dirname, '../../data/novatomato-coverage.json'), JSON.stringify({ checkedAt, pagesScanned: pages.length, imported: products.length }, null, 2));
  if (products.length < 20) throw Error('NovaTomato: beklenenden az ürün (' + products.length + ')');
  return { products, pages: pages.length, reportedTotal: products.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect };
