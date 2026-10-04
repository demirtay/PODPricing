// Bütün otomatik katalogları bir kez yeniler ve çıkar (zamanlanmış bulut görevi için).
// Başarısız kaynakta eski kayıtlar korunur. Kullanım: node scripts/refresh-once.cjs [id ...]
'use strict';
const manager = require('./refresh-catalogs.cjs');

async function main() {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(manager.definitions);
  // catalog.json her kaynaktan sonra yeniden okunup yazıldığı için sırayla çalıştırılır.
  for (const id of ids) {
    const t = Date.now();
    await manager.refresh(id);
    const s = manager.status.platforms[id];
    console.log(`${id.padEnd(20)} ${s.state.padEnd(6)} ${String(s.productCount).padStart(5)} ürün  ${Math.round((Date.now() - t) / 1000)} sn${s.lastError ? '  HATA: ' + s.lastError : ''}`);
  }
  const failed = ids.filter(id => manager.status.platforms[id].state === 'error');
  console.log(`\n${ids.length - failed.length}/${ids.length} kaynak yenilendi${failed.length ? '; hatalı: ' + failed.join(', ') : ''}`);
}
main().then(() => process.exit(0), e => { console.error(e); process.exit(1); });
