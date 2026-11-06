# FApix Racing — reference research

Source inspected on 2026-11-06: https://fapixracing.com/ and the screenshot supplied by the user (`codex-clipboard-HPh3UA.png`). Public HTML/CSS and the relevant asset declarations in the public application bundle were examined. Browser capture and interaction verification belong to the root agent; this document reports source and image evidence, not browser testing.

## Visual direction

The supplied reference is the **light marketing landing page**, not the dark in-game lobby. Its defining features are an icy pale background, very heavy navy Cyrillic typography, abundant empty space, an orange primary action, and one large orange-kart island illustration clipped to an irregular oval. Avoid introducing gradients, glass effects, neon borders, or an unrelated dashboard into this first screen.

The downloaded hero image is the exact source image visible in the screenshot. It is not a replacement image. There is one raster marketing image; the four track previews are inline SVG illustrations. The F mark is an inline SVG, while `FApix` and `RACING` are styled real text. No external GLB/GLTF vehicle or track assets were found among the public bundle's asset paths: the game scene is generated with Three.js.

## Exact tokens and type

| Token | Source value | Use |
| --- | --- | --- |
| Ink | `#18233d` | Heading, logo, primary text |
| Muted | `#5a667e` | Descriptions and secondary labels |
| Glacier | `#edf3f7` | Landing background |
| Orange | `#ff7547` | Play button and racing accent |
| Orange hover | `#ff8b63` | Primary button hover |
| Cobalt | `#4263eb` | Supporting blue, focus outlines |
| Friends section | `#dce8f1` | Supporting pale blue panel |
| Final CTA | `#dce5fb` | Supporting blue CTA background |
| Game base | `#161826` | Actual reference game UI |
| Game panel | `#222536` | Actual reference game panels |
| Game text | `#f5f3ec` | Actual reference game foreground |
| Game muted | `#9296aa` | Actual reference game secondary text |
| Game violet | `#aba2ff` | Actual reference game secondary accent |

Font: **Golos Text**, normal style, weights 400/500/600/700/800/900, fallback Arial/sans-serif. Both Latin and Cyrillic WOFF2 subsets are downloaded. `public/assets/reference/fonts.css` provides local `@font-face` declarations with explicit ranges. The source uses `font-synthesis: none` globally. This matters for the logo: it requests italic but supplies only normal font faces; artificial italic should not be introduced accidentally.

Desktop Russian hero H1: `font-weight:900; font-size:clamp(48px,5.45vw,82px); line-height:1.01; letter-spacing:-.04em; white-space:nowrap`. English hero H1 uses `clamp(62px,6.55vw,98px)`. The supplied screenshot is in Russian.

Exact Russian hero copy:

- H1, first line: `Маленький карт.`
- H1, second line: `Большая гонка.`
- Paragraph: `Лови траекторию. Подбирай бонусы. Преврати дружеский чат в стартовую решётку.`
- First-time CTA: `Играть бесплатно`; existing profile CTA: `Вернуться в гонку` (the screenshot shows the latter).
- Image caption: `Мир FApix · Иллюстрация`.

## Landing dimensions

| Element | Desktop source values |
| --- | --- |
| Header | `max-width:1440px; min-height:108px; padding:24px 52px; gap:24px` |
| Header nav | `gap:30px; font-size:14px; font-weight:600` |
| Header actions | `gap:22px` |
| Language switch | 4px padding, 3px gap, 24px outer radius, `1px solid #18233d1c`, translucent white background |
| Language option | Minimum 38×32px, 11px bold, active navy pill with white text |
| Main wrapper | Global `max-width:1550px; margin:0 auto; padding:30px 38px 18px`; at ≥1600px top padding becomes 40px |
| Hero | `max-width:1440px; margin:auto; padding:54px 52px 72px; min-height:660px; display:grid; grid-template-columns:1fr 1.12fr; align-items:center` |
| Hero paragraph | `max-width:365px; margin-top:29px; font-size:16px; line-height:1.75` |
| CTA row | `margin-top:31px; gap:24px` |
| CTA | `min-height:58px; border-radius:14px; padding:17px 25px; gap:26px; font-size:15px; font-weight:750` |
| Illustration figure | `margin:0 -68px 0 -34px; transform:rotate(-3deg)` |
| Illustration image | `display:block; width:100%; height:auto; object-fit:cover; border-radius:46% 42% 38% 44%` |
| Illustration caption | absolute right 50px, bottom 4%, 9px type, 5×8px padding, white 66% background, 5px radius |
| Logo mark | 43×43px, mark/text gap 10px |
| Logo name | 31px, 900 weight, `letter-spacing:-1.8px` |
| Logo RACING | 10px, 700 weight, `letter-spacing:4px`, left margin 3px |
| Section titles | `clamp(34px,3.4vw,49px)`, 800 weight, 1.12 line height, -.04em tracking |
| Track cards | white background, 20px radius, 24px gap; final stylesheet override uses **two columns** |
| Track illustration | `aspect-ratio:1.75; overflow:hidden` |
| Track copy | padding 25px 26px 29px, title 22px, body 12px/1.7 |

The inherited global `main` padding adds to the marketing sections' padding. Reproducing only the `.marketing-hero` rule will shift the image and heading compared with the source. Browser zoom/physical screenshot pixels should not be mistaken for CSS pixels.

## Responsive behavior

- At ≤1100px, major section horizontal padding is 32px, hero min-height 580px, hero heading Russian `5.75vw`.
- At ≤780px, header nav disappears, header min-height 88px, hero becomes one column with 24px horizontal padding, image follows the copy, and Russian H1 is `clamp(41px,8.6vw,66px)`.
- At ≤520px, main marketing horizontal padding is 20px, Russian H1 is `clamp(36px,8.7vw,46px)`, CTA height is at least 53px, logo mark is 30px, logo name is 20px, and image figure margin is `5px -36px 0 -8px`.
- A late source override places track cards in a single column at ≤600px.
- Preserve meaningful focus outlines. Source marketing focus uses 3px cobalt outline and 5px offset.
- Respect `prefers-reduced-motion` for page motion; gameplay input should remain available.

## Source sections and assets

Source section order: header → hero → four track cards → dark power-up section → how-to-play → friends section → final CTA → footer. Header links target tracks, power-ups and how-to-play. All marketing play actions enter the game. Language switches between RU and EN.

Track order and source copy:

1. **Небесная трасса / Sky Circuit**: высотные прямые, трамплины и прыжки. Pale blue/slate elevated circuit. Originally unlockable.
2. **Лазурный берег / Azure Coast**: морской бриз, широкие повороты и твой первый идеальный дрифт. Sand/teal island and palms. Open from start.
3. **Неоновый квартал / Neon District**: поймай свой ритм среди огней ночного города. Purple skyline and pale windows. Originally unlockable.
4. **Красный каньон / Red Canyon**: красные скалы и быстрые повороты; на пейзажи времени нет. Terracotta buttes and cactus. Originally unlockable.

Power-ups shown by the source: **Турбо / Turbo** (speed burst), **Щит / Shield** (absorbs pulse and softens a wall collision), **Импульс / Pulse** (disrupts nearby rivals). Source instruction activates held items with **E**, or a touch button.

Local inventory is machine-readable in `public/assets/reference/inventory.json`, including origin, byte length and SHA-256 for every asset. Downloaded originals:

| File(s) | Type / source |
| --- | --- |
| `fapix-hero.png` | Exact original hero, 1536×1024 RGB PNG, `/images/fapix-hero.png` |
| `favicon.svg` | Exact original favicon, `/favicon.svg` |
| `golos-text-{latin,cyrillic}-{400,500,600,700,800,900}-normal-*.woff2` | 12 original font files under source `/assets/` |
| `logo-mark.svg` | Exact source inline F mark exported to a standalone SVG; navy and orange fills |
| `track-coast.svg` | Exact source inline track illustration exported to standalone SVG, viewBox 400×210 |
| `track-city.svg` | Same, purple city |
| `track-canyon.svg` | Same, terracotta canyon |
| `track-skyway.svg` | Same, raised track |
| `fonts.css` | Local font declarations, referencing the original WOFF2 files |

All final app asset URLs can point to `/assets/reference/…`; no hotlink is needed. The original application bundle has not been copied into the local application.

## Recommendations for a playable 3D kart racer

These are implementation recommendations, separate from verified source behavior.

1. Carry the hero's world into the first race: bright turquoise ocean, islands, pale sand, angular rocks and palms, thick asphalt with alternating orange/cream barriers, clear sky, and a large orange kart with cream stripe. It should feel like the playable version of the illustration.
2. Use a chase camera with spring smoothing, slight speed-dependent FOV and readable road horizon. Keep the camera far enough above the kart that the next bend is visible. The player kart should remain large in frame.
3. Build the kart from enough deliberate low-poly forms to read as a kart: four rotating tires, low nose, contrasting central stripe, chassis, bumpers, steering wheel, seat, helmeted driver and black visor. Avoid a single car-shaped box.
4. Give opponents different recognizable colors, mild lateral racing lines and overtaking behavior. Position, lap count, speed, held item and a miniature circuit should be legible without covering the road.
5. Make the first session immediate: choose a track, see a short 3–2–1 countdown, drive with arrows/WASD, steer visibly, brake, drift with Space, activate E, pause with Escape, and restart after the finish. Show these controls before the countdown and in pause/help.
6. Make acceleration, braking and steering progressive; reduce grip while drifting, build a short drift boost, slow off-road driving, and provide barrier collision feedback. Smooth camera response and a forgiving reset make this more satisfying than maximal physics complexity.
7. Scatter glowing cyan pickup cubes through meaningful racing lines. A pickup needs visible feedback and a held-item slot; activating turbo needs a visible speed effect and a measurable temporary speed increase.
8. Use three laps, checkpoint-aware lap completion, 5–7 opponents, final results and local best time. Persist settings and best times. Do not imply network multiplayer if only bots/local play are implemented.
9. On touch screens, show large left/right, throttle/brake and item controls outside the central road view. Pause when the tab loses visibility and avoid repeating held input after focus returns.
10. Keep the landing composition faithful while allowing a clear transition into a richer game UI. The screenshot should still be recognizable before the first click.

## Verification performed by this research task

- Confirmed successful downloads and local file signatures for the hero, favicon and all 12 WOFF2 font files.
- Viewed the original downloaded hero and matched it to the user-supplied screenshot.
- Exported the logo and all four inline track SVG paths with the source colors and geometry.
- Parsed all local SVG files as XML and inspected the image dimensions.
- No browser interaction or local gameplay test is claimed by this document.
