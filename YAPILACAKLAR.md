# POD Pricing yol haritası

Hedef: bütün POD üreticilerini kapsayan, Google'da bulunan, reklam + affiliate gelirli fiyat karşılaştırma sitesi (podpricing.com).

## Yapıldı (2026-10-04 / 05)
- Site yayında: https://podpricing.com (GitHub Pages, Cloudflare DNS), EN + TR.
- 65/121 üretici, ~30.000 ürün; fiyatlar günde 2 kez otomatik yenilenir (süre sınırlı, en eski önce).
- Pazar yeri + borsa arayüzü: ana kategori → alt kategori → bütün ürünler; ürün → bütün üreticiler ucuzdan pahalıya.
- 210 "X vs Y", 22 "en ucuz" rehberi, 15 "alternatifler" sayfası, kâr hesaplayıcı, bloglar için fiyat kutusu.
- "Diğer" kategorisi 1.827 → 386 ürün.
- Search Console + IndexNow (Bing/Yandex) bildirimi, Cloudflare Web Analytics, AdSense başvurusu (onay bekliyor).
- YouTube "POD Pricing" kanalı; Shorts üretimi (video/pod_shorts.py) ve her gün otomatik zamanlı yükleme.
- Pazarlama dosyaları: pazarlama/GPT-GOREV.md, facebook-metinleri.md, ORTAKLIK-PROGRAMLARI.md.

## Sıradaki
- [x] Ortaklık (affiliate) başvuruları gönderildi (2026-10-06): Printful, Printify, Yoycol, Tapstitch, Merchize. Durum: pazarlama/ORTAKLIK-PROGRAMLARI.md.
- [ ] Onay gelenlerin linklerini site.config.json `affiliate` alanına ekle ve siteyi yeniden yayınla.
- [ ] AdSense onayı gelince reklam alanları (site.config.json `adSlots`).
- [ ] Düzenli tanıtım: günde 1 video (otomatik), haftada birkaç Facebook/Reddit paylaşımı.
- [ ] Kalan büyük üreticiler (Gelato, CustomCat vb.) için izinli veri yolu aramak.

## 1.000 kullanıcıya ulaşınca (KESİN YAPILACAK)
Kullanıcı kararı, 2026-10-05: "bin kullanıcıya ulaşınca yapalım". Ölçüt: Cloudflare Web Analytics'te ayda ~1.000 tekil ziyaretçi.
- [ ] **Üyelik / e-posta sistemi.** Önce şifresiz e-posta kaydı: "Haftalık POD fiyat raporu" (MailerLite ücretsiz plan, 1.000 kişiye kadar). Rapor içeriği veriden otomatik (zam yapan / ucuzlayan üreticiler).
- [ ] Liste büyüyünce: fiyat alarmı ("bu ürün ucuzlayınca haber ver"), kayıtlı ürünler, gerekirse tam üyelik. KVKK/GDPR ve veri güvenliği planıyla.

## Bilinçli olarak yapılmayanlar
- Kargo karşılaştırması: ülke/ağırlık/adede göre değişken, siteyi asıl işinden uzaklaştırır (kullanıcı kararı, 2026-10-05).
- Ücretli reklam: affiliate geliri başlamadan geri dönmez.
- Facebook gruplarına toplu reklam: spam sayılır, hesap ve alan adı kapanır.
