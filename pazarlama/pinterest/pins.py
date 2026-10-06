# -*- coding: utf-8 -*-
"""Pinterest pin görselleri: en çok üreticide satılan ürünler için fiyat kartı (1000x1500).

Veri: derlenmiş site (site/data/groups-en.json + site/data/g/<slug>.json); önce `node scripts/build-site.cjs`.
Çıktı: web/pins/<slug>.png (site ile birlikte /assets/pins/ altında yayınlanır, Pinterest görseli oradan çeker)
ve pazarlama/pinterest/pinterest-toplu-yukleme.csv (Pinterest "toplu pin oluştur" dosyası).
Yalnızca baskısı kesin dahil (pb=dahil) teklifler kullanılır; sitedeki rehberlerle aynı kural.

Kullanım: python pazarlama/pinterest/pins.py [adet]
"""
import csv
import json
import sys
from datetime import date, timedelta
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "site" / "data"
OUT = ROOT / "web" / "pins"
CSV_PATH = Path(__file__).parent / "pinterest-toplu-yukleme.csv"
SITE = "https://podpricing.com"
BOARD = "Print on Demand Price Comparisons"
W, H = 1000, 1500
INK, MUTED, ACCENT, HEAD, BAR, BG = "#0f172a", "#5b6576", "#059669", "#0f141c", "#d1fae5", "#ffffff"
FONT = "C:/Windows/Fonts/segoeui.ttf"
BOLD = "C:/Windows/Fonts/segoeuib.ttf"


def font(path, size):
    return ImageFont.truetype(path, size)


def usd(minor):
    return f"${minor / 100:,.2f}"


def wrap(draw, text, f, width):
    lines, line = [], ""
    for word in text.split():
        test = f"{line} {word}".strip()
        if draw.textlength(test, font=f) <= width:
            line = test
        else:
            lines.append(line)
            line = word
    return lines + [line]


def pin(slug, name, offers):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    # üst şerit
    d.rectangle([0, 0, W, 120], fill=HEAD)
    d.text((60, 60), "POD", font=font(BOLD, 44), fill="#ffffff", anchor="lm")
    d.text((60 + d.textlength("POD ", font=font(BOLD, 44)), 60), "Pricing", font=font(BOLD, 44), fill="#34d399", anchor="lm")
    d.text((W - 60, 60), "price comparison", font=font(FONT, 30), fill="#9aa6b8", anchor="rm")
    # başlık
    y = 170
    f = font(BOLD, 64)
    for line in wrap(d, f"Cheapest {name}", f, W - 120)[:3]:
        d.text((60, y), line, font=f, fill=INK)
        y += 78
    d.text((60, y + 6), f"{len(offers)} print-on-demand suppliers compared · print included", font=font(FONT, 32), fill=MUTED)
    y += 80
    lo, hi = offers[0][2], offers[-1][2]
    d.text((60, y), f"from {usd(lo)}", font=font(BOLD, 96), fill=ACCENT)
    y += 120
    d.text((60, y), f"most expensive: {usd(hi)}  ·  {round((hi / lo - 1) * 100)}% more", font=font(FONT, 34), fill=MUTED)
    y += 80
    # en ucuz 8 üretici: çubuk grafik
    rows = offers[:8]
    fr, fp = font(FONT, 36), font(BOLD, 36)
    # satırlar alt şerit ve tarih notunun üstüne sığsın
    bar_x, bar_w = 360, W - 360 - 200
    row_h = min(92, (H - 150 - 60 - y) // len(rows))
    for i, (_, pname, price, *_rest) in enumerate(rows):
        cy = y + i * row_h + row_h // 2
        d.text((60, cy), f"{i + 1}. {pname}", font=fp if i == 0 else fr, fill=INK, anchor="lm")
        length = max(8, int(bar_w * price / hi))
        d.rounded_rectangle([bar_x, cy - 22, bar_x + length, cy + 22], radius=10, fill=ACCENT if i == 0 else BAR)
        d.text((W - 60, cy), usd(price), font=fp, fill=ACCENT if i == 0 else INK, anchor="rm")
    # alt bilgi
    d.rectangle([0, H - 150, W, H], fill=HEAD)
    d.text((W // 2, H - 98), "Live prices for every supplier", font=font(FONT, 34), fill="#9aa6b8", anchor="mm")
    d.text((W // 2, H - 50), "podpricing.com", font=font(BOLD, 46), fill="#ffffff", anchor="mm")
    d.text((W - 60, H - 170), f"Prices as of {date.today():%b %Y}, before shipping", font=font(FONT, 24), fill=MUTED, anchor="rs")
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / f"{slug}.png", optimize=True)


def main(limit):
    groups = json.loads((DATA / "groups-en.json").read_text(encoding="utf-8"))
    made = []
    for slug, name, _img, _lo, _n, _type in groups:
        offers = [o for o in json.loads((DATA / "g" / f"{slug}.json").read_text(encoding="utf-8")) if o[3] == "dahil"]
        if len(offers) < 5:
            continue
        offers.sort(key=lambda o: o[2])
        pin(slug, name, offers)
        made.append((slug, name, offers))
        if len(made) >= limit:
            break
    # Pinterest toplu yükleme: günde 2 pin, yarından başlayarak (spam görünmesin)
    start = date(2026, 10, 7)  # takvim: 1. seri 7–21 Eki, 2. seri 22 Eki–5 Kas, 3. seri 6–19 Kas, 4. seri 20–24 Kas
    with CSV_PATH.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["Title", "Media URL", "Pinterest board", "Thumbnail", "Description", "Link", "Publish date", "Keywords"])
        for i, (slug, name, offers) in enumerate(made):
            lo, hi = offers[0], offers[-1]
            title = f"Cheapest {name} for print on demand: {len(offers)} suppliers compared"[:100]
            desc = (f"The same {name} costs {usd(lo[2])} at {lo[1]} and up to {usd(hi[2])} at other print-on-demand suppliers "
                    f"(print included, before shipping). Compare live prices from {len(offers)} POD suppliers before you choose one "
                    f"for your Etsy or Shopify store.")[:500]
            when = f"{start + timedelta(days=i // 2):%Y-%m-%d}T{'15:00' if i % 2 == 0 else '21:00'}:00"
            w.writerow([title, f"{SITE}/assets/pins/{slug}.png", BOARD, "", desc, f"{SITE}/compare/{slug}/", when,
                        f"print on demand, {name}, POD supplier, Etsy seller, Printful, Printify"])
    print(f"{len(made)} pin -> {OUT}\nCSV -> {CSV_PATH}")


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 30)
