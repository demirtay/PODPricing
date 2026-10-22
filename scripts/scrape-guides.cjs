// "Ürün listesini Excel'e aktarma" rehberleri (ClickScrape): Türkçe 3, İngilizce 2 sayfa.
// Adımlar ve örnek rakamlar 22 Ekim 2026'da eklentiyle gerçek sayfalarda denendi
// (Trendyol "kupa" 36 ürün, Hepsiburada "kupa" 36, Amazon "coffee mug" 60).
const STORE = 'https://chromewebstore.google.com/detail/kbdgclcljahbcpleaplmmhmhmcenkgec';
const CHECKED = { tr: '22 Ekim 2026', en: 'October 22, 2026' };

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TR_STEPS = site => [
  `Chrome'a <a href="${STORE}" rel="noopener" target="_blank">ClickScrape</a> eklentisini kurun (ücretsiz, 10 kullanım hakkı).`,
  `${site}'da aramanızı yapın ya da kategori/mağaza sayfasını açın. Filtre ve sıralamayı her zamanki gibi kullanabilirsiniz.`,
  `Araç çubuğundaki ClickScrape simgesine tıklayın. Eklenti sayfayı kendisi analiz eder ve bulduğu sütunları gerçek değerlerle önizlemede gösterir: ürün adı, fiyat, puan, yorum sayısı, resim, link.`,
  `İstemediğiniz sütunun işaretini kaldırın, <b>Başlat</b>'a basın. Sonraki sayfalara geçtikçe ya da aşağı kaydırdıkça yeni ürünler de eklenir, tekrarlar atlanır.`,
  `<b>Bitir</b>'e basın ve <b>Excel</b>'i seçin. Dosya başlık satırı sabit ve filtreli olarak iner; fiyata ya da yorum sayısına göre hemen sıralayabilirsiniz.`,
];
const EN_STEPS = site => [
  `Install the <a href="${STORE}" rel="noopener" target="_blank">ClickScrape</a> Chrome extension (free, 10 runs).`,
  `Run your ${site} search, or open a category or shop page. Filters and sorting work as usual.`,
  `Click the ClickScrape icon in the toolbar. It analyses the page by itself and previews the columns it found with real values: title, price, rating, review count, image, link.`,
  `Untick any column you don't need and press <b>Start</b>. Products from next pages and infinite scroll are added as you browse, duplicates skipped.`,
  `Press <b>Finish</b> and choose <b>Excel</b>. The file comes with a frozen, filterable header row, ready to sort by price or reviews.`,
];

const PAGES = [
  {
    lang: 'tr', path: 'tr/trendyol-urunlerini-excele-aktarma/', img: 'trendyol.jpg',
    title: "Trendyol Ürünlerini Excel'e Aktarma (Fiyat, Puan, Yorum) · 2026",
    nav: "Trendyol ürünlerini Excel'e aktarma",
    description: "Trendyol arama ve kategori sayfasındaki ürünleri fiyat, puan ve yorum sayısıyla birlikte tek tıkla Excel'e aktarın. Kopyala-yapıştır yok, kod yok. Adım adım rehber.",
    h1: "Trendyol ürünlerini Excel'e aktarma",
    lead: "Rakip fiyatlarını izlemek, çok satanları bulmak ya da kendi kategorinizi analiz etmek için Trendyol'daki ürün listesini birkaç dakikada tabloya çevirin.",
    site: 'Trendyol',
    example: "Örnek: Trendyol'da \"kupa\" araması, ilk sayfada 36 ürün. ClickScrape ürün adı, fiyat (199,99 TL), Trendyol Plus fiyatı, puan (4,6) ve yorum sayısını (1314) kendisi buldu.",
    uses: [
      ['Rakip fiyat takibi', "Aynı aramayı haftada bir çekip fiyat sütununu karşılaştırın. Kayıtlı şablonla ikinci sefer tek tıktır."],
      ['Çok satan analizi', "Yorum sayısına göre sıralayın; en çok yorumu olan ürünler genelde en çok satanlardır. Fiyat aralığı ve puanla birlikte bakın."],
      ['Fiyatlandırma', "Kategorinizdeki ortalama ve en düşük fiyatı görün, kendi fiyatınızı buna göre belirleyin."],
    ],
    faq: [
      ['Trendyol ürün listesini Excel\'e aktarmak ücretsiz mi?', 'ClickScrape kurulumdan itibaren 10 kez ücretsiz çalışır, tüm özellikler açıktır. Sınırsız kullanım tek seferlik 5,99 dolardır; abonelik yoktur.'],
      ['Kaç sayfa ürün çekebilirim?', 'Başlat\'a bastıktan sonra sonraki sayfalara geçtikçe ve aşağı kaydırdıkça ürünler eklenmeye devam eder. İsterseniz sayfa sınırı koyabilirsiniz.'],
      ['Ürün detaylarını (açıklama, satıcı) da alabilir miyim?', 'Evet. Detay sekmesi her ürünün kendi sayfasını açıp listede görünmeyen alanları ekler.'],
      ['Verilerim bir yere gönderiliyor mu?', 'Hayır. Çektiğiniz veri bilgisayarınızda kalır, yalnızca indirdiğiniz dosyaya yazılır.'],
    ],
  },
  {
    lang: 'tr', path: 'tr/hepsiburada-urun-listesi-excel/', img: 'trendyol.jpg',
    title: "Hepsiburada Ürün Listesini Excel'e İndirme · 2026",
    nav: "Hepsiburada ürün listesini Excel'e indirme",
    description: "Hepsiburada arama sonuçlarını ürün adı, fiyat, puan ve değerlendirme sayısıyla Excel'e indirin. Rakip ve fiyat analizi için adım adım, kodsuz yöntem.",
    h1: "Hepsiburada ürün listesini Excel'e indirme",
    lead: "Hepsiburada'da bir arama ya da kategori sayfasındaki bütün ürünleri fiyat ve puanlarıyla tabloya alın; sıralayın, filtreleyin, karşılaştırın.",
    site: 'Hepsiburada',
    example: "Görselde Trendyol örneği var; Hepsiburada'da da aynı adımlar geçerli. Hepsiburada'da \"kupa\" araması, 36 ürün. ClickScrape ürün adını, fiyatı (99 TL), puanı (4,1) ve değerlendirme sayısını (7) kendisi buldu.",
    uses: [
      ['Pazar araştırması', "Bir ürüne girmeden önce kaç satıcı olduğunu, fiyatların nerede toplandığını görün."],
      ['Trendyol ile karşılaştırma', "Aynı aramayı Trendyol'da da çekin, iki tabloyu yan yana koyup fiyat farkına bakın."],
      ['Tedarikçi listesi', "Kategori sayfasından marka ve satıcı adlarını toplayıp iletişim listesi çıkarın."],
    ],
    faq: [
      ['Hepsiburada verisini çekmek için kod bilmem gerekir mi?', 'Hayır. ClickScrape sayfadaki ürün kartlarını kendisi bulur; siz yalnızca hangi sütunları istediğinizi seçersiniz.'],
      ['Excel dışında hangi formatlar var?', 'CSV, JSON, panoya kopyalama ve tüm ürün resimlerini ZIP olarak indirme.'],
      ['Ücreti ne kadar?', 'İlk 10 kullanım ücretsiz. Sonrası tek seferlik 5,99 dolar, abonelik yok.'],
    ],
  },
  {
    lang: 'tr', path: 'tr/etsy-rakip-analizi-excel/', img: 'amazon.jpg',
    title: "Etsy Rakip Analizi: Rakip Ürünleri Excel'e Aktarma · 2026",
    nav: 'Etsy rakip analizi (Excel)',
    description: "Etsy arama sonuçlarını ve rakip mağazaları başlık, fiyat, puan ve yorum sayısıyla Excel'e aktarın. Türk Etsy satıcıları için ücretsiz başlangıçlı, kodsuz rakip analizi.",
    h1: "Etsy rakip analizi: rakip ürünleri Excel'e aktarma",
    lead: "Etsy'de hangi ürünün kaç dolara satıldığını, hangi başlıkların öne çıktığını ve rakiplerin kaç yorum aldığını tek tabloda görün.",
    site: 'Etsy',
    example: "Aynı yöntem Amazon'da da çalışıyor: \"coffee mug\" aramasında 60 ürün, fiyat ($27.95), puan (4.5) ve yorum sayısı (1.4K) ile tabloya geldi.",
    uses: [
      ['Başlık ve etiket araştırması', "Üst sıradaki ürünlerin başlıklarını tabloya alın; tekrar eden kelimeler alıcıların aradığı kelimelerdir."],
      ['Fiyat aralığı', "Ürününüzün kategorisinde fiyatların nerede yoğunlaştığını görün. POD satıyorsanız üretici maliyetini <a href=\"/tr/\">podpricing.com</a>'da karşılaştırın."],
      ['Rakip mağaza takibi', "Rakip mağazanın ürün sayfasını kayıtlı şablonla düzenli çekin; yeni ürünleri ve fiyat değişikliklerini görün."],
    ],
    faq: [
      ['Etsy rakip analizi için eRank ya da EverBee yerine bunu kullanabilir miyim?', 'ClickScrape arama hacmi tahmini vermez; sayfada görünen gerçek veriyi (başlık, fiyat, puan, yorum) tabloya alır. Aylık abonelik yerine tek seferlik ödemedir. İkisini birlikte de kullanabilirsiniz.'],
      ['Etsy mağaza ürünlerini de çekebilir miyim?', 'Evet. Mağaza sayfasını açıp aynı adımları izleyin; sayfalar arasında gezdikçe ürünler eklenir.'],
      ['Bu Etsy kurallarına aykırı mı?', 'ClickScrape yalnızca sizin açtığınız, herkese açık sayfadaki bilgiyi okur. Her sitenin kullanım koşullarına uymak kullanıcıya aittir; kişisel veri toplamayın.'],
    ],
  },
  {
    lang: 'en', path: 'export-amazon-search-results-to-excel/', img: 'amazon.jpg',
    title: 'How to Export Amazon Search Results to Excel (Price, Rating, Reviews) · 2026',
    nav: 'Export Amazon search results to Excel',
    description: 'Export Amazon search results to Excel with title, price, rating and review count in a few clicks. No copy-paste, no code. Step-by-step guide for sellers.',
    h1: 'How to export Amazon search results to Excel',
    lead: 'Turn an Amazon search into a spreadsheet of titles, prices, ratings and review counts for product research, pricing and competitor tracking.',
    site: 'Amazon',
    example: 'Example: Amazon search "coffee mug", 60 products. ClickScrape found title, price ($27.95), rating (4.5) and review count (1.4K) by itself.',
    uses: [
      ['Product research', 'Sort by review count to see what actually sells, then check the price range and ratings around it.'],
      ['Pricing', 'See the cheapest, typical and premium prices in your niche before you set yours.'],
      ['Competitor tracking', 'Save the setup as a template and re-run the same search weekly to catch price changes.'],
    ],
    faq: [
      ['Is it free to export Amazon results to Excel?', 'ClickScrape works 10 times for free with every feature. Unlimited use is a one-time $5.99, no subscription.'],
      ['Can it collect more than one page?', 'Yes. After Start, next pages, numbered pages and infinite scroll are collected as you browse, with an optional page limit.'],
      ['Does it send my data anywhere?', 'No. Scraped data stays on your computer and only goes into the file you download.'],
    ],
  },
  {
    lang: 'en', path: 'etsy-competitor-research-spreadsheet/', img: 'amazon.jpg',
    title: 'Etsy Competitor Research: Export Etsy Listings to a Spreadsheet · 2026',
    nav: 'Etsy competitor research spreadsheet',
    description: 'Export Etsy search results and competitor shops to Excel or CSV with title, price, rating and reviews. A no-code way to research Etsy competitors.',
    h1: 'Etsy competitor research: export listings to a spreadsheet',
    lead: 'See which Etsy listings rank, what they charge and how many reviews they have, all in one sortable table.',
    site: 'Etsy',
    example: 'The same steps work on Amazon, eBay, Trendyol and most sites that show products as cards or rows.',
    uses: [
      ['Title and tag research', 'Pull the titles of top-ranking listings into a sheet; words that repeat are the words buyers search for.'],
      ['Price range', 'Find where prices cluster in your niche. Selling print on demand? Compare supplier base costs on <a href="/">POD Pricing</a>.'],
      ['Shop tracking', 'Re-run a competitor shop with a saved template to spot new listings and price changes.'],
    ],
    faq: [
      ['Is this a replacement for eRank or EverBee?', 'ClickScrape does not estimate search volume; it exports the real data on the page (title, price, rating, reviews). It is a one-time payment instead of a monthly plan, and works alongside those tools.'],
      ['Can I export a whole Etsy shop?', 'Yes. Open the shop page and follow the same steps; items are added as you move through the pages.'],
      ['Is scraping Etsy allowed?', 'ClickScrape only reads publicly visible information on pages you open yourself. Follow each site\'s terms of use and do not collect personal data.'],
    ],
  },
];

function body(p) {
  const tr = p.lang === 'tr';
  const steps = (tr ? TR_STEPS : EN_STEPS)(p.site);
  const cta = tr
    ? `<p><a class="go" href="${STORE}" rel="noopener" target="_blank">ClickScrape'i Chrome'a ücretsiz ekle →</a></p>`
    : `<p><a class="go" href="${STORE}" rel="noopener" target="_blank">Add ClickScrape to Chrome, free →</a></p>`;
  const others = PAGES.filter(o => o.lang === p.lang && o.path !== p.path)
    .map(o => `<li><a href="/${o.path}">${esc(o.nav)}</a></li>`).join('');
  return `<h1>${esc(p.h1)}</h1>
<p class="muted">${esc(p.lead)}</p>
${cta}
<figure><img src="/assets/clickscrape/${p.img}" width="960" height="600" loading="lazy" alt="${esc(tr ? 'ClickScrape ürün listesini otomatik algılıyor ve tabloya aktarıyor' : 'ClickScrape detecting a product list and previewing it as a table')}" style="max-width:100%;height:auto;border-radius:10px"><figcaption class="muted sm">${esc(p.example)}</figcaption></figure>

<h2>${tr ? 'Adım adım' : 'Step by step'}</h2>
<div class="prose"><ol>${steps.map(s => `<li>${s}</li>`).join('')}</ol></div>

<h2>${tr ? 'Bu tabloyla ne yapılır?' : 'What to do with the sheet'}</h2>
<div class="prose">${p.uses.map(([h, t]) => `<h3>${esc(h)}</h3><p>${t}</p>`).join('')}</div>

<h2>${tr ? 'Sık sorulan sorular' : 'FAQ'}</h2>
<div class="prose">${p.faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('')}</div>
${cta}
<p class="muted sm">${tr ? `Adımlar ${CHECKED.tr} tarihinde denendi.` : `Steps tested on ${CHECKED.en}.`}</p>
${others ? `<h2>${tr ? 'Diğer rehberler' : 'More guides'}</h2><ul>${others}</ul>` : ''}`;
}

const jsonld = p => ({
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'HowTo', name: p.h1, step: (p.lang === 'tr' ? TR_STEPS : EN_STEPS)(p.site).map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: s.replace(/<[^>]+>/g, '') })) },
    { '@type': 'FAQPage', mainEntity: p.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ],
});

module.exports = { pages: lang => PAGES.filter(p => p.lang === lang), body, jsonld };
