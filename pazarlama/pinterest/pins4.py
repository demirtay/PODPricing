# -*- coding: utf-8 -*-
"""Dördüncü pin serisi (açık turuncu tasarım), 1000x1500:
  - Üretici profili: "<Üretici> hangi ürünlerde en ucuz?" — bütün "en ucuz ..." rehberlerindeki
    sıralamalardan, üreticinin en iyi olduğu ürün tipleri (site/cheapest/<tip>/)
  - Rehber: üretici seçerken bakılacak maliyetler, Etsy fiyatlandırma, aynı boş ürünü karşılaştırma
Veri derlenmiş siteden okunur; önce `node scripts/build-site.cjs`.

Çıktı: web/pins/{maker,guide}-*.png ve pazarlama/pinterest/pinterest-toplu-yukleme-4.csv
Kullanım: python pazarlama/pinterest/pins4.py
"""
import csv
import html
import json
import re
from datetime import date, timedelta
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SITE_DIR = ROOT / "site"
OUT = ROOT / "web" / "pins"
CSV_PATH = Path(__file__).parent / "pinterest-toplu-yukleme-4.csv"
SITE = "https://podpricing.com"
BOARD = "Print on Demand Price Comparisons"
W, H = 1000, 1500
BG, CARD, INK, MUTED, ORANGE, GREEN = "#fff7ed", "#ffffff", "#1c1917", "#78716c", "#ea580c", "#059669"
FONT, BOLD = "C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/segoeuib.ttf"
_fonts = {}


def f(size, bold=False):
    if (size, bold) not in _fonts:
        _fonts[(size, bold)] = ImageFont.truetype(BOLD if bold else FONT, size)
    return _fonts[(size, bold)]


def text_of(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def usd(x):
    return f"${x:,.2f}"


def fit(d, text, size, width, bold=True, min_size=26):
    while size > min_size and d.textlength(text, font=f(size, bold)) > width:
        size -= 2
    return f(size, bold)


def wrap(d, text, font, width):
    lines, line = [], ""
    for word in text.split():
        test = f"{line} {word}".strip()
        if d.textlength(test, font=font) <= width or not line:
            line = test
        else:
            lines.append(line)
            line = word
    return lines + [line]


def frame(title, kicker):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 24, H], fill=ORANGE)
    d.text((70, 90), kicker, font=f(30, True), fill=ORANGE, anchor="lm")
    y = 140
    for line in wrap(d, title, f(66, True), W - 130)[:3]:
        d.text((70, y), line, font=f(66, True), fill=INK)
        y += 80
    d.rounded_rectangle([70, H - 150, W - 60, H - 60], radius=45, fill=ORANGE)
    d.text((W // 2 + 5, H - 105), "podpricing.com  ·  free POD price comparison", font=f(34, True), fill="#ffffff", anchor="mm")
    return img, d, y


def save(img, name):
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / f"{name}.png", optimize=True)


# ---------- üretici profili
def guide_tables():
    """Her rehber için: (tip slug, tip adı, [(üretici id, ad, endeks, en ucuz olduğu, karşılaştırılan)])"""
    out = []
    for p in sorted((SITE_DIR / "cheapest").iterdir()):
        if not p.is_dir():
            continue
        page = (p / "index.html").read_text(encoding="utf-8")
        label = text_of(re.search(r"<h1>(.*?)</h1>", page).group(1)).replace("Cheapest print-on-demand ", "")
        body = re.search(r"<tbody>(.*?)</tbody>", page, re.S).group(1)
        rows = []
        for tr in re.findall(r"<tr>(.*?)</tr>", body, re.S):
            pid = re.search(r'href="/manufacturer/([^/]+)/"', tr).group(1)
            tds = [text_of(t) for t in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)]
            rows.append((pid, re.sub(r"^\d+\.\s*", "", tds[0]), int(re.match(r"(\d+)", tds[1]).group(1)), int(tds[2]), int(tds[3])))
        out.append((p.name, label, rows))
    return out


def maker_pin(pid, name, entries, overall):
    img, d, y = frame(f"What is {name} cheapest for?", "SUPPLIER PROFILE")
    d.text((70, y + 6), "Rank among print-on-demand suppliers, by product type", font=f(30), fill=MUTED)
    y += 80
    rows = entries[:6]
    # alt kutu: fiyat endeksindeki genel sıra (varsa)
    box = 190 if overall else 0
    row_h = min(170, (H - 170 - 30 - box - y) // len(rows))
    if overall:
        rank, total, idx = overall
        top = H - 170 - 30 - 160
        d.rounded_rectangle([70, top, W - 60, top + 160], radius=22, fill=INK)
        d.text((105, top + 55), "POD Price Index, all products", font=f(30, True), fill="#ffffff", anchor="lm")
        d.text((105, top + 108), f"average price index {idx} (100 = typical)", font=f(26), fill="#d6d3d1", anchor="lm")
        d.text((W - 95, top + 80), f"#{rank} of {total}", font=f(54, True), fill="#fdba74", anchor="rm")
    for i, (label, rank, total, idx, n) in enumerate(rows):
        top = y + i * row_h
        d.rounded_rectangle([70, top, W - 60, top + row_h - 18], radius=22, fill=CARD)
        cy = top + (row_h - 18) // 2
        d.text((105, cy - 22), label[:1].upper() + label[1:], font=fit(d, label, 42, 470), fill=INK, anchor="lm")
        d.text((105, cy + 28), f"{n} products compared · price index {idx}", font=f(26), fill=MUTED, anchor="lm")
        d.text((W - 95, cy - 14), f"#{rank}", font=f(56, True), fill=GREEN if rank == 1 else ORANGE, anchor="rm")
        d.text((W - 95, cy + 30), f"of {total}", font=f(26), fill=MUTED, anchor="rm")
    save(img, f"maker-{pid}")


# ---------- rehber (metin) pinleri
def list_pin(slug, kicker, title, items, foot):
    img, d, y = frame(title, kicker)
    y += 30
    for i, (head, body) in enumerate(items):
        d.ellipse([70, y, 130, y + 60], fill=ORANGE)
        d.text((100, y + 30), str(i + 1), font=f(34, True), fill="#ffffff", anchor="mm")
        d.text((155, y + 30), head, font=fit(d, head, 40, W - 230), fill=INK, anchor="lm")
        y += 72
        for line in wrap(d, body, f(30), W - 230)[:3]:
            d.text((155, y), line, font=f(30), fill=MUTED)
            y += 40
        y += 34
    for line in wrap(d, foot, f(30, True), W - 140):
        d.text((70, y), line, font=f(30, True), fill=GREEN)
        y += 42
    save(img, f"guide-{slug}")


def main():
    pins = []
    tables = guide_tables()
    # üretici -> [(tip, sıra, toplam, endeks, ürün)] ; yalnızca en az 5 ürünle karşılaştırıldığı tipler
    makers = {}
    for _slug, label, rows in tables:
        for rank, (pid, name, idx, _wins, n) in enumerate(rows, 1):
            if n >= 5 and len(rows) >= 5:  # en az 5 üreticinin yarıştığı tipler ("3 içinde 1." anlamsız)
                makers.setdefault((pid, name), []).append((label, rank, len(rows), idx, n))
    index_rows = list(csv.DictReader((SITE_DIR / "price-index" / "pod-price-index-suppliers.csv").open(encoding="utf-8")))
    overall_of = {r["supplier"]: (int(r["rank"]), len(index_rows), int(r["price_index"])) for r in index_rows}
    chosen = sorted(((k, sorted(v, key=lambda e: (e[1], e[3]))) for k, v in makers.items() if sum(1 for e in v if e[1] <= 3) >= 2 and sum(1 for e in v if e[1] <= 5) >= 3),
                    key=lambda kv: -sum(1 for e in kv[1] if e[1] <= 3))[:14]
    for (pid, name), entries in chosen:
        entries = [e for e in entries if e[1] <= 5]
        maker_pin(pid, name, entries, overall_of.get(name))
        best = [e for e in entries if e[1] <= 3][:4]
        pins.append((f"maker-{pid}", f"Is {name} cheap? Where {name} beats other print-on-demand suppliers"[:100],
                     f"{name} ranks " + ", ".join(f"#{e[1]} for {e[0]}" for e in best) + " among print-on-demand suppliers on price (print included). "
                     f"See {name}'s full price list compared with other POD suppliers, updated twice a day.",
                     f"{SITE}/manufacturer/{pid}/", f"{name}, {name} review, {name} prices, print on demand supplier, POD"))
    # Gildan 5000 tipik fiyatı ve aralığı: rehber pinlerindeki örnek rakamlar
    g = sorted((o for o in json.loads((SITE_DIR / "data" / "g" / "gildan-5000.json").read_text(encoding="utf-8")) if o[3] == "dahil"), key=lambda o: o[2])
    lo, med, hi = g[0][2] / 100, g[(len(g) - 1) // 2][2] / 100, g[-1][2] / 100
    price = 24.99
    fees = 0.20 + price * 0.065 + price * 0.03 + 0.25
    guides = [
        ("five-costs", "CHECKLIST", "5 costs to check before you pick a POD supplier", [
            ("Base price with print", "The product cost with one print area included, not the blank alone."),
            ("Extra print areas", "Back, sleeve or neck prints usually add a few dollars each."),
            ("Shipping", "First item and each additional item; it varies by country."),
            ("Production time", "A cheaper supplier is worth less if orders take twice as long."),
            ("Marketplace fees", f"Etsy takes about {usd(fees)} on a {usd(price)} sale (listing, transaction, payment)."),
        ], "Compare base prices from 65 suppliers at podpricing.com", f"{SITE}/profit-calculator/",
         "Choosing a print-on-demand supplier: 5 costs to check first", "Before you choose a print-on-demand supplier, compare the real cost: base price with print, extra print areas, shipping, production time and marketplace fees. Free profit calculator with Etsy, Shopify and Amazon fees."),
        ("price-a-tshirt", "ETSY PRICING", "How to price a print-on-demand t-shirt on Etsy", [
            ("Start with the base cost", f"A Gildan 5000 costs {usd(lo)} to {usd(hi)} with print, depending on the supplier."),
            ("Add Etsy fees", f"About {usd(fees)} on a {usd(price)} sale."),
            ("Add shipping you don't charge", "Free shipping means it comes out of your margin."),
            ("Decide your profit", f"At {usd(price)} you keep {usd(price - fees - lo)} with the cheapest supplier and {usd(price - fees - med)} at a typical one."),
        ], "Run the numbers for any product with the free profit calculator", f"{SITE}/profit-calculator/?p=gildan-5000",
         "How to price a print-on-demand t-shirt on Etsy (with real numbers)", f"Pricing a POD t-shirt on Etsy: a Gildan 5000 costs {usd(lo)} to {usd(hi)} with print depending on the supplier, Etsy fees are about {usd(fees)} on a {usd(price)} sale. See your profit for every supplier."),
        ("same-blank", "SAVE ON EVERY ORDER", "Compare the same blank, not just the supplier", [
            ("Find your blank model", "Gildan 5000, Bella+Canvas 3001, Comfort Colors 1717..."),
            ("Check every supplier that prints it", f"The same Gildan 5000 is {usd(lo)} at one supplier and {usd(hi)} at another."),
            ("Mind the print basis", "Some prices are for the blank only; printing is charged separately."),
            ("Re-check every few months", "Suppliers change prices; the cheapest one today may not be next season."),
        ], "Live prices for 600+ products sold by several suppliers", f"{SITE}/compare/gildan-5000/",
         "Save on every POD order: compare the same blank across suppliers", f"The same blank costs very different amounts at different print-on-demand suppliers: a Gildan 5000 is {usd(lo)} to {usd(hi)} with print. Compare the exact model across 65 suppliers."),
    ]
    for slug, kicker, title, items, foot, link, ptitle, pdesc in guides:
        list_pin(slug, kicker, title, items, foot)
        pins.append((f"guide-{slug}", ptitle[:100], pdesc[:500], link, "print on demand tips, Etsy seller tips, POD business, print on demand pricing"))
    # karışık sıra; üçüncü seri 4 Kasım'da bitiyor, 5 Kasım'da başla
    makers_ = [p for p in pins if p[0].startswith("maker-")]
    guides_ = [p for p in pins if p[0].startswith("guide-")]
    order = []
    while makers_ or guides_:
        order += makers_[:3]
        makers_ = makers_[3:]
        if guides_:
            order.append(guides_.pop(0))
    start = date.today() + timedelta(days=30)
    with CSV_PATH.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["Title", "Media URL", "Pinterest board", "Thumbnail", "Description", "Link", "Publish date", "Keywords"])
        for i, (name, title, desc, link, kw) in enumerate(order):
            when = f"{start + timedelta(days=i // 2):%Y-%m-%d}T{'15:00' if i % 2 == 0 else '21:00'}:00"
            w.writerow([title, f"{SITE}/assets/pins/{name}.png", BOARD, "", desc, link, when, kw])
    print(f"{len(order)} pin ({len(chosen)} üretici, {len(guides)} rehber) -> CSV {CSV_PATH}")


if __name__ == "__main__":
    main()
