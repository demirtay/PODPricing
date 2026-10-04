// Sayfa sayfa gezilen kaynaklar için nazik HTTP yardımcıları:
// disk önbelleği (varsayılan 24 saat), sınırlı eşzamanlılık, istekler arası bekleme, yeniden deneme.
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const CACHE = path.resolve(__dirname, '../../data/source-cache');
const UA = 'Mozilla/5.0 (compatible; POD-Atlas/1.0; fiyat karsilastirma)';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchText(url, { headers = {}, timeout = 30000 } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, redirect: 'follow', signal: AbortSignal.timeout(timeout) });
      if (r.status === 429 && attempt < 4) { await sleep(20000 * attempt); continue; }
      if (r.status === 404 || r.status === 410) return { status: r.status, text: '' };
      if (!r.ok) throw Error('HTTP ' + r.status + ' ' + url);
      return { status: r.status, text: await r.text(), url: r.url };
    } catch (e) { if (attempt >= 3) throw e; await sleep(3000 * attempt); }
  }
}

// Önbellekli GET. provider: önbellek alt klasörü.
async function cachedGet(provider, url, { ttlHours = 24, ...opts } = {}) {
  const dir = path.join(CACHE, provider);
  const file = path.join(dir, crypto.createHash('sha1').update(url).digest('hex') + '.html');
  if (fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < ttlHours * 3600e3) return { status: 200, text: fs.readFileSync(file, 'utf8'), cached: true };
  const res = await fetchText(url, opts);
  if (res.status === 200) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, res.text); }
  return res;
}

// Listeyi sınırlı eşzamanlılıkla işler; önbellekten gelmeyen her istekten sonra bekler.
async function crawl(items, worker, { concurrency = 2, delayMs = 800, progress = () => {} } = {}) {
  const out = new Array(items.length);
  let next = 0, done = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < items.length) {
      const i = next++;
      const t = Date.now();
      out[i] = await worker(items[i], i);
      done++;
      if (done % 25 === 0) progress(done, items.length);
      if (!out[i]?.cached && Date.now() - t > 5) await sleep(delayMs);
    }
  }));
  return out;
}

const locs = xml => [...String(xml).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1].replace(/&amp;/g, '&'));
const decode = s => String(s ?? '').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const meta = (html, prop) => decode((html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)`, 'i')) || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i')) || [])[1]);

function jsonLd(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { const d = JSON.parse(m[1].trim()); for (const x of [].concat(d['@graph'] || d)) out.push(x); } catch { /* bozuk JSON-LD */ }
  }
  return out;
}

module.exports = { UA, sleep, fetchText, cachedGet, crawl, locs, decode, meta, jsonLd };
