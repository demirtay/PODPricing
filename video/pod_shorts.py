# -*- coding: utf-8 -*-
"""POD Pricing -- YouTube Shorts / TikTok / Reels (1080x1920, ~35-50 sn).

Veri: site/data/groups-en.json + site/data/g/<slug>.json (scripts/build-site.cjs üretir).
Yalnızca baskı dahil (pb=dahil) teklifler kullanılır.

Sahne görselleri HTML şablonundan headless Chrome ile çizilir; seslendirme Google Cloud TTS (en-US Chirp3-HD),
cümle cümle üretilip birleştirilir (Gökyüzü Postası'ndaki tts/assemble mantığı). Sahne süresi = cümlenin süresi.

Kullanım (what-if-factory .venv python):
    python pod_shorts.py build gildan-5000 bella-canvas-3001 ...
    python pod_shorts.py build all          (VIDEOS listesi)
    python pod_shorts.py build vs           (Printful vs Printify)
Çıktı: video/out/<ad>.mp4 + <ad>.json (başlık, açıklama, etiketler)
"""

import html
import json
import os
import subprocess
import sys
import wave
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent
DATA = ROOT / "site" / "data"
OUT = HERE / "out"
WORK = HERE / "work"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
W, H = 1080, 1920
SR, RATE, GAP, HOLD = 24000, 1.04, 0.28, 1.2
VOICE = ("en-US", "en-US-Chirp3-HD-Charon")

# karşılaştırma sayfası olan ve en çok üreticide satılan ürünler
VIDEOS = ["gildan-5000", "bella-canvas-3001", "comfort-colors-1717", "gildan-18500", "mugs-11oz-white",
          "tumblers-20oz", "gildan-18000", "next-level-3600", "mugs-15oz", "gildan-64000"]


def money(minor: int) -> str:
    return f"${minor / 100:.2f}"


def load_group(slug: str):
    groups = {g[0]: g for g in json.loads((DATA / "groups-en.json").read_text(encoding="utf-8"))}
    g = groups[slug]
    offers = [o for o in json.loads((DATA / "g" / f"{slug}.json").read_text(encoding="utf-8")) if o[3] == "dahil"]
    offers.sort(key=lambda o: o[2])
    return {"slug": slug, "name": g[1], "image": g[2], "offers": offers}


# ---------------------------------------------------------------- sahneler (HTML)
CSS = """
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1920px;overflow:hidden;font-family:'Segoe UI',system-ui,sans-serif;color:#fff;
 background:radial-gradient(1200px 900px at 50% 20%,#14324a 0%,#0b1622 55%,#070d14 100%)}
.brand{position:absolute;top:70px;left:0;right:0;text-align:center;font-size:44px;font-weight:800;letter-spacing:-1px}
.brand span{color:#34d399}
.wrap{position:absolute;left:70px;right:70px;top:190px;bottom:150px;display:flex;flex-direction:column;justify-content:center;gap:34px}
h1{font-size:84px;line-height:1.05;font-weight:800;letter-spacing:-2px}
h2{font-size:58px;line-height:1.1;font-weight:800}
.sub{font-size:44px;color:#a7b6c8;line-height:1.25}
.big{font-size:150px;font-weight:900;color:#34d399;letter-spacing:-4px;line-height:1}
.img{width:620px;height:620px;border-radius:40px;background:#fff center/contain no-repeat;align-self:center;box-shadow:0 30px 80px rgba(0,0,0,.45)}
.range{display:flex;justify-content:space-between;align-items:flex-end;font-size:64px;font-weight:800}
.range .lo{color:#34d399}.range .hi{color:#f87171}
.row{display:flex;align-items:center;gap:28px;background:rgba(255,255,255,.06);border:2px solid rgba(255,255,255,.08);border-radius:28px;padding:30px 36px;font-size:52px}
.row .n{width:70px;height:70px;border-radius:50%;background:rgba(255,255,255,.12);display:grid;place-items:center;font-weight:800;font-size:40px;flex:none}
.row .m{flex:1;font-weight:700}.row .p{font-weight:900}
.row.on{background:#34d399;color:#04291b;border-color:#34d399;transform:scale(1.04)}
.row.on .n{background:#04291b;color:#34d399}
.row.hide{opacity:0}
.vs{display:flex;gap:30px}.vs div{flex:1;background:rgba(255,255,255,.07);border-radius:30px;padding:40px;text-align:center}
.vs b{display:block;font-size:46px;margin-bottom:16px}.vs span{font-size:96px;font-weight:900}
.cta{font-size:76px;font-weight:900;color:#34d399;text-align:center}
.foot{position:absolute;bottom:70px;left:0;right:0;text-align:center;font-size:34px;color:#7f93aa}
"""


def page(body: str) -> str:
    return (f"<!doctype html><html><head><meta charset='utf-8'><style>{CSS}</style></head><body>"
            f"<div class='brand'>POD<span>Pricing</span></div><div class='wrap'>{body}</div>"
            f"<div class='foot'>Base cost, print included · before shipping</div></body></html>")


def render(html_text: str, png: Path):
    src = png.with_suffix(".html")
    src.write_text(html_text, encoding="utf-8")
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--virtual-time-budget=6000",
                    f"--window-size={W},{H}", f"--screenshot={png}", src.as_uri()],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


# ---------------------------------------------------------------- seslendirme
def tts(lines, d: Path):
    from dotenv import load_dotenv
    env_dir = Path(r"C:\Users\alidemirtay\Desktop\sleep-story-factory")
    load_dotenv(dotenv_path=env_dir / ".env")
    cred = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if cred and not os.path.isabs(cred):
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str((env_dir / cred).resolve())
    from google.cloud import texttospeech
    client = texttospeech.TextToSpeechClient()
    voice = texttospeech.VoiceSelectionParams(language_code=VOICE[0], name=VOICE[1])
    cfg = texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.LINEAR16, sample_rate_hertz=SR, speaking_rate=RATE)
    for i, text in enumerate(lines):
        wav, mk = d / f"b{i:02d}.wav", d / f"b{i:02d}.txt"
        if wav.exists() and mk.exists() and mk.read_text(encoding="utf-8") == text:
            continue
        r = client.synthesize_speech(input=texttospeech.SynthesisInput(text=text), voice=voice, audio_config=cfg)
        wav.write_bytes(r.audio_content)
        mk.write_text(text, encoding="utf-8")


def trim(pcm: bytes, thresh=300) -> bytes:
    import array
    a = array.array("h", pcm)
    s, e = 0, len(a) - 1
    while s < e and abs(a[s]) < thresh:
        s += 1
    while e > s and abs(a[e]) < thresh:
        e -= 1
    return a[max(0, s - int(0.05 * SR)):min(len(a), e + int(0.12 * SR))].tobytes()


def assemble(n: int, d: Path):
    """Cümleleri birleştirir; her sahnenin süresini döndürür."""
    pcm, durs = bytearray(b"\x00\x00" * int(0.25 * SR)), []
    for i in range(n):
        with wave.open(str(d / f"b{i:02d}.wav"), "rb") as w:
            clip = trim(w.readframes(w.getnframes()))
        dur = len(clip) / 2 / SR + (0.25 if i == 0 else 0)
        pcm += clip
        gap = GAP if i + 1 < n else HOLD
        pcm += b"\x00\x00" * int(gap * SR)
        durs.append(round(dur + gap, 3))
    with wave.open(str(d / "narration.wav"), "wb") as w:
        w.setnchannels(1), w.setsampwidth(2), w.setframerate(SR)
        w.writeframes(bytes(pcm))
    return durs


def encode(scenes, durs, d: Path, mp4: Path):
    lst = d / "scenes.txt"
    lines = []
    for png, dur in zip(scenes, durs):
        lines += [f"file '{png.as_posix()}'", f"duration {dur}"]
    lines.append(f"file '{scenes[-1].as_posix()}'")
    lst.write_text("\n".join(lines), encoding="utf-8")
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst),
                    "-i", str(d / "narration.wav"), "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "medium",
                    "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", str(mp4)], check=True)


# ---------------------------------------------------------------- senaryolar
def product_video(slug: str):
    g = load_group(slug)
    o = g["offers"]
    if len(o) < 5:
        print(f"{slug}: yeterli baskı dahil teklif yok ({len(o)})")
        return None
    name, top = g["name"], o[:5]
    short = name.replace(" T-Shirts", " t-shirt").replace(" Hoodies", " hoodie").replace(" Sweatshirts", " sweatshirt").replace(" Tops & Blouses", " tee").replace(" Long Sleeve T-Shirts", " long sleeve tee").replace(" Tank Tops", " tank top").replace(" Zip Hoodies", " zip hoodie").replace(" Kids Clothing", " kids tee")
    lo, hi = o[0], o[-1]
    pf = next((x for x in o if x[0] == "printful"), None)
    py = next((x for x in o if x[0] == "printify"), None)
    rows = lambda show, on: "".join(
        f"<div class='row{' on' if i == on else ''}{'' if i in show else ' hide'}'><div class='n'>{i + 1}</div>"
        f"<div class='m'>{html.escape(x[1])}</div><div class='p'>{money(x[2])}</div></div>" for i, x in enumerate(top))
    scenes, lines = [], []
    img = f"<div class='img' style=\"background-image:url('{g['image']}')\"></div>" if g["image"] else ""
    scenes.append(page(f"{img}<h1>{html.escape(short)}</h1><div class='range'><span class='lo'>{money(lo[2])}</span>"
                       f"<span class='sub'>to</span><span class='hi'>{money(hi[2])}</span></div>"
                       f"<div class='sub'>Same blank, {len(o)} print-on-demand suppliers</div>"))
    lines.append(f"The exact same {short} costs {money(lo[2])} at one print-on-demand supplier, and {money(hi[2])} at another. "
                 f"Here are the five cheapest, print included.")
    for k in range(4, -1, -1):
        scenes.append(page(f"<h2>Cheapest {html.escape(short)}</h2>{rows(set(range(k, 5)), k)}"))
        lines.append(("And number one: " if k == 0 else f"Number {k + 1}: ") + f"{top[k][1]}, at {money(top[k][2])}.")
    if pf and py:
        scenes.append(page(f"<h2>And the big two?</h2><div class='vs'><div><b>Printful</b><span>{money(pf[2])}</span></div>"
                           f"<div><b>Printify</b><span>{money(py[2])}</span></div></div>"
                           f"<div class='sub'>for the same {html.escape(short)}</div>"))
        lines.append(f"For comparison, Printful charges {money(pf[2])}, and Printify {money(py[2])}.")
    scenes.append(page(f"<h2>Compare all {len(o)} suppliers</h2><div class='cta'>podpricing.com</div>"
                       f"<div class='sub' style='text-align:center'>Free · no signup · updated twice a day</div>"))
    lines.append(f"Prices update twice a day. Compare all {len(o)} suppliers for free at pod pricing dot com.")
    meta = {
        "title": f"Cheapest {short} print on demand supplier? {len(o)} compared #shorts",
        "description": f"The same {name.rstrip('s')} costs {money(lo[2])} to {money(hi[2])} depending on the print-on-demand supplier "
                       f"(base cost, print included, before shipping). Full live comparison: https://podpricing.com/compare/{slug}/\n\n"
                       f"Prices change — check the site for today's numbers.\n#printondemand #etsy #shopify #printful #printify",
        "tags": ["print on demand", "printful", "printify", "cheapest print on demand", short, "etsy seller", "pod supplier"],
    }
    return slug, scenes, lines, meta


def vs_video(slug="printful-vs-printify"):
    # sayıları sitenin karşılaştırma sayfasından okur (her üretici ikilisi için)
    import re
    page_html = (ROOT / "site" / "vs" / slug / "index.html").read_text(encoding="utf-8")
    A, B = [html.unescape(x) for x in re.search(r"<h1>(.+?) vs (.+?)</h1>", page_html).groups()]
    n = int(re.search(r"(\d+) shared products", page_html).group(1))
    wins = [int(x) for x in re.findall(r"is cheaper on (\d+) of", page_html)][:2]
    pct = re.search(r"about (\d+)% less than", page_html)
    who = re.search(r"<b>([^<]+?) is cheaper overall", page_html)
    e = html.escape
    scenes, lines = [], []
    scenes.append(page(f"<h1>{e(A)} or {e(B)}?</h1><div class='sub'>I compared all {n} products they both sell</div>"))
    lines.append(f"{A} or {B}, which one is actually cheaper? I compared all {n} products they both sell.")
    scenes.append(page(f"<div class='vs'><div><b>{e(A)}</b><span>{wins[0]}</span></div><div><b>{e(B)}</b><span>{wins[1]}</span></div></div>"
                       f"<div class='sub' style='text-align:center'>products where each one is cheaper</div>"))
    lines.append(f"{A} is cheaper on {wins[0]} products. {B} wins on {wins[1]}.")
    if who and pct:
        w = html.unescape(who.group(1))
        scenes.append(page(f"<h2>Overall winner</h2><div class='big' style='font-size:{110 if len(w) > 9 else 150}px'>{e(w)}</div>"
                           f"<div class='sub'>about {pct.group(1)}% cheaper on the same products</div>"))
        lines.append(f"Overall, {w} comes out about {pct.group(1)} percent cheaper on the same products. But it depends a lot on the product.")
    else:
        scenes.append(page(f"<h2>Overall</h2><div class='sub'>{e(A)} and {e(B)} cost about the same. It depends on the product.</div>"))
        lines.append("Overall they cost about the same, so it really depends on the product.")
    scenes.append(page("<h2>See every product side by side</h2><div class='cta'>podpricing.com</div><div class='sub' style='text-align:center'>Free · updated twice a day</div>"))
    lines.append("See every product side by side, for free, at pod pricing dot com.")
    tag = lambda x: "#" + re.sub(r"[^A-Za-z0-9]", "", x).lower()
    meta = {"title": f"{A} vs {B}: which is cheaper? I compared every product #shorts",
            "description": f"I compared all {n} products that both {A} and {B} sell (base cost, print included, before shipping). "
                           f"Full table: https://podpricing.com/vs/{slug}/\n{tag(A)} {tag(B)} #printondemand #etsy",
            "tags": [f"{A.lower()} vs {B.lower()}", A.lower(), B.lower(), "print on demand", "etsy seller"]}
    return slug, scenes, lines, meta


def build(spec):
    if not spec:
        return
    name, scenes, lines, meta = spec
    d = WORK / name
    d.mkdir(parents=True, exist_ok=True)
    pngs = []
    for i, s in enumerate(scenes):
        png = d / f"s{i:02d}.png"
        render(s, png)
        pngs.append(png)
    tts(lines, d)
    durs = assemble(len(lines), d)
    OUT.mkdir(exist_ok=True)
    mp4 = OUT / f"{name}.mp4"
    encode(pngs, durs, d, mp4)
    meta["script"] = lines
    meta["duration"] = round(sum(durs), 1)
    (OUT / f"{name}.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{name}: {meta['duration']} sn -> {mp4}")


if __name__ == "__main__":
    cmd, *args = sys.argv[1:] or ["build", "all"]
    if cmd == "build":
        names = VIDEOS if args == ["all"] else args
        for a in names:
            build(vs_video() if a == "vs" else vs_video(a[3:]) if a.startswith("vs:") else product_video(a))
