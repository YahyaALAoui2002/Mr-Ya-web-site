# CLAUDE.md — Mr Ye web site

Read this first. It is the project memory: what we are building, what is decided, what must never be broken, how to test, and what is left.

## What this is
A one-page website for **Mr Ye 幸福食光** (Xing Fu Shi Guang), a bubble tea + Hubei street-food restaurant, **69 avenue des Gobelins, 75013 Paris**.
Phones: **09 80 61 56 80** (primary, on the cup) and **07 60 25 63 73**. Google 4.7/5 with 600+ reviews. Hours 11h–21h are **unconfirmed** (one Maps note only).
Client work by **Yahya** (freelance web developer). The site is in **French**. Brand: forest green `#2f5d3f` / deep `#1e3d29`, bone `#eef1ea`, dark page `#122016`; fonts Familjen Grotesk + Dancing Script + Noto Serif SC. One accent only (green). The real cup: clear plastic, green octagonal label (幸福食光 / Mr. Ye), white lid, red heart stopper, kraft paper straw. The restaurant mascot is a big teddy bear in a dark-green apron.

## What the page does
- **Hero**: "Composez votre bubble tea" — a real-time 3D cup (Three.js r159) that follows the customer's choices: size (M 50 cl 5,50 € / L 70 cl 6,50 €), base (milk tea or fruit tea, fruit tea is always iced), 17 flavours, hot/cold (milk only), one topping (tapioca, multifruit/popping, red bean, grass jelly), live order card with price. A flame/snowflake **badge** sits at the top right of the cup and pops on every change. A 3D **teddy-bear mascot** sits beside the cup (follows the pointer, nods on a selection).
- **Guided scroll (phone only, <768 px)**: the cup sits above the controls, so once the visitor has chosen in EVERY group (size, base, flavour, topping, and hot/cold if milk tea; tapping an already-ticked default counts) the page scrolls up to the finished cup plus a short recap (drink + price, `#recap`, mirror of the order card). It fires once per full round of choices: a later tweak does not jump. On a short screen the cup shrinks (`100dvh - 270px`) so cup + recap + dock fit. Logic in the first page script (`touched`, `showResult`); `tests/test_guided_scroll.py` covers it.
- **La carte**: the menu as an **oval roulette** (19 dishes; each plate can carry a real photo, see `src/dishes/README.md`: files `src/dishes/<key>.webp` + `small/<key>.webp` made by `scripts/prepare-dish-photos.py`, key = 7th field of the dish in the roulette data; no photo = Chinese-character plate; big plate in front, 2+ on each side, drag/click/arrows/keyboard, auto-rotates until touched, pause button). The full detailed menu is inside a collapsible `<details>`.
- Light + dark themes (system), mobile layout, keyboard focus, `prefers-reduced-motion` respected, 2D SVG fallback if WebGL is unavailable.

## Commands
```
npm run build         # dist/index.html (portable), dist/lab.html, dist/bubbletea-3d.js, AND dist/site/ (production)   (no dependencies, Node only)
npm run build:debug   # the portable pages + window.__dbg hook for the tests (dist/*.debug.*)
npm run serve         # http://localhost:8080  (serves dist/site/, the production build)
npm run serve:portable  # same port, serves dist/ (portable single file + lab bench)
npm test              # builds both, runs tests/run_all.py (site, guided scroll, containment, roulette, rig, bear, stress)  (needs: pip install -r requirements.txt && playwright install chromium)
npm run test:fast     # skips the slow stress test
npm run check:dist    # fails if the committed dist/index.html, lab.html, bubbletea-3d.js differ from what src/ builds (CI runs the same check)
```
Two builds of the same page (`src/site.template.html`, filled in by `build.mjs`):
- **`dist/index.html` = PORTABLE** single file (Three.js r159 from jsDelivr, fonts from Google). It is what gets published as a Claude.ai artifact and what most tests open. It is **committed**: after any change to `src/`, run `node build.mjs` and commit it (CI fails if it is stale).
- **`dist/site/` = PRODUCTION**, what GitHub Pages serves: `index.html` + `assets/three.min.js` + `assets/fonts/*.woff2` (self-hosted, no third-party request, GDPR-friendly) + `og.png`, `apple-touch-icon.png`, `favicon.svg`, `robots.txt`, `sitemap.xml`. **Not committed** (git-ignored), CI rebuilds it. Set the public address with `SITE_URL=https://example.com/ node build.mjs` (canonical, Open Graph, sitemap).
`dist/lab.html` is a developer bench for the cup alone.
Fonts: `src/fonts/*.woff2` (Familjen Grotesk, Dancing Script, and a Noto Serif SC subset with ONLY the Chinese characters used): add a dish with a new character and re-run `python3 scripts/subset-fonts.py` (instructions in the script). Share images: `python3 scripts/make-share-images.py` regenerates `src/assets/og.png` and `apple-touch-icon.png` from the live 3D hero.

## Repo map
```
src/site.template.html      the whole page (HTML + CSS + page scripts). Contains the placeholder /*__BUBBLETEA_3D__*/
src/lab.template.html       the cup test bench, same placeholder
src/3d/01..08-*.js          ONE script (an IIFE) cut in 8 slices; build.mjs concatenates them in order
build.mjs                   slices -> dist/ (node build.mjs; --debug also exposes window.__dbg for the tests)
tests/                      Playwright (Python) tests with real assertions; helpers.py explains the setup
vendor/three.min.js         Three.js r159 UMD: the tests use it (CDN request intercepted) AND the production build ships it as assets/three.min.js
src/partials/               the CDN font links and the Three.js tag of the portable build; src/fonts, src/assets, src/favicon.svg: files of the production build
scripts/                    subset-fonts.py, make-share-images.py (regenerate src/fonts and src/assets)
docs/                       HISTORY.md, DECISIONS.md, BACKLOG.md. The client's photos and the raw early transcript are NOT in the repo (public repo, rights): see docs/reference/README.md
```
3D slices: 01 renderer/scene/studio light/backdrop · 02 exact glass profile + cup glass · 03 flavours + liquid shader · 04 toppings (physics, instancing, shaders) · 05 label/lid/heart/straw/shadow · 06 mascot bear MODEL (quad-sphere pieces, bone rig, fur shader, face, apron) · 07 mascot bear ANIMATION (clips, look-at, blink, click-to-wave, wireframe/bones views, layout) · 08 camera framing, interaction, state, public API, render loop.
Public API (must keep working): `window.mryeCup = { flavors, setFlavor(base,id), setTea(hex,isMilk), setTopping(name), setSize('M'|'L'), setMascot(bool), bear }` with `bear = { play('wave'|'cheer'|'nod'|'tilt'), setWire(bool), setBones(bool), rig, clips }`.
The page script in `site.template.html` (`render()`, `setTempBadge()`, the roulette IIFE) drives it.

## Hard rules (each one cost hours; do not break)
1. **The cup glass is NOT transmissive** (faint tint layer + additive gloss layer). In r159 a transmissive object cannot see another transmissive object behind it: a transmissive cup made the milk vanish (tested, see docs/DECISIONS.md).
2. **`rAt(y)` is the single source of truth for the glass radius** (rounded base corner + straight cone). Liquid, label, lid and every topping are placed from it. Toppings must stay inside the glass: `tests/test_containment.py` checks every vertex and must report **0 violations**.
3. **Toppings are drawn once, in the transparent pass after the glass layers** (renderOrder 5), and the liquid does **not** write depth. A shader does Beer–Lambert along the real view ray inside the liquid cylinder (`uSigma` per flavour), so beads fade with depth. Same look in milk and fruit tea; only the liquid density differs.
4. Three.js `thickness` on `MeshPhysicalMaterial` is a **constant**, not a per-pixel path length. Do not claim depth-dependent absorption from it.
5. A `Vector4` holds 4 numbers (a 5th was silently dropped once and broke every topping's edge light). Check uniform shapes.
6. Declare shared `let/const` before the handlers that use them (TDZ bugs happened). Lint recipe: eslint with `no-undef`, `no-use-before-define`, `no-shadow`.
7. Colour: `Color.setHSL` needs `THREE.SRGBColorSpace`; **vertex colours are linear** (build them with `new THREE.Color('#hex')`). Tone mapping ACES, exposure ~0.72.
8. Do not cut `settle()` iterations to save CPU (13 floating beads at 90 iterations). The cheap fix was starting beads low.
9. The label is ONE front sticker (`LBL_T` 1.62 rad), not wrapped round the cup.
10. **Mascot bear = rigged plush** (slices 06-07). Pieces are all-quad cube-spheres (`bQuadSphere(N)`, N a number or `[nx, ny, nz]` so long limbs get near-square cells and clean rings; keep every count EVEN so a vertex ring lies on the centre planes where the seams are), merged to ONE mesh per bone; **the shoulders are connected**: the torso is broad all the way up (no taper) and the shoulder joints sit INSIDE it (`|x|` 0.9 of a 1.2 torso), so the shoulder line slopes from the neck over the arm in one line (`test_rig.py` measures the contour: no shelf, no bump); everything is defined in the `BONE_DEFS` and `PARTS` tables (tune against the photo). `bLocal()` converts a world rest position to bone-local and is only valid for bones WITHOUT a rest rotation (arms and legs use local `pos` instead). **The Head is its own node**: face, ears, muzzle all hang from `rig.Head`, it is driven LIVE (pointer look-at + nod spring), never by a clip (a test enforces it). Clips are authored in `bClip` as offsets on the rest pose (`rot`) or absolute eulers (`abs`); one-shots are blended over idle by my own weight envelope (idle weight = 1 - env) so every clip starts and ends on the idle pose. Face features are placed with `bHeadZ/bMuzzleZ` (analytic surface) so they sit ON the surface. Patches (soles, inner ear) and stitches are computed per pixel in the fur shader from interpolated attributes (colour thresholds on a coarse mesh go jagged). The apron is laid on the torso at rest, then settled just outside torso, pelvis and legs (`bClearD`, offset 0.024, a test checks clearance); it follows the spine only, so it cannot be rigged round a bend: keep it above the lap. Pocket slits are painted in the apron texture.
11. Published-page constraints (Claude.ai artifact): scripts only from `cdn.jsdelivr.net/npm`, `cdnjs.cloudflare.com`; no remote images; no other network. That is why the PORTABLE build (dist/index.html) keeps the CDN + Google Fonts links. The PRODUCTION build (dist/site) has NO third-party request: `tests/test_site.py` fails if one comes back. Never put a Google/CDN URL straight into the template: add it to `src/partials/` (portable) and keep the production variant local.
12. Keep: adaptive pixel ratio, IntersectionObserver pause, `prefers-reduced-motion`, WebGL context-loss fallback, no `maximum-scale=1` (accessibility).

## Looks that are APPROVED — do not change without asking Yahya
- **Milk tea**: opaque and creamy (transmission 0.08, gentle milkiness lift, satin sheen), smooth with a cream froth cap and light cream wisps tinted from the flavour's own colour. **No dark swirls/veins/specks** (they looked like dirt).
- **Fruit tea**: clear (transmission ×1.22), rising micro-bubbles, a sunlit streak, ice cubes.
- **Toppings** (same look in milk and fruit): tapioca = 120 loose dark-brown beads (**"perfect", untouched**); multifruit 140; red beans 240; **grass jelly = 135 irregular charcoal chunks, ONLY in a heap on the bottom**, flat faces against the glass.
- **Temperature**: normal "Froid/Chaud" pills + the flame/snowflake badge at the top right of the cup (pops on change; fruit tea = always snowflake). The 3D fireball was removed at Yahya's request.
- **Order card** (price large), **oval roulette menu**, light pool behind the cup + contact shadow that follows the cup size.
- **Mascot bear** (rigged plush, built from the real shop photo + the client's teddy references; see DECISIONS.md): caramel fur `#b08856`, cream muzzle and flat cream soles, small brown nose, bead eyes, open smile with a tongue, darker inner ears, stitched seams (head centre, torso centre, arm sides), baked shading in the creases, fine plush grain (bump 0.0045: stronger looks like cracked leather), branded dark-green apron (幸福食光 / Mr.Ye, orange pocket slits). Rig and clips as in rule 10; the client's request was literally "rigged and animated, Head = separate group, match the wireframe, don't forget the Mr Ye apron". The reference images he sent are NOT in the repo (unknown rights); the main one (`shop-front-with-the-bear.png`) is kept privately: see docs/reference/README.md.

## How we work (important)
- Yahya writes in **French and English mixed**; answer in the language of his message. Short, concrete answers. He wants **visual proof**: after any visual change, screenshot it (Playwright) next to the reference photo and look at it before claiming it is done.
- **Measure, do not guess.** Several "obvious" fixes were wrong until tested (see DECISIONS.md). Report numbers and say what was NOT verified.
- He often pastes suggestions from other AIs: **evaluate them critically with a test**, adopt what holds up, say plainly what is wrong (several contained fatal bugs).
- Tests run in headless Chromium with **software WebGL**: good for logic/geometry/screenshots, **not** for real phone/GPU performance. Never claim "60 fps". Frames take seconds there: poll for state, do not sleep.
- Never touch third-party photos for the site without rights (Google Maps photos are customers' copyright). Real dish photos must come from the client.

## Status
**Live site: https://yahyaalaoui2002.github.io/Mr-Ya-web-site/** (ONLY the single `index.html` is published; the lab bench is local: `npm run build && npm run serve`, then `/lab.html`), built from `main` by `.github/workflows/pages.yml`; needs **Settings > Pages > Source: GitHub Actions** (a repo setting only the owner can change; it is on). Repo: YahyaALAoui2002/Mr-Ya-web-site. The bear is the rigged plush (renders: `docs/bear-rig-views.png`, `docs/bear-rig-wire.png`). Tests in this container need `pip install playwright==1.56.0` to match the preinstalled Chromium. Software-GL numbers for the bear: 17 meshes, ~27k triangles, built synchronously at load (the old SDF bear was ~69k triangles and a 0.4 s time-sliced build). **Real-device performance is unmeasured.**

## Status at hand-over (v21, historical: this was the single-mesh SDF bear)
Published as Claude.ai artifacts (can only be updated from a Claude.ai chat, not from here): site `https://claude.ai/artifact/UW4U6Z9EdRHreHQP6cG3Xm`, lab `https://claude.ai/artifact/RZLAFPLEPgfnv7pyW6Cp6v`. All four tests pass (containment 0 violations, roulette 11/11, bear 7/7, stress 9/9).
Software-GL numbers with everything built: 54 draw calls, ~181k triangles (bear body ~69k on desktop, ~35k on phones). **Real-device performance is unmeasured.**
Next: see `docs/BACKLOG.md`. First task Yahya mentioned: put the site on a public GitHub repo / GitHub Pages so he can show it (README has the steps; no credentials were available in the chat).
