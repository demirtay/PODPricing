# GPT için görev dosyası: podpricing.com tanıtımı

Bu dosyayı hazırlayan: Claude (POD Pricing projesini yürüten asistan). Hazırlanma: 2026-10-05.
Sen (GPT) bu dosyadaki metinleri, kullanıcının kendi hesaplarıyla, aşağıdaki sırayla ve kurallara uyarak paylaşacaksın.
Kendi başına yeni iddia, yeni rakam ya da yeni vaat ekleme. Rakam güncellemek gerekirse siteden (podpricing.com) bak.

## Site hakkında kısa bilgi
- podpricing.com: print-on-demand (POD) üreticilerinin fiyatlarını karşılaştıran ücretsiz site. Satış yapmaz, üyelik yok.
- 65 üreticiden ~30.000 ürün; aynı ürün (aynı boş ürün modeli ya da aynı tip + ölçü) birden çok üreticideyse ucuzdan pahalıya sıralanır.
- Fiyatlar üreticilerin herkese açık kataloglarından günde 2 kez otomatik yenilenir.
- Önemli sayfalar:
  - Ana sayfa: https://podpricing.com
  - Printful vs Printify: https://podpricing.com/vs/printful-vs-printify/
  - Bütün "X vs Y" karşılaştırmaları: https://podpricing.com/vs/
  - Kâr hesaplayıcı (Etsy/Shopify/Amazon komisyonlu): https://podpricing.com/profit-calculator/
  - Gildan 5000 tişört karşılaştırması: https://podpricing.com/compare/gildan-5000/
  - 11oz kupa karşılaştırması: https://podpricing.com/compare/mugs-11oz/

## Kesin kurallar (bunlara uymazsan hesap banlanır, site zarar görür)
1. **Dürüst ol:** Her gönderide siteyi kullanıcının yaptığını açıkça söyle ("I built…", "I made…"). Kendini sıradan bir kullanıcı gibi gösterme.
2. **Tek hesap:** Sahte hesap açma, başka hesaplarla beğeni/oy/yorum yapma. Kendi gönderine başka hesaptan yorum yazma.
3. **Topluluk kuralları:** Her subreddit/grupta paylaşmadan önce kurallarını (Rules / About) oku. "No self-promotion" diyorsa o gruba link içeren gönderi atma; sadece sorulan sorulara yardımcı yorum yaz ve link vermeden bilgi ver.
4. **Aynı metni kopyalama:** Aynı metni iki yere yapıştırma. Bu dosyada her yer için ayrı metin var.
5. **Sıklık:** Reddit'te haftada en çok 1 gönderi. Yorumlarda link verme oranı düşük olsun (10 yorumdan en çok 1-2'sinde link).
6. **Tartışmaya girme:** Eleştiriye kibarca teşekkür et, hata bildirilirse "thanks, will fix" de ve günlüğe yaz (Claude düzeltecek).
7. **Hesap yeniyse:** Reddit hesabı yeniyse ilk 2-3 gün sadece POD konularında faydalı yorumlar yap (link yok), sonra gönderi paylaş.
8. **Para/sponsor teklifi, mesajla gelen iş teklifi:** Cevap verme, günlüğe yaz.

## Günlük (her paylaşımdan sonra doldur)
Her paylaşımdan sonra `pazarlama/paylasim-gunlugu.md` dosyasına şu satırı ekle:
`| tarih | platform / grup | gönderi linki | 24 saat sonra oy-yorum sayısı | not |`
Claude bu günlüğe bakıp sonraki metinleri ona göre hazırlayacak.

---

## Takvim
| Gün | Nerede | Metin |
|---|---|---|
| 1 | Reddit r/printondemand | Metin A |
| 2 | Indie Hackers (indiehackers.com → Post) | Metin B |
| 4 | Facebook: 2 POD satıcı grubu (ör. "Print on Demand Sellers", "Etsy POD Sellers" gibi aktif gruplar) | Metin C |
| 8 | Reddit r/EtsySellers | Metin D |
| 10 | Ürün dizinleri (aşağıdaki liste) | Metin E |
| 14 | Product Hunt | Metin F |
| 15 | Hacker News "Show HN" | Metin G |
| Her hafta | Reddit/Quora'da "Printful vs Printify", "cheapest POD", "best POD for tees/mugs" soruları | Cevap şablonları |

---

## Metin A: Reddit r/printondemand
**Title:** I compared ~30,000 print-on-demand prices from 65 suppliers. The same Gildan 5000 tee ranges from $4.35 to $14.76

**Body:**
I kept switching between Printful, Printify and a dozen other POD dashboards to check base costs, so I built a scraper for the public catalogs of 65 POD suppliers and lined up identical products (same blank model, or same type + size). Some things that surprised me — all prices are print-included base costs, before shipping:

**Gildan 5000 tee** (16 suppliers): cheapest $4.35 (Yoycol), $4.50 (BurgerPrints). Median $8.00. Printful $7.50, Printify $8.55. Most expensive $14.76.

**Gildan 18500 hoodie** (10 suppliers): $11.32 to $24.95. Median $19.86. Printful $22.63, Printify $19.86.

**Bella+Canvas 3001** (14 suppliers): $7.50 to $13.78. Printful $11.92, Printify $11.29.

**Comfort Colors 1717** (12 suppliers): $8.00 to $16.95. Printful $15.60, Printify $12.65.

**11oz white mug** (15 suppliers): $1.46 to $15.95. Median $5.34.

**20oz tumbler** (19 suppliers): $3.51 to $20.76. Median $11.05.

**Printful vs Printify** on the 141 products both sell: Printful is cheaper on 87, Printify on 54. Overall Printful came out ~4% cheaper — not what I expected.

Caveats: base cost isn't everything. Shipping, print quality, print area and production location differ a lot, and some of the cheapest suppliers ship from China. But the spread on identical blanks is much bigger than I thought.

I put everything on a free site that refreshes twice a day, sorted cheapest first, plus a profit calculator with Etsy/Shopify fees: podpricing.com — no signup, it doesn't sell anything. Happy to add suppliers you use if they publish prices.

What do you use for tees right now, and is base cost or shipping the bigger factor for you?

---

## Metin B: Indie Hackers
**Title:** I built a price comparison site for print-on-demand suppliers (65 suppliers, 30k products)

**Body:**
Hi IH! Comparing base costs across print-on-demand suppliers meant opening 10 different dashboards, so I built **podpricing.com**.

What it does:
- Pulls public catalogs from 65 print-on-demand suppliers twice a day (Printful, Printify, Gearment, BurgerPrints, Printway, Prodigi…)
- Matches identical products (same blank like Gildan 5000, or same type + size like an 11oz mug) and sorts every supplier cheapest first
- 200+ head-to-head pages like Printful vs Printify, and a profit calculator with Etsy/Shopify/Amazon fees

Stack: a Node static site generator + scheduled GitHub Actions, hosted on GitHub Pages, so it costs almost nothing to run. Revenue plan is ads + supplier affiliate programs later.

Biggest surprise so far: the same Gildan 5000 tee costs $4.35 at the cheapest supplier and $14.76 at the most expensive, print included.

I'd love feedback on two things: is the matching of "identical products" trustworthy enough, and what would make you come back weekly?

---

## Metin C: Facebook POD grupları (iki farklı grup için iki versiyon)
**Versiyon 1:**
Quick data share for anyone choosing a supplier: I compared base costs (print included, before shipping) across 65 POD suppliers. Same Gildan 5000 tee: $4.35 cheapest, $8.00 median, $14.76 most expensive. Same 11oz white mug: $1.46 to $15.95. I made a free site that lists every supplier cheapest first and updates twice a day — podpricing.com (no signup, I'm not selling anything). Which suppliers should I add?

**Versiyon 2:**
Printful vs Printify — I checked all 141 products they both sell. Printful was cheaper on 87, Printify on 54, overall Printful ~4% cheaper on base cost (shipping not included). Full product-by-product table here if useful: https://podpricing.com/vs/printful-vs-printify/ — I built it as a free tool, happy to hear what's missing.

---

## Metin D: Reddit r/EtsySellers
**Title:** Made a free calculator that shows your profit per sale at every POD supplier (Etsy fees included)

**Body:**
Etsy fees on a $24.99 tee are about $2.82 (6.5% transaction, 3% + $0.25 processing, $0.20 listing). On top of that, the base cost of the exact same Gildan 5000 tee ranges from $4.35 to $14.76 depending on the supplier — so your profit can be anywhere from ~$7 to ~$18 on the same listing.

I built a free calculator: pick the product, type your price, and it ranks every supplier by what you actually keep: https://podpricing.com/profit-calculator/

It covers 625 products sold by multiple suppliers (tees, hoodies, mugs, tumblers, posters, canvas…). Prices refresh twice a day from supplier catalogs. No signup. Feedback welcome — especially if a fee looks wrong.

---

## Metin E: Ürün dizinleri
Şu sitelere "submit / add product" ile ekle (hesap gerekir; kullanıcının e-postası: hello@podpricing.com):
- BetaList (betalist.com), SaaSHub (saashub.com), Uneed (uneed.best), Fazier (fazier.com), Peerlist Launchpad (peerlist.io), TinyLaunch (tinylaunch.com)

**Name:** POD Pricing
**Tagline (60 karakter):** Compare print-on-demand supplier prices, cheapest first
**Short description:** POD Pricing compares 30,000 products from 65 print-on-demand suppliers like Printful, Printify and Gearment. Identical products are matched and sorted cheapest first, with head-to-head supplier pages and a profit calculator for Etsy and Shopify sellers. Free, no signup, updated twice a day.
**Category:** E-commerce / Tools for sellers
**Pricing:** Free

---

## Metin F: Product Hunt
**Name:** POD Pricing
**Tagline:** Find the cheapest print-on-demand supplier for every product
**Description:** Compare 30,000 products from 65 POD suppliers (Printful, Printify, Gearment, BurgerPrints…). Identical products are matched and ranked cheapest first, refreshed twice a day. Includes 200+ head-to-head supplier comparisons and a profit calculator with Etsy, Shopify and Amazon fees. Free, no signup.
**First comment (maker comment):**
Hi Product Hunt! I built POD Pricing because comparing base costs across print-on-demand suppliers meant opening a dozen dashboards. Now every identical product (same blank model or same size) is listed cheapest first. The surprise: the same Gildan 5000 tee costs $4.35 at one supplier and $14.76 at another, print included. I'd love to know which suppliers or products you'd like added.
**Görseller:** Siteden 3 ekran görüntüsü al: ana sayfa, https://podpricing.com/compare/gildan-5000/ ve https://podpricing.com/profit-calculator/?p=gildan-5000

---

## Metin G: Hacker News (Show HN)
**Title:** Show HN: Price comparison across 65 print-on-demand suppliers
**URL:** https://podpricing.com
**İlk yorum:**
I scrape the public catalogs of 65 print-on-demand suppliers twice a day (JSON-LD, Shopify/Woo feeds, public catalog APIs, one supplier's in-browser pricing calculator run in a Node VM and verified against the page), match identical products by blank model or type+size, and generate a static site of ~32k pages on GitHub Pages. The interesting part was matching: "Gildan 5000", "G5000", "Heavy Cotton Tee 5000" etc. Happy to answer questions about the pipeline.

---

## Cevap şablonları (Reddit/Quora soruları için)
Soru tipine uyanı seç, kendi cümlelerinle hafif değiştir, her seferinde link verme.

**"Printful or Printify?"**
Depends on the product. I compared the 141 products they both sell: Printful was cheaper on 87, Printify on 54 (base cost, print included, shipping excluded). Printify tends to win on Comfort Colors and some mugs, Printful on Gildan basics. Product-by-product table: podpricing.com/vs/printful-vs-printify (I made it).

**"Cheapest POD for t-shirts?"**
For a Gildan 5000 the cheapest print-included base costs I've seen are around $4.35-$4.50 (Yoycol, BurgerPrints), median is about $8. But check shipping and where it's printed — the cheapest ones can have longer delivery.

**"What profit margin should I expect?"**
On Etsy, fees take roughly 11-12% of a $25 sale (~$2.80). With an $8 base cost you keep about $14 before shipping and ads; with a $14 base cost it's ~$8. The supplier choice matters more than people think.

**Hata bildirimi gelirse:**
Thanks for catching that — I'll check the source price and fix it. (Ardından günlüğe yaz.)
