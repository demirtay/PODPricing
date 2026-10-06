# -*- coding: utf-8 -*-
"""İkinci pin serisi (pins.py'den farklı tasarımlar), 1000x1500:
  - "X vs Y": iki üreticinin ortak ürünlerde karşılaştırması (site/vs/<a>-vs-<b>/)
  - "En ucuz ... üreticileri": kategori rehberi sıralaması (site/cheapest/<tip>/)
  - Fiyat endeksi: genel üretici sıralaması ve fiyat farkı (site/price-index/)
Rakamlar derlenmiş sitenin sayfalarından okunur; böylece pin ile sayfa aynı şeyi söyler.
Önce `node scripts/build-site.cjs`.

Çıktı: web/pins/{vs,cheapest,index}-*.png ve pazarlama/pinterest/pinterest-toplu-yukleme-2.csv
Kullanım: python pazarlama/pinterest/pins2.py
"""
import csv
import html
import re
from datetime import date, timedelta
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SITE_DIR = ROOT / "site"
OUT = ROOT / "web" / "pins"
CSV_PATH = Path(__file__).parent / "pinterest-toplu-yukleme-2.csv"
SITE = "https://podpricing.com"
BOARD = "Print on Demand Price Comparisons"
W, H = 1000, 1500
BG, CARD, INK, MUTED, GREEN, DARK = "#ecfdf5", "#ffffff", "#0f172a", "#5b6576", "#059669", "#0f141c"
COL_A, COL_B = "#4f46e5", "#ea580c"
FONT, BOLD = "C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/segoeuib.ttf"
_fonts = {}


def f(size, bold=False):
    key = (size, bold)
    if key not in _fonts:
        _fonts[key] = ImageFont.truetype(BOLD if bold else FONT, size)
    return _fonts[key]


def text_of(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def money(s):
    return float(s.replace("$", "").replace(",", ""))


def fit(d, text, size, width, bold=True, min_size=28):
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


def frame(title_lines, kicker):
    """Ortak iskelet: açık yeşil zemin, üstte etiket + başlık, altta koyu site şeridi."""
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([60, 60, 60 + d.textlength(kicker, font=f(28, True)) + 40, 112], radius=26, fill=GREEN)
    d.text((80, 86), kicker, font=f(28, True), fill="#ffffff", anchor="lm")
    y = 150
    for line in title_lines:
        d.text((60, y), line, font=f(70, True), fill=INK)
        y += 84
    d.rectangle([0, H - 130, W, H], fill=DARK)
    d.text((60, H - 65), "podpricing.com", font=f(46, True), fill="#ffffff", anchor="lm")
    d.text((W - 60, H - 65), "free · updated twice a day", font=f(28), fill="#9aa6b8", anchor="rm")
    return img, d, y


def save(img, name):
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / f"{name}.png", optimize=True)


# ---------- X vs Y
def parse_vs(slug):
    page = (SITE_DIR / "vs" / slug / "index.html").read_text(encoding="utf-8")
    names = [text_of(m) for m in re.findall(r'<div class="vs-side"><a [^>]*><b>(.*?)</b>', page)]
    wins = [int(a) for a in re.findall(r"is cheaper on (\d+) of \d+ products", page)]
    total = int(re.search(r"one of each of the (\d+) shared products", page).group(1))
    sums = re.search(r"costs (\$[\d,]+\.\d{2}) at .*? and (\$[\d,]+\.\d{2}) at", page)
    verdict = text_of(re.search(r'<div class="verdict"><b>(.*?)</b>', page).group(1))
    body = re.search(r"<tbody>(.*?)</tbody>", page, re.S).group(1)
    rows = []
    for tr in re.findall(r"<tr>(.*?)</tr>", body, re.S)[:6]:
        tds = re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)
        rows.append((text_of(tds[0]), text_of(tds[1]), text_of(tds[2])))
    return {"names": names, "wins": wins, "total": total, "sums": (sums.group(1), sums.group(2)), "verdict": verdict, "rows": rows}


def vs_pin(slug, v):
    a, b = v["names"]
    img, d, y = frame(wrap(ImageDraw.Draw(Image.new("RGB", (1, 1))), f"{a} vs {b}", f(70, True), W - 120)[:2], "WHICH IS CHEAPER?")
    d.text((60, y + 4), f"{v['total']} identical products compared, print included", font=f(32), fill=MUTED)
    y += 70
    # iki taraf: kazanma sayısı
    for i, (name, col) in enumerate(((a, COL_A), (b, COL_B))):
        x0 = 60 + i * 450
        d.rounded_rectangle([x0, y, x0 + 430, y + 230], radius=24, fill=CARD, outline=col, width=4)
        d.text((x0 + 215, y + 50), name, font=fit(d, name, 42, 390), fill=col, anchor="mm")
        d.text((x0 + 215, y + 125), str(v["wins"][i]), font=f(84, True), fill=INK, anchor="mm")
        d.text((x0 + 215, y + 190), "products cheaper", font=f(28), fill=MUTED, anchor="mm")
    y += 270
    for line in wrap(d, v["verdict"], f(36, True), W - 120)[:2]:
        d.text((60, y), line, font=f(36, True), fill=GREEN)
        y += 48
    y += 20
    # örnek ürünler tablosu
    d.rounded_rectangle([60, y, W - 60, y + 80 + 78 * len(v["rows"])], radius=24, fill=CARD)
    d.text((90, y + 40), "Product", font=f(28, True), fill=MUTED, anchor="lm")
    d.text((700, y + 40), a, font=fit(d, a, 28, 150), fill=COL_A, anchor="rm")
    d.text((W - 90, y + 40), b, font=fit(d, b, 28, 150), fill=COL_B, anchor="rm")
    y += 80
    for name, pa, pb in v["rows"]:
        cy = y + 39
        d.text((90, cy), name, font=fit(d, name, 32, 430, bold=False), fill=INK, anchor="lm")
        win_a = money(pa) < money(pb)
        d.text((700, cy), pa, font=f(34, win_a), fill=GREEN if win_a else INK, anchor="rm")
        d.text((W - 90, cy), pb, font=f(34, not win_a and pa != pb), fill=GREEN if money(pb) < money(pa) else INK, anchor="rm")
        y += 78
    save(img, f"vs-{slug}")


# ---------- en ucuz ... üreticileri
def parse_cheapest(slug):
    page = (SITE_DIR / "cheapest" / slug / "index.html").read_text(encoding="utf-8")
    h1 = text_of(re.search(r"<h1>(.*?)</h1>", page).group(1))
    lead = text_of(re.search(r'<div class="verdict"><p[^>]*>(.*?)</p>', page, re.S).group(1))
    lo = re.search(r"lowest print-included price we found is (\$[\d,]+\.\d{2})", lead).group(1)
    med = re.search(r"typical \(median\) price is (\$[\d,]+\.\d{2})", lead).group(1)
    n = int(re.search(r"We compared (\d+)", lead).group(1))
    body = re.search(r"<tbody>(.*?)</tbody>", page, re.S).group(1)
    sup = []
    for tr in re.findall(r"<tr>(.*?)</tr>", body, re.S)[:7]:
        tds = re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)
        sup.append((re.sub(r"^\d+\.\s*", "", text_of(tds[0])), int(re.match(r"\s*(\d+)", text_of(tds[1])).group(1)), int(text_of(tds[3]))))
    return {"h1": h1, "lo": lo, "med": med, "n": n, "sup": sup}


def cheapest_pin(slug, c):
    label = c["h1"].replace("Cheapest print-on-demand ", "")
    img, d, y = frame(wrap(ImageDraw.Draw(Image.new("RGB", (1, 1))), f"Cheapest suppliers for {label}", f(70, True), W - 120)[:3], "SUPPLIER RANKING")
    d.text((60, y + 4), f"{c['n']} {label} compared across POD suppliers", font=f(32), fill=MUTED)
    y += 70
    # iki rakam kutusu
    for i, (val, cap) in enumerate(((c["lo"], "lowest price"), (c["med"], "typical price"))):
        x0 = 60 + i * 450
        d.rounded_rectangle([x0, y, x0 + 430, y + 170], radius=24, fill=CARD)
        d.text((x0 + 215, y + 70), val, font=f(72, True), fill=GREEN if i == 0 else INK, anchor="mm")
        d.text((x0 + 215, y + 135), cap, font=f(28), fill=MUTED, anchor="mm")
    y += 210
    d.text((60, y), "Price index (100 = typical price, lower is cheaper)", font=f(28), fill=MUTED)
    y += 50
    rows = c["sup"]
    row_h = min(100, (H - 130 - 40 - y) // len(rows))
    top = max(x[1] for x in rows)
    for i, (name, idx, _n) in enumerate(rows):
        cy = y + i * row_h + row_h // 2
        d.text((60, cy), f"{i + 1}. {name}", font=fit(d, f"{i + 1}. {name}", 36, 330, bold=i == 0), fill=INK, anchor="lm")
        length = int(420 * idx / top)
        d.rounded_rectangle([400, cy - 24, 400 + length, cy + 24], radius=12, fill=GREEN if idx < 100 else "#cbd5e1")
        d.text((W - 60, cy), str(idx), font=f(36, True), fill=GREEN if idx < 100 else INK, anchor="rm")
    save(img, f"cheapest-{slug}")


# ---------- fiyat endeksi
def index_pins():
    rows = list(csv.DictReader((SITE_DIR / "price-index" / "pod-price-index-suppliers.csv").open(encoding="utf-8")))
    blanks = list(csv.DictReader((SITE_DIR / "price-index" / "pod-price-index-blanks.csv").open(encoding="utf-8")))
    month = f"{date.today():%B %Y}"
    # 1) genel sıralama
    img, d, y = frame(["Cheapest POD", "suppliers overall"], f"POD PRICE INDEX · {month.upper()}")
    d.text((60, y + 4), "Average price vs. the typical price for the same product", font=f(30), fill=MUTED)
    y += 70
    top = rows[:10]
    row_h = (H - 130 - 40 - y) // len(top)
    hi = max(int(r["price_index"]) for r in top)
    for i, r in enumerate(top):
        cy = y + i * row_h + row_h // 2
        idx = int(r["price_index"])
        d.text((60, cy), f"{i + 1}. {r['supplier']}", font=f(36, i == 0), fill=INK, anchor="lm")
        d.rounded_rectangle([420, cy - 22, 420 + int(400 * idx / hi), cy + 22], radius=12, fill=GREEN if idx < 100 else "#cbd5e1")
        pct = 100 - idx
        d.text((W - 60, cy), f"−{pct}%" if pct > 0 else f"+{-pct}%", font=f(34, True), fill=GREEN if pct > 0 else INK, anchor="rm")
    save(img, "index-ranking")
    # 2) aynı ürün, farklı fiyat: en geniş fiyat aralıkları
    img, d, y = frame(["Same blank,", "very different price"], f"POD PRICE INDEX · {month.upper()}")
    d.text((60, y + 4), "Lowest vs highest print-included price across suppliers", font=f(30), fill=MUTED)
    y += 80
    wide = sorted(blanks, key=lambda r: float(r["highest_usd"]) / float(r["lowest_usd"]), reverse=True)[:7]
    row_h = (H - 130 - 40 - y) // len(wide)
    for i, r in enumerate(wide):
        cy = y + i * row_h + row_h // 2
        d.rounded_rectangle([60, cy - row_h // 2 + 8, W - 60, cy + row_h // 2 - 8], radius=20, fill=CARD)
        d.text((90, cy - 22), r["blank"], font=fit(d, r["blank"], 34, 560), fill=INK, anchor="lm")
        d.text((90, cy + 24), f"cheapest at {r['cheapest_supplier']}", font=f(26), fill=MUTED, anchor="lm")
        d.text((W - 90, cy - 20), f"${r['lowest_usd']} → ${r['highest_usd']}", font=f(36, True), fill=GREEN, anchor="rm")
        d.text((W - 90, cy + 24), f"{round((float(r['highest_usd']) / float(r['lowest_usd']) - 1) * 100)}% more", font=f(26), fill=MUTED, anchor="rm")
    save(img, "index-spread")
    return top, wide


def main():
    pins = []  # (dosya adı, başlık, açıklama, link, anahtar kelimeler)
    vs_slugs = []
    for p in (SITE_DIR / "vs").iterdir():
        if p.is_dir():
            v = parse_vs(p.name)
            if len(v["names"]) == 2 and len(v["wins"]) == 2:
                vs_slugs.append((v["total"], p.name, v))
    vs_slugs.sort(reverse=True)
    for _, slug, v in vs_slugs[:12]:
        vs_pin(slug, v)
        a, b = v["names"]
        pins.append((f"vs-{slug}", f"{a} vs {b}: which print-on-demand supplier is cheaper?",
                     f"{a} vs {b} on {v['total']} identical products (print included): {v['verdict']} {a} is cheaper on {v['wins'][0]} products, "
                     f"{b} on {v['wins'][1]}. See every product side by side before you pick a POD supplier for your Etsy or Shopify store.",
                     f"{SITE}/vs/{slug}/", f"{a} vs {b}, print on demand, POD supplier, Etsy seller, {a}, {b}"))
    guides = []
    for p in (SITE_DIR / "cheapest").iterdir():
        if p.is_dir():
            c = parse_cheapest(p.name)
            guides.append((c["n"], p.name, c))
    guides.sort(reverse=True)
    for _, slug, c in guides[:16]:
        cheapest_pin(slug, c)
        label = c["h1"].replace("Cheapest print-on-demand ", "")
        best = c["sup"][0][0]
        pins.append((f"cheapest-{slug}", f"Cheapest print-on-demand {label}: supplier ranking"[:100],
                     f"Which POD supplier is cheapest for {label}? We compared {c['n']} {label} across suppliers: prices start at {c['lo']}, "
                     f"the typical price is {c['med']}, and {best} is the cheapest on average. Live prices, updated twice a day.",
                     f"{SITE}/cheapest/{slug}/", f"print on demand {label}, cheapest POD supplier, {label}, Etsy seller, Printful, Printify"))
    top, wide = index_pins()
    pins.append(("index-ranking", f"Cheapest print-on-demand suppliers overall ({date.today():%B %Y})",
                 f"POD Price Index: {top[0]['supplier']}, {top[1]['supplier']} and {top[2]['supplier']} are the cheapest print-on-demand suppliers on average "
                 f"for identical products. Full ranking of 20+ suppliers with free CSV data.", f"{SITE}/price-index/",
                 "print on demand suppliers, cheapest POD supplier, Printful, Printify, POD price index"))
    pins.append(("index-spread", "The same blank costs up to 3x more at some print-on-demand suppliers",
                 f"Same blank, very different price: {wide[0]['blank']} costs ${wide[0]['lowest_usd']} to ${wide[0]['highest_usd']} depending on the "
                 f"POD supplier (print included). Check the POD Price Index before you choose a supplier.", f"{SITE}/price-index/",
                 "print on demand, POD price comparison, Gildan 5000, Bella Canvas 3001, Etsy seller"))
    # karışık sırayla, günde 2 pin, yarından başlayarak
    order = []
    groups = [[p for p in pins if p[0].startswith(k)] for k in ("vs-", "cheapest-", "index-")]
    while any(groups):
        for g in groups:
            if g:
                order.append(g.pop(0))
    start = date(2026, 10, 22)  # 1. seri 21 Ekim'de bitiyor
    with CSV_PATH.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["Title", "Media URL", "Pinterest board", "Thumbnail", "Description", "Link", "Publish date", "Keywords"])
        for i, (name, title, desc, link, kw) in enumerate(order):
            when = f"{start + timedelta(days=i // 2):%Y-%m-%d}T{'15:00' if i % 2 == 0 else '21:00'}:00"
            w.writerow([title[:100], f"{SITE}/assets/pins/{name}.png", BOARD, "", desc[:500], link, when, kw])
    print(f"{len(order)} pin -> {OUT}\nCSV -> {CSV_PATH}")


if __name__ == "__main__":
    main()
