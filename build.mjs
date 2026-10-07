// Builds the single-file pages from the sources.   node build.mjs            -> dist/index.html, dist/lab.html, dist/bubbletea-3d.js
//                                                  node build.mjs --debug    -> also exposes window.__dbg (used by the tests)
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const debug = process.argv.includes('--debug');
const PLACEHOLDER = '/*__BUBBLETEA_3D__*/';
const DEBUG_HOOK = "window.__dbg={liquid,cup,tapioca,popping,beans,jellies,ice,teaMat,liqU,bear,mascot,shadow,renderer,scene,camera,rAt,setRot:(v)=>{rotY=v;vel=0;needs=true;}}; host.classList.add('is-3d');";

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
for (const [tpl, out] of [['site.template.html', 'index'], ['lab.template.html', 'lab']]) {
  const html = readFileSync(join(root, 'src', tpl), 'utf8');
  if (!html.includes(PLACEHOLDER)) throw new Error(`${tpl}: placeholder missing`);
  writeFileSync(join(dist, `${out}${suffix}.html`), html.replace(PLACEHOLDER, () => mod));   // function replacement: the module is full of "$" characters
}
console.log(`built ${debug ? 'DEBUG ' : ''}dist/ from ${slices.length} slices (${(mod.length / 1024).toFixed(0)} KB of 3D code)`);
