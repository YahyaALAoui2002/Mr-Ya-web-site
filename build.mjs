// Builds the pages from the sources.
//   node build.mjs          -> dist/index.html        PORTABLE single file (Three.js from jsDelivr, fonts from Google). This is the file that is
//                                                     published as a Claude.ai artifact and that the tests open. It is committed, and CI checks it is in sync.
//                              dist/lab.html, dist/bubbletea-3d.js
//                           -> dist/site/              PRODUCTION folder (self-hosted fonts and Three.js, no third-party request). This is what GitHub Pages
//                                                     serves. Not committed (see .gitignore): CI rebuilds it.
//   node build.mjs --debug  -> dist/*.debug.*          the portable pages with window.__dbg exposed (used by the tests)
//   SITE_URL=https://example.com/ node build.mjs       the public address used by the canonical / Open Graph tags and by sitemap.xml
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const debug = process.argv.includes('--debug');
const SITE_URL = (process.env.SITE_URL || 'https://yahyaalaoui2002.github.io/Mr-Ya-web-site/').replace(/\/?$/, '/');
const PLACEHOLDER = '/*__BUBBLETEA_3D__*/';
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
const page = (html, parts) => html
  .replace(PLACEHOLDER, () => mod)                                  // function replacement: the module is full of "$" characters
  .replace('<!--__FONTS__-->', () => parts.fonts)
  .replace('<!--__THREE__-->', () => parts.three)
  .replace('<!--__SITE_HEAD__-->', () => parts.siteHead)
  .replaceAll('%%SITE_URL%%', SITE_URL);

// 1. portable pages (what the tests and the Claude.ai artifact use)
const portable = { fonts: read('src/partials/fonts-portable.html').trimEnd(), three: read('src/partials/three-portable.html').trimEnd(), siteHead: '' };
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
  const local = {
    fonts: `${preload}\n<style>\n${css}\n</style>`,
    three: '<script src="assets/three.min.js"></script>',
    siteHead: '<link rel="apple-touch-icon" href="apple-touch-icon.png">',
  };
  writeFileSync(join(site, 'index.html'), page(read('src/site.template.html'), local));
  copyFileSync(join(root, 'vendor/three.min.js'), join(site, 'assets/three.min.js'));
  for (const f of ['og.png', 'apple-touch-icon.png']) {
    if (!existsSync(join(root, 'src/assets', f))) throw new Error(`src/assets/${f} missing (run scripts/make-share-images.py)`);
    copyFileSync(join(root, 'src/assets', f), join(site, f));
  }
  copyFileSync(join(root, 'src/favicon.svg'), join(site, 'favicon.svg'));
  writeFileSync(join(site, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}sitemap.xml\n`);
  writeFileSync(join(site, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE_URL}</loc></url></urlset>\n`);
}
console.log(`built ${debug ? 'DEBUG ' : ''}dist/ from ${slices.length} slices (${(mod.length / 1024).toFixed(0)} KB of 3D code)${debug ? '' : ' + dist/site/'}`);
