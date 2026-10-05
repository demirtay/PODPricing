// IndexNow bildirimi: site haritasındaki adresleri Bing/Yandex/Seznam'a tek istekte bildirir (en çok 10.000 adres/istek).
// Kullanım: node scripts/indexnow.cjs [--all]   (varsayılan: ana sayfalar + karşılaştırma ve kategori sayfaları; --all: bütün site haritası)
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'site.config.json'), 'utf8'));
const SITE = cfg.siteUrl.replace(/\/$/, ''), host = new URL(SITE).hostname, key = cfg.indexNowKey;
if (!key) { console.log('indexNowKey yok, atlandı'); process.exit(0); }

const all = process.argv.includes('--all');
const urls = [];
for (const f of fs.readdirSync(path.join(root, 'site')).filter(f => /^sitemap-\d+\.xml$/.test(f))) {
  for (const m of fs.readFileSync(path.join(root, 'site', f), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)) urls.push(m[1].replace(/&amp;/g, '&'));
}
// günlük bildirimde fiyatı değişen asıl sayfalar: ürün tekil sayfaları hariç
const list = all ? urls : urls.filter(u => !/\/product\//.test(u));

(async () => {
  let sent = 0;
  for (let i = 0; i < list.length; i += 10000) {
    const urlList = list.slice(i, i + 10000);
    const r = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation: `${SITE}/${key}.txt`, urlList }),
    });
    console.log(`IndexNow: ${urlList.length} adres → HTTP ${r.status}`);
    if (r.status >= 400) { console.log(await r.text()); process.exitCode = 0; break; }
    sent += urlList.length;
  }
  console.log(`IndexNow: toplam ${sent} adres bildirildi`);
})().catch(e => console.log('IndexNow hatası (yayını etkilemez):', e.message));
