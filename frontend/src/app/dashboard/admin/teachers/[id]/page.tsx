"use client";

import { useState, useEffect, use, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardShell from "@/app/components/DashboardShell";
import { useTeacherAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiClient";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const T = {
  bgPage:     "#F6F8FB",
  bgCard:     "#FFFFFF",
  bgSubtle:   "#F0F3F8",
  border:     "#E1E6ED",
  textPrimary:   "#172033",
  textSecondary: "#5B6778",
  primary:    "#1B76BF",
  success:    "#177A4B",
  successBg:  "#E7F5EE",
  danger:     "#C73E3E",
  dangerBg:   "#FCE9E9",
  warning:    "#8B6914",
  warningBg:  "#FEF3CD",
  radiusCard:    "12px",
  radiusControl: "8px",
};

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface TeacherDetail {
  id:          string;
  email:       string;
  fullName:    string;
  role:        "TEACHER" | "ADMIN";
  isActive:    boolean;
  phone:       string | null;
  lastLoginAt: string | null;
  createdAt:   string;
  examCount:   number;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDateShort(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ─── INNER PAGE (uses params) ─────────────────────────────────────────────────

function TeacherDetailInner({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { teacher: currentUser } = useTeacherAuth();
  const { id } = use(params);

  const [teacher, setTeacher]             = useState<TeacherDetail | null>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg]                     = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Reset password state
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetForm, setResetForm]         = useState({ newPassword: "", confirmPassword: "" });
  const [resetLoading, setResetLoading]   = useState(false);
  const [resetMsg, setResetMsg]           = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Edit role state
  const [showEditRole, setShowEditRole]       = useState(false);
  const [pendingRole, setPendingRole]         = useState<"TEACHER" | "ADMIN">("TEACHER");
  const [editRoleLoading, setEditRoleLoading] = useState(false);

  // Redirect non-admin
  useEffect(() => {
    if (currentUser && currentUser.role !== "ADMIN") {
      router.replace("/dashboard");
    }
  }, [currentUser, router]);

  // Fetch teacher detail
  async function fetchTeacher() {
    setLoading(true);
    setError(null);
    const res = await apiFetch<TeacherDetail>(`/api/admin/teachers/${id}`);
    setLoading(false);
    if (res.success && res.data) {
      setTeacher(res.data);
      setPendingRole(res.data.role);
    } else {
      setError(res.error?.message ?? "Gagal memuat data guru.");
    }
  }

  useEffect(() => { fetchTeacher(); }, [id]);

  // ─── TOGGLE AKTIF / NONAKTIF ─────────────────────────────────────────────

  async function toggleActive() {
    if (!teacher) return;
    const confirmMsg = teacher.isActive
      ? `Nonaktifkan akun ${teacher.fullName}? Semua sesi aktif akan dihentikan.`
      : `Aktifkan kembali akun ${teacher.fullName}?`;
    if (!window.confirm(confirmMsg)) return;

    setActionLoading(true);
    setMsg(null);

    let res;
    if (teacher.isActive) {
      res = await apiFetch(`/api/admin/teachers/${id}`, { method: "DELETE" });
    } else {
      res = await apiFetch(`/api/admin/teachers/${id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: true }),
      });
    }
    setActionLoading(false);

    if (res.success) {
      setMsg({
        type: "success",
        text: teacher.isActive ? "Akun berhasil dinonaktifkan." : "Akun berhasil diaktifkan kembali.",
      });
      await fetchTeacher();
    } else {
      setMsg({ type: "error", text: res.error?.message ?? "Aksi gagal." });
    }
  }

  // ─── UPDATE ROLE ─────────────────────────────────────────────────────────

  async function submitRole(e: React.FormEvent) {
    e.preventDefault();
    if (!teacher || pendingRole === teacher.role) return;
    setEditRoleLoading(true);
    setMsg(null);
    const res = await apiFetch(`/api/admin/teachers/${id}`, {
      method: "PUT",
      body: JSON.stringify({ role: pendingRole }),
    });
    setEditRoleLoading(false);
    if (res.success) {
      setMsg({
        type: "success",
        text: `Role diubah menjadi ${pendingRole === "ADMIN" ? "Administrator" : "Guru"}.`,
      });
      setShowEditRole(false);
      await fetchTeacher();
    } else {
      setMsg({ type: "error", text: res.error?.message ?? "Gagal mengubah role." });
    }
  }

  // ─── RESET PASSWORD ──────────────────────────────────────────────────────

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    if (resetForm.newPassword !== resetForm.confirmPassword) {
      setResetMsg({ type: "error", text: "Konfirmasi password tidak cocok." });
      return;
    }
    setResetLoading(true);
    setResetMsg(null);
    const res = await apiFetch(`/api/admin/teachers/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ newPassword: resetForm.newPassword }),
    });
    setResetLoading(false);
    if (res.success) {
      setResetMsg({ type: "success", text: "Password berhasil direset. Semua sesi aktif guru telah dihentikan." });
      setResetForm({ newPassword: "", confirmPassword: "" });
      setTimeout(() => setShowResetForm(false), 2500);
    } else {
      setResetMsg({ type: "error", text: res.error?.message ?? "Gagal mereset password." });
    }
  }

  if (loading) {
    return (
      <DashboardShell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "400px" }}>
          <div style={{ color: T.textSecondary, fontSize: "14px" }}>Memuat data guru…</div>
        </div>
      </DashboardShell>
    );
  }

  if (error || !teacher) {
    return (
      <DashboardShell>
        <div style={{ padding: "32px 24px" }}>
          <Link
            href="/dashboard/admin/teachers"
            style={{ fontSize: "13px", color: T.primary, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px", marginBottom: "24px" }}
          >
            ← Kembali ke daftar guru
          </Link>
          <div style={{ background: T.dangerBg, color: T.danger, borderRadius: T.radiusCard, padding: "20px", textAlign: "center" }}>
            {error ?? "Guru tidak ditemukan."}
          </div>
        </div>
      </DashboardShell>
    );
  }

  const isSelf    = currentUser?.id === teacher.id;
  const initials  = teacher.fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <DashboardShell>
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "32px 24px" }}>

        {/* Back link */}
        <Link
          href="/dashboard/admin/teachers"
          style={{
            fontSize: "13px", color: T.primary, textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: "4px", marginBottom: "24px",
          }}
        >
          ← Kembali ke manajemen guru
        </Link>

        {/* Global message */}
        {msg && (
          <div style={{
            padding: "10px 14px", borderRadius: T.radiusControl, marginBottom: "16px",
            background: msg.type === "error" ? T.dangerBg : T.successBg,
            color: msg.type === "error" ? T.danger : T.success,
            fontSize: "13px", fontWeight: 500,
          }}>
            {msg.text}
          </div>
        )}

        {/* ─── PROFILE CARD ─────────────────────────────────────────────── */}
        <div style={{
          background: T.bgCard, border: `1px solid ${T.border}`,
          borderRadius: T.radiusCard, padding: "28px", marginBottom: "20px",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "20px" }}>
            {/* Avatar */}
            <div style={{
              width: "64px", height: "64px", borderRadius: "14px",
              background: T.primary, display: "flex", alignItems: "center",
              justifyContent: "center", color: "#fff", fontSize: "22px",
              fontWeight: 700, flexShrink: 0,
            }}>
              {initials}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Name + badges */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <h1 style={{ fontSize: "20px", fontWeight: 700, color: T.textPrimary, margin: 0 }}>
                  {teacher.fullName}
                </h1>
                {isSelf && (
                  <span style={{
                    fontSize: "11px", color: T.textSecondary,
                    background: T.bgSubtle, padding: "1px 6px", borderRadius: "4px",
                  }}>
                    (Anda)
                  </span>
                )}
                <span style={{
                  fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px",
                  background: teacher.role === "ADMIN" ? T.primary : T.bgSubtle,
                  color: teacher.role === "ADMIN" ? "#fff" : T.textSecondary,
                  letterSpacing: "0.05em",
                }}>
                  {teacher.role === "ADMIN" ? "ADMIN" : "GURU"}
                </span>
                <span style={{
                  fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px",
                  background: teacher.isActive ? T.successBg : T.dangerBg,
                  color: teacher.isActive ? T.success : T.danger,
                }}>
                  {teacher.isActive ? "Aktif" : "Nonaktif"}
                </span>
              </div>

              {/* Info grid */}
              <div style={{ marginTop: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 32px" }}>
                <InfoRow label="Email"          value={teacher.email} />
                <InfoRow label="No. HP"         value={teacher.phone ?? "—"} />
                <InfoRow label="Bergabung"      value={formatDateShort(teacher.createdAt)} />
                <InfoRow label="Login terakhir" value={formatDate(teacher.lastLoginAt)} />
                <InfoRow label="Total ujian"    value={`${teacher.examCount} ujian`} />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{
            display: "flex", gap: "10px", marginTop: "24px",
            paddingTop: "20px", borderTop: `1px solid ${T.border}`, flexWrap: "wrap",
          }}>
            <button
              id="btn-toggle-active"
              onClick={toggleActive}
              disabled={actionLoading || isSelf}
              title={isSelf ? "Anda tidak dapat menonaktifkan akun sendiri." : undefined}
              style={{
                padding: "9px 18px", borderRadius: T.radiusControl, fontSize: "13px", fontWeight: 600,
                border: `1px solid ${teacher.isActive ? T.danger : T.success}`,
                background: "transparent",
                color: teacher.isActive ? T.danger : T.success,
                cursor: isSelf || actionLoading ? "not-allowed" : "pointer",
                opacity: isSelf ? 0.4 : 1,
              }}
            >
              {actionLoading ? "Memproses…" : teacher.isActive ? "Nonaktifkan akun" : "Aktifkan kembali"}
            </button>

            {!showEditRole && (
              <button
                id="btn-edit-role"
                onClick={() => setShowEditRole(true)}
                disabled={isSelf}
                title={isSelf ? "Anda tidak dapat mengubah role sendiri." : undefined}
                style={{
                  padding: "9px 18px", borderRadius: T.radiusControl, fontSize: "13px", fontWeight: 600,
                  border: `1px solid ${T.border}`, background: T.bgCard, color: T.textPrimary,
                  cursor: isSelf ? "not-allowed" : "pointer", opacity: isSelf ? 0.4 : 1,
                }}
              >
                Ubah role
              </button>
            )}

            <button
              id="btn-reset-password"
              onClick={() => { setShowResetForm((s) => !s); setResetMsg(null); }}
              style={{
                padding: "9px 18px", borderRadius: T.radiusControl, fontSize: "13px", fontWeight: 600,
                border: `1px solid ${T.border}`, background: T.bgCard, color: T.textPrimary, cursor: "pointer",
              }}
            >
              {showResetForm ? "Tutup" : "Reset password"}
            </button>
          </div>

          {/* Edit role inline form */}
          {showEditRole && !isSelf && (
            <form
              onSubmit={submitRole}
              style={{ marginTop: "16px", padding: "16px", background: T.bgSubtle, borderRadius: T.radiusControl }}
            >
              <div style={{ fontSize: "13px", fontWeight: 600, color: T.textPrimary, marginBottom: "10px" }}>
                Ubah role guru
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <select
                  id="select-role"
                  value={pendingRole}
                  onChange={(e) => setPendingRole(e.target.value as "TEACHER" | "ADMIN")}
                  style={{ ...inputStyle, width: "180px" }}
                >
                  <option value="TEACHER">Guru</option>
                  <option value="ADMIN">Administrator</option>
                </select>
                <button
                  type="submit"
                  disabled={editRoleLoading || pendingRole === teacher.role}
                  style={btnPrimaryStyle}
                >
                  {editRoleLoading ? "Menyimpan…" : "Simpan"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowEditRole(false); setPendingRole(teacher.role); }}
                  style={btnSecondaryStyle}
                >
                  Batal
                </button>
              </div>
            </form>
          )}

          {/* Reset password inline form */}
          {showResetForm && (
            <div style={{ marginTop: "16px", padding: "16px", background: T.bgSubtle, borderRadius: T.radiusControl }}>
              <div style={{
                background: T.warningBg, color: T.warning, borderRadius: T.radiusControl,
                padding: "10px 12px", fontSize: "13px", marginBottom: "14px",
              }}>
                Guru akan dikeluarkan dari semua sesi aktif setelah password direset.
              </div>
              {resetMsg && (
                <div style={{
                  padding: "10px 14px", borderRadius: T.radiusControl, marginBottom: "12px",
                  background: resetMsg.type === "error" ? T.dangerBg : T.successBg,
                  color: resetMsg.type === "error" ? T.danger : T.success,
                  fontSize: "13px", fontWeight: 500,
                }}>
                  {resetMsg.text}
                </div>
              )}
              <form onSubmit={submitReset}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                  <div>
                    <label htmlFor="reset-pass-new" style={labelStyle}>Password baru *</label>
                    <input
                      id="reset-pass-new"
                      type="password"
                      value={resetForm.newPassword}
                      onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label htmlFor="reset-pass-confirm" style={labelStyle}>Konfirmasi password *</label>
                    <input
                      id="reset-pass-confirm"
                      type="password"
                      value={resetForm.confirmPassword}
                      onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      style={inputStyle}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={resetLoading}
                  style={{ ...btnPrimaryStyle, background: T.danger }}
                >
                  {resetLoading ? "Mereset…" : "Reset password sekarang"}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* ─── STATS CARD ──────────────────────────────────────────────────── */}
        <div style={{
          background: T.bgCard, border: `1px solid ${T.border}`,
          borderRadius: T.radiusCard, padding: "24px",
        }}>
          <h2 style={{ fontSize: "15px", fontWeight: 700, color: T.textPrimary, margin: "0 0 16px" }}>
            Statistik Akun
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
            <StatCard label="Total ujian dibuat" value={String(teacher.examCount)}           color={T.primary} />
            <StatCard label="Tanggal bergabung"  value={formatDateShort(teacher.createdAt)}  color={T.success} />
            <StatCard label="Login terakhir"     value={formatDateShort(teacher.lastLoginAt)} color={T.textSecondary} />
          </div>
        </div>

      </div>
    </DashboardShell>
  );
}

// ─── WRAPPER (Suspense boundary required for use(params)) ─────────────────────

export default function TeacherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={
      <DashboardShell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "400px" }}>
          <div style={{ color: "#5B6778", fontSize: "14px" }}>Memuat…</div>
        </div>
      </DashboardShell>
    }>
      <TeacherDetailInner params={params} />
    </Suspense>
  );
}

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "11px", color: T.textSecondary, marginBottom: "2px" }}>{label}</div>
      <div style={{ fontSize: "13px", color: T.textPrimary, fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: T.bgSubtle, borderRadius: T.radiusControl, padding: "16px", textAlign: "center" }}>
      <div style={{ fontSize: "18px", fontWeight: 700, color, marginBottom: "4px" }}>{value}</div>
      <div style={{ fontSize: "12px", color: T.textSecondary }}>{label}</div>
    </div>
  );
}

// ─── SHARED STYLES ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", height: "40px", padding: "0 12px",
  border: `1px solid ${T.border}`, borderRadius: T.radiusControl,
  fontSize: "14px", color: T.textPrimary, background: T.bgCard,
  outline: "none", boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "12px", fontWeight: 600,
  color: T.textSecondary, marginBottom: "6px",
};

const btnPrimaryStyle: React.CSSProperties = {
  padding: "9px 18px", borderRadius: T.radiusControl,
  background: T.primary, color: "#fff",
  fontSize: "13px", fontWeight: 600, border: "none", cursor: "pointer",
};

const btnSecondaryStyle: React.CSSProperties = {
  padding: "9px 18px", borderRadius: T.radiusControl,
  background: T.bgCard, color: T.textPrimary,
  fontSize: "13px", fontWeight: 600,
  border: `1px solid ${T.border}`, cursor: "pointer",
};
