
# Soft Utility / Aurora UI — Design System v1.1

## EduQuas application profile

The EduQuas participant frontend uses the **Aurora reference system below**, as selected for the new implementation. Its active base is canvas `#F5F5F5`, white surface, ink `#17171A`, lavender `#9B7AC8`, pink `#F33D9B`, and focus `#7867D9`, with self-hosted Inter Variable. Text colors `#62626C` and `#AA343D` are darker semantic variants for readable secondary and error text on the canvas.

The exam code step is unboxed. From the identity step onward, the admission flow uses a white card that resizes between steps, while history uses whitespace and simple separators. Status uses text in addition to color. The previous green product profile described an earlier frontend and is no longer the palette for this implementation.

The exam workspace pairs a wide question area with a number navigator on desktop; on smaller screens the navigator becomes a horizontal strip above the question. Its timer uses a neutral light-gray surface and dark text. Answered, current, and marked states have accessible names and are not distinguished by color alone.

The implementation plan is in [Frontend Redesign Plan](FRONTEND_REDESIGN_PLAN.md). [`Example/src/main.jsx`](Example/src/main.jsx) and [`Example/src/styles.css`](Example/src/styles.css) provide interaction references; their finance content is not product data.

---

## Aurora reference system

> Based on four visual references supplied by the requester. This is a coherent interpretation, not an exact reconstruction of the source project's underlying Figma tokens.

> **NEW in v1.1 — Real React + Framer Motion implementation:** The `Example/` subfolder adds a fully interactive responsive dashboard, component gallery, and Motion Lab using `framer-motion` (buttons, shared-layout tabs/nav, card entrances, chart staggering, animated values, expandable panels, modals, and toasts). Launch with:
>
> ```bash
> cd DESIGN/Example
> npm install
> npm run dev
> ```
>
> See [`Example/README.md`](Example/README.md) and [`Example/MOTION_GUIDE.md`](Example/MOTION_GUIDE.md). The example documents Framer Motion patterns; live EduQuas pages should follow the product profile above.


## Design DNA

- **Neutral first.** Quiet off-white canvas and white cards provide clarity. Dark charcoal grounds primary action.
- **Gradient as content.** Lilac, sky, coral, and pink appear on selected data/feature cards and promotional content, not across every surface.
- **Editorial information hierarchy.** Large numerals, restrained tracking, light secondary labels, abundant whitespace.
- **Physical-feeling microinteractions.** Fast press feedback, soft spring-like release, restrained entrance animations.
- **Purposeful color.** Functional statuses never depend on color alone; labels and icons convey meaning.

### Ratio

70% neutrals / 20% supportive surfaces and accents / 10% expressive gradients and CTA highlights. This is a design heuristic, not a hard computational constraint.

## 1. Foundations

### Color tokens

| Token | Value | Usage |
|---|---|---|
| `--canvas` | `#F5F5F5` | Main page background |
| `--surface` | `#FFFFFF` | Cards, sheets, popovers |
| `--surface-muted` | `#F8F8F9` | Input fills, subdued areas |
| `--ink` | `#17171A` | Main text, primary CTA |
| `--text-secondary` | `#74747C` | Secondary text |
| `--text-tertiary` | `#A0A0A8` | Hints, metadata |
| `--border` | `#E9E9EC` | Outlines, separators |
| `--lavender` | `#9B7AC8` | Feature gradient anchor |
| `--sky` | `#7FB5F1` | Information gradient anchor |
| `--pink` | `#F33D9B` | Promotional CTA / highlights |
| `--coral` | `#F27B7C` | Expense cards |
| `--success` | `#169E66` | Positive feedback |
| `--warning` | `#DE9A2B` | Alerts |
| `--danger` | `#DE5558` | Errors, destructive actions |
| `--focus` | `#7867D9` | Keyboard focus ring |

### Gradient tokens

```css
--gradient-lilac:
  radial-gradient(circle at 78% 18%, rgba(217,152,226,.85), transparent 52%),
  linear-gradient(145deg, #7564AD, #997CC1 52%, #C48ED5);
--gradient-sky:
  radial-gradient(circle at 78% 80%, rgba(190,238,255,.95), transparent 60%),
  linear-gradient(135deg, #7288D7, #A3C8F2);
--gradient-coral:
  radial-gradient(circle at 90% 84%, rgba(255,202,195,.9), transparent 65%),
  linear-gradient(140deg, #E86B74, #F4A2A1);
--gradient-pink: linear-gradient(135deg, #D92E8F, #FA4CA3);
```

Keep text contrast strong: white text only against sufficiently dark gradient regions; use black/dark ink on the light portion of a pastel gradient.

### Typography

Primary: `Inter Variable, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. On native iOS, use SF Pro via system font. The reference images do not definitively establish the exact original typeface.

| Token | Size | Line-height | Weight | Letter-spacing |
|---|---:|---:|---:|---:|
| Display | 40px | 44px | 600 | -0.04em |
| H1 | 28px | 34px | 600 | -0.035em |
| H2 | 22px | 28px | 600 | -0.03em |
| H3 | 17px | 24px | 600 | -0.02em |
| Body | 14px | 22px | 400 | -0.01em |
| Button | 13px | 18px | 600 | -0.005em |
| Caption | 12px | 16px | 400 | 0 |
| Financial KPI | 36px | 40px | 500 | -0.045em |

- Important amounts: `font-variant-numeric: tabular-nums`.
- Use italic as an occasional editorial accent, not for form labels or critical metrics.
- Use sentence case for titles, labels and CTAs.

### Radius, spacing, borders, shadows

| Token | Value | Usage |
|---|---:|---|
| `--radius-sm` | 10px | Small chips, tiny tiles |
| `--radius-md` | 14px | Fields, desktop cards |
| `--radius-lg` | 20px | Standard desktop card |
| `--radius-xl` | 26px | Hero / mobile card |
| `--radius-pill` | 999px | Buttons, segmented controls |
| `--space-*` | 4, 8, 12, 16, 24, 32, 48, 64px | 4pt grid |
| `--border` | 1px solid `#E9E9EC` | Delicate separation |
| `--shadow-card` | `0 8px 28px rgba(23,23,26,.04)` | White floating cards |
| `--shadow-popover` | `0 14px 44px rgba(23,23,26,.12)` | Overlay layer |

Avoid prominent outer glow or chunky dark shadows on pastel cards.

## 2. Interactive Components

### Buttons

| Type | Appearance | Use | Hover / Press |
|---|---|---|---|
| Primary | Dark charcoal capsule, white text | Main user task, e.g. Save / Continue | lift -1px / scale .975 |
| Secondary | White capsule, subtle border, dark text | Adjacent non-primary action | pale fill / scale .985 |
| Tertiary | Transparent, dark label | Low-emphasis actions | muted fill / scale .985 |
| Accent | Pink capsule, white text | One promoted action per view, e.g. Launch / Try | brighten / scale .975 |
| Icon | Circular white button with dark icon | Filter, Back, Settings | soft fill / scale .94 |
| Destructive | White + red text; red fill only when confirmation warranted | Delete | darker tint / scale .98 |

- Small: height 34px, horizontal padding 14px.
- Medium: height 42px, horizontal padding 20px.
- Large: height 50px, horizontal padding 24px.
- Touch hit area at least 44×44 CSS px (minimum); prefer 48px for important touch CTAs.
- One principal CTA per card/view. Secondary actions should not fight it.
- Disabled: visibly muted, no hover elevation, `aria-disabled`/native disabled.
- Loading: stable width and label position; spinner aligned without layout jump; prevent double submit.
- Focus-visible: 2px focus ring with 3px offset, visibly contrasting adjacent colors.

### Tabs and segmented control

- Light neutral container, charcoal active capsule.
- Active label white, inactive labels gray.
- 4px inner padding, 40–44px total height.
- Sliding active pill: 180–220ms, ease-out, respecting reduced motion.
- Tabs use semantic tablist/tabpanel or native navigation links as appropriate.

### Cards

- Default: white, border #E9E9EC, radius 20px, soft shadow if needed.
- Hero gradient: radius 26px, enough padding (24px), white headline only on dark portion.
- Tinted metric card: radius 20–22px, no separate garish badge. Keep labels and amounts aligned.
- Small charts use subdued dot grids and a single accent for the active series.

### Forms and data display

- Field: 44–48px height, white/muted fill, 1px border; visible label above; optional hint below.
- Focus: ring rather than aggressively recoloring entire field.
- Validation: inline icon + message; don't rely only on red.
- Currency/financial amounts: tabular numerals, clear negatives, sign and unit, context period.
- Loading placeholders: subtle shimmer at 1.6s, disabled for reduced-motion preference.

## 3. CTA Architecture

- **Global/primary CTA:** charcoal with white label; always visually dominant over neutral controls.
- **Promotional CTA:** pink or pink-gradient, but used sparingly (ideally at most once per viewport).
- **Embedded CTA:** small dark capsule inside feature card or a dark pill with a pink circular accent.
- **Floating mobile CTA:** capsule near screen bottom with safe-area padding; never obscures essential content; preserve 44px target size.
- **CTA language:** verb-first and specific, e.g. "Lihat analitik", "Simpan perubahan", "Buat laporan"; avoid generic "Klik di sini".

## 4. Feedback and Motion

### Motion tokens

```css
--ease-out: cubic-bezier(.22, 1, .36, 1);
--ease-standard: cubic-bezier(.2, .8, .2, 1);
--duration-fast: 120ms;
--duration-ui: 180ms;
--duration-panel: 260ms;
--duration-chart: 550ms;
```

| Trigger | Animation | Duration | Purpose |
|---|---|---:|---|
| Button hover | translateY(-1px), softened shadow | 120–160ms | Affordance |
| Button press | scale(.975) | 100–140ms | Tactile confirmation |
| Segmented change | Active pill slides | 180–220ms | Selection continuity |
| Modal / sheet open | opacity 0→1, translateY(12px→0) | 240–280ms | Layer introduction |
| Card appears | opacity 0→1, translateY(10px→0) | 280–360ms | Entrance |
| Chart enters | dots rise/fade sequentially | 450–650ms | Readability of change |
| Toast appears | opacity + translateY(8px→0) | 180–220ms | Non-blocking feedback |
| Loading | spinner rotation | continuous | Pending state |
| Skeleton | low-contrast shimmer | 1.6s cycle | Loading content |

### State feedback matrix

| State | UI treatment | Example microcopy |
|---|---|---|
| Idle | Default visuals | "Simpan" |
| Hover/focus | Increased affordance, focus ring for keyboard | unchanged |
| Press | Brief compression | unchanged |
| Loading | Spinner, stable button width, disabled repeated activation | "Menyimpan…" |
| Success | Small green icon, brief toast / status line | "Perubahan tersimpan" |
| Warning | Amber indicator + useful instructions | "Periksa data sebelum lanjut" |
| Error | Field/section-level message and action to retry | "Gagal menyimpan. Coba lagi." |
| Empty | Icon + explanation + meaningful action | "Belum ada laporan. Buat laporan pertama." |
| Disabled | Distinct muted style + explanatory context if needed | e.g. required field missing |

### Animation rules

1. Prefer `transform` and `opacity`; do not animate expensive layout geometry unnecessarily.
2. No perpetual dancing, glowing, or parallax on default application surfaces.
3. Color transitions and shadows should be subtle; avoid multiple simultaneous effects.
4. Keep numeric charts/data comprehensible even if animation never runs.
5. Observe `prefers-reduced-motion: reduce`: remove nonessential motion (slide, shimmer, ornamental loops), but retain instant state feedback.
6. For loading that finishes almost instantly, don't flash a spinner; consider displaying the spinner only after ~250ms.

### Toast implementation guidance

- Corner radius 14–16px, white panel, very soft shadow.
- Minimal status icon + bold action-relevant message.
- Success can dismiss automatically after ~4 seconds; errors should persist or remain discoverable as inline messages.
- For assistive technology, use `role="status"` for success, `role="alert"` for urgent errors.

## 5. Responsive Composition

### Desktop

- Sidebar 220–248px; page content max 1440px as appropriate.
- Background off-white, content in asymmetrical white/gradient cards.
- 12-column grid, usually 16px gaps (24px on roomy screens).
- Top sections: page heading and actions, then hero metric, then secondary tiles/table.

### Mobile

- 16–20px horizontal content gutter; 14–16px vertical gaps.
- Hero card full width and radius 24–26px.
- 2-up colored metric cards when width permits; stack when narrow.
- Floating bottom CTA respects `env(safe-area-inset-bottom)` and scroll affordances.
- Hide nonessential table columns; retain clear labels, tap areas, and feedback.

## 6. Accessibility / QA checklist

- [ ] Normal text meets WCAG AA contrast 4.5:1; large text generally 3:1.
- [ ] Pastel gradients do not place white text on light regions without dark overlay.
- [ ] Keyboard tab order, focus-visible, Esc dismiss behavior, logical button labels.
- [ ] Touch targets >=44×44 CSS px (or platform standard).
- [ ] Status has textual/icon cues and `aria-live` as relevant.
- [ ] All interaction states usable without animation and without color perception.
- [ ] Layout tests at 320, 375, 768, 1024, 1440 CSS px.
- [ ] Validate reduced-motion and loading/error/empty states.

## 7. CSS starter

```css
:root {
  --canvas: #F5F5F5;
  --surface: #FFF;
  --surface-muted: #F8F8F9;
  --ink: #17171A;
  --text-secondary: #74747C;
  --text-tertiary: #A0A0A8;
  --border: #E9E9EC;
  --lavender: #9B7AC8;
  --sky: #7FB5F1;
  --pink: #F33D9B;
  --coral: #F27B7C;
  --success: #169E66;
  --warning: #DE9A2B;
  --danger: #DE5558;
  --focus: #7867D9;
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 20px;
  --radius-xl: 26px;
  --radius-pill: 999px;
  --shadow-card: 0 8px 28px rgb(23 23 26 / 4%);
  --ease-out: cubic-bezier(.22, 1, .36, 1);
  --duration-fast: 120ms;
  --duration-ui: 180ms;
  --duration-panel: 260ms;
  --duration-chart: 550ms;
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.button {
  min-height: 44px;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  padding: 0 20px;
  font-family: inherit;
  font-weight: 600;
  font-size: 13px;
  line-height: 18px;
  transition: transform var(--duration-fast) var(--ease-out),
    background-color var(--duration-fast), box-shadow var(--duration-fast);
}
.button:active:not(:disabled) { transform: scale(.975); }
.button:focus-visible { outline: 2px solid var(--focus); outline-offset: 3px; }
.button:disabled { opacity: .4; cursor: not-allowed; }
.button--primary { color: #fff; background: var(--ink); }
.button--secondary { color: var(--ink); background: #fff; border-color: var(--border); }
.button--accent { color: #fff; background: var(--pink); }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
```

> A local interactive preview is also supplied (`preview.html`) demonstrating buttons, cards, tabs, loading/success/error feedback, and entrance motion.
