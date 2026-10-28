"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useTeacherAuth } from "@/contexts/AuthContext";

interface Props {
  children: React.ReactNode;
}

// Unified Design Tokens (Spec §7)
const T = {
  bgPage: "#F6F8FB",
  bgCard: "#FFFFFF",
  bgSubtle: "#F0F3F8",
  border: "#E1E6ED",
  textPrimary: "#172033",
  textSecondary: "#5B6778",
  primary: "#1B76BF",
  primaryHover: "#155E99",
  primaryTint: "#E6F1FA",
  success: "#177A4B",
  danger: "#C73E3E",
  dangerBg: "#FCE9E9",
  radiusCard: "8px",
  radiusControl: "8px",
  sidebarWidth: 248,
};

function DashboardShellInner({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { teacher, logout } = useTeacherAuth();
  const filterParam = searchParams ? searchParams.get("filter") : null;
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const teacherName = teacher?.fullName || "Guru / Pengawas";
  const teacherEmail = teacher?.email || "guru@lockit.id";
  const teacherInitials = teacher?.fullName
    ? teacher.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "GP";

  // Exact route matching: each route owns exactly ONE nav item (Spec §2 #6, §4.1)
  const isResults = pathname === "/dashboard/results" || pathname.includes("/results");
  const isMonitor = pathname === "/dashboard/monitor" || pathname.includes("/monitor") || pathname.includes("/live-feed");
  const isQuestionBank = pathname.startsWith("/dashboard/question-bank");
  const isExamRoute = (pathname === "/dashboard/exams" || pathname.startsWith("/dashboard/exams/")) && !isMonitor && !isResults;
  const isDashboard = pathname === "/dashboard" && !filterParam && !isResults;

  const activeCount = 1;

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: T.bgPage,
        fontFamily: "var(--font-family, 'Poppins', sans-serif)",
      }}
    >
      <style>{`
        .sidebar-nav-link {
          display: flex;
          align-items: center;
          height: 40px;
          margin: 2px 8px;
          padding: 0 12px;
          border-radius: ${T.radiusControl};
          text-decoration: none;
          color: ${T.textSecondary};
          font-size: 14px;
          font-weight: 500;
          transition: background-color 150ms ease, color 150ms ease;
          outline: none;
        }
        .sidebar-nav-link:hover {
          background-color: ${T.bgSubtle};
          color: ${T.textPrimary};
        }
        .sidebar-nav-link:focus-visible {
          outline: 2px solid ${T.primary};
          outline-offset: 2px;
        }
        .sidebar-nav-link.active {
          background-color: ${T.primaryTint};
          color: ${T.primary};
          font-weight: 600;
        }
        .sidebar-nav-link.active svg {
          stroke: ${T.primary};
        }
        .user-chip-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 8px;
          background: transparent;
          border: none;
          border-radius: ${T.radiusControl};
          cursor: pointer;
          text-align: left;
          transition: background-color 150ms ease;
          outline: none;
        }
        .user-chip-btn:hover {
          background-color: ${T.bgSubtle};
        }
        .user-chip-btn:focus-visible {
          outline: 2px solid ${T.primary};
          outline-offset: 2px;
        }
        .user-menu-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          font-size: 13px;
          color: ${T.textPrimary};
          text-decoration: none;
          border-radius: 6px;
          transition: background-color 120ms ease;
          outline: none;
          border: none;
          width: 100%;
          background: transparent;
          cursor: pointer;
          text-align: left;
        }
        .user-menu-item:hover {
          background-color: ${T.bgSubtle};
        }
        .user-menu-item:focus-visible {
          outline: 2px solid ${T.primary};
          outline-offset: 1px;
        }
        .user-menu-item.danger {
          color: ${T.danger};
        }
        .user-menu-item.danger:hover {
          background-color: ${T.dangerBg};
        }
      `}</style>

      {/* ====== SIDEBAR (248 px, white, 1px right border, full height fixed) ====== */}
      <aside
        style={{
          width: `${T.sidebarWidth}px`,
          background: T.bgCard,
          borderRight: `1px solid ${T.border}`,
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
        }}
      >
        {/* Brand Header (Height: 72px per spec §4.1) */}
        <div
          style={{
            height: "72px",
            padding: "0 20px",
            display: "flex",
            alignItems: "center",
            borderBottom: `1px solid ${T.border}`,
            flexShrink: 0,
          }}
        >
          <Link
            href="/dashboard"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              textDecoration: "none",
              outline: "none",
            }}
            aria-label="LockIt Dashboard"
          >
            {/* 32px rounded square in --primary with white line lock mark (SVG, not emoji) */}
            <div
              style={{
                width: "32px",
                height: "32px",
                background: T.primary,
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 600,
                  color: T.textPrimary,
                  letterSpacing: "-0.01em",
                  lineHeight: "20px",
                }}
              >
                LockIt
              </div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 400,
                  color: T.textSecondary,
                  lineHeight: "16px",
                }}
              >
                Proctoring platform
              </div>
            </div>
          </Link>
        </div>

        {/* Navigation list */}
        <nav
          aria-label="Menu utama"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            paddingTop: "12px",
            paddingBottom: "12px",
            overflowY: "auto",
          }}
        >
          {/* GROUP: Utama */}
          <div
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: T.textSecondary,
              padding: "8px 20px 4px",
              lineHeight: "18px",
            }}
          >
            Utama
          </div>

          {/* 1. Dashboard */}
          <Link
            href="/dashboard"
            className={`sidebar-nav-link ${isDashboard ? "active" : ""}`}
            aria-current={isDashboard ? "page" : undefined}
          >
            <span style={{ width: "18px", height: "18px", marginRight: "12px", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
              </svg>
            </span>
            <span style={{ flex: 1 }}>Dashboard</span>
          </Link>

          {/* 2. Ujian (single item, no accordion per spec §4.1) */}
          <Link
            href="/dashboard/exams"
            className={`sidebar-nav-link ${isExamRoute ? "active" : ""}`}
            aria-current={isExamRoute ? "page" : undefined}
          >
            <span style={{ width: "18px", height: "18px", marginRight: "12px", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                <path d="M9 12h6" />
                <path d="M9 16h6" />
              </svg>
            </span>
            <span style={{ flex: 1 }}>Ujian</span>
          </Link>

          {/* GROUP: Konten */}
          <div
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: T.textSecondary,
              padding: "16px 20px 4px",
              lineHeight: "18px",
            }}
          >
            Konten
          </div>

          {/* 3. Bank soal */}
          <Link
            href="/dashboard/question-bank"
            className={`sidebar-nav-link ${isQuestionBank ? "active" : ""}`}
            aria-current={isQuestionBank ? "page" : undefined}
          >
            <span style={{ width: "18px", height: "18px", marginRight: "12px", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <line x1="9" y1="7" x2="15" y2="7" />
                <line x1="9" y1="11" x2="13" y2="11" />
              </svg>
            </span>
            <span style={{ flex: 1 }}>Bank soal</span>
          </Link>

          {/* GROUP: Pengawasan & hasil */}
          <div
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: T.textSecondary,
              padding: "16px 20px 4px",
              lineHeight: "18px",
            }}
          >
            Pengawasan & hasil
          </div>

          {/* 4. Monitoring live */}
          <Link
            href="/dashboard/monitor"
            className={`sidebar-nav-link ${isMonitor ? "active" : ""}`}
            aria-current={isMonitor ? "page" : undefined}
          >
            <span style={{ width: "18px", height: "18px", marginRight: "12px", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </span>
            <span style={{ flex: 1, whiteSpace: "nowrap" }}>Monitoring live</span>

            {/* Badge: dot + count only, right-aligned, hidden at 0 per spec §4.1 */}
            {activeCount > 0 && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  marginLeft: "auto",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  background: isMonitor ? "rgba(27,118,191,0.12)" : T.bgSubtle,
                  flexShrink: 0,
                }}
                aria-label={`${activeCount} ujian aktif`}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: T.success,
                    display: "inline-block",
                  }}
                />
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: isMonitor ? T.primary : T.textSecondary,
                    lineHeight: 1,
                  }}
                >
                  {activeCount}
                </span>
              </span>
            )}
          </Link>

          {/* 5. Rekap hasil */}
          <Link
            href="/dashboard/results"
            className={`sidebar-nav-link ${isResults ? "active" : ""}`}
            aria-current={isResults ? "page" : undefined}
          >
            <span style={{ width: "18px", height: "18px", marginRight: "12px", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </span>
            <span style={{ flex: 1 }}>Rekap hasil</span>
          </Link>
        </nav>

        {/* User Chip at bottom (Spec §4.1) */}
        <div
          style={{
            padding: "12px",
            borderTop: `1px solid ${T.border}`,
            background: T.bgCard,
            position: "relative",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="user-chip-btn"
            onClick={() => setUserMenuOpen((s) => !s)}
            aria-expanded={userMenuOpen}
            aria-haspopup="true"
            aria-label={`Menu pengguna ${teacherName}`}
          >
            {/* 32px avatar */}
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: T.primary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                fontWeight: 600,
                fontSize: "13px",
                flexShrink: 0,
              }}
            >
              {teacherInitials}
            </div>

            {/* Name & email with ellipsis + title attribute */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                title={teacherName}
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: T.textPrimary,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  lineHeight: "18px",
                }}
              >
                {teacherName}
              </div>
              <div
                title={teacherEmail}
                style={{
                  fontSize: "12px",
                  color: T.textSecondary,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  lineHeight: "16px",
                }}
              >
                {teacherEmail}
              </div>
            </div>

            {/* Chevron icon */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={T.textSecondary}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transition: "transform 150ms ease",
                transform: userMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* User Popover Menu */}
          {userMenuOpen && (
            <div
              role="menu"
              style={{
                position: "absolute",
                bottom: "calc(100% + 8px)",
                left: "12px",
                right: "12px",
                background: T.bgCard,
                border: `1px solid ${T.border}`,
                borderRadius: T.radiusCard,
                boxShadow: "0 4px 16px rgba(20,24,40,0.12)",
                padding: "6px",
                zIndex: 200,
              }}
            >
              <div style={{ padding: "8px 12px 6px", borderBottom: `1px solid ${T.border}`, marginBottom: "4px" }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: T.textPrimary }}>{teacherName}</div>
                <div style={{ fontSize: "11px", color: T.textSecondary }}>Dosen Pengampu</div>
              </div>

              <button
                type="button"
                className="user-menu-item"
                role="menuitem"
                onClick={() => setUserMenuOpen(false)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Profil
              </button>

              <button
                type="button"
                className="user-menu-item"
                role="menuitem"
                onClick={() => setUserMenuOpen(false)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Pengaturan
              </button>

              <button
                type="button"
                className="user-menu-item danger"
                role="menuitem"
                onClick={async () => {
                  setUserMenuOpen(false);
                  await logout();
                  router.push("/login");
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Keluar
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ====== MAIN CONTENT ====== */}
      <main
        style={{
          marginLeft: `${T.sidebarWidth}px`,
          flex: 1,
          minWidth: 0,
          background: T.bgPage,
          minHeight: "100vh",
        }}
      >
        {children}
      </main>
    </div>
  );
}

export default function DashboardShell({ children }: Props) {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: T.bgPage }}>{children}</div>}>
      <DashboardShellInner>{children}</DashboardShellInner>
    </Suspense>
  );
}
