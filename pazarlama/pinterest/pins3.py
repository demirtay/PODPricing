# -*- coding: utf-8 -*-
"""Üçüncü pin serisi (koyu tasarım), 1000x1500:
  - Kâr: popüler ürünü Etsy'de satınca en ucuz ve en pahalı üreticiyle satış başına kâr
    (Etsy kesintileri sitedeki kâr hesaplayıcıyla aynı: web/site.js FEES.etsy)
  - Alternatifler: "<Üretici> alternatifleri" sayfasındaki daha ucuz rakipler (site/alternatives/<id>/)
Veri derlenmiş siteden okunur; önce `node scripts/build-site.cjs`.

Çıktı: web/pins/{profit,alt}-*.png ve pazarlama/pinterest/pinterest-toplu-yukleme-3.csv
Kullanım: python pazarlama/pinterest/pins3.py
"""
import csv
import html
import json
import math
import re
from datetime import date, timedelta
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SITE_DIR = ROOT / "site"
OUT = ROOT / "web" / "pins"
CSV_PATH = Path(__file__).parent / "pinterest-toplu-yukleme-3.csv"
SITE = "https://podpricing.com"
BOARD = "Print on Demand Price Comparisons"
W, H = 1000, 1500
BG, CARD, INK, MUTED, NEON, RED, LINE = "#0f141c", "#171e29", "#e8edf5", "#9aa6b8", "#4ade80", "#f87171", "#263142"
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


def etsy_fees(rev):
    # web/site.js FEES.etsy ile aynı: listeleme 0,20 + %6,5 işlem + %3 + 0,25 ödeme
    return 0.20 + rev * 0.065 + rev * 0.03 + 0.25


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
    d.text((60, 90), kicker, font=f(30, True), fill=NEON, anchor="lm")
    d.line([60, 125, 160, 125], fill=NEON, width=5)
    y = 160
    for line in wrap(d, title, f(68, True), W - 120)[:3]:
        d.text((60, y), line, font=f(68, True), fill=INK)
        y += 82
    d.line([60, H - 140, W - 60, H - 140], fill=LINE, width=2)
    d.text((60, H - 75), "podpricing.com", font=f(48, True), fill=INK, anchor="lm")
    d.text((W - 60, H - 75), "compare POD prices free", font=f(28), fill=MUTED, anchor="rm")
    return img, d, y


def save(img, name):
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / f"{name}.png", optimize=True)


# ---------- kâr
def profit_pin(slug, name, offers):
    med = sorted(o[2] for o in offers)[(len(offers) - 1) // 2] / 100
    price = max(14.99, math.ceil(med * 2.5) - 0.01)  # tipik Etsy fiyatı: üretim maliyetinin ~2,5 katı
    fees = etsy_fees(price)
    lo, hi = offers[0], offers[-1]
    p_lo, p_hi = price - fees - lo[2] / 100, price - fees - hi[2] / 100
    img, d, y = frame(f"Selling {name} on Etsy?", "PROFIT PER SALE")
    d.text((60, y + 6), f"If you sell one for {usd(price)}, after Etsy fees ({usd(fees)}):", font=f(32), fill=MUTED)
    y += 80
    for i, (o, p, col, cap) in enumerate(((lo, p_lo, NEON, "cheapest supplier"), (hi, p_hi, RED, "most expensive supplier"))):
        top = y + i * 300
        d.rounded_rectangle([60, top, W - 60, top + 270], radius=28, fill=CARD, outline=col, width=3)
        d.text((100, top + 55), cap.upper(), font=f(26, True), fill=MUTED, anchor="lm")
        d.text((100, top + 115), o[1], font=fit(d, o[1], 50, 480), fill=INK, anchor="lm")
        d.text((100, top + 185), f"cost {usd(o[2] / 100)}", font=f(34), fill=MUTED, anchor="lm")
        d.text((W - 100, top + 130), usd(p), font=f(92, True), fill=col, anchor="rm")
        d.text((W - 100, top + 210), "profit per sale", font=f(28), fill=MUTED, anchor="rm")
    y += 620
    diff = p_lo - p_hi
    d.text((60, y), f"{usd(diff)} more profit on every order", font=fit(d, f"{usd(diff)} more profit on every order", 52, W - 120), fill=NEON)
    y += 75
    d.text((60, y), f"just by choosing the cheaper of {len(offers)} suppliers.", font=f(36), fill=INK)
    y += 70
    for line in wrap(d, "Print included, before shipping and tax. Calculate your own price with the free profit calculator.", f(28), W - 120):
        d.text((60, y), line, font=f(28), fill=MUTED)
        y += 40
    save(img, f"profit-{slug}")
    return price, p_lo, p_hi, lo[1], hi[1]


# ---------- alternatifler
def parse_alt(pid):
    page = (SITE_DIR / "alternatives" / pid / "index.html").read_text(encoding="utf-8")
    name = text_of(re.search(r"<h1>(.*?)</h1>", page).group(1)).replace(" alternatives", "")
    body = re.search(r"<tbody>(.*?)</tbody>", page, re.S).group(1)
    rows = []
    for tr in re.findall(r"<tr>(.*?)</tr>", body, re.S):
        tds = [text_of(t) for t in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)]
        m = re.match(r"(\d+)% cheaper", tds[1])
        n = int(tds[3])
        if m and n >= 10:  # az ortak ürünle şişen sonuçları alma
            rows.append((re.sub(r"^\d+\.\s*", "", tds[0]), int(m.group(1)), tds[2], n))
    return name, rows[:6]


def alt_pin(pid, name, rows):
    img, d, y = frame(f"{name} alternatives that cost less", "CHEAPER ALTERNATIVES")
    d.text((60, y + 6), f"Compared with {name} on products both of them sell", font=f(32), fill=MUTED)
    y += 90
    row_h = min(170, (H - 140 - 40 - y) // len(rows))
    for i, (other, pct, wins, n) in enumerate(rows):
        top = y + i * row_h
        d.rounded_rectangle([60, top, W - 60, top + row_h - 20], radius=24, fill=CARD)
        cy = top + (row_h - 20) // 2
        d.text((100, cy - 24), other, font=fit(d, other, 44, 480), fill=INK, anchor="lm")
        d.text((100, cy + 30), f"cheaper on {wins} shared products", font=f(28), fill=MUTED, anchor="lm")
        d.text((W - 100, cy), f"−{pct}%", font=f(72, True), fill=NEON, anchor="rm")
    save(img, f"alt-{pid}")


def main():
    pins = []
    groups = json.loads((SITE_DIR / "data" / "groups-en.json").read_text(encoding="utf-8"))
    made = 0
    for slug, name, *_ in groups:
        offers = sorted((o for o in json.loads((SITE_DIR / "data" / "g" / f"{slug}.json").read_text(encoding="utf-8")) if o[3] == "dahil"), key=lambda o: o[2])
        if len(offers) < 5:
            continue
        price, p_lo, p_hi, lo_name, hi_name = profit_pin(slug, name, offers)
        pins.append((f"profit-{slug}", f"{name} on Etsy: profit per sale by print-on-demand supplier"[:100],
                     f"Selling {name} on Etsy for {usd(price)}? After Etsy fees you keep {usd(p_lo)} per sale with {lo_name} "
                     f"but only {usd(p_hi)} with {hi_name}. Compare {len(offers)} POD suppliers and calculate your own profit for free.",
                     f"{SITE}/profit-calculator/?p={slug}", f"Etsy profit, print on demand, {name}, POD supplier, Etsy fees, Etsy seller"))
        made += 1
        if made >= 18:
            break
    for p in sorted((SITE_DIR / "alternatives").iterdir()):
        if not p.is_dir():
            continue
        name, rows = parse_alt(p.name)
        if len(rows) < 3:
            continue
        alt_pin(p.name, name, rows)
        pins.append((f"alt-{p.name}", f"{name} alternatives: cheaper print-on-demand suppliers",
                     f"Looking for a cheaper {name} alternative? On products both sell, {rows[0][0]} is {rows[0][1]}% cheaper"
                     + (f" and {rows[1][0]} {rows[1][1]}% cheaper" if len(rows) > 1 else "") + f" than {name}. See the full comparison, updated twice a day.",
                     f"{SITE}/alternatives/{p.name}/", f"{name} alternative, cheaper than {name}, print on demand, POD supplier"))
    # karışık sıra: kâr, kâr, alternatif ...
    profit = [x for x in pins if x[0].startswith("profit-")]
    alts = [x for x in pins if x[0].startswith("alt-")]
    order = []
    while profit or alts:
        order += profit[:2]
        profit = profit[2:]
        if alts:
            order.append(alts.pop(0))
    # ikinci serinin bitiminden sonra başla (o 21 Ekim'e kadar sürüyor)
    start = date.today() + timedelta(days=16)
    with CSV_PATH.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["Title", "Media URL", "Pinterest board", "Thumbnail", "Description", "Link", "Publish date", "Keywords"])
        for i, (name, title, desc, link, kw) in enumerate(order):
            when = f"{start + timedelta(days=i // 2):%Y-%m-%d}T{'15:00' if i % 2 == 0 else '21:00'}:00"
            w.writerow([title[:100], f"{SITE}/assets/pins/{name}.png", BOARD, "", desc[:500], link, when, kw])
    print(f"{len(order)} pin ({len([x for x in order if x[0].startswith('profit-')])} kâr, {len([x for x in order if x[0].startswith('alt-')])} alternatif) -> CSV {CSV_PATH}")


if __name__ == "__main__":
    main()
