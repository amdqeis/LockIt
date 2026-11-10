"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { staffApi, staffSend } from "@/lib/staff-api";
import { queryCache } from "@/lib/data-cache";
import { Dialog } from "@/components/Dialog";
import { MotionButton } from "@/components/MotionButton";
import { ErrorText, Icon, message } from "./Dashboard";
import { HierarchyBreadcrumb, HierarchyCard, useHierarchyNavigation } from "./HierarchyNavigation";

type GradeLevel = {
  id: string;
  name: string;
  normalizedName: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { classrooms: number; subjects: number };
};

type Classroom = {
  id: string;
  gradeLevelId: string;
  name: string;
  normalizedName: string;
  isArchived: boolean;
  gradeLevel?: { id: string; name: string };
  _count?: { exams: number };
};

type Subject = {
  id: string;
  gradeLevelId: string | null;
  name: string;
  normalizedName: string;
  isArchived: boolean;
  gradeLevel?: { id: string; name: string } | null;
  _count?: { banks: number; exams: number };
};

type LegacyMappingReport = {
  summary: {
    unmappedSubjectsCount: number;
    unmappedExamsCount: number;
    unmappedBanksCount: number;
    totalUnmapped: number;
  };
  unmappedSubjects: Array<{ id: string; name: string; _count: { banks: number; exams: number } }>;
  unmappedExams: Array<{
    id: string;
    title: string;
    status: string;
    className: string | null;
    subjectName: string | null;
    classroomId: string | null;
    subjectId: string | null;
    revision: number;
  }>;
  availableGradeLevels: Array<{ id: string; name: string }>;
  availableClassrooms: Array<{ id: string; name: string; gradeLevelId: string }>;
  availableSubjects: Array<{ id: string; name: string; gradeLevelId: string | null; gradeLevel: { id: string; name: string } | null }>;
};

type Props = {
  teacherRole?: "ADMIN" | "TEACHER";
};

export function AcademicManagement({ teacherRole }: Props = {}) {
  void teacherRole;
  const reduceMotion = useReducedMotion();
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const { selectedGradeId, selectedClassroomId, setSelectedGradeId, setSelectedClassroomId } = useHierarchyNavigation();
  const selectedGradeRef = useRef(selectedGradeId);
  const [loadedGradeId, setLoadedGradeId] = useState("");
  const [gradeLoadError, setGradeLoadError] = useState("");
  const [gradeLoadVersion, setGradeLoadVersion] = useState(0);
  const [legacyOpen, setLegacyOpen] = useState(false);

  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [legacyReport, setLegacyReport] = useState<LegacyMappingReport | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successNotice, setSuccessNotice] = useState("");

  // Dialogs
  const [gradeModalOpen, setGradeModalOpen] = useState(false);
  const [gradeNameInput, setGradeNameInput] = useState("");
  const [editingGrade, setEditingGrade] = useState<GradeLevel | null>(null);

  const [classroomModalOpen, setClassroomModalOpen] = useState(false);
  const [classroomNameInput, setClassroomNameInput] = useState("");
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null);

  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [subjectNameInput, setSubjectNameInput] = useState("");
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectError, setSubjectError] = useState("");
  const [subjectBusy, setSubjectBusy] = useState(false);

  const [mappingBusy, setMappingBusy] = useState(false);

  const loadGradeLevels = useCallback(async () => {
    try {
      const data = await staffApi<GradeLevel[]>("/api/academic/grade-levels");
      setGradeLevels(data);
    } catch (err) {
      setError(message(err));
    }
  }, []);

  const loadClassrooms = useCallback(async (gradeId: string) => {
    if (!gradeId) return;
    try {
      const data = await staffApi<Classroom[]>(`/api/academic/classrooms?gradeLevelId=${encodeURIComponent(gradeId)}&includeArchived=true`);
      if (selectedGradeRef.current === gradeId) setClassrooms(data);
    } catch (err) {
      setError(message(err));
    }
  }, []);

  const loadSubjects = useCallback(async (gradeId: string) => {
    if (!gradeId) return;
    try {
      const data = await staffApi<Subject[]>(`/api/subjects?gradeLevelId=${encodeURIComponent(gradeId)}&includeArchived=true`);
      if (selectedGradeRef.current === gradeId) setSubjects(data);
    } catch (err) {
      setError(message(err));
    }
  }, []);

  const loadLegacyReport = useCallback(async () => {
    try {
      const data = await staffApi<LegacyMappingReport>("/api/academic/legacy-mapping");
      setLegacyReport(data);
    } catch (err) {
      setError(message(err));
    }
  }, []);

  useEffect(() => {
    let active = true;
    staffApi<GradeLevel[]>("/api/academic/grade-levels")
      .then((data) => {
        if (!active) return;
        setGradeLevels(data);
      })
      .catch((err) => {
        if (active) setError(message(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedGradeId) return;
    selectedGradeRef.current = selectedGradeId;
    let active = true;
    Promise.all([
      staffApi<Classroom[]>(`/api/academic/classrooms?gradeLevelId=${encodeURIComponent(selectedGradeId)}&includeArchived=true`),
      staffApi<Subject[]>(`/api/subjects?gradeLevelId=${encodeURIComponent(selectedGradeId)}&includeArchived=true`),
    ])
      .then(([cls, subs]) => {
        if (!active) return;
        setClassrooms(cls);
        setSubjects(subs);
        setGradeLoadError("");
        setLoadedGradeId(selectedGradeId);
      })
      .catch((err) => {
        if (active) { setClassrooms([]); setSubjects([]); setGradeLoadError(message(err)); setLoadedGradeId(selectedGradeId); }
      });
    return () => { active = false; };
  }, [selectedGradeId, gradeLoadVersion]);

  useEffect(() => {
    if (!legacyOpen) return;
    let active = true;
    staffApi<LegacyMappingReport>("/api/academic/legacy-mapping")
      .then((data) => {
        if (active) setLegacyReport(data);
      })
      .catch((err) => {
        if (active) setError(message(err));
      });
    return () => { active = false; };
  }, [legacyOpen]);

  const selectedGrade = gradeLevels.find(g => g.id === selectedGradeId);
  const selectedClassroom = classrooms.find(c => c.id === selectedClassroomId);
  const gradeContentLoading = !!selectedGradeId && loadedGradeId !== selectedGradeId;

  // Grade CRUD
  async function handleSaveGrade(e: React.FormEvent) {
    e.preventDefault();
    if (!gradeNameInput.trim()) return;
    setError("");
    try {
      if (editingGrade) {
        await staffSend(`/api/academic/grade-levels/${editingGrade.id}`, "PUT", { name: gradeNameInput.trim() });
        setSuccessNotice(`Tingkat "${gradeNameInput.trim()}" berhasil diperbarui.`);
      } else {
        const created = await staffSend<GradeLevel>("/api/academic/grade-levels", "POST", { name: gradeNameInput.trim() });
        setSuccessNotice(`Tingkat "${gradeNameInput.trim()}" berhasil dibuat.`);
        selectedGradeRef.current = created.id;
        setSelectedGradeId(created.id);
        setSubjectError("");
      }
      setGradeModalOpen(false);
      setGradeNameInput("");
      setEditingGrade(null);
      await loadGradeLevels();
    } catch (err) {
      setError(message(err));
    }
  }

  // Classroom CRUD
  async function handleSaveClassroom(e: React.FormEvent) {
    e.preventDefault();
    if (!classroomNameInput.trim() || !selectedGradeId) return;
    setError("");
    try {
      if (editingClassroom) {
        await staffSend(`/api/academic/classrooms/${editingClassroom.id}`, "PUT", { name: classroomNameInput.trim() });
        setSuccessNotice(`Kelas "${classroomNameInput.trim()}" berhasil diperbarui.`);
      } else {
        await staffSend("/api/academic/classrooms", "POST", {
          gradeLevelId: selectedGradeId,
          name: classroomNameInput.trim(),
        });
        setSuccessNotice(`Kelas "${classroomNameInput.trim()}" berhasil ditambahkan.`);
      }
      setClassroomModalOpen(false);
      setClassroomNameInput("");
      setEditingClassroom(null);
      await loadClassrooms(selectedGradeId);
    } catch (err) {
      setError(message(err));
    }
  }

  async function handleArchiveClassroom(classroom: Classroom) {
    setError("");
    try {
      await staffSend(`/api/academic/classrooms/${classroom.id}`, "PUT", { isArchived: !classroom.isArchived });
      setSuccessNotice(`Kelas "${classroom.name}" berhasil ${classroom.isArchived ? "dipulihkan" : "diarsipkan"}.`);
      if (selectedGradeId) await loadClassrooms(selectedGradeId);
    } catch (err) {
      setError(message(err));
    }
  }

  // Subject CRUD (Create & Edit in Modal)
  async function handleSaveSubject(e: React.FormEvent) {
    e.preventDefault();
    const name = subjectNameInput.trim();
    if (!name || !selectedGradeId || subjectBusy) return;
    setSubjectBusy(true);
    setSubjectError("");
    try {
      if (editingSubject) {
        await staffSend(`/api/subjects/${editingSubject.id}`, "PUT", { name });
        setSuccessNotice(`Mata pelajaran "${name}" berhasil diperbarui.`);
      } else {
        await staffSend("/api/subjects", "POST", { name, gradeLevelId: selectedGradeId });
        setSuccessNotice(`Mata pelajaran "${name}" tersimpan di ${selectedGrade?.name}.`);
      }
      queryCache.invalidate("/api/subjects");
      setSubjectModalOpen(false);
      setSubjectNameInput("");
      setEditingSubject(null);
      await loadSubjects(selectedGradeId);
    } catch (err) {
      setSubjectError(message(err));
    } finally {
      setSubjectBusy(false);
    }
  }

  function handleOpenCreateSubject() {
    setEditingSubject(null);
    setSubjectNameInput("");
    setSubjectError("");
    setSubjectModalOpen(true);
  }

  function handleOpenEditSubject(sub: Subject) {
    setEditingSubject(sub);
    setSubjectNameInput(sub.name);
    setSubjectError("");
    setSubjectModalOpen(true);
  }

  function handleOpenCreateClassroom() {
    setEditingClassroom(null);
    setClassroomNameInput("");
    setClassroomModalOpen(true);
  }

  function handleOpenEditClassroom(cls: Classroom) {
    setEditingClassroom(cls);
    setClassroomNameInput(cls.name);
    setClassroomModalOpen(true);
  }

  async function handleArchiveSubject(subject: Subject) {
    setError("");
    try {
      await staffSend(`/api/subjects/${subject.id}`, "PUT", { isArchived: !subject.isArchived });
      queryCache.invalidate("/api/subjects");
      setSuccessNotice(`Mata pelajaran "${subject.name}" berhasil ${subject.isArchived ? "dipulihkan" : "diarsipkan"}.`);
      if (selectedGradeId) await loadSubjects(selectedGradeId);
    } catch (err) {
      setError(message(err));
    }
  }

  // Legacy Mapping Actions
  async function handleAutoMap() {
    setMappingBusy(true);
    setError("");
    try {
      const res = await staffSend<{ mappedSubjects: number; mappedExams: number; totalMapped: number }>("/api/academic/legacy-mapping", "POST", {
        action: "autoMapUnambiguous",
      });
      setSuccessNotice(`Pemetaan otomatis selesai: ${res.mappedSubjects} mata pelajaran dan ${res.mappedExams} ujian berhasil dipetakan.`);
      await loadLegacyReport();
      if (selectedGradeId) {
        await loadClassrooms(selectedGradeId);
        await loadSubjects(selectedGradeId);
      }
    } catch (err) {
      setError(message(err));
    } finally {
      setMappingBusy(false);
    }
  }

  async function handleMapSubject(subjectId: string, targetGradeId: string) {
    if (!targetGradeId) return;
    setMappingBusy(true);
    setError("");
    try {
      await staffSend("/api/academic/legacy-mapping", "POST", {
        action: "mapSubject",
        subjectId,
        gradeLevelId: targetGradeId,
      });
      setSuccessNotice("Mata pelajaran berhasil dipetakan ke tingkat.");
      await loadLegacyReport();
      if (selectedGradeId) await loadSubjects(selectedGradeId);
    } catch (err) {
      setError(message(err));
    } finally {
      setMappingBusy(false);
    }
  }

  async function handleMapExam(examId: string, revision: number, targetClassroomId: string, targetSubjectId: string) {
    if (!targetClassroomId || !targetSubjectId) return;
    setMappingBusy(true);
    setError("");
    try {
      await staffSend("/api/academic/legacy-mapping", "POST", {
        action: "mapExam",
        examId,
        revision,
        classroomId: targetClassroomId,
        subjectId: targetSubjectId,
      });
      setSuccessNotice("Ujian berhasil dipetakan ke kelas dan mata pelajaran.");
      await loadLegacyReport();
      if (selectedGradeId) await loadClassrooms(selectedGradeId);
    } catch (err) {
      setError(message(err));
    } finally {
      setMappingBusy(false);
    }
  }

  return (
    <div className="academic-management">
      <div className="academic-header">
        <div>
          <h2>Kelas & Mata Pelajaran</h2>
          <p className="academic-desc">
            Kelola master tingkat, kelas, dan mata pelajaran sebagai acuan ujian dan bank soal.
          </p>
        </div>
      </div>

      <ErrorText error={error} />
      <HierarchyBreadcrumb grade={selectedGrade?.name} classroom={selectedClassroom?.name} onRoot={() => setSelectedGradeId(null)} onGrade={() => setSelectedClassroomId(null)} />
      {successNotice && (
        <div className="staff-success-notice" role="status">
          <span>{successNotice}</span>
          <button type="button" onClick={() => setSuccessNotice("")} aria-label="Tutup notifikasi">
            ✕
          </button>
        </div>
      )}

      {!selectedGradeId ? (
        /* TAHAP 1: PILIHAN TINGKATAN (STYLE OVERVIEW CARDS) */
        <div style={{ marginTop: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div>
              <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>Pilihan Tingkat</h3>
              <p style={{ fontSize: "12px", color: "var(--staff-muted)", margin: "2px 0 0" }}>
                Pilih tingkatan untuk mengelola daftar kelas dan mata pelajaran.
              </p>
            </div>
            <MotionButton
              className="staff-primary"
              onClick={() => {
                setEditingGrade(null);
                setGradeNameInput("");
                setGradeModalOpen(true);
              }}
            >
              <Icon name="plus" size={14} /> Tambah Tingkat
            </MotionButton>
          </div>

          <div className="drilldown-grid">
            {gradeLevels.map((gl, index) => <HierarchyCard key={gl.id} index={index} name={`Tingkat ${gl.name}`} count={`${gl._count?.classrooms ?? 0} kelas`} detail={`${gl._count?.subjects ?? 0} mata pelajaran`} onClick={() => { selectedGradeRef.current = gl.id; setSelectedGradeId(gl.id); setSubjectError(""); setGradeLoadError(""); setSuccessNotice(""); }} />)}
          </div>
          {gradeLevels.length === 0 && !loading && (
            <div className="staff-empty">
              <h3>Belum ada tingkatan</h3>
              <p>Tambahkan tingkat pertama Anda untuk mulai mengatur kelas dan mata pelajaran.</p>
            </div>
          )}
        </div>
      ) : (
        /* TAHAP 2: HEADER BANNER KELAS & MAPEL DI TINGKAT TERPILIH */
        <div className="class-detail-banner" style={{ marginTop: "10px" }}>
          <div className="class-detail-info">
            <h3>Tingkat {selectedGrade?.name}</h3>
            <p>Kelola kelas dan mata pelajaran terdaftar pada tingkat ini.</p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <MotionButton
              className="staff-secondary"
              onClick={() => {
                setEditingGrade(selectedGrade || null);
                setGradeNameInput(selectedGrade?.name || "");
                setGradeModalOpen(true);
              }}
              title="Ubah nama tingkat"
            >
              <Icon name="pencil" size={13} /> Ubah Nama Tingkat
            </MotionButton>
            <MotionButton
              className="staff-secondary"
              onClick={() => setSelectedGradeId("")}
            >
              ← Kembali ke Pilihan Tingkat
            </MotionButton>
          </div>
        </div>
      )}

      {gradeContentLoading ? (
        <div className="academic-loading-screen" role="status" aria-busy="true">
          <div className="loading-spinner-ring" />
          <div className="academic-skeleton-grid">
            <div className="academic-skeleton-card" />
            <div className="academic-skeleton-card" />
          </div>
        </div>
      ) : gradeLoadError ? (
        <p className="staff-error" role="alert">
          {gradeLoadError}{" "}
          <button
            className="action-link"
            type="button"
            onClick={() => {
              setLoadedGradeId("");
              setGradeLoadError("");
              setGradeLoadVersion((version) => version + 1);
            }}
          >
            Coba lagi
          </button>
        </p>
      ) : selectedGrade && !selectedClassroomId ? (
        <section className="hierarchy-class-section">
          <div className="staff-section-head"><div><h3>Pilih kelas</h3><p>Pilih kelas untuk mengelola mata pelajaran tingkat ini.</p></div>
            <div className="hierarchy-actions"><MotionButton className="staff-secondary" onClick={handleOpenCreateSubject}><Icon name="plus" size={14} /> Tambah Mata Pelajaran</MotionButton>
            <MotionButton className="staff-primary" onClick={handleOpenCreateClassroom}><Icon name="plus" size={14} /> Tambah Kelas</MotionButton></div>
          </div>
          <div className="drilldown-grid">
            {classrooms.map((c, index) => <HierarchyCard key={c.id} index={index} name={c.name} count={`${c._count?.exams ?? 0} ujian`} detail={c.isArchived ? "Kelas diarsipkan" : "Kelola kelas dan mapel"} onClick={() => setSelectedClassroomId(c.id)} />)}
          </div>
          {!classrooms.length && <p className="staff-empty">Belum ada kelas pada tingkat ini. Tambahkan kelas untuk melanjutkan.</p>}
        </section>
      ) : selectedGrade ? (
        <motion.div
          key={selectedGradeId}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          {/* Quick Stats Metric Cards (Overview style) */}
          <div className="academic-overview-stats">
            <div className="academic-stat-card">
              <span className="academic-stat-label">Total Kelas</span>
              <span className="academic-stat-value">{classrooms.filter((c) => !c.isArchived).length}</span>
              <span className="academic-stat-sub">kelas aktif di {selectedGrade.name}</span>
            </div>
            <div className="academic-stat-card">
              <span className="academic-stat-label">Mata Pelajaran</span>
              <span className="academic-stat-value">{subjects.filter((s) => !s.isArchived).length}</span>
              <span className="academic-stat-sub">mata pelajaran terdaftar</span>
            </div>
            <div className="academic-stat-card">
              <span className="academic-stat-label">Bank Soal</span>
              <span className="academic-stat-value">
                {subjects.reduce((sum, s) => sum + (s._count?.banks ?? 0), 0)}
              </span>
              <span className="academic-stat-sub">bank soal siap pakai</span>
            </div>
            <div className="academic-stat-card">
              <span className="academic-stat-label">Ujian Terkait</span>
              <span className="academic-stat-value">
                {classrooms.reduce((sum, c) => sum + (c._count?.exams ?? 0), 0)}
              </span>
              <span className="academic-stat-sub">ujian terhubung ke kelas</span>
            </div>
          </div>

          {/* Side-by-side Cards: Kelas & Mata Pelajaran */}
          <div className="academic-cards-grid">
            {/* Kolom Kiri: Kelas */}
            <section className="academic-panel-card" aria-label="Daftar Kelas">
              <div className="academic-panel-header">
                <div>
                  <h3>Daftar Kelas — {selectedGrade.name}</h3>
                  <p>Daftar kelas yang terikat pada tingkat ini. Setiap ujian ditugaskan ke satu kelas.</p>
                </div>
                <MotionButton
                  className="staff-primary"
                  onClick={handleOpenCreateClassroom}
                >
                  <Icon name="plus" size={14} /> Tambah Kelas
                </MotionButton>
              </div>

              <div className="academic-panel-body">
                <div className="academic-list">
                  {classrooms.filter((cls) => cls.id === selectedClassroomId).map((cls) => (
                    <div key={cls.id} className={`academic-item-card ${cls.isArchived ? "is-archived" : ""}`}>
                      <div className="academic-item-main">
                        <div className="academic-item-title">
                          <strong>{cls.name}</strong>
                          {cls.isArchived && <span className="status-badge archived">Arsip</span>}
                        </div>
                        <div className="academic-item-meta">
                          <span>Tingkat: {selectedGrade.name}</span>
                          <span>·</span>
                          <span>{cls._count?.exams ?? 0} ujian terkait</span>
                        </div>
                      </div>
                      <div className="academic-item-actions">
                        <MotionButton
                          type="button"
                          className="action-link"
                          onClick={() => handleOpenEditClassroom(cls)}
                        >
                          Ubah
                        </MotionButton>
                        <MotionButton
                          type="button"
                          className="action-link"
                          onClick={() => handleArchiveClassroom(cls)}
                        >
                          {cls.isArchived ? "Pulihkan" : "Arsipkan"}
                        </MotionButton>
                      </div>
                    </div>
                  ))}
                  {classrooms.length === 0 && (
                    <div className="academic-empty-state">
                      <p>Belum ada kelas pada tingkat ini.</p>
                      <MotionButton
                        type="button"
                        className="staff-primary-outline"
                        onClick={handleOpenCreateClassroom}
                      >
                        Tambah Kelas Pertama
                      </MotionButton>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Kolom Kanan: Mata Pelajaran */}
            <section className="academic-panel-card" aria-label="Daftar Mata Pelajaran">
              <div className="academic-panel-header">
                <div>
                  <h3>Mata Pelajaran — {selectedGrade.name}</h3>
                  <p>Mata pelajaran unik per tingkat. Bank soal dan ujian mengacu pada mata pelajaran ini.</p>
                </div>
                <MotionButton
                  className="staff-primary"
                  onClick={handleOpenCreateSubject}
                >
                  <Icon name="plus" size={14} /> Tambah Mata Pelajaran
                </MotionButton>
              </div>

              <div className="academic-panel-body">
                <div className="academic-list">
                  {subjects.map((sub) => (
                    <div key={sub.id} className={`academic-item-card ${sub.isArchived ? "is-archived" : ""}`}>
                      <div className="academic-item-main">
                        <div className="academic-item-title">
                          <strong>{sub.name} · {selectedGrade.name}</strong>
                          {sub.isArchived && <span className="status-badge archived">Arsip</span>}
                        </div>
                        <div className="academic-item-meta">
                          <span>{sub._count?.banks ?? 0} bank soal</span>
                          <span>·</span>
                          <span>{sub._count?.exams ?? 0} ujian terkait</span>
                        </div>
                      </div>
                      <div className="academic-item-actions">
                        <Link
                          href={`/dashboard/bank-soal?gradeLevelId=${selectedGradeId}&classroomId=${selectedClassroomId}&subjectId=${sub.id}`}
                          className="action-link highlight"
                        >
                          Buka Bank Soal
                        </Link>
                        <MotionButton
                          type="button"
                          className="action-link"
                          onClick={() => handleOpenEditSubject(sub)}
                        >
                          Ubah
                        </MotionButton>
                        <MotionButton
                          type="button"
                          className="action-link"
                          onClick={() => handleArchiveSubject(sub)}
                        >
                          {sub.isArchived ? "Pulihkan" : "Arsipkan"}
                        </MotionButton>
                      </div>
                    </div>
                  ))}
                  {subjects.length === 0 && (
                    <div className="academic-empty-state">
                      <p>Belum ada mata pelajaran pada tingkat ini.</p>
                      <MotionButton
                        type="button"
                        className="staff-primary-outline"
                        onClick={handleOpenCreateSubject}
                      >
                        Tambah Mata Pelajaran Pertama
                      </MotionButton>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </motion.div>
      ) : null}

      {/* Legacy Mapping Section in Card */}
      <div className="academic-legacy-card">
        <motion.button
          type="button"
          className="academic-legacy-header-btn"
          aria-expanded={legacyOpen}
          whileTap={reduceMotion ? undefined : { scale: 0.99 }}
          onClick={() => setLegacyOpen(!legacyOpen)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <strong style={{ fontSize: "13px", color: "#17171a" }}>Data yang Perlu Dipetakan</strong>
            {legacyReport && legacyReport.summary.totalUnmapped > 0 && (
              <span className="academic-legacy-badge">{legacyReport.summary.totalUnmapped} data</span>
            )}
          </div>
          <span className="action-link" style={{ fontSize: "11px" }}>
            {legacyOpen ? "Tutup data yang perlu dipetakan" : "Buka data yang perlu dipetakan"}
          </span>
        </motion.button>

        <AnimatePresence initial={false}>
          {legacyOpen && (
            <motion.section
              key="legacy-panel"
              aria-label="Data Perlu Dipetakan"
              initial={reduceMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
              style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "8px", overflow: "hidden" }}
            >
              <div className="tab-content-head">
                <div>
                  <h3>Data yang Perlu Dipetakan</h3>
                  <p>
                    Data mata pelajaran atau ujian terdahulu yang belum terikat ke tingkat atau kelas tertentu.
                  </p>
                </div>
                {legacyReport && legacyReport.summary.totalUnmapped > 0 && (
                  <MotionButton
                    className="staff-primary"
                    disabled={mappingBusy}
                    onClick={handleAutoMap}
                  >
                    {mappingBusy ? "Memetakan..." : "Petakan Otomatis yang Jelas"}
                  </MotionButton>
                )}
              </div>

              {legacyReport && (
                <div className="legacy-summary-strip">
                  <div className="legacy-summary-card">
                    <small>Mata Pelajaran Tanpa Tingkat</small>
                    <strong>{legacyReport.summary.unmappedSubjectsCount}</strong>
                  </div>
                  <div className="legacy-summary-card">
                    <small>Ujian Tanpa Kelas/Mapel</small>
                    <strong>{legacyReport.summary.unmappedExamsCount}</strong>
                  </div>
                </div>
              )}

              {/* Unmapped Subjects */}
              <div className="legacy-section">
                <h4>Mata Pelajaran Tanpa Tingkat</h4>
                <div className="academic-list">
                  {legacyReport?.unmappedSubjects.map((sub) => (
                    <div key={sub.id} className="academic-item-card legacy-card">
                      <div className="academic-item-main">
                        <strong>{sub.name}</strong>
                        <div className="academic-item-meta">
                          <span>{sub._count.banks} bank soal</span>
                          <span>·</span>
                          <span>{sub._count.exams} ujian terkait</span>
                        </div>
                      </div>
                      <div className="legacy-mapping-controls">
                        <label htmlFor={`map-sub-${sub.id}`} className="sr-only">Pilih Tingkat</label>
                        <select
                          id={`map-sub-${sub.id}`}
                          className="legacy-select"
                          defaultValue=""
                          disabled={mappingBusy}
                          onChange={(e) => {
                            if (e.target.value) handleMapSubject(sub.id, e.target.value);
                          }}
                        >
                          <option value="" disabled>Petakan ke Tingkat...</option>
                          {legacyReport.availableGradeLevels.map((gl) => (
                            <option key={gl.id} value={gl.id}>{gl.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                  {legacyReport?.unmappedSubjects.length === 0 && (
                    <p className="legacy-clean-notice">Semua mata pelajaran sudah memiliki tingkat.</p>
                  )}
                </div>
              </div>

              {/* Unmapped Exams */}
              <div className="legacy-section">
                <h4>Ujian Tanpa Kelas atau Mata Pelajaran</h4>
                <div className="academic-list">
                  {legacyReport?.unmappedExams.map((exam) => (
                    <div key={exam.id} className="academic-item-card legacy-card">
                      <div className="academic-item-main">
                        <strong>{exam.title}</strong>
                        <div className="academic-item-meta">
                          <span>Kelas teks lama: {exam.className || "—"}</span>
                          <span>·</span>
                          <span>Mapel teks lama: {exam.subjectName || "—"}</span>
                        </div>
                      </div>
                      <div className="legacy-exam-mapping-row">
                        <LegacyExamMapper
                          exam={exam}
                          classrooms={legacyReport.availableClassrooms}
                          subjects={legacyReport.availableSubjects}
                          busy={mappingBusy}
                          onMap={(classroomId, subjectId) => handleMapExam(exam.id, exam.revision, classroomId, subjectId)}
                        />
                      </div>
                    </div>
                  ))}
                  {legacyReport?.unmappedExams.length === 0 && (
                    <p className="legacy-clean-notice">Semua ujian sudah terhubung ke kelas dan mata pelajaran.</p>
                  )}
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {/* Grade Dialog */}
      <Dialog
        open={gradeModalOpen}
        onClose={() => setGradeModalOpen(false)}
        title={editingGrade ? "Ubah Tingkat" : "Tambah Tingkat Baru"}
      >
        <form onSubmit={handleSaveGrade} className="academic-modal-form">
          <label htmlFor="grade-name-field">Nama Tingkat</label>
          <input
            id="grade-name-field"
            type="text"
            className="staff-input"
            placeholder="Contoh: Tingkat X, Tingkat XI"
            value={gradeNameInput}
            onChange={(e) => setGradeNameInput(e.target.value)}
            required
            autoFocus
          />
          <div className="modal-actions">
            <button type="button" className="staff-secondary" onClick={() => setGradeModalOpen(false)}>
              Batal
            </button>
            <button type="submit" className="staff-primary">
              Simpan
            </button>
          </div>
        </form>
      </Dialog>

      {/* Classroom Dialog */}
      <Dialog
        open={classroomModalOpen}
        onClose={() => setClassroomModalOpen(false)}
        title={editingClassroom ? "Ubah Kelas" : `Tambah Kelas — ${selectedGrade?.name || ""}`}
      >
        <form onSubmit={handleSaveClassroom} className="academic-modal-form">
          <label htmlFor="classroom-name-field">Nama Kelas</label>
          <input
            id="classroom-name-field"
            type="text"
            className="staff-input"
            placeholder="Contoh: X-1, X-2, IPA-1"
            value={classroomNameInput}
            onChange={(e) => setClassroomNameInput(e.target.value)}
            required
            autoFocus
          />
          <div className="modal-actions">
            <button type="button" className="staff-secondary" onClick={() => setClassroomModalOpen(false)}>
              Batal
            </button>
            <button type="submit" className="staff-primary">
              Simpan
            </button>
          </div>
        </form>
      </Dialog>

      {/* Subject Dialog (Popup modal for Create and Edit) */}
      <Dialog
        open={subjectModalOpen}
        onClose={() => {
          if (!subjectBusy) {
            setSubjectModalOpen(false);
            setSubjectNameInput("");
            setEditingSubject(null);
            setSubjectError("");
          }
        }}
        title={editingSubject ? "Ubah Mata Pelajaran" : `Tambah Mata Pelajaran — ${selectedGrade?.name || ""}`}
      >
        <form onSubmit={handleSaveSubject} className="academic-modal-form">
          <label htmlFor="subject-name-field">
            Nama mata pelajaran untuk {selectedGrade?.name || "tingkat ini"}
          </label>
          <input
            id="subject-name-field"
            type="text"
            className="staff-input"
            placeholder="Contoh: Matematika, Fisika, Bahasa Indonesia"
            value={subjectNameInput}
            onChange={(e) => {
              setSubjectNameInput(e.target.value);
              setSubjectError("");
            }}
            required
            autoFocus
            maxLength={100}
            disabled={subjectBusy}
            aria-describedby={subjectError ? "subject-modal-error" : undefined}
          />
          {subjectError && (
            <p id="subject-modal-error" className="staff-error" role="alert">
              {subjectError}
            </p>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="staff-secondary"
              disabled={subjectBusy}
              onClick={() => {
                setSubjectModalOpen(false);
                setSubjectNameInput("");
                setEditingSubject(null);
                setSubjectError("");
              }}
            >
              Batal
            </button>
            <button
              type="submit"
              className="staff-primary"
              disabled={subjectBusy || !subjectNameInput.trim()}
            >
              {subjectBusy ? "Menyimpan..." : editingSubject ? "Simpan Perubahan" : "Tambah mata pelajaran"}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function LegacyExamMapper({
  exam,
  classrooms,
  subjects,
  busy,
  onMap,
}: {
  exam: { id: string; classroomId: string | null; subjectId: string | null };
  classrooms: Array<{ id: string; name: string; gradeLevelId: string }>;
  subjects: Array<{ id: string; name: string; gradeLevelId: string | null; gradeLevel: { id: string; name: string } | null }>;
  busy: boolean;
  onMap: (classroomId: string, subjectId: string) => void;
}) {
  const [selectedClassroomId, setSelectedClassroomId] = useState(exam.classroomId || "");
  const [selectedSubjectId, setSelectedSubjectId] = useState(exam.subjectId || "");

  const selectedClassroom = classrooms.find((c) => c.id === selectedClassroomId);
  const matchingSubjects = selectedClassroom
    ? subjects.filter((s) => s.gradeLevelId === selectedClassroom.gradeLevelId)
    : subjects;

  return (
    <div className="legacy-exam-controls">
      <select
        className="legacy-select"
        value={selectedClassroomId}
        disabled={busy}
        onChange={(e) => {
          setSelectedClassroomId(e.target.value);
          setSelectedSubjectId("");
        }}
      >
        <option value="">Pilih Kelas...</option>
        {classrooms.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <select
        className="legacy-select"
        value={selectedSubjectId}
        disabled={busy || !selectedClassroomId}
        onChange={(e) => setSelectedSubjectId(e.target.value)}
      >
        <option value="">Pilih Mata Pelajaran...</option>
        {matchingSubjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} {s.gradeLevel ? `· ${s.gradeLevel.name}` : ""}
          </option>
        ))}
      </select>

      <button
        type="button"
        className="staff-primary legacy-apply-btn"
        disabled={busy || !selectedClassroomId || !selectedSubjectId}
        onClick={() => onMap(selectedClassroomId, selectedSubjectId)}
      >
        Simpan Pemetaan
      </button>
    </div>
  );
}
