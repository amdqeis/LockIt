"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { staffApi, staffSend } from "@/lib/staff-api";
import { queryCache } from "@/lib/data-cache";
import { Dialog } from "@/components/Dialog";
import { MotionButton } from "@/components/MotionButton";
import { ErrorText, Icon, message } from "./Dashboard";

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
  const searchParams = useSearchParams();
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState<string>(() => searchParams.get("gradeLevelId") || "");
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
  const [newSubjectName, setNewSubjectName] = useState("");
  const [subjectError, setSubjectError] = useState("");
  const [subjectBusy, setSubjectBusy] = useState(false);

  const [mappingBusy, setMappingBusy] = useState(false);

  const loadGradeLevels = useCallback(async () => {
    try {
      const data = await staffApi<GradeLevel[]>("/api/academic/grade-levels");
      setGradeLevels(data);
      if (data.length > 0 && !selectedGradeId) {
        setSelectedGradeId(data[0].id);
      }
    } catch (err) {
      setError(message(err));
    }
  }, [selectedGradeId]);

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
        if (data.length > 0 && !data.some((grade) => grade.id === selectedGradeId)) {
          setSelectedGradeId(data[0].id);
        }
      })
      .catch((err) => {
        if (active) setError(message(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [selectedGradeId]);

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
        setNewSubjectName("");
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

  async function handleArchiveGrade(grade: GradeLevel) {
    setError("");
    try {
      await staffSend(`/api/academic/grade-levels/${grade.id}`, "PUT", { isArchived: !grade.isArchived });
      setSuccessNotice(`Tingkat "${grade.name}" berhasil ${grade.isArchived ? "dipulihkan" : "diarsipkan"}.`);
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

  // Subject CRUD
  async function handleSaveSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!subjectNameInput.trim() || !selectedGradeId) return;
    setError("");
    try {
      if (editingSubject) {
        await staffSend(`/api/subjects/${editingSubject.id}`, "PUT", { name: subjectNameInput.trim() });
        setSuccessNotice(`Mata pelajaran "${subjectNameInput.trim()}" berhasil diperbarui.`);
      }
      queryCache.invalidate("/api/subjects");
      setSubjectModalOpen(false);
      setSubjectNameInput("");
      setEditingSubject(null);
      await loadSubjects(selectedGradeId);
    } catch (err) {
      setError(message(err));
    }
  }

  async function handleCreateSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubjectName.trim() || !selectedGradeId || subjectBusy || gradeContentLoading) return;
    const gradeId = selectedGradeId;
    const name = newSubjectName.trim();
    setSubjectBusy(true);
    setSubjectError("");
    try {
      await staffSend("/api/subjects", "POST", { name, gradeLevelId: gradeId });
      queryCache.invalidate("/api/subjects");
      setNewSubjectName("");
      setSuccessNotice(`Mata pelajaran "${name}" tersimpan di ${selectedGrade?.name}.`);
      await loadSubjects(gradeId);
    } catch (err) {
      setSubjectError(message(err));
    } finally {
      setSubjectBusy(false);
    }
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
        <div className="academic-header-actions">
          <MotionButton
            className="staff-secondary"
            onClick={() => {
              setEditingGrade(null);
              setGradeNameInput("");
              setGradeModalOpen(true);
            }}
          >
            <Icon name="plus" size={14} /> Tambah Tingkat
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

      {/* Grade Selector Strip */}
      <div className="grade-selector-strip" role="region" aria-label="Pilihan Tingkat">
        <span className="grade-selector-label">Pilih Tingkat:</span>
        <div className="grade-pills">
          {gradeLevels.map((gl) => (
            <button
              key={gl.id}
              type="button"
              className={`grade-pill ${gl.id === selectedGradeId ? "active" : ""} ${gl.isArchived ? "archived" : ""}`}
              disabled={subjectBusy}
              onClick={() => { if (gl.id === selectedGradeId) return; selectedGradeRef.current = gl.id; setSelectedGradeId(gl.id); setNewSubjectName(""); setSubjectError(""); setGradeLoadError(""); setSuccessNotice(""); }}
            >
              <span>{gl.name}</span>
              {gl.isArchived && <small>(Arsip)</small>}
            </button>
          ))}
          {gradeLevels.length === 0 && !loading && (
            <span className="grade-pill-empty">Belum ada tingkat. Tambahkan tingkat pertama Anda.</span>
          )}
        </div>
        {selectedGrade && (
          <div className="grade-actions">
            <button
              type="button"
              className="grade-action-btn"
              onClick={() => {
                setEditingGrade(selectedGrade);
                setGradeNameInput(selectedGrade.name);
                setGradeModalOpen(true);
              }}
              title="Ubah nama tingkat"
            >
              <Icon name="pencil" size={13} /> Ubah
            </button>
            <button
              type="button"
              className="grade-action-btn"
              onClick={() => handleArchiveGrade(selectedGrade)}
              title={selectedGrade.isArchived ? "Pulihkan tingkat" : "Arsipkan tingkat"}
            >
              <Icon name="archive" size={13} /> {selectedGrade.isArchived ? "Pulihkan" : "Arsipkan"}
            </button>
          </div>
        )}
      </div>

      {gradeContentLoading ? <p className="staff-note" role="status">Memuat kelas dan mata pelajaran untuk {selectedGrade?.name || "tingkat ini"}...</p> : gradeLoadError ? <p className="staff-error" role="alert">{gradeLoadError} <button className="action-link" type="button" onClick={() => { setLoadedGradeId(""); setGradeLoadError(""); setGradeLoadVersion((version) => version + 1); }}>Coba lagi</button></p> : selectedGrade && <>
        <section className="academic-tab-content" aria-label="Daftar Kelas">
          <div className="tab-content-head">
            <div>
              <h3>Daftar Kelas — {selectedGrade ? selectedGrade.name : "Pilih Tingkat"}</h3>
              <p>Daftar kelas yang terikat pada tingkat ini. Setiap ujian ditugaskan ke satu kelas.</p>
            </div>
            {selectedGrade && (
              <MotionButton
                className="staff-primary"
                onClick={() => {
                  setEditingClassroom(null);
                  setClassroomNameInput("");
                  setClassroomModalOpen(true);
                }}
              >
                <Icon name="plus" size={14} /> Tambah Kelas
              </MotionButton>
            )}
          </div>

          <div className="academic-list">
            {classrooms.map((cls) => (
              <div key={cls.id} className={`academic-item-card ${cls.isArchived ? "is-archived" : ""}`}>
                <div className="academic-item-main">
                  <div className="academic-item-title">
                    <strong>{cls.name}</strong>
                    {cls.isArchived && <span className="status-badge archived">Arsip</span>}
                  </div>
                  <div className="academic-item-meta">
                    <span>Tingkat: {selectedGrade?.name}</span>
                    <span>·</span>
                    <span>{cls._count?.exams ?? 0} ujian terkait</span>
                  </div>
                </div>
                <div className="academic-item-actions">
                  <button
                    type="button"
                    className="action-link"
                    onClick={() => {
                      setEditingClassroom(cls);
                      setClassroomNameInput(cls.name);
                      setClassroomModalOpen(true);
                    }}
                  >
                    Ubah
                  </button>
                  <button
                    type="button"
                    className="action-link"
                    onClick={() => handleArchiveClassroom(cls)}
                  >
                    {cls.isArchived ? "Pulihkan" : "Arsipkan"}
                  </button>
                </div>
              </div>
            ))}
            {classrooms.length === 0 && (
              <div className="academic-empty-state">
                <p>Belum ada kelas pada tingkat ini.</p>
                {selectedGrade && (
                  <button
                    type="button"
                    className="staff-primary-outline"
                    onClick={() => {
                      setEditingClassroom(null);
                      setClassroomNameInput("");
                      setClassroomModalOpen(true);
                    }}
                  >
                    Tambah Kelas Pertama
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
        <section className="academic-tab-content" aria-label="Daftar Mata Pelajaran">
          <div className="tab-content-head">
            <div>
              <h3>Mata Pelajaran — {selectedGrade ? selectedGrade.name : "Pilih Tingkat"}</h3>
              <p>Mata pelajaran unik per tingkat. Bank soal dan ujian mengacu pada mata pelajaran ini.</p>
            </div>
          </div>

          <form className="academic-subject-create" onSubmit={handleCreateSubject}>
            <div className="academic-subject-field">
              <label htmlFor="new-subject-name">Nama mata pelajaran untuk {selectedGrade.name}</label>
              <input id="new-subject-name" className="staff-input" value={newSubjectName} onChange={(e) => { setNewSubjectName(e.target.value); setSubjectError(""); }} placeholder="Contoh: Matematika" maxLength={100} required disabled={subjectBusy} aria-describedby={subjectError ? "new-subject-error" : undefined} />
              {subjectError && <p id="new-subject-error" className="staff-error" role="alert">{subjectError}</p>}
            </div>
            <button className="staff-primary" type="submit" disabled={subjectBusy || !newSubjectName.trim()}>{subjectBusy ? "Menyimpan..." : "Tambah mata pelajaran"}</button>
          </form>

          <div className="academic-list">
            {subjects.map((sub) => (
              <div key={sub.id} className={`academic-item-card ${sub.isArchived ? "is-archived" : ""}`}>
                <div className="academic-item-main">
                  <div className="academic-item-title">
                    <strong>{sub.name} · {selectedGrade?.name}</strong>
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
                    href={`/dashboard/bank-soal?gradeLevelId=${selectedGradeId}&subjectId=${sub.id}`}
                    className="action-link highlight"
                  >
                    Buka Bank Soal
                  </Link>
                  <button
                    type="button"
                    className="action-link"
                    onClick={() => {
                      setEditingSubject(sub);
                      setSubjectNameInput(sub.name);
                      setSubjectModalOpen(true);
                    }}
                  >
                    Ubah
                  </button>
                  <button
                    type="button"
                    className="action-link"
                    onClick={() => handleArchiveSubject(sub)}
                  >
                    {sub.isArchived ? "Pulihkan" : "Arsipkan"}
                  </button>
                </div>
              </div>
            ))}
            {subjects.length === 0 && (
              <div className="academic-empty-state">
                <p>Belum ada mata pelajaran pada tingkat ini.</p>
                <p>Tambahkan mata pelajaran melalui formulir di atas.</p>
              </div>
            )}
          </div>
        </section>
      </>}

      <button type="button" className="academic-legacy-toggle" aria-expanded={legacyOpen} onClick={() => setLegacyOpen(!legacyOpen)}>
        {legacyOpen ? "Tutup" : "Buka"} data yang perlu dipetakan {legacyReport && legacyReport.summary.totalUnmapped > 0 ? `(${legacyReport.summary.totalUnmapped})` : ""}
      </button>
      {legacyOpen && (
        <section className="academic-tab-content" aria-label="Data Perlu Dipetakan">
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
        </section>
      )}

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
        title={editingClassroom ? "Ubah Kelas" : `Tambah Kelas — ${selectedGrade?.name}`}
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

      {/* Subject Dialog */}
      <Dialog
        open={subjectModalOpen}
        onClose={() => setSubjectModalOpen(false)}
        title={editingSubject ? "Ubah Mata Pelajaran" : `Tambah Mata Pelajaran — ${selectedGrade?.name}`}
      >
        <form onSubmit={handleSaveSubject} className="academic-modal-form">
          <label htmlFor="subject-name-field">Nama Mata Pelajaran</label>
          <input
            id="subject-name-field"
            type="text"
            className="staff-input"
            placeholder="Contoh: Matematika, Fisika, Bahasa Indonesia"
            value={subjectNameInput}
            onChange={(e) => setSubjectNameInput(e.target.value)}
            required
            autoFocus
          />
          <ErrorText error={error} />
          <div className="modal-actions">
            <button type="button" className="staff-secondary" onClick={() => setSubjectModalOpen(false)}>
              Batal
            </button>
            <button type="submit" className="staff-primary">
              Simpan
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
