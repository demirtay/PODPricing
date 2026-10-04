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
  gocustomclothing: BLOCKED, vistaprint: BLOCKED, lumaprints: BLOCKED, shineon: BLOCKED, through6: BLOCKED,
  tpop: LOGIN, sellfy: LOGIN, gooten: LOGIN, oneprint: 'Fiyatlar sayfada tarayıcıda oluşturuluyor; yalnızca birkaç ürün',
  printbelle: DEAD, bluedoba: DEAD, awkwardstyles: DEAD, districtphoto: DEAD, safsira: DEAD, thisnew: DEAD, snugglepartners: DEAD,
  printaura: 'Açık mağaza kataloğu boş', clothes2order: 'Fiyatlar adet kademeli; tek ürün fiyatı doğrulanmadı',
};
for (const p of c.providers) {
  if (HOMEPAGE[p.id] && p.connection?.state === 'pending') p.homepage = HOMEPAGE[p.id];
  if (REASON[p.id] && p.connection?.state === 'pending') { p.connection.blockedReason = REASON[p.id]; p.connection.auditCheckedAt = new Date().toISOString(); }
}
require('./catalog-import.cjs').validate(c);
fs.writeFileSync(f + '.tmp', JSON.stringify(c, null, 2)); fs.renameSync(f + '.tmp', f);
console.log('güncellendi');
