// Builds the pages from the sources.
//   node build.mjs          -> dist/index.html        PORTABLE single file (Three.js from jsDelivr, fonts from Google). This is the file that is
//                                                     published as a Claude.ai artifact and that the tests open. It is committed, and CI checks it is in sync.
//                              dist/lab.html, dist/bubbletea-3d.js
//                           -> dist/site/              PRODUCTION folder (self-hosted fonts and Three.js, no third-party request). This is what GitHub Pages
//                                                     serves. Not committed (see .gitignore): CI rebuilds it.
//   node build.mjs --debug  -> dist/*.debug.*          the portable pages with window.__dbg exposed (used by the tests)
//   SITE_URL=https://example.com/ node build.mjs       the public address used by the canonical / Open Graph tags and by sitemap.xml
//   DISH_DIR=/some/folder node build.mjs               use another folder of dish photos (default src/dishes; the tests use it)
// Languages (fr, en, zh): the texts live in src/i18n/<lang>.json. The portable file is French with an in-page switcher (and ?lang=en|zh);
// the production folder has three real pages: / (fr), /en/ and /zh/, each pre-translated, with hreflang links and a sitemap that lists the three.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const debug = process.argv.includes('--debug');
const SITE_URL = (process.env.SITE_URL || 'https://yahyaalaoui2002.github.io/Mr-Ya-web-site/').replace(/\/?$/, '/');
const PLACEHOLDER = '/*__BUBBLETEA_3D__*/';
const DISH_DIR = process.env.DISH_DIR || join(root, 'src/dishes');
const DEBUG_HOOK = "window.__dbg={liquid,cup,tapioca,popping,beans,jellies,ice,teaMat,liqU,bear,mascot,rig,bw,bearApi,bearMeshes,apronClear:bClearD,shadow,renderer,scene,camera,rAt,setRot:(v)=>{rotY=v;vel=0;needs=true;}}; host.classList.add('is-3d');";

// the 3D module is ONE script (an IIFE) kept in numbered slices: concatenating them in order gives the script back exactly
const slices = readdirSync(join(root, 'src/3d')).filter((f) => /^\d\d-.*\.js$/.test(f)).sort();
let mod = slices.map((f) => readFileSync(join(root, 'src/3d', f), 'utf8')).join('').replace(/\n+$/, '');
if (debug) {
  // the anchor appears twice (context-restored handler, then the end of init): the hook must go on the LAST one, which runs at start-up
  const anchor = "host.classList.add('is-3d');", at = mod.lastIndexOf(anchor);
  if (at < 0) throw new Error('debug hook anchor not found');
  mod = mod.slice(0, at) + DEBUG_HOOK + mod.slice(at + anchor.length);
}
const dist = join(root, 'dist'); mkdirSync(dist, { recursive: true });
const suffix = debug ? '.debug' : '';
writeFileSync(join(dist, `bubbletea-3d${suffix}.js`), mod + '\n');
const read = (...p) => readFileSync(join(root, ...p), 'utf8');
// ---- languages -------------------------------------------------------------------------------------------------------------------------
const dicts = Object.fromEntries(['fr', 'en', 'zh'].map((l) => [l, JSON.parse(read('src/i18n', `${l}.json`))]));
const core = read('src/i18n/core.js'), runtime = read('src/i18n/runtime.js');
const C = new Function(`${core}; return MRYE_I18N_CORE;`)();
const esc = (x) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (x) => esc(x).replace(/"/g, '&quot;');
const T = (lang, key, args) => C.translate(dicts, lang, key, args);
// the page, already written in `lang`: data-i18n (text of a leaf element), data-i18n-attr (attributes), data-price (a price). The runtime does the same in the browser on a switch.
const prerender = (html, lang) => html
  .replace(/(<([a-z0-9]+)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)([^<]*)(<\/\2>)/g, (m, open, tag, key, old, close) => open + esc(T(lang, key)) + close)
  .replace(/<[a-z0-9]+\b[^>]*\bdata-i18n-attr="([^"]+)"[^>]*>/g, (tagText, spec) => spec.split(';').reduce((acc, pair) => {
    const i = pair.indexOf(':'), attr = pair.slice(0, i), val = escAttr(T(lang, pair.slice(i + 1)));
    const re = new RegExp(`(\\s${attr}=")[^"]*(")`);
    if (!re.test(acc)) throw new Error(`data-i18n-attr: no ${attr} attribute in ${acc.slice(0, 80)}`);
    return acc.replace(re, (mm, a, b) => a + val + b);
  }, tagText))
  .replace(/(<([a-z0-9]+)\b[^>]*\bdata-price="([\d.]+)"[^>]*>)([^<]*)(<\/\2>)/g, (m, open, tag, num, old, close) => {
    const p = C.fmt(lang, parseFloat(num), (open.match(/data-price-prefix="([^"]*)"/) || [])[1] || '');
    return open + (/\sdata-price-from[\s>=]/.test(open) ? esc(T(lang, 'from', { p })) : p) + close;
  })
  .replace(new RegExp(`(<a\\b[^>]*data-lang-set="${lang}")`, 'g'), '$1 aria-current="true"');
const leftover = (html) => { const bad = html.match(/data-i18n(?:-attr)?="[^"]*"[^>]*>[^<]*\{[^}]*\}/); return bad ? bad[0].slice(0, 100) : null; };
// pages: lang, mode ("inline" = the portable single file, "pages" = one real URL per language), href of each switcher link, canonical, hreflang alternates
const page = (html, parts, o = { lang: 'fr', mode: 'inline' }) => {
  const own = o.mode === 'inline' ? dicts : { fr: dicts.fr, [o.lang]: dicts[o.lang] };   // the single file can switch to any language; a real page only needs its own (French is the fallback)
  const i18nScript = (core + '\n' + runtime.replace('/*__I18N_DICTS__*/{}', () => JSON.stringify(own).replace(/</g, '\\u003c'))).replace(/<\/script/gi, '<\\/script');
  // translate first, then inject the scripts: the 3D module and the runtime contain data-i18n strings of their own that must stay untouched
  const translated = prerender(html, o.lang), bad = leftover(translated); if (bad) throw new Error(`untranslated placeholder in ${o.lang} page: ${bad}`);
  let out = translated
    .replace(PLACEHOLDER, () => mod)                                  // function replacement: the module is full of "$" characters
    .replace('/*__I18N__*/', () => i18nScript)
    .replace('<!--__FONTS__-->', () => parts.fonts)
    .replace('<!--__THREE__-->', () => parts.three)
    .replace('<!--__SITE_HEAD__-->', () => parts.siteHead)
    .replace('/*__DISH_PHOTOS__*/{}', () => JSON.stringify(parts.photos))
    .replace('%%HTMLLANG%%', C.HTML_LANG[o.lang]).replace('%%LANG%%', o.lang).replace('%%LANGMODE%%', o.mode)
    .replace('%%OGLOCALE%%', C.OG_LOCALE[o.lang])
    .replaceAll('%%CANON%%', o.canon || SITE_URL)
    .replace('<!--__HREFLANG__-->', () => o.hreflang || '');
  for (const l of C.LANGS) out = out.replace(`%%LH_${l}%%`, o.links ? o.links[l] : `?lang=${l}`);
  return out.replaceAll('%%SITE_URL%%', SITE_URL);
};

// 1. portable pages (what the tests and the Claude.ai artifact use)
// dish photos: src/dishes/<key>.webp (720 px, for the production site) and src/dishes/small/<key>.webp (360 px, inlined as data URIs in the portable single file).
// The keys are the 7th field of each dish in the roulette data (n1, n8, jianbing, waffle-glace ...). A dish without a file keeps its Chinese-character plate.
const webps = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => /^[a-z0-9-]+\.webp$/.test(f)).sort() : []);
const bigPhotos = webps(DISH_DIR), smallPhotos = webps(join(DISH_DIR, 'small'));
const inline = Object.fromEntries(bigPhotos.map((f) => {
  const src = smallPhotos.includes(f) ? join(DISH_DIR, 'small', f) : join(DISH_DIR, f);
  return [f.replace('.webp', ''), `data:image/webp;base64,${readFileSync(src).toString('base64')}`];
}));
const files = Object.fromEntries(bigPhotos.map((f) => [f.replace('.webp', ''), `assets/dishes/${f}`]));
const portable = { fonts: read('src/partials/fonts-portable.html').trimEnd(), three: read('src/partials/three-portable.html').trimEnd(), siteHead: '', photos: inline };
for (const [tpl, out] of [['site.template.html', 'index'], ['lab.template.html', 'lab']]) {
  const html = read('src', tpl);
  if (!html.includes(PLACEHOLDER)) throw new Error(`${tpl}: placeholder missing`);
  writeFileSync(join(dist, `${out}${suffix}.html`), tpl === 'lab.template.html' ? html.replace(PLACEHOLDER, () => mod) : page(html, portable));
}

// 2. production folder: same page, but every asset is served from our own origin
if (!debug) {
  const site = join(dist, 'site'); rmSync(site, { recursive: true, force: true });
  mkdirSync(join(site, 'assets/fonts'), { recursive: true });
  const FACES = [
    ['Familjen Grotesk', 400, 'familjen-grotesk-400'], ['Familjen Grotesk', 500, 'familjen-grotesk-500'],
    ['Familjen Grotesk', 600, 'familjen-grotesk-600'], ['Familjen Grotesk', 700, 'familjen-grotesk-700'],
    ['Dancing Script', 700, 'dancing-script-700'], ['Noto Serif SC', 600, 'noto-serif-sc-600'], ['Noto Serif SC', 900, 'noto-serif-sc-900'],
  ];
  for (const [, , f] of FACES) copyFileSync(join(root, 'src/fonts', `${f}.woff2`), join(site, 'assets/fonts', `${f}.woff2`));
  const css = FACES.map(([fam, w, f]) => `@font-face{font-family:"${fam}";font-style:normal;font-weight:${w};font-display:swap;src:url(assets/fonts/${f}.woff2) format("woff2")}`).join('\n')
    // a metric-matched stand-in for the first paint, so the swap to Familjen Grotesk does not move the layout
    + '\n@font-face{font-family:"Familjen Grotesk Fallback";src:local("Arial"),local("Helvetica Neue"),local("Liberation Sans");size-adjust:97.4%;ascent-override:105.2%;descent-override:23.1%;line-gap-override:0%}';
  const preload = ['familjen-grotesk-400', 'familjen-grotesk-700', 'noto-serif-sc-900']
    .map((f) => `<link rel="preload" href="assets/fonts/${f}.woff2" as="font" type="font/woff2" crossorigin>`).join('\n');
  // the same parts for a page that sits in a sub-folder (/en/, /zh/): every relative address goes one level up
  const localParts = (up) => ({
    fonts: `${preload}\n<style>\n${css}\n</style>`.replaceAll('assets/fonts/', `${up}assets/fonts/`),
    three: `<script src="${up}assets/three.min.js"></script>`,
    siteHead: `<link rel="apple-touch-icon" href="${up}apple-touch-icon.png">`,
    photos: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, up + v])),
  });
  if (bigPhotos.length) mkdirSync(join(site, 'assets/dishes'), { recursive: true });
  for (const f of bigPhotos) copyFileSync(join(DISH_DIR, f), join(site, 'assets/dishes', f));
  const dirOf = { fr: '', en: 'en/', zh: 'zh/' };
  const hreflang = [['fr', 'fr'], ['en', 'en'], ['zh-Hans', 'zh'], ['x-default', 'fr']].map(([h, l]) => `<link rel="alternate" hreflang="${h}" href="${SITE_URL}${dirOf[l]}">`).join('\n');
  const tpl = read('src/site.template.html');
  for (const l of C.LANGS) {
    const up = l === 'fr' ? '' : '../', links = Object.fromEntries(C.LANGS.map((x) => [x, l === 'fr' ? (dirOf[x] || './') : (x === 'fr' ? '../' : x === l ? './' : `../${dirOf[x]}`)]));
    if (l !== 'fr') mkdirSync(join(site, dirOf[l]), { recursive: true });
    writeFileSync(join(site, dirOf[l], 'index.html'), page(tpl, localParts(up), { lang: l, mode: 'pages', links, canon: SITE_URL + dirOf[l], hreflang }));
  }
  copyFileSync(join(root, 'vendor/three.min.js'), join(site, 'assets/three.min.js'));
  for (const f of ['og.png', 'apple-touch-icon.png']) {
    if (!existsSync(join(root, 'src/assets', f))) throw new Error(`src/assets/${f} missing (run scripts/make-share-images.py)`);
    copyFileSync(join(root, 'src/assets', f), join(site, f));
  }
  copyFileSync(join(root, 'src/favicon.svg'), join(site, 'favicon.svg'));
  writeFileSync(join(site, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}sitemap.xml\n`);
  const alt = (l) => ['fr', 'en', 'zh'].map((x) => `<xhtml:link rel="alternate" hreflang="${x === 'zh' ? 'zh-Hans' : x}" href="${SITE_URL}${dirOf[x]}"/>`).join('') + `<xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}"/>`;
  writeFileSync(join(site, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${C.LANGS.map((l) => `<url><loc>${SITE_URL}${dirOf[l]}</loc>${alt(l)}</url>`).join('')}</urlset>\n`);
}
console.log(`built ${debug ? 'DEBUG ' : ''}dist/ from ${slices.length} slices (${(mod.length / 1024).toFixed(0)} KB of 3D code, ${bigPhotos.length} dish photos)${debug ? '' : ' + dist/site/'}`);
