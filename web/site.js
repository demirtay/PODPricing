(function () {
  'use strict';
  var PAGE = 48;
  var LANG = document.body.getAttribute('data-lang') || 'en';
  var nf = new Intl.NumberFormat(LANG === 'tr' ? 'tr-TR' : 'en-US', { style: 'currency', currency: 'USD' });
  var num = function (n) { return n.toLocaleString(LANG === 'tr' ? 'tr-TR' : 'en-US'); };
  var money = function (m) { return nf.format(m / 100); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var norm = function (s) { return String(s).toLocaleLowerCase(LANG).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/[^a-z0-9+]+/g, ' ').trim(); };
  var metaP = null;
  function meta() { return metaP || (metaP = fetch('/data/meta-' + LANG + '.json').then(function (r) { return r.json(); })); }
  // Türkçe arama terimleri -> başlıklardaki İngilizce karşılıkları (İngilizce aramada da zararsız)
  var SYN = { tisort: 't shirt tee tshirt', kapusonlu: 'hoodie', hoodi: 'hoodie', sweat: 'sweatshirt', kupa: 'mug', bardak: 'cup glass tumbler', termos: 'tumbler', matara: 'bottle', canta: 'bag', 'bez canta': 'tote', 'sirt cantasi': 'backpack', sapka: 'cap hat', bere: 'beanie', kilif: 'case', telefon: 'phone', yastik: 'pillow cushion', battaniye: 'blanket', tablo: 'canvas', kanvas: 'canvas', etiket: 'sticker label', defter: 'notebook journal', corap: 'socks', elbise: 'dress', sort: 'shorts', pantolon: 'pants', tayt: 'leggings', mayo: 'swimsuit swim bikini', pijama: 'pajama', havlu: 'towel', perde: 'curtain', hali: 'rug mat', bayrak: 'flag', yapboz: 'puzzle', cocuk: 'kids youth', bebek: 'baby', kopek: 'dog pet', kedi: 'cat pet', onluk: 'apron', anahtarlik: 'keychain', cuzdan: 'wallet', kolye: 'necklace', kupe: 'earrings', bileklik: 'bracelet', saat: 'clock watch', mum: 'candle', ceket: 'jacket', atlet: 'tank', 'uzun kollu': 'long sleeve', tee: 't shirt tee tshirt', tshirt: 't shirt tee tshirt', 't shirt': 't shirt tee tshirt' };
  function expand(q) {
    var n = norm(q), groups = [];
    Object.keys(SYN).forEach(function (k) { if ((' ' + n + ' ').indexOf(' ' + k + ' ') !== -1) { n = (' ' + n + ' ').replace(' ' + k + ' ', ' ').trim(); groups.push([k].concat(SYN[k].split(' '))); } });
    n.split(' ').filter(Boolean).forEach(function (t) { groups.push([t]); });
    return groups;
  }
  function matches(h, groups) { h = ' ' + norm(h) + ' '; return groups.every(function (g) { return g.some(function (t) { return h.indexOf(t.length < 4 ? ' ' + t : t) !== -1; }); }); }

  function badge(pb, M) { return pb ? '<span class="pb pb-' + esc(pb) + '" title="' + esc((M.pbNote || {})[pb] || '') + '">' + esc((M.pb || {})[pb] || pb) + '</span>' : ''; }
  function imgHtml(src) { return src ? '<img src="' + esc(src) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span class="noimg"></span>'; }
  // r: [id, başlık, üretici, fiyat, -, görsel, -, tip, satışLinki, fiyatTürü]
  function card(r, M) {
    return '<a class="card" href="' + M.paths.product + esc(r[0]) + '/"><div class="ci">' + imgHtml(r[5]) + '</div><div class="cb"><div class="ct">' + esc(r[1]) + '</div><div class="cm">' + esc(M.providers[r[2]] || r[2]) + '</div><div class="cp"><b>' + money(r[3]) + '</b>' + badge(r[9], M) + '</div></div></a>';
  }
  // g: [slug, ad, görsel, en düşük fiyat, üretici sayısı, tip]
  function gcard(g, M) {
    return '<a class="card" href="' + M.paths.group + esc(g[0]) + '/"><div class="ci">' + imgHtml(g[2]) + '</div><div class="cb"><div class="ct">' + esc(g[1]) + '</div><div class="cm">' + num(g[4]) + ' ' + esc(M.ui.makers) + '</div><div class="cp"><small>' + (LANG === 'en' ? 'from' : 'en ucuz') + '</small><b>' + money(g[3]) + '</b></div></div></a>';
  }

  // Liste görünümü: üretici ve fiyat türü filtresi, sıralama, "daha fazla"
  function listView(el, rows, M, opts) {
    opts = opts || {};
    var U = M.ui, shown = PAGE, provs = {}, kinds = {};
    rows.forEach(function (r) { provs[r[2]] = (provs[r[2]] || 0) + 1; if (r[9]) kinds[r[9]] = (kinds[r[9]] || 0) + 1; });
    var kindKeys = ['dahil', 'bos', 'toplu', 'belirsiz'].filter(function (k) { return kinds[k]; });
    var ctl = document.createElement('div');
    ctl.className = 'controls';
    ctl.innerHTML = '<select aria-label="' + esc(U.allMakersLabel) + '"><option value="">' + esc(U.allMakersLabel) + ' (' + Object.keys(provs).length + ')</option>' +
      Object.keys(provs).sort(function (a, b) { return provs[b] - provs[a]; }).map(function (p) { return '<option value="' + esc(p) + '">' + esc(M.providers[p] || p) + ' (' + provs[p] + ')</option>'; }).join('') + '</select>' +
      '<select aria-label="sort"><option value="asc">' + esc(U.sortAsc) + '</option><option value="desc">' + esc(U.sortDesc) + '</option></select>' +
      '<select aria-label="' + esc(U.allTypes) + '"' + (kindKeys.length > 1 ? '' : ' hidden') + '><option value="">' + esc(U.allTypes) + '</option>' +
      kindKeys.map(function (k) { return '<option value="' + k + '">' + esc((M.pb || {})[k] || k) + ' (' + kinds[k] + ')</option>'; }).join('') + '</select>' +
      '<span class="muted sm" aria-live="polite"></span>';
    var body = document.createElement('div');
    el.replaceChildren(ctl, body);
    var prov = ctl.children[0], sort = ctl.children[1], kind = ctl.children[2], count = ctl.children[3];
    if (opts.extra) el.prepend(opts.extra);
    function filtered() {
      var p = prov.value, ty = opts.type ? opts.type() : '', kd = kind.value;
      var out = rows.filter(function (r) { return (!p || r[2] === p) && (!ty || r[7] === ty) && (!kd || r[9] === kd); });
      return sort.value === 'desc' ? out.slice().reverse() : out;
    }
    function render() {
      var f = filtered();
      count.textContent = num(f.length) + ' ' + U.products;
      body.innerHTML = f.length ? '<div class="cards">' + f.slice(0, shown).map(function (r) { return card(r, M); }).join('') + '</div>' : '<p class="muted">' + esc(U.none) + '</p>';
      if (f.length > shown) {
        var b = document.createElement('button');
        b.className = 'more'; b.textContent = U.more + ' (' + num(f.length - shown) + ' ' + U.left + ')';
        b.onclick = function () { shown += PAGE; render(); };
        body.append(b);
      }
    }
    [prov, sort, kind].forEach(function (x) { x.addEventListener('input', function () { shown = PAGE; render(); }); });
    render();
    return { render: function () { shown = PAGE; render(); } };
  }

  // Alt kategori sayfası: bütün ürünler; kart (pazar yeri) ya da tablo (fiyat borsası) görünümü
  // it: [adres, ad, görsel, en düşük, site sayısı, tek sitedeyse üretici, en yüksek, en ucuz site]
  function icard(it, M) {
    var U = M.ui, multi = it[4] > 1;
    return '<a class="card" href="' + esc(it[0]) + '"><div class="ci">' + imgHtml(it[2]) + '</div><div class="cb"><div class="ct">' + esc(it[1]) + '</div><div class="cm">' +
      (multi ? '<span class="sites">' + esc(U.sitesN.replace('{n}', it[4])) + '</span>' : esc(M.providers[it[5]] || it[5])) + '</div><div class="cp">' + (multi ? '<small>' + esc(U.cheapest) + '</small>' : '') + '<b>' + money(it[3]) + '</b></div></div></a>';
  }
  function board(list, M) {
    var U = M.ui;
    return '<div class="tbl board"><table><thead><tr><th>' + esc(U.th[0]) + '</th><th class="num">' + esc(U.th[1]) + '</th><th class="num">' + esc(U.th[2]) + '</th><th class="num">' + esc(U.th[3]) + '</th><th>' + esc(U.th[4]) + '</th></tr></thead><tbody>' +
      list.map(function (it) {
        return '<tr><td><a class="bp" href="' + esc(it[0]) + '">' + imgHtml(it[2]) + '<span>' + esc(it[1]) + '</span></a></td><td class="num">' + (it[4] > 1 ? '<b class="sites">' + it[4] + '</b>' : '1') + '</td><td class="num"><b class="lo">' + money(it[3]) + '</b></td><td class="num muted">' + (it[6] > it[3] ? money(it[6]) : '–') + '</td><td>' + esc(M.providers[it[7]] || it[7] || '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function itemView(el, items, M) {
    var U = M.ui, shown = PAGE, mode = 'cards';
    try { mode = localStorage.getItem('view') || 'cards'; } catch (e) { }
    var ctl = document.createElement('div');
    ctl.className = 'controls';
    ctl.innerHTML = '<div class="seg"><button data-v="cards">' + esc(U.viewCards) + '</button><button data-v="table">' + esc(U.viewTable) + '</button></div>' +
      '<select aria-label="sort"><option value="sites">' + esc(U.sortSites) + '</option><option value="asc">' + esc(U.sortAsc) + '</option><option value="desc">' + esc(U.sortDesc) + '</option></select>' +
      '<span class="muted sm"></span>';
    var body = document.createElement('div');
    el.replaceChildren(ctl, body);
    var seg = ctl.children[0], sort = ctl.children[1], count = ctl.children[2];
    function sorted() {
      var s = sort.value, a = items.slice();
      if (s === 'asc') a.sort(function (x, y) { return x[3] - y[3]; });
      else if (s === 'desc') a.sort(function (x, y) { return y[3] - x[3]; });
      return a;
    }
    function render() {
      var f = sorted(), part = f.slice(0, shown);
      [].forEach.call(seg.children, function (b) { b.classList.toggle('on', b.dataset.v === mode); });
      count.textContent = num(f.length) + ' ' + U.products;
      body.innerHTML = mode === 'table' ? board(part, M) : '<div class="cards">' + part.map(function (it) { return icard(it, M); }).join('') + '</div>';
      if (f.length > shown) {
        var b = document.createElement('button');
        b.className = 'more'; b.textContent = U.more + ' (' + num(f.length - shown) + ' ' + U.left + ')';
        b.onclick = function () { shown += PAGE; render(); };
        body.append(b);
      }
    }
    seg.addEventListener('click', function (e) { var b = e.target.closest('[data-v]'); if (!b) return; mode = b.dataset.v; try { localStorage.setItem('view', mode); } catch (x) { } render(); });
    sort.addEventListener('input', function () { shown = PAGE; render(); });
    render();
  }
  document.querySelectorAll('.list[data-items]').forEach(function (el) {
    Promise.all([fetch(el.dataset.items).then(function (r) { return r.json(); }), meta()]).then(function (res) { itemView(el, res[0], res[1]); }).catch(function () { });
  });

  // Kâr hesaplayıcı: seçilen ürünün üretici teklifleri, satış fiyatı ve pazaryeri komisyonu ile kâr
  var calc = document.getElementById('calc');
  if (calc) {
    var out = document.getElementById('calc-out'), sel = calc.elements.g, offers = null;
    var FEES = {
      etsy: function (rev) { return 0.20 + rev * 0.065 + rev * 0.03 + 0.25; },
      shopify: function (rev) { return rev * 0.029 + 0.30; },
      amazon: function (rev) { return Math.max(1, rev * 0.15); },
      custom: function (rev) { return rev * (+calc.elements.pct.value || 0) / 100 + (+calc.elements.fixed.value || 0); }
    };
    var TH = LANG === 'tr' ? ['Üretici', 'Ürün maliyeti', 'Komisyon', 'Kâr', 'Kâr oranı', 'Mağazaya git ↗'] : ['Manufacturer', 'Product cost', 'Fees', 'Profit', 'Margin', 'Go to store ↗'];
    var usd = function (v) { return nf.format(v); };
    function draw() {
      if (!offers) return;
      var price = +calc.elements.price.value || 0, shipIn = +calc.elements.shipIn.value || 0, shipOut = +calc.elements.shipOut.value || 0;
      var rev = price + shipIn, fee = FEES[calc.elements.platform.value](rev);
      var rows = offers.map(function (o) { var cost = o[2] / 100 + shipOut; var profit = rev - fee - cost; return { o: o, cost: cost, profit: profit, margin: rev ? profit / rev * 100 : 0 }; })
        // boş ürün / toplu alım fiyatları baskılı tekliflerle yarışmasın: en sona
        .sort(function (a, b) { var ba = /^(bos|toplu)$/.test(a.o[3]), bb = /^(bos|toplu)$/.test(b.o[3]); return ba - bb || b.profit - a.profit; });
      out.innerHTML = '<div class="tbl"><table><thead><tr><th>' + TH[0] + '</th><th class="num">' + TH[1] + '</th><th class="num">' + TH[2] + '</th><th class="num">' + TH[3] + '</th><th class="num">' + TH[4] + '</th><th></th></tr></thead><tbody>' +
        rows.map(function (r, i) {
          return '<tr><td>' + (i + 1) + '. <b>' + esc(r.o[1]) + '</b> ' + badgeTxt(r.o[3]) + '</td><td class="num">' + usd(r.cost) + '</td><td class="num">' + usd(fee) + '</td><td class="num ' + (r.profit >= 0 ? 'win' : 'loss') + '"><b>' + usd(r.profit) + '</b></td><td class="num">' + r.margin.toFixed(0) + '%</td><td><a class="go" href="' + esc(r.o[5]) + '" target="_blank" rel="nofollow sponsored noopener">' + TH[5] + '</a></td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    var metaCache = null;
    function badgeTxt(pb) { return metaCache && pb ? badge(pb, metaCache) : ''; }
    function load() {
      var slug = sel.value; offers = null;
      try { history.replaceState(null, '', slug ? '?p=' + encodeURIComponent(slug) : location.pathname); } catch (e) { }
      if (!slug) { out.innerHTML = ''; return; }
      fetch('/data/g/' + slug + '.json').then(function (r) { return r.json(); }).then(function (d) { offers = d; draw(); });
    }
    Promise.all([fetch('/data/groups-' + LANG + '.json').then(function (r) { return r.json(); }), meta()]).then(function (res) {
      metaCache = res[1];
      var byType = {};
      res[0].forEach(function (g) { (byType[g[5]] = byType[g[5]] || []).push(g); });
      sel.innerHTML = '<option value="">—</option>' + Object.keys(byType).sort(function (a, b) { return byType[b].length - byType[a].length; }).map(function (t) {
        return '<optgroup label="' + esc(res[1].types[t] || t) + '">' + byType[t].map(function (g) { return '<option value="' + esc(g[0]) + '">' + esc(g[1]) + ' (' + g[4] + ')</option>'; }).join('') + '</optgroup>';
      }).join('');
      var pre = new URLSearchParams(location.search).get('p');
      if (pre) { sel.value = pre; load(); }
    });
    sel.addEventListener('change', load);
    calc.addEventListener('input', function (e) {
      if (e.target.name === 'platform') [].forEach.call(calc.querySelectorAll('.custom'), function (x) { x.hidden = e.target.value !== 'custom'; });
      if (e.target !== sel) draw();
    });
  }

  // Fiyat kutusu oluşturucu: seçilen ürün için iframe + kaynak bağlantısı kodu
  var wf = document.getElementById('widget');
  if (wf) {
    var wsel = wf.elements.g, wout = document.getElementById('widget-out'), code = document.getElementById('widget-code'), prev = document.getElementById('widget-preview');
    var gmap = {};
    function wdraw() {
      var g = gmap[wsel.value];
      try { history.replaceState(null, '', g ? '?p=' + encodeURIComponent(g[0]) : location.pathname); } catch (e) { }
      if (!g) { wout.hidden = true; return; }
      var h = 92 + Math.min(8, g[4]) * 35, base = 'https://podpricing.com';
      var html = '<iframe src="' + base + '/embed/' + g[0] + '/" width="100%" height="' + h + '" style="border:0;max-width:520px" loading="lazy" title="' + esc(g[1]) + ' prices"></iframe>\n' +
        '<p style="font-size:12px;margin:4px 0 0"><a href="' + base + '/compare/' + g[0] + '/">' + esc(g[1]) + ' price comparison</a> by POD Pricing</p>';
      code.value = html; prev.innerHTML = html; wout.hidden = false;
    }
    fetch('/data/groups-en.json').then(function (r) { return r.json(); }).then(function (gs) {
      gs.forEach(function (g) { gmap[g[0]] = g; });
      wsel.innerHTML = '<option value="">—</option>' + gs.map(function (g) { return '<option value="' + esc(g[0]) + '">' + esc(g[1]) + ' (' + g[4] + ')</option>'; }).join('');
      var pre = new URLSearchParams(location.search).get('p');
      if (pre && gmap[pre]) { wsel.value = pre; wdraw(); }
    });
    wsel.addEventListener('change', wdraw);
    document.getElementById('widget-copy').addEventListener('click', function (e) {
      code.select();
      var done = function () { e.target.textContent = LANG === 'tr' ? 'Kopyalandı!' : 'Copied!'; };
      if (navigator.clipboard) navigator.clipboard.writeText(code.value).then(done, function () { document.execCommand('copy'); done(); }); else { document.execCommand('copy'); done(); }
    });
  }

  // Arama sayfası: önce karşılaştırmalı ürünler, sonra tekil ürünler
  var app = document.getElementById('search-app');
  if (app) {
    var q = new URLSearchParams(location.search).get('q') || '';
    document.querySelectorAll('input[name=q]').forEach(function (i) { i.value = q; });
    meta().then(function (M) {
      var U = M.ui;
      document.getElementById('sq').textContent = q ? U.results + ' “' + q + '”' : U.searchTitle;
      document.title = (q ? q + ' · ' : '') + document.title;
      if (!q.trim()) { app.innerHTML = '<p class="muted">' + esc(U.typeQuery) + '</p>'; return; }
      var groups = expand(q);
      fetch('/data/groups-' + LANG + '.json').then(function (r) { return r.json(); }).then(function (gs) {
        var gh = gs.filter(function (g) { return matches(g[1] + ' ' + (M.types[g[5]] || '') + ' ' + g[0].replace(/-/g, ' '), groups); }).slice(0, 12);
        if (gh.length) document.getElementById('search-groups').innerHTML = '<h2>' + esc(U.groupsH) + '</h2><div class="cards">' + gh.map(function (g) { return gcard(g, M); }).join('') + '</div><h2>' + esc(U.productsH) + '</h2>';
      }).catch(function () { });
      return fetch('/data/search.json').then(function (r) { return r.json(); }).then(function (idx) {
        // indeks: [id, başlık, üretici, fiyat, görsel, tip, model, fiyatTürü]
        var hits = idx.filter(function (r) { return matches(r[1] + ' ' + (M.providers[r[2]] || '') + ' ' + (M.types[r[5]] || '') + ' ' + r[6], groups); })
          .map(function (r) { return [r[0], r[1], r[2], r[3], '', r[4], '', r[5], '', r[7]]; });
        if (!hits.length) { app.innerHTML = '<p>' + esc(U.noHits) + '</p>'; return; }
        var types = {};
        hits.forEach(function (r) { types[r[7]] = (types[r[7]] || 0) + 1; });
        var active = '', chips = document.createElement('div');
        chips.className = 'chips';
        var keys = Object.keys(types).sort(function (a, b) { return types[b] - types[a]; }).slice(0, 12);
        var view;
        function drawChips() {
          chips.innerHTML = keys.length > 1 ? keys.map(function (t) { return '<button class="chip' + (t === active ? ' on' : '') + '" data-t="' + esc(t) + '"><b>' + esc(M.types[t] || t) + '</b><span>' + num(types[t]) + ' ' + esc(U.products) + '</span></button>'; }).join('') : '';
        }
        chips.addEventListener('click', function (e) { var b = e.target.closest('[data-t]'); if (!b) return; active = active === b.dataset.t ? '' : b.dataset.t; drawChips(); view.render(); });
        drawChips();
        view = listView(app, hits, M, { extra: chips, type: function () { return active; } });
      });
    }).catch(function () { app.innerHTML = '<p>Search could not load.</p>'; });
  }
})();
