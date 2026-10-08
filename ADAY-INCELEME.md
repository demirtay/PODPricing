# Yeni üretici adayları — inceleme sonuçları (2026-10-08)

Kaynaklar: podsellers.com (tamamı zaten katalogda), printondemandbusiness.com/suppliers (178), Shopify App Store POD kategorisi (315 uygulama), Order Desk entegrasyonları, bölgesel listeler (Hindistan, Avustralya, Avrupa, İngiltere). Aday listesi ve yoklama: `data/new-candidates.json`, `data/candidate-probe.json` (`node scripts/probe-providers.cjs --new`). Ekleme: `node scripts/add-providers.cjs <id>` + `node scripts/refresh-once.cjs <id>`.

Kural: yalnızca açık sayfada/feed'de doğrulanan satıcı (üretim) maliyeti. Perakende, toplu kademe, müşteri siparişi kaydı, üye girişi arkasındaki fiyatlar alınmaz; bot koruması/imzalı API aşılmaz.

## Bağlananlar (65 → 101)
Fourthwall, Wooacry, WHCC, Merchr, BlinkStore, Blanka, StationeryHQ, Shirtigo, Candle Builders, Blurb, Peecho, PrintDropper, Customizingbox, Pengine, Muzefab, OOWIA, Backstory Prints, InkPOD, Snapwear, Viviaprint, POD Hut, Artovo, Prinstant, Alerio Print, Dogediy, Printonic, Merch Factory, Print Partners, BeautyBoss, Slaite POD, Colouroo, Zonkraft, Printiturk, Zela Print, Printmood, Teelabs.

## Reddedilenler (neden)
- **Fiyat üye girişi / "View price" / danışma arkasında:** Supliful, Swift POD, Live Ink, Printicks ve Tee Junction (fiyat 0, teklif), Loostra (fiyat 0).
- **Bot koruması / imzalı-korumalı API (aşılmadı):** Mayzing (403), SuperFriday (token'lı secureDataApi), CatKissFish ("no permission" API), Instafreshener, EZ Prints, Pictorem, CanvasChamp, Custom Sock Lab, BoardPusher, Dashery, Podbul, JewlrWay, Merch.camp, Printler, DTG2Go, Real Thread (429).
- **Perakende/tüketici fiyatı:** CanvasPop, Ready2HangArt, Candlefy, Simply Framed, ArtToFrame, PhotoGifts, viaGlamour, Knitwise, 23point5, Ceeprinto, MyFolie, PODmerch, Sticker Ninja, Star Editions (lisanslı ürün).
- **Müşteri siparişi / özel tasarım kayıtları (katalog değil):** Miami Sublimation (eklenip silindi: 4.474 customization_id kaydı), Printdrop Express, InkBlot.Ink, NinjaPOD, MerchLoop.
- **Toplu / kademe fiyatı:** T Shirt Elephant (en yüksek adet kademesi), Couture by Ikigai, The Print Bar ("+ Decorations"), NorthPark Design, Kochprint.
- **Fiyat sayfada yok / hesaplayıcı:** Lulu (hesaplayıcı), Bookvault (etiket–fiyat eşleşmesi belirsiz), Jondo, Loxley Colour, theprintspace (yalnızca $18 numune paketi), Viralstyle, Spring, Cloudprinter, Printique, RV Print Factory, Pixelmade, Subforma, Artbeat Studios.
- **Yalnızca Çince başlık + CNY:** HiCustom (88 ürün; İngilizce başlık olmadan arama/kategori bozulur — ileride kategori adıyla eklenebilir).
- **Ürün değil, ara malzeme:** Ninja Transfers / DTF Transfers (transfer film).
- **Erişilemeyen alan adları:** probe çıktısında ENOTFOUND/SSL/timeout olanlar (candidate-probe.json).

## Fiyat türü (print-basis.cjs)
Baskı dahil yalnızca ürün sayfasında doğrulananlar PRINTED listesinde; OOWIA ve Teelabs BLANK (baskı ayrıca). Doğrulanmayanlar "Koşullar üreticide" (belirsiz) olarak kalır: Blanka, Pengine, Backstory Prints, Snapwear, Prinstant, Alerio Print, Dogediy, InkPOD, Printonic, Merch Factory, Print Partners, BeautyBoss, Slaite POD, Zonkraft, Printiturk, Printmood.
