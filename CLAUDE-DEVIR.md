# POD Atlas — Claude için proje devri

Hazırlanma: 2026-10-04T12:15:38.502Z. Bu belge mevcut dosyalara bakılarak hazırlanmıştır. Bağlantı, fiyat ve kapsam iddialarını yeni çalışmada tekrar dosyalardan kontrol et.

## İlk okunacaklar

Bu belge; data/catalog.json; BAGLANTI-DURUMU.md; YAPILACAKLAR.md; data/*coverage.json raporları. KULLANIM.md ve FIYAT-KONTROLU.md devir sırasında güncellendi. Eski raporların kendi tarihine bak; geçmiş erişim araştırmaları güncel bağlantı durumunu göstermeyebilir.

## Kullanıcının amacı ve kesin iş sırası

POD Atlas, Etsy satıcılarının POD üretim ürünlerini bulduğu, Cimri benzeri ürün bazlı fiyat karşılaştırma sitesidir. Etsy satış ilanı fiyatlarını kıyaslamaz. Aynı aramada farklı platformların ilgili ürünleri, fotoğrafları ve doğrudan ürün bağlantıları ucuzdan pahalıya listelenir. Ürünlerin birebir aynı model veya ölçü olması şart değildir; farklar açıkça gösterilir.

1. Öncelik: 121 firma/adayı bağlamak ve ürünlerini eksiksiz almak. Yeni üretici ve ürün bağlantılarına devam et. Bağlı firma sayısını bütün ürün/varyantların tamamlandığı şeklinde sunma. Eksik ve erişilemeyen kayıtları izleyerek açıkça raporla.
2. Bundan SONRA ürün ağacını satılan POD ürünlerine göre genişlet. Etsy kategorilerine bağımlılık yanlış başlangıçtı; Etsy ağacı sınır değildir.
3. Ürünleri yeni ağaca yerleştir.
4. En SON kapsamlı fiyat kontrolü yap: varyant, ölçü, minimum adet, indirim, para birimi, baskı/kargo/vergi koşulları. Bu sıraya rağmen yeni aktarımda uydurma, sıfır veya yer tutucu fiyat kullanma.

Kullanıcı üretici hesabı bulunmadığını söyledi. Açık kataloglarla devam et. Şifre/API anahtarı isteme veya sohbet içine yazdırma. Devralma sırasında kullanıcı Claude'un başka işi olduğunu belirtti: bu hazırlık dosyasıdır, başka Claude oturumunu otomatik başlatma/mesaj atma.

## Doğrulanmış mevcut durum

- 121 firma/adayı; 37 bağlı firma; 19964 fiyatlı ürün; 84 firma bağlantı bekliyor.
- Bütün 121 tamamlanmış değildir. Provider connection.state ve coverage alanları birlikte değerlendirilmeli; complete/partial sayacı tek başına tamlık kanıtı değildir. Mevcut integrate(), coverage verilen sonuçları partial işaretliyor.
- PrintKK 1423 kayıt; PeaPrint 1216; PopCustoms 796; KINcustom 155; Printdoors 1630.
- Printdoors: 1.756 ham kayıt, 1.630 fiyatlı aktarım, 126 bekleyen kayıt. 120 kayıtta liste fiyatı tek-adet kuralıyla eşleşmedi; 4 kayıtta bir dolar altı bedel/birim incelemesi; 2 kayıtta aktif/fotoğraflı/isimli kayıt koşulları eksik. Ham ürünler data/printdoors-public-inventory.json; nedenler data/printdoors-coverage.json.
- PeaPrint 1.216 kayıt/13 sayfa ve PopCustoms 796 kayıt/50 sayfa: açık katalog sayısı ile aktarılan benzersiz kayıt sayısı eşleşti. Bunun kapalı hesap içi tüm varyantların karşılaştırmalı son fiyat denetimi olduğu iddia edilmez.
- KINcustom: 155 ürün, 10 sayfa; TshirtGang: 38; Printegy: 94; OGO: 42. İlgili coverage raporları var.
- Pic The Gift: 324 kayıt açık listede sıfır fiyat; PrintShrimp: 2 satışa kapalı kayıt; PrintMelon: 8 şüpheli kategori tanıtım kaydı, aynı fiyat/AZN. Bunlar bağlı mağaza sayılmıyor. Ham *public-inventory.json dosyaları mevcut.
- data/price-review-pending.json içinde ayrıca önceki 75 kayıt bulunur. Bu sayı bütün kaynaklardaki eksikler toplamı değildir.
- Kategoriler şimdilik 3.065 Etsy düğümü; taxonomy-engine.js başlığa göre kural eşleşmesi yapıyor. Mahjong ürünleri katalogda kalmış, birçoğu other veya yanlış kaba kategori altında. Yeni sınıflandırma işini şimdi öne çekme.

## Klasörler ve çalıştırma

Kullanıcının VS Code'da açtığı çalışma klasörü: C:\Users\alidemirtay\Desktop\POD atlas
Bu devir hazırlanırken kullanılan kaynak: C:\Users\alidemirtay\Documents\Codex\2026-10-03\sela\outputs\pod-atlas
Desktop/kaynak kod karşılaştırması: DEVIR-DOGRULAMA.json. 0 fark bulundu. Kodu körlemesine iki yönde kopyalama; özellikle Claude sonradan Desktop'ta çalışırsa onun değişikliklerini ezme.

- POD-Atlas-Baslat.cmd çalıştır; localhost: http://127.0.0.1:4173
- Node yolu: C:\Users\alidemirtay\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe . Kurulu node varsa o da kullanılabilir.
- Alternatif: node scripts/server.cjs --skip-initial (açılışta bütün katalogları yeniden çekmez; zamanlanmış yenileme açık kalır).
- Port 4173 meşgulse mevcut POD Atlas sunucusunu kontrol et. İlgisiz süreçleri sonlandırma.
- /api/catalog canonical JSON'u; /api/status yenileme durumunu döndürür. dist/index.html doğrudan açılabilir ama otomatik yenileme için sunucu gerekir.
- Çalışan yerel sunucu kapatılırsa fiyat yenileme durur. Bu sürekli internette çalışan yayın değildir.
- Eski internet adresi: https://pod-atlas.ptqtdkrzdn.chatgpt.site . Güncel katalog/UI'nin bu adrese yayımlandığı doğrulanmadı; yerel sürümün güncel olduğunu söyle. .openai/hosting.json varsa bu yayın metadata'sıdır. Önceki Sites yayın denemesi alt işlem izni nedeniyle başarısızdı. Yayınlama ayrı sonraki iştir.

## Mimari ve veri akışı

- data/catalog.json asıl katalog; dist/catalog.js statik tarayıcı kopyası. İkisini aynı başarılı sonuçla güncelle.
- dist/app.js, styles.css, index.html: arama önerileri, fotoğraflı fiyat listesi, 50'şer sonuç, kullanıcıdan kaldırılmış kontrol tarihi. dist/engine.js arama/filtre; taxonomy.js ve taxonomy-engine.js mevcut geçici kategori ağacı.
- scripts/public-connectors.cjs: adapters/collect/integrate; store-connectors.cjs Shopify/Woo, public-page-catalogs.cjs TshirtGang/Printegy/OGO, diğer kaynaklar kendi *connector.cjs dosyasında.
- scripts/refresh-catalogs.cjs adapters'tan yenileme listesi türetir. Genel aralık 30 dakika, Printful 60. Yeni adapter eklenince sunucuyu yeniden başlat.
- collect() ürünleri alır; price-policy.cjs kabul/bekleyen kayıtları ayırır; integrate(c,id,result) ilgili üreticinin eski ürünlerini sonuçla değiştirir; catalog-import.cjs validate() ilişki/fiyat/linkleri doğrular.
- Başarısız yenilemede eski başarılı kayıtlar korunur. Toplam sayının eşleşmesi gerçek fiyat doğruluğu kanıtı değildir.
- baseMinor tam sayı USD sent, currency USD: ortak sıralama içindir. Kaynak fiyatı sourceMinor/sourceCurrency ile gösterilir; FX varsa exchangeRate/exchangeDate tutulur. Kaynak pound/euro/rupi ise USD diye etiketleme. Para biriminin minor-unit ölçeğini doğrula.
- sourceUrl doğrudan ürün; Shopify seçili varyant ?variant=ID. sourceVariantId, minimumQuantity, minimumOrderMinor, priceBasis fiyat koşullarının kanıtını korur.
- source-cache güncel kaynak verileri ve FX; kaynak fiyatlarının kanıtı burada olabilir. Cache'i kaynak yerine kalıcı hakikat kabul etme; süresi var.

## Kritik hatalar ve önlenmesi

PrintKK liste JSON-LD'sindeki 0.10 özel ölçü/yer tutucu fiyatıdır. scripts/printkk-detail.cjs ürün sayfasındaki skuData/originalPrice/aktif standart varyantı kullanır. School Locker Magnetic Wallpaper standart fiyatı 5.86 USD olarak doğrulandı. Kullanıcı önce 5.58 dedi, sonra 5.86 düzeltti. Bu fiyat gelecekte değişebilir; hardcode etme. Özel ölçü/ödeme farkı kaydı standart ürüne dönüşmesin. Ölçü eşleşmesi, yön dönüşümü ve MOQ korunur; Mahjong çift taraflı set 98.65 USD/set, minimum 10 set koşuluyla kaydedilmişti.

Merchize DTF/DTG/nakış/Tier 1 ve kargo dahil koşulları; Qikink görünür GST dahil fiyatı ile JSON-LD'nin vergisiz bedelini karıştırma. OGO boş ürün + ek baskı; Tapstitch boş giysi. Bir dolar altı bütün ürünleri silmek yanlış: doğru düşük fiyatlı ürünler olabilir. İncele, kanıtını al ve uygun birim/koşulla ekle.

Yeni bağlantı için kaynağın bütün sayfalarını gez, tekrar ID ve toplam sayısını kontrol et; sadece ilk sayfayı alıp complete deme. Fotoğrafı/fiyatı yok diye ürünü sessizce kaybetme; ham envanter ve nedenli bekleyen raporu tut. Ürünler kategoriye uymadığı için çıkarılmamalı.

Katalog dosyasını uzun ağ isteğinden ÖNCE okuyup sonunda yazma: başka kaynağın yeni ürünlerini silebilir. Ağ işi bitince en güncel catalog.json'u oku, sadece ilgili sağlayıcıyı integrate et, validate edip atomik yaz. Ayrı süreçler arasında dosya kilidi henüz yok; eşzamanlı writer çalıştırırken buna dikkat et. UI dosyasını da canonical katalogdan üret.

Geçmiş work/connection-progress.cjs eski bir yardımcıdır; <1 USD kayıtlarını yanlış silebilir. Kullanma. work/ içindeki geçmiş mutation yardımcılarını körlemesine yeniden çalıştırma; bazıları tekrar çalıştırıldığında kodu çoğaltabilir. İşleyen kaynak kod scripts/ içindedir. Kod eklemek için JS replacement'ta literal $ varsa callback replacement kullan; string replacement $' ifadesini yorumlayabilir.

## Devralınca ilk yapılacak iş

1. Desktop canonical katalog ve bu belgeyi oku; güncel 37/19.964 sayısını değişmişse tekrar hesapla.
2. Bağlı olmayan 84 adayı data/providers alanından çıkar. Eski audit raporlarına güvenmeden açık ürün sayfası/API/JSON-LD/mağaza feed'ini kontrol et. Hesap erişimi yok; açık kataloglar öncelik.
3. Önceki işi koruyarak yeni adapter'ı ekle, fiyat/para birimi/ürün linki/fotoğraf doğrulaması ve sayfalama kontrolü yap. Sonra kapsam raporu ve BAGLANTI-DURUMU.md'yi güncelle.
4. Bağlı kaynakların eksiklerini ayrıca takip et; Printdoors 126 bekleyen kaydı önemli bir tamamlama işidir. Bütün 121 bitmeden kategori ağacı ve kapsamlı fiyat denetimine geçme.
5. Kullanıcıya gerçek ilerlemeyi kısa Türkçe bildir: yeni firma, ürün sayısı, kalan firmalar ve önemli eksikler. Tamamlanmamış iş için tamamlandı deme.

## Mevcut bağlı firmalar

| ID | Firma | Fiyatlı ürün | Kapsam |
|---|---|---:|---|
| yoycol | Yoycol | 1541 | kaynak raporuna bak |
| printkk | PrintKK | 1423 | verified-product-details |
| printful | Printful | 552 | kaynak raporuna bak |
| inkedjoy | Inkedjoy | 1463 | full-public-catalog |
| merchize | Merchize | 818 | verified-default-product-variants |
| podpartner | PODPartner | 206 | full-public-catalog |
| interestprint | Interestprint | 3388 | public-category-pages |
| inkthreadable | Inkthreadable | 182 | verified-public-product-pages |
| tshirtgang | TshirtGang | 38 | public-product-pages |
| artsadd | Artsadd | 1032 | public-category-pages |
| podbase | Podbase | 24 | public-product-pages |
| peaprint | PeaPrint | 1216 | full-public-api-catalog |
| teelaunch | Teelaunch | 143 | public-product-sitemap |
| kincustom | KINcustom | 155 | public-web-catalog |
| jetprint | JetPrint | 151 | public-storefront |
| aop | AOP+ | 131 | public-storefront |
| superfastpod | SuperFastPOD | 28 | public-storefront |
| printrove | Printrove | 30 | verified-public-base-prices |
| printy6 | Printy6 | 141 | public-paginated-catalog |
| ogo | Ogo | 42 | public-product-pages |
| papello | Papello | 28 | verified-public-product-pages |
| printegy | Printegy | 94 | public-product-pages |
| printdoors | Printdoors | 1630 | public-api-price-rules-partial |
| popcustoms | PopCustoms | 796 | full-public-variant-catalog |
| qikink | Qikink | 100 | verified-tax-inclusive-product-pages |
| treatpod | TreatPOD | 688 | public-storefront |
| jumbodtg | JumboDTG | 82 | public-storefront |
| blackfishclothing | Blackfish Clothing | 230 | public-storefront |
| merchfarm | MerchFarm | 1119 | public-storefront |
| twofifteen | Two Fifteen | 124 | verified-public-product-pages |
| tapstitch | Tapstitch | 1244 | full-public-catalog |
| rakiline | Rakiline | 4 | public-storefront |
| gearment | Gearment | 72 | public-category-pages |
| digitalondemand | Digital On Demand | 145 | public-storefront |
| goquadra | GoQuadra | 2 | public-storefront |
| burgerprints | BurgerPrints | 726 | full-public-catalog |
| miamerchandise | Mia Merchandise | 176 | public-storefront |

## Henüz bağlı olmayan firmalar

- Printify (printify): https://printify.com
- Gelato (gelato): https://try.gelato.com
- CustomCat (customcat): https://affiliate.customcat.com
- T-Pop (tpop): https://app.tpop.com
- Hoplix (hoplix): https://hoplix.com
- Sellfy (sellfy): https://get.sellfy.com
- Promio (promio): https://promio.eu
- FinerWorks (finerworks): https://finerworks.com
- Teemill (teemill): https://teemill.com
- NeatoPOD (neatopod): https://neatopod.com
- NovaTomato (novatomato): https://www.novatomato.com
- Framico (framico): https://www.framico.com
- Shirtly (shirtly): https://www.shirtly.com
- Casestation (casestation): https://casestation.com
- ShineOn (shineon): https://www.shineon.com
- Gooten (gooten): https://www.gooten.com
- Printbelle (printbelle): https://www.printbelle.com
- Makr3d (makr3d): https://makr3d.app
- PrintAura (printaura): https://printaura.com
- VistaPrint (vistaprint): https://www.vistaprint.com
- CustomInk (customink): https://www.customink.com
- PrintMelon (printmelon): https://printmelon.com
- PillowProfits (pillowprofits): https://pillowprofits.com
- ArtOfWhere (artofwhere): https://artofwhere.com
- MakePlayingCards (makeplayingcards): https://www.makeplayingcards.com
- MWWondemand (mwwondemand): https://mwwondemand.com
- PrintSome (printsome): https://www.printsome.com
- Apliiq (apliiq): https://www.apliiq.com
- Contrado (contrado): https://www.contrado.com
- PrintedMint (printedmint): https://printedmint.com
- Printgenie (printgenie): https://www.printgenie.com
- Subliminator (subliminator): https://www.subliminator.com
- GetFuelPod (getfuelpod): https://www.getfuelpod.com
- Prodigi (prodigi): https://www.prodigi.com
- Shirtee (shirtee): https://shirtee.cloud
- ScalablePress (scalablepress): https://scalablepress.com
- ThisNew (thisnew): https://thisnew.com
- PrintOps (printops): https://printops.com
- Printway (printway): https://printway.io
- Printbase (printbase): https://www.printbase.com
- Bluedoba (bluedoba): https://bluedoba.com
- WOYC On-Demand (woycondemand): https://woyc-ondemand.com
- PrintShrimp (printshrimp): https://printshrimp.com
- OnePrint (oneprint): https://oneprint.io
- Awkward Styles (awkwardstyles): https://awkwardstyles.com
- Printeers (printeers): https://printeers.com
- Alexanders (alexanders): https://alexanders.com
- Printoteca (printoteca): https://printoteca.ro
- LumaPrints (lumaprints): https://lumaprints.com
- PrintBest (printbest): https://printbest.com
- Shop3D (shop3d): https://www.shop3d.io
- SunFrog (sunfrog): https://sunfrog.com
- FlexMerch (flexmerch): https://flexmerch.com
- Snuggle Partners (snugglepartners): https://snugglepartners.co.uk
- Coastal Reign (coastalreign): https://coastalreign.com
- Opt On Demand (optondemand): https://optondemand.com
- Completeful (completeful): https://completeful.com
- MerchOne (merchone): https://merchone.com
- Marco Fine Arts (marcofinearts): https://marcofinearts.com
- Swagify (swagify): https://swagify.com
- Dubow Textile (dubowtextile): https://dubowtextile.com
- District Photo (districtphoto): https://districtphoto.com
- Tshirt & Sons (tshirtsons): https://tshirtandsons.com
- RushOrderTees (rushordertees): https://rushordertees.com
- OwnPrint (ownprint): https://ownprint.co
- My Easy Monogram (myeasymonogram): https://myeasymonogram.com
- Safsira (safsira): https://safsira.com
- Camaloon (camaloon): https://camaloon.com
- MarketPrint (marketprint): https://marketprint.de
- GoCustom Clothing (gocustomclothing): https://gocustomclothing.com
- Toaddit (toaddit): https://www.toaddit.com
- Clothes2Order (clothes2order): https://www.clothes2order.com
- Through6 (through6): https://through6.com
- Pic The Gift (picthegift): https://picthegift.com
- Casestry (casestry): https://casestry.com
- Printseekers (printseekers): https://printseekers.com
- Dreamship (dreamship): https://dreamship.com
- Duplium (duplium): https://duplium.com
- GearLaunch (gearlaunch): https://gearlaunch.com
- Ecomerch (ecomerch): https://ecomerch.com
- SimplePrint (simpleprint): https://simpleprint.com
- Printed Simply (printedsimply): https://printedsimply.com
- Artelo (artelo): https://artelo.io
- CW On Demand (cwondemand): https://cwondemand.com
