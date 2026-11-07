# Body-kit redesign — 2026-11-07

All 20 catalog body kits now use separate Three.js constructions. The same `createKart` model supplies product thumbnails, garage previews and races. Each kit has its own front, side and rear geometry; color is supplementary. Catalog descriptions explain the actual shapes.

The builder adapts attachment points and panel height to each chassis. Nova retains its divided nose; Falcon retains its cage; Eclipse retains its halo. Conflicting factory wings on Vortex and Tempest are replaced before badge/vinyl projection. Invalid body variants retain factory aero. No dependencies were added.

## Verification

- `npm run format:check`: passed.
- `npm test`: **132 tests in 11 files passed**, including 21 body-kit tests.
- `npm run build`: passed (TypeScript and Vite). Existing Three.js chunk-size warning remains; this is not a measured performance regression.
- `git diff --check`: passed.
- Diagnostic fixture separately typechecked with `tsc --noEmit`, JSX react-jsx, ES2022 and Bundler resolution.
- All **220 combinations (20 kits × 11 chassis)** were constructed. Checks cover finite geometry, practical dimensions, existing wheel/driver/exhaust handles, Nova's center gap and sampled tire clearance at steering angles −0.35, 0 and +0.35.
- Regression checks cover hidden factory wings being excluded from decal raycasts, invalid variants retaining factory wings, and Arctic/Sakura/Jade clearing Stellar's curved factory fenders.
- Live `/api/health` reports `ok`, `paymentMode: sandbox`. Live catalog still has 300 products; IDs, names, prices, categories, variants, color fields, stats and bundles match the pre-change snapshot. All 20 body descriptions are distinct.
- Actual built shop displays 20 body kits and opens Violet in the rotating try-on card. Nova + Midnight was rendered in the garage and driven briefly on Coast; acceleration, steering, return-to-track and pause were exercised. This was a visual smoke check, not a complete race or performance benchmark.

## Visual evidence

Files below are native browser screenshots in `screenshots/`:

| Evidence                                                                     | Screenshot                                                                                                                         |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Old geometry, with new descriptions already loaded in the diagnostic fixture | [43 — before](screenshots/43-body-kits-before.png)                                                                                 |
| Final first ten colored kits                                                 | [54 — 01–10](screenshots/54-body-kits-final-01-10.png)                                                                             |
| Second ten colored kits                                                      | [46 — 11–20](screenshots/46-body-kits-11-20.png)                                                                                   |
| Color-independent silhouettes                                                | [53 — neutral 01–10](screenshots/53-body-kits-final-gray-01-10.png), [51 — neutral 11–20](screenshots/51-body-kits-gray-11-20.png) |
| Distinct rear assemblies                                                     | [47 — rear 11–20](screenshots/47-body-kits-rear-11-20.png)                                                                         |
| Violet and rounded Pearl on all chassis                                      | [49 — Violet](screenshots/49-body-kit-violet-fit.png), [50 — Pearl](screenshots/50-body-kit-pearl-fit.png)                         |
| Jade after correcting Stellar panel intersection                             | [61 — final Jade fit](screenshots/61-body-kit-jade-final-fit-rear.png)                                                             |
| Nova + Midnight garage and moving race                                       | [56 — garage](screenshots/56-nova-midnight-garage.png), [58 — race](screenshots/58-nova-midnight-race-moving.png)                  |
| Built shop and actual try-on                                                 | [59 — shop](screenshots/59-body-kits-shop.png), [60 — Violet preview](screenshots/60-body-kit-violet-shop-preview.png)             |

Earlier intermediate captures 44, 45 and 48 precede final Ignition/Pearl adjustments. Capture 55 records the subsequently corrected Stellar/Jade intersection; it is not final acceptance evidence.

## Scope and limits

The catalog contact sheets cover all 20 designs, including neutral materials and rear views. Representative fit sheets cover every chassis with Violet, Pearl and Jade; they do not constitute a visual review of every cosmetic combination. Tire tests sample geometry vertices, not every triangle intersection. Full races, mobile GPU profiling and all combinations with other cosmetics were not retested for this visual change. Prices, ownership and physics are unchanged; no purchases or account writes were used.

For repeatable visual inspection, run Vite and open `/docs/research/body-kit-review.html`. Parameters: `start=1|11`, `gray=1`, `rear=1`, `mode=fit&body=1..20`, or `mode=garage|race&car=0..10&body=1..20`. The diagnostic fixture is excluded from the production build.
