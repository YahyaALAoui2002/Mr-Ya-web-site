# Dish photos

One square photo per plate of the roulette, named by the dish key:

| key | dish | key | dish |
|---|---|---|---|
| `n1` | N° 1 Nouilles au porc haché et petits pois | `n14` | N° 14 Nouilles de riz au chou vinaigré |
| `n2` | N° 2 Nouilles au bœuf | `n9` | N° 9 Malatang |
| `n3` | N° 3 Pâtes de riz au porc haché | `jianbing` | Crêpe jianbing |
| `n4` | N° 4 Soupe de vermicelles aigre et piquante | `takoyaki` | Takoyaki |
| `n5` | N° 5 Nouilles de riz, sauce maison (froides) | `taro` | Taro balls |
| `n6` | N° 6 Riz parfumé, viande au choix | `liangfen` | Gelée liangfen à l'osmanthus |
| `n8` | N° 8 Nouilles à la sauce sésame | `waffle` | Bubble waffle nature |
| `n10` | N° 10 Poulet au curry avec riz | `waffle-glace` | Bubble waffle glacé |
| `n11` | N° 11 Poulet effiloché au citron | | |
| `n12` | N° 12 Nouilles froides | | |
| `n13` | N° 13 Rouleaux de riz vapeur | | |

`<key>.webp` (720 px, served by the production site) and `small/<key>.webp` (360 px, inlined in the portable single file) are **generated**:
put the originals in a folder, named by key (`n8.jpg`, `jianbing.png` ...), and run

    python3 scripts/prepare-dish-photos.py /path/to/originals

(optional `--focus n8=0.5,0.4` to move the square crop, `--zoom n8=1.3` to tighten it). Then `node build.mjs`, commit `src/dishes/` and `dist/index.html`.
A dish without a photo keeps its Chinese-character plate.

Rights: the owner of Mr Ye said these photos (taken from the Google reviews of the restaurant) may be used (told by Yahya, 9 Oct 2026). Keep that message.
The reviewers who took the pictures keep their own copyright, so if one of them objects, drop that photo (delete its two files and rebuild).
