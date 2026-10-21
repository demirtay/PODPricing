// LumaPrints üçüncü tur: ikinci turun eşlemesi; 2 kol + 429 (çok fazla istek) yanıtında 30 sn bekleyip yeniden deneme.
// Liste: http://127.0.0.1:4180/luma-list2.json (henüz sonucu olmayanlar); sonuç window.__luma.out, ilerleme window.__luma3.
// LumaPrints hesaplayıcısında 0.75in / 1.25in Framed Canvas yok (yalnız 1.50in) -> listeye konmaz.
async (page) => {
  const list = await (await page.context().request.get('http://127.0.0.1:4180/luma-list2.json')).json();
  return await page.evaluate((list) => {
    window.__luma = window.__luma || { out: {} };
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
    const queue = list.filter(([id]) => !window.__luma.out[id]);
    window.__luma3 = { done: 0, total: queue.length, miss: [], running: 2 };
    const cache = {};
    let subsP = null;
    const subsOf = () => subsP || (subsP = fetch('/wp-json/lumaprints-sc/v1/subcategories').then(r => r.json()).then(c => flat(c.map(x => x.list))));
    const itemsOf = id => cache[id] || (cache[id] = fetch('/wp-json/lumaprints-sc/v1/subcategories/' + id + '/products').then(r => r.json()));
    async function one(id, title) {
      const subs = await subsOf();
      const m = title.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*in\b/i);
      const base = m ? title.replace(m[0], '') : title;
      let sub = null;
      if (/slim 0\.875in frame/i.test(title)) sub = subs.find(s => s.id === 105001);
      else if (/wide 1\.25in frame/i.test(title)) sub = subs.find(s => s.id === 105005);
      else sub = subs.find(s => toks(s.name) === toks(base));
      if (!m || !sub) return window.__luma3.miss.push(id + ' (eşleşme yok)');
      const items = await itemsOf(sub.id);
      const a = +m[1], b = +m[2];
      const e = items.find(x => new RegExp('^(' + a + 'x' + b + '|' + b + 'x' + a + ')\\b').test(x.name));
      if (!e) return window.__luma3.miss.push(id + ' (ölçü yok)');
      const rec = {};
      for (const [k, recipient] of Object.entries(DEST)) {
        await sleep(900);
        const body = { recipient, product: [{ subcategory_id: String(sub.id), quantity: 1, mat_size: null, is_ffap: false, frame_height: null, frame_width: null, size: { height: e.product_height, length: e.print_face_length, width: e.print_face_width, weight: e.product_weight } }] };
        // 429 (çok fazla istek): bekleyip yeniden dene; boş sonuç kaydedilmez
        let res;
        for (let t = 0; t < 5; t++) {
          res = await fetch('/wp-json/lumaprints-sc/v1/shipping/get-rates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          if (res.status !== 429) break;
          window.__luma3.waits = (window.__luma3.waits || 0) + 1;
          await sleep(30000);
        }
        if (res.status === 429) throw Error('429');
        const r = await res.json();
        if (!r || r.hasError || !r.result) continue;
        const opts = Object.entries(r.result).filter(([c]) => c !== 'Pickup').flatMap(([c, l]) => l.map(o => [c + ' ' + o.title, Math.round(o.price * 100)])).filter(o => o[1] > 0);
        if (opts.length) { opts.sort((x, y) => x[1] - y[1]); rec[k] = [[opts[0][0], opts[0][1], 'US']]; }
      }
      if (Object.keys(rec).length) window.__luma.out[id] = rec; else window.__luma3.miss.push(id + " (kargo yok)");
    }
    for (let w = 0; w < 2; w++) (async () => {
      while (queue.length) {
        const [id, title] = queue.shift();
        try { await one(id, title); } catch (err) { window.__luma3.miss.push(id + ' ' + err.message); }
        window.__luma3.done++;
      }
      window.__luma3.running--;
    })();
    return 'started ' + queue.length;
  }, list);
}
