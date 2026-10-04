# POD Atlas

Print-on-demand üreticilerinin fiyat borsası. Cimri benzeri bir karşılaştırma sitesi: ürünler ucuzdan pahalıya sıralanır, ürün sayfasında özellikler görünür, "Satış sayfasına git" ile üreticinin kendi sayfasına gidilir. Satış yapılmaz. Gelir modeli: reklam (AdSense) ve üretici ortaklık (affiliate) bağlantıları.

## Çalıştırma

`POD-Atlas-Baslat.cmd` → http://127.0.0.1:4173. Sunucu katalogları zamanlanmış olarak yeniler ve katalog değişince siteyi yeniden üretir.

- `node scripts/build-site.cjs`: `data/catalog.json` dosyasından `site/` klasörüne statik siteyi üretir (~3 dk, ~20 bin sayfa).
- `node scripts/serve-site.cjs [--skip-initial] [--no-refresh] [--port N]`: yerel önizleme.
- `node scripts/refresh-once.cjs [id ...]`: katalogları bir kez yeniler (bulut görevi bunu kullanır).
- `node scripts/apply-price-policy.cjs`: güncel fiyat politikasını mevcut kataloğa uygular.
- `node scripts/catalog-import.cjs`: kataloğu doğrular.

## Yapı

- `data/catalog.json`: asıl katalog (üreticiler + ürünler). Bağlayıcılar yalnızca kendi üreticilerinin kayıtlarını değiştirir.
- `scripts/*-connector.cjs`, `public-connectors.cjs`, `store-connectors.cjs`: üretici bağlayıcıları.
- `scripts/price-policy.cjs`: şüpheli fiyatları (yer tutucu, test, kampanya, doğrulanmamış) `data/price-review-pending.json` listesine ayırır.
- `scripts/pod-taxonomy.cjs`: satılan POD ürünlerine göre ürün tipi ağacı (14 grup, ~120 tip) ve boş ürün modeli tanıma (Gildan 5000, Bella+Canvas 3001…).
- `scripts/build-site.cjs` + `web/`: herkese açık site (ana sayfa, kategori, model borsası, ürün, üretici, arama sayfaları, sitemap).
- `site.config.json`: alan adı (`siteUrl`), AdSense kimliği (`adsenseClient`) ve üretici affiliate ayarları.
- `.github/workflows/yenile-ve-yayinla.yml`: 6 saatte bir fiyat yenileme + Netlify yayını.
- `dist/`: GPT döneminden kalan eski tek sayfalık arayüz (artık kullanılmıyor, referans için duruyor).

### Affiliate ayarı örneği

```json
"affiliate": {
  "printful": { "template": "https://www.printful.com/a/KOD?redirect={url}" },
  "gelato":   { "param": "ref", "value": "KOD" }
}
```

Yol haritası ve durum: `YAPILACAKLAR.md`. Bağlantı kapsamı: `BAGLANTI-DURUMU.md`. GPT'den devir notları: `CLAUDE-DEVIR.md`.
