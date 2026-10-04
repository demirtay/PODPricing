// POD Atlas herkese açık site üreticisi: data/catalog.json -> site/
// Her ürün, kategori, boş ürün modeli ve üretici için indekslenebilir statik sayfa üretir.
// Kullanım: node scripts/build-site.cjs
'use strict';
const fs = require('node:fs'), path = require('node:path');
const tx = require('./pod-taxonomy.cjs');

const root = path.resolve(__dirname, '..');
const finalOut = path.join(root, 'site');
const out = path.join(root, 'site.__build'); // derleme bitince site/ ile yer değiştirir
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'site.config.json'), 'utf8'));
const SITE = (cfg.siteUrl || '').replace(/\/$/, '');

// ---------- yardımcılar
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const decode = s => String(s ?? '').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").trim();
const fmtCache = new Map();
const fmt = (minor, cur = 'USD') => {
  if (!fmtCache.has(cur)) { try { fmtCache.set(cur, new Intl.NumberFormat('tr-TR', { style: 'currency', currency: cur })); } catch { fmtCache.set(cur, null); } }
  const f = fmtCache.get(cur);
  return f ? f.format(minor / 100) : (minor / 100).toFixed(2) + ' ' + cur;
};
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
function write(rel, text) { const f = path.join(out, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); }
const url = rel => '/' + rel.replace(/index\.html$/, '');
const abs = rel => (SITE ? SITE : '') + url(rel);

function outbound(p) {
  const a = cfg.affiliate?.[p.providerId];
  if (!a) return p.sourceUrl;
  if (a.template) return a.template.replace('{url}', encodeURIComponent(p.sourceUrl));
  if (a.param) { const u = new URL(p.sourceUrl); u.searchParams.set(a.param, a.value); return u.toString(); }
  return p.sourceUrl;
}

const dateFmt = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long' });

// ---------- veriyi hazırla
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8'));
const providers = new Map(catalog.providers.map(p => [p.id, p]));
const products = catalog.products
  .filter(p => Number.isSafeInteger(p.baseMinor) && p.baseMinor > 0 && p.sourceUrl)
  .map(p => {
    const c = tx.classify(p), m = tx.detectModel(p);
    return { ...p, title: decode(p.title), type: c.type, group: c.group, model: m && m.key ? m : null };
  })
  .sort((a, b) => a.baseMinor - b.baseMinor);
const byId = new Map(products.map(p => [p.id, p]));
const typeLabel = id => id === 'diger' ? 'Diğer Ürünler' : tx.TYPE_BY_ID.get(id)?.label || id;
const typeGroup = id => id === 'diger' ? 'diger' : tx.TYPE_BY_ID.get(id)?.group || 'diger';
const groupBy = (arr, key) => { const m = new Map(); for (const x of arr) { const k = key(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };
const byType = groupBy(products, p => p.type);
const byGroup = groupBy(products, p => p.group);
const byProvider = groupBy(products, p => p.providerId);
const byModel = groupBy(products.filter(p => p.model), p => p.model.key);
// karşılaştırma sayfası: en az iki üreticide bulunan modeller
const models = [...byModel].map(([key, list]) => ({ key, list, brandName: list[0].model.brandName, model: list[0].model.model, providers: new Set(list.map(p => p.providerId)) }))
  .filter(m => m.providers.size >= 2)
  .map(m => ({ ...m, type: mostCommon(m.list.map(p => p.type)) }))
  .sort((a, b) => b.providers.size - a.providers.size || a.list[0].baseMinor - b.list[0].baseMinor);
const modelByKey = new Map(models.map(m => [m.key, m]));
function mostCommon(a) { const c = {}; for (const x of a) c[x] = (c[x] || 0) + 1; return Object.entries(c).sort((x, y) => y[1] - x[1])[0][0]; }
const modelTitle = m => `${m.brandName} ${m.model} ${typeLabel(m.type)}`;
const lastCheck = products.reduce((a, p) => (p.checkedAt || '') > a ? p.checkedAt : a, '');
const lastCheckText = lastCheck ? new Date(lastCheck).toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Istanbul' }) : '';

// ---------- şablon
function page({ rel, title, description, body, jsonld, crumbs }) {
  const canonical = SITE ? `<link rel="canonical" href="${esc(abs(rel))}">` : '';
  const ads = cfg.adsenseClient ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(cfg.adsenseClient)}" crossorigin="anonymous"></script>` : '';
  const bc = crumbs ? `<nav class="crumbs" aria-label="Konum"><a href="/">Ana sayfa</a>${crumbs.map(([t, h]) => h ? ` › <a href="${esc(h)}">${esc(t)}</a>` : ` › <span>${esc(t)}</span>`).join('')}</nav>` : '';
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}">${canonical}
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="website">
<link rel="stylesheet" href="/assets/site.css"><link rel="icon" href="/assets/icon.svg" type="image/svg+xml">${ads}
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}</head><body>
<header class="top"><div class="wrap"><a class="brand" href="/">POD<span>Atlas</span></a>
<form class="search" action="/ara/" role="search"><input name="q" type="search" placeholder="Ürün, model veya üretici ara (ör. gildan 5000, hoodie, mug)" aria-label="Ara" autocomplete="off"><button>Ara</button></form>
<nav class="topnav"><a href="/kategoriler/">Kategoriler</a><a href="/borsa/">Model Borsası</a><a href="/ureticiler/">Üreticiler</a></nav></div></header>
<main class="wrap">${bc}${body}</main>
<footer class="foot"><div class="wrap"><p><strong>POD Atlas</strong>, print-on-demand üreticilerinin herkese açık kataloglarındaki fiyatları karşılaştırır. Satış yapmaz; ürüne tıklayınca üreticinin kendi sayfasına gidersiniz.</p>
<p class="muted">Fiyatlar üreticinin kaynakta gösterdiği başlangıç veya seçili varyant bedelidir; baskı, kargo, vergi ve minimum adet koşulları üreticiye göre değişir. Farklı para birimleri günlük referans kuruyla yaklaşık USD'ye çevrilerek sıralanır. Son güncelleme: ${esc(lastCheckText)}.</p>
<p class="muted"><a href="/hakkinda/">Hakkında ve yöntem</a></p></div></footer>
<script src="/assets/site.js" defer></script></body></html>`;
}

function priceHtml(p) {
  const main = fmt(p.baseMinor);
  const src = p.sourceCurrency && p.sourceCurrency !== 'USD' && Number.isInteger(p.sourceMinor) ? `<small>${esc(fmt(p.sourceMinor, p.sourceCurrency))}</small>` : '';
  const old = Number.isInteger(p.originalMinor) && p.originalMinor > p.baseMinor && (!p.sourceCurrency || p.sourceCurrency === 'USD') ? `<s>${esc(fmt(p.originalMinor))}</s>` : '';
  return `${old}<b>${esc(main)}</b>${src}`;
}
const img = (p, cls = '') => p.imageUrl ? `<img class="${cls}" src="${esc(p.imageUrl)}" alt="${esc(p.title)}" loading="lazy" referrerpolicy="no-referrer">` : `<span class="noimg ${cls}"></span>`;
const provName = id => providers.get(id)?.name || id;

function rowsTable(list, { showType = false } = {}) {
  return `<div class="tbl"><table><thead><tr><th></th><th>Ürün</th><th>Üretici</th>${showType ? '<th>Tip</th>' : ''}<th class="num">Fiyat</th><th class="lk"></th></tr></thead><tbody>${list.map(p => `<tr>
<td class="th">${img(p)}</td><td><a href="/urun/${esc(p.id)}/">${esc(p.title)}</a><div class="muted sm">${esc(p.sizes || '')}</div></td>
<td><a href="/uretici/${esc(p.providerId)}/">${esc(provName(p.providerId))}</a></td>${showType ? `<td class="sm"><a href="/kategori/${p.type}/">${esc(typeLabel(p.type))}</a></td>` : ''}
<td class="num price">${priceHtml(p)}</td><td class="lk"><a class="go" href="${esc(outbound(p))}" target="_blank" rel="nofollow sponsored noopener">Satış sayfası ↗</a></td></tr>`).join('')}</tbody></table></div>`;
}

// istemci tarafı liste verisi: [id, başlık, üreticiId, fiyat, kaynakFiyatMetni, görsel, ölçü, tip]
const row = p => [p.id, p.title, p.providerId, p.baseMinor, p.sourceCurrency && p.sourceCurrency !== 'USD' && Number.isInteger(p.sourceMinor) ? fmt(p.sourceMinor, p.sourceCurrency) : '', p.imageUrl || '', p.sizes || '', p.type, outbound(p)];

// ---------- üret
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const sitemap = [];
const add = (rel, html) => { write(rel, html); sitemap.push(rel); };

// varlıklar
fs.cpSync(path.join(root, 'web'), path.join(out, 'assets'), { recursive: true });
write('data/meta.json', JSON.stringify({
  providers: Object.fromEntries(catalog.providers.map(p => [p.id, p.name])),
  types: Object.fromEntries([...byType.keys()].map(t => [t, typeLabel(t)])),
}));

// kategori listeleri (istemci filtreleme için)
for (const [t, list] of byType) write(`data/k/${t}.json`, JSON.stringify(list.map(row)));
for (const m of models) write(`data/m/${m.key}.json`, JSON.stringify(m.list.map(row)));
// arama indeksi
write('data/arama.json', JSON.stringify(products.map(p => [p.id, p.title, p.providerId, p.baseMinor, p.imageUrl || '', p.type, p.model ? p.model.brandName + ' ' + p.model.model : ''])));

const groupsOrdered = tx.GROUPS.filter(([g]) => byGroup.has(g));
const typesOf = g => [...byType.keys()].filter(t => typeGroup(t) === g).sort((a, b) => byType.get(b).length - byType.get(a).length);
const stat = list => ({ n: list.length, min: list[0].baseMinor, prov: new Set(list.map(p => p.providerId)).size });
const connected = catalog.providers.filter(p => byProvider.has(p.id));

// ana sayfa
add('index.html', page({
  rel: 'index.html',
  title: 'POD Atlas · Print-on-demand ürün fiyatlarını karşılaştır',
  description: `${connected.length} print-on-demand üreticisinin ${products.length.toLocaleString('tr-TR')} ürününü ucuzdan pahalıya karşılaştırın: tişört, hoodie, kupa, poster, telefon kılıfı ve daha fazlası.`,
  body: `<section class="hero"><h1>POD üreticilerinin fiyat borsası</h1>
<p>${connected.length} üreticinin <b>${products.length.toLocaleString('tr-TR')}</b> ürününü tek ekranda karşılaştırın. Ürünler ucuzdan pahalıya sıralanır, tıklayınca üreticinin satış sayfasına gidersiniz.</p>
<form class="search big" action="/ara/" role="search"><input name="q" type="search" placeholder="Ne basmak istiyorsunuz? (ör. oversized tişört, 11oz kupa, tote bag)" aria-label="Ara" autocomplete="off"><button>Ara</button></form></section>
<h2>Model borsası: aynı ürün, farklı üreticiler</h2><p class="muted">Aynı boş ürün modeli (ör. Gildan 5000, Bella+Canvas 3001) birden fazla üreticide satılıyor. En ucuz ve en pahalı teklif arasındaki fark burada.</p>
<div class="tbl"><table><thead><tr><th>Model</th><th class="num">Üretici</th><th class="num">En düşük</th><th class="num">En yüksek</th></tr></thead><tbody>
${models.slice(0, 15).map(m => `<tr><td><a href="/model/${m.key}/">${esc(modelTitle(m))}</a></td><td class="num">${m.providers.size}</td><td class="num price"><b>${fmt(m.list[0].baseMinor)}</b></td><td class="num">${fmt(m.list[m.list.length - 1].baseMinor)}</td></tr>`).join('')}
</tbody></table></div><p><a href="/borsa/">Tüm modeller (${models.length}) →</a></p>
<h2>Kategoriler</h2><div class="groups">${groupsOrdered.map(([g, label]) => `<section class="group"><h3><a href="/kategori/${g}/">${esc(label)}</a></h3><ul>${typesOf(g).slice(0, 8).map(t => { const s = stat(byType.get(t)); return `<li><a href="/kategori/${t}/">${esc(typeLabel(t))}</a> <span class="muted sm">${s.n} ürün · ${fmt(s.min)}'dan</span></li>`; }).join('')}</ul></section>`).join('')}</div>`,
  jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', name: cfg.siteName, url: SITE || undefined, potentialAction: { '@type': 'SearchAction', target: (SITE || '') + '/ara/?q={q}', 'query-input': 'required name=q' } },
}));

// kategoriler dizini
add('kategoriler/index.html', page({
  rel: 'kategoriler/index.html', title: 'Tüm POD ürün kategorileri · POD Atlas', description: 'Print-on-demand ürün kategorileri ve her kategorideki en düşük üretici fiyatı.',
  crumbs: [['Kategoriler']],
  body: `<h1>Kategoriler</h1><div class="groups">${groupsOrdered.map(([g, label]) => `<section class="group"><h3><a href="/kategori/${g}/">${esc(label)}</a> <span class="muted sm">${byGroup.get(g).length} ürün</span></h3><ul>${typesOf(g).map(t => { const s = stat(byType.get(t)); return `<li><a href="/kategori/${t}/">${esc(typeLabel(t))}</a> <span class="muted sm">${s.n} ürün · ${s.prov} üretici · ${fmt(s.min)}'dan</span></li>`; }).join('')}</ul></section>`).join('')}</div>`,
}));

// grup sayfaları
for (const [g, label] of groupsOrdered) {
  const list = byGroup.get(g);
  add(`kategori/${g}/index.html`, page({
    rel: `kategori/${g}/index.html`, title: `${label} POD ürün fiyatları · POD Atlas`, description: `${label} kategorisinde ${list.length} print-on-demand ürünü, ${new Set(list.map(p => p.providerId)).size} üretici. En düşük fiyat ${fmt(list[0].baseMinor)}.`,
    crumbs: [['Kategoriler', '/kategoriler/'], [label]],
    body: `<h1>${esc(label)}</h1><div class="chips">${typesOf(g).map(t => { const s = stat(byType.get(t)); return `<a class="chip" href="/kategori/${t}/"><b>${esc(typeLabel(t))}</b><span>${s.n} ürün · ${fmt(s.min)}'dan</span></a>`; }).join('')}</div>
<h2>Bu kategorideki en uygun 30 ürün</h2>${rowsTable(list.slice(0, 30), { showType: true })}`,
  }));
}

// tip (alt kategori) sayfaları
for (const [t, list] of byType) {
  const label = typeLabel(t), g = typeGroup(t), gl = tx.GROUP_LABEL.get(g) || 'Diğer';
  const tModels = models.filter(m => m.type === t).slice(0, 12);
  add(`kategori/${t}/index.html`, page({
    rel: `kategori/${t}/index.html`,
    title: `${label} fiyatları: ${new Set(list.map(p => p.providerId)).size} POD üreticisi karşılaştırması · POD Atlas`,
    description: `${label} için ${list.length} print-on-demand ürünü ucuzdan pahalıya. En düşük fiyat ${fmt(list[0].baseMinor)} (${provName(list[0].providerId)}).`,
    crumbs: [['Kategoriler', '/kategoriler/'], [gl, g === 'diger' ? null : `/kategori/${g}/`], [label]],
    body: `<h1>${esc(label)}</h1><p class="muted">${list.length} ürün · ${new Set(list.map(p => p.providerId)).size} üretici · en düşük ${fmt(list[0].baseMinor)}</p>
${tModels.length ? `<h2>Bu kategorideki modeller</h2><div class="chips">${tModels.map(m => `<a class="chip" href="/model/${m.key}/"><b>${esc(m.brandName + ' ' + m.model)}</b><span>${m.providers.size} üretici · ${fmt(m.list[0].baseMinor)}'dan</span></a>`).join('')}</div>` : ''}
<div class="list" data-src="/data/k/${t}.json" data-total="${list.length}">${rowsTable(list.slice(0, 50))}</div>`,
    jsonld: { '@context': 'https://schema.org', '@type': 'ItemList', name: label, numberOfItems: list.length, itemListElement: list.slice(0, 10).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(`urun/${p.id}/index.html`), name: p.title })) },
  }));
}

// model borsası
add('borsa/index.html', page({
  rel: 'borsa/index.html', title: 'Boş ürün model borsası: Gildan, Bella+Canvas, Comfort Colors fiyatları · POD Atlas',
  description: `${models.length} boş ürün modelinin farklı POD üreticilerindeki fiyatları: Gildan 5000, Bella+Canvas 3001, Comfort Colors 1717 ve diğerleri.`,
  crumbs: [['Model Borsası']],
  body: `<h1>Model borsası</h1><p class="muted">Aynı boş ürün modelini satan üreticiler. Fark sütunu, en ucuz teklifin en pahalıya göre ne kadar tasarruf sağladığını gösterir.</p>
<div class="tbl"><table><thead><tr><th>Model</th><th>Tip</th><th class="num">Üretici</th><th class="num">En düşük</th><th class="num">En yüksek</th><th class="num">Fark</th></tr></thead><tbody>
${models.map(m => { const lo = m.list[0].baseMinor, hi = m.list[m.list.length - 1].baseMinor; return `<tr><td><a href="/model/${m.key}/">${esc(m.brandName + ' ' + m.model)}</a></td><td class="sm">${esc(typeLabel(m.type))}</td><td class="num">${m.providers.size}</td><td class="num price"><b>${fmt(lo)}</b></td><td class="num">${fmt(hi)}</td><td class="num">%${Math.round((1 - lo / hi) * 100)}</td></tr>`; }).join('')}</tbody></table></div>`,
}));

for (const m of models) {
  const lo = m.list[0];
  const best = [...groupBy(m.list, p => p.providerId)].map(([pid, l]) => l[0]).sort((a, b) => a.baseMinor - b.baseMinor);
  add(`model/${m.key}/index.html`, page({
    rel: `model/${m.key}/index.html`,
    title: `${modelTitle(m)} fiyatları: ${m.providers.size} üretici karşılaştırması · POD Atlas`,
    description: `${m.brandName} ${m.model} en ucuz ${fmt(lo.baseMinor)} (${provName(lo.providerId)}). ${m.providers.size} print-on-demand üreticisinin fiyatları ucuzdan pahalıya.`,
    crumbs: [['Model Borsası', '/borsa/'], [m.brandName + ' ' + m.model]],
    body: `<h1>${esc(modelTitle(m))}</h1><p class="muted">${m.providers.size} üretici · ${m.list.length} teklif · en düşük ${fmt(lo.baseMinor)}</p>
<h2>Üreticilere göre en düşük fiyat</h2><ol class="ladder">${best.map((p, i) => `<li><span class="rank">${i + 1}</span><a href="/uretici/${p.providerId}/">${esc(provName(p.providerId))}</a><span class="price">${priceHtml(p)}</span><a class="go" href="${esc(outbound(p))}" target="_blank" rel="nofollow sponsored noopener">Satış sayfası ↗</a></li>`).join('')}</ol>
<p class="muted sm">Aynı model kodu, farklı üreticilerde baskı yöntemi (DTG, DTF, nakış), baskı alanı, kargo ve vergi koşullarıyla farklı fiyatlanabilir. Ayrıntılar için ürün sayfasına bakın.</p>
<h2>Tüm teklifler</h2>${rowsTable(m.list)}`,
    jsonld: { '@context': 'https://schema.org', '@type': 'Product', name: modelTitle(m), brand: { '@type': 'Brand', name: m.brandName }, image: lo.imageUrl || undefined, offers: { '@type': 'AggregateOffer', priceCurrency: 'USD', lowPrice: (lo.baseMinor / 100).toFixed(2), highPrice: (m.list[m.list.length - 1].baseMinor / 100).toFixed(2), offerCount: m.list.length } },
  }));
}

// ürün sayfaları
function features(p) {
  const f = [];
  const push = (k, v) => { if (v != null && v !== '' && v !== false) f.push([k, v]); };
  push('Ürün tipi', `<a href="/kategori/${p.type}/">${esc(typeLabel(p.type))}</a>`);
  push('Üretici', `<a href="/uretici/${p.providerId}/">${esc(provName(p.providerId))}</a>`);
  if (p.model) push('Boş ürün modeli', modelByKey.has(p.model.key) ? `<a href="/model/${p.model.key}/">${esc(p.model.brandName + ' ' + p.model.model)}</a>` : esc(p.model.brandName + ' ' + p.model.model));
  push('Fiyat açıklaması', esc(p.priceBasis));
  if (p.sourceCurrency && p.sourceCurrency !== 'USD' && Number.isInteger(p.sourceMinor)) push('Kaynak fiyatı', `${esc(fmt(p.sourceMinor, p.sourceCurrency))} <span class="muted sm">(kur ${esc(p.exchangeRate)}, ${esc(p.exchangeDate || '')})</span>`);
  if (Number.isInteger(p.baseMaxMinor) && p.baseMaxMinor > p.baseMinor) push('Fiyat aralığı', `${esc(fmt(p.baseMinor))} – ${esc(fmt(p.baseMaxMinor))}`);
  if (Number.isInteger(p.originalMinor) && p.originalMinor > p.baseMinor) push('İndirim öncesi', esc(fmt(p.originalMinor, p.sourceCurrency || 'USD')));
  if (Number.isInteger(p.subscriptionMinor) && p.subscriptionMinor < p.baseMinor) push('Üyelik fiyatı', `${esc(fmt(p.subscriptionMinor))} <span class="muted sm">(üreticinin ücretli üyelik planında)</span>`);
  if (p.decorationMethods?.length) push('Baskı yöntemleri', esc(p.decorationMethods.join(', ')));
  push('Ölçü / varyant', esc(p.sizes));
  push('Malzeme', p.material ? esc(p.material.replace(/\s*,\s*/g, ', ').replace(/(, )+$/, '')) : null);
  if (p.minimumQuantity > 1) push('Minimum adet', esc(p.minimumQuantity));
  if (Number.isInteger(p.minimumOrderMinor)) push('Minimum sipariş tutarı', esc(fmt(p.minimumOrderMinor)));
  push('Üretim süresi', esc(p.production));
  if (p.includesPrint === false) push('Baskı', 'Fiyat boş ürün içindir; baskı ücreti ayrıca eklenir');
  if (p.sourcePricePrefix && /shipping/.test(p.sourcePricePrefix)) push('Kargo', 'Fiyata kargo dahil (kaynakta belirtildiği gibi)');
  else if (p.shipping && Object.keys(p.shipping).length) push('Kargo', Object.entries(p.shipping).map(([k, v]) => `${esc(k)}: ${esc(fmt(v))}'dan`).join(' · ') + ` <span class="muted sm">(toplam yaklaşık ${esc(fmt(p.baseMinor + Object.values(p.shipping)[0]))})</span>`);
  if (p.availableCountries?.length) push('Üretim / gönderim bölgesi', esc(p.availableCountries.join(', ')));
  if (p.fulfillmentProvider) push('Üretim tesisleri', esc(p.fulfillmentProvider.split(',').join(', ')));
  push('Son kontrol', esc(dateFmt.format(new Date(p.checkedAt || p.checkedOn))));
  return f;
}

for (const p of products) {
  const prov = providers.get(p.providerId);
  let similar = p.model && modelByKey.has(p.model.key) ? modelByKey.get(p.model.key).list.filter(x => x.id !== p.id) : [];
  const simTitle = similar.length ? `Aynı model diğer tekliflerde (${p.model.brandName} ${p.model.model})` : `Diğer üreticilerde ${typeLabel(p.type)}`;
  if (!similar.length) { const seen = new Set([p.providerId]); similar = (byType.get(p.type) || []).filter(x => !seen.has(x.providerId) && seen.add(x.providerId)); }
  similar = similar.slice(0, 12);
  const rank = (byType.get(p.type) || []).indexOf(p) + 1;
  const g = typeGroup(p.type), gl = tx.GROUP_LABEL.get(g) || 'Diğer';
  write(`urun/${p.id}/index.html`, page({
    rel: `urun/${p.id}/index.html`,
    title: `${p.title} · ${prov?.name} · ${fmt(p.baseMinor)} | POD Atlas`,
    description: `${prov?.name} ${p.title}: ${fmt(p.baseMinor)}. ${typeLabel(p.type)} kategorisinde ${byType.get(p.type).length} ürün arasında ${rank}. en uygun. Ölçü, malzeme ve fiyat koşulları.`,
    crumbs: [['Kategoriler', '/kategoriler/'], [gl, g === 'diger' ? null : `/kategori/${g}/`], [typeLabel(p.type), `/kategori/${p.type}/`], [p.title]],
    body: `<article class="product"><div class="pimg">${img(p, 'big')}</div><div class="pinfo">
<p class="muted"><a href="/uretici/${p.providerId}/">${esc(prov?.name)}</a></p><h1>${esc(p.title)}</h1>
<p class="bigprice">${priceHtml(p)}</p>
<p class="muted sm">${esc(typeLabel(p.type))} kategorisindeki ${byType.get(p.type).length} ürün arasında ${rank}. en uygun fiyat.</p>
<a class="cta" href="${esc(outbound(p))}" target="_blank" rel="nofollow sponsored noopener">${esc(prov?.name)} satış sayfasına git ↗</a>
<dl class="feat">${features(p).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl></div></article>
${similar.length ? `<h2>${esc(simTitle)}</h2>${rowsTable(similar)}` : ''}`,
    jsonld: { '@context': 'https://schema.org', '@type': 'Product', name: p.title, image: p.imageUrl || undefined, brand: p.model ? { '@type': 'Brand', name: p.model.brandName } : undefined, offers: { '@type': 'Offer', price: (p.baseMinor / 100).toFixed(2), priceCurrency: 'USD', url: p.sourceUrl, seller: { '@type': 'Organization', name: prov?.name } } },
  }));
  sitemap.push(`urun/${p.id}/index.html`);
}

// üreticiler
const provRows = catalog.providers.map(p => ({ p, list: byProvider.get(p.id) || [] })).sort((a, b) => b.list.length - a.list.length || a.p.name.localeCompare(b.p.name));
add('ureticiler/index.html', page({
  rel: 'ureticiler/index.html', title: 'Print-on-demand üreticileri listesi · POD Atlas',
  description: `${catalog.providers.length} print-on-demand üreticisi: ürün sayıları, kategoriler ve en düşük fiyatlar.`,
  crumbs: [['Üreticiler']],
  body: `<h1>Üreticiler</h1><p class="muted">${connected.length} üreticinin fiyatları karşılaştırmada. ${catalog.providers.length - connected.length} üreticinin fiyatları üye girişi gerektirdiği ya da henüz eklenmediği için listede yalnızca bağlantı olarak yer alıyor.</p>
<div class="tbl"><table><thead><tr><th>Üretici</th><th class="num">Ürün</th><th class="num">En düşük</th><th>Durum</th></tr></thead><tbody>
${provRows.map(({ p, list }) => `<tr><td><a href="/uretici/${p.id}/">${esc(p.name)}</a></td><td class="num">${list.length || '–'}</td><td class="num">${list.length ? fmt(list[0].baseMinor) : '–'}</td><td class="sm">${list.length ? 'Fiyatlar karşılaştırmada' : 'Fiyatlar henüz eklenmedi · <a href="' + esc(p.homepage) + '" target="_blank" rel="nofollow noopener">siteye git ↗</a>'}</td></tr>`).join('')}
</tbody></table></div>`,
}));

for (const { p, list } of provRows) {
  const types = [...groupBy(list, x => x.type)].sort((a, b) => b[1].length - a[1].length);
  add(`uretici/${p.id}/index.html`, page({
    rel: `uretici/${p.id}/index.html`,
    title: `${p.name} ürün fiyatları ve katalog · POD Atlas`,
    description: list.length ? `${p.name} print-on-demand kataloğunda ${list.length} ürün; en düşük fiyat ${fmt(list[0].baseMinor)}. Diğer üreticilerle karşılaştırın.` : `${p.name} print-on-demand üreticisi. Fiyat bilgisi henüz karşılaştırmaya eklenmedi.`,
    crumbs: [['Üreticiler', '/ureticiler/'], [p.name]],
    body: `<h1>${esc(p.name)}</h1><p><a class="go" href="${esc(p.homepage)}" target="_blank" rel="nofollow noopener">${esc(new URL(p.homepage).hostname.replace(/^www\./, ''))} ↗</a></p>
${list.length ? `<p class="muted">${list.length} ürün · ${types.length} ürün tipi · en düşük ${fmt(list[0].baseMinor)}</p>
<div class="chips">${types.map(([t, l]) => `<a class="chip" href="/kategori/${t}/"><b>${esc(typeLabel(t))}</b><span>${l.length} ürün · ${fmt(l[0].baseMinor)}'dan</span></a>`).join('')}</div>
<h2>En uygun 40 ürün</h2>${rowsTable(list.slice(0, 40), { showType: true })}` : `<p class="muted">Bu üreticinin fiyatları henüz karşılaştırmaya eklenmedi (çoğunlukla üye girişi gerektiriyor). Ürünler ve fiyatlar için üreticinin sitesini ziyaret edin.</p>`}`,
  }));
}

// arama, hakkında, 404
add('ara/index.html', page({
  rel: 'ara/index.html', title: 'Ara · POD Atlas', description: 'Print-on-demand ürünlerini ara ve üretici fiyatlarını karşılaştır.',
  crumbs: [['Arama']],
  body: `<h1 id="sq">Arama</h1><div id="search-app" class="list"><p class="muted">Aranıyor…</p></div>`,
}));
add('hakkinda/index.html', page({
  rel: 'hakkinda/index.html', title: 'Hakkında ve yöntem · POD Atlas', description: 'POD Atlas fiyatları nasıl toplar ve karşılaştırır.',
  crumbs: [['Hakkında']],
  body: `<h1>Hakkında ve yöntem</h1><div class="prose">
<p>POD Atlas, Etsy ve diğer pazaryerlerinde satış yapanların print-on-demand üretim maliyetlerini karşılaştırmasına yardım eden bağımsız bir fiyat karşılaştırma sitesidir. Satış yapmaz, sipariş almaz.</p>
<h2>Fiyatlar nereden geliyor?</h2><p>Fiyatlar üreticilerin herkese açık katalog sayfalarından, mağaza beslemelerinden ve açık API'lerinden otomatik olarak alınır ve düzenli aralıklarla yenilenir. Üye girişi gerektiren fiyatlar eklenmez; tahmini veya uydurma fiyat kullanılmaz.</p>
<h2>Fiyat neyi kapsıyor?</h2><p>Gösterilen fiyat, üreticinin kaynakta gösterdiği başlangıç fiyatı veya seçili standart varyantın fiyatıdır. Baskı ücreti, kargo, vergi ve minimum adet koşulları üreticiye göre değişir ve her ürünün sayfasında belirtilir. Kesin tutarı üreticinin sayfasında doğrulayın.</p>
<h2>Para birimleri</h2><p>USD dışındaki fiyatlar günlük referans kuruyla (Frankfurter) yaklaşık USD'ye çevrilerek sıralanır; kaynak fiyatı da ayrıca gösterilir.</p>
<h2>Model borsası</h2><p>Aynı boş ürün modeli (ör. Gildan 5000) birden fazla üreticide satıldığında bu teklifler model sayfasında yan yana gösterilir.</p>
<p>Kapsam: ${connected.length} üreticiden ${products.length.toLocaleString('tr-TR')} ürün. Son güncelleme: ${esc(lastCheckText)}.</p></div>`,
}));
write('404.html', page({ rel: '404.html', title: 'Sayfa bulunamadı · POD Atlas', description: 'Sayfa bulunamadı.', body: `<h1>Sayfa bulunamadı</h1><p>Aradığınız ürün katalogdan kaldırılmış olabilir. <a href="/">Ana sayfaya dönün</a> ya da arayın.</p>` }));

// sitemap / robots
if (SITE) {
  const chunks = [];
  for (let i = 0; i < sitemap.length; i += 40000) chunks.push(sitemap.slice(i, i + 40000));
  chunks.forEach((c, i) => write(`sitemap-${i + 1}.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${c.map(r => `<url><loc>${esc(abs(r))}</loc></url>`).join('')}</urlset>`));
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${chunks.map((_, i) => `<sitemap><loc>${SITE}/sitemap-${i + 1}.xml</loc></sitemap>`).join('')}</sitemapindex>`);
  write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
} else {
  write('robots.txt', 'User-agent: *\nAllow: /\n');
}

const old = path.join(root, 'site.__old');
fs.rmSync(old, { recursive: true, force: true });
try {
  if (fs.existsSync(finalOut)) fs.renameSync(finalOut, old);
  fs.renameSync(out, finalOut);
  fs.rmSync(old, { recursive: true, force: true });
} catch (e) {
  // Windows'ta klasör açık tutuluyorsa: yeni dosyaları üzerine kopyala, artık olmayanları sil.
  if (fs.existsSync(old) && !fs.existsSync(finalOut)) fs.renameSync(old, finalOut);
  fs.cpSync(out, finalOut, { recursive: true, force: true });
  const keep = new Set();
  (function walk(d, rel) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const r = path.join(rel, e.name); if (e.isDirectory()) walk(path.join(d, e.name), r); else keep.add(r); } })(out, '');
  (function prune(d, rel) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = path.join(rel, e.name), full = path.join(d, e.name);
      if (e.isDirectory()) { prune(full, r); if (!fs.readdirSync(full).length) fs.rmdirSync(full); }
      else if (!keep.has(r)) fs.unlinkSync(full);
    }
  })(finalOut, '');
  fs.rmSync(out, { recursive: true, force: true });
}

console.log(`Site üretildi: ${products.length} ürün, ${byType.size} kategori, ${models.length} model, ${catalog.providers.length} üretici, ${sitemap.length} sayfa${SITE ? '' : ' (siteUrl boş: sitemap üretilmedi)'}`);
