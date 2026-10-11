# Mr Ye 幸福食光 — web site

## 🌐 Live site: **https://yahyaalaoui2002.github.io/Mr-Ya-web-site/**

https://claude.ai/artifact/UW4U6Z9EdRHreHQP6cG3Xm
Only the production folder (`dist/site`: the page, self-hosted fonts and Three.js, share image) is published, built from `src/` by `.github/workflows/pages.yml` on every push to `main`, after the tests pass. Pull requests are built and tested too.

One-page site for a bubble tea and Hubei street-food restaurant in Paris 13e: an interactive **3D bubble tea builder** (Three.js r159, no framework, no bundler), a **rigged, animated teddy-bear mascot** in the Mr Ye apron, and the menu as an oval roulette.

![the bear: front, three-quarter views, and waving](docs/bear-rig-views.png)

## The bear
A plush built the way a plush is sewn: separate all-quad pieces (torso, pelvis, head, muzzle, ears, arms, legs with flat cream soles) with stitched seams, hung on a real **bone rig** (`THREE.Bone`): `root > hips > spine > neck > Head > earL/earR`, `spine > shoulderL/R`, `hips > hipL/R`. The **Head is its own node** (head, muzzle, ears, eyes, nose, mouth) and follows the pointer; the branded apron (幸福食光 / Mr.Ye, orange pocket slits) hangs on the spine.
Animated with `AnimationMixer` clips: idle breathing, **wave** (it greets you once; click or tap the bear to make it wave), cheer, nod, tilt, plus blinking.

![the bear as grey clay with its quad wireframe](docs/bear-rig-wire.png)

```js
mryeCup.bear.play('wave')      // 'wave' | 'cheer' | 'nod' | 'tilt'
mryeCup.bear.setWire(true)     // grey clay + the quad edges of every piece
mryeCup.bear.setBones(true)    // show the skeleton
mryeCup.bear.rig               // the THREE.Bone nodes (hips, spine, neck, Head, earL, ...)
```
The developer bench (`npm run build && npm run serve`, then open `/lab.html`; it is not published) has buttons for all of it (Salut, Hourra, Oui, Curieux, Fil de fer, Squelette).

## Quick start
```
node build.mjs                 # -> dist/site/ (production), dist/index.html (portable single file), dist/lab.html
npm run serve                  # then open http://localhost:8080  (the production build, works offline)
```
The portable `dist/index.html` needs internet in the browser (Three.js from jsDelivr, fonts from Google); `dist/site/` needs none. After changing `src/`, commit the rebuilt `dist/index.html`, `dist/lab.html`, `dist/bubbletea-3d.js` (CI checks they are in sync).

## Tests
```
pip install -r requirements.txt && playwright install chromium
npm test            # or: npm run test:fast  (site build, containment, roulette, rig, bear, stress)
```

## Put it online (GitHub Pages)
`.github/workflows/pages.yml` builds the site (`node build.mjs`), checks that the committed `dist/` files are in sync, runs the tests, and publishes ONLY `dist/site/` on every push to `main`: no lab bench, no docs, no tests. A failing test blocks the deploy.
1. One-time: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Merge to `main` (or run the workflow by hand from the **Actions** tab).
3. The site is live at `https://<user>.github.io/<repo>/`. For a custom domain, set `SITE_URL` in the workflow's build step so the canonical and share tags use it.

Using it with **Claude Code**: open this folder, read `CLAUDE.md` (project memory), then `docs/BACKLOG.md`.
