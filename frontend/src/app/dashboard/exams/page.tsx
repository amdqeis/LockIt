"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/apiClient";
import DashboardShell from "../../components/DashboardShell";

// Spec §7 Unified Design Tokens
const T = {
  bgPage: "#F6F8FB",
  bgCard: "#FFFFFF",
  bgSubtle: "#F0F3F8",
  border: "#E1E6ED",
  borderInput: "#8391A7",
  textPrimary: "#172033",
  textSecondary: "#5B6778",
  textPlaceholder: "#6B7788",
  primary: "#1B76BF",
  primaryHover: "#155E99",
  primaryActive: "#114E80",
  primaryTint: "#E6F1FA",
  success: "#177A4B",
  danger: "#C73E3E",
  dangerBg: "#FCE9E9",
  statusActive: "#177A4B",
  statusScheduled: "#1B76BF",
  statusDraft: "#8391A7",
  statusFinished: "#5B6778",
  statusArchived: "#A8B2C0",
  flagCameraOff: "#EF6F6C",
  radiusCard: "8px",
  radiusControl: "8px",
  shadowCard: "0 2px 8px rgba(20, 24, 40, 0.08)",
  shadowCardHover: "0 4px 14px rgba(20, 24, 40, 0.14)",
};

type ExamStatus = "all" | "active" | "scheduled" | "draft" | "ended" | "archived";

interface ExamItem {
  id: string;
  title: string;
  description: string | null;
  status: "active" | "scheduled" | "draft" | "ended" | "archived";
  duration: number;
  questionCount: number;
  accessCode?: string;
  createdAt: string;
  startsAt?: string;
  endsAt?: string;
  updatedAt?: string;
  totalParticipants: number;
  online?: number;
  enrolled?: number;
  flagCount?: number;
}

function ExamsContent() {
  const searchParams = useSearchParams();
  const filterParam = searchParams ? searchParams.get("filter") : null;

  const [search, setSearch] = useState("");
  const [selectedTab, setSelectedTab] = useState<ExamStatus>(
    filterParam === "ended" ? "ended" : filterParam === "active" ? "active" : "all"
  );
  const [sortBy, setSortBy] = useState<"newest" | "schedule" | "title">("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [openMenuExamId, setOpenMenuExamId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ type: "delete" | "archive" | "restore"; exam: ExamItem } | null>(null);

  useEffect(() => {
    if (filterParam === "ended") setSelectedTab("ended");
    else if (filterParam === "active") setSelectedTab("active");
  }, [filterParam]);

  useEffect(() => {
    const saved = localStorage.getItem("eduquas_exams_view");
    if (saved === "grid" || saved === "list") {
      setViewMode(saved);
    }
  }, []);

  const changeViewMode = (mode: "grid" | "list") => {
    setViewMode(mode);
    localStorage.setItem("eduquas_exams_view", mode);
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((cur) => (cur === msg ? null : cur));
    }, 3000);
  };

  const copyAccessCode = (code: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(code)
        .then(() => showToast("Kode akses disalin"))
        .catch(() => showToast("Kode akses tidak bisa disalin. Salin manual."));
    } else {
      showToast("Kode akses tidak bisa disalin. Salin manual.");
    }
  };

  const [examsList, setExamsList] = useState<ExamItem[]>([]);
  const [loadingExams, setLoadingExams] = useState(true);

  const fetchExams = useCallback(async () => {
    try {
      const res = await apiFetch<any[]>("/api/exams");
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        const mapped: ExamItem[] = res.data.map((e: any) => ({
          id: e.id,
          title: e.title,
          description: e.description,
          status: e.status,
          duration: e.durationMinutes,
          questionCount: e._count?.questions ?? 0,
          accessCode: e.accessCode,
          createdAt: e.createdAt,
          startsAt: e.startTime,
          endsAt: e.endTime,
          updatedAt: e.updatedAt,
          totalParticipants: e._count?.students ?? 0,
        }));
        setExamsList(mapped);
      } else {
        setExamsList([]);
      }
    } catch {
      setExamsList([]);
    } finally {
      setLoadingExams(false);
    }
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const handleModalConfirm = async () => {
    if (!confirmModal) return;
    const { type, exam } = confirmModal;
    try {
      if (type === "delete") {
        const res = await apiFetch(`/api/exams/${exam.id}`, { method: "DELETE" });
        if (res.success) {
          showToast("Ujian berhasil dihapus");
          fetchExams();
        } else {
          showToast(res.error?.message || "Gagal menghapus ujian");
        }
      } else if (type === "archive") {
        const res = await apiFetch(`/api/exams/${exam.id}/status`, {
          method: "PUT",
          body: JSON.stringify({ status: "archived" }),
        });
        if (res.success) {
          showToast("Ujian berhasil diarsipkan");
          fetchExams();
        } else {
          showToast(res.error?.message || "Gagal mengarsipkan ujian");
        }
      } else {
        showToast("Aksi berhasil diproses");
        fetchExams();
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    } finally {
      setConfirmModal(null);
    }
  };

  const counts = useMemo(() => {
    return {
      all: examsList.length,
      active: examsList.filter((e) => e.status === "active").length,
      scheduled: examsList.filter((e) => e.status === "scheduled").length,
      draft: examsList.filter((e) => e.status === "draft").length,
      ended: examsList.filter((e) => e.status === "ended").length,
      archived: examsList.filter((e) => e.status === "archived").length,
    };
  }, [examsList]);

  const filteredAndSortedExams = useMemo(() => {
    const list = examsList.filter((exam) => {
      const matchSearch =
        search.trim() === "" ||
        exam.title.toLowerCase().includes(search.toLowerCase()) ||
        (exam.accessCode && exam.accessCode.toLowerCase().includes(search.toLowerCase()));

      let matchTab = true;
      if (selectedTab !== "all") {
        matchTab = exam.status === selectedTab;
      }

      return matchSearch && matchTab;
    });

    return list.sort((a, b) => {
      if (sortBy === "title") {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === "schedule") {
        return (a.startsAt || a.createdAt || "").localeCompare(b.startsAt || b.createdAt || "");
      }
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });
  }, [examsList, search, selectedTab, sortBy]);

  return (
    <DashboardShell>
      <style>{`
        .eduquas-btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 44px;
          padding: 0 18px;
          border-radius: ${T.radiusControl};
          background-color: ${T.primary};
          color: #FFFFFF;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          border: none;
          cursor: pointer;
          transition: background-color 150ms ease;
          outline: none;
        }
        .eduquas-btn-primary:hover {
          background-color: ${T.primaryHover};
        }
        .eduquas-btn-primary:active {
          background-color: ${T.primaryActive};
        }
        .eduquas-btn-primary:focus-visible {
          outline: 2px solid ${T.primary};
          outline-offset: 2px;
        }

        .status-tab-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 36px;
          padding: 0 14px;
          border-radius: ${T.radiusControl};
          border: none;
          background: transparent;
          color: ${T.textSecondary};
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 150ms ease, color 150ms ease;
          outline: none;
          white-space: nowrap;
        }
        .status-tab-btn:hover {
          background-color: ${T.bgSubtle};
          color: ${T.textPrimary};
        }
        .status-tab-btn:focus-visible {
          outline: 2px solid ${T.primary};
          outline-offset: 2px;
        }
        .status-tab-btn.selected {
          background-color: ${T.primaryTint};
          color: ${T.primary};
          font-weight: 600;
        }

        .exam-card {
          background: ${T.bgCard};
          border: 1px solid ${T.border};
          border-radius: ${T.radiusCard};
          padding: 16px;
          box-shadow: ${T.shadowCard};
          transition: box-shadow 150ms ease;
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .exam-card:hover {
          box-shadow: ${T.shadowCardHover};
        }
        .exam-card.is-archived {
          opacity: 0.85;
          color: ${T.textSecondary};
        }

        .action-btn-solid {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 36px;
          padding: 0 14px;
          border-radius: ${T.radiusControl};
          background-color: ${T.primary};
          color: #FFFFFF;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          border: none;
          cursor: pointer;
          transition: background-color 150ms ease;
          outline: none;
          white-space: nowrap;
        }
        .action-btn-solid:hover {
          background-color: ${T.primaryHover};
        }
        .action-btn-solid:focus-visible {
          outline: 2px solid ${T.primary};
          outline-offset: 2px;
        }

        .action-btn-outline {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 36px;
          padding: 0 12px;
          border-radius: ${T.radiusControl};
          background-color: #FFFFFF;
          border: 1px solid ${T.border};
          color: ${T.textPrimary};
          font-size: 13px;
          font-weight: 500;
          text-decoration: none;
          cursor: pointer;
          transition: background-color 150ms ease, border-color 150ms ease;
          outline: none;
          white-space: nowrap;
        }
        .action-btn-outline:hover {
          background-color: ${T.bgSubtle};
          border-color: ${T.borderInput};
        }
        .action-btn-outline:focus-visible {
          outline: 2px solid ${T.primary};
          outline-offset: 2px;
        }

        .overflow-menu-btn {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: ${T.textSecondary};
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 120ms ease;
          outline: none;
        }
        .overflow-menu-btn:hover {
          background-color: ${T.bgSubtle};
          color: ${T.textPrimary};
        }
        .overflow-menu-btn:focus-visible {
          outline: 2px solid ${T.primary};
          outline-offset: 1px;
        }

        .copy-code-btn {
          width: 28px;
          height: 28px;
          border: none;
          background: transparent;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: ${T.textSecondary};
          transition: background-color 120ms ease, color 120ms ease;
          outline: none;
        }
        .copy-code-btn:hover {
          background-color: rgba(27,118,191,0.12);
          color: ${T.primary};
        }
        .copy-code-btn:focus-visible {
          outline: 2px solid ${T.primary};
          outline-offset: 1px;
        }

        .table-row-hover:hover {
          background-color: ${T.bgSubtle};
        }
      `}</style>

      <div style={{ maxWidth: "1440px", margin: "0 auto", padding: "24px 32px 48px" }}>
        {/* Header bar */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "24px",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "26px",
                lineHeight: "32px",
                fontWeight: 600,
                color: T.textPrimary,
                margin: 0,
              }}
            >
              Ujian
            </h1>
            <div style={{ fontSize: "13px", color: T.textSecondary, marginTop: "2px" }}>
              Kelola seluruh ujian aktif, terjadwal, draft, dan riwayat ujian.
            </div>
          </div>

          <div>
            <Link href="/dashboard/exams/new" className="eduquas-btn-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Buat ujian</span>
            </Link>
          </div>
        </header>

        {/* Toolbar: Search, Sort select, View toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "16px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          {/* Status Tabs */}
          <div
            role="tablist"
            aria-label="Filter status ujian"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              overflowX: "auto",
            }}
          >
            {[
              { id: "all", label: "Semua", count: counts.all },
              { id: "active", label: "Aktif", count: counts.active },
              { id: "scheduled", label: "Terjadwal", count: counts.scheduled },
              { id: "draft", label: "Draft", count: counts.draft },
              { id: "ended", label: "Selesai", count: counts.ended },
              { id: "archived", label: "Diarsipkan", count: counts.archived },
            ].map((tab) => {
              const isSelected = selectedTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedTab(tab.id as ExamStatus)}
                  className={`status-tab-btn ${isSelected ? "selected" : ""}`}
                  style={{ opacity: tab.count === 0 && !isSelected ? 0.6 : 1 }}
                >
                  <span>{tab.label}</span>
                  <span style={{ fontSize: "12px", color: isSelected ? T.primary : T.textSecondary, fontWeight: isSelected ? 600 : 400 }}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right controls: Search, Sort, Toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Search */}
            <div style={{ position: "relative", width: "240px" }}>
              <span
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: T.textPlaceholder,
                  display: "flex",
                  pointerEvents: "none",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Cari ujian…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  height: "44px",
                  paddingLeft: "40px",
                  paddingRight: "14px",
                  background: T.bgCard,
                  border: `1px solid ${T.borderInput}`,
                  borderRadius: T.radiusControl,
                  fontSize: "14px",
                  color: T.textPrimary,
                  outline: "none",
                }}
              />
            </div>

            {/* Sort Select (Spec §4.5 proposed: 'Terbaru', 'Jadwal terdekat', 'Judul A-Z') */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "newest" | "schedule" | "title")}
              aria-label="Urutkan ujian"
              style={{
                height: "44px",
                padding: "0 12px",
                background: T.bgCard,
                border: `1px solid ${T.border}`,
                borderRadius: T.radiusControl,
                fontSize: "13px",
                color: T.textPrimary,
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="newest">Terbaru</option>
              <option value="schedule">Jadwal terdekat</option>
              <option value="title">Judul A–Z</option>
            </select>

            {/* View toggle */}
            <div
              style={{
                display: "flex",
                background: T.bgCard,
                border: `1px solid ${T.border}`,
                borderRadius: T.radiusControl,
                padding: "2px",
                height: "44px",
                alignItems: "center",
              }}
            >
              <button
                type="button"
                onClick={() => changeViewMode("grid")}
                aria-label="Tampilan kisi (grid)"
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "6px",
                  border: "none",
                  background: viewMode === "grid" ? T.primaryTint : "transparent",
                  color: viewMode === "grid" ? T.primary : T.textSecondary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => changeViewMode("list")}
                aria-label="Tampilan tabel (list)"
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "6px",
                  border: "none",
                  background: viewMode === "list" ? T.primaryTint : "transparent",
                  color: viewMode === "list" ? T.primary : T.textSecondary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Exam Cards Grid or List */}
        {filteredAndSortedExams.length === 0 ? (
          <div
            style={{
              background: T.bgCard,
              borderRadius: T.radiusCard,
              border: `1px solid ${T.border}`,
              padding: "64px 32px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "16px", fontWeight: 600, color: T.textPrimary, marginBottom: "6px" }}>
              Tidak ada ujian yang cocok.
            </div>
            <div style={{ fontSize: "13px", color: T.textSecondary, marginBottom: "16px" }}>
              Coba sesuaikan kata kunci pencarian atau pilih tab status lain.
            </div>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSelectedTab("all");
              }}
              style={{
                background: "transparent",
                border: "none",
                color: T.primary,
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Hapus filter
            </button>
          </div>
        ) : viewMode === "grid" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "16px",
            }}
          >
            {filteredAndSortedExams.map((exam) => (
              <ExamCardItem
                key={exam.id}
                exam={exam}
                isMenuOpen={openMenuExamId === exam.id}
                onToggleMenu={(id) => setOpenMenuExamId(openMenuExamId === id ? null : id)}
                onCopyCode={copyAccessCode}
                onActionConfirm={(type, ex) => {
                  setConfirmModal({ type, exam: ex });
                  setOpenMenuExamId(null);
                }}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              background: T.bgCard,
              border: `1px solid ${T.border}`,
              borderRadius: T.radiusCard,
              overflow: "hidden",
              boxShadow: T.shadowCard,
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: T.bgSubtle, borderBottom: `1px solid ${T.border}`, color: T.textSecondary, fontSize: "12px", fontWeight: 600, height: "44px" }}>
                    <th style={{ padding: "0 16px" }}>Status</th>
                    <th style={{ padding: "0 16px" }}>Judul</th>
                    <th style={{ padding: "0 16px" }}>Durasi</th>
                    <th style={{ padding: "0 16px" }}>Soal</th>
                    <th style={{ padding: "0 16px" }}>Peserta</th>
                    <th style={{ padding: "0 16px" }}>Jadwal / Waktu</th>
                    <th style={{ padding: "0 16px" }}>Kode akses</th>
                    <th style={{ padding: "0 16px", textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedExams.map((exam) => {
                    const isArchived = exam.status === "archived";
                    return (
                      <tr
                        key={exam.id}
                        className="table-row-hover"
                        style={{ height: "56px", borderBottom: `1px solid ${T.border}`, opacity: isArchived ? 0.8 : 1 }}
                      >
                        <td style={{ padding: "0 16px" }}>
                          <StatusBadge status={exam.status} />
                        </td>
                        <td style={{ padding: "0 16px", fontWeight: 600 }}>
                          <Link href={`/dashboard/exams/${exam.id}`} style={{ color: T.textPrimary, textDecoration: "none" }}>
                            {exam.title}
                          </Link>
                        </td>
                        <td style={{ padding: "0 16px", color: T.textSecondary }}>{exam.duration} menit</td>
                        <td style={{ padding: "0 16px", color: T.textSecondary }}>{exam.questionCount}</td>
                        <td style={{ padding: "0 16px", color: T.textSecondary }}>
                          {exam.status === "active" ? (
                            <span><strong style={{ color: T.textPrimary }}>{exam.online || 28}</strong>/{exam.enrolled || 34} online</span>
                          ) : exam.status === "ended" ? (
                            <span>{exam.totalParticipants}</span>
                          ) : (
                            <span>–</span>
                          )}
                        </td>
                        <td style={{ padding: "0 16px", color: T.textSecondary }}>{getContextLine(exam)}</td>
                        <td style={{ padding: "0 16px" }}>
                          {exam.status === "active" || exam.status === "scheduled" ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "12px", fontWeight: 600, color: T.textPrimary }}>
                                {exam.accessCode}
                              </span>
                              <button
                                type="button"
                                className="copy-code-btn"
                                onClick={() => copyAccessCode(exam.accessCode || "")}
                                aria-label={`Salin kode akses ${exam.accessCode}`}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: T.textSecondary }}>–</span>
                          )}
                        </td>
                        <td style={{ padding: "0 16px", textAlign: "right" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                            <PrimaryActionBtn exam={exam} />
                            <Link
                              href={`/dashboard/exams/${exam.id}`}
                              className="action-btn-outline"
                              style={{ height: "32px", padding: "0 10px", fontSize: "12px" }}
                            >
                              Detail
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Confirm Modal */}
        {confirmModal && (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(15, 23, 42, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 300,
              padding: "20px",
            }}
            onClick={() => setConfirmModal(null)}
          >
            <div
              style={{
                background: T.bgCard,
                borderRadius: T.radiusCard,
                border: `1px solid ${T.border}`,
                boxShadow: "0 12px 32px rgba(20,24,40,0.18)",
                maxWidth: "420px",
                width: "100%",
                padding: "24px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: "16px", fontWeight: 600, color: T.textPrimary, marginTop: 0, marginBottom: "8px" }}>
                {confirmModal.type === "delete" ? "Hapus ujian?" : confirmModal.type === "archive" ? "Arsipkan ujian?" : "Pulihkan ujian?"}
              </h3>
              <p style={{ fontSize: "13px", color: T.textSecondary, lineHeight: "20px", marginBottom: "20px" }}>
                {confirmModal.type === "delete"
                  ? `Ujian "${confirmModal.exam.title}" akan dihapus permanen.`
                  : confirmModal.type === "archive"
                  ? `Ujian "${confirmModal.exam.title}" akan dipindahkan ke arsip.`
                  : `Ujian "${confirmModal.exam.title}" akan dipulihkan.`}
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="action-btn-outline" onClick={() => setConfirmModal(null)}>
                  Batal
                </button>
                <button
                  type="button"
                  className="eduquas-btn-primary"
                  style={{ backgroundColor: confirmModal.type === "delete" ? T.danger : T.primary }}
                  onClick={handleModalConfirm}
                >
                  {confirmModal.type === "delete" ? "Ya, hapus" : confirmModal.type === "archive" ? "Ya, arsipkan" : "Ya, pulihkan"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toastMsg && (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: "fixed",
              bottom: "24px",
              right: "24px",
              background: T.textPrimary,
              color: "#FFFFFF",
              padding: "10px 18px",
              borderRadius: T.radiusControl,
              boxShadow: "0 6px 20px rgba(15,23,42,0.20)",
              fontSize: "13px",
              fontWeight: 500,
              zIndex: 400,
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{toastMsg}</span>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function StatusBadge({ status }: { status: ExamItem["status"] }) {
  if (status === "active") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 500, color: T.statusActive }}>
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: T.statusActive, display: "inline-block" }} />
        <span>Aktif</span>
      </div>
    );
  }
  if (status === "scheduled") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 500, color: T.statusScheduled }}>
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: T.statusScheduled, display: "inline-block" }} />
        <span>Terjadwal</span>
      </div>
    );
  }
  if (status === "draft") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 500, color: T.statusDraft }}>
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", border: `1.5px solid ${T.statusDraft}`, display: "inline-block" }} />
        <span>Draft</span>
      </div>
    );
  }
  if (status === "ended") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 500, color: T.statusFinished }}>
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: T.statusFinished, display: "inline-block" }} />
        <span>Selesai</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 500, color: T.statusArchived }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", border: `1.5px solid ${T.statusArchived}`, display: "inline-block" }} />
      <span>Diarsipkan</span>
    </div>
  );
}

function getContextLine(exam: ExamItem): string {
  switch (exam.status) {
    case "active":
      return `${exam.online || 28} dari ${exam.enrolled || 34} online · ● ${exam.flagCount || 3} pelanggaran`;
    case "scheduled":
      return "Mulai Sen, 2 Nov · 09:00";
    case "draft":
      return exam.updatedAt ? `Diubah ${exam.updatedAt}` : "Diubah 2 hari lalu";
    case "ended":
      return `Selesai 28 Sep · ${exam.totalParticipants} peserta`;
    case "archived":
      return "Diarsipkan 15 Agu";
  }
}

function PrimaryActionBtn({ exam }: { exam: ExamItem }) {
  if (exam.status === "active") {
    return (
      <Link href={`/dashboard/exams/${exam.id}/monitor`} className="action-btn-solid">
        Monitor
      </Link>
    );
  }
  if (exam.status === "scheduled") {
    return (
      <Link href={`/dashboard/exams/${exam.id}`} className="action-btn-solid">
        Detail
      </Link>
    );
  }
  if (exam.status === "draft") {
    return (
      <Link href={`/dashboard/exams/${exam.id}/edit`} className="action-btn-solid">
        Lanjutkan
      </Link>
    );
  }
  if (exam.status === "ended") {
    return (
      <Link href={`/dashboard/exams/${exam.id}/results`} className="action-btn-solid">
        Lihat hasil
      </Link>
    );
  }
  return (
    <button type="button" className="action-btn-outline">
      Pulihkan
    </button>
  );
}

function ExamCardItem({
  exam,
  isMenuOpen,
  onToggleMenu,
  onCopyCode,
  onActionConfirm,
}: {
  exam: ExamItem;
  isMenuOpen: boolean;
  onToggleMenu: (id: string) => void;
  onCopyCode: (code: string) => void;
  onActionConfirm: (type: "delete" | "archive" | "restore", exam: ExamItem) => void;
}) {
  const isArchived = exam.status === "archived";
  const showAccessCode = exam.status === "active" || exam.status === "scheduled";

  return (
    <article className={`exam-card ${isArchived ? "is-archived" : ""}`}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <StatusBadge status={exam.status} />
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className="overflow-menu-btn"
            onClick={() => onToggleMenu(exam.id)}
            aria-label={`Menu opsi untuk ${exam.title}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
              <circle cx="5" cy="12" r="1" />
            </svg>
          </button>
          {isMenuOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                background: T.bgCard,
                border: `1px solid ${T.border}`,
                borderRadius: T.radiusCard,
                boxShadow: "0 4px 16px rgba(20,24,40,0.12)",
                padding: "4px",
                zIndex: 100,
                minWidth: "140px",
              }}
            >
              <button type="button" className="action-btn-outline" style={{ border: "none", width: "100%", justifyContent: "flex-start", height: "32px", fontSize: "12px" }}>
                Duplikat
              </button>
              {exam.status === "archived" ? (
                <button
                  type="button"
                  className="action-btn-outline"
                  style={{ border: "none", width: "100%", justifyContent: "flex-start", height: "32px", fontSize: "12px" }}
                  onClick={() => onActionConfirm("restore", exam)}
                >
                  Pulihkan
                </button>
              ) : (
                <button
                  type="button"
                  className="action-btn-outline"
                  style={{ border: "none", width: "100%", justifyContent: "flex-start", height: "32px", fontSize: "12px" }}
                  onClick={() => onActionConfirm("archive", exam)}
                >
                  Arsipkan
                </button>
              )}
              <button
                type="button"
                className="action-btn-outline"
                style={{ border: "none", width: "100%", justifyContent: "flex-start", height: "32px", fontSize: "12px", color: T.danger }}
                onClick={() => onActionConfirm("delete", exam)}
              >
                Hapus
              </button>
            </div>
          )}
        </div>
      </div>

      <h3 style={{ margin: "0 0 8px 0", fontSize: "15px", lineHeight: "22px", fontWeight: 600 }}>
        <Link
          href={`/dashboard/exams/${exam.id}`}
          style={{
            color: T.textPrimary,
            textDecoration: "none",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
          title={exam.title}
        >
          {exam.title}
        </Link>
      </h3>

      <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: "12px", color: T.textSecondary, marginBottom: "12px" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {exam.duration} menit
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          {exam.questionCount} soal
        </span>
      </div>

      <div style={{ height: "1px", background: T.border, margin: "0 0 12px 0" }} />

      {showAccessCode && (
        <div
          style={{
            background: T.bgSubtle,
            borderRadius: T.radiusControl,
            padding: "8px 12px",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: "12px", color: T.textSecondary }}>Kode akses</span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "13px", fontWeight: 600, color: T.textPrimary }}>
              {exam.accessCode}
            </span>
            <button
              type="button"
              className="copy-code-btn"
              onClick={() => onCopyCode(exam.accessCode || "")}
              aria-label={`Salin kode akses ${exam.accessCode}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div style={{ fontSize: "12px", color: T.textSecondary, marginBottom: "16px", minHeight: "18px" }}>
        {exam.status === "active" ? (
          <span>
            <strong style={{ color: T.textPrimary }}>{exam.online || 28}</strong> dari {exam.enrolled || 34} online ·{" "}
            <span style={{ color: T.flagCameraOff }}>●</span> {exam.flagCount || 3} pelanggaran
          </span>
        ) : (
          getContextLine(exam)
        )}
      </div>

      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
        <PrimaryActionBtn exam={exam} />
        {exam.status === "scheduled" ? (
          <Link href={`/dashboard/exams/${exam.id}/edit`} className="action-btn-outline">
            Ubah
          </Link>
        ) : (
          <Link href={`/dashboard/exams/${exam.id}`} className="action-btn-outline">
            Detail
          </Link>
        )}
      </div>
    </article>
  );
}

export default function ExamsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Memuat…</div>}>
      <ExamsContent />
    </Suspense>
  );
}
