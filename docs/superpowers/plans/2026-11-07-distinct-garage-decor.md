# Distinct garage decor implementation plan

**Goal:** Make all 20 decor products recognizable at catalog size and in the garage.

**Architecture:** One `createDecor(variant: number): THREE.Group | null` builder supplies isolated product shots and actual garage props. Models use local origin at floor height, metadata in `src/shared/decor-designs.ts`. Keep the existing four families and five finishes, SKU names, IDs, prices and ownership. Each finish changes construction as well as material. Existing autonomy authorization covers this reversible visual follow-up.

**Tech:** Existing Three.js/React/TypeScript; no dependencies or raster replacements.

## Designs and ownership

- [x] Model engineer owns `src/game/decor.ts`, `src/shared/decor-designs.ts`, decor integration in `src/game/garage.ts`, and meaningful geometry/integration tests. Classic: two-handled cup, stacked strapped shipping crates, waving checkerboard flag, broad palm canopy. Coral: winged cup, hard-shell equipment cases, crossed pennants, twin curved palm trunks. Indigo: angular crystal trophy on plinth, open tool crate with drawers, tall vertical racing banner, fan palm in a tall faceted pot. Sand: laurel cup, wooden chest and smaller slatted crate, triangular pennants on a T stand, date palm in terracotta. Neon: orbital trophy, framed equipment cases with luminous trim, framed start-light/flag banner, layered palm canopy in luminous square planter. Preserve family identity. All assemblies grounded and supported, finite geometry, bounded footprints, neutral-material silhouettes distinct. Export group named `garage-decor`, valid only integer1–20; no canvas dependency in decor builder. Garage places right/left of pod, on floor; return `{scene,kart,decor}` with nullable decor. Do not edit thumbnail, preview, catalog or App.
- [x] Root owns `ProductThumbnail.tsx`: dedicated isolated studio scene of real decor, no kart/whole room, fit camera to object bounds. Root owns optional `focus='decor'` in `KartPreview.tsx` and its try-on use in App, fitting real prop in its actual room. Preserve normal garage preview. Root updates catalog descriptions from shared metadata.
- [x] Root builds local diagnostic contact sheets using real ProductThumbnail and actual garage preview. Independent visual review: all20 in color, neutral representative variants, garage classic/pro placements, no clipping/floating/empty variants. No purchases needed.
- [x] Final gate: format, relevant geometry tests/fullsuite, build, diffreview; verify live3001shop/catalog descriptions, record screenshots, commit exact owned files. Stop temporary Vite and any diagnostic processes after verification; leave the user's game on3001.

## Acceptance

Catalog shows the purchased object prominently; twenty shapes differ without relying only on color. Product preview and equipped garage share geometry. Existing commerce data unchanged except accurate descriptions. Invalid decor leaves room undecorated. Garages remain usable and kart rendering/disposal unchanged. Technical checks complement screenshots; no claim of exhaustive rendering/performance testing.

## Result

Implemented and verified locally. See `docs/research/decor-redesign-qa.md` for evidence, review fixes and verification limits. No deployment performed.
