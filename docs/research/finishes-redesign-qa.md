# Numbers, liveries, underglow and trails — 2026-11-07

Implemented 100 redesigned items using shared production builders: 20 physical number plates, 40 authored hood/flank liveries (20 Sport and 20 Pro), 20 animated ground-light patterns and 20 particle trails with different shapes and motion. All 300 catalog records retain their original IDs, names, prices, categories, variants, colors, stats and bundle memberships; the 100 affected descriptions now explain the actual design.

## Visual evidence

- [Before](screenshots/87-finishes-before.jpg), [20 number plates](screenshots/88-plates-collection.jpg).
- [Sport on dark paint](screenshots/89-liveries-sport.jpg), [Pro on light paint](screenshots/90-liveries-pro-light.jpg).
- [20 underglow patterns](screenshots/91-underglow-collection.jpg), [20 trail effects](screenshots/92-trail-collection.jpg).
- [Sakura Pro fitted to all ten purchased chassis plus Origin](screenshots/93-livery-fit-all-cars.jpg), [plate fitted above the Origin exhaust](screenshots/94-plate-fitted-preview.jpg).
- [Real coast race with Nova Hyper, livery, plate, ground light and Sakura trail](screenshots/95-finishes-race.jpg).
- Final local production build: [390×844 underglow preview](screenshots/96-underglow-mobile-preview.jpg), [animated trail preview](screenshots/97-trail-mobile-preview.jpg), [desktop shop](screenshots/98-finishes-live-shop.jpg).

The local `finish-review.html` / `.ts` fixture uses production models, components and catalog data. It is excluded from the production build. Graphics and geometric designs are original code-native artwork.

## Integration and review fixes

`underglowStyle` and `trailStyle` now travel with the existing color fields through equipped selections, temporary try-on and bundles. The shop isolates number plates, shows complete liveries on a demonstration chassis, and uses the same dark studio and effect builders for thumbnails and live try-on. Trails now have an actual animated try-on instead of a static product illustration.

Livery projection covers larger painted areas. Off-center hoods receive a full motif on both panels, preserving Nova's fork opening and Tempest's blower. Projection triangles never join different shell meshes. Plates mount above exhaust mouths with a minimum clearance, including tall frames. Ground lighting cancels chassis roll and bounce so it stays at world y≈0.19 above the road at y=0.13. Moving particles inherit observed emitter velocity at birth; straight-line driving preserves studio motion/lifetime, while turns leave particles following their previous world-space direction. Teleports clear the pool.

Independent reviewer accepted the designs and integration after these scoped fixes. The last review also accepted dedicated preview cameras that ignore hidden shield/boost bounds, avoiding tiny items on mobile.

## Verification

- Full suite: **269 tests passed, 19 files**. Coverage includes preserving selected patterns through preview/bundles, distinct plate silhouettes and fitting across 11 chassis, complete motif UVs on both fork blades, no triangles across disconnected panels, deterministic bounded particle pools, all 20 stationary/moving trail comparisons, turns, teleport cleanup and race controls/lifecycle.
- Build/typecheck, formatting and `git diff --check` passed. The standalone diagnostic TypeScript entry also passed. Existing 529 kB Three.js chunk warning remains.
- Live API comparison confirmed all commercial fields for all 300 products unchanged. All 100 updated descriptions are distinct within their categories.
- Final built shop loaded **20/20 plate, 40/40 livery, 20/20 light and 20/20 trail thumbnails** after scrolling. Checked last light variant and Pearl trail in mobile try-on. No horizontal overflow. Separate screenshots confirmed changing frames for both animated previews. Ending try-on removed the preview and left zero DOM canvases. No browser warnings/errors in the final shop flow.
- Real race smoke accelerated Nova to 260+ km/h, exercised a right turn and showed the chosen plate, livery, ground pattern and petal trail. No rendering errors. A short 1440×1000 sample measured 361 frames in 3007 ms (~120 fps), ~1264 WebGL draw calls/frame in that observed scene. Instrumentation was restored. This is local Mac evidence, not a mobile hardware benchmark or full race qualification.
- Underlighting uses one draw call; each trail uses one instanced draw call with 96 slots. Catalog thumbnails continue to use one shared renderer and cached ordinary images. Scene cleanup releases instance buffers, light shadows, geometries, materials and textures.

No purchases or real payments were made, and no deployment was performed.

## Cleanup

Stopped temporary Vite PID 32562; verified its npm parent 32548 and esbuild child 32565 also exited. Port 5173 has no listener. The previous game server chain 26342/26356/26357 exited after replacement. Closed the dedicated browser verification tab, leaving its blank tab only. The updated game remains on port 3001, listener PID 35363; health returned `ok`, payment mode `sandbox`. PIDs are point-in-time evidence.
