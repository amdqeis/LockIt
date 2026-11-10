"use client";
import { MotionButton } from "@/components/MotionButton";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { staffApi, staffSend } from "@/lib/staff-api";
import { motionTokens, pageVariants } from "@/lib/motion";
import { queryCache, useCachedQuery } from "@/lib/data-cache";
import { getPrefetchProps, scheduleIdlePrefetch } from "@/lib/prefetch";
import { ShellSkeleton, DashboardSkeleton } from "@/components/skeletons";
import type { Teacher } from "./types";
import { Exams } from "./Exams";
import { Banks } from "./Banks";
import { Monitoring } from "./Monitoring";
import { Results } from "./Results";
import { Teachers } from "./Teachers";
import { AcademicManagement } from "./AcademicManagement";
import { BackupRestore } from "./BackupRestore";
import { DashboardTools } from "./DashboardTools";

const menus = [
  { id: "overview", label: "Overview", path: "/dashboard", icon: "overview" },
  { id: "ujian", label: "Ujian", path: "/dashboard/ujian", icon: "exam" },
  { id: "bank-soal", label: "Bank Soal", path: "/dashboard/bank-soal", icon: "folder" },
  { id: "kelas-mapel", label: "Kelas & Mapel", path: "/dashboard/kelas-mapel", icon: "book" },
  { id: "monitoring", label: "Monitoring", path: "/dashboard/monitoring", icon: "monitor" },
  { id: "hasil", label: "Hasil", path: "/dashboard/hasil", icon: "results" },
  { id: "guru", label: "Manajemen Guru", path: "/dashboard/guru", icon: "users" },
  { id: "backup", label: "Backup & Restore", path: "/dashboard/backup", icon: "database" },
];
const MotionLink = motion.create(Link);
export function Icon({ name, size = 19 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    exam: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    folder: <path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>,
    monitor: <><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3M7 11h3l2-3 2 5 2-2h1"/></>,
    results: <><path d="M4 20h16M6 17v-5M12 17V6M18 17V9"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5"/></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>,
    close: <path d="M6 6l12 12M18 6 6 18"/>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-2 7-2 9h16c0-2-2-2-2-9M10 20h4"/></>,
    trash: <><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></>,
    archive: <><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 12h4"/></>,
    pencil: <><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></>,
    book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    display: <><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>,
    phone: <><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></>,
    mortarboard: <><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></>,
    key: <><path d="m21 2-2 2m-1.5 1.5L14 9l-2-2-5 5a4 4 0 1 0 6 6l5-5-2-2 3.5-3.5z"/><circle cx="7.5" cy="16.5" r="1.5"/></>,
    trophy: <><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.45 1-1 1H8v4h8v-4h-1c-.55 0-1-.45-1-1v-2.34M18 4H6v7a6 6 0 0 0 12 0V4z"/></>,
    flag: <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/></>,
    stop: <><rect x="6" y="6" width="12" height="12" rx="2"/></>,
    play: <><polygon points="6 4 20 12 6 20 6 4"/></>,
    check: <><polyline points="20 6 9 17 4 12"/></>,
    chart: <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
    lock: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
    unlock: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></>,
    kick: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></>,
    broadcast: <><path d="M4.93 4.93a10 10 0 0 1 14.14 0M7.76 7.76a6 6 0 0 1 8.48 0M10.6 10.6a2 2 0 0 1 2.8 0"/><circle cx="12" cy="12" r="1"/></>,
    alert: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    help: <><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    sliders: <><line x1="3" y1="6" x2="21" y2="6"/><line x1="16" y1="3" x2="16" y2="9"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="8" y1="9" x2="8" y2="15"/><line x1="3" y1="18" x2="21" y2="18"/><line x1="14" y1="15" x2="14" y2="21"/></>,
    "sliders-horizontal": <><line x1="3" y1="6" x2="21" y2="6"/><line x1="16" y1="3" x2="16" y2="9"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="8" y1="9" x2="8" y2="15"/><line x1="3" y1="18" x2="21" y2="18"/><line x1="14" y1="15" x2="14" y2="21"/></>,
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    database: <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></>,
    external: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
export function ErrorText({ error }: { error: string }) { return error ? <p role="alert" className="staff-error">{error}</p> : null; }
export function message(err: unknown) { return err instanceof Error ? err.message : "Permintaan belum dapat diproses."; }
export function Dashboard() {
  const router = useRouter(); const pathname = usePathname(); const reduce = useReducedMotion();
  const section = pathname.split("/")[2] || "overview";
  const [teacher, setTeacher] = useState<Teacher | null>(null); const [authError, setAuthError] = useState("");
  const navRef = useRef<HTMLElement>(null); const menuRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState(""); const [navOpen, setNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [pull, setPull] = useState({ section: "", progress: 0 });
  const pullProgress = pull.section === section ? pull.progress : 0;
  const visible = menus.filter(m => (m.id !== "guru" && m.id !== "backup") || teacher?.role === "ADMIN");
  const next = visible[visible.findIndex(m => m.id === section) + 1];
  useEffect(() => { let live = true; staffApi<Teacher>("/api/auth/me").then(t => { if (live) setTeacher(t); }).catch(e => { if (!live) return; if (e.status === 401) router.replace("/login"); else setAuthError(message(e)); }); return () => { live = false; }; }, [router]);
  useEffect(() => {
    if (!navOpen) return;
    const nav = navRef.current; const trigger = menuRef.current; const focusable = () => Array.from(nav?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") || []);
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setNavOpen(false); return; }
      if (event.key !== "Tab") return;
      const items = focusable(); if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); trigger?.focus(); };
  }, [navOpen]);
  useEffect(() => {
    if (!teacher || !next || navOpen) return;
    const wheelThreshold = 450; const touchThreshold = 200; const wheelMinimumMs = 650;
    let amount = 0; let last = 0; let first = 0; let startY: number | null = null;
    let resetTimer: number | undefined; let advanceTimer: number | undefined;
    const showProgress = (progress: number) => setPull({ section, progress: Math.max(0, Math.min(1, progress)) });
    const reset = () => { amount = 0; first = 0; showProgress(0); };
    const canAdvance = (target: EventTarget | null) => {
      if (document.querySelector("dialog[open]") || document.activeElement?.matches("input, textarea, select, [contenteditable=true]")) return false;
      const element = target instanceof Element ? target : null;
      if (element?.closest("button, a, input, textarea, select, [contenteditable=true]")) return false;
      for (let node = element; node && node !== document.body; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) return false;
      }
      const root = document.scrollingElement;
      return !!root && root.scrollHeight > window.innerHeight + 10 && root.scrollTop + window.innerHeight >= root.scrollHeight - 200;
    };
    const advance = () => { reset(); router.push(next.path); };
    const wheel = (event: WheelEvent) => {
      if (advanceTimer !== undefined) return;
      if (event.deltaY <= 0 || !canAdvance(event.target)) { window.clearTimeout(resetTimer); reset(); return; }
      const now = Date.now();
      if (now - last > 800) { amount = 0; first = now; }
      amount += Math.min(event.deltaY, 80); last = now;
      const ready = amount >= wheelThreshold && now - first >= wheelMinimumMs;
      showProgress(ready ? 1 : Math.min(.96, amount / wheelThreshold)); window.clearTimeout(resetTimer);
      if (ready) { advanceTimer = window.setTimeout(() => { advanceTimer = undefined; if (canAdvance(event.target)) advance(); else reset(); }, reduce ? 0 : 180); }
      else resetTimer = window.setTimeout(reset, 800);
    };
    const touchStart = (event: TouchEvent) => { window.clearTimeout(resetTimer); startY = canAdvance(event.target) ? event.touches[0]?.clientY ?? null : null; if (startY !== null) showProgress(0); };
    const touchMove = (event: TouchEvent) => { if (startY !== null) showProgress((startY - (event.touches[0]?.clientY ?? startY)) / touchThreshold); };
    const touchEnd = (event: TouchEvent) => { if (startY !== null && startY - (event.changedTouches[0]?.clientY ?? startY) >= touchThreshold && canAdvance(event.target)) advance(); else reset(); startY = null; };
    const touchCancel = () => { startY = null; reset(); };
    window.addEventListener("wheel", wheel, { passive: true }); window.addEventListener("touchstart", touchStart, { passive: true }); window.addEventListener("touchmove", touchMove, { passive: true }); window.addEventListener("touchend", touchEnd, { passive: true }); window.addEventListener("touchcancel", touchCancel, { passive: true });
    return () => { window.clearTimeout(resetTimer); window.clearTimeout(advanceTimer); window.removeEventListener("wheel", wheel); window.removeEventListener("touchstart", touchStart); window.removeEventListener("touchmove", touchMove); window.removeEventListener("touchend", touchEnd); window.removeEventListener("touchcancel", touchCancel); };
  }, [teacher, next, navOpen, router, section, reduce]);
  async function logout() { try { queryCache.clear(); await staffSend("/api/auth/logout", "POST"); router.replace("/login"); } catch (e) { setError(message(e)); } }
  useEffect(() => {
    if (!teacher) return;
    return scheduleIdlePrefetch(["/dashboard/ujian", "/dashboard/bank-soal", "/dashboard/monitoring"], router);
  }, [teacher, router]);
  if (!teacher) return authError ? <main className="staff-loading"><p role="alert">{authError}</p><Link href="/login">Ke halaman masuk</Link></main> : <ShellSkeleton />;
  const current = menus.find(m => m.id === section) ?? menus[0];
  return <div className="staff-app">
    {navOpen && <MotionButton className="staff-backdrop" aria-label="Tutup navigasi" onClick={() => setNavOpen(false)} />}
    <aside ref={navRef} role={navOpen ? "dialog" : undefined} aria-modal={navOpen ? true : undefined} className={`staff-sidebar ${navOpen ? "is-open" : ""}`} aria-label="Navigasi dashboard">
      <div className="staff-brand"><Image src="/eduquas-logo.png" alt="EduQuas" width={126} height={32} /><MotionButton className="staff-mobile-close" aria-label="Tutup navigasi" onClick={() => setNavOpen(false)}><Icon name="close" /></MotionButton></div>
      <LayoutGroup id="dashboard-navigation">{[{ label: "RUANG KERJA", items: visible.filter(item => ["overview", "ujian", "bank-soal", "kelas-mapel"].includes(item.id)) }, { label: "PENGELOLAAN", items: visible.filter(item => ["monitoring", "hasil", "guru", "backup"].includes(item.id)) }].map(group => <div key={group.label}><p className="staff-nav-label">{group.label}</p><nav aria-label={group.label}>{group.items.map(item => <MotionLink key={item.id} href={item.path} onClick={() => setNavOpen(false)} aria-current={section === item.id ? "page" : undefined} className={`staff-nav-link ${section === item.id ? "active" : ""}`} whileHover={reduce ? undefined : { x: 2 }} whileTap={reduce ? undefined : { scale: .98 }} transition={{ duration: reduce ? 0 : .14 }} {...getPrefetchProps(item.path, router)}>{section === item.id && <motion.span className="staff-nav-active" layoutId="dashboard-nav-active" transition={reduce ? { duration: 0 } : motionTokens.navSpring} />}<Icon name={item.icon} /><span>{item.label}</span></MotionLink>)}</nav></div>)}</LayoutGroup>
      <MotionButton className="staff-profile staff-profile-trigger" onClick={() => { setNavOpen(false); setProfileOpen(true); }}><span className="staff-avatar">{teacher.fullName.split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase()}</span><span><strong>{teacher.fullName}</strong><small>{teacher.role === "ADMIN" ? "Administrator" : "Guru"}</small></span><span aria-hidden="true">⌄</span></MotionButton>
    </aside>
    <main className="staff-main"><header className="staff-header"><div><MotionButton ref={menuRef} aria-expanded={navOpen} className="staff-menu" aria-label="Buka navigasi" onClick={() => setNavOpen(true)}><Icon name="menu" /></MotionButton>{section === "overview" && <span className="overview-eyebrow">RUANG KERJA GURU</span>}<h1>{section === "overview" ? <>Selamat datang, <em>{teacher.fullName.split(" ")[0]}.</em></> : current.label}</h1><p>{section === "overview" ? "Pantau ujian dan pekerjaan Anda dalam satu tempat." : "Kelola kegiatan ujian Anda."}</p></div><DashboardTools teacher={teacher} menus={visible} onTeacher={setTeacher} onLogout={() => void logout()} profileOpen={profileOpen} closeProfile={() => setProfileOpen(false)}/></header>
      <motion.div className="staff-content" key={section} initial={reduce ? false : pageVariants.initial} animate={pageVariants.animate} exit={reduce ? undefined : pageVariants.exit} transition={{ duration: reduce ? 0 : motionTokens.duration.normal, ease: motionTokens.ease }}>
        <ErrorText error={error} />{section === "overview" ? <Overview /> : section === "ujian" ? <Exams teacherRole={teacher.role} /> : section === "bank-soal" ? <Banks teacherId={teacher.id} /> : section === "kelas-mapel" ? <AcademicManagement teacherRole={teacher.role} /> : section === "monitoring" ? <Monitoring /> : section === "hasil" ? <Results /> : section === "guru" ? (teacher.role === "ADMIN" ? <Teachers /> : <p>Bagian ini hanya tersedia untuk administrator.</p>) : section === "backup" ? (teacher.role === "ADMIN" ? <BackupRestore /> : <p>Bagian ini hanya tersedia untuk administrator.</p>) : null}{next && <div className="dashboard-next-section"><div className="dashboard-pull-control"><svg className="dashboard-pull-ring" viewBox="0 0 48 48" role="progressbar" aria-label={`Progres menuju ${next.label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pullProgress * 100)}><circle cx="24" cy="24" r="21" className="dashboard-pull-ring-track"/><motion.circle cx="24" cy="24" r="21" className="dashboard-pull-ring-fill" initial={false} animate={{ pathLength: pullProgress }} transition={{ duration: reduce ? 0 : .14, ease: "easeOut" }}/></svg><MotionLink className="dashboard-pull-link" href={next.path} aria-label={`Buka ${next.label}`} whileTap={reduce ? undefined : { scale: .94 }} {...getPrefetchProps(next.path, router)}><motion.span initial={false} animate={{ scale: reduce ? 1 : 1 + pullProgress * .3 }} transition={{ duration: reduce ? 0 : .14 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v15m-6-6 6 6 6-6"/></svg></motion.span></MotionLink></div><span className="dashboard-pull-label">{pullProgress >= 1 ? "Siap berpindah" : pullProgress > 0 ? "Terus tarik untuk berpindah" : "Tarik lagi untuk berpindah"}</span></div>}
      </motion.div>
    </main>
  </div>;
}
type OverviewData = { waiting: number; ungraded: number; activeCount: number; exams: { id: string; title: string; status: string; className: string | null; _count: { questions: number } }[] };
function Overview() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { data: actions, loading, isRefetching, error: summaryError } = useCachedQuery<OverviewData>(
    "/api/dashboard/overview",
    () => staffApi<OverviewData>("/api/dashboard/overview"),
    { ttlMs: 30000 }
  );

  const appear = (delay: number) => ({ initial: reduce ? false as const : { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: reduce ? 0 : .32, delay: reduce ? 0 : delay } });
  const drafts = actions?.exams.filter(exam => exam.status === "draft") || [];

  if (loading && !actions) return <DashboardSkeleton />;

  return <section className="overview-example" aria-labelledby="overview-title">
    {isRefetching && <div className="staff-update-indicator" role="status"><span className="staff-update-dot" /><span>Memperbarui data</span></div>}
    <div className="overview-example-heading"><div><span className="overview-eyebrow">01 · OVERVIEW</span><h2 id="overview-title">Ringkasan ujian</h2></div><div style={{ display: "flex", gap: "10px", alignItems: "center" }}><MotionLink href="/dashboard/ujian" className="overview-heading-link" whileHover={reduce ? undefined : { x: 2 }} whileTap={reduce ? undefined : { scale: 0.98 }} {...getPrefetchProps("/dashboard/ujian", router)}>Semua ujian <Icon name="arrow" size={15}/></MotionLink><MotionLink href="/dashboard/ujian?create=true" className="staff-primary" style={{ height: "36px", padding: "0 16px", textDecoration: "none", fontSize: "11px" }} whileHover={reduce ? undefined : { y: -2, scale: 1.012 }} whileTap={reduce ? undefined : { scale: 0.965 }} transition={{ type: "spring", stiffness: 580, damping: 30 }}><Icon name="plus" size={15}/> Buat ujian</MotionLink></div></div>
    {summaryError && <p className="staff-error" role="alert">Ringkasan belum dapat dimuat: {summaryError}</p>}
    <div className="overview-example-grid">
      <motion.div className="overview-card overview-hero" {...appear(.06)}><div className="overview-hero-top"><span>Ujian berlangsung</span><span className="overview-icon"><Icon name="monitor" size={16}/></span></div><div className="overview-hero-number">{actions?.activeCount ?? "—"}<small>ujian sedang berlangsung</small></div><div className="overview-hero-content"><p>Pantau peserta dan kelola jalannya ujian dari satu tempat.</p><Link href="/dashboard/monitoring" className="overview-light-link" {...getPrefetchProps("/dashboard/monitoring", router)}>Buka monitoring <Icon name="arrow" size={15}/></Link></div></motion.div>
      <motion.div className="overview-card overview-status" {...appear(.1)}><div className="overview-card-head"><div><span className="overview-card-label">Perlu perhatian</span><h3>{actions ? actions.waiting + actions.ungraded : "—"}</h3></div><span className="overview-status-tag">Saat ini</span></div><div className="overview-status-items"><Link href="/dashboard/monitoring" {...getPrefetchProps("/dashboard/monitoring", router)}><span>Permintaan peserta</span><strong>{actions?.waiting ?? "—"}</strong></Link><Link href="/dashboard/hasil" {...getPrefetchProps("/dashboard/hasil", router)}><span>Menunggu penilaian</span><strong>{actions?.ungraded ?? "—"}</strong></Link></div><span className="overview-status-foot">Data terbaru dari dashboard</span></motion.div>
      <div className="overview-metric-pair"><motion.div className="overview-card overview-metric overview-blue" {...appear(.12)}><div className="overview-metric-head"><span><Icon name="users" size={15}/> Permintaan peserta</span><Link href="/dashboard/monitoring" aria-label="Lihat permintaan peserta" {...getPrefetchProps("/dashboard/monitoring", router)}><Icon name="arrow" size={16}/></Link></div><div><strong>{actions?.waiting ?? "—"}</strong><small>menunggu persetujuan</small></div></motion.div><motion.div className="overview-card overview-metric overview-coral" {...appear(.14)}><div className="overview-metric-head"><span><Icon name="results" size={15}/> Penilaian</span><Link href="/dashboard/hasil" aria-label="Lihat jawaban menunggu penilaian" {...getPrefetchProps("/dashboard/hasil", router)}><Icon name="arrow" size={16}/></Link></div><div><strong>{actions?.ungraded ?? "—"}</strong><small>jawaban menunggu penilaian</small></div></motion.div></div>
      <motion.div className="overview-card overview-action" {...appear(.16)}><span>Bank Soal</span><h3>Siapkan soal untuk ujian berikutnya.</h3><p>Kelola bank soal dan mata pelajaran.</p><Link href="/dashboard/bank-soal" className="overview-light-link" {...getPrefetchProps("/dashboard/bank-soal", router)}>Buka bank soal <Icon name="arrow" size={14}/></Link></motion.div>
    </div>
    <div className="overview-feeds"><motion.div className="overview-card overview-feed" {...appear(.18)}><div className="overview-feed-head"><div><span className="overview-eyebrow">02 · UJIAN</span><h3>Ujian yang memerlukan perhatian</h3></div><div style={{ display: "flex", gap: "8px", alignItems: "center" }}><MotionLink href="/dashboard/ujian?create=true" className="staff-primary" style={{ height: "30px", padding: "0 12px", textDecoration: "none", fontSize: "11px" }} whileHover={reduce ? undefined : { y: -2, scale: 1.012 }} whileTap={reduce ? undefined : { scale: 0.965 }} transition={{ type: "spring", stiffness: 580, damping: 30 }}><Icon name="plus" size={14}/> Buat ujian</MotionLink><MotionLink href="/dashboard/ujian" whileHover={reduce ? undefined : { x: 2 }} whileTap={reduce ? undefined : { scale: 0.98 }} {...getPrefetchProps("/dashboard/ujian", router)}>Lihat semua <Icon name="arrow" size={14}/></MotionLink></div></div><div className="overview-feed-subtitle">Ujian aktif dan yang masih dalam persiapan</div>{!actions ? (!summaryError && <DashboardSkeleton />) : actions.exams.length ? <div className="overview-feed-list">{actions.exams.map(exam => <Link className="overview-feed-row" href={`/dashboard/monitoring?exam=${encodeURIComponent(exam.id)}`} key={exam.id}><span className={`overview-feed-icon ${exam.status === "active" ? "is-active" : ""}`}><Icon name="exam" size={14}/></span><span className="overview-feed-details"><strong>{exam.title}</strong><small>{exam.className || "Kelas belum ditentukan"} · {exam._count.questions} soal</small></span><span className="overview-feed-badge">{exam.status === "active" ? "Berlangsung" : "Persiapan"}</span></Link>)}</div> : <p className="overview-feed-empty">Belum ada ujian. <Link href="/dashboard/ujian">Buat ujian pertama</Link></p>}</motion.div>
    <motion.div className="overview-card overview-feed" {...appear(.2)}><div className="overview-feed-head"><div><span className="overview-eyebrow">STATUS UJIAN</span><h3>Aktivitas ujian</h3></div></div><div className="overview-feed-subtitle">Ujian yang tersedia pada ringkasan</div>{actions && <div className="overview-feed-list"><Link href="/dashboard/monitoring" className="overview-feed-row" {...getPrefetchProps("/dashboard/monitoring", router)}><span className="overview-feed-icon is-active"><Icon name="monitor" size={14}/></span><span className="overview-feed-details"><strong>Ujian berlangsung</strong><small>Pantau pelaksanaan dan peserta</small></span><span className="overview-feed-count">{actions.activeCount}</span></Link><Link href="/dashboard/ujian" className="overview-feed-row" {...getPrefetchProps("/dashboard/ujian", router)}><span className="overview-feed-icon"><Icon name="exam" size={14}/></span><span className="overview-feed-details"><strong>Dalam persiapan</strong><small>{drafts.length === 6 ? "Enam ujian terbaru ditampilkan" : `${drafts.length} ujian pada ringkasan`}</small></span><span className="overview-feed-count">{drafts.length}</span></Link><Link href="/dashboard/monitoring" className="overview-feed-row" {...getPrefetchProps("/dashboard/monitoring", router)}><span className="overview-feed-icon is-active"><Icon name="users" size={14}/></span><span className="overview-feed-details"><strong>Permintaan menunggu</strong><small>Tinjau antrean peserta</small></span><span className="overview-feed-count">{actions.waiting}</span></Link></div>}<Link className="overview-feed-more" href="/dashboard/monitoring" {...getPrefetchProps("/dashboard/monitoring", router)}>Buka monitoring <Icon name="arrow" size={14}/></Link></motion.div></div>
  </section>;
}
