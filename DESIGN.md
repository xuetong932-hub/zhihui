---
version: 1
name: knowledge-review-design
description: 知回 / KnowBack design system — reading-first, calm and precise. Adapted from the Mintlify analysis in VoltAgent/awesome-design-md (MIT); 知回 keeps its own name, its green accent and system fonts, and is not affiliated with Mintlify.

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
spacing: { xxs: 4px, xs: 8px, sm: 12px, md: 16px, lg: 20px, xl: 24px, xxl: 32px, section: 48px }
elevation:
  flat: "none + 1px hairline border"            # default cards, inputs, rows
  subtle: "rgba(0,0,0,0.04) 0 1px 2px"           # hover on cards
  card: "rgba(0,0,0,0.08) 0 4px 12px"            # dialogs, floating cards
  brand: "rgba(48,105,79,0.10) 0 8px 24px"       # featured / celebration surfaces only
---

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
