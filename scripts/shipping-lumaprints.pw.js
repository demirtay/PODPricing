// LumaPrints: fiyat sayfasındaki kargo hesaplayıcısının servisi (/wp-json/lumaprints-sc/v1/shipping/get-rates).
// Site bot koruması arkasında olduğu için tarayıcıda (Playwright, lumaprints.com/pricing/ açıkken) çalışır:
// browser_run_code_unsafe ile bu dosya; liste http://127.0.0.1:4180/luma-list.json ([[ürünId, başlık]]; %TEMP% klasörü python -m http.server 4180 ile), sonuç window.__luma.
// Örnek adresler (gerçek taşıyıcı teklifi): ABD New York 10001, İngiltere Londra SW1A 1AA, Almanya Berlin 10115,
// Kanada Toronto M5V 2T6, Avustralya Sydney 2000. Çıkış: Anaheim, Kaliforniya (ABD). En ucuz kargo yöntemi alınır (mağazadan teslim hariç).
async (page) => {
  const list = await (await page.context().request.get('http://127.0.0.1:4180/luma-list.json')).json();
  return await page.evaluate((list) => {
    const DEST = {
      US: { country: 'US', statecode: 'NY', city: 'New York', postcode: '10001' },
      GB: { country: 'GB', statecode: '', city: 'London', postcode: 'SW1A 1AA' },
      EU: { country: 'DE', statecode: '', city: 'Berlin', postcode: '10115' },
      CA: { country: 'CA', statecode: 'ON', city: 'Toronto', postcode: 'M5V 2T6' },
      AU: { country: 'AU', statecode: 'NSW', city: 'Sydney', postcode: '2000' },
    };
    const norm = s => s.toLowerCase().replace(/\bprints?\b/g, '').replace(/\d+(\.\d+)?/g, m => String(parseFloat(m))).replace(/[^a-z0-9.]+/g, ' ').trim();
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    window.__luma = { done: 0, total: list.length, out: {}, miss: [] };
    (async () => {
      const subs = (await (await fetch('/wp-json/lumaprints-sc/v1/subcategories')).json()).flatMap(c => c.list);
      const cache = {};
      for (const [id, title] of list) {
        try {
          const m = title.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*in\b/i);
          const sub = m && subs.find(s => norm(title.replace(m[0], '')) === norm(s.name));
          if (!sub) { window.__luma.miss.push(id); continue; }
          const items = cache[sub.id] || (cache[sub.id] = await (await fetch('/wp-json/lumaprints-sc/v1/subcategories/' + sub.id + '/products')).json());
          const a = +m[1], b = +m[2];
          const e = items.find(x => (x.product_width === a && x.product_length === b) || (x.product_width === b && x.product_length === a));
          if (!e) { window.__luma.miss.push(id); continue; }
          const rec = {};
          for (const [k, recipient] of Object.entries(DEST)) {
            await sleep(900);
            const body = { recipient, product: [{ subcategory_id: String(sub.id), quantity: 1, mat_size: null, is_ffap: false, frame_height: null, frame_width: null, size: { height: e.product_height, length: e.print_face_length, width: e.print_face_width, weight: e.product_weight } }] };
            const r = await (await fetch('/wp-json/lumaprints-sc/v1/shipping/get-rates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
            if (!r || r.hasError || !r.result) continue;
            const opts = Object.entries(r.result).filter(([c]) => c !== 'Pickup').flatMap(([c, l]) => l.map(o => [c + ' ' + o.title, Math.round(o.price * 100)])).filter(o => o[1] > 0);
            if (opts.length) { opts.sort((x, y) => x[1] - y[1]); rec[k] = [[opts[0][0], opts[0][1], 'US']]; }
          }
          window.__luma.out[id] = rec;
        } catch (err) { window.__luma.miss.push(id); }
        window.__luma.done++;
      }
      window.__luma.finished = true;
    })();
    return 'started ' + list.length;
  }, list);
}
