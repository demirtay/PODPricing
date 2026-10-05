// PrintGenie: kategori sayfalarının ürün listesini doldurduğu herkese açık uç nokta
// (/get-products-according-filter?slug=&category_data_id=, JSON {htm}). Kartlarda "Pricing From $X".
// Baskının fiyata dahil olup olmadığı yazmadığı için fiyat türü "belirsiz" kalır.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { cachedGet, fetchText, decode, sleep } = require('./http.cjs');

const BASE = 'https://www.printgenie.com';
function category(rel, title) {
  const s = (rel + ' ' + title).toLowerCase();
  if (/kid|youth|toddler|baby|infant/.test(s)) return 'kids';
  if (/mug|cup/.test(s)) return 'drinkware';
  if (/bag|tote/.test(s)) return 'bags';
  if (/case|iphone|mobile/.test(s)) return 'phone';
  if (/hat|cap|beanie|mask/.test(s)) return 'accessories';
  return 'clothing';
}

async function collect(progress = () => {}) {
  const checkedAt = new Date().toISOString();
  const home = (await cachedGet('printgenie', BASE + '/products/kids/all-shirts')).text;
  const cats = [...new Set([...home.matchAll(/href="https:\/\/www\.printgenie\.com\/(products\/[a-z0-9-]+\/[a-z0-9-]+)"/g)].map(m => m[1]))];
  const products = new Map();
  let i = 0;
  for (const rel of cats) {
    progress(++i, cats.length);
    const page = await cachedGet('printgenie', `${BASE}/${rel}`).catch(() => ({ text: '' }));
    const form = page.text.match(/id="filterForm"[\s\S]*?<\/form>/)?.[0] || '';
    const field = n => form.match(new RegExp(`name="${n}" value="([^"]*)"`))?.[1];
    if (!field('slug') || !field('category_data_id')) continue;
    const q = new URLSearchParams({ extra: '1', slug: field('slug'), category_data_id: field('category_data_id'), filterNewestPopular: '0', ascending: '0', high_rated: '0', prefix: field('prefix') || 'products' });
    const r = await fetchText(`${BASE}/get-products-according-filter?${q}`, { headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' } });
    let htm = '';
    try { htm = JSON.parse(r.text).htm || ''; } catch { continue; }
    for (const m of htm.matchAll(/<a href="(https:\/\/www\.printgenie\.com\/product\/[^"]+)">([\s\S]*?)Pricing From \$([\d.,]+)/g)) {
      const [, url, inner, price] = m;
      const slug = url.split('/').pop();
      if (products.has(slug)) continue; // aynı ürün birden çok kategori yolunda görünebilir
      const title = decode(inner.match(/<h3>([^<]+)<\/h3>/)?.[1] || '').replace(/\s+/g, ' ').trim();
      if (!title) continue;
      const cat = category(rel, title);
      products.set(slug, {
        id: 'printgenie-' + slug, providerId: 'printgenie', sourceProductId: slug, family: 'printgenie-' + cat, category: cat,
        title, aliases: [], baseMinor: Math.round(Number(price.replace(/,/g, '')) * 100), currency: 'USD', imageUrl: inner.match(/<img src="([^"]+)"/)?.[1] || null, sourceUrl: url,
        sizes: 'Ölçü ve renkler üreticide seçilir', material: null,
        priceBasis: 'PrintGenie katalog "Pricing From" başlangıç fiyatı · baskının dahil olup olmadığı kaynakta belirtilmiyor · kargo ayrıca',
        shipping: null, deliveryDays: null, availableCountries: ['US'],
        checkedOn: checkedAt.slice(0, 10), checkedAt, sourceKind: 'catalog', importedBy: 'printgenie-filter-v1', priceVerified: true, priceVerification: 'public-catalog-page',
      });
    }
    await sleep(500);
  }
  const list = [...products.values()];
  fs.writeFileSync(path.resolve(__dirname, '../../data/printgenie-coverage.json'), JSON.stringify({ checkedAt, categories: cats.length, imported: list.length }, null, 2));
  if (list.length < 20) throw Error('PrintGenie: beklenenden az ürün (' + list.length + ')');
  return { products: list, pages: cats.length, reportedTotal: list.length, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect };
