// Bağlanamayan üreticilerin resmi adreslerini ve gerekçelerini katalogda günceller.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const f = path.resolve(__dirname, '../data/catalog.json');
const c = JSON.parse(fs.readFileSync(f, 'utf8'));
const HOMEPAGE = { gelato: 'https://www.gelato.com', customcat: 'https://customcat.com', sellfy: 'https://sellfy.com' };
const BLOCKED = 'Site otomatik erişimi engelliyor (bot koruması); güncel fiyatlar üreticinin sitesinde';
const LOGIN = 'Fiyatlar üye girişi veya uygulama içinde gösteriliyor';
const DEAD = 'Site şu an erişilemiyor (kapanmış veya taşınmış olabilir)';
const REASON = {
  gelato: BLOCKED, customcat: BLOCKED, artofwhere: BLOCKED, printedmint: BLOCKED, shop3d: BLOCKED, coastalreign: BLOCKED,
  gocustomclothing: BLOCKED, vistaprint: BLOCKED, through6: BLOCKED, shineon: LOGIN,
  tpop: LOGIN, sellfy: LOGIN, gooten: LOGIN, oneprint: 'Fiyatlar sayfada tarayıcıda oluşturuluyor; yalnızca birkaç ürün',
  printbelle: DEAD, bluedoba: DEAD, awkwardstyles: DEAD, districtphoto: DEAD, safsira: DEAD, thisnew: DEAD, snugglepartners: DEAD,
  printaura: 'Açık mağaza kataloğu boş', clothes2order: 'Fiyatlar adet kademeli; tek ürün fiyatı doğrulanmadı',
  // 2026-10-04 derin yoklama (scripts/probe-deep.cjs)
  artelo: 'Fiyatlar etkileşimli hesaplayıcıda; fiyat tablosu yayınlanmıyor',
  printsome: 'Toplu baskı firması; fiyatlar adet kademeli ve teklif bazlı',
  rushordertees: 'Toplu baskı firması; fiyatlar adet kademeli ve teklif bazlı', customink: 'Toplu baskı firması; fiyatlar adet kademeli ve teklif bazlı',
  swagify: 'Toplu promosyon ürünleri; minimum adetli', sunfrog: 'Tasarım pazaryeri; üretim maliyeti değil perakende fiyat gösteriyor',
  picthegift: 'Açık katalogda bütün fiyatlar 0,00; gerçek fiyat doğrulanamıyor', printbase: 'Katalog sayfasında yalnızca şablon fiyatlar var; gerçek fiyat doğrulanamıyor',
  printmelon: 'Açık katalog yalnızca kategori tanıtım kayıtları içeriyor', printshrimp: 'Açık katalogda yalnızca birkaç kayıt var',
  // 2026-10-05 ikinci inceleme
  apliiq: 'Tek ürün fiyatı sayfada hesaplanıyor; yalnızca toplu alım fiyatı görünüyor',
  woycondemand: 'Yayınlanan fiyatlar eski başlangıç fiyatı; nihai fiyat adede göre belirleniyor',
  teemill: 'Açık sitede perakende mağaza fiyatları var; üretim maliyeti üye panelinde',
  makr3d: 'Fiyatlar yalnızca örnek aralıklar; ürün bazlı fiyat yayınlanmıyor',
  ...Object.fromEntries(['hoplix', 'promio', 'framico', 'shirtly', 'casestation', 'makeplayingcards', 'mwwondemand', 'printgenie', 'subliminator',
    'scalablepress', 'printway', 'printeers', 'alexanders', 'printoteca', 'printbest', 'flexmerch', 'optondemand', 'completeful', 'marcofinearts',
    'dubowtextile', 'tshirtsons', 'myeasymonogram', 'camaloon', 'marketprint', 'toaddit', 'casestry', 'printseekers', 'duplium', 'ecomerch', 'printedsimply', 'cwondemand']
    .map(id => [id, 'Fiyatlar herkese açık sayfalarda yayınlanmıyor (üye girişi veya teklif ile)'])),
};
for (const p of c.providers) {
  if (HOMEPAGE[p.id] && p.connection?.state === 'pending') p.homepage = HOMEPAGE[p.id];
  if (REASON[p.id] && p.connection?.state === 'pending') { p.connection.blockedReason = REASON[p.id]; p.connection.auditCheckedAt = new Date().toISOString(); }
}
require('./catalog-import.cjs').validate(c);
fs.writeFileSync(f + '.tmp', JSON.stringify(c, null, 2)); fs.renameSync(f + '.tmp', f);
console.log('güncellendi');
