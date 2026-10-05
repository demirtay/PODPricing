// Bütün otomatik katalogları bir kez yeniler ve çıkar (zamanlanmış bulut görevi için).
// Başarısız kaynakta eski kayıtlar korunur. Kullanım: node scripts/refresh-once.cjs [id ...]
// REFRESH_BUDGET_MIN: bu süre dolunca yeni kaynağa başlanmaz (iş akışı zaman aşımına düşüp hiçbir şey kaydedilmeden iptal olmasın).
// Kaynaklar en uzun süredir yenilenmeyenden başlayarak sıralanır; süre yetmezse kalanlar sonraki çalışmada önce gelir.
'use strict';
const manager = require('./refresh-catalogs.cjs');
const PER_SOURCE_MIN = 25;

async function main() {
  const budget = Number(process.env.REFRESH_BUDGET_MIN || 0) * 60e3, start = Date.now();
  // son başarılı yenileme: katalogdaki kayıtların en yeni kontrol zamanı (kaydı olmayan kaynak en başa)
  const lastSeen = {};
  for (const p of JSON.parse(require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../data/catalog.json'), 'utf8')).products) {
    const t = p.checkedAt || p.checkedOn || '';
    if (t > (lastSeen[p.providerId] || '')) lastSeen[p.providerId] = t;
  }
  const last = id => lastSeen[id] || '';
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(manager.definitions).sort((a, b) => String(last(a)).localeCompare(String(last(b))));
  const done = [];
  // catalog.json her kaynaktan sonra yeniden okunup yazıldığı için sırayla çalıştırılır.
  for (const id of ids) {
    if (budget && Date.now() - start > budget) { console.log(`Süre doldu (${process.env.REFRESH_BUDGET_MIN} dk); kalan ${ids.length - done.length} kaynak sonraki çalışmada.`); break; }
    const t = Date.now();
    let timer;
    const timeout = new Promise(res => { timer = setTimeout(() => res('timeout'), PER_SOURCE_MIN * 60e3); });
    const r = await Promise.race([manager.refresh(id).then(() => 'ok', e => 'error: ' + e.message), timeout]);
    clearTimeout(timer);
    done.push(id);
    const s = manager.status.platforms[id] || {};
    console.log(`${id.padEnd(20)} ${r === 'timeout' ? 'SÜRE AŞIMI' : String(s.state).padEnd(6)} ${String(s.productCount).padStart(5)} ürün  ${Math.round((Date.now() - t) / 1000)} sn${s.lastError ? '  HATA: ' + s.lastError : ''}`);
  }
  const failed = done.filter(id => manager.status.platforms[id]?.state === 'error');
  console.log(`\n${done.length - failed.length}/${ids.length} kaynak yenilendi${failed.length ? '; hatalı: ' + failed.join(', ') : ''}`);
}
main().then(() => process.exit(0), e => { console.error(e); process.exit(1); });
