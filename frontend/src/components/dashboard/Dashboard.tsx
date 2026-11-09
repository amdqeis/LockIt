"use client";
import { MotionButton } from "@/components/MotionButton";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { staffApi, staffSend } from "@/lib/staff-api";
import type { Teacher } from "./types";
import { Exams } from "./Exams";
import { Banks } from "./Banks";
import { Monitoring } from "./Monitoring";
import { Results } from "./Results";
import { Teachers } from "./Teachers";
import { DashboardTools } from "./DashboardTools";

const menus = [
  { id: "overview", label: "Overview", path: "/dashboard", icon: "overview" },
  { id: "ujian", label: "Ujian", path: "/dashboard/ujian", icon: "exam" },
  { id: "bank-soal", label: "Bank Soal", path: "/dashboard/bank-soal", icon: "folder" },
  { id: "monitoring", label: "Monitoring", path: "/dashboard/monitoring", icon: "monitor" },
  { id: "hasil", label: "Hasil", path: "/dashboard/hasil", icon: "results" },
  { id: "guru", label: "Manajemen Guru", path: "/dashboard/guru", icon: "users" },
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
  const visible = menus.filter(m => m.id !== "guru" || teacher?.role === "ADMIN");
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
      return !!root && root.scrollHeight > window.innerHeight + 10 && root.scrollTop + window.innerHeight >= root.scrollHeight - 2;
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
  async function logout() { try { await staffSend("/api/auth/logout", "POST"); router.replace("/login"); } catch (e) { setError(message(e)); } }
  if (!teacher) return <main className="staff-loading">{authError ? <><p role="alert">{authError}</p><Link href="/login">Ke halaman masuk</Link></> : "Memuat dashboard…"}</main>;
  const current = menus.find(m => m.id === section) ?? menus[0];
  return <div className="staff-app">
    {navOpen && <MotionButton className="staff-backdrop" aria-label="Tutup navigasi" onClick={() => setNavOpen(false)} />}
    <aside ref={navRef} role={navOpen ? "dialog" : undefined} aria-modal={navOpen ? true : undefined} className={`staff-sidebar ${navOpen ? "is-open" : ""}`} aria-label="Navigasi dashboard">
      <div className="staff-brand"><Image src="/eduquas-logo.png" alt="EduQuas" width={126} height={32} /><MotionButton className="staff-mobile-close" aria-label="Tutup navigasi" onClick={() => setNavOpen(false)}><Icon name="close" /></MotionButton></div>
      <LayoutGroup id="dashboard-navigation">{[{ label: "RUANG KERJA", items: visible.filter(item => ["overview", "ujian", "bank-soal"].includes(item.id)) }, { label: "PENGELOLAAN", items: visible.filter(item => ["monitoring", "hasil", "guru"].includes(item.id)) }].map(group => <div key={group.label}><p className="staff-nav-label">{group.label}</p><nav aria-label={group.label}>{group.items.map(item => <MotionLink key={item.id} href={item.path} onClick={() => setNavOpen(false)} aria-current={section === item.id ? "page" : undefined} className={`staff-nav-link ${section === item.id ? "active" : ""}`} whileHover={reduce ? undefined : { x: 2 }} whileTap={reduce ? undefined : { scale: .98 }} transition={{ duration: reduce ? 0 : .14 }}>{section === item.id && <motion.span className="staff-nav-active" layoutId="dashboard-nav-active" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 270, damping: 31, mass: .95 }} />}<Icon name={item.icon} /><span>{item.label}</span></MotionLink>)}</nav></div>)}</LayoutGroup>
      <MotionButton className="staff-profile staff-profile-trigger" onClick={() => { setNavOpen(false); setProfileOpen(true); }}><span className="staff-avatar">{teacher.fullName.split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase()}</span><span><strong>{teacher.fullName}</strong><small>{teacher.role === "ADMIN" ? "Administrator" : "Guru"}</small></span><span aria-hidden="true">⌄</span></MotionButton>
    </aside>
    <main className="staff-main"><header className="staff-header"><div><MotionButton ref={menuRef} aria-expanded={navOpen} className="staff-menu" aria-label="Buka navigasi" onClick={() => setNavOpen(true)}><Icon name="menu" /></MotionButton>{section === "overview" && <span className="overview-eyebrow">RUANG KERJA GURU</span>}<h1>{section === "overview" ? <>Selamat datang, <em>{teacher.fullName.split(" ")[0]}.</em></> : current.label}</h1><p>{section === "overview" ? "Pantau ujian dan pekerjaan Anda dalam satu tempat." : "Kelola kegiatan ujian Anda."}</p></div><DashboardTools teacher={teacher} menus={visible} onTeacher={setTeacher} onLogout={() => void logout()} profileOpen={profileOpen} closeProfile={() => setProfileOpen(false)}/></header>
      <motion.div className="staff-content" key={section} initial={reduce ? false : { opacity: .6, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : .32 }}>
        <ErrorText error={error} />{section === "overview" ? <Overview /> : section === "ujian" ? <Exams teacherRole={teacher.role} /> : section === "bank-soal" ? <Banks teacherId={teacher.id} /> : section === "monitoring" ? <Monitoring /> : section === "hasil" ? <Results /> : teacher.role === "ADMIN" ? <Teachers /> : <p>Bagian ini hanya tersedia untuk administrator.</p>}{next && <div className="dashboard-next-section"><div className="dashboard-pull-control"><svg className="dashboard-pull-ring" viewBox="0 0 48 48" role="progressbar" aria-label={`Progres menuju ${next.label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pullProgress * 100)}><circle cx="24" cy="24" r="21" className="dashboard-pull-ring-track"/><motion.circle cx="24" cy="24" r="21" className="dashboard-pull-ring-fill" initial={false} animate={{ pathLength: pullProgress }} transition={{ duration: reduce ? 0 : .14, ease: "easeOut" }}/></svg><MotionLink className="dashboard-pull-link" href={next.path} aria-label={`Buka ${next.label}`} whileTap={reduce ? undefined : { scale: .94 }}><motion.span initial={false} animate={{ scale: reduce ? 1 : 1 + pullProgress * .3 }} transition={{ duration: reduce ? 0 : .14 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v15m-6-6 6 6 6-6"/></svg></motion.span></MotionLink></div><span className="dashboard-pull-label">{pullProgress >= 1 ? "Siap berpindah" : pullProgress > 0 ? "Terus tarik untuk berpindah" : "Tarik lagi untuk berpindah"}</span></div>}
      </motion.div>
    </main>
  </div>;
}
type OverviewData = { waiting: number; ungraded: number; activeCount: number; exams: { id: string; title: string; status: string; className: string | null; _count: { questions: number } }[] };
function Overview() {
  const [actions, setActions] = useState<OverviewData | null>(null);
  const [summaryError, setSummaryError] = useState("");
  const reduce = useReducedMotion();
  useEffect(() => { let live = true; staffApi<OverviewData>("/api/dashboard/overview").then(value => { if (live) setActions(value); }).catch(e => { if (live) setSummaryError(message(e)); }); return () => { live = false; }; }, []);
  const appear = (delay: number) => ({ initial: reduce ? false as const : { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: reduce ? 0 : .32, delay: reduce ? 0 : delay } });
  const drafts = actions?.exams.filter(exam => exam.status === "draft") || [];
  return <section className="overview-example" aria-labelledby="overview-title">
    <div className="overview-example-heading"><div><span className="overview-eyebrow">01 · OVERVIEW</span><h2 id="overview-title">Ringkasan ujian</h2></div><Link href="/dashboard/ujian" className="overview-heading-link">Semua ujian <Icon name="arrow" size={15}/></Link></div>
    {summaryError && <p className="staff-error" role="alert">Ringkasan belum dapat dimuat: {summaryError}</p>}
    <div className="overview-example-grid">
      <motion.div className="overview-card overview-hero" {...appear(.06)}><div className="overview-hero-top"><span>Ujian berlangsung</span><span className="overview-icon"><Icon name="monitor" size={16}/></span></div><div className="overview-hero-number">{actions?.activeCount ?? "—"}<small>ujian sedang berlangsung</small></div><div className="overview-hero-content"><p>Pantau peserta dan kelola jalannya ujian dari satu tempat.</p><Link href="/dashboard/monitoring" className="overview-light-link">Buka monitoring <Icon name="arrow" size={15}/></Link></div></motion.div>
      <motion.div className="overview-card overview-status" {...appear(.1)}><div className="overview-card-head"><div><span className="overview-card-label">Perlu perhatian</span><h3>{actions ? actions.waiting + actions.ungraded : "—"}</h3></div><span className="overview-status-tag">Saat ini</span></div><div className="overview-status-items"><Link href="/dashboard/monitoring"><span>Permintaan peserta</span><strong>{actions?.waiting ?? "—"}</strong></Link><Link href="/dashboard/hasil"><span>Menunggu penilaian</span><strong>{actions?.ungraded ?? "—"}</strong></Link></div><span className="overview-status-foot">Data terbaru dari dashboard</span></motion.div>
      <div className="overview-metric-pair"><motion.div className="overview-card overview-metric overview-blue" {...appear(.12)}><div className="overview-metric-head"><span><Icon name="users" size={15}/> Permintaan peserta</span><Link href="/dashboard/monitoring" aria-label="Lihat permintaan peserta"><Icon name="arrow" size={16}/></Link></div><div><strong>{actions?.waiting ?? "—"}</strong><small>menunggu persetujuan</small></div></motion.div><motion.div className="overview-card overview-metric overview-coral" {...appear(.14)}><div className="overview-metric-head"><span><Icon name="results" size={15}/> Penilaian</span><Link href="/dashboard/hasil" aria-label="Lihat jawaban menunggu penilaian"><Icon name="arrow" size={16}/></Link></div><div><strong>{actions?.ungraded ?? "—"}</strong><small>jawaban menunggu penilaian</small></div></motion.div></div>
      <motion.div className="overview-card overview-action" {...appear(.16)}><span>Bank Soal</span><h3>Siapkan soal untuk ujian berikutnya.</h3><p>Kelola bank soal dan mata pelajaran.</p><Link href="/dashboard/bank-soal" className="overview-light-link">Buka bank soal <Icon name="arrow" size={14}/></Link></motion.div>
    </div>
    <div className="overview-feeds"><motion.div className="overview-card overview-feed" {...appear(.18)}><div className="overview-feed-head"><div><span className="overview-eyebrow">02 · UJIAN</span><h3>Ujian yang memerlukan perhatian</h3></div><Link href="/dashboard/ujian">Lihat semua <Icon name="arrow" size={14}/></Link></div><div className="overview-feed-subtitle">Ujian aktif dan yang masih dalam persiapan</div>{!actions ? !summaryError && <p role="status">Memuat ringkasan ujian…</p> : actions.exams.length ? <div className="overview-feed-list">{actions.exams.map(exam => <Link className="overview-feed-row" href={`/dashboard/monitoring?exam=${encodeURIComponent(exam.id)}`} key={exam.id}><span className={`overview-feed-icon ${exam.status === "active" ? "is-active" : ""}`}><Icon name="exam" size={14}/></span><span className="overview-feed-details"><strong>{exam.title}</strong><small>{exam.className || "Kelas belum ditentukan"} · {exam._count.questions} soal</small></span><span className="overview-feed-badge">{exam.status === "active" ? "Berlangsung" : "Persiapan"}</span></Link>)}</div> : <p className="overview-feed-empty">Belum ada ujian. <Link href="/dashboard/ujian">Buat ujian pertama</Link></p>}</motion.div>
    <motion.div className="overview-card overview-feed" {...appear(.2)}><div className="overview-feed-head"><div><span className="overview-eyebrow">STATUS UJIAN</span><h3>Aktivitas ujian</h3></div></div><div className="overview-feed-subtitle">Ujian yang tersedia pada ringkasan</div>{actions && <div className="overview-feed-list"><Link href="/dashboard/monitoring" className="overview-feed-row"><span className="overview-feed-icon is-active"><Icon name="monitor" size={14}/></span><span className="overview-feed-details"><strong>Ujian berlangsung</strong><small>Pantau pelaksanaan dan peserta</small></span><span className="overview-feed-count">{actions.activeCount}</span></Link><Link href="/dashboard/ujian" className="overview-feed-row"><span className="overview-feed-icon"><Icon name="exam" size={14}/></span><span className="overview-feed-details"><strong>Dalam persiapan</strong><small>{drafts.length === 6 ? "Enam ujian terbaru ditampilkan" : `${drafts.length} ujian pada ringkasan`}</small></span><span className="overview-feed-count">{drafts.length}</span></Link><Link href="/dashboard/monitoring" className="overview-feed-row"><span className="overview-feed-icon is-active"><Icon name="users" size={14}/></span><span className="overview-feed-details"><strong>Permintaan menunggu</strong><small>Tinjau antrean peserta</small></span><span className="overview-feed-count">{actions.waiting}</span></Link></div>}<Link className="overview-feed-more" href="/dashboard/monitoring">Buka monitoring <Icon name="arrow" size={14}/></Link></motion.div></div>
  </section>;
}
