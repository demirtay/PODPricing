# E-ihracat kargo karşılaştırma — araştırma (20 Ekim 2026)

Hedef: podpricing.com/tr/ altında Türkiye'den yurt dışına (özellikle ABD) gönderen Etsy satıcıları için kargo + vergi maliyet karşılaştırması.

## Pazar
- Türkçe, girişsiz, toplu karşılaştırma yapan bir sayfa yok; rehberler "her firmanın hesaplayıcısına tek tek bakın" diyor.
- Navlungo yüzlerce taşıyıcının teklifini karşılaştırıyor ama fiyatlar üye panelinde (rakip ama kapalı).
- ShipEntegra Türk Etsy satıcılarında en yaygın platform (firma iddiası: Türk Etsy kargosunun büyük kısmı). ABD'de depoları var; Smart Express 1 kg'a kadar 2-5 iş günü; ekonomik ABD gönderimi $7,95'ten başlıyor.
- **Zamanlama fırsatı:** ABD'de 800$ altı gümrüksüz (de minimis) 29 Ağu 2025'te askıya alındı; Etsy 9 Tem 2026'dan beri ABD'ye yurt dışından gönderimde Purchase Protection için DDP şartı koyuyor. Satıcılar "vergi + kargo toplam ne tutar?" sorusunda kafası karışık (Etsy Türkiye forumunda soru var, cevap yok).

## Veri erişimi (girişsiz fiyat var mı?)
| Kaynak | Girişsiz fiyat | Not |
|---|---|---|
| ShipEntegra | Hayır — hesaplayıcı app.shipentegra.com/auth/register'a gidiyor | Partnership (referans) programı var: shipentegra.com/en/partnership, komisyon oranı yayınlanmıyor |
| Navlungo | Hayır — panelde | Partner programı bulunamadı |
| PTT / Turpex | Sitede ücret hesaplama aracı var (doğrulanmadı) | Ucuz, yavaş; DDP uyumu belirsiz |
| Yurtiçi (YK International Express) | "Fiyat Hesapla" aracı var (doğrulanmadı) | 3 kg ABD ~5.000 TL (2025 blog verisi) |
| Aras | Hesaplama aracı var; PDF tarifede yurt dışı yok | 2 kg ABD ~6.200 TL (2025 blog verisi) |
| DHL Express | MyDHL+ misafir teklifi ülkeye göre değişiyor | |
| Packlink | Hesaplayıcı var (TNT/DHL/UPS), giriş durumu belirsiz | Referans programı bulunamadı |

Sonuç: podpricing'deki gibi toplu açık fiyat listesi yok; veri ya (a) firmalarla anlaşma/API, (b) satıcıların girdiği gerçek fiyatlar, (c) herkese açık hesaplayıcıların düzenli sorgulanması ile gelir.

## Entegrasyon yolları
1. **DDP vergi + kargo hesaplayıcı (taşıyıcı verisi gerekmez):** ürün değeri + kategori → ABD gümrük vergisi (resmi HTS oranları + Türkiye'ye uygulanan ek tarife) + tipik DDP işlem ücreti. Kamuya açık veriden. İlk sürüm hemen yapılabilir. (Oranlar yayından önce resmi kaynaktan doğrulanmalı.)
2. **Rehber sayfaları:** "Etsy DDP nedir", "ABD'ye kargo vergisi kim öder", "en ucuz ABD kargo yolu" — arama trafiği, AdSense için özgün içerik.
3. **Firma anlaşmaları:** referans programı + fiyat tablosu/API isteği (ShipEntegra öncelikli; Navlungo, Packlink, Yurtiçi, Aras, DHL TR, PTT kurumsal).
4. **Satıcı katkılı fiyatlar:** Facebook grubu + sitede "gerçek gönderim maliyetini paylaş" formu (Supabase, yorum sistemi altyapısı hazır) → ağırlık/ülke/firma bazında gerçek ortalamalar.

## Kaynaklar
- https://www.shipentegra.com/yurtdisi-kargo-fiyat-hesapla
- https://www.shipentegra.com/en/partnership
- https://www.shipentegra.com/blog/turkiyeden-amerikaya-kargo-gondermek
- https://www.karar.com/ekonomi-haberleri/shipentegra-e-ihracatcinin-amerika-denklemini-degistirdi-2072684
- https://community.etsy.com/forum/etsy-t%C3%BCrkiye-dijital-ve-pod-331/topic/ovner-165507/
- https://webrazzi.com/2025/10/10/navlungo-envoyo-yu-satin-aldi/
- https://navlungo.com/en/fedex-international-shipping
- https://www.packlink.com/tr-TR/amerika-kargo-gonderimi/
- https://manaycpa.com/tr/amerikaya-kargo-gonderimi-nasil-yapilir-ucretler/
- https://ikas.com/tr/blog/yurt-disi-kargo-fiyatlari
- https://birfatura.com/yurtdisina-kargo-gonderme/
- https://eticaretradari.com/kargo/shipentegra/
