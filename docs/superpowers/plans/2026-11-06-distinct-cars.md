# Distinct cars implementation plan

> For agentic workers: use superpowers:subagent-driven-development. Root integrates and performs browser visual acceptance; model owner changes only assigned paths.

**Goal:** Replace near-identical catalog cars with ten immediately distinguishable playable 3D designs.
**Architecture:** One real Three.js model builder shared by catalog thumbnails, garage and race. Vehicle definitions provide identity/default paint and geometry; purchased paint and other equipment override defaults.
**Tech stack:** Existing React, Three.js and TypeScript; no new dependency.
**Spec:** User screenshot and explicit request to redraw all identical cars; existing FApix visual direction and autonomous team authorization.

## Design decision

Root selects distinct vehicle silhouettes within the stylized kart world. Small scale/fin differences failed the previous visual acceptance even though structural hashes differed. Static replacement illustrations would diverge from the playable vehicle, so rebuild actual geometry. A different default paint helps recognition but must not be the sole difference.

1. Apex GT-R: orange competition kart, tubular bumper, low broad nose, open wheels.
2. Vortex S: teal Formula racer, long narrow nose, separated front wing and rear wing.
3. Falcon RS: yellow rally buggy, raised chassis, big treaded wheels, roll cage and round lamps.
4. Spectre R: blue/silver retro cigar racer, rounded tapered nose, oval grille, exposed wheels.
5. Stellar GT: red rounded GT roadster, broad fenders and round lamps, open cockpit.
6. Tempest V8: dark muscle kart, broad square hood, visible supercharger and side exhausts.
7. Phantom X: violet stealth wedge, sharp faceted nose, triangular light signatures, low profile.
8. Zenith R: white/blue endurance prototype, faired wheels, center cockpit, dorsal fin.
9. Nova Hyper: lime split-nose single-seater, two separated front blades and exposed suspension.
10. Eclipse One: pearl/dark futuristic prototype, halo/arch and sculpted wheel guards, distinctive tail.

Free Origin remains separately recognizable. Each design stays within the existing gameplay footprint, keeps driver and steering wheel visible, and preserves wheel/driver/exhaust/shield animation handles. No economics, SKU identity or driving-stat changes.

## Tasks

- [x] Model owner: define vehicle identities and geometry in src/shared/car-designs.ts and src/game vehicle builder files; replace scale-only variants. Maintain customization/material overrides and adapt cosmetic attachment positions.
- [x] Root: align car descriptions/default palette in server/catalog.ts; inspect thumbnail/garage framing and lighting; adjust only if actual renders need it.
- [x] Independent reviewer: inspect all ten rendered designs side by side, identify silhouette collisions and equipment regressions. Structural uniqueness is not visual acceptance.
- [x] Root: verify actual catalog, rotating garage, equipped vehicle in race; inspect all ten thumbnail images at card scale, including common-paint comparisons. Capture evidence.
- [x] Root: run existing tests, format/type/build checks; fix material failures, document actual evidence and commit owned changes.

## Review focus

- Same paint on all cars must leave ten recognizable bodies.
- New silhouettes must fit thumbnail, garage and chase camera without clipping.
- Purchased paint, wheel, body, decal, suit and helmet remain applied.
- Four wheels/two steering wheels, driver, exhaust and shield lifecycle stay compatible with Race.
- Richer geometry remains practical with six cars and resource disposal on scene teardown.

Visual-only reversible model changes are verified by rendering and review; add behavioral regression tests only for actual changed data/customization contracts, not mesh-count snapshots.

## Result

User confirmed factory appearance as the default. Actual model renders, independent review and final 111-test/build gate are recorded in [car-redesign-qa.md](../../research/car-redesign-qa.md). Race observation used the actual Race component via the local fixture for Falcon; not all ten race viewpoints were manually checked.
