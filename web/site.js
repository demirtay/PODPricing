(function () {
  'use strict';
  var PAGE = 50;
  var nf = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'USD' });
  var money = function (m) { return nf.format(m / 100); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var norm = function (s) { return String(s).toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/[^a-z0-9+]+/g, ' ').trim(); };
  var metaP = null;
  function meta() { return metaP || (metaP = fetch('/data/meta.json').then(function (r) { return r.json(); })); }
  // Türkçe arama terimleri -> başlıklardaki İngilizce karşılıkları
  var SYN = { tisort: 't shirt tee tshirt', kapusonlu: 'hoodie', hoodi: 'hoodie', sweat: 'sweatshirt', kupa: 'mug', bardak: 'cup glass tumbler', termos: 'tumbler', matara: 'bottle', canta: 'bag', 'bez canta': 'tote', 'sirt cantasi': 'backpack', sapka: 'cap hat', bere: 'beanie', kilif: 'case', telefon: 'phone', yastik: 'pillow cushion', battaniye: 'blanket', poster: 'poster print', tablo: 'canvas', kanvas: 'canvas', sticker: 'sticker', etiket: 'sticker label', defter: 'notebook journal', corap: 'socks', elbise: 'dress', sort: 'shorts', pantolon: 'pants', tayt: 'leggings', mayo: 'swimsuit swim bikini', pijama: 'pajama', havlu: 'towel', perde: 'curtain', hali: 'rug mat', bayrak: 'flag', yapboz: 'puzzle', cocuk: 'kids youth', bebek: 'baby', kopek: 'dog pet', kedi: 'cat pet', onluk: 'apron', anahtarlik: 'keychain', cuzdan: 'wallet', kolye: 'necklace', kupe: 'earrings', bileklik: 'bracelet', saat: 'clock watch', mum: 'candle', ceket: 'jacket', polo: 'polo', atlet: 'tank', 'uzun kollu': 'long sleeve' };
  function expand(q) {
    var n = norm(q), groups = [];
    Object.keys(SYN).forEach(function (k) { if (n.indexOf(k) !== -1) { n = n.replace(k, ' '); groups.push([k].concat(SYN[k].split(' '))); } });
    n.split(' ').filter(Boolean).forEach(function (t) { groups.push([t]); });
    return groups;
  }

  function rowHtml(r, M) {
    // r: [id, başlık, üretici, fiyat, kaynakFiyat, görsel, ölçü, tip, satışLinki]
    var img = r[5] ? '<img src="' + esc(r[5]) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span class="noimg"></span>';
    return '<tr><td class="th">' + img + '</td><td><a href="/urun/' + esc(r[0]) + '/">' + esc(r[1]) + '</a><div class="muted sm">' + esc(r[6] || '') + '</div></td>' +
      '<td><a href="/uretici/' + esc(r[2]) + '/">' + esc(M.providers[r[2]] || r[2]) + '</a></td>' +
      '<td class="num price"><b>' + money(r[3]) + '</b>' + (r[4] ? '<small>' + esc(r[4]) + '</small>' : '') + '</td>' +
      '<td class="lk">' + (r[8] ? '<a class="go" href="' + esc(r[8]) + '" target="_blank" rel="nofollow sponsored noopener">Satış sayfası ↗</a>' : '<a class="go" href="/urun/' + esc(r[0]) + '/">Detay</a>') + '</td></tr>';
  }
  function table(rows, M) {
    return '<div class="tbl"><table><thead><tr><th></th><th>Ürün</th><th>Üretici</th><th class="num">Fiyat</th><th class="lk"></th></tr></thead><tbody>' + rows.map(function (r) { return rowHtml(r, M); }).join('') + '</tbody></table></div>';
  }

  // Liste görünümü: üretici filtresi, sıralama, metin filtresi, "daha fazla"
  function listView(el, rows, M, opts) {
    opts = opts || {};
    var shown = PAGE, provs = {};
    rows.forEach(function (r) { provs[r[2]] = (provs[r[2]] || 0) + 1; });
    var ctl = document.createElement('div');
    ctl.className = 'controls';
    ctl.innerHTML = '<input type="search" placeholder="Bu listede ara" aria-label="Listede ara">' +
      '<select aria-label="Üretici"><option value="">Tüm üreticiler (' + Object.keys(provs).length + ')</option>' +
      Object.keys(provs).sort(function (a, b) { return provs[b] - provs[a]; }).map(function (p) { return '<option value="' + esc(p) + '">' + esc(M.providers[p] || p) + ' (' + provs[p] + ')</option>'; }).join('') + '</select>' +
      '<select aria-label="Sıralama"><option value="asc">Fiyat: ucuzdan pahalıya</option><option value="desc">Fiyat: pahalıdan ucuza</option></select>' +
      '<span class="muted sm" aria-live="polite"></span>';
    var body = document.createElement('div');
    el.replaceChildren(ctl, body);
    var q = ctl.children[0], prov = ctl.children[1], sort = ctl.children[2], count = ctl.children[3];
    if (opts.extra) el.prepend(opts.extra);
    function filtered() {
      var t = norm(q.value).split(' ').filter(Boolean), p = prov.value, ty = opts.type ? opts.type() : '';
      var out = rows.filter(function (r) { if (p && r[2] !== p) return false; if (ty && r[7] !== ty) return false; var h = norm(r[1] + ' ' + (M.providers[r[2]] || '') + ' ' + (r[6] || '')); return t.every(function (x) { return h.indexOf(x) !== -1; }); });
      return sort.value === 'desc' ? out.slice().reverse() : out;
    }
    function render() {
      var f = filtered();
      count.textContent = f.length.toLocaleString('tr-TR') + ' ürün';
      body.innerHTML = f.length ? table(f.slice(0, shown), M) : '<p class="muted">Sonuç bulunamadı.</p>';
      if (f.length > shown) {
        var b = document.createElement('button');
        b.className = 'more'; b.textContent = 'Daha fazla göster (' + (f.length - shown).toLocaleString('tr-TR') + ' kaldı)';
        b.onclick = function () { shown += PAGE; render(); };
        body.append(b);
      }
    }
    [q, prov, sort].forEach(function (x) { x.addEventListener('input', function () { shown = PAGE; render(); }); });
    render();
    return { render: function () { shown = PAGE; render(); } };
  }

  // Kategori / model sayfaları: sunucuda üretilen ilk 50 satır, sonra tam liste
  document.querySelectorAll('.list[data-src]').forEach(function (el) {
    Promise.all([fetch(el.dataset.src).then(function (r) { return r.json(); }), meta()]).then(function (res) { listView(el, res[0], res[1]); }).catch(function () { });
  });

  // Arama sayfası
  var app = document.getElementById('search-app');
  if (app) {
    var q = new URLSearchParams(location.search).get('q') || '';
    document.querySelectorAll('input[name=q]').forEach(function (i) { i.value = q; });
    document.getElementById('sq').textContent = q ? '“' + q + '” için sonuçlar' : 'Arama';
    document.title = (q ? q + ' · ' : '') + 'POD Atlas arama';
    if (!q.trim()) { app.innerHTML = '<p class="muted">Ürün, model veya üretici adı yazın.</p>'; return; }
    Promise.all([fetch('/data/arama.json').then(function (r) { return r.json(); }), meta()]).then(function (res) {
      var idx = res[0], M = res[1], groups = expand(q);
      // indeks: [id, başlık, üretici, fiyat, görsel, tip, model]
      var hits = idx.filter(function (r) {
        var h = ' ' + norm(r[1] + ' ' + (M.providers[r[2]] || '') + ' ' + (M.types[r[5]] || '') + ' ' + r[6]) + ' ';
        return groups.every(function (g) { return g.some(function (t) { return h.indexOf(t.length < 4 ? ' ' + t : t) !== -1; }); });
      }).map(function (r) { return [r[0], r[1], r[2], r[3], '', r[4], '', r[5], '']; });
      if (!hits.length) { app.innerHTML = '<p>Sonuç bulunamadı. Daha genel bir kelime deneyin ya da <a href="/kategoriler/">kategorilere</a> göz atın.</p>'; return; }
      var types = {};
      hits.forEach(function (r) { types[r[7]] = (types[r[7]] || 0) + 1; });
      var active = '', chips = document.createElement('div');
      chips.className = 'chips';
      var keys = Object.keys(types).sort(function (a, b) { return types[b] - types[a]; }).slice(0, 12);
      var view;
      function drawChips() {
        chips.innerHTML = keys.length > 1 ? keys.map(function (t) { return '<button class="chip' + (t === active ? ' on' : '') + '" data-t="' + esc(t) + '"><b>' + esc(M.types[t] || t) + '</b><span>' + types[t] + ' ürün</span></button>'; }).join('') : '';
      }
      chips.addEventListener('click', function (e) { var b = e.target.closest('[data-t]'); if (!b) return; active = active === b.dataset.t ? '' : b.dataset.t; drawChips(); view.render(); });
      drawChips();
      view = listView(app, hits, M, { extra: chips, type: function () { return active; } });
    }).catch(function () { app.innerHTML = '<p>Arama yüklenemedi.</p>'; });
  }
})();
