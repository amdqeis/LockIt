# Motion specification — Aurora UI

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
