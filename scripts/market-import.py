# ClickScrape dışa aktarımı (Excel/CSV: Link, Title, Image, price) -> data/market/<pazar>/<grup>.json
# Gerçek ilan fiyatlarından pazar özeti: ilan sayısı, en düşük, %25, ortanca, %75, en yüksek, ortalama (USD).
# Fiyat başka para birimindeyse resmi kurla (ör. TCMB) çevrilir; kur ve tarihi dosyaya yazılır. Tahmin yok: fiyatı okunmayan ilan atlanır.
# Kullanım:
#   python scripts/market-import.py DOSYA --market etsy --groups mugs-11oz,mugs-11oz-white --title "\b11\s?oz\b" \
#     --category Mugs --filter "11 oz" --collected 2026-10-18 --currency TRY --rate 49.3573 --rate-date 2026-10-16 --rate-src TCMB
import argparse, csv, json, os, re, statistics, sys

ap = argparse.ArgumentParser()
ap.add_argument('file')
ap.add_argument('--market', required=True)
ap.add_argument('--groups', required=True)
ap.add_argument('--title', default='')
ap.add_argument('--category', required=True, help='pazar yerindeki kategori adı (ör. Mugs)')
ap.add_argument('--filter', default='', help='ilan adında aranan ifade, sitede gösterilir (ör. 11 oz)')
ap.add_argument('--collected', required=True)
ap.add_argument('--currency', default='USD')
ap.add_argument('--rate', type=float, default=1.0, help='1 USD = kaç birim')
ap.add_argument('--rate-date', default='')
ap.add_argument('--rate-src', default='')
ap.add_argument('--min-n', type=int, default=30)
a = ap.parse_args()

def rows():
    if a.file.lower().endswith('.csv'):
        with open(a.file, encoding='utf-8-sig', newline='') as f:
            yield from csv.DictReader(f)
    else:
        import openpyxl
        ws = openpyxl.load_workbook(a.file, read_only=True).active
        it = ws.iter_rows(values_only=True)
        head = [str(h or '').strip() for h in next(it)]
        for r in it:
            yield dict(zip(head, r))

def num(v):
    if isinstance(v, (int, float)): return float(v)
    s = re.sub(r'[^\d.,]', '', str(v or ''))
    if not s: return None
    # 1,397.73 ya da 1.397,73
    if ',' in s and '.' in s: s = s.replace(',', '') if s.rfind('.') > s.rfind(',') else s.replace('.', '').replace(',', '.')
    elif ',' in s: s = s.replace(',', '.') if len(s.split(',')[-1]) == 2 else s.replace(',', '')
    try: return float(s)
    except ValueError: return None

key = lambda d, *names: next((d[k] for k in d if k and k.strip().lower() in names), None)
tre = re.compile(a.title, re.I) if a.title else None
seen, prices = set(), []
for d in rows():
    link, title, price = key(d, 'link', 'url'), key(d, 'title', 'başlık'), num(key(d, 'price', 'fiyat'))
    if not link or price is None or price <= 0: continue
    lid = re.sub(r'\?.*', '', str(link))
    if lid in seen: continue
    if tre and not tre.search(str(title or '')): continue
    seen.add(lid); prices.append(price / a.rate)

if len(prices) < a.min_n: sys.exit(f'yetersiz ilan: {len(prices)} (< {a.min_n})')
prices.sort()
q = statistics.quantiles(prices, n=4)
r2 = lambda x: round(x, 2)
out = {'market': a.market, 'category': a.category, 'filter': a.filter, 'source': 'ClickScrape', 'collected': a.collected, 'n': len(prices), 'currency': 'USD',
       'min': r2(prices[0]), 'p25': r2(q[0]), 'median': r2(q[1]), 'p75': r2(q[2]), 'max': r2(prices[-1]), 'mean': r2(statistics.mean(prices))}
if a.currency != 'USD': out['fx'] = {'from': a.currency, 'perUSD': a.rate, 'date': a.rate_date, 'source': a.rate_src}
root = os.path.join(os.path.dirname(__file__), '..', 'data', 'market', a.market)
os.makedirs(root, exist_ok=True)
for g in a.groups.split(','):
    with open(os.path.join(root, g.strip() + '.json'), 'w', encoding='utf-8') as f: json.dump(out, f, ensure_ascii=False, indent=1)
print(json.dumps(out, ensure_ascii=False))
