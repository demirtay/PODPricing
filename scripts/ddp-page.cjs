// Türkiye'den ABD'ye kargo + gümrük vergisi (DDP) hesaplayıcı ve rehber sayfası (yalnız Türkçe: /tr/abd-kargo-vergi-hesaplama/)
// Oranlar 20 Ekim 2026'da doğrulandı:
//  - temel (MFN) oranlar: resmi ABD gümrük tarifesi, hts.usitc.gov (Column 1 General)
//  - Türkiye ek vergisi: USTR Section 301 (zorla çalıştırma) kararı, 24 Temmuz 2026'dan beri %12,5
// Oranlar değişince yalnız bu dosya güncellenir; sayfadaki "son kontrol" tarihi de buradan gelir.
const CHECKED = '20 Ekim 2026';
const TR_EXTRA = 12.5;

// [anahtar, kategori adı, HTS kodu, temel oran %]
const CATS = [
  ['kupa', 'Seramik kupa, fincan, bardak', '6912.00.48', 9.8],
  ['seramik-dekor', 'Seramik süs eşyası, vazo', '6913.90.50', 6],
  ['tisort', 'Pamuklu tişört', '6109.10.00', 16.5],
  ['dus-perdesi', 'Duş perdesi (sentetik kumaş)', '6303.92.20', 11.3],
  ['havlu', 'Pamuklu havlu, mutfak tekstili', '6302.60.00', 9.1],
  ['gumus-taki', 'Gümüş takı', '7113.11.50', 5],
  ['deri-canta-ust', 'Deri çanta (20$ üstü)', '4202.21.90', 9],
  ['deri-canta-alt', 'Deri çanta (20$ ve altı)', '4202.21.60', 10],
  ['hali-el', 'El dokuma halı/kilim (sertifikalı el tezgâhı, folklor)', '5701.10.13', 0],
  ['hali-diger', 'Diğer yün halı', '5701.10.90', 4.5],
  ['ahsap', 'Ahşap dekor objesi', '4420.90.80', 3.2],
  ['lamba', 'Lamba, aydınlatma', '9405.21.60', 6],
  ['mum', 'Mum', '3406.00.00', 0],
  ['poster', 'Basılı poster, sanat baskısı', '4911.91', 0],
];

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = v => String(v).replace('.', ',');

const FAQ = [
  ['ABD\'ye gönderdiğim Etsy siparişlerinde gümrük vergisini kim ödüyor?',
    `9 Temmuz 2026'dan beri Etsy, ABD'ye yurt dışından gönderilen siparişlerde vergisi önceden ödenmiş (DDP) gönderim istiyor. Vergiyi siz ödersiniz ve satış fiyatınıza katarsınız. DDP olmadan gönderilen siparişler Etsy Satın Alma Koruması kapsamından çıkar; kargo firması vergiyi alıcıdan alırsa Etsy bu tutarı alıcıya iade edip sizden kesebilir.`],
  ['Türkiye\'den ABD\'ye giden ürünlere ne kadar vergi uygulanıyor?',
    `İki kalem toplanır: ürünün ABD gümrük tarifesindeki temel oranı (örneğin seramik kupa %9,8, pamuklu tişört %16,5, mum %0) ve 24 Temmuz 2026'dan beri Türkiye menşeli ürünlere uygulanan %${pct(TR_EXTRA)} ek vergi. Seramik kupada toplam oran %${pct(9.8 + TR_EXTRA)} olur.`],
  ['800 dolar altı gönderiler hâlâ vergisiz mi?',
    `Hayır. ABD'nin 800 dolar altı gönderileri vergiden muaf tutan "de minimis" kuralı 29 Ağustos 2025'te bütün ülkeler için askıya alındı ve Haziran 2026'da süresiz uzatıldı. Artık küçük paketler de vergiye tabi.`],
  ['Vergi kargo ücreti üzerinden de alınıyor mu?',
    `Genellikle hayır. ABD'de vergi ürünün satış değeri (işlem değeri) üzerinden hesaplanır; kargo ve sigorta çoğu durumda bu değere eklenmez. Kargo firmanız DDP için ayrıca işlem ücreti alabilir; bu yüzden hesaplayıcıda ayrı bir alan var.`],
  ['Hangi kargo firmaları DDP gönderim yapıyor?',
    `ShipEntegra, UPS, FedEx ve DHL Express DDP seçenekleri sunuyor; PTT (Turpex), Yurtiçi ve Aras'ın yurt dışı servislerinde DDP desteğini gönderiden önce firmaya sormanızı öneririz. Fiyatlar çoğunlukla üye panelinde görünür; aynı paketi birkaç firmada fiyatlatıp karşılaştırın.`],
];

function body() {
  const rows = CATS.map(([k, name, hts, r]) => `<tr><td>${esc(name)}</td><td>${esc(hts)}</td><td>%${pct(r)}</td><td><b>%${pct(r + TR_EXTRA)}</b></td></tr>`).join('');
  const opts = CATS.map(([k, name, , r]) => `<option value="${r}">${esc(name)} (%${pct(r + TR_EXTRA)})</option>`).join('') + '<option value="custom">Diğer — oranı kendim gireceğim</option>';
  return `<h1>ABD'ye kargo + gümrük vergisi hesaplama (Etsy DDP)</h1>
<p class="muted">Türkiye'den ABD'ye gönderdiğiniz bir siparişin toplam maliyetini hesaplayın: kargo, ABD gümrük vergisi ve DDP işlem ücreti. Oranlar ${CHECKED} tarihinde resmi kaynaklardan kontrol edildi.</p>
<form id="ddp" class="calc" onsubmit="return false" data-extra="${TR_EXTRA}">
<label class="wide">Ürün kategorisi<select name="cat">${opts}</select></label>
<label class="ddp-custom" hidden>Temel vergi oranı (%)<input name="base" type="number" min="0" step="0.1" value="5"></label>
<label>Ürünün satış fiyatı ($)<input name="value" type="number" min="0" step="0.01" value="25"></label>
<label>Kargo firmasına ödediğiniz ($)<input name="ship" type="number" min="0" step="0.01" value="9"></label>
<label>DDP işlem ücreti ($)<input name="fee" type="number" min="0" step="0.01" value="0"></label>
</form>
<div id="ddp-out" class="ddp-out" aria-live="polite"></div>
<p class="muted sm">Hesap: vergi = satış fiyatı × (temel oran + %${pct(TR_EXTRA)} Türkiye ek vergisi). Kargo ücreti vergiye eklenmez. Bu sayfa bilgi amaçlıdır; kesin tutar için kargo firmanıza veya bir gümrük müşavirine danışın.</p>

<h2>Ne değişti?</h2>
<div class="prose">
<p><b>800 dolar muafiyeti kalktı.</b> ABD, 800 dolar altındaki paketleri vergiden muaf tutan kuralı 29 Ağustos 2025'te bütün ülkeler için askıya aldı. Artık tek bir kupa da vergiye tabi.</p>
<p><b>Türkiye'ye %${pct(TR_EXTRA)} ek vergi geldi.</b> 24 Temmuz 2026'dan beri Türkiye menşeli ürünlerin çoğuna, ürünün kendi vergisine ek olarak %${pct(TR_EXTRA)} uygulanıyor.</p>
<p><b>Etsy DDP istiyor.</b> 9 Temmuz 2026'dan beri ABD'deki alıcılara yurt dışından gönderilen siparişlerde vergi önceden ödenmiş olmalı (DDP). Alıcı kapıda vergi öderse Etsy bu tutarı alıcıya iade edip satıcıdan kesebiliyor.</p>
</div>

<h2>DDP nedir, DAP'tan farkı ne?</h2>
<div class="prose">
<p><b>DDP (Delivered Duty Paid):</b> Vergiyi ve gümrük işlemlerini gönderici öder; alıcı paketi ek ücret ödemeden teslim alır. Etsy'nin ABD siparişleri için istediği yöntem budur.</p>
<p><b>DAP (Delivered At Place):</b> Vergiyi alıcı teslimatta öder. Alıcı beklemediği bir ücretle karşılaşır; Etsy'de bu artık iade ve olumsuz yorum riski demek.</p>
<p>DDP'de vergiyi siz ödediğiniz için satış fiyatınızı buna göre ayarlamanız gerekir. Yukarıdaki hesaplayıcı tam olarak bunu gösterir.</p>
</div>

<h2>Kategoriye göre ABD vergi oranları (Türkiye menşeli)</h2>
<div class="tablewrap"><table class="ddp-table"><thead><tr><th>Ürün</th><th>HTS kodu</th><th>Temel oran</th><th>Toplam (Türkiye)</th></tr></thead><tbody>${rows}</tbody></table></div>
<p class="muted sm">Temel oranlar ABD resmi gümrük tarifesinden (hts.usitc.gov), Türkiye ek vergisi USTR kararından. Ürününüzün kesin HTS kodu malzemesine ve değerine göre değişebilir; emin değilseniz kargo firmanıza sorun.</p>

<h2>Örnek: 25 dolarlık seramik kupa</h2>
<div class="prose">
<p>Seramik kupanın temel oranı %9,8, Türkiye ek vergisi %${pct(TR_EXTRA)}; toplam %${pct(9.8 + TR_EXTRA)}. 25 dolarlık kupa için vergi 25 × 0,${String(Math.round((9.8 + TR_EXTRA) * 10)).padStart(3, '0')} = <b>${(25 * (9.8 + TR_EXTRA) / 100).toFixed(2).replace('.', ',')} $</b> olur. 9 dolarlık kargoyla birlikte göndermenin toplam maliyeti yaklaşık ${(9 + 25 * (9.8 + TR_EXTRA) / 100).toFixed(2).replace('.', ',')} $ eder; satış fiyatınızı ve "ücretsiz kargo" tutarınızı buna göre belirleyin.</p>
</div>

<h2>Sık sorulan sorular</h2>
<div class="prose">${FAQ.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('')}</div>`;
}

const jsonld = () => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });

module.exports = {
  path: 'tr/abd-kargo-vergi-hesaplama/',
  title: 'ABD\'ye Kargo + Gümrük Vergisi Hesaplama (Etsy DDP, 2026)',
  description: `Türkiye'den ABD'ye gönderimde gümrük vergisi ve kargo maliyetini hesaplayın. Etsy DDP şartı, %${pct(TR_EXTRA)} Türkiye ek vergisi ve kategoriye göre oranlar (${CHECKED}).`,
  nav: 'ABD kargo + vergi hesaplama',
  body, jsonld,
};
