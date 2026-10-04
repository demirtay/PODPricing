# POD Atlas yol haritası

Hedef: bütün POD üreticilerini kapsayan, Google'da bulunan, reklam + affiliate gelirli fiyat borsası.

## 1. Temel ✅ (2026-10-04)

- Projenin kendi git deposu.
- Ürün tipi ağacı (Etsy'den bağımsız, 14 grup / ~120 tip): ürünlerin ~%93'ü başlıktan doğru tipe yerleşiyor.
- Boş ürün modeli eşleştirme: 68 model en az 2 üreticide karşılaştırılıyor (Gildan 5000 → 10 üretici).
- Herkese açık statik site: ana sayfa, kategoriler, model borsası, ~20 bin ürün sayfası, üretici sayfaları, arama, SEO etiketleri, JSON-LD.
- Fiyat temizliği: yer tutucu (tam 1,00), test ve kampanya kayıtları gerekçesiyle incelemeye ayrıldı.

## 2. Yayın (sıradaki, kullanıcı hesabı gerekiyor)

- [ ] GitHub deposu (özel) + Netlify sitesi; depo sırları NETLIFY_AUTH_TOKEN, NETLIFY_SITE_ID.
- [ ] Alan adı → `site.config.json` siteUrl (sitemap ve canonical bunu kullanır).
- [ ] Google Search Console'a sitemap gönderimi.
- [ ] Gizlilik politikası / çerez bildirimi (AdSense şartı), sonra AdSense başvurusu.
- [ ] Affiliate programlarına başvuru (Printful, Printify, Gelato vb.) ve `site.config.json` affiliate ayarı.

## 3. Kapsam: kalan üreticiler

- [ ] 84 bağlı olmayan üretici. Önce Etsy satıcılarının en çok kullandıkları (Printify, Gelato, CustomCat, Gooten, Dreamship, SwiftPOD, Monster Digital…).
- [ ] Fiyatı üye girişi isteyenler: üretici sayfasında "fiyat için üye girişi" olarak listelenir, uydurma fiyat yok.
- [ ] Printdoors 126 bekleyen kayıt; `data/price-review-pending.json` (116 kayıt).

## 4. Karşılaştırma kalitesi

- [ ] "Diğer" kalan ~1.200 ürün için yeni tip kuralları.
- [ ] Model tanımayı genişletmek (marka adı geçmeyen ama model kodu olan başlıklar, ör. "5000 Heavy Cotton").
- [ ] Ürün sayfasında baskı yöntemi (DTG/DTF/nakış), baskı alanı ve kargo bilgisi; mümkün olan üreticilerde kargo dahil toplam.

## 5. Kapsamlı fiyat kontrolü

- [ ] Varyant, ölçü, minimum adet, indirim, para birimi, baskı/kargo/vergi koşulları üretici bazında denetim.
