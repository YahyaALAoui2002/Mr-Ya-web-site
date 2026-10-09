"""Languages (fr / en / zh). Three layers:
   1. the dictionaries in src/i18n: same keys and same {placeholders} in every language, every key the template uses exists, no empty text;
   2. the production pages in dist/site (/, /en/, /zh/): lang, canonical, hreflang, og:locale, switcher links, sitemap, no third-party address;
   3. the browser: the portable file switches language in place (labels, flavours, order summary, roulette, price format), remembers the choice,
      honours ?lang=, leaves the order alone, and the real /en/ and /zh/ pages run without a script error."""
import json, re
from pathlib import Path
from helpers import *

I18N = ROOT / "src" / "i18n"
LANGS = ["fr", "en", "zh"]
D = {l: json.loads((I18N / f"{l}.json").read_text(encoding="utf-8")) for l in LANGS}
ph = lambda s: sorted(re.findall(r"\{[^}]+\}", s))
ok = True

# 1. dictionaries -----------------------------------------------------------------------------------------------------------------------------
ok &= check("the three dictionaries have exactly the same keys", set(D["fr"]) == set(D["en"]) == set(D["zh"]),
            str({l: sorted(set(D["fr"]) ^ set(D[l]))[:6] for l in ("en", "zh")}))
ok &= check("no empty text", all(v.strip() for l in LANGS for v in D[l].values()))
# the summary sentences may use the flavour / temperature with or without lower-casing, depending on the language: compare them as sets of ARGUMENTS
norm_ph = lambda k, s: sorted({re.sub(r"_lc$", "", x[1:-1]) if k.startswith("sum.") else x for x in ph(s)})
bad = [k for k in D["fr"] if not (norm_ph(k, D["fr"][k]) == norm_ph(k, D["en"].get(k, "")) == norm_ph(k, D["zh"].get(k, "")))]
ok &= check("every {placeholder} (names, prices) is the same in the three languages", not bad, str(bad[:6]))
tpl = (ROOT / "src" / "site.template.html").read_text(encoding="utf-8")
used = set(re.findall(r'data-i18n="([^"]+)"', tpl)) | {p.split(":", 1)[1] for a in re.findall(r'data-i18n-attr="([^"]+)"', tpl) for p in a.split(";")}
ok &= check("every key used by the template exists", used <= set(D["fr"]), str(sorted(used - set(D["fr"]))[:6]))
js_keys = set(re.findall(r"""\bt\('([a-z0-9.]+)'""", tpl)) | set(re.findall(r"""showFallback\('([a-z0-9.]+)'""", (ROOT / "src/3d/01-canvas-webgl-setup.js").read_text(encoding="utf-8")))
js_keys = {k for k in js_keys if not k.endswith(".")}                 # 'dish.' + key, 'flavor.' + ... are built at run time: checked by the browser part and the dish test below
ok &= check("every key the scripts ask for exists", js_keys <= set(D["fr"]), str(sorted(js_keys - set(D["fr"]))[:6]))
dishes = re.findall(r'\["[^"]+",\s*"(?:plats|malatang|snacks|desserts)",\s*"([a-z0-9-]+)"', tpl)
ok &= check("all 19 dishes have a name and a description in each language", len(dishes) == 19 and all(f"dish.{k}.{f}" in D[l] for k in dishes for f in ("name", "desc") for l in LANGS), str(len(dishes)))
fl = {b: re.findall(r"\['([a-z]+)','#", body) for b, body in re.findall(r"\b(lait|fruit):\[(.*?)\](?:,\n|\n  \})", tpl, flags=re.S)}
ok &= check("every flavour (8 milk, 9 fruit) has a name in each language", len(fl.get("lait", [])) == 8 and len(fl.get("fruit", [])) == 9 and all(f"flavor.{b}.{i}" in D[l] for b, ids in fl.items() for i in ids for l in LANGS), str({b: len(v) for b, v in fl.items()}))
ok &= check("English and Chinese really are translated (not copies of the French)", sum(D["en"][k] == D["fr"][k] for k in D["fr"]) < 25 and sum(D["zh"][k] == D["fr"][k] for k in D["fr"]) < 25,
            f'{sum(D["en"][k] == D["fr"][k] for k in D["fr"])} / {sum(D["zh"][k] == D["fr"][k] for k in D["fr"])} identical')
ok &= check("the Chinese text contains Chinese", sum(bool(re.search(r"[一-鿿]", v)) for v in D["zh"].values()) > 150)

# 2. production pages -------------------------------------------------------------------------------------------------------------------------
SITE = DIST / "site"
want = {"fr": ("index.html", "fr", "fr_FR", ""), "en": ("en/index.html", "en", "en_GB", "en/"), "zh": ("zh/index.html", "zh-Hans", "zh_CN", "zh/")}
for l, (f, htmllang, og, d) in want.items():
    p = SITE / f
    if not p.exists():
        ok &= check(f"dist/site/{f} exists (run `node build.mjs`)", False); continue
    h = p.read_text(encoding="utf-8")
    ok &= check(f"[{l}] <html lang>, data-lang, pages mode", f'<html lang="{htmllang}" data-lang="{l}" data-lang-mode="pages">' in h)
    ok &= check(f"[{l}] canonical and og:locale", re.search(rf'rel="canonical" href="https://[^"]+/{re.escape(d)}"', h) is not None and f'og:locale" content="{og}"' in h)
    ok &= check(f"[{l}] four hreflang alternates (fr, en, zh-Hans, x-default)", len(re.findall(r'<link rel="alternate" hreflang="', h)) == 4 and 'hreflang="zh-Hans" href="https://' in h)
    ok &= check(f"[{l}] the page is written in its language (no raw keys, no {{placeholder}} left)", "data-i18n" in h and not re.search(r"\{[a-z_€0-9.]+\}", re.sub(r"<script.*?</script>", "", h, flags=re.S)))
    ok &= check(f"[{l}] no third-party address", not re.search(r"googleapis|gstatic|jsdelivr", h))
    ok &= check(f"[{l}] the switcher marks {l} as current", re.search(rf'data-lang-set="{l}" aria-current="true"', h) is not None and h.count('aria-current="true"') >= 1)
    if d:
        ok &= check(f"[{l}] assets are reached from the sub-folder (../assets, ../apple-touch-icon.png)", 'src="../assets/three.min.js"' in h and 'href="../assets/fonts/' in h and 'href="../apple-touch-icon.png"' in h)
fr, en, zh = (SITE / want[l][0] for l in LANGS)
if fr.exists() and en.exists() and zh.exists():
    hf, he, hz = (x.read_text(encoding="utf-8") for x in (fr, en, zh))
    ok &= check("the switcher links point to the three pages (relative, trailing slash)", all(s in hf for s in ('href="./" hreflang="fr"', 'href="en/" hreflang="en"', 'href="zh/" hreflang="zh-Hans"'))
                and all(s in he for s in ('href="../" hreflang="fr"', 'href="./" hreflang="en"', 'href="../zh/" hreflang="zh-Hans"'))
                and all(s in hz for s in ('href="../" hreflang="fr"', 'href="../en/" hreflang="en"', 'href="./" hreflang="zh-Hans"')))
    ok &= check("the pages have different titles", len({re.search(r"<title[^>]*>(.*?)</title>", x).group(1) for x in (hf, he, hz)}) == 3)
    sm = (SITE / "sitemap.xml").read_text(encoding="utf-8")
    ok &= check("sitemap.xml lists the three pages, each with its alternates", sm.count("<url>") == 3 and sm.count("hreflang=") == 12, f'{sm.count("<url>")} urls, {sm.count("hreflang=")} alternates')

# 3. the browser ------------------------------------------------------------------------------------------------------------------------------
with sync_playwright() as p:
    browser, page, logs = open_page(p, "index.debug.html", 1280, 900, three=False, wait=800)
    txt = lambda sel: page.evaluate(f"document.querySelector('{sel}').innerText.replace(/\\u00a0/g,' ')")
    ok &= check("French by default, FR marked current", page.evaluate("document.documentElement.lang") == "fr" and txt("h1") == "Composez votre bubble tea." and page.evaluate("document.querySelector('[data-lang-set=fr]').getAttribute('aria-current')") == "true", txt("h1"))
    click(page, "flavor", "fraise"); click(page, "top", "gelee"); click(page, "size", "M")
    page.click('[data-lang-set="en"]'); page.wait_for_timeout(400)
    ok &= check("EN: html lang, title, heading", page.evaluate("document.documentElement.lang") == "en" and "Hubei street food" in page.title() and txt("h1") == "Build your bubble tea.", txt("h1"))
    ok &= check("EN: the order summary is rewritten and keeps the choice", "Medium 50 cl" in txt("#summary") and "Strawberry" in txt("#summary") and "Grass jelly" in txt("#recap") and "€5.50" in txt("#summary"), txt("#summary").replace("\n", " | "))
    ok &= check("EN: the chosen flavour and topping are still selected", page.evaluate("document.querySelector('input[name=flavor]:checked').value") == "fraise" and page.evaluate("document.querySelector('input[name=top]:checked').value") == "gelee")
    ok &= check("EN: the flavour labels are English", "Strawberry" in txt("#flavors") if page.evaluate("!!document.getElementById('flavors')") else "Strawberry" in txt(".controls"))
    page.evaluate("document.getElementById('roulette').scrollIntoView({block:'center'})"); page.wait_for_timeout(500)
    ok &= check("EN: the roulette (cards, dish shown, play button) is English", "NO. 8" in txt(".card[aria-selected=true] .num").upper() and "Sesame-sauce noodles" in txt("#pick") and "€8.90" in txt("#pick") and txt(".rplay-txt") in ("Pause", "Play"), txt("#pick").replace("\n", " | "))
    ok &= check("EN: prices of the full menu use € before the number", page.evaluate("[...document.querySelectorAll('[data-price]')].every(e => /^(\\+ |from )?€\\d/.test(e.textContent.trim()) || /from €/.test(e.textContent))"))
    page.click('[data-lang-set="zh"]'); page.wait_for_timeout(400)
    ok &= check("ZH: html lang zh-Hans, Chinese heading, summary and roulette", page.evaluate("document.documentElement.lang") == "zh-Hans" and re.search(r"[一-鿿]", txt("h1")) and "草莓" in txt("#summary") and "8号" in txt(".card[aria-selected=true] .num") and "芝麻酱" in txt("#pick"), txt("#summary").replace("\n", " | "))
    ok &= check("ZH: the second Chinese label on the menu tabs is hidden (it would repeat)", page.evaluate("[...document.querySelectorAll('.tab .zh')].every(e => getComputedStyle(e).display === 'none')"))
    ok &= check("ZH: stored choice is remembered", page.evaluate("localStorage.getItem('mrye-lang')") == "zh")
    page.reload(wait_until="domcontentloaded"); page.wait_for_timeout(600)
    ok &= check("ZH: still Chinese after a reload", page.evaluate("document.documentElement.lang") == "zh-Hans" and re.search(r"[一-鿿]", txt("h1")))
    page.click('[data-lang-set="fr"]'); page.wait_for_timeout(400)
    ok &= check("FR: back to French, with French prices (comma, no-break space before €)", page.evaluate("document.documentElement.lang") == "fr" and "Pause" in txt(".rplay-txt") + "Pause" and page.evaluate("[...document.querySelectorAll('[data-price]')].some(e => /\\d,\\d{2}\\u00a0€/.test(e.textContent))"))
    page.goto((DIST / "index.debug.html").as_uri() + "?lang=en", wait_until="domcontentloaded"); page.wait_for_timeout(600)
    ok &= check("?lang=en wins over the stored choice", page.evaluate("document.documentElement.lang") == "en")
    ok &= check("no script error while switching", not [l for l in logs if l.startswith("PAGEERR")], str(logs[:3]))
    page.evaluate("localStorage.clear()")
    browser.close()
    for l, f in (("en", "en/index.html"), ("zh", "zh/index.html")):
        if not (SITE / f).exists(): continue
        b2 = p.chromium.launch(args=GL_ARGS); pg = b2.new_page(viewport={"width": 390, "height": 800}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200])); pg.route("**/three.min.js", lambda r: r.abort())
        pg.goto((SITE / f).as_uri(), wait_until="domcontentloaded"); pg.wait_for_timeout(700)
        ok &= check(f"[{l}] real page runs without a script error on a phone, switcher visible", not errs and pg.evaluate("(() => { const r = document.querySelector('.lang').getBoundingClientRect(); return r.width > 0 && r.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth; })()"), str(errs))
        b2.close()
print("\nALL PASS" if ok else "\nSOME FAILED"); raise SystemExit(0 if ok else 1)
