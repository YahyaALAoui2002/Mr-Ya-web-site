# Decisions and the evidence behind them

| Question | Test | Result | Decision |
|---|---|---|---|
| Make the cup `MeshPhysicalMaterial` transmissive for realism? | A/B on the real scene | The milk almost disappears (a transmissive object can't see another transmissive object in r159) | Cup = faint tint layer + additive gloss layer; only the liquid is transmissive |
| Cut `settle()` from 320 to 90 iterations to save CPU? | Node benchmark, same physics | 13 beads floating in mid-air, pile top 1.64 instead of 0.82 | Keep iterations; start the beads low instead (same pile, ~2.3× faster); a spatial hash was slower at this bead count |
| Why were toppings "outside the cup"? | Vertex-level measurement vs the true glass profile | 81/74/89/87 beads poking out (up to 5.6% of radius): wall formula bigger than the real profile, +0.012 "poke", rounded base ignored | Exact `rAt(y)`, 0.006 glass margin, liquid film inset 0.04; containment test must say 0 |
| Pearls looked washed-out once inside the glass | 4 variants on the real cup | Glass tint/gloss layers draw over them | Draw toppings once in the transparent pass after the glass (renderOrder 5) |
| Edge-light of toppings far too wide | Code review | `Vector4` can't hold 5 numbers; the power became the amount | Separate power uniforms |
| Milk "dirty brown spots" | Isolation by switching terms off | swirl clouds + syrup veins + speckles | Removed; milk is smooth; froth only lighter than the body, tinted from the flavour |
| Milk went ivory-white after "milkier" | One term at a time | Cream targets too bright in linear light and clipping under the studio light; `transmission` lowering was fine | Latte-cream targets, small lift (0.08), froth = lighter version of the flavour |
| SSS shader for milk (another AI's suggestion) | Ran it as written | Needs a `thicknessMap`; without it a grey ball; with a white map a blown-out disc | Not used |
| Material recipe from the same suggestion (Beer–Lambert "for free") | Source of Three.js r159 + A/B | `thickness` is a constant; dropped in as written it breaks the toppings (liquid writes depth); with that fixed it equals our milk | Not used |
| Pasted SDF bear code | Ran it unmodified | 0 triangles | Fixed 12 bugs; see `mascot-sdf-review-notes.md` |
| Bear anatomy | Rendered from 3 angles | Arms resting on the thighs fused with the legs | Arms hang at the outer sides with small paws; legs apart, forward, big feet with a cream sole facing the viewer |
| Apron down to the lap | Render | Thighs poke fur through the cloth | Bib ends at the belly; cloth lifted outside the whole body; small polygon offset |
| Bear draw cost | `renderer.info` | 25 meshes → 84 draw calls | Single mesh (+ a few small ones) |
| Download Google Maps photos? | Network test + terms | Sandbox can't reach Google; photos belong to customers | Wait for the client's own photos |
| Push to GitHub from the chat | Credential check | No token | Ready-to-upload repo + steps (never paste tokens into chat) |

Other numbers worth remembering (software GL): toppings 120/140/240/135 instances; one frame with the bear ≈ 54 draw calls, ≈ 181k triangles; the bear builds in ~0.4 s of CPU on a desktop, time-sliced at 7 ms per frame so the page never freezes.
