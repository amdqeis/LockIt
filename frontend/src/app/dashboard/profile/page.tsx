"use client";

import { useState } from "react";
import DashboardShell from "@/app/components/DashboardShell";
import { useTeacherAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiClient";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const T = {
  bgPage: "#F6F8FB",
  bgCard: "#FFFFFF",
  bgSubtle: "#F0F3F8",
  border: "#E1E6ED",
  textPrimary: "#172033",
  textSecondary: "#5B6778",
  primary: "#1B76BF",
  success: "#177A4B",
  successBg: "#E7F5EE",
  danger: "#C73E3E",
  dangerBg: "#FCE9E9",
  radiusCard: "12px",
  radiusControl: "8px",
};

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ProfilePage() {
  const { teacher, refreshProfile } = useTeacherAuth();

  // ─── EDIT PROFIL STATE ───────────────────────────────────────────────────
  const [editForm, setEditForm] = useState({ fullName: "", phone: "" });
  const [editMode, setEditMode] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editMsg, setEditMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function openEdit() {
    setEditForm({ fullName: teacher?.fullName ?? "", phone: teacher?.phone ?? "" });
    setEditMode(true);
    setEditMsg(null);
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    setEditLoading(true);
    setEditMsg(null);
    const res = await apiFetch("/api/auth/me/profile", {
      method: "PUT",
      body: JSON.stringify({
        fullName: editForm.fullName || undefined,
        phone: editForm.phone || null,
      }),
    });
    setEditLoading(false);
    if (res.success) {
      setEditMsg({ type: "success", text: "Profil berhasil diperbarui." });
      setEditMode(false);
      await refreshProfile();
    } else {
      setEditMsg({ type: "error", text: res.error?.message ?? "Gagal memperbarui profil." });
    }
  }

  // ─── GANTI PASSWORD STATE ────────────────────────────────────────────────
  const [passForm, setPassForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passLoading, setPassLoading] = useState(false);
  const [passMsg, setPassMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (passForm.newPassword !== passForm.confirmPassword) {
      setPassMsg({ type: "error", text: "Konfirmasi password tidak cocok." });
      return;
    }
    setPassLoading(true);
    setPassMsg(null);
    const res = await apiFetch("/api/auth/me/profile", {
      method: "PUT",
      body: JSON.stringify({
        currentPassword: passForm.currentPassword,
        newPassword: passForm.newPassword,
      }),
    });
    setPassLoading(false);
    if (res.success) {
      setPassMsg({ type: "success", text: "Password berhasil diubah." });
      setPassForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } else {
      setPassMsg({ type: "error", text: res.error?.message ?? "Gagal mengubah password." });
    }
  }

  return (
    <DashboardShell>
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: T.textPrimary, margin: "0 0 24px" }}>
          Profil Saya
        </h1>

        {/* ─── INFO KARTU ───────────────────────────────────────────────── */}
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radiusCard, padding: "24px", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
            {/* Avatar */}
            <div style={{
              width: "56px", height: "56px", borderRadius: "12px",
              background: T.primary, display: "flex", alignItems: "center",
              justifyContent: "center", color: "#fff", fontSize: "20px",
              fontWeight: 700, flexShrink: 0,
            }}>
              {(teacher?.fullName ?? "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "18px", fontWeight: 700, color: T.textPrimary }}>{teacher?.fullName}</span>
                {/* Role badge */}
                <span style={{
                  fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px",
                  background: teacher?.role === "ADMIN" ? T.primary : T.bgSubtle,
                  color: teacher?.role === "ADMIN" ? "#fff" : T.textSecondary,
                  letterSpacing: "0.05em",
                }}>
                  {teacher?.role === "ADMIN" ? "ADMIN" : "GURU"}
                </span>
                {/* Status badge */}
                <span style={{
                  fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px",
                  background: teacher?.isActive ? T.successBg : T.dangerBg,
                  color: teacher?.isActive ? T.success : T.danger,
                }}>
                  {teacher?.isActive ? "Aktif" : "Nonaktif"}
                </span>
              </div>

              <div style={{ marginTop: "8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px" }}>
                <InfoRow label="Email" value={teacher?.email} />
                <InfoRow label="No. HP" value={teacher?.phone ?? "—"} />
                <InfoRow label="Bergabung" value={formatDate(teacher?.createdAt)} />
                <InfoRow label="Login terakhir" value={formatDate(teacher?.lastLoginAt)} />
              </div>
            </div>

            {!editMode && (
              <button
                id="btn-edit-profile"
                onClick={openEdit}
                style={{
                  padding: "8px 16px", borderRadius: T.radiusControl, border: `1px solid ${T.border}`,
                  background: T.bgCard, color: T.textPrimary, fontSize: "13px", fontWeight: 600,
                  cursor: "pointer", flexShrink: 0,
                }}
              >
                Edit profil
              </button>
            )}
          </div>

          {/* Edit inline form */}
          {editMode && (
            <form onSubmit={submitEdit} style={{ marginTop: "20px", paddingTop: "20px", borderTop: `1px solid ${T.border}` }}>
              {editMsg && <AlertBox type={editMsg.type} text={editMsg.text} />}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <FormField label="Nama Lengkap" id="edit-fullName">
                  <input
                    id="edit-fullName"
                    type="text"
                    value={editForm.fullName}
                    onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                    required
                    minLength={2}
                    style={inputStyle}
                  />
                </FormField>
                <FormField label="No. HP" id="edit-phone">
                  <input
                    id="edit-phone"
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    maxLength={20}
                    placeholder="Opsional"
                    style={inputStyle}
                  />
                </FormField>
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "16px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => { setEditMode(false); setEditMsg(null); }} style={btnSecondaryStyle}>Batal</button>
                <button type="submit" disabled={editLoading} style={btnPrimaryStyle}>
                  {editLoading ? "Menyimpan…" : "Simpan"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ─── GANTI PASSWORD ──────────────────────────────────────────────── */}
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radiusCard, padding: "24px" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 700, color: T.textPrimary, margin: "0 0 16px" }}>
            Ganti Password
          </h2>
          {passMsg && <AlertBox type={passMsg.type} text={passMsg.text} />}
          <form onSubmit={submitPassword}>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", maxWidth: "360px" }}>
              <FormField label="Password saat ini" id="pass-current">
                <input
                  id="pass-current"
                  type="password"
                  value={passForm.currentPassword}
                  onChange={(e) => setPassForm({ ...passForm, currentPassword: e.target.value })}
                  required
                  autoComplete="current-password"
                  style={inputStyle}
                />
              </FormField>
              <FormField label="Password baru" id="pass-new">
                <input
                  id="pass-new"
                  type="password"
                  value={passForm.newPassword}
                  onChange={(e) => setPassForm({ ...passForm, newPassword: e.target.value })}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  style={inputStyle}
                />
              </FormField>
              <FormField label="Konfirmasi password baru" id="pass-confirm">
                <input
                  id="pass-confirm"
                  type="password"
                  value={passForm.confirmPassword}
                  onChange={(e) => setPassForm({ ...passForm, confirmPassword: e.target.value })}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  style={inputStyle}
                />
              </FormField>
            </div>
            <button type="submit" disabled={passLoading} style={{ ...btnPrimaryStyle, marginTop: "16px" }}>
              {passLoading ? "Mengubah…" : "Ubah password"}
            </button>
          </form>
        </div>
      </div>
    </DashboardShell>
  );
}

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div style={{ fontSize: "11px", color: T.textSecondary, marginBottom: "1px" }}>{label}</div>
      <div style={{ fontSize: "13px", color: T.textPrimary, fontWeight: 500 }}>{value ?? "—"}</div>
    </div>
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
      padding: "10px 14px",
      borderRadius: T.radiusControl,
      background: isErr ? T.dangerBg : T.successBg,
      color: isErr ? T.danger : T.success,
      fontSize: "13px",
      fontWeight: 500,
      marginBottom: "14px",
    }}>
      {text}
    </div>
  );
}

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%",
  height: "40px",
  padding: "0 12px",
  border: `1px solid ${T.border}`,
  borderRadius: T.radiusControl,
  fontSize: "14px",
  color: T.textPrimary,
  background: T.bgCard,
  outline: "none",
  boxSizing: "border-box",
};

const btnPrimaryStyle: React.CSSProperties = {
  padding: "9px 20px",
  borderRadius: T.radiusControl,
  background: T.primary,
  color: "#fff",
  fontSize: "13px",
  fontWeight: 600,
  border: "none",
  cursor: "pointer",
};

const btnSecondaryStyle: React.CSSProperties = {
  padding: "9px 20px",
  borderRadius: T.radiusControl,
  background: T.bgCard,
  color: T.textPrimary,
  fontSize: "13px",
  fontWeight: 600,
  border: `1px solid ${T.border}`,
  cursor: "pointer",
};
