// LumaPrints ikinci tur: ilk turda eşleşmeyen ürünler (window.__luma.miss) için daha sağlam eşleme.
// - alt kategori listesi dizi ya da iç içe nesne olabilir (Framed Canvas) -> düzleştirilir
// - ad eşlemesi kelime kümesiyle (sıra bağımsız; "semi-gloss" = "semi-glossy"; "print" ve ayraçlar yok sayılır)
// - ölçü eşlemesi ürün adının başındaki "WxH" ile (rulo kanvasın ürün ölçüsüne kenar payı ekli)
// - çerçeveli fine art: "Slim 0.875in" -> 0.875w Black Frame, "Wide 1.25in" -> 1.25w Black Frame (en sade siyah çerçeve)
// Liste: http://127.0.0.1:4180/luma-list.json; sonuç window.__luma.out'a eklenir.
async (page) => {
  const list = await (await page.context().request.get('http://127.0.0.1:4180/luma-list2.json')).json();
  return await page.evaluate((list) => {
    // tarayıcı yeniden açıldıysa: listedeki her ürün bu turda çalışır (liste = henüz sonucu olmayanlar)
    if (!window.__luma) window.__luma = { out: {}, miss: list.map(x => x[0]) };
    const DEST = {
      US: { country: 'US', statecode: 'NY', city: 'New York', postcode: '10001' },
      GB: { country: 'GB', statecode: '', city: 'London', postcode: 'SW1A 1AA' },
      EU: { country: 'DE', statecode: '', city: 'Berlin', postcode: '10115' },
      CA: { country: 'CA', statecode: 'ON', city: 'Toronto', postcode: 'M5V 2T6' },
      AU: { country: 'AU', statecode: 'NSW', city: 'Sydney', postcode: '2000' },
    };
    const toks = s => [...new Set(s.toLowerCase().replace(/semi-gloss(y)?/g, 'semiglossy').replace(/\d+(\.\d+)?/g, m => String(parseFloat(m)))
      .replace(/[()]/g, ' ').split(/[^a-z0-9.]+/).filter(w => w && !['print', 'prints', 'in'].includes(w)))].sort().join(' ');
    const flat = l => Array.isArray(l) ? l.flatMap(x => x && x.id ? [x] : flat(x)) : l && typeof l === 'object' ? Object.values(l).flatMap(flat) : [];
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const miss = new Set(window.__luma.miss);
    window.__luma2 = { done: 0, total: miss.size, miss: [] };
    (async () => {
      const subs = flat((await (await fetch('/wp-json/lumaprints-sc/v1/subcategories')).json()).map(c => c.list));
      const cache = {};
      for (const [id, title] of list) {
        if (!miss.has(id)) continue;
        try {
          const m = title.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*in\b/i);
          const base = m ? title.replace(m[0], '') : title;
          let sub = null;
          if (/slim 0\.875in frame/i.test(title)) sub = subs.find(s => s.id === 105001);
          else if (/wide 1\.25in frame/i.test(title)) sub = subs.find(s => s.id === 105005);
          else sub = subs.find(s => toks(s.name) === toks(base));
          if (!m || !sub) { window.__luma2.miss.push(id); window.__luma2.done++; continue; }
          const items = cache[sub.id] || (cache[sub.id] = await (await fetch('/wp-json/lumaprints-sc/v1/subcategories/' + sub.id + '/products')).json());
          const a = +m[1], b = +m[2];
          const e = items.find(x => new RegExp('^(' + a + 'x' + b + '|' + b + 'x' + a + ')\\b').test(x.name));
          if (!e) { window.__luma2.miss.push(id); window.__luma2.done++; continue; }
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
        } catch (err) { window.__luma2.miss.push(id + ' ' + err.message); }
        window.__luma2.done++;
      }
      window.__luma2.finished = true;
    })();
    return 'started ' + miss.size;
  }, list);
}
