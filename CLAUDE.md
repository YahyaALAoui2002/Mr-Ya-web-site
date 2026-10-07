# CLAUDE.md — Mr Ye web site

Read this first. It is the project memory: what we are building, what is decided, what must never be broken, how to test, and what is left.

## What this is
A one-page website for **Mr Ye 幸福食光** (Xing Fu Shi Guang), a bubble tea + Hubei street-food restaurant, **69 avenue des Gobelins, 75013 Paris**.
Phones: **09 80 61 56 80** (primary, on the cup) and **07 60 25 63 73**. Google 4.7/5 with 600+ reviews. Hours 11h–21h are **unconfirmed** (one Maps note only).
Client work by **Yahya** (freelance web developer). The site is in **French**. Brand: forest green `#2f5d3f` / deep `#1e3d29`, bone `#eef1ea`, dark page `#122016`; fonts Familjen Grotesk + Dancing Script + Noto Serif SC. One accent only (green). The real cup: clear plastic, green octagonal label (幸福食光 / Mr. Ye), white lid, red heart stopper, kraft paper straw. The restaurant mascot is a big teddy bear in a dark-green apron.

## What the page does
- **Hero**: "Composez votre bubble tea" — a real-time 3D cup (Three.js r159) that follows the customer's choices: size (M 50 cl 5,50 € / L 70 cl 6,50 €), base (milk tea or fruit tea, fruit tea is always iced), 17 flavours, hot/cold (milk only), one topping (tapioca, multifruit/popping, red bean, grass jelly), live order card with price. A flame/snowflake **badge** sits at the top right of the cup and pops on every change. A 3D **teddy-bear mascot** sits beside the cup (follows the pointer, nods on a selection).
- **La carte**: the menu as an **oval roulette** (19 dishes, big plate in front, 2+ on each side, drag/click/arrows/keyboard, auto-rotates until touched, pause button). The full detailed menu is inside a collapsible `<details>`.
- Light + dark themes (system), mobile layout, keyboard focus, `prefers-reduced-motion` respected, 2D SVG fallback if WebGL is unavailable.

## Commands
```
npm run build         # dist/index.html, dist/lab.html, dist/bubbletea-3d.js   (no dependencies, Node only)
npm run build:debug   # same + window.__dbg hook for the tests (dist/*.debug.*)
npm run serve         # http://localhost:8080  (serves dist/)
npm test              # builds debug pages, runs tests/run_all.py   (needs: pip install -r requirements.txt && playwright install chromium)
npm run test:fast     # skips the slow stress test
```
`dist/index.html` is a **single self-contained file** (loads Three.js r159 from jsDelivr and fonts from Google). `dist/lab.html` is a developer bench for the cup alone.

## Repo map
```
src/site.template.html      the whole page (HTML + CSS + page scripts). Contains the placeholder /*__BUBBLETEA_3D__*/
src/lab.template.html       the cup test bench, same placeholder
src/3d/01..07-*.js          ONE script (an IIFE) cut in 7 slices on its section markers; build.mjs concatenates them in order
build.mjs                   slices -> dist/. The build reproduces the last published pages BYTE FOR BYTE (checked at hand-over)
tests/                      Playwright (Python) tests with real assertions; helpers.py explains the setup
vendor/three.min.js         Three.js r159 UMD, used by the tests (CDN request is intercepted)
docs/                       HISTORY.md, DECISIONS.md, BACKLOG.md, reference photos, early transcript
```
3D slices: 01 renderer/scene/studio light/backdrop · 02 exact glass profile + cup glass · 03 flavours + liquid shader · 04 toppings (physics, instancing, shaders) · 05 label/lid/heart/straw/shadow · 06 mascot bear · 07 camera framing, interaction, state, public API, render loop.
Public API (must keep working): `window.mryeCup = { flavors, setFlavor(base,id), setTea(hex,isMilk), setTopping(name), setSize('M'|'L'), setMascot(bool) }`.
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
10. Mascot SDF mesh: interpolate on lattice edges from the LOWER id to the higher; no per-vertex noise (folds the many tiny triangles); one CPU rotation matrix drives both the shader (head) and the face meshes; the apron is draped on the torso field and must end above the thighs.
11. Published-page constraints (Claude.ai artifact): scripts only from `cdn.jsdelivr.net/npm`, `cdnjs.cloudflare.com`; no remote images; no other network. Outside Claude.ai these can be relaxed, but keep the page self-contained.
12. Keep: adaptive pixel ratio, IntersectionObserver pause, `prefers-reduced-motion`, WebGL context-loss fallback, no `maximum-scale=1` (accessibility).

## Looks that are APPROVED — do not change without asking Yahya
- **Milk tea**: opaque and creamy (transmission 0.08, gentle milkiness lift, satin sheen), smooth with a cream froth cap and light cream wisps tinted from the flavour's own colour. **No dark swirls/veins/specks** (they looked like dirt).
- **Fruit tea**: clear (transmission ×1.22), rising micro-bubbles, a sunlit streak, ice cubes.
- **Toppings** (same look in milk and fruit): tapioca = 120 loose dark-brown beads (**"perfect", untouched**); multifruit 140; red beans 240; **grass jelly = 135 irregular charcoal chunks, ONLY in a heap on the bottom**, flat faces against the glass.
- **Temperature**: normal "Froid/Chaud" pills + the flame/snowflake badge at the top right of the cup (pops on change; fruit tea = always snowflake). The 3D fireball was removed at Yahya's request.
- **Order card** (price large), **oval roulette menu**, light pool behind the cup + contact shadow that follows the cup size.
- **Mascot bear**: modelled from `docs/reference/shop-front-with-the-bear.png`. One smooth mesh (signed-distance field), arms hanging at the sides with small round paws, legs forward with big cream-soled feet, short bib apron with the print and two orange pocket slits. Tune proportions in the `BP` table in `src/3d/06-mascot-bear.js`.

## How we work (important)
- Yahya writes in **French and English mixed**; answer in the language of his message. Short, concrete answers. He wants **visual proof**: after any visual change, screenshot it (Playwright) next to the reference photo and look at it before claiming it is done.
- **Measure, do not guess.** Several "obvious" fixes were wrong until tested (see DECISIONS.md). Report numbers and say what was NOT verified.
- He often pastes suggestions from other AIs: **evaluate them critically with a test**, adopt what holds up, say plainly what is wrong (several contained fatal bugs).
- Tests run in headless Chromium with **software WebGL**: good for logic/geometry/screenshots, **not** for real phone/GPU performance. Never claim "60 fps". Frames take seconds there: poll for state, do not sleep.
- Never touch third-party photos for the site without rights (Google Maps photos are customers' copyright). Real dish photos must come from the client.

## Status at hand-over (v21)
Published as Claude.ai artifacts (can only be updated from a Claude.ai chat, not from here): site `https://claude.ai/artifact/UW4U6Z9EdRHreHQP6cG3Xm`, lab `https://claude.ai/artifact/RZLAFPLEPgfnv7pyW6Cp6v`. All four tests pass (containment 0 violations, roulette 11/11, bear 7/7, stress 9/9).
Software-GL numbers with everything built: 54 draw calls, ~181k triangles (bear body ~69k on desktop, ~35k on phones). **Real-device performance is unmeasured.**
Next: see `docs/BACKLOG.md`. First task Yahya mentioned: put the site on a public GitHub repo / GitHub Pages so he can show it (README has the steps; no credentials were available in the chat).
