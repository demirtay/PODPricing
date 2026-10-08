// Shirtigo (Almanya): katalog sayfasının kullandığı herkese açık JSON uç noktası
// (cockpit.shirtigo.com/api/catalog?page=N). baseprice_processing_default = varsayılan baskı yöntemiyle
// tek adet net fiyat (KDV ayrı, step_prices amount 1). Para birimi EUR → USD.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { fetchText } = require('./http.cjs');
const { record } = require('../public-connectors.cjs');
const { exchange } = require('../store-connectors.cjs');

const API = 'https://cockpit.shirtigo.com/api/catalog?locale=en&page=';

async function collect(progress = () => {}) {
  const checkedAt = new Date().toISOString();
  const products = [], skipped = [];
  let totalPages = 1, total = 0, raw = 0, fx;
  for (let page = 1; page <= totalPages; page++) {
    const d = JSON.parse((await fetchText(API + page, { headers: { Accept: 'application/json' } })).text);
    const pg = d.meta?.pagination;
    if (!pg?.total_pages || pg.current_page !== page) throw Error('Shirtigo sayfa doğrulanamadı');
    if (page === 1) { totalPages = pg.total_pages; total = pg.total; } else if (pg.total !== total) throw Error('Shirtigo katalog toplamı değişti');
    for (const p of d.data) {
      raw++;
      const bp = p.baseprice_processing_default;
      const one = (p.step_prices || []).find(s => Number(s.amount) === 1);
      if (!bp?.amount || bp.currency_factor !== 100 || !one) { skipped.push({ slug: p.slug, reason: 'Tek adet fiyatı yok' }); continue; }
      if (bp.currency_code !== 'EUR') throw Error('Shirtigo: beklenmeyen para birimi ' + bp.currency_code);
      const image = p.default_image?.medium || p.default_image?.small;
      if (!p.name || !image) { skipped.push({ slug: p.slug, reason: 'Başlık veya görsel yok' }); continue; }
      fx = fx || await exchange('EUR');
      const r = record('shirtigo', p.slug, p.name, bp.amount * fx.rate, image, 'https://cockpit.shirtigo.com/en/catalog/product/' + p.slug, null, p.material || null);
      r.sourceMinor = bp.amount; r.sourceCurrency = 'EUR'; r.exchangeRate = fx.rate; r.exchangeDate = fx.date;
      if (p.brand_product_name) r.aliases = [...new Set([...r.aliases, p.brand_product_name, p.brand_code].filter(Boolean))];
      r.priceBasis = `Shirtigo net taban fiyat · varsayılan baskı yöntemi, tek adet · %${bp.vat_rate?.amount ?? 19} KDV ve kargo hariç`;
      r.priceVerified = true; r.priceVerification = 'public-catalog-api';
      r.importedBy = 'shirtigo-api-v1'; r.checkedAt = checkedAt; r.checkedOn = checkedAt.slice(0, 10);
      if (!products.some(q => q.id === r.id)) products.push(r);
    }
    progress(page, totalPages);
  }
  if (raw !== total) throw Error(`Shirtigo: eksik kayıt (${raw}/${total})`);
  fs.writeFileSync(path.resolve(__dirname, '../../data/shirtigo-coverage.json'), JSON.stringify({ checkedAt, reportedTotal: total, imported: products.length, skipped }, null, 2));
  if (!products.length) throw Error('Shirtigo: ürün ayrıştırılamadı');
  return { products, pages: totalPages, reportedTotal: total, checkedOn: checkedAt.slice(0, 10) };
}

module.exports = { collect };
