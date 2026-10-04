# POD Atlas yayına alma

Mimari: kod ve katalog **GitHub**'da (özel depo) → GitHub Actions 6 saatte bir fiyatları yeniler ve siteyi üretir → **Netlify** yayınlar → alan adı Netlify'a yönlenir. Sunucu kiralamaya gerek yok.

## Maliyet

| Kalem | Tutar |
|---|---|
| .com alan adı (Cloudflare Registrar / Porkbun / Namecheap) | ~10–12 $/yıl |
| GitHub (özel depo + Actions, ayda 2.000 dk ücretsiz) | 0 $ — yenileme ayda ~600–900 dk sürer |
| Netlify Free (100 GB trafik/ay) | 0 $ — trafik büyürse Pro 19 $/ay |
| Google AdSense | ücretsiz, gelir getirir |

## 1. Alan adı (kullanıcı)

- podatlas.com Afternic'te satılık (2025'te kaydedilmiş). Fiyatı ancak teklif verince öğrenilir; bu tür isimler genelde 1.000–5.000 $ ister.
- Boşta ve uygun olanlar (2026-10-04 kontrolü): **podpricing.com**, podpricewatch.com, printondemandprices.com, getpodatlas.com, podatlashq.com.
- Satın alma: Cloudflare Registrar maliyetine satar (yenileme fiyatı da aynı kalır). Porkbun da uygun.

## 2. GitHub (kullanıcı, 5 dk)

1. github.com hesabı aç.
2. Yeni **private** depo: `pod-atlas` (README ekleme).
3. Claude'a depo adresini ver; Claude kodu yükler (`git push`) — ilk seferde tarayıcıda GitHub girişi istenir.

## 3. Netlify (kullanıcı, 5 dk)

1. netlify.com → GitHub ile giriş.
2. "Add new site → Deploy manually" ile boş site oluştur; **Site ID** (Site configuration → General) not al.
3. User settings → Applications → **Personal access token** oluştur.
4. GitHub deposu → Settings → Secrets and variables → Actions → iki sır ekle: `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`.
5. Netlify → Domain management → alan adını ekle; alan adı sağlayıcısında Netlify'ın verdiği DNS kayıtlarını gir. HTTPS otomatik.

## 4. Site ayarı (Claude)

`site.config.json`: `siteUrl` (https://alanadi.com), `contactEmail`. Sonra sitemap, canonical ve gizlilik sayfası buna göre üretilir.

## 5. Google (yayından sonra)

1. **Search Console**: alan adını doğrula, `sitemap.xml` gönder.
2. **AdSense** başvurusu: site yayında ve içerikli olmalı; gizlilik, hakkında, iletişim sayfaları hazır. Onay genelde birkaç gün–birkaç hafta.
3. Onaydan sonra `adsenseClient` ve `adSlots` doldurulur, `adsPreview` false yapılır; `ads.txt` otomatik üretilir.
4. AB/İngiltere ziyaretçileri için AdSense → Privacy & messaging → Google'ın onay (CMP) mesajını aç.

## 6. Ortaklık (affiliate) programları

Printful, Printify, Gelato gibi üreticilerin ortaklık programlarına başvur; verilen bağlantı kalıbı `site.config.json` → `affiliate` alanına yazılır (örnek README'de).
