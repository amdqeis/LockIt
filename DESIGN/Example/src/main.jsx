import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  motion,
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  animate,
  useReducedMotion,
} from 'framer-motion'
import {
  Activity,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  ChartNoAxesCombined,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Command,
  CreditCard,
  Download,
  Filter,
  Home,
  Info,
  Layers2,
  LayoutDashboard,
  LoaderCircle,
  Mail,
  MoreHorizontal,
  MousePointer2,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Wallet,
  X,
  AlertCircle,
} from 'lucide-react'
import './styles.css'

// All durations are seconds. Prefer one small set of motion tokens globally.
const MOTION = {
  ease: [0.22, 1, 0.36, 1],
  spring: { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 },
  softSpring: { type: 'spring', stiffness: 270, damping: 31, mass: 0.95 },
  press: { type: 'spring', stiffness: 580, damping: 30 },
  fast: 0.14,
  ui: 0.22,
  panel: 0.32,
  chart: 0.55,
}
const PERIODS = ['Month', 'Quarter', 'Year']
const PERIOD_DATA = {
  Month: { payments: 42, rhythm: 66034, income: 32023, expense: 66034, net: -34011, progress: 68 },
  Quarter: { payments: 126, rhythm: 188420, income: 113850, expense: 188420, net: -74570, progress: 76 },
  Year: { payments: 508, rhythm: 748340, income: 524180, expense: 748340, net: -224160, progress: 88 },
}
const PALETTE = [
  { label: 'Ink', hex: '#17171A' },
  { label: 'Muted', hex: '#74747C' },
  { label: 'Border', hex: '#E9E9EC' },
  { label: 'Canvas', hex: '#F5F5F5' },
  { label: 'White', hex: '#FFFFFF' },
  { label: 'Lavender', hex: '#9B7AC8' },
  { label: 'Sky', hex: '#7FB5F1' },
  { label: 'Pink CTA', hex: '#F33D9B' },
  { label: 'Coral', hex: '#F27B7C' },
  { label: 'Success', hex: '#169E66' },
]
const NAV = [
  { label: 'Overview', icon: LayoutDashboard, target: 'overview' },
  { label: 'Analytics', icon: ChartNoAxesCombined, target: 'analytics' },
  { label: 'Components', icon: Layers2, target: 'components' },
  { label: 'Motion Lab', icon: Activity, target: 'motion-lab' },
]
const TRENDS = [
  { id: '1', title: 'Invoice auto-approval', detail: 'Automatic review rules are now active', category: 'Signal', kind: 'success', icon: Check, time: 'Just now' },
  { id: '2', title: 'Duplicate subscriptions', detail: 'Potential recurring charges detected', category: 'Signal', kind: 'success', icon: Check, time: '3m ago' },
  { id: '3', title: 'Contractor rate spike', detail: 'Unusual expense compared with last month', category: 'Risk', kind: 'danger', icon: AlertCircle, time: '12m ago' },
  { id: '4', title: 'Budget limit reached', detail: 'Travel budget has exceeded the threshold', category: 'Risk', kind: 'danger', icon: AlertCircle, time: '1h ago' },
  { id: '5', title: 'Runway improved', detail: 'Projected cash runway increased', category: 'Trend', kind: 'blue', icon: ArrowUpRight, time: '3h ago' },
  { id: '6', title: 'Payroll on forecast', detail: 'Scheduled payments are matching the plan', category: 'Trend', kind: 'blue', icon: CreditCard, time: 'Yesterday' },
]
const ACTIVITIES = [
  { title: 'Vendor spike reviewed', detail: 'Pulse highlighted an unusual monthly invoice', icon: Sparkles, color: 'orange', time: '09:41' },
  { title: 'Weekly digest sent', detail: 'Your summary is ready to explore', icon: Mail, color: 'green', time: '09:18' },
  { title: 'Payroll cleared', detail: 'All 16 payments completed successfully', icon: Check, color: 'blue', time: '08:55' },
  { title: 'Spend report generated', detail: 'New report covering all categories', icon: ChartNoAxesCombined, color: 'purple', time: 'Yesterday' },
]
const formatNumber = (num) => Math.round(Math.abs(num)).toLocaleString('en-US')
const money = (num) => `${num < 0 ? '−' : ''}$${formatNumber(num)}`

function MotionButton({ variant = 'secondary', icon, children, className = '', disabled, loading, ...props }) {
  const reduce = useReducedMotion()
  return (
    <motion.button
      type="button"
      className={`button button-${variant} ${className}`}
      disabled={disabled || loading}
      whileHover={reduce || disabled || loading ? undefined : { y: -2, scale: 1.012 }}
      whileTap={reduce || disabled || loading ? undefined : { scale: 0.965, y: 0 }}
      transition={MOTION.press}
      {...props}
    >
      {loading ? <LoaderCircle aria-hidden className="button-spinner" size={16} /> : icon ?? null}
      {children}
    </motion.button>
  )
}

function IconButton({ label, children, className = '', ...props }) {
  return <MotionButton variant="icon" aria-label={label} title={label} className={className} {...props}>{children}</MotionButton>
}

function Appear({ children, className = '', delay = 0, y = 18, as = 'div', ...props }) {
  const reduce = useReducedMotion()
  const Tag = motion[as] || motion.div
  return (
    <Tag
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: MOTION.panel, ease: MOTION.ease, delay }}
      {...props}
    >{children}</Tag>
  )
}

function MotionCard({ children, className = '', delay = 0, hover = false, ...props }) {
  const reduce = useReducedMotion()
  return (
    <Appear delay={delay} className={`card ${className}`} {...props}>
      <motion.div
        className="card-inner"
        whileHover={hover && !reduce ? { y: -3 } : undefined}
        transition={MOTION.softSpring}
      >{children}</motion.div>
    </Appear>
  )
}

function AnimatedAmount({ value, className = '' }) {
  const ref = useRef(null)
  const oldValue = useRef(value)
  const reduce = useReducedMotion()
  useEffect(() => {
    if (!ref.current) return
    if (reduce) {
      ref.current.textContent = money(value)
      oldValue.current = value
      return
    }
    const controls = animate(oldValue.current, value, {
      duration: 0.7,
      ease: MOTION.ease,
      onUpdate: (latest) => { if (ref.current) ref.current.textContent = money(latest) },
    })
    oldValue.current = value
    return () => controls.stop()
  }, [value, reduce])
  return <span ref={ref} className={className}>{money(value)}</span>
}

function Segmented({ value, onChange, items = PERIODS, name = 'period' }) {
  const reduce = useReducedMotion()
  return (
    <LayoutGroup id={`segmented-${name}`}>
      <div className="segmented" role="group" aria-label="Time range">
        {items.map(item => (
          <motion.button
            type="button"
            key={item}
            className={`segment ${value === item ? 'is-selected' : ''}`}
            onClick={() => onChange(item)}
            aria-pressed={value === item}
            whileTap={reduce ? undefined : { scale: 0.96 }}
          >
            {value === item && (
              <motion.span
                className="segment-thumb"
                layoutId="selection"
                transition={reduce ? { duration: 0 } : MOTION.softSpring}
              />
            )}
            <span className="segment-label">{item}</span>
          </motion.button>
        ))}
      </div>
    </LayoutGroup>
  )
}

function Sidebar({ active, onNavigate, openSearch, notify }) {
  const reduce = useReducedMotion()
  return (
    <aside className="sidebar" aria-label="Main sidebar">
      <div className="brand"><span className="brand-mark"><Sparkles size={14} strokeWidth={2.8}/></span> pulse<span className="brand-dot">.</span></div>
      <div className="sidebar-caption">WORKSPACE</div>
      <nav aria-label="Primary navigation" className="sidebar-nav">
        {NAV.map(({ label, icon: Icon, target }) => (
          <motion.button
            key={target}
            type="button"
            onClick={() => onNavigate(target)}
            className={`nav-link ${active === target ? 'active' : ''}`}
            aria-current={active === target ? 'page' : undefined}
            whileHover={reduce ? undefined : { x: 2 }}
            whileTap={reduce ? undefined : { scale: 0.98 }}
          >
            {active === target && <motion.span layoutId="nav-pill" className="nav-active" transition={reduce ? { duration: 0 } : MOTION.softSpring}/>}
            <Icon size={17} strokeWidth={1.8}/><span>{label}</span>
          </motion.button>
        ))}
      </nav>
      <div className="sidebar-caption sidebar-caption-spaced">PREFERENCES</div>
      <nav aria-label="Utilities" className="sidebar-nav">
        <motion.button className="nav-link" whileHover={reduce ? undefined : { x: 2 }} onClick={openSearch}><Search size={17}/> Search</motion.button>
        <motion.button className="nav-link" whileHover={reduce ? undefined : { x: 2 }} onClick={() => notify('Settings', 'Design tokens are ready to customize', 'info')}><Settings2 size={17}/> Settings</motion.button>
        <motion.button className="nav-link" whileHover={reduce ? undefined : { x: 2 }} onClick={() => notify('Help center', 'Motion guidelines are included in the README', 'info')}><CircleHelp size={17}/> Support</motion.button>
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-mini-card"><div className="sidebar-mini-icon"><Sparkles size={18}/></div><b>Motion design</b><span>Give every detail a little life.</span></div>
        <button className="profile" onClick={() => notify('Welcome back', 'Your workspace is ready', 'success')}>
          <div className="avatar">JD</div><span><b>Jordan Doe</b><small>Personal workspace</small></span><ChevronDown size={14}/>
        </button>
      </div>
    </aside>
  )
}

function RhythmChart({ period }) {
  const reduce = useReducedMotion()
  const values = useMemo(() => Array.from({ length: 46 }, (_, index) => {
    const wave = Math.sin(index * 0.41 + PERIODS.indexOf(period) * 1.1)
    const bump = index > 27 && index < 38 ? 1.2 : 0
    return Math.max(1, Math.round(1.9 + (wave + 1) * 1.6 + bump + Math.sin(index * 0.8) * 0.8))
  }), [period])
  return (
    <div className="rhythm-chart" role="img" aria-label={`Animated dot chart for ${period.toLowerCase()} payment rhythm`}>
      {values.map((height, i) => (
        <div className="rhythm-column" key={`${period}-${i}`}>
          {Array.from({ length: height }, (_, j) => (
            <motion.span
              key={j}
              className={`rhythm-dot ${i < 4 ? 'rhythm-dot-bright' : ''}`}
              initial={reduce ? false : { opacity: 0, scale: 0.3, y: 6 }}
              animate={{ opacity: i < 4 ? .85 : .65, scale: 1, y: 0 }}
              transition={reduce ? { duration: 0 } : { duration: .28, ease: MOTION.ease, delay: Math.min(i * .011 + j * .018, .72) }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function FlowChart({ period }) {
  const reduce = useReducedMotion()
  const columns = useMemo(() => Array.from({length: 33}, (_, i) => {
    const level = Math.round(2 + Math.sin(i * .45 + PERIODS.indexOf(period)) * 1.4 + i / 17)
    return Math.max(2, Math.min(7, level))
  }), [period])
  return (
    <div className="flow-chart" role="img" aria-label={`Cash flow dot matrix for ${period.toLowerCase()}: positive and negative transactions`}>
      {columns.map((level, i) => (
        <div key={`${period}-${i}`} className="flow-column">
          <div className="flow-half flow-in">{Array.from({length: level}, (_, j) => <motion.i key={j} initial={reduce ? false : {opacity:0, scale:0}} animate={{opacity:1,scale:1}} transition={{duration: .2, delay: reduce ? 0 : .13 + i*.013 + j*.008}} />)}</div>
          <div className="flow-half flow-out">{Array.from({length: Math.max(2, 8-level)}, (_, j) => <motion.i key={j} initial={reduce ? false : {opacity:0, scale:0}} animate={{opacity:1,scale:1}} transition={{duration: .2, delay: reduce ? 0 : .15 + i*.013 + j*.008}} />)}</div>
        </div>
      ))}
    </div>
  )
}

function MetricCard({ type, value, period, onClick }) {
  const income = type === 'income'
  return (
    <MotionCard hover className={`metric-card ${income ? 'metric-blue' : 'metric-coral'}`}>
      <div className="metric-top"><div className="metric-label"><span className="metric-orbit"><Sparkles size={14}/></span>{income ? 'Income' : 'Expenses'}</div><IconButton label={`View ${type} details`} className="metric-arrow" onClick={onClick}><ArrowUpRight size={16}/></IconButton></div>
      <div><AnimatedAmount className="metric-number" value={value}/><div className="metric-foot">this {period.toLowerCase()}</div></div>
    </MotionCard>
  )
}

function Tag({ children, kind = 'success' }) { return <span className={`tag tag-${kind}`}>{children}</span> }

function TrendList({ activeFilter }) {
  const [expanded, setExpanded] = useState(null)
  const reduce = useReducedMotion()
  const trends = TRENDS.filter(item => activeFilter === 'All' || item.category === activeFilter)
  return (
    <div className="trend-list">
      <AnimatePresence mode="popLayout" initial={false}>
        {trends.map((item, index) => {
          const Icon = item.icon
          const open = expanded === item.id
          return (
            <motion.div layout="position" key={item.id} className="trend-entry"
              initial={reduce ? false : {opacity:0, y:12}}
              animate={{opacity:1,y:0}}
              exit={reduce ? {opacity:0} : {opacity:0, y:-7, transition:{duration:.13}}}
              transition={{delay:reduce?0:index*.032,duration:.2,ease:MOTION.ease}}
            >
              <motion.button className="trend-row" onClick={() => setExpanded(open ? null : item.id)} whileHover={reduce ? undefined : {x:2}} aria-expanded={open}>
                <span className={`trend-icon trend-${item.kind}`}><Icon size={12} strokeWidth={2.5}/></span>
                <span className="trend-content"><b>{item.title}</b><small>{item.detail}</small></span>
                <Tag kind={item.kind}>{item.category}</Tag>
                <motion.span animate={{rotate:open?180:0}} transition={reduce?{duration:0}:MOTION.softSpring} className="trend-chevron"><ChevronDown size={13}/></motion.span>
              </motion.button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div className="trend-expanded" initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={reduce ? {duration:0} : {duration:.22,ease:MOTION.ease}}>
                    <span>{item.time} · Pulse monitored this signal. It will stay in your feed until dismissed.</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

function ActivityList() {
  const reduce = useReducedMotion()
  return <div className="activity-list">
    {ACTIVITIES.map((item, index) => {
      const Icon = item.icon
      return <motion.div key={item.title} className="activity-row"
        initial={reduce ? false : {opacity:0,x:10}}
        whileInView={reduce ? undefined : {opacity:1,x:0}}
        viewport={{once:true}}
        transition={{duration:.24,delay:index*.045,ease:MOTION.ease}}
        whileHover={reduce?undefined:{x:2}}
      ><div className={`activity-icon activity-${item.color}`}><Icon size={14}/></div><div className="activity-content"><b>{item.title}</b><span>{item.detail}</span></div><time>{item.time}</time></motion.div>
    })}
  </div>
}

function ToastRegion({ toasts, dismiss }) {
  const reduce = useReducedMotion()
  return <div className="toasts" aria-label="Notifications">
    <AnimatePresence initial={false}>
      {toasts.map(t => {
        const Icon = t.type === 'error' ? AlertCircle : t.type === 'info' ? Info : CheckCircle2
        return <motion.div key={t.id} className="toast" role={t.type === 'error' ? 'alert' : 'status'}
          initial={reduce ? {opacity:0} : {opacity:0,x:28,y:12,scale:.96}}
          animate={{opacity:1,x:0,y:0,scale:1}}
          exit={reduce ? {opacity:0} : {opacity:0,x:24,scale:.96}}
          layout="position"
          transition={reduce ? {duration:.08} : MOTION.softSpring}
        >
          <div className={`toast-mark toast-${t.type}`}><Icon size={16}/></div><div className="toast-body"><strong>{t.title}</strong><span>{t.detail}</span></div>
          <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss notification"><X size={14}/></button>
        </motion.div>
      })}
    </AnimatePresence>
  </div>
}

function Modal({ open, onClose, onConfirm }) {
  const reduce = useReducedMotion()
  const closeRef = useRef(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement
    const listener = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', listener)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => { document.removeEventListener('keydown', listener); document.body.style.overflow = prevOverflow; prev?.focus?.() }
  }, [open, onClose])
  return <AnimatePresence>
    {open && <motion.div className="modal-root" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:reduce?0:.18}}>
      <motion.div className="modal-backdrop" onClick={onClose} aria-hidden/>
      <motion.div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title"
        initial={reduce ? false : {opacity:0,scale:.95,y:22}}
        animate={{opacity:1,scale:1,y:0}}
        exit={reduce ? {opacity:0} : {opacity:0,scale:.97,y:12}}
        transition={reduce ? {duration:0} : MOTION.softSpring}
      >
        <div className="modal-top"><div className="modal-symbol"><Sparkles size={21}/></div><button ref={closeRef} className="plain-icon" aria-label="Close dialog" onClick={onClose}><X size={19}/></button></div>
        <h2 id="modal-title">A calmer way to see your money.</h2>
        <p>Thoughtful motion helps guide attention, not distract from the numbers. Preview the motion tokens in this interactive component system.</p>
        <div className="modal-actions"><MotionButton variant="secondary" onClick={onClose}>Not now</MotionButton><MotionButton variant="primary" onClick={onConfirm}>Sounds good <ArrowRight size={16}/></MotionButton></div>
      </motion.div>
    </motion.div>}
  </AnimatePresence>
}

function MotionLab({ notify }) {
  const [key, setKey] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [email, setEmail] = useState('')
  const [emailState, setEmailState] = useState('idle')
  const reduce = useReducedMotion()
  const validateEmail = () => {
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    setEmailState(valid ? 'valid' : 'invalid')
    notify(valid ? 'Email looks good' : 'Validation error', valid ? 'Field validation passed' : 'Please enter a valid email address', valid ? 'success' : 'error')
  }
  return <section id="motion-lab" className="section-block">
    <div className="section-heading"><div><span className="eyebrow">04 · INTERACTIONS</span><h2>Motion lab</h2><p>Every interaction has a purpose and a predictable response.</p></div><span className="section-note"><Activity size={14}/> Framer Motion powered</span></div>
    <div className="lab-grid">
      <MotionCard className="lab-card">
        <div className="lab-head"><div><h3>Staggered entrance</h3><p>Elements enter sequentially, then rest.</p></div><IconButton label="Replay entrance" onClick={() => setKey(k => k+1)}><RotateCcw size={16}/></IconButton></div>
        <div className="stagger-stage" key={key}>
          {[0,1,2,3].map((i) => <motion.div key={i} className={`stagger-sample stagger-${i}`}
            initial={reduce ? false : {opacity:0,y:21,scale:.92}}
            animate={{opacity:1,y:0,scale:1}}
            transition={reduce ? {duration:0} : {...MOTION.softSpring,delay:i*.09}}
          ><span className="stagger-line"/></motion.div>)}
        </div>
        <span className="token-small">spring · stagger 90ms</span>
      </MotionCard>
      <MotionCard className="lab-card">
        <div className="lab-head"><div><h3>Expandable details</h3><p>Layout grows without jumping.</p></div></div>
        <motion.div layout className="accordion" transition={reduce?{duration:0}:MOTION.softSpring}>
          <button aria-expanded={expanded} onClick={() => setExpanded(v => !v)} className="accordion-trigger"><span className="accordion-symbol"><Layers2 size={16}/></span><span><b>Shared layout</b><small>Tap to inspect motion behavior</small></span><motion.span animate={{rotate:expanded?180:0}} transition={reduce?{duration:0}:MOTION.softSpring}><ChevronDown size={17}/></motion.span></button>
          <AnimatePresence initial={false}>
            {expanded && <motion.div key="details" initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={reduce?{duration:0}:{duration:.24,ease:MOTION.ease}} className="accordion-content"><p>Use <code>layout</code> for reflow and <code>AnimatePresence</code> for exit transitions. Keep springs short with a high damping value.</p></motion.div>}
          </AnimatePresence>
        </motion.div>
        <span className="token-small">layout · height auto · exit</span>
      </MotionCard>
      <MotionCard className="lab-card">
        <div className="lab-head"><div><h3>Form validation</h3><p>Clear feedback without shifting focus.</p></div></div>
        <label className="field-label" htmlFor="demo-email">Email address</label>
        <div className={`input-shell ${emailState === 'invalid' ? 'input-error' : emailState === 'valid' ? 'input-valid' : ''}`}><Mail size={16}/><input id="demo-email" type="email" value={email} onChange={e => {setEmail(e.target.value);setEmailState('idle')}} placeholder="name@example.com" aria-invalid={emailState==='invalid'} aria-describedby="email-help"/></div>
        <AnimatePresence initial={false} mode="wait">
          {emailState !== 'idle' && <motion.div id="email-help" role={emailState==='invalid'?'alert':'status'} key={emailState} className={`field-feedback ${emailState}`}
            initial={reduce ? false : {opacity:0,y:-5}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:reduce?0:.17}}
          >{emailState === 'valid' ? <CheckCircle2 size={13}/> : <AlertCircle size={13}/>} {emailState === 'valid' ? 'Email address is valid' : 'Enter a valid email address'}</motion.div>}
        </AnimatePresence>
        <MotionButton variant="primary" className="field-button" onClick={validateEmail}>Validate address <ArrowRight size={15}/></MotionButton>
      </MotionCard>
    </div>
  </section>
}

function ComponentGallery({ notify, onModal, onLoading, loading }) {
  return <section id="components" className="section-block">
    <div className="section-heading"><div><span className="eyebrow">03 · FOUNDATIONS</span><h2>Interactive components</h2><p>Touchable, responsive components built around a neutral-first palette.</p></div></div>
    <div className="component-gallery">
      <MotionCard className="component-buttons">
        <div className="component-head"><h3>Buttons & CTA</h3><p>Consistent affordance and press feedback.</p></div>
        <div className="demo-buttons">
          <MotionButton variant="primary" onClick={onModal}>Explore Motion <ArrowUpRight size={16}/></MotionButton>
          <MotionButton variant="accent" onClick={() => notify('Accent action','Promotional CTA activated','success')}>Try Pulse <Sparkles size={15}/></MotionButton>
          <MotionButton variant="secondary" onClick={onLoading} loading={loading}>{loading ? 'Saving…' : 'Try loading'}{!loading && <ArrowRight size={15}/>}</MotionButton>
          <MotionButton variant="ghost" onClick={() => notify('More details','Tertiary action activated','info')}>Learn more <ChevronRight size={15}/></MotionButton>
          <MotionButton variant="secondary" disabled>Disabled</MotionButton>
        </div>
        <div className="component-meta">hover · tap · disabled · loading · focus-visible</div>
      </MotionCard>
      <MotionCard className="component-palette">
        <div className="component-head"><h3>Color tokens</h3><p>Choose a swatch to copy its HEX code.</p></div>
        <div className="swatches">
          {PALETTE.map(item => <motion.button
            key={item.hex}
            className="swatch"
            onClick={() => { navigator.clipboard?.writeText(item.hex).then(() => notify('Color copied',`${item.label} · ${item.hex}`,'success')).catch(() => notify(item.label,item.hex,'info')) ?? notify(item.label,item.hex,'info') }}
            whileHover={{y:-3}}
            whileTap={{scale:.97}}
            transition={MOTION.press}
            aria-label={`Copy ${item.label} color ${item.hex}`}
          ><span className="swatch-box" style={{background:item.hex}}/><span>{item.label}</span><small>{item.hex}</small></motion.button>)}
        </div>
      </MotionCard>
    </div>
  </section>
}

function BottomDock({ active, onNavigate, onAssistant }) {
  return <div className="mobile-dock" aria-label="Mobile actions">
    <IconButton label="Dashboard" onClick={() => onNavigate('overview')} className={active === 'overview' ? 'dock-active':''}><Home size={19}/></IconButton>
    <MotionButton variant="primary" className="dock-ask" onClick={onAssistant}><span className="ask-bubble"><Sparkles size={15}/></span> Ask Pulse</MotionButton>
    <IconButton label="Analytics" onClick={() => onNavigate('analytics')} className={active === 'analytics' ? 'dock-active':''}><ChartNoAxesCombined size={18}/></IconButton>
  </div>
}

function App() {
  const [period, setPeriod] = useState('Month')
  const [active, setActive] = useState('overview')
  const [filter, setFilter] = useState('All')
  const [toasts, setToasts] = useState([])
  const [dialog, setDialog] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef(null)
  const idCounter = useRef(0)
  const timeoutRef = useRef(null)
  const data = PERIOD_DATA[period]
  const reduce = useReducedMotion()
  const dateLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: '2-digit' }).format(new Date()).toUpperCase()

  const dismiss = (id) => setToasts(items => items.filter(t => t.id !== id))
  const notify = (title, detail, type = 'success') => {
    const id = ++idCounter.current
    setToasts(items => [...items.slice(-2), {id,title,detail,type}])
    window.setTimeout(() => dismiss(id), type==='error'?6000:4200)
  }
  const navigate = (target) => {
    setActive(target)
    document.getElementById(target)?.scrollIntoView({behavior:reduce?'instant':'smooth', block:'start'})
  }
  const handleLoading = () => {
    if (loading) return
    setLoading(true)
    timeoutRef.current = window.setTimeout(() => {setLoading(false);notify('Saved successfully','Loading → success state complete')}, 1050)
  }
  useEffect(() => () => {if(timeoutRef.current)window.clearTimeout(timeoutRef.current)}, [])
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus()
  }, [searchOpen])
  useEffect(() => {
    const onShortcut = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(prev => !prev)
      }
      if (event.key === 'Escape') setSearchOpen(false)
    }
    document.addEventListener('keydown', onShortcut)
    return () => document.removeEventListener('keydown', onShortcut)
  }, [])

  return <MotionConfig reducedMotion="user" transition={MOTION.softSpring}>
    <div className="app-shell">
      <Sidebar active={active} onNavigate={navigate} openSearch={() => setSearchOpen(true)} notify={notify}/>
      <main className="main">
        <header className="page-header" id="overview">
          <div className="mobile-brand"><span className="brand-mark"><Sparkles size={13}/></span> pulse<span className="brand-dot">.</span></div>
          <Appear delay={.02} className="hello"><span className="eyebrow">{dateLabel}</span><h1>Good morning, <em>Jordan.</em></h1><p>Here’s your money at a glance. Thoughtfully designed, beautifully in motion.</p></Appear>
          <Appear delay={.05} className="header-actions"><div className="desktop-search"><Search size={16}/><button onClick={()=>setSearchOpen(true)}>Search anything…</button><kbd>⌘ K</kbd></div><IconButton label="Notifications" onClick={()=>notify('All caught up','You have no unread notifications','info')}><Bell size={17}/></IconButton><div className="header-avatar" aria-label="Jordan Doe">JD</div></Appear>
        </header>
        <div className="page-content">
          <section id="analytics" className="dashboard-section">
            <div className="section-title-row"><div><span className="eyebrow">01 · OVERVIEW</span><h2>Financial pulse</h2></div><Segmented name="dashboard" value={period} onChange={setPeriod}/></div>
            <div className="overview-grid">
              <MotionCard className="hero-card" delay={.06}>
                <div className="hero-top"><span className="hero-overline">Payment rhythm</span><span className="hero-icon"><Sparkles size={17}/></span></div>
                <div className="hero-data"><AnimatedAmount value={data.rhythm}/><span>{data.payments} payments</span></div>
                <AnimatePresence mode="wait" initial={false}><motion.div key={period} className="rhythm-wrap" initial={reduce?false:{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={reduce?{opacity:0}:{opacity:0,y:-6}} transition={{duration:reduce?0:.2}}><RhythmChart period={period}/></motion.div></AnimatePresence>
                <div className="hero-chart-bottom"><span>1</span><span>15 <small>payroll</small></span><span>31</span></div>
              </MotionCard>
              <MotionCard className="cash-card" delay={.1}>
                <div className="cash-heading"><div><span className="card-eyebrow">Cash flow</span><h3><AnimatedAmount value={data.net}/></h3></div><span className="cash-status"><span/> Net</span></div>
                <AnimatePresence mode="wait" initial={false}><motion.div key={period} className="cash-body" initial={reduce?false:{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:reduce?0:.2}}><FlowChart period={period}/></motion.div></AnimatePresence>
                <div className="cash-bottom"><span>Apr '26</span><span>Net cashflow</span><span>Oct '26</span></div>
              </MotionCard>
              <div className="metric-pair"><MetricCard type="income" value={data.income} period={period} onClick={()=>notify('Income insight','Detailed breakdown is available in your analytics','info')}/><MetricCard type="expense" value={data.expense} period={period} onClick={()=>notify('Expense insight','Detailed breakdown is available in your analytics','info')}/></div>
              <MotionCard className="promo-card" delay={.14}>
                <div className="promo-sparkle"><Sparkles size={17}/></div><div className="promo-label">Pulse Agent</div><h3>Make sense of every move.</h3><p>Your financial insights, without all the noise.</p><MotionButton variant="light" onClick={()=>setDialog(true)}>Explore insights <ArrowUpRight size={15}/></MotionButton>
              </MotionCard>
            </div>
            <div className="feeds-grid">
              <MotionCard className="feed-card" delay={.14}>
                <div className="feed-header"><div><span className="eyebrow">02 · ACTIVITY</span><h3>Main trends</h3></div><span className="feed-indicator"><span/> Live insights</span></div>
                <div className="filters">{['All','Signal','Risk','Trend'].map(f=><motion.button key={f} className={`filter-chip ${filter===f?'chosen':''}`} aria-pressed={filter===f} onClick={()=>setFilter(f)} whileTap={reduce?undefined:{scale:.95}}>{f}</motion.button>)}</div>
                <TrendList activeFilter={filter}/>
              </MotionCard>
              <MotionCard className="feed-card activity-card" delay={.18}>
                <div className="feed-header"><div><span className="eyebrow">LATEST UPDATES</span><h3>Today's activity</h3></div><MoreHorizontal size={18} color="#A0A0A8"/></div>
                <ActivityList/>
                <MotionButton variant="ghost" className="view-activity" onClick={()=>notify('All activity','This is a demonstration of the activity feed','info')}>View all activity <ArrowUpRight size={14}/></MotionButton>
              </MotionCard>
            </div>
          </section>
          <ComponentGallery notify={notify} onModal={()=>setDialog(true)} onLoading={handleLoading} loading={loading}/>
          <MotionLab notify={notify}/>
          <Appear as="footer" className="page-footer"><div><span className="brand-mark mini"><Sparkles size={12}/></span> Soft Utility / Aurora UI</div><span>Design system v1.1 · React + Framer Motion · Built with intention</span></Appear>
        </div>
      </main>
      <BottomDock active={active} onNavigate={navigate} onAssistant={()=>setDialog(true)}/>
      <ToastRegion toasts={toasts} dismiss={dismiss}/>
      <Modal open={dialog} onClose={()=>setDialog(false)} onConfirm={()=>{setDialog(false);notify('You’re all set','Your motion-enabled experience is ready','success')}}/>
      <AnimatePresence>
        {searchOpen && <motion.div className="search-overlay" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setSearchOpen(false)}>
          <motion.div className="search-dialog" role="dialog" aria-modal="true" aria-label="Quick search" onClick={e=>e.stopPropagation()} initial={reduce?false:{opacity:0,scale:.97,y:-12}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:.98,y:-8}} transition={MOTION.softSpring}>
            <Search size={20}/><input ref={searchRef} placeholder="Search commands, insights, components…" onKeyDown={e=>{if(e.key==='Escape')setSearchOpen(false);if(e.key==='Enter'){setSearchOpen(false);notify('Search',e.currentTarget.value||'Explore more components','info')}}}/><button onClick={()=>setSearchOpen(false)} aria-label="Close search"><X size={17}/></button>
          </motion.div>
        </motion.div>}
      </AnimatePresence>
    </div>
  </MotionConfig>
}

createRoot(document.getElementById('root')).render(<App/>)
