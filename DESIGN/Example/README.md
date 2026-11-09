# Soft Utility / Aurora UI — Framer Motion Demo

**Version 1.1** · React 19 + Vite + Framer Motion · mobile-responsive interactive UI

> This is the animated React companion to the v1.0 design-system specification. The pre-existing `../preview.html` is a standalone static HTML preview; this folder contains the **actual React + Framer Motion implementation**.

## Start the demo

Requirements: Node.js 20.19+ or 22.12+ and npm; internet access for one-time dependency installation.

```bash
cd motion-react-demo
npm install
npm run dev
```

Open the local URL printed by Vite (typically `http://localhost:5173`).

To build a production bundle:

```bash
npm run build
npm run preview
```

## What's animated

| Component | API | Behavior |
|---|---|---|
| Buttons / icon buttons | `whileHover`, `whileTap` | 2px lift; press scale `.965`; spring release |
| Cards / sections | `initial`, `whileInView` | Fade + 18px entrance, once per section |
| Sidebar navigation | `layoutId` | Active background glides between links |
| Segmented control | `LayoutGroup`, `layoutId` | Shared selection pill with a damped spring |
| Financial values | `animate()` | Smooth numeric interpolation on period switch |
| Rhythm / cash-flow charts | `initial`, `animate`, staggered `delay` | Dot matrix reveals progressively |
| Trend filters | `AnimatePresence` with `mode="popLayout"`, `layout="position"` | Rows filter with entrance/exit and reflow |
| Trend details / accordion | `AnimatePresence` | Height/opacity open and close transitions |
| Toasts | `AnimatePresence`, `layout="position"` | Gentle entrance/exit; stacked reflow |
| Dialog | `AnimatePresence`, backdrop, spring | Scaling and rising content; Escape dismisses |
| Search palette | `AnimatePresence` | Quick contextual overlay |
| Form validation | `AnimatePresence` | Inline response without jarring jumps |
| Motion lab | Spring & stagger | Replayable educational samples |

## Important decisions

- Most actions animate **once or on user interaction**. Nothing constantly bounces or glows on dashboards.
- Main UI spring: `stiffness: 270, damping: 31, mass: .95`.
- Press spring: `stiffness: 580, damping: 30`.
- Easing: `[0.22, 1, 0.36, 1]`.
- Animate transforms and opacity where possible. Charts are deliberately small.
- `MotionConfig reducedMotion="user"` plus `useReducedMotion()` checks disable nonessential transforms/entrances.
- Text remains legible on gradients and the information architecture works without animation.

## Component reuse

All components currently live in `src/main.jsx` to keep the demo easy to inspect. To move to a production codebase, extract:

- `MotionButton`, `IconButton` → `components/button/`
- `MotionCard`, `Appear` → `components/surface/`
- `Segmented` → `components/segmented-control/`
- `ToastRegion`, `Modal` → `components/feedback/`
- `AnimatedAmount`, `RhythmChart`, `FlowChart` → `components/data-visualization/`
- `MOTION` → `tokens/motion.js`
- Color/radius CSS variables → `tokens/foundations.css`

See `MOTION_GUIDE.md` for canonical snippets and usage rules.

## Controls to try

- Switch Month / Quarter / Year and observe the pill, chart, and KPI amounts.
- Filter All / Signal / Risk / Trend and expand a trend row.
- Tap any CTA to display a toast, loading response, or modal.
- Replay the staggered animation in Motion Lab.
- Validate a valid or invalid email address.
- Click a palette swatch to copy the HEX code.
- Test reduced motion via operating system / browser accessibility settings.

## Current verification status

JSX source parsing and CSS syntax have been validated. The creation environment could not fetch npm dependencies because outbound package-registry DNS was unavailable, so the live Vite build has **not** been executed here. Run `npm install && npm run build` on your machine to verify the installed versions in your environment.

## Accessibility

Reduced motion is supported. Tabs expose pressed state; trends and accordion expose expanded state; toast messages use `role="status"` / `role="alert"`; the modal closes on Escape. For production, add a full focus trap to the modal, a live announcement for dynamic totals, localization, automated testing, and integration with real data.
