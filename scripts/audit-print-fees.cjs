// "Baskı dahil" varsayımını doğrular: her üreticiden örnek ürün sayfalarında ayrı baskı ücreti
// (decoration/print fee, per placement, print cost) ifadelerini arar.
// Kullanım: node scripts/audit-print-fees.cjs [--n 3] [id ...]
'use strict';
const fs = require('node:fs'), path = require('node:path');
const PB = require('./print-basis.cjs');
const c = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/catalog.json'), 'utf8'));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const args = process.argv.slice(2), N = args.includes('--n') ? +args[args.indexOf('--n') + 1] : 3;
const only = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--n');
const FEE = /(decoration fee|print(ing)? fee|print(ing)? (cost|price|charge)s?|per (placement|print|side|location)|additional (print|side|placement|location)|extra (print|side)|back print|second (side|print)|print (area|side) (fee|price)|plus printing|printing (is )?(not )?included|price includes|includes? (front|one|1) (side|print)|blank price|garment only|one print included)/gi;

(async () => {
  const by = {};
  for (const p of c.products) if (PB.printBasis(p) === 'dahil') (by[p.providerId] = by[p.providerId] || []).push(p);
  for (const id of Object.keys(by).filter(id => !only.length || only.includes(id))) {
    const list = by[id], out = new Set();
    for (let i = 0; i < Math.min(N, list.length); i++) {
      const p = list[Math.floor(i * list.length / Math.min(N, list.length))];
      try {
        const r = await fetch(p.sourceUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000) });
        const raw = await r.text();
        const json = [...raw.matchAll(/"(decorationFee|printFee|printPrice|printingFee|placementFee|extraPrintPrice)"\s*:\s*[^,}]{1,40}/gi)].map(m => m[0]);
        const text = raw.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        for (const m of text.matchAll(FEE)) out.add('… ' + text.slice(Math.max(0, m.index - 70), m.index + 90).trim());
        for (const j of json) out.add('[veri] ' + j);
      } catch (e) { out.add('HATA ' + e.name); }
      await new Promise(r => setTimeout(r, 900));
    }
    console.log(`## ${id} (${list.length})`);
    for (const x of [...out].slice(0, 5)) console.log('   ' + x.slice(0, 200));
  }
})();
