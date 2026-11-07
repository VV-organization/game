# Distinct body kits implementation plan

**Goal:** Redraw all 20 body kits so the modification is obvious at catalog size and remains the same physical model in the garage and race.

**Architecture:** A dedicated Three.js body-kit builder uses each vehicle's existing layout and explicit attachment points. The catalog and builder share design metadata. Existing IDs, names, prices, ownership, driving stats and collision behavior remain unchanged.

**Design:** `src/shared/body-designs.ts` defines 20 geometrically different kits. Their characteristic front/side/rear assemblies are the implementation brief, not color-only editions. Factory body geometry stays recognizable; Nova keeps its divided nose, Falcon its cage, Eclipse its halo. No new cages or holograms are needed.

**Tech stack:** Existing React, TypeScript and Three.js. No new dependencies.

## Ownership and tasks

- [x] Model engineer: `src/game/body-kits.ts`, `kart.ts`, necessary stock-wing grouping in `vehicles-classic.ts` / `vehicles-modern.ts`. Implement 20 substantial designs, real supports, wheel steering clearance, factory stock-wing replacement where necessary. Expose the assembled group as `body-kit` for diagnostic rendering. Do not edit catalog/thumbnail/fixture files.
- [x] Root: shared metadata and `server/catalog.ts` descriptions; dedicated body thumbnail framing; local visual acceptance fixture using the real model. Preserve all commerce identifiers and prices.
- [x] QA: construct all 20 × 11 combinations, verify finite geometry and attachment/wheel/driver concerns. Inspect front/rear sheets for all 20 on Origin plus the most demanding combinations on the ten other chassis. Check actual shop, rotating garage and a real race with a fitted kit.
- [x] Root: run format, tests, build, diff review; save evidence and commit owned changes.

## Acceptance and risks

1. Every kit changes geometry visibly without depending on accent color. Compare identical vehicle paint and a neutral-material sheet.
2. Splitters are ahead of turning wheels, side panels between axles; exposed components have physical supports. No floating plates or panels through the driver.
3. Existing factory aero must not be stacked with a conflicting replacement. Preserve the four wheels, animation handles, exhaust and other equipped cosmetics.
4. Main body and kit fit catalog/garage/race cameras. Prefer a practical envelope near 3.3 m wide and 5.5 m long, with large wings below the driver's head; inspect exceptions rather than hiding them with zoom.
5. Browser evidence is required for visual claims. Numeric geometry uniqueness is not evidence of perceptual difference. No real purchases or account mutations are needed for verification.

## Execution notes

Work continues in the user's existing clean `dev` checkout so the active local game receives the changes. Distinct file ownership prevents concurrent edits. The user has already requested autonomous implementation and team management; no additional approval gate is needed for this reversible visual change.

Final validation and visual evidence: [body-kit-redesign-qa.md](../../research/body-kit-redesign-qa.md).
