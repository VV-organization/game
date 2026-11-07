# Distinct driver gear implementation plan

**Goal:** Give each of the existing 20 helmets and 20 suits a recognizable design in the shop, garage and race.

**Architecture:** Original code-native Three.js models, shared by isolated product renders and the seated driver. Keep existing color fields for compatibility and add explicit `helmetStyle` / `suitStyle` variant numbers so equipped IDs and previews select geometry. No backend data migration, new packages, prices or SKU changes. The user's continuing autonomous visual-redesign instruction covers routine design choices and implementation.

**Design decision:** Full model changes plus layered garment construction. Paint-only variants fail the request; external raster replacements would diverge from the actual race models. Preserve the game's friendly low-poly racer, with believable motorsport construction rather than costume props. Color and material accents complement readable shape changes. Review both factory and neutral materials.

## Shared contracts

- `createHelmet(variant = 0, color?: string, visorColor?: string): THREE.Group` in `src/game/helmets.ts`. Local head center at origin, front +Z, nominal radius .48. Fitted in driver at (0,1.02,.04). Default/invalid variants produce a clean stock helmet. Most geometry inside x±.56,y±.57,z±.62; exceptional peaks up to z .74. Keep lower opening above y−.48. Named `driver-helmet`, visor material named `helmet-visor`. Distinct visors must face +Z and obey supplied visor color. Original geometry only, no DOM/canvas dependency.
- `createRacingSuit(variant = 0, color?: string, pose: 'seated'|'display' = 'seated'): THREE.Group` in `src/game/racing-suits.ts`. Seated local origin is the existing driver origin: torso center y .37,z0; shoulders around x±.29,y .62; hands near x±.35,y .25,z .59; neck below y .64 to meet helmet bottom .51. Include arms/gloves and modest legs/boots (seated thighs forward, no intrusion through kart nose). `display` reuses the same torso/limb designs with standing legs and relaxed arms; floor at y0, no helmet/head. Named `driver-suit`. Keep seated width roughly ≤1.12 and front z≤1.12. Default/invalid variants stock suit. No DOM/canvas dependency.
- `helmetDesigns` / `suitDesigns` arrays in separate shared files each contain 20 entries with `name`, `description`, `primary`, `secondary`, `accent`. Names must match existing catalog editions exactly. Factory primary can use product color; accents and panels are authored per design.
- No module-level shared disposable Three.js geometry/material instances. Each build owns its resources. Geometry must be finite, bounded, fitted, and visually connected.

## Tasks / ownership

- [x] Helmet artist: owns `src/game/helmets.ts`, `src/shared/helmet-designs.ts`, `src/game/helmets.test.ts`. Design 20 genuinely recognizable motorsport helmet constructions (round classic, aerodynamic, rally, motocross-inspired, endurance, retro, angular etc), then test geometry bounds/defaults/visor override and self-review connections. Do not edit integration files.
- [x] Suit artist: owns `src/game/racing-suits.ts`, `src/shared/suit-designs.ts`, `src/game/racing-suits.test.ts`. Design 20 readable constructions using differing collar shapes, quilted panels, shoulder reinforcement, elbow/knee pads, cuffs, belt/placket, harness-like sewn panels and original insignia. Avoid huge armor/identical padded blobs. Preserve human seated pose and use the same pieces for standing merchandise. Test geometry/pose/defaults and self-review. Do not edit integration files.
- [x] Root: integrates variants in `types.ts`, `customization.ts` plus meaningful regression tests; replaces old driver primitives in `kart.ts`; makes isolated helmet and standing suit thumbnails; focuses actual equipped driver during try-on, without turning the object out of frame. Keeps default/visor-only/bundle behavior. Updates accurate catalog descriptions.
- [x] Root + independent reviewer: inspect all40 color/neutral product models; check representative fitted gear on all10 cars, preview resets, visor customization, mobile view and actual race launch. Fix real clipping/connection defects. Test snapshot invariants for commerce data. Full tests, format, typecheck/build, live shop verification and owned commit. Stop temporary servers after checks; preserve the user's game server3001.

## Review risks

Variant lost between ID and model; visor rendered behind helmet; head/suit/seat/steering overlap; display pose differs from equipped design; tiny details disappear in cards; per-frame model construction; leaked materials/contexts; camera continues rotating fitted equipment out of frame; legacy/default customization breaks. Geometry tests support visual evidence rather than proving beauty or all physical collisions.

## Progress ledger

Base: `1e3d56a`; clean `dev` worktree at start. Scope is the requested gear follow-up, not a new game build or deployment.

Completed locally. See `docs/research/gear-redesign-qa.md` for evidence and limitations. Review caught and fixed helmet SKU indexing, weak first-pass helmet differentiation, suit panel clipping and buggy camera occlusion.
