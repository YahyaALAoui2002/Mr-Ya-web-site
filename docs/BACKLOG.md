# Backlog

## Ask the client (blocks content)
- Opening hours (11h–21h is from a single Maps note), the missing dish n°7 (Poulet fermier à la vapeur), crossed-out prices on the menu photos, fruit-tea price (currently "Prix affiché en boutique"), bubble-waffle topping/sauce options (partly hidden in the photo).
- **Real, sharp dish photos** (one per dish) for the roulette plates. The plumbing is done (`src/dishes/README.md`, `scripts/prepare-dish-photos.py`); what is missing is the photos themselves. Yahya says the client allowed using photos from the restaurant's Google reviews (9 Oct 2026; keep that message). The reviewers keep their own copyright: drop a photo if its author objects. Plates without a photo keep the Chinese-character look.
- Check the bear against the real mascot with the client (apron print, orange slits, colours).

## Product / engineering
1. **Real-device performance** (unmeasured!): test on a mid-range phone, check frame time, draw calls, memory. Knobs: bear lattice step `BH`, sphere detail of beads, pixel ratio ceiling (adaptive already), twin passes.
2. Deploy: GitHub Pages (see README); maybe a custom domain later.
3. Bear polish. Done: rigged plush with separate Head, clips, wireframe/bones views, branded apron, click-to-wave. Open: proportions vs the real bear (the real one has a smaller head and a taller torso, longer arms, a slouch; the photo is the target), a fully merged skin for torso + arms (skinned mesh) if the wireframe must be one continuous grid like the last reference, a paw/hand detail, eyes that follow the pointer a little, the bear glancing at the cup before nodding, different reactions per action, shell fur silhouette (extra draw calls), cloth that really drapes (the apron is rigid on the spine), a GLB export of the rig for the client's own tools, real-device performance.
4. Optional: label shadow on the cup, steam for hot drinks, order button reaction, real photography backdrop.
5. A ground-truth reference image of the "approved" milk render exists only in Yahya's hands; if he shares it, sample its colours and calibrate the milk numerically.
6. Housekeeping: the single IIFE could become ES modules later, but only without changing behaviour (the build reproduces published pages byte for byte; keep a test that does the same after any refactor).
