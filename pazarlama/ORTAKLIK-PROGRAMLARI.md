# Ortaklık (affiliate) programları — podpricing.com
Hazırlayan: Claude, 2026-10-05. Oranlar üreticilerin kendi sayfalarından / affiliate listelerinden alındı; başvururken sayfadaki güncel şartlara bak.

## Neden önemli
Bir satıcı sitemizdeki "Mağazaya git" bağlantısıyla bir üreticiye üye olup sipariş verirse üretici bize komisyon öder.
Örnek: Printful %10, 12 ay. Ayda 300 $ sipariş veren bir satıcı → yılda ~360 $ komisyon. Reklam (AdSense) gelirinden çok daha büyük.
Başvuru onaylanınca üreticinin verdiği özel bağlantıyı Claude'a ver; Claude siteye ekler (site.config.json → affiliate). Sıralama yine sadece fiyata göre kalır, gizlilik sayfasında bu zaten yazıyor.

## Öncelik sırası (önce bunlar)
| # | Üretici | Komisyon | Süre | Başvuru sayfası |
|---|---|---|---|---|
| 1 | Printful | %10 (+ kayıt bonusu olabilir) | 12 ay, her sipariş | https://www.printful.com/affiliates |
| 2 | Merchize | ürün başına %19'a kadar | yönlendirilen satıcının siparişleri | https://merchize.com/affiliate-program/ |
| 3 | Printify | %5 | 12 ay, 90 gün çerez | https://printify.com/affiliate/ |
| 4 | Tapstitch | %10 | 12 ay | https://www.tapstitch.com/affiliate |
| 5 | Yoycol | %10 | 12 ay | https://www.yoycol.com/affiliate-introduction |
| 6 | NovaTomato | %10 | 12 ay | https://www.novatomato.com/Affiliate/ |
| 7 | Podbase | %10 | her sipariş | https://www.podbase.com/affiliates |
| 8 | Contrado | %10 dünya, %15 İngiltere | satış başına | https://www.contrado.com/affiliate |
| 9 | Papello | %15'e kadar | 90 gün çerez | https://papello.com/affiliates |
| 10 | Sellfy | ücretli plana geçenden %25 (ömür boyu, kademeli %40'a kadar) | ömür boyu | https://sellfy.com/affiliates/ |

## Diğerleri (sonra)
| Üretici | Komisyon | Not |
|---|---|---|
| JetPrint | %5 | 36 ay |
| Inkthreadable | %5 | üretim bedeli üzerinden |
| Printegy | %5 | 1 yıl (Almanca sayfa) |
| Promio | %5 | 12 ay |
| MarketPrint | %5 | Almanca sayfa |
| InterestPrint | sayfada | https://www.interestprint.com/affiliate/program |
| Printdoors | %10 | 25 $ alt ödeme sınırı |
| FinerWorks | ilk siparişin %10'u (kredi olarak) | düşük öncelik |
| Eco Merch | sayfada | https://ecomerch.com/affiliate-program |

Programı bulunamayanlar (şimdilik): Gearment, Dreamship, BurgerPrints, Printway, Prodigi, SimplePrint, Gelato (site bot korumalı; elle bakılabilir: gelato.com/affiliate).

## Başvuru formları için hazır bilgiler (GPT kopyala-yapıştır yapabilir)
- **Website:** https://podpricing.com
- **Name / company:** POD Pricing
- **Email:** hello@podpricing.com
- **Country:** Türkiye
- **Payment:** Payoneer (kullanıcının hesabı var). PayPal Türkiye'de çalışmıyor. Payoneer yoksa banka havalesi (SWIFT/IBAN) seç.
- **Monthly visitors:** dürüst yaz — "New site launched October 2026; growing via SEO, ~32,000 indexed pages" (uydurma rakam yazma).
- **How will you promote us? (İngilizce cevap):**
  > POD Pricing (podpricing.com) is an independent price comparison site for print-on-demand sellers. We list your products with live base costs next to other suppliers, and every listing links to your product page ("Go to store"). We also publish head-to-head supplier comparisons, "cheapest supplier" guides for each product type and a profit calculator for Etsy and Shopify sellers. Affiliate links would be used on those outbound links only; ranking is always by price and we disclose affiliate links in our privacy policy.
- **Social profiles:** yok ise boş bırak; zorunluysa site adresini yaz.

## Kurallar
- Sahte trafik/sahte bilgi verme.
- Kupon/indirim kodu sitelerine bağlantı dağıtma (çoğu programda yasak).
- Onay e-postası hello@podpricing.com → kullanıcının Gmail'ine gelir. Onaylanan her program için özel bağlantıyı (affiliate link veya ref kodu) Claude'a ilet.

## Başvuru durumu
| Üretici | Durum | Tarih | Not |
|---|---|---|---|
| Printful | ✅ Onaylandı — siteye eklendi | 2026-10-06 | Link: https://www.printful.com/a/13321156:ce7d5bf657e4b7127304ccfd0a899062 . Derin link: sayfa yolunun sonuna /a/KOD (ör. /custom/product/938/a/KOD; test edildi). Panel: printful.com/dashboard/affiliate/affiliate-link |
| Printify | ✅ Onaylandı — siteye eklendi | 2026-10-06 | Link: https://try.printify.com/m1r1uinkhza6 . Ürüne yönlendirme: ?url={ürün adresi} (test edildi). Panel: dash.partnerstack.com/printify/links |
| Yoycol | Gönderildi (success) | 2026-10-06 | Panel → Affiliate Program. %10, 12 ay. |
| Tapstitch | İncelemede (PartnerStack) | 2026-10-06 | Printify ile aynı PartnerStack hesabı. |
| Merchize | Gönderildi | 2026-10-06 | merchize.com/affiliate-program formu. |
