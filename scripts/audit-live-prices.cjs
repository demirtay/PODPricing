// Canlı fiyat denetimi: her üreticiden örnek ürünlerin kaynak sayfasını açar, fiyatı
// bağımsız yöntemlerle (Shopify .js, Woo Store API, JSON-LD, meta, görünen tutarlar) okur ve
// katalogdaki kayıtla karşılaştırır. Baskı dahil/boş ürün ipuçlarını da toplar.
// Kullanım: node scripts/audit-live-prices.cjs [--n 6] [id ...]  → data/live-price-audit.json
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const c = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8'));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const args = process.argv.slice(2);
const N = args.includes('--n') ? Number(args[args.indexOf('--n') + 1]) : 6;
const only = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--n');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url, json) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: json ? 'application/json' : 'text/html' }, signal: AbortSignal.timeout(25000) });
    if (!r.ok) return { status: r.status };
    return { status: r.status, body: json ? await r.json().catch(() => null) : await r.text() };
  } catch (e) { return { status: 0, error: e.name }; }
}

const toMinor = v => { const n = Number(String(v).replace(/[^0-9.]/g, '')); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null; };

function ldPrices(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let d; try { d = JSON.parse(m[1].trim()); } catch { continue; }
    const walk = o => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk);
      for (const k of ['price', 'lowPrice']) if (o[k] != null && (o.priceCurrency || o['@type']?.includes?.('Offer'))) { const v = toMinor(o[k]); if (v) out.push({ v, cur: o.priceCurrency }); }
      for (const k in o) walk(o[k]); };
    walk(d);
  }
  return out;
}

const HINTS = /(blank|unprinted|without print|print(ing)? (is )?included|includes? (one|1|front) print|price includes|plus print|\+ ?print|print(ing)? (cost|fee|price)s? (are )?(added|extra|separately)|base price|garment (only|price)|starting at|from \$|per unit|minimum order|moq|bulk)/gi;

function hints(html) {
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const out = new Set();
  for (const m of text.matchAll(HINTS)) { out.add(text.slice(Math.max(0, m.index - 60), m.index + 80).trim()); if (out.size >= 4) break; }
  return [...out];
}

async function live(p) {
  const res = { id: p.id, title: p.title.slice(0, 70), stored: p.sourceMinor ?? p.baseMinor, storedCur: p.sourceCurrency || 'USD', url: p.sourceUrl };
  const u = new URL(p.sourceUrl);
  // Shopify: ürün .js ve seçili varyant
  if (/\/products\/[^/]+/.test(u.pathname) && u.searchParams.get('variant')) {
    const js = await get(u.origin + u.pathname.replace(/\/$/, '') + '.js', true);
    if (js.body?.variants) {
      const v = js.body.variants.find(x => String(x.id) === u.searchParams.get('variant'));
      res.method = 'shopify-variant';
      res.live = v ? v.price : null;
      res.liveAvailable = v ? v.available : null;
      res.liveMin = Math.min(...js.body.variants.filter(x => x.available).map(x => x.price));
    }
  }
  const page = await get(p.sourceUrl);
  res.httpStatus = page.status;
  if (page.body) {
    const ld = ldPrices(page.body);
    if (!res.method && ld.length) { res.method = 'json-ld'; res.live = Math.min(...ld.map(x => x.v)); res.liveCur = ld[0].cur; }
    const og = page.body.match(/product:price:amount"\s+content="([\d.,]+)"/);
    if (!res.method && og) { res.method = 'og-price'; res.live = toMinor(og[1]); }
    const visible = [...new Set((page.body.replace(/<script[\s\S]*?<\/script>/gi, ' ').match(/[$£€₹]\s?\d{1,4}(?:[.,]\d{2})/g) || []))].slice(0, 6);
    res.visible = visible;
    if (!res.method && visible.length) { res.method = 'visible-any'; res.liveCandidates = visible.map(toMinor); }
    res.hints = hints(page.body);
  }
  if (res.live != null) res.match = Math.abs(res.live - res.stored) <= 1;
  else if (res.liveCandidates) res.match = res.liveCandidates.some(v => Math.abs(v - res.stored) <= 1) ? 'visible' : false;
  else res.match = null;
  return res;
}

(async () => {
  const byProv = {};
  for (const p of c.products) (byProv[p.providerId] = byProv[p.providerId] || []).push(p);
  const ids = Object.keys(byProv).filter(id => !only.length || only.includes(id));
  const report = {};
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < ids.length) {
      const id = ids[next++];
      const list = byProv[id];
      // deterministik örnek: listeye eşit aralıklarla yayılmış N ürün
      const sample = Array.from({ length: Math.min(N, list.length) }, (_, i) => list[Math.floor(i * list.length / Math.min(N, list.length))]);
      const rows = [];
      for (const p of sample) { rows.push(await live(p)); await sleep(900); }
      const checked = rows.filter(r => r.match !== null);
      report[id] = { sampled: rows.length, comparable: checked.length, exact: rows.filter(r => r.match === true).length, visibleOnly: rows.filter(r => r.match === 'visible').length, mismatch: rows.filter(r => r.match === false).length, rows };
      const s = report[id];
      console.log(`${id.padEnd(18)} örnek ${s.sampled}  karşılaştırılabilen ${s.comparable}  tam ${s.exact}  görünen ${s.visibleOnly}  UYUŞMAZ ${s.mismatch}`);
    }
  }));
  fs.writeFileSync(path.join(root, 'data/live-price-audit.json'), JSON.stringify({ checkedAt: new Date().toISOString(), perProvider: N, report }, null, 2));
})();
