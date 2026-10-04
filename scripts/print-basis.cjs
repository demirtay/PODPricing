// Teklifin fiyat türü: baskı dahil mi, boş ürün mü, toplu sipariş mi?
// Üretici düzeyindeki kararlar 2026-10-04 canlı sayfa denetimine dayanır (data/live-price-audit.json):
// sayfadaki "one print included", "plain ... base price", "add blank to cart", "minimum order" vb. ifadeler.
'use strict';

// Fiyatı tek baskı/tasarım dahil üretim maliyeti olanlar
const PRINTED = new Set([
  'printify', 'printful', 'dreamship', 'simpleprint', 'gearlaunch', 'prodigi', 'podpartner', 'yoycol', 'inkedjoy',
  'interestprint', 'artsadd', 'peaprint', 'printdoors', 'kincustom', 'merchize', 'burgerprints', 'gearment', 'teelaunch',
  'printy6', 'printkk', 'jetprint', 'papello', 'inkthreadable', 'twofifteen', 'tshirtgang', 'printegy', 'podbase',
  'rakiline', 'treatpod', 'popcustoms', 'aop', 'merchone', 'contrado', 'neatopod', 'pillowprofits', 'getfuelpod', 'printops', 'lumaprints', 'finerworks', 'sellfy', 'ownprint',
]);
// Fiyatı baskısız (boş) ürün bedeli olanlar
const BLANK = new Set(['tapstitch', 'printrove', 'ogo']);
// Minimum adetli toplu baskı firmaları
const BULK = new Set(['blackfishclothing']);

const LABEL = { dahil: 'Baskı dahil', bos: 'Boş ürün', toplu: 'Toplu sipariş', belirsiz: 'Koşullar üreticide' };
const NOTE = {
  dahil: 'Fiyat tek baskı alanı/tasarım dahil üretim maliyetidir.',
  bos: 'Fiyat baskısız (boş) ürün içindir; baskı ücreti ayrıca eklenir.',
  toplu: 'Toplu baskı fiyatıdır; minimum sipariş adedi vardır.',
  belirsiz: 'Kaynak, fiyatın baskıyı içerip içermediğini açıkça belirtmiyor; üreticinin sayfasında kontrol edin.',
};

function printBasis(p) {
  const basis = String(p.priceBasis || '');
  if (p.includesPrint === false || /baskısız|boş ürün bedeli/i.test(basis)) return 'bos';
  if (/baskı dahil/i.test(basis)) return 'dahil';
  if (/\bblank\b/i.test(p.title) && !/blanket/i.test(p.title)) return 'bos';
  if (p.minimumQuantity > 1 || BULK.has(p.providerId)) return 'toplu';
  if (BLANK.has(p.providerId)) return 'bos';
  if (PRINTED.has(p.providerId)) return 'dahil';
  return 'belirsiz';
}

const LABEL_EN = { dahil: 'Print included', bos: 'Blank', toplu: 'Bulk order', belirsiz: 'Terms at source' };
const NOTE_EN = {
  dahil: 'Production cost with one print area/design included.',
  bos: 'Price for the blank (unprinted) product; printing is charged separately.',
  toplu: 'Bulk printing price with a minimum order quantity.',
  belirsiz: 'The source does not state whether printing is included; check the manufacturer page.',
};

module.exports = { printBasis, LABEL, NOTE, LABEL_EN, NOTE_EN };
