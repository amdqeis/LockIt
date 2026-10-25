"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { mockTeacher } from "@/lib/mockData";

interface Props {
  children: React.ReactNode;
}

// Primary color token: Sky Blue #29ABE2 (sesuai globals.css design token)
const COLOR_PRIMARY = "#29ABE2";
const COLOR_PRIMARY_DARK = "#0EA5E9";
const COLOR_PRIMARY_BG = "#E0F4FD";
const COLOR_PRIMARY_TEXT = "#0369A1";
const SIDEBAR_W = 240;

export default function DashboardShell({ children }: Props) {
  const pathname = usePathname();
  const [examOpen, setExamOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const isActive = (href: string) => pathname === href;
  const isExamActive = pathname.startsWith("/dashboard/exams");
  const isMonitorActive = pathname.includes("/monitor");
  const isResultsActive = pathname.includes("/results");

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#EDF6FC", fontFamily: "var(--font-family)" }}>
      {/* ====== SIDEBAR ====== */}
      <aside
        style={{
          width: `${SIDEBAR_W}px`,
          background: "#FFFFFF",
          borderRight: "1px solid #E2E8F0",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {/* Brand Header */}
        <div style={{ padding: "18px 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                background: `linear-gradient(135deg, ${COLOR_PRIMARY}, ${COLOR_PRIMARY_DARK})`,
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                boxShadow: `0 2px 6px rgba(41, 171, 226, 0.22), 0 1px 2px rgba(41, 171, 226, 0.14)`,
                color: "#FFFFFF",
              }}
            >
              🔒
            </div>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em" }}>LockIt</div>
              <div style={{ fontSize: "11px", fontWeight: 500, color: "#64748B" }}>Proctoring Platform</div>
            </div>
          </Link>
        </div>

        {/* Search Bar */}
        <div style={{ padding: "0 16px 14px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "7px 10px",
              border: "1px solid #E2E8F0",
              borderRadius: "6px",
              background: "#F8FAFC",
              color: "#64748B",
              boxShadow: "0 1px 3px rgba(15,30,40,0.07), 0 1px 2px rgba(15,30,40,0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Cari ujian..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: "13px",
                  color: "#0F172A",
                  width: "100%",
                  fontFamily: "inherit",
                }}
              />
            </div>
            <kbd
              style={{
                fontSize: "11px",
                color: "#64748B",
                background: "#FFFFFF",
                padding: "2px 5px",
                borderRadius: "4px",
                border: "1px solid #E2E8F0",
                fontWeight: 600,
                fontFamily: "inherit",
                lineHeight: 1,
              }}
            >
              ⌘
            </kbd>
          </div>
        </div>

        {/* Nav Items Container */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {/* SECTION HEADER: MAIN */}
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", padding: "6px 20px 6px" }}>
            MAIN
          </div>

          {/* 1. Dashboard */}
          {(() => {
            const active = isActive("/dashboard") && !isExamActive;
            return (
              <Link
                href="/dashboard"
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  height: "46px",
                  padding: "0 20px",
                  position: "relative",
                  background: active ? COLOR_PRIMARY_BG : "transparent",
                  color: active ? COLOR_PRIMARY_TEXT : "#475569",
                  textDecoration: "none",
                  transition: "background 0.15s ease, color 0.15s ease",
                }}
              >
                {active && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0, top: 0, bottom: 0,
                      width: "4px",
                      background: COLOR_PRIMARY,
                    }}
                  />
                )}
                <div
                  style={{
                    width: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: "12px",
                    color: active ? COLOR_PRIMARY : "#94A3B8",
                    flexShrink: 0,
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
                    <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
                    <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
                    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
                  </svg>
                </div>
                <span style={{ fontSize: "14px", fontWeight: active ? 600 : 500, letterSpacing: "-0.01em" }}>
                  Dashboard
                </span>
              </Link>
            );
          })()}

          {/* 2. Ujian (Collapsible) */}
          <div>
            {(() => {
              const active = isExamActive;
              return (
                <button
                  onClick={() => setExamOpen((prev) => !prev)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    height: "46px",
                    padding: "0 20px",
                    position: "relative",
                    background: active ? COLOR_PRIMARY_BG : "transparent",
                    color: active ? COLOR_PRIMARY_TEXT : "#475569",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.15s ease, color 0.15s ease",
                  }}
                >
                  {active && (
                    <div
                      style={{
                        position: "absolute",
                        left: 0, top: 0, bottom: 0,
                        width: "4px",
                        background: COLOR_PRIMARY,
                      }}
                    />
                  )}
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <div
                      style={{
                        width: "24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: "12px",
                        color: active ? COLOR_PRIMARY : "#94A3B8",
                        flexShrink: 0,
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
                      </svg>
                    </div>
                    <span style={{ fontSize: "14px", fontWeight: active ? 600 : 500, letterSpacing: "-0.01em" }}>
                      Ujian
                    </span>
                  </div>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={active ? COLOR_PRIMARY : "#94A3B8"}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transition: "transform 0.2s ease",
                      transform: examOpen ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              );
            })()}

            {/* Sub-items Ujian */}
            {examOpen && (
              <div style={{ background: "#F8FAFC", borderTop: "1px solid #F1F5F9", borderBottom: "1px solid #F1F5F9" }}>
                <Link
                  href="/dashboard"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    height: "38px",
                    padding: "0 20px 0 46px",
                    position: "relative",
                    background: isActive("/dashboard") && !isExamActive ? COLOR_PRIMARY_BG : "transparent",
                    color: isActive("/dashboard") && !isExamActive ? COLOR_PRIMARY_TEXT : "#64748B",
                    fontSize: "13px",
                    fontWeight: isActive("/dashboard") && !isExamActive ? 600 : 500,
                    textDecoration: "none",
                  }}
                >
                  {isActive("/dashboard") && !isExamActive && (
                    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "4px", background: COLOR_PRIMARY }} />
                  )}
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: isActive("/dashboard") && !isExamActive ? COLOR_PRIMARY : "#CBD5E1",
                      marginRight: "10px",
                    }}
                  />
                  <span>Semua Ujian</span>
                </Link>

                <Link
                  href="/dashboard/exams/new"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    height: "38px",
                    padding: "0 20px 0 46px",
                    position: "relative",
                    background: isActive("/dashboard/exams/new") ? COLOR_PRIMARY_BG : "transparent",
                    color: isActive("/dashboard/exams/new") ? COLOR_PRIMARY_TEXT : "#64748B",
                    fontSize: "13px",
                    fontWeight: isActive("/dashboard/exams/new") ? 600 : 500,
                    textDecoration: "none",
                  }}
                >
                  {isActive("/dashboard/exams/new") && (
                    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "4px", background: COLOR_PRIMARY }} />
                  )}
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: isActive("/dashboard/exams/new") ? COLOR_PRIMARY : "#CBD5E1",
                      marginRight: "10px",
                    }}
                  />
                  <span>+ Buat Ujian</span>
                </Link>
              </div>
            )}
          </div>

          {/* SECTION HEADER: PENGAWASAN & HASIL */}
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", padding: "16px 20px 6px" }}>
            PENGAWASAN & HASIL
          </div>

          {/* 3. Monitoring Live — mengarah ke daftar ujian aktif */}
          {(() => {
            const active = isMonitorActive;
            return (
              <Link
                href="/dashboard?filter=active"
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  height: "46px",
                  padding: "0 20px",
                  position: "relative",
                  background: active ? COLOR_PRIMARY_BG : "transparent",
                  color: active ? COLOR_PRIMARY_TEXT : "#475569",
                  textDecoration: "none",
                  transition: "background 0.15s ease, color 0.15s ease",
                }}
              >
                {active && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0, top: 0, bottom: 0,
                      width: "4px",
                      background: COLOR_PRIMARY,
                    }}
                  />
                )}
                <div
                  style={{
                    width: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: "12px",
                    color: active ? COLOR_PRIMARY : "#94A3B8",
                    flexShrink: 0,
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>
                <span style={{ fontSize: "14px", fontWeight: active ? 600 : 500, letterSpacing: "-0.01em" }}>
                  Monitoring Live
                </span>
                {/* Badge "Buka ujian aktif" hint */}
                <span style={{
                  marginLeft: "auto",
                  fontSize: "10px",
                  color: "#94A3B8",
                  background: "#F1F5F9",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  whiteSpace: "nowrap",
                }}>
                  Ujian aktif
                </span>
              </Link>
            );
          })()}

          {/* 4. Rekap Hasil — mengarah ke daftar ujian selesai */}
          {(() => {
            const active = isResultsActive;
            return (
              <Link
                href="/dashboard?filter=ended"
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  height: "46px",
                  padding: "0 20px",
                  position: "relative",
                  background: active ? COLOR_PRIMARY_BG : "transparent",
                  color: active ? COLOR_PRIMARY_TEXT : "#475569",
                  textDecoration: "none",
                  transition: "background 0.15s ease, color 0.15s ease",
                }}
              >
                {active && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0, top: 0, bottom: 0,
                      width: "4px",
                      background: COLOR_PRIMARY,
                    }}
                  />
                )}
                <div
                  style={{
                    width: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: "12px",
                    color: active ? COLOR_PRIMARY : "#94A3B8",
                    flexShrink: 0,
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1 5a1 1 0 10-2 0v5a1 1 0 00.4.8l3 2.25a1 1 0 101.2-1.6L13 11.55V7z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span style={{ fontSize: "14px", fontWeight: active ? 600 : 500, letterSpacing: "-0.01em" }}>
                  Rekap Hasil
                </span>
                <span style={{
                  marginLeft: "auto",
                  fontSize: "10px",
                  color: "#94A3B8",
                  background: "#F1F5F9",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  whiteSpace: "nowrap",
                }}>
                  Selesai
                </span>
              </Link>
            );
          })()}
        </nav>

        {/* User Card at Bottom */}
        <div style={{ padding: "14px 16px", borderTop: "1px solid #E2E8F0", background: "#FFFFFF", position: "relative" }}>
          <div
            onClick={() => setUserMenuOpen((s) => !s)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              cursor: "pointer",
              padding: "6px 8px",
              borderRadius: "6px",
              transition: "background 0.15s ease",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "6px",
                background: `linear-gradient(135deg, ${COLOR_PRIMARY}, ${COLOR_PRIMARY_DARK})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: 700,
                fontSize: "13px",
                flexShrink: 0,
              }}
            >
              {mockTeacher.initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {mockTeacher.name}
              </div>
              <div style={{ fontSize: "11px", color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {mockTeacher.email}
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>

          {userMenuOpen && (
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 6px)",
                left: "14px",
                right: "14px",
                background: "white",
                border: "1px solid rgba(15,30,40,0.06)",
                borderRadius: "8px",
                boxShadow: "0 8px 24px rgba(15,30,40,0.14), 0 2px 8px rgba(15,30,40,0.08), 0 0 0 1px rgba(15,30,40,0.04)",
                padding: "6px",
                zIndex: 200,
              }}
            >
              <div style={{ padding: "8px 10px 6px", borderBottom: "1px solid #F1F5F9", marginBottom: "4px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#0F172A" }}>{mockTeacher.name}</div>
                <div style={{ fontSize: "11px", color: "#64748B" }}>Dosen Pengampu</div>
              </div>
              <Link
                href="/login"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 10px",
                  borderRadius: "4px",
                  color: "#E05050",
                  fontSize: "13px",
                  textDecoration: "none",
                }}
              >
                🚪 Keluar
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* ====== MAIN ====== */}
      <main style={{ marginLeft: `${SIDEBAR_W}px`, flex: 1, minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}
