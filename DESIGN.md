---
version: 2
name: knowledge-review-design
description: 知回 / KnowBack design system — warm and friendly on the outside, reading-first inside. v1 was adapted from the Mintlify analysis in VoltAgent/awesome-design-md (MIT); v2 (2026-11-14) adds a warm cream canvas, soft raised cards and 3D clay illustrations. 知回 keeps its own name, its green accent and system fonts, and is not affiliated with Mintlify.

colors:
  brand: "#30694f"          # 知回 green — primary CTA, focus, active states (never body text or large fills)
  brand-deep: "#24563f"     # pressed / hover of brand
  brand-soft: "#edf4ef"     # selected tints, success surfaces
  ink: "#0a0a0a"            # headlines, active pill tab
  charcoal: "#1c1c1e"       # body text
  slate: "#3a3a3c"          # secondary text
  steel: "#5a5a5c"          # tertiary text, inactive tabs, nav
  stone: "#888888"          # captions, muted labels
  canvas: "#ffffff"         # page and cards
  surface: "#f7f7f7"        # quiet sections, inline code, hover rows
  surface-soft: "#fafafa"
  surface-code: "#1c1c1e"   # code blocks
  hairline: "#e5e5e5"       # 1px borders
  hairline-soft: "#ededed"
  tag: "#3772cf"            # informational chips
  warn: "#c37d0d"
  error: "#d45656"

typography:
  font-ui: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"  # system fonts only; Inter only if installed locally
  font-code: "'SF Mono', Menlo, Consolas, monospace"
  page-title: { size: 40px, weight: 600, lineHeight: 1.15, letterSpacing: -1px }   # mobile 28px
  section-title: { size: 18px, weight: 600, lineHeight: 1.4 }
  card-title: { size: 20px, weight: 600, lineHeight: 1.3 }
  body: { size: 15px, weight: 400, lineHeight: 1.6 }      # reading text never below 1.5 line-height
  body-sm: { size: 14px, weight: 400, lineHeight: 1.5 }
  caption: { size: 13px, weight: 400, lineHeight: 1.4 }
  micro-uppercase: { size: 11px, weight: 600, letterSpacing: 0.5px }  # eyebrows
  button: { size: 14px, weight: 500 }

rounded: { xs: 4px, sm: 6px, md: 8px, lg: 12px, full: 9999px }
spacing: { xxs: 4px, xs: 8px, sm: 12px, md: 16px, xl: 24px, xxl: 32px, section: 48px }   # tokens --sp-4 … --sp-48 in styles.css; 20px retired 2026-11-15
elevation:
  flat: "none + 1px hairline border"            # default cards, inputs, rows
  subtle: "rgba(0,0,0,0.04) 0 1px 2px"           # hover on cards
  card: "rgba(0,0,0,0.08) 0 4px 12px"            # dialogs, floating cards
  brand: "rgba(48,105,79,0.10) 0 8px 24px"       # featured / celebration surfaces only
---

## v2: warm layer (overrides v1 where they differ)

- **Canvas** warm cream `#f6f2ea` (light); cards `#fffdf9` with no border and a soft warm shadow `0 6px 22px rgba(86,64,32,.08)`. Night mode keeps the v1 dark palette; cards there are flat `#1a1d21`.
- **No white cards** (2026-11-14): sections, lists, settings groups, knowledge cards, forms and the home module row sit straight on the canvas, separated by spacing and a 1px `--divider` line (warm `rgba(86,64,32,.12)`, night `rgba(255,255,255,.08)`). Surfaces stay only on inputs, buttons, chips, selectable options, dialogs and popovers, chat bubbles, the review answering card and consent notices.
- **Spacing grid** (2026-11-15; after Material 3, Apple HIG, Adobe Spectrum, Refactoring UI): margins, paddings and gaps use 4px steps up to 16px, then 8px steps (4 8 12 16 24 32 48 …), written as `var(--sp-N)` for the common steps; `tests/spacing-grid.test.js` fails on anything else. Hierarchy from near to far: 4 icon–text, 8 title–body and related lines, 12 list items, 16 paragraphs, card padding and phone page margins, 24 between cards, 32 between page sections. Small components scale their own padding (chips 4/12, buttons 12/24) instead of the card value; touch targets stay ≥ 44px. Not spacing: 1px hairlines, safe-area insets, font sizes, line heights, and the 72px ring buttons' −36px centring margin.
- **Radii**: floating chips 20px; buttons and chips stay full pills.
- **One scene per page.** Phone home: a first-person desk scene (`illustrations/home-desk.webp`, soft realistic 3D, 9:16) fills the top of the screen behind a transparent header and fades into the canvas; the greeting, the large due count (76px/800, no card) with a small goal pill, and the main action sit on its calm wall; a frosted module panel rises over its faded bottom. Night mode dims the scene. Desktop home shows the clay island beside the greeting; review shows a small illustration beside its title.
- **Mascot**: a chibi squirrel painted in a soft Japanese anime "healing" style since 2026-11-14 (thin soft brown line art, painterly fur, warm upper-left light with a rim light, so it sits inside the painted pet room; earlier it was a flat sticker) (apricot + cream, green leaf sprout, cream knowledge card instead of a nut, tail curling into a rounded square "回" spiral; no clothes). Stickers `illustrations/mascot-{wave,think,cheer,sleep}.webp`: wave beside the phone home due count, cheer there once today's review is done and in the review "plan complete" state, think on the ask page and when there are no cards yet, sleep when nothing is due. Sources in `store-assets/libtv/mascot`. Keep it small and decorative; no speech bubbles with text. Never more than one large illustration per view.
- **Illustrations** live in `illustrations/*.webp` (transparent, made for 知回 in LibTV with Seedream; source PNGs and `convert.py` in `store-assets/libtv/ui`). Style: soft matte clay, rounded chunky shapes, warm studio light, palette cream / sage / 知回 green / warm wood / pale peach, no text or logos. They are decorative: `alt=""`, never carry information the text doesn't.
- **Greeting** on home: 30px / 800 on the canvas, no card behind it.
- **Main action** stays 知回 green (pill, 52px tall on phone, soft green shadow) — still one per view.
- **Phone tab bar** floats 10px above the bottom edge, 24px radius, white with a soft shadow; fixed bars above it add `--tabbar-gap`.
- **Module tiles** (phone home): one row of four inside the frosted panel, each a round cream thumbnail with the module's 3D icon (custom modules: line icon) and its name below.
- Gradients are allowed only as the fade at the bottom of the home scene.
- **Display font**: Smiley Sans / 得意黑 v2.0.1 (OFL-1.1, self-hosted unmodified at `fonts/SmileySans-Oblique.woff2`, licence beside it) via `--font-display`, only for `main h1`, section titles (`.section-heading h2`) and the big due count. It has one weight; never fake bold (font-synthesis is off). Body, buttons, cards and chips keep the UI font. Kana and Hangul fall back to the UI font. This replaces v1's "two typefaces only" rule with three: UI, display, mono.

## Principles

- **Reading first.** Answers, knowledge cards and mind maps are long-form reading: body 15–16px, line-height ≥ 1.5, max line length ~72 characters in prose.
- **Calm surfaces.** White canvas, 1px hairline borders, almost no shadow. Depth only for dialogs, the hovered card and celebration moments.
- **One accent.** 知回 green is reserved for the primary action, focus rings, active states and positive feedback. Never for body text or large backgrounds. Module colours in charts are data colours, not UI accents.
- **Pills for actions.** Every button and chip is a full pill; cards are 12px; inputs and code are 8px. No other corner radii.
- **Two typefaces only.** UI font for everything; mono only for code.

## Components

| Component | Spec |
|---|---|
| Primary button | brand fill, white text, pill, 10px 20px, 14px/500; pressed brand-deep; disabled hairline fill + stone text |
| Secondary button | transparent, ink text, 1px hairline border, pill |
| Text / ghost button | transparent, steel text, radius md; hover ink text + surface fill |
| Card / panel | canvas, 1px hairline, radius lg, padding 24px (20px mobile) |
| Input / textarea / select | canvas, 1px hairline, radius md, min-height 40px (44px mobile); focus 2px brand ring |
| Pill tab (module tabs, library tabs) | inactive canvas + hairline + steel; active ink fill + white text |
| Segmented toggle | surface track, pill; active thumb canvas + ink text |
| Badge / pill chip | surface fill, steel text, pill, 12px/500; positive = brand-soft + brand |
| Eyebrow label | micro-uppercase, steel |
| Code block | surface-code, white text, radius md, mono 13px; inline code surface + hairline, radius xs |
| Table | hairline outer border radius md; header surface + steel 12px/600; rows separated by hairline-soft |
| Dialog | canvas, radius lg (celebration may use 20px), elevation card, backdrop rgba(10,10,10,.45) |
| Top bar | canvas, bottom hairline-soft, sticky; nav items are text buttons, active = ink |

## Do / Don't

- Do keep one primary (green) action per view; everything else secondary or text.
- Do use the eyebrow + page title + one-line description pattern for every page intro.
- Don't add new accent colours, gradients on UI chrome, or heavy shadows on flat cards.
- Don't load external fonts or assets (the app works offline and its CSP allows only same-origin scripts).
- Don't copy another brand's logo, name, illustrations or proprietary fonts.

## Responsive

- < 700px: single column, page title 28px, panels padding 20px, touch targets ≥ 44px, tables scroll inside their container (never the page).
- Respect `prefers-reduced-motion`: no decorative animation.
- **Squirrel actions** (phone home): a tap makes the squirrel hop; a long press (480 ms; Enter/Space on a keyboard) opens a ring of six round buttons (wave, cheer, think, shy, stash a card, sleep) around a larger copy of it in the middle of the screen; choosing one plays that pose with a short motion for about 3 s, then it returns to its usual pose. Actions trimmed from the dsh-pet desktop-pet reference to what fits a learning app; no food, dance or festival actions.
- **Pet tab** (phone, phase 1, 2026-11-14): five tabs with the squirrel (named 小回 / Backy) as a raised round avatar in the middle; 发现 moved into 知识库 as a 知识库 | 推荐 | 广场 switch. The pet page follows the reference "healing pet" layout: its tree-hollow room (`illustrations/pet-nest.webp`) fills the top, the squirrel sits on the cushion in the middle (long press = actions ring), a status bubble and two chips (fed today, pine cones) float on the scene, a frosted 4-tile "little world" (store, feed, streak, shop - coming soon) and a daily note follow. Pine cones are computed from review history in `pet.js` (+1 per card first learned, +3 per goal day, +10 per 7th goal day in a row); nothing is stored, so they cannot be edited and survive device changes. The pet never gets ill; hungry only changes its pose and words. Currency icon: the inline flat pine-cone SVG (not 🌰). Ring buttons show emoji / the pine-cone icon.
- **Free-roaming squirrel** (pet page, `pet-physics.js`, 2026-11-15, after the dsh-pet desktop pet): the squirrel lives in a body-level layer over the room. Walls are the app's edges, the floor is the cushion line, the top of the screen is the ceiling. Tap = jelly poke and a small hop; double tap = somersault (faster each time in a row); long press = actions ring; press and drag = picked up (`mascot-lifted`), body leans with the drag; let go = drops, or flies and bounces off the edges, squashing on every hit (one damped spring, origin at the hit side) and stretching along its flight; a hard throw lands dizzy (think). Idle it strolls (`mascot-walk`, mirrored for left), hops, waves, and leans out from a screen edge for a moment; asleep it walks back to the cushion. Reduced motion keeps it still on the cushion. Home squirrel: tap = jelly wobble, double tap = somersault (CSS keyframes).
- **Pet header and pine-cone jar** (2026-11-15, after the "healing pet" reference): title 25px warm brown `#3b2a1a` with wider tracking and a cream glow, a 13px greeting by time of day under it, then a frosted status card (round avatar, 13px title + 11.5px line) beside a frosted feed chip; no pine-cone chip. A glass jar with a cork (`illustrations/pine-jar.webp`, anime style) stands on the floor left of the cushion; up to 12 cones pile inside, the total is on its tag; tap = squash wobble. The jar's count is kept per device (`knowledge-review.pet-jar.v1`); when the history has more cones, the stash scene plays: a cone pops out above the squirrel with a sparkle, it hugs it (`mascot-stash`), walks to the jar and tosses it in on an arc, the jar squashes and the tag ticks up (first cone in full, four more quickly, the rest at once). While reviewing, each new cone flies to the squirrel in the tab bar, which bounces.
- **Bookshelf** (phone knowledge cards, 2026-11-15, after the Dog-ear reading app; `bookshelf.js`): every active module is a book on warm wooden planks. Cover mode (3 a row): cover colour gradient with a darker spine edge, the module's 3D icon (custom: line icon), name in the display font, "n cards · n due", a red ribbon when something is due, a folded corner; spine mode: vertical names, height grows with the card count; the choice is remembered per device. Colours: sky / sage / honey / coral / lavender / teal / rose / olive (presets have fixed defaults, custom ones hash to one; `modules[id].color` overrides). Tap = pull out (tilt) + an info bar with Open; tap again / double tap = the book flies to the middle, the cover swings open on its spine, the page fills the screen; back runs it in reverse to its slot. Long press = edit mode (wobble, ✕ on each, an action sheet: rename (custom), cover colour, delete / remove from shelf with a confirm; same archive rules as settings). Last slot "+ New book" (name, colour, icon). Inside: paper page, sticky header (back, title, search), left contents (30%: all, due, then categories with counts, the chapter in view highlighted), cards by chapter (title, 2-line summary, due / key / paused tags); a card opens full width with a way back. "⋯" holds trash and organizing past Q&A. Desktop keeps the list.
- **Text on scenes** (2026-11-15): everything written over the home desk and the pet nest (date, greeting, due count, stats, pet title and greeting) is warm white `#fffaf2` with a soft brown shadow, over a light warm scrim at the top of each scene (dark mode: a black scrim). Headings stay Smiley Sans; small lines use the UI font at 600. Text on the faded lower part and on frosted cards stays dark. This replaces the black-with-cream-halo and the warm-brown pet title.
- **Spine-first shelf** (2026-11-15, replaces the cover / spine toggle): books always stand as spines (vertical name, icon, ribbon when due, taller with more cards). Tapping one lifts it, the spine turns away and the 112px cover turns in (rotateY), neighbours slide 32px aside; another tap or a tap on the shelf turns it back; tap again / double tap opens it as before.
- **Level and badges** (pet tab → 仓库, `achievements.js` + `badges-ui.js`): level from pine cones (Lv1 小松苗 0, Lv2 拾果学徒 30, Lv3 储粮能手 100, Lv4 林间学者 300, Lv5 松林智者 800, Lv6 森林守护者 2000). Ten badges in a metal-enamel style (warm gold frame, cloisonné scene; hexagons for skills, rounds with a laurel for time-of-day / month; `illustrations/badges/*.webp`, LibTV): first question; ideas learned 10/50/200; goal streak 3/7/30; reviews 50/300/1000; cone collector 50/300/1000; all-rounder 3/10/30 in four books; early bird / night reader 3/15/50; book maker 1/3/6; perfect month. Bronze/silver/gold show as 1–3 stars and the stand finish (the art itself is never tinted); locked = grey with a lock and progress. All worked out from the history with the day each tier was reached; only "already celebrated" is kept per device. Store page: level card (avatar, Lv pill, title, progress bar, cones to next level), stats, badge wall 3 a row. Tap = the badge turns slowly with a metal sheen, tiers with dates. A new tier is celebrated on the pet page after the stash scene (rays, spin-in, "New badge").
- **Loading screen** (phone, 2026-11-15): plain HTML/CSS in `mobile/index.html` (shows before the app code), text from `splash.js` in the saved language. Cream canvas (night: dark), a 4 s loop: the squirrel (`mascot-walk`) runs on the spot with a squash bob while the grass scrolls, rolls a pine cone ahead, crouches and hops a knowledge card (the cone hops it first), lands with a squash, and catches a falling pine cone with a sparkle. Below it three pine cones bounce (no fake progress percentage). It fades in only after 0.3 s, shows "network is slow" after 8 s, and app.js fades it out once the sign-in check ends. Reduced motion: still squirrel, pulsing cones.
- **Pet room style**: `illustrations/pet-nest.webp` is a Japanese anime background painting (soft brushwork, light rays, airy fresh colors) that matches the anime squirrel; the squirrel gets a soft CSS contact shadow on the cushion.
