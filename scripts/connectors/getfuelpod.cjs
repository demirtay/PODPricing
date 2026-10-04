// GetFuelPod: /product-type/<tür> sayfalarındaki kartlar (STANDARD PRICE, INTRO PRICE, DECORATION TYPE).
// Sayfa: "Prices are flat across all colors and include 1 print". Ürünlerin ayrı sayfası yok; bağlantı tür sayfasıdır.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { record } = require('../public-connectors.cjs');
const { fetchText, decode } = require('./http.cjs');

const BASE = 'https://www.getfuelpod.com';
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
const cents = s => Math.round(Number(s) * 100);
const title = s => s.toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\bX\b/g, 'x');

async function collect(progress = () => {}) {
  const checkedAt = new Date().toISOString();
  const all = (await fetchText(BASE + '/product-type/all')).text;
  if (!/include 1 print/i.test(all)) throw Error('GetFuelPod fiyat açıklaması değişti; baskı dahil varsayımı doğrulanamadı');
  const types = [...new Set([...all.matchAll(/href="(\/product-type\/[a-z0-9-]+)"/g)].map(m => m[1]))].filter(t => !/best-selling/.test(t));
  const byKey = new Map(), skipped = [];
  // Webflow listeleri sayfalı: ?<id>_page=N bağlantıları bitene kadar izlenir.
  async function pages(t, first) {
    const out = [first], seenUrls = new Set([t]);
    for (let html = first, n = 0; n < 20; n++) {
      const next = (html.match(/href="(\?[a-z0-9]+_page=(\d+))"/g) || []).map(s => s.slice(6, -1)).find(q => !seenUrls.has(t + q));
      if (!next) break;
      seenUrls.add(t + next);
      await new Promise(r => setTimeout(r, 800));
      html = (await fetchText(BASE + t + next)).text;
      out.push(html);
    }
    return out;
  }
  for (const [i, t] of ['/product-type/all', ...types.filter(x => x !== '/product-type/all')].entries()) {
    const html = (await pages(t, i === 0 ? all : (await fetchText(BASE + t)).text)).join('\n');
    for (const card of html.split('role="listitem"').slice(1)) {
      const name = decode((card.match(/class="product-title">([\s\S]*?)<\/h3>/) || [])[1]);
      const std = card.match(/STANDARD PRICE:\s*\$([\d.]+)/), intro = card.match(/INTRO PRICE:\s*\$([\d.]+)/);
      const img = (card.match(/<img[^>]+src="([^"]+)"/) || [])[1];
      const deco = decode((card.match(/DECORATION TYPE:\s*([^<]+)/) || [])[1]);
      if (!name) continue;
      if (!std) { skipped.push({ name, reason: 'Standart fiyat yok' }); continue; }
      const key = slug(name);
      if (byKey.has(key)) continue;
      const p = record('getfuelpod', key, title(name), cents(std[1]), img, BASE + t, 'Tüm renklerde aynı fiyat');
      p.priceBasis = 'GetFuelPod standart fiyatı · 1 baskı dahil · tüm renklerde aynı' + (intro ? ` · tanıtım fiyatı ${intro[1]} USD` : '') + ' · kargo ayrıca';
      if (deco) p.decorationMethods = [title(deco)];
      p.availableCountries = ['US'];
      p.sourceKind = 'catalog'; p.priceVerified = true; p.priceVerification = 'public-catalog-page';
      p.importedBy = 'getfuelpod-cards-v1'; p.checkedAt = checkedAt; p.checkedOn = checkedAt.slice(0, 10);
      byKey.set(key, p);
    }
    progress(i + 1, types.length + 1);
    if (i) await new Promise(r => setTimeout(r, 800));
  }
  const products = [...byKey.values()];
  fs.writeFileSync(path.resolve(__dirname, '../../data/getfuelpod-coverage.json'), JSON.stringify({ checkedAt, typePages: types.length + 1, imported: products.length, skipped }, null, 2));
  if (products.length < 20) throw Error('GetFuelPod: beklenenden az ürün (' + products.length + ')');
  return { products, pages: types.length + 1, reportedTotal: products.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect };
