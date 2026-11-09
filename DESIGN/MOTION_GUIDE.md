# Motion specification — Aurora UI

## EduQuas application profile

Use the Aurora timing and behavior below for the EduQuas participant frontend.

Implement new interaction and state animations with Framer Motion, including progress changes and validation feedback. Preserve accessible static feedback and respect reduced motion.

The exam code is unboxed. On entering identity, the card grows from a smaller size first, then the identity content fades in; subsequent steps smoothly adjust the card height. Content is never clipped or stretched. The history section follows the card with a position-only layout animation. Restore keyboard focus to the new step once it appears. Buttons and answer choices acknowledge pointer interactions, and dialogs enter gently; the exam timer remains static.

On page load, the logo, admission area, progress indicator, and history appear with brief coordinated motion; history entries can enter as they load. The exam workspace fades in once without decorating the timer. With reduced motion, show each area immediately.

Question navigation keeps the active number visible in the mobile strip, and the progress bar animates to the answered count over 220 ms. Reduced motion makes navigation and progress changes immediate.

At the end of a dashboard section, the next-section indicator follows the extra swipe or scroll and shows its percentage. A cancelled gesture resets it; a completed touch gesture navigates on release. Reduced motion updates the indicator immediately, and a regular link remains available for keyboard navigation.

While admission is awaiting the supervisor, a small loading indicator accompanies the written status. Stop it when the status changes or cannot be refreshed; under reduced motion, retain the written status without rotation.

| Token | Duration | Use |
|---|---:|---|
| Control | 140 ms | Button, hover, focus, and border feedback |
| State | 220 ms | Local validation, state changes, and content transition |
| Panel | 320 ms | Dialog and contextual panel |

Realtime updates may briefly highlight the participant row that changed, but must not reorder the grid while a teacher is using it. Do not add decorative movement to the global exam timer. Honor `prefers-reduced-motion` by removing nonessential movement and keeping state feedback immediate. Follow the EduQuas palette and type choices in [Design System](DESIGN_SYSTEM.md).

Every CTA acknowledges activation and exposes the outcome: use a pressed state, a clear loading label for asynchronous work, and a visible success or error state. For an invalid exam code, pair the persistent error text with a brief 220 ms horizontal shake of the code input and its underlines; repeat it on each failed attempt. With reduced motion, retain the error text and focus behavior without the shake. Do not animate background polling failures as though the user pressed a button.

Useful source patterns in [`Example/src/main.jsx`](Example/src/main.jsx) include `MotionButton`, reduced-motion checks, and shared-layout selection using `LayoutGroup`. The example modal is not production-ready: its README explicitly calls for a full focus trap and restoration. The participant frontend uses a native modal dialog with focus restoration.

---

## Aurora reference recipes

Motion should confirm an action or preserve visual continuity. The default should be calm. This document defines **Framer Motion** primitives for implementation.

## Tokens

```js
export const motionTokens = {
  ease: [0.22, 1, 0.36, 1],
  spring: { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 },
  softSpring: { type: 'spring', stiffness: 270, damping: 31, mass: 0.95 },
  press: { type: 'spring', stiffness: 580, damping: 30 },
  fast: 0.14,
  ui: 0.22,
  panel: 0.32,
  chart: 0.55,
}
```

**Rules:**
- Motion between `100–360ms` for most controls. Data reveals can last up to `650ms` if they are staggered and meaningful.
- Cards move by at most 18px on entrance and 3px on hover; buttons press to `0.965`.
- Only animate structural layout with `layout`, `layoutId`, or opacity/transform. Avoid animating lots of box-shadows and blurred filters.
- No looping ornamental motion on data-rich screens.
- Every state must still make sense with all animations removed.

## Reusable motion button

```jsx
import { motion, useReducedMotion } from 'framer-motion'

export function MotionButton({ children, ...props }) {
  const reduce = useReducedMotion()
  return (
    <motion.button
      whileHover={reduce ? undefined : { y: -2, scale: 1.012 }}
      whileTap={reduce ? undefined : { scale: 0.965 }}
      transition={{ type: 'spring', stiffness: 580, damping: 30 }}
      {...props}
    >
      {children}
    </motion.button>
  )
}
```

## Shared segmented pill

```jsx
import { motion, LayoutGroup } from 'framer-motion'

function Segmented({ items, value, onChange }) {
  return (
    <LayoutGroup>
      <div className="segmented" role="group">
        {items.map(item => (
          <button key={item} onClick={() => onChange(item)} aria-pressed={item === value}>
            {item === value && (
              <motion.span
                layoutId="active-pill"
                className="active-pill"
                transition={{ type: 'spring', stiffness: 270, damping: 31 }}
              />
            )}
            <span>{item}</span>
          </button>
        ))}
      </div>
    </LayoutGroup>
  )
}
```

Scope a `layoutId` with a `LayoutGroup` if more than one instance could appear on the same screen.

## Presence / toast

```jsx
import { AnimatePresence, motion } from 'framer-motion'

<AnimatePresence initial={false}>
  {messages.map(message => (
    <motion.div
      layout="position"
      key={message.id}
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 270, damping: 31 }}
      role={message.type === 'error' ? 'alert' : 'status'}
    >
      {message.title}
    </motion.div>
  ))}
</AnimatePresence>
```

Success messages can dismiss automatically after ~4 seconds. Failure messages should last longer and remain discoverable in the underlying UI.

## Staggered content

```jsx
const parent = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }
const child = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
}

<motion.div variants={parent} initial="hidden" animate="visible">
  {items.map(item => <motion.div key={item.id} variants={child}>{item.title}</motion.div>)}
</motion.div>
```

## Reduced motion

```jsx
import { MotionConfig, useReducedMotion } from 'framer-motion'

function App() {
  return <MotionConfig reducedMotion="user"><Dashboard /></MotionConfig>
}

function DashboardCard() {
  const reduce = useReducedMotion()
  return <motion.article initial={reduce ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} />
}
```

When the preference is set to `reduce`, remove entrances, scaled presses, movement, chart stagger, and shimmer. Retain instant state changes and focus indicators.

## State-to-animation map

| Component | Trigger | Motion | Stop condition |
|---|---|---|---|
| Button | pointer hover | `y:-2, scale:1.012` | pointer leaves |
| Button | press | `scale:.965` | release |
| Nav | selected item changes | shared `layoutId` | new item settled |
| Card | enters viewport | `opacity 0→1, y:18→0` | once |
| Chart | period changes | dot stagger + opacity | 650ms maximum |
| List | filter changes | enter/exit + `layout` | 250ms |
| Modal | open/close | scale + opacity + translate | 300ms |
| Accordion | toggle | height auto + opacity | 240ms |
| Toast | emitted/dismissed | opacity + translate | 220ms |
| Field | validation | inline status fade | 170ms |

## Production checklist

- [ ] Respect `prefers-reduced-motion` at every interaction boundary.
- [ ] Check contrast on light areas of gradient cards.
- [ ] No spinners for tasks under 250ms (delay optional loading indication).
- [ ] Don't animate every data point continuously.
- [ ] Make buttons and toast messages keyboard/screen-reader accessible.
- [ ] Provide modal focus trap and focus restoration.
- [ ] Test on iPhone-sized screens and a slow 4G CPU profile.
- [ ] Use one parent `MotionConfig` to keep feel consistent.
