"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { staffApi, staffSend } from "@/lib/staff-api";
import { Dialog } from "@/components/Dialog";
import { MotionButton } from "@/components/MotionButton";
import { ErrorText, Icon, message } from "./Dashboard";

type BackupManifest = {
  version: number;
  schemaVersion: string;
  createdAt: string;
  creatorId: string;
  counts: Record<string, number>;
  includesMedia: boolean;
  checksumSha256: string;
};

type BackupItem = {
  filename: string;
  size: number;
  createdAt: string;
  manifest: BackupManifest | null;
};

type JobStatus = {
  id: string;
  type: "backup" | "restore";
  status: "idle" | "in_progress" | "completed" | "failed";
  stage: string;
  progressPercent: number;
  error?: string | null;
  startedAt?: string;
  completedAt?: string;
};

type UploadResult = {
  uploadId: string;
  originalName: string;
  size: number;
  manifest: BackupManifest;
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatStage(stage: string): string {
  const stageMap: Record<string, string> = {
    starting: "Memulai proses...",
    checking_active_exams: "Memeriksa ujian aktif...",
    waiting_active_writes: "Menunggu transaksi berjalan selesai...",
    dumping_database: "Mengekspor basis data (pg_dump)...",
    copying_media: "Mengarsipkan berkas media...",
    creating_archive: "Membuat berkas arsip (tar.gz)...",
    verifying_archive: "Memvalidasi integritas arsip...",
    stopping_writes: "Mengaktifkan mode pemeliharaan...",
    creating_safety_snapshot: "Membuat snapshot cadangan darurat...",
    restoring_database: "Memulihkan basis data (pg_restore)...",
    swapping_media: "Memperbarui berkas media...",
    invalidating_sessions: "Membatalkan seluruh sesi aktif...",
    completed: "Proses selesai.",
    failed: "Proses gagal.",
  };
  return stageMap[stage] || stage;
}

export function BackupRestore() {
  const router = useRouter();
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [currentJob, setCurrentJob] = useState<JobStatus | null>(null);
  const [jobToken, setJobToken] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successNotice, setSuccessNotice] = useState("");

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadedBackup, setUploadedBackup] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore confirmation modal
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [targetRestore, setTargetRestore] = useState<{
    type: "saved" | "upload";
    identifier: string;
    label: string;
    manifest: BackupManifest | null;
  } | null>(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);

  const loadBackups = useCallback(async () => {
    try {
      const data = await staffApi<{ backups: BackupItem[]; currentJob: JobStatus | null }>("/api/admin/backups");
      setBackups(data.backups);
      if (data.currentJob && data.currentJob.status === "in_progress") {
        setCurrentJob(data.currentJob);
      }
    } catch (err) {
      setError(message(err));
    }
  }, []);

  useEffect(() => {
    let active = true;
    staffApi<{ backups: BackupItem[]; currentJob: JobStatus | null }>("/api/admin/backups")
      .then((data) => {
        if (!active) return;
        setBackups(data.backups);
        if (data.currentJob && data.currentJob.status === "in_progress") {
          setCurrentJob(data.currentJob);
        }
      })
      .catch((err) => {
        if (active) setError(message(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  // Polling active job
  useEffect(() => {
    if (!currentJob || currentJob.status !== "in_progress") return;

    const timer = setInterval(async () => {
      try {
        const query = jobToken ? `?jobId=${encodeURIComponent(currentJob.id)}&token=${encodeURIComponent(jobToken)}` : `?jobId=${encodeURIComponent(currentJob.id)}`;
        const statusData = await staffApi<JobStatus>(`/api/admin/backups/job-status${query}`);
        setCurrentJob(statusData);

        if (statusData.status === "completed") {
          setSuccessNotice(
            statusData.type === "backup"
              ? "Backup berhasil dibuat."
              : "Pemulihan data berhasil diselesaikan. Mengalihkan ke halaman login..."
          );
          if (statusData.type === "restore") {
            setTimeout(() => {
              router.replace("/login");
            }, 2500);
          } else {
            void loadBackups();
          }
        } else if (statusData.status === "failed") {
          setError(`Operasi ${statusData.type} gagal: ${statusData.error || "Terjadi kesalahan internal"}`);
        }
      } catch {
        // Polling retry
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [currentJob, jobToken, router, loadBackups]);

  // Trigger new backup
  async function handleStartBackup() {
    setError("");
    setSuccessNotice("");
    try {
      const res = await staffSend<{ jobId: string; token: string }>("/api/admin/backups", "POST", {});
      setJobToken(res.token);
      setCurrentJob({
        id: res.jobId,
        type: "backup",
        status: "in_progress",
        stage: "starting",
        progressPercent: 5,
      });
    } catch (err) {
      setError(message(err));
    }
  }

  // Handle file upload
  async function handleUploadArchive(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) return;

    setError("");
    setUploadBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);

      const res = await fetch("/api/admin/backups/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Gagal mengunggah berkas backup.");
      }

      setUploadedBackup(json.data);
      setSuccessNotice(`Berkas "${uploadFile.name}" berhasil diunggah dan diverifikasi.`);
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(message(err));
    } finally {
      setUploadBusy(false);
    }
  }

  // Open Restore Confirmation
  function openRestoreModal(type: "saved" | "upload", identifier: string, label: string, manifest: BackupManifest | null) {
    setTargetRestore({ type, identifier, label, manifest });
    setAdminPassword("");
    setAcknowledged(false);
    setError("");
    setRestoreModalOpen(true);
  }

  // Submit Restore
  async function handleConfirmRestore(e: React.FormEvent) {
    e.preventDefault();
    if (!targetRestore || !adminPassword || !acknowledged) return;

    setError("");
    setRestoreBusy(true);
    try {
      const res = await staffSend<{ jobId: string; token: string }>("/api/admin/backups/restore", "POST", {
        type: targetRestore.type,
        identifier: targetRestore.identifier,
        password: adminPassword,
      });

      setRestoreModalOpen(false);
      setJobToken(res.token);
      setCurrentJob({
        id: res.jobId,
        type: "restore",
        status: "in_progress",
        stage: "stopping_writes",
        progressPercent: 10,
      });
    } catch (err) {
      setError(message(err));
    } finally {
      setRestoreBusy(false);
    }
  }

  return (
    <div className="backup-restore-page">
      <div className="backup-header">
        <div>
          <h2>Backup & Restore</h2>
          <p className="backup-desc">
            Cadangkan seluruh data sistem (database dan media) secara manual atau pulihkan data dari berkas arsip resmi.
          </p>
        </div>
        <div>
          <MotionButton
            className="staff-primary"
            disabled={currentJob?.status === "in_progress"}
            onClick={handleStartBackup}
          >
            <Icon name="archive" size={14} /> Buat Backup Baru
          </MotionButton>
        </div>
      </div>

      <ErrorText error={error} />
      {successNotice && (
        <div className="staff-success-notice" role="status">
          <span>{successNotice}</span>
          <button type="button" onClick={() => setSuccessNotice("")} aria-label="Tutup notifikasi">
            ✕
          </button>
        </div>
      )}

      {/* Progress banner if job is active */}
      {currentJob && currentJob.status === "in_progress" && (
        <div className="backup-progress-card" role="region" aria-label="Status Pekerjaan Berjalan">
          <div className="progress-card-head">
            <strong>
              {currentJob.type === "backup" ? "Pembuatan Backup Sedang Berjalan" : "Pemulihan Sistem Sedang Berjalan"}
            </strong>
            <span>{currentJob.progressPercent}%</span>
          </div>
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${Math.max(5, currentJob.progressPercent)}%` }}
            />
          </div>
          <p className="progress-stage-text">{formatStage(currentJob.stage)}</p>
          {currentJob.type === "restore" && (
            <p className="progress-warning">
              Mode pemeliharaan aktif. Jangan mematikan server saat proses pemulihan berlangsung.
            </p>
          )}
        </div>
      )}

      {/* Upload Box */}
      <section className="backup-upload-box" aria-labelledby="upload-section-title">
        <h3 id="upload-section-title">Unggah Berkas Backup Eksternal</h3>
        <p>Unggah berkas arsip (.tar.gz) maksimal 1 GiB untuk dipulihkan ke sistem.</p>
        <form onSubmit={handleUploadArchive} className="backup-upload-form">
          <input
            ref={fileInputRef}
            type="file"
            accept=".tar.gz,application/gzip,application/x-gzip"
            className="staff-file-input"
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
          />
          <button
            type="submit"
            className="staff-secondary"
            disabled={!uploadFile || uploadBusy || currentJob?.status === "in_progress"}
          >
            {uploadBusy ? "Mengunggah & Memvalidasi..." : "Unggah Berkas"}
          </button>
        </form>

        {uploadedBackup && (
          <div className="uploaded-preview-card">
            <div className="uploaded-preview-meta">
              <strong>{uploadedBackup.originalName}</strong>
              <span>{formatBytes(uploadedBackup.size)}</span>
              <span>Dibuat: {new Date(uploadedBackup.manifest.createdAt).toLocaleString("id-ID")}</span>
            </div>
            <div className="uploaded-preview-actions">
              <button
                type="button"
                className="staff-primary-outline"
                onClick={() =>
                  openRestoreModal(
                    "upload",
                    uploadedBackup.uploadId,
                    uploadedBackup.originalName,
                    uploadedBackup.manifest
                  )
                }
              >
                Pulihkan dari Berkas Ini
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Backup Archives List */}
      <section className="backup-list-section" aria-labelledby="backup-list-title">
        <h3 id="backup-list-title">Daftar Backup Tersimpan</h3>
        <div className="backup-items-list">
          {backups.map((b) => (
            <div key={b.filename} className="backup-item-card">
              <div className="backup-item-main">
                <div className="backup-item-title">
                  <strong>{b.filename}</strong>
                  <span className="backup-badge">{formatBytes(b.size)}</span>
                </div>
                <div className="backup-item-meta">
                  <span>Dibuat: {new Date(b.createdAt).toLocaleString("id-ID")}</span>
                  {b.manifest && (
                    <>
                      <span>·</span>
                      <span>
                        {b.manifest.counts ? `${Object.values(b.manifest.counts).reduce((a, c) => a + c, 0)} baris data` : "Data valid"}
                      </span>
                      <span>·</span>
                      <span>Skema: {b.manifest.schemaVersion.slice(0, 8)}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="backup-item-actions">
                <a
                  href={`/api/admin/backups/${encodeURIComponent(b.filename)}/download`}
                  download
                  className="action-link"
                >
                  Unduh
                </a>
                <button
                  type="button"
                  className="action-link danger"
                  disabled={currentJob?.status === "in_progress"}
                  onClick={() => openRestoreModal("saved", b.filename, b.filename, b.manifest)}
                >
                  Restore
                </button>
              </div>
            </div>
          ))}
          {backups.length === 0 && !loading && (
            <div className="backup-empty-state">
              <p>Belum ada arsip backup tersimpan.</p>
            </div>
          )}
        </div>
      </section>

      {/* Restore Confirmation Modal */}
      <Dialog
        open={restoreModalOpen}
        onClose={() => {
          if (!restoreBusy) setRestoreModalOpen(false);
        }}
        title="Konfirmasi Pemulihan Data (Restore)"
      >
        <form onSubmit={handleConfirmRestore} className="restore-confirm-form">
          <div className="restore-danger-box">
            <strong>PERINGATAN RISIKO TINGGI:</strong>
            <ul>
              <li>Seluruh data sistem saat ini akan digantikan sepenuhnya oleh data dari arsip.</li>
              <li>Seluruh sesi aktif pengawas, guru, dan peserta akan dibatalkan seketika.</li>
              <li>Jika ada ujian yang sedang berlangsung, ujian tersebut akan terhenti.</li>
            </ul>
          </div>

          <div className="restore-target-info">
            <p>
              Target Arsip: <strong>{targetRestore?.label}</strong>
            </p>
            {targetRestore?.manifest && (
              <small>
                Waktu cadangan: {new Date(targetRestore.manifest.createdAt).toLocaleString("id-ID")}
              </small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="admin-restore-pass">
              Masukkan Password Administrator untuk Konfirmasi:
            </label>
            <input
              id="admin-restore-pass"
              type="password"
              className="staff-input"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Password akun Anda saat ini"
              required
              disabled={restoreBusy}
              autoFocus
            />
          </div>

          <div className="form-checkbox-row">
            <input
              id="ack-checkbox"
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              required
              disabled={restoreBusy}
            />
            <label htmlFor="ack-checkbox">
              Saya memahami bahwa tindakan restore ini akan menggantikan seluruh basis data sistem.
            </label>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="staff-secondary"
              disabled={restoreBusy}
              onClick={() => setRestoreModalOpen(false)}
            >
              Batal
            </button>
            <button
              type="submit"
              className="staff-danger-btn"
              disabled={!acknowledged || !adminPassword || restoreBusy}
            >
              {restoreBusy ? "Memulai Pemulihan..." : "Konfirmasi & Mulai Restore"}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
