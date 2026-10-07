# Backlog

## Ask the client (blocks content)
- Opening hours (11h–21h is from a single Maps note), the missing dish n°7 (Poulet fermier à la vapeur), crossed-out prices on the menu photos, fruit-tea price (currently "Prix affiché en boutique"), bubble-waffle topping/sauce options (partly hidden in the photo).
- **Real, sharp dish photos** (one per dish) to replace the Chinese-character plates in the roulette. Each plate has room for an image. Do NOT use Google Maps customer photos.
- Check the bear against the real mascot with the client (apron print, orange slits, colours).

## Product / engineering
1. **Real-device performance** (unmeasured!): test on a mid-range phone, check frame time, draw calls, memory. Knobs: bear lattice step `BH`, sphere detail of beads, pixel ratio ceiling (adaptive already), twin passes.
2. Deploy: GitHub Pages (see README); maybe a custom domain later.
3. Bear polish. Done in v22: ambient occlusion in the folds, face rebuilt from the photo, photo-calibrated colours, cleaner apron. Still open: directional fur flow (stretching the strokes along Y was tried and made it look like wrinkles; needs a per-vertex flow direction), compressed-contact zones, silhouette shell layers (2–3 extra draw calls, triples the vertex cost), proportions vs the photo (the real bear has narrower shoulders, longer arms and a slouch; the v21 arms-at-the-sides anatomy was kept because it was approved), idle head drift, the bear glancing at the cup before nodding, different reactions per action (flavour/topping/size/hot).
4. Optional: label shadow on the cup, steam for hot drinks, order button reaction, real photography backdrop.
5. A ground-truth reference image of the "approved" milk render exists only in Yahya's hands; if he shares it, sample its colours and calibrate the milk numerically.
6. Housekeeping: the single IIFE could become ES modules later, but only without changing behaviour (the build reproduces published pages byte for byte; keep a test that does the same after any refactor).
