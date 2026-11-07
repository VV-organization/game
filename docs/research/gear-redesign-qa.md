# Helmet and racing-suit redesign — 2026-11-07

Implemented 20 helmet constructions and 20 authored suits. Helmets have different shell/aperture/jaw proportions, vents, side parts, peaks, aerodynamic details and broad original paint panels. Suits share human proportions while changing collars, shoulder construction, chest panels, closures, reinforcement and trim. Standing merchandise and seated drivers use the same clothing builder.

The existing `helmet` / `suit` color fields remain compatible; `helmetStyle` / `suitStyle` preserve the selected catalog variant. Equipped IDs still resolve through the catalog. Visor color remains independent. Product thumbnails isolate the actual helmet or standing suit. Try-on frames the fitted driver, stops its rotation while inspecting gear, and restores normal garage framing/rotation when focus ends. The buggy uses a lower helmet-view angle to clear its crossbar.

## Evidence

- [Original catalog](screenshots/75-gear-before.png).
- All 20 helmets: [factory](screenshots/76-helmets-factory.jpg), [neutral materials](screenshots/77-helmets-neutral.jpg).
- All 20 suits: [factory](screenshots/78-suits-factory.jpg), [neutral materials](screenshots/79-suits-neutral.jpg).
- [Midnight equipment fitted to all ten cars](screenshots/80-gear-fit-ten-cars.jpg), [real race component running that equipment](screenshots/81-gear-race.jpg).
- [390 × 844 buggy helmet preview with an independent pink visor](screenshots/82-gear-mobile-visor.jpg). The helmet is fully visible through the cage opening. Switching focus off with the same customization restored the rotating wide garage.
- Final local production build: [helmet catalog](screenshots/83-gear-live-helmets.jpg), [helmet try-on](screenshots/84-gear-live-helmet-tryon.jpg), [suit catalog](screenshots/85-gear-live-suits.jpg), [suit try-on](screenshots/86-gear-live-suit-tryon.jpg).

## Checks and review

- Final full suite: **184 tests passed, 14 files**. Regression coverage includes carrying geometry and colors through equipment/temporary preview; exact 1–20 helmet indexing; all helmet visor overrides; independent resources; seated/standing suit bounds and pose; torso-panel raycasts to catch fabric occluding graphics.
- Final build/typecheck, `format:check`, standalone fixture TypeScript check and `git diff --check` passed. Existing Vite warning remains for the 529 kB Three.js chunk.
- Compared the live API to the pre-task catalog: all 300 records retain IDs, names, prices, category/variant, colors, stats and bundle membership. All 40 equipment descriptions are distinct and match the geometry.
- In the live shop, scrolled through both categories and verified **20/20 loaded images each**; opened the last helmet and suit to verify variant 20, then ended preview. No console warnings/errors in this live flow. The development fixture initially requested a missing favicon; added an empty fixture favicon. No rendering errors were observed.
- Race smoke used the real `Race` component with selected gear, six cars and the coast track. W accelerated the player to 126 km/h. A 3-second WebGL-call/RAF sample at 1440 × 1000 measured 361 frames / 3002 ms (~120 fps), about 2135 draw calls/frame on this Mac. Instrumentation was restored afterward. This is a short local sample, not a low-end/mobile benchmark or complete race qualification.
- Independent reviewer approved the final color/neutral sheets, model construction and integration. Review fixes included an initial helmet index mismatch, overly similar first-pass shells, clothing panels dipping under the torso and buggy-frame occlusion. The last camera change received a separate scoped review.

The diagnostic `gear-review.html` / `.ts` uses production builders/components and is excluded from the production build. Commerce persistence and actual payments were not changed or exercised; no account purchases were needed. No deployment was performed.

## Reference basis

Original simplified geometry and graphics were informed by real construction vocabulary, without copying branding: [Bell RS7-K](https://www.bellracing.com/p/rs7-k/), [Bell accessory catalog](https://bellracing.eu/pub/media/mageworx/downloads/attachment/file/b/e/bell_catalog_2024_digital_v1.pdf), [Arai SK-6](https://parts.araiamericas.com/helmets/sk-6), [Alpinestars KMX-9 V3](https://www.alpinestars.com/products/kmx-9-v3-suit-black-white?variant=40390180405306), [Sparco Prime K](https://www.sparco-japan.com/past-p/products/racingsuit/prime-k/index.html). These informed visor hardware/ventilation and garment panels/collars/cuffs, not safety or certification claims about game items.

## Cleanup

Stopped temporary Vite PID 24799 and verified its npm parent 24785 and esbuild child 24800 also exited; port 5173 has no listener. Closed the dedicated DevTools verification tab. Old game-server processes exited after restart. Left the updated local game server at port 3001 (PID 26357); health returned `ok`, payment mode `sandbox`. PIDs are point-in-time evidence.
