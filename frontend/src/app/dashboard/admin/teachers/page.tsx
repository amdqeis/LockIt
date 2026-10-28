"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import DashboardShell from "@/app/components/DashboardShell";
import { useTeacherAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiClient";
import { useRouter } from "next/navigation";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const T = {
  bgPage: "#F6F8FB",
  bgCard: "#FFFFFF",
  bgSubtle: "#F0F3F8",
  border: "#E1E6ED",
  textPrimary: "#172033",
  textSecondary: "#5B6778",
  primary: "#1B76BF",
  primaryTint: "#E6F1FA",
  success: "#177A4B",
  successBg: "#E7F5EE",
  danger: "#C73E3E",
  dangerBg: "#FCE9E9",
  warning: "#8B6914",
  warningBg: "#FEF3CD",
  radiusCard: "12px",
  radiusControl: "8px",
};

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface TeacherRow {
  id: string;
  email: string;
  fullName: string;
  role: "TEACHER" | "ADMIN";
  isActive: boolean;
  phone: string | null;
  lastLoginAt: string | null;
  examCount: number;
  createdAt: string;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function AdminTeachersPage() {
  const router = useRouter();
  const { teacher: currentUser } = useTeacherAuth();

  // Redirect non-admin
  useEffect(() => {
    if (currentUser && currentUser.role !== "ADMIN") {
      router.replace("/dashboard");
    }
  }, [currentUser, router]);

  // ─── DATA STATE ─────────────────────────────────────────────────────────
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [meta, setMeta]         = useState<Meta | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  // ─── FILTER STATE ────────────────────────────────────────────────────────
  const [search,   setSearch]   = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | "TEACHER" | "ADMIN">("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  const [page, setPage]         = useState(1);

  // ─── MODAL STATE ─────────────────────────────────────────────────────────
  const [addModal,   setAddModal]   = useState(false);
  const [editModal,  setEditModal]  = useState<TeacherRow | null>(null);
  const [resetModal, setResetModal] = useState<TeacherRow | null>(null);

  // ─── FETCH ───────────────────────────────────────────────────────────────
  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search)       params.set("search",   search);
    if (roleFilter)   params.set("role",     roleFilter);
    if (activeFilter) params.set("isActive", activeFilter);

    const res = await apiFetch<{ data: TeacherRow[]; meta: Meta }>(`/api/admin/teachers?${params}`);
    setLoading(false);
    if (res.success && res.data) {
      setTeachers(res.data.data);
      setMeta(res.data.meta);
    } else {
      setError(res.error?.message ?? "Gagal memuat data.");
    }
  }, [page, search, roleFilter, activeFilter]);

  useEffect(() => { fetchTeachers(); }, [fetchTeachers]);

  // ─── ACTIONS ─────────────────────────────────────────────────────────────

  async function toggleActive(t: TeacherRow) {
    if (!window.confirm(
      t.isActive
        ? `Nonaktifkan akun ${t.fullName}? Semua sesi aktif guru akan dihentikan.`
        : `Aktifkan kembali akun ${t.fullName}?`
    )) return;

    if (t.isActive) {
      await apiFetch(`/api/admin/teachers/${t.id}`, { method: "DELETE" });
    } else {
      await apiFetch(`/api/admin/teachers/${t.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: true }),
      });
    }
    fetchTeachers();
  }

  return (
    <DashboardShell>
      <div style={{ padding: "32px 24px" }}>
        {/* ─── HEADER ───────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: T.textPrimary, margin: "0 0 4px" }}>
              Manajemen Guru
            </h1>
            {meta && (
              <p style={{ fontSize: "13px", color: T.textSecondary, margin: 0 }}>
                {meta.total} akun guru terdaftar
              </p>
            )}
          </div>
          <button
            id="btn-tambah-guru"
            onClick={() => setAddModal(true)}
            style={{ padding: "10px 20px", borderRadius: T.radiusControl, background: T.primary, color: "#fff", fontSize: "14px", fontWeight: 600, border: "none", cursor: "pointer" }}
          >
            + Tambah guru
          </button>
        </div>

        {/* ─── FILTER BAR ────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
          <input
            id="filter-search"
            type="search"
            placeholder="Cari nama atau email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ ...inputStyle, width: "260px" }}
          />
          <select
            id="filter-role"
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value as any); setPage(1); }}
            style={{ ...inputStyle, width: "140px" }}
          >
            <option value="">Semua role</option>
            <option value="TEACHER">Guru</option>
            <option value="ADMIN">Admin</option>
          </select>
          <select
            id="filter-status"
            value={activeFilter}
            onChange={(e) => { setActiveFilter(e.target.value as any); setPage(1); }}
            style={{ ...inputStyle, width: "140px" }}
          >
            <option value="">Semua status</option>
            <option value="true">Aktif</option>
            <option value="false">Nonaktif</option>
          </select>
        </div>

        {/* ─── TABLE ─────────────────────────────────────────────────────── */}
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radiusCard, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "48px", textAlign: "center", color: T.textSecondary }}>Memuat…</div>
          ) : error ? (
            <div style={{ padding: "48px", textAlign: "center", color: T.danger }}>{error}</div>
          ) : teachers.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center", color: T.textSecondary }}>Tidak ada guru ditemukan.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: T.bgSubtle }}>
                  {["Nama", "Email", "Role", "Status", "Login terakhir", "Ujian", "Aksi"].map((h) => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: T.textSecondary, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teachers.map((t, i) => (
                  <tr key={t.id} style={{ borderBottom: i < teachers.length - 1 ? `1px solid ${T.border}` : undefined }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: T.textPrimary }}>
                      {t.fullName}
                      {t.id === currentUser?.id && (
                        <span style={{ marginLeft: "6px", fontSize: "11px", color: T.textSecondary }}>(Anda)</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", color: T.textSecondary }}>{t.email}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <RoleBadge role={t.role} />
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <StatusBadge active={t.isActive} />
                    </td>
                    <td style={{ padding: "12px 16px", color: T.textSecondary, whiteSpace: "nowrap" }}>{formatDate(t.lastLoginAt)}</td>
                    <td style={{ padding: "12px 16px", color: T.textSecondary, textAlign: "center" }}>{t.examCount}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <Link
                          href={`/dashboard/admin/teachers/${t.id}`}
                          style={{
                            padding: "4px 10px", borderRadius: "6px", border: `1px solid ${T.border}`,
                            background: "transparent", color: T.primary,
                            fontSize: "12px", fontWeight: 500, textDecoration: "none", display: "inline-block",
                          }}
                        >
                          Detail
                        </Link>
                        <ActionBtn label="Edit" onClick={() => setEditModal(t)} />
                        <ActionBtn label="Reset pass" onClick={() => setResetModal(t)} />
                        <ActionBtn
                          label={t.isActive ? "Nonaktifkan" : "Aktifkan"}
                          danger={t.isActive}
                          disabled={t.id === currentUser?.id}
                          onClick={() => toggleActive(t)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", padding: "12px 16px", borderTop: `1px solid ${T.border}` }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={paginationBtn}>← Sebelumnya</button>
              <span style={{ fontSize: "13px", color: T.textSecondary }}>Halaman {page} / {meta.totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages} style={paginationBtn}>Berikutnya →</button>
            </div>
          )}
        </div>
      </div>

      {/* ─── MODAL: TAMBAH GURU ───────────────────────────────────────────── */}
      {addModal && (
        <AddTeacherModal
          onClose={() => setAddModal(false)}
          onSuccess={() => { setAddModal(false); fetchTeachers(); }}
        />
      )}

      {/* ─── MODAL: EDIT GURU ─────────────────────────────────────────────── */}
      {editModal && (
        <EditTeacherModal
          teacher={editModal}
          onClose={() => setEditModal(null)}
          onSuccess={() => { setEditModal(null); fetchTeachers(); }}
        />
      )}

      {/* ─── MODAL: RESET PASSWORD ────────────────────────────────────────── */}
      {resetModal && (
        <ResetPasswordModal
          teacher={resetModal}
          onClose={() => setResetModal(null)}
          onSuccess={() => setResetModal(null)}
        />
      )}
    </DashboardShell>
  );
}

// ─── MODAL: ADD TEACHER ───────────────────────────────────────────────────────

function AddTeacherModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ email: "", fullName: "", phone: "", password: "", role: "TEACHER" as "TEACHER" | "ADMIN" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    const res = await apiFetch("/api/admin/teachers", {
      method: "POST",
      body: JSON.stringify({ ...form, phone: form.phone || null }),
    });
    setLoading(false);
    if (res.success) {
      onSuccess();
    } else {
      setErr(res.error?.message ?? "Gagal membuat akun guru.");
    }
  }

  return (
    <Modal title="Tambah Guru Baru" onClose={onClose}>
      {err && <AlertBox type="error" text={err} />}
      <form onSubmit={submit}>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <FormField label="Nama Lengkap *" id="add-fullName">
            <input id="add-fullName" type="text" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required minLength={2} style={inputStyle} />
          </FormField>
          <FormField label="Email *" id="add-email">
            <input id="add-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required style={inputStyle} />
          </FormField>
          <FormField label="No. HP" id="add-phone">
            <input id="add-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={20} placeholder="Opsional" style={inputStyle} />
          </FormField>
          <FormField label="Password *" id="add-password">
            <input id="add-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} autoComplete="new-password" style={inputStyle} />
          </FormField>
          <FormField label="Role *" id="add-role">
            <select id="add-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as any })} style={inputStyle}>
              <option value="TEACHER">Guru</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </FormField>
        </div>
        <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} style={btnSecondaryStyle}>Batal</button>
          <button type="submit" disabled={loading} style={btnPrimaryStyle}>{loading ? "Membuat…" : "Buat akun"}</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── MODAL: EDIT TEACHER ──────────────────────────────────────────────────────

function EditTeacherModal({ teacher, onClose, onSuccess }: { teacher: TeacherRow; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ fullName: teacher.fullName, phone: teacher.phone ?? "", role: teacher.role, isActive: teacher.isActive });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    const res = await apiFetch(`/api/admin/teachers/${teacher.id}`, {
      method: "PUT",
      body: JSON.stringify({ fullName: form.fullName, phone: form.phone || null, role: form.role, isActive: form.isActive }),
    });
    setLoading(false);
    if (res.success) {
      onSuccess();
    } else {
      setErr(res.error?.message ?? "Gagal mengupdate data guru.");
    }
  }

  return (
    <Modal title={`Edit: ${teacher.fullName}`} onClose={onClose}>
      {err && <AlertBox type="error" text={err} />}
      {/* Email readonly */}
      <div style={{ marginBottom: "14px" }}>
        <div style={{ fontSize: "12px", fontWeight: 600, color: T.textSecondary, marginBottom: "6px" }}>Email</div>
        <div style={{ ...inputStyle, display: "flex", alignItems: "center", background: T.bgSubtle, color: T.textSecondary }}>{teacher.email}</div>
      </div>
      <form onSubmit={submit}>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <FormField label="Nama Lengkap *" id="edit-t-fullName">
            <input id="edit-t-fullName" type="text" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required minLength={2} style={inputStyle} />
          </FormField>
          <FormField label="No. HP" id="edit-t-phone">
            <input id="edit-t-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={20} placeholder="Opsional" style={inputStyle} />
          </FormField>
          <FormField label="Role" id="edit-t-role">
            <select id="edit-t-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as any })} style={inputStyle}>
              <option value="TEACHER">Guru</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </FormField>
        </div>
        <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} style={btnSecondaryStyle}>Batal</button>
          <button type="submit" disabled={loading} style={btnPrimaryStyle}>{loading ? "Menyimpan…" : "Simpan"}</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── MODAL: RESET PASSWORD ────────────────────────────────────────────────────

function ResetPasswordModal({ teacher, onClose, onSuccess }: { teacher: TeacherRow; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setMsg({ type: "error", text: "Konfirmasi password tidak cocok." });
      return;
    }
    setLoading(true);
    setMsg(null);
    const res = await apiFetch(`/api/admin/teachers/${teacher.id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ newPassword: form.newPassword }),
    });
    setLoading(false);
    if (res.success) {
      setMsg({ type: "success", text: "Password berhasil direset. Semua sesi aktif guru dihentikan." });
      setTimeout(onSuccess, 2000);
    } else {
      setMsg({ type: "error", text: res.error?.message ?? "Gagal mereset password." });
    }
  }

  return (
    <Modal title={`Reset Password: ${teacher.fullName}`} onClose={onClose}>
      <div style={{ background: T.warningBg, color: T.warning, borderRadius: T.radiusControl, padding: "10px 14px", fontSize: "13px", marginBottom: "16px" }}>
        ⚠️ Guru akan dikeluarkan dari semua sesi aktif setelah password direset.
      </div>
      {msg && <AlertBox type={msg.type} text={msg.text} />}
      <form onSubmit={submit}>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <FormField label="Password baru *" id="reset-newPassword">
            <input id="reset-newPassword" type="password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} required minLength={8} autoComplete="new-password" style={inputStyle} />
          </FormField>
          <FormField label="Konfirmasi password baru *" id="reset-confirmPassword">
            <input id="reset-confirmPassword" type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} required minLength={8} autoComplete="new-password" style={inputStyle} />
          </FormField>
        </div>
        <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} style={btnSecondaryStyle}>Batal</button>
          <button type="submit" disabled={loading} style={{ ...btnPrimaryStyle, background: T.danger }}>{loading ? "Mereset…" : "Reset password"}</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── REUSABLE UI COMPONENTS ───────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: T.bgCard, borderRadius: T.radiusCard, width: "100%", maxWidth: "480px", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: `1px solid ${T.border}` }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: T.textPrimary, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.textSecondary, fontSize: "20px", lineHeight: 1 }} aria-label="Tutup">×</button>
        </div>
        <div style={{ padding: "24px" }}>{children}</div>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: "TEACHER" | "ADMIN" }) {
  return (
    <span style={{
      fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px",
      background: role === "ADMIN" ? T.primaryTint : T.bgSubtle,
      color: role === "ADMIN" ? T.primary : T.textSecondary,
    }}>
      {role === "ADMIN" ? "Admin" : "Guru"}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span style={{
      fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px",
      background: active ? T.successBg : T.dangerBg,
      color: active ? T.success : T.danger,
    }}>
      {active ? "Aktif" : "Nonaktif"}
    </span>
  );
}

function ActionBtn({ label, onClick, danger, disabled }: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "4px 10px", borderRadius: "6px", border: `1px solid ${danger ? T.danger : T.border}`,
        background: "transparent", color: disabled ? T.textSecondary : danger ? T.danger : T.textPrimary,
        fontSize: "12px", fontWeight: 500, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}

function FormField({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} style={{ display: "block", fontSize: "12px", fontWeight: 600, color: T.textSecondary, marginBottom: "6px" }}>{label}</label>
      {children}
    </div>
  );
}

function AlertBox({ type, text }: { type: "success" | "error"; text: string }) {
  const isErr = type === "error";
  return (
    <div style={{
      padding: "10px 14px", borderRadius: T.radiusControl,
      background: isErr ? T.dangerBg : T.successBg,
      color: isErr ? T.danger : T.success,
      fontSize: "13px", fontWeight: 500, marginBottom: "14px",
    }}>
      {text}
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

const btnPrimaryStyle: React.CSSProperties = {
  padding: "9px 20px", borderRadius: T.radiusControl, background: T.primary,
  color: "#fff", fontSize: "13px", fontWeight: 600, border: "none", cursor: "pointer",
};

const btnSecondaryStyle: React.CSSProperties = {
  padding: "9px 20px", borderRadius: T.radiusControl, background: T.bgCard,
  color: T.textPrimary, fontSize: "13px", fontWeight: 600,
  border: `1px solid ${T.border}`, cursor: "pointer",
};

const paginationBtn: React.CSSProperties = {
  padding: "6px 14px", borderRadius: T.radiusControl, border: `1px solid ${T.border}`,
  background: T.bgCard, color: T.textPrimary, fontSize: "13px", cursor: "pointer",
};
