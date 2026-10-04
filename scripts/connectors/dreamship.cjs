// Dreamship: dreamship.com/products sayfasına gömülü katalog verisi (sitemap'teki ürünlerin tamamı).
// Basic plan başlangıç maliyeti, Plus plan maliyeti ve ABD ekonomik kargo başlangıç ücreti alınır.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { record } = require('../public-connectors.cjs');
const { findObjects } = require('./next-rsc.cjs');

const UA = 'Mozilla/5.0 (compatible; POD-Atlas/1.0; fiyat karsilastirma)';
const cents = v => Math.round(Number(v) * 100);

async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(45000) });
  if (!r.ok) throw Error('Dreamship HTTP ' + r.status + ' ' + url);
  return r.text();
}

function normalize(o, checkedAt) {
  const img = (o.display_images || []).find(i => i.public_primary) || (o.display_images || [])[0];
  const r = record('dreamship', o.id, o.name, cents(o.starting_basic_cost), img?.file, `https://dreamship.com/products/${o.slug}`,
    (o.sizes || []).map(s => s.name).join(' / ') || 'Tek ölçü');
  const brand = typeof o.brand === 'string' && o.brand.length < 60 ? o.brand.replace(/\s*or equivalent\s*/i, '').replace(/®|™/g, '').trim() : '';
  if (brand) r.aliases = [...new Set([...r.aliases, brand])];
  r.priceBasis = 'Dreamship Basic plan başlangıç maliyeti · baskı dahil, kargo ve vergi hariç'
    + (o.starting_ship_cost ? ` · ${o.starting_ship_method || 'kargo'} ${o.starting_ship_cost} USD'den` : '');
  const plus = cents(o.starting_plus_cost);
  r.subscriptionMinor = plus > 0 && plus < r.baseMinor ? plus : null;
  if (o.starting_ship_cost && /^US/i.test(o.starting_ship_method || '')) r.shipping = { US: cents(o.starting_ship_cost) };
  r.decorationMethods = o.decoration_type_display ? [o.decoration_type_display] : [];
  r.production = o.production_days_min ? `Üretim: ${o.production_days_min}–${o.production_days_max} iş günü` : null;
  r.availableCountries = ['US', ...(o.europe_item ? ['EU'] : []), ...(o.uk_item ? ['UK'] : [])];
  r.material = null;
  r.sourceKind = 'catalog';
  r.priceVerified = true;
  r.priceVerification = 'public-catalog-page-data';
  r.importedBy = 'dreamship-catalog-v1';
  r.checkedAt = checkedAt; r.checkedOn = checkedAt.slice(0, 10);
  return r;
}

async function collect() {
  const checkedAt = new Date().toISOString();
  const [html, sitemap] = await Promise.all([get('https://dreamship.com/products'), get('https://dreamship.com/sitemap.xml')]);
  const objs = findObjects(html, o => 'starting_basic_cost' in o && o.slug);
  const bySlug = new Map(objs.map(o => [o.slug, o]));
  const listed = [...sitemap.matchAll(/https:\/\/dreamship\.com\/products\/([^<\s]+)/g)].map(m => m[1]).filter(s => !s.startsWith('category/'));
  const missing = listed.filter(s => !bySlug.has(s));
  if (!objs.length) throw Error('Dreamship katalog verisi bulunamadı');
  const products = [], skipped = missing.map(slug => ({ slug, reason: 'Site haritasında var, katalog sayfasında yok' }));
  for (const o of bySlug.values()) {
    const img = (o.display_images || [])[0];
    if (!(Number(o.starting_basic_cost) > 0)) { skipped.push({ slug: o.slug, reason: 'Fiyat yok' }); continue; }
    if (!img) { skipped.push({ slug: o.slug, reason: 'Görsel yok' }); continue; }
    products.push(normalize(o, checkedAt));
  }
  fs.writeFileSync(path.resolve(__dirname, '../../data/dreamship-coverage.json'), JSON.stringify({
    checkedAt, catalogObjects: bySlug.size, sitemapProducts: listed.length, imported: products.length, skipped,
  }, null, 2));
  return { products, pages: 1, reportedTotal: listed.length, checkedOn: checkedAt.slice(0, 10), ...(missing.length ? { coverage: 'catalog-page-partial' } : {}) };
}

module.exports = { collect, normalize };
