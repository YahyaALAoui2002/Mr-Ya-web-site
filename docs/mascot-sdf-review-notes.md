# Review notes: "MASCOT v2: single-mesh SDF teddy" (what was wrong, what I changed)

I ran the pasted file unmodified in a Three.js r159 test page. **It produced 0 triangles** (no bear at all); it had only been syntax-checked.
The idea (one smooth mesh from a signed-distance field + marching tetrahedra) is right and is now live; these are the bugs I found and fixed.

## Bugs that stopped it from working
1. **Smooth union was a smooth intersection.** `h = 0.5 + 0.5*(d - pd)/k` must be `(pd - d)/k`. With the wrong sign the field is positive everywhere (belly centre read +2.19), so nothing is "inside".
2. **Ground cut had the wrong sign.** `max(d, y - 0.10)` keeps only the part *below* y = 0.1. To flatten the base use `max(d, -y)`.
3. **Edge interpolation ran backwards.** The edge key sorts the two lattice ids (lo, hi) but `t = vA/(vA - vB)` was computed in the *unsorted* order, so vertices landed mirrored along the edge: jagged shards and holes. Compute `t` from the lower id to the higher.
4. **Quad case (2 in / 2 out).** The "centroid" was the average of vertex *indices*, and was then used as an index into `positions` (NaN sort). Use the cyclic edge order (a,c) (a,d) (b,d) (b,c).
5. `emitTri` used `positions[c*3+2]` twice for the centroid z; and it did 6 extra field evaluations per triangle. Orient with the averaged vertex normals instead.

## Bugs that would have shown up once it rendered
6. **Pitch / roll of the head were opposite in the shader and on the face meshes** (the shader's `mat2` rotations are the inverse of Three's Euler for X and Z). Fix: one CPU matrix (`uHeadRot`) drives both.
7. **Head mask** `smoothstep(2.16, 2.40, y)` cut through the muzzle/mouth, and the shoulders/arm tops rotated with the head. New mask: y-ramp below the chin, with radial exclusion for the arms.
8. **UVs from `atan2`** have a seam down the side of the bear. Fur is now sampled triplanar in the shader.
9. **Per-vertex noise** on marching-tetrahedra triangles (many tiny ones) folds the surface. Geometry gets only low-frequency lumpiness; the fine fur is in the shader (bump from a tileable stroke texture).
10. **Vertex colours are linear:** `[0.82,0.63,0.33]` looks washed out; use `new THREE.Color('#hex')` values.
11. A 0.4–0.5 s synchronous build freezes a phone: the generator is time-sliced (7 ms per frame).
12. **Integration:** wrapped in an IIFE, `bear / mascot / layoutBear / updateBear` were not visible to the rest of the module (`resize()` and `react()` would throw). Unwrapped into the module scope.

## Not done (from the reviews)
Directional fur flow, compressed-contact zones, silhouette shell layers, AO, idle drift, look-toward-the-cup choreography. Say which you want next.
