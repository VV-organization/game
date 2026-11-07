# Garage decor redesign — 2026-11-07

All 20 decor products now use individual construction, with five distinct objects per family. `createDecor` supplies both isolated catalog images and the prop placed in the garage. Try-on frames the actual placed object; ending try-on restores the normal camera. Catalog descriptions describe the new geometry.

## Verification

- Final `npm test`: 167 tests passed across 12 files. The 35 decor tests cover invalid input, all 20 finite/grounded models, dimensions and 80 placements across standard/Pro garages. These are geometry checks, not pixel-level collision tests.
- Final `npm run build`, `npm run format:check`, fixture TypeScript check and `git diff --check` passed. Vite retains the existing warning about the 527 kB Three.js chunk.
- Live API comparison against the catalog saved before this task: all 300 products retain IDs, names, prices, categories, variants, colors, stats and bundle definitions; all 20 decor descriptions are distinct.
- Live production build at `http://127.0.0.1:3001/shop`: filtered to 20 decor products, scrolled through the collection, verified 20 loaded thumbnail images, opened cup and tool-crate try-on, and ended try-on. No console errors/warnings in the checked pages.
- Checked the actual preview component with a standard garage and Pro garage; a 390 × 844 viewport fits the complete twin palm. Toggling focus with identical customization restores the wide camera.
- Independent visual review accepted the 20 color and neutral-material silhouettes. Independent code review found disconnected wing roots on the Coral trophy and an offset base under the Indigo banner; both were corrected and rechecked. Close-up review also grounded the existing tire stack and cone bases on the room floor.

## Visual evidence

- [Before](screenshots/63-decor-before.png).
- Family comparison sheets: [cups/crates](screenshots/64-decor-cups-crates.png), [flags/palms](screenshots/65-decor-flags-palms.png), [neutral flags/palms](screenshots/66-decor-flags-palms-neutral.png), [neutral cups/crates](screenshots/67-decor-cups-crates-neutral.png). These sheets precede the small joint corrections above; final corrected cup/banner are visible in the live shop screenshots.
- Final preview: [Pro close-up](screenshots/68-decor-pro-tryon.png), [same configuration after focus reset](screenshots/69-decor-focus-reset.png), [mobile standard garage](screenshots/70-decor-mobile-tryon.png).
- Final local production build: [shop](screenshots/71-decor-live-shop.png), [Coral trophy try-on](screenshots/72-decor-live-cup-tryon.png), [remaining products](screenshots/73-decor-live-shop-rest.png), [tool-crate try-on](screenshots/74-decor-live-crate-tryon.png).

The repeatable diagnostic fixture is `decor-review.html` / `decor-review.ts`, served only by the local development server. It is excluded from the production build. No account, purchase, payment or equipment persistence mutation was needed for this visual follow-up; those flows were not revalidated end to end. No deployment was performed.

## Process cleanup

Stopped temporary Vite PID 18777; verified its npm parent 18763 and esbuild child 18778 also exited and port 5173 had no listener. Closed the separate DevTools verification tab. The replaced game server process tree also exited. Left one game server on port 3001 (PID 20476), with `/api/health` returning `ok` in sandbox mode. These are point-in-time observations, not permanent process identifiers.
