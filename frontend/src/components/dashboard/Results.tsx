"use client";
import { MotionButton } from "@/components/MotionButton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion, LayoutGroup } from "framer-motion";
import { Dialog } from "@/components/Dialog";
import { QuestionContent } from "@/components/QuestionContent";
import { staffApi, staffDownload, staffSend } from "@/lib/staff-api";
import { queryCache } from "@/lib/data-cache";
import { motionTokens } from "@/lib/motion";
import { TableSkeleton } from "@/components/skeletons";
import { ErrorText, message, Icon } from "./Dashboard";
import type { Classroom, Exam, GradeLevel, ResultStudent } from "./types";
import { HierarchyBreadcrumb, HierarchyCard, useHierarchyNavigation } from "./HierarchyNavigation";

type ResultExam = Pick<Exam, "id" | "title" | "subjectName" | "className" | "academicYear" | "semester" | "category" | "categoryNumber" | "passingScore">;

type Detail = {
  summary?: {
    totalPoints: number;
    earnedPoints: number;
    finalScore: number;
    correctCount: number;
    pendingManualCount: number;
    totalQuestions: number;
  };
  answers: {
    questionId: string;
    orderIndex: number;
    questionText: string;
    content?: unknown;
    imageUrl?: string | null;
    imageAlt?: string | null;
    type: string;
    selectedOption: string | null;
    correctAnswer?: string;
    points: number;
    earnedPoints: number;
    isPartiallyCorrect: boolean;
    isCorrect: boolean | null;
  }[];
};

type ResultPage = {
  exams: ResultExam[];
  attempts: { exam: ResultExam; student: ResultStudent }[];
  students: { nisn: string; name: string; scores: Record<string, { finalScore: number; pendingManualCount: number }> }[];
  page: number;
  total: number;
  totalPages: number;
};

type Filters = { subject: string; className: string; period: string; category: string };

type ResultExamGroupItem = ResultExam & {
  completedStudents: number;
  averageScore: number | null;
  pendingGradingCount: number;
};

type ResultSubjectGroup = {
  subjectId: string | null;
  subjectName: string;
  gradeLevelName: string | null;
  totalExams: number;
  totalCompletedStudents: number;
  averageScore: number | null;
  exams: ResultExamGroupItem[];
};

type HierarchicalResultGroup = {
  classroomId: string | null;
  className: string;
  classNameMissing?: boolean;
  gradeLevelId: string | null;
  gradeLevelName: string | null;
  totalExams: number;
  totalCompletedStudents: number;
  averageScore: number | null;
  subjects: ResultSubjectGroup[];
};

export function Results() {
  const reduceMotion = useReducedMotion();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(() => searchParams.get("search") || "");

  // 3-Stage Drill-Down states: Level 1 (Grade) -> Level 2 (Classroom) -> Level 3 (Exams/Students)
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const { selectedGradeId, selectedClassroomId, setSelectedGradeId, setSelectedClassroomId } = useHierarchyNavigation();

  const [filters] = useState<Filters>(() => ({
    subject: searchParams.get("subject") || "",
    className: searchParams.get("className") || "",
    period: searchParams.get("academicYear") && searchParams.get("semester") ? `${searchParams.get("academicYear")} · ${searchParams.get("semester")}` : "",
    category: searchParams.get("category") || "",
  }));
  const [mode, setMode] = useState<"hierarchy" | "list" | "matrix">(() => {
    const m = searchParams.get("mode");
    return m === "list" ? "list" : m === "matrix" ? "matrix" : "hierarchy";
  });
  const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get("page")) || 1));
  const [result, setResult] = useState<ResultPage | null>(null);
  const [hierarchicalGroups, setHierarchicalGroups] = useState<HierarchicalResultGroup[]>([]);
  const [detail, setDetail] = useState<{ exam: ResultExam; student: ResultStudent; data: Detail } | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const requestNumber = useRef(0);
  const [filterError, setFilterError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([staffApi<GradeLevel[]>("/api/academic/grade-levels?includeArchived=true"), staffApi<Classroom[]>("/api/academic/classrooms?includeArchived=true")])
      .then(([gls, classes]) => { if (active) { setGradeLevels(gls); setClassrooms(classes); } })
      .catch((err) => { if (active) setFilterError(message(err)); });
    return () => { active = false; };
  }, []);

  const parameters = useMemo(() => {
    const params = new URLSearchParams({ mode, page: String(page), limit: "25" });
    if (selectedClassroomId) {
      if (classrooms.some(c => c.id === selectedClassroomId)) params.set("classroomId", selectedClassroomId);
      else {
        params.set("className", selectedClassroomId);
        if (selectedGradeId) params.set("gradeLevelId", selectedGradeId);
      }
    }
    if (query.trim()) params.set("search", query.trim());
    if (filters.subject) params.set("subject", filters.subject);
    if (filters.className && !selectedClassroomId) params.set("className", filters.className);
    if (filters.category) params.set("category", filters.category);
    if (filters.period) {
      const [academicYear, semester] = filters.period.split(" · ");
      params.set("academicYear", academicYear);
      params.set("semester", semester);
    }
    return params.toString();
  }, [filters, mode, page, query, selectedClassroomId, selectedGradeId, classrooms]);

  const load = useCallback(async (force = false) => {
    const request = ++requestNumber.current;
    const cacheKey = `/api/dashboard/results?${parameters}`;
    const cached = queryCache.get<ResultPage>(cacheKey);
    if (!cached || force) {
      if (!result) setLoading(true);
    }
    setError("");

    const groupParams = new URLSearchParams();
    if (query.trim()) groupParams.set("search", query.trim());
    if (filters.category) groupParams.set("category", filters.category);
    if (filters.subject) groupParams.set("subject", filters.subject);
    if (filters.className) groupParams.set("className", filters.className);
    if (filters.period) {
      const [academicYear, semester] = filters.period.split(" · ");
      groupParams.set("academicYear", academicYear);
      groupParams.set("semester", semester);
    }

    try {
      const [data, groupData] = await Promise.all([
        queryCache.fetch<ResultPage>(
          cacheKey,
          () => staffApi<ResultPage>(cacheKey),
          30000
        ),
        staffApi<{ groups: HierarchicalResultGroup[] }>(`/api/dashboard/results/groups?${groupParams}`),
      ]);

      if (request === requestNumber.current) {
        setResult(data);
        setHierarchicalGroups(groupData.groups || []);
      }
    } catch (err) {
      if (request === requestNumber.current) setError(message(err));
    } finally {
      if (request === requestNumber.current) setLoading(false);
    }
  }, [parameters, query, filters, result]);

  useEffect(() => {
    const url = new URLSearchParams(parameters);
    if (selectedGradeId) url.set("gradeLevelId", selectedGradeId);
    if (selectedClassroomId) url.set("classroomId", selectedClassroomId);
    window.history.replaceState(window.history.state, "", `/dashboard/hasil?${url}`);
    const timer = window.setTimeout(() => void load(), 180);
    const counter = requestNumber;
    return () => { window.clearTimeout(timer); counter.current++; };
  }, [load, parameters, selectedGradeId, selectedClassroomId]);

  async function openDetail(exam: ResultExam, student: ResultStudent) {
    try {
      setDetail({ exam, student, data: await staffApi<Detail>(`/api/exams/${exam.id}/results/${student.studentId}`) });
    } catch (err) {
      setError(message(err));
    }
  }

  async function grade(questionId: string, isCorrect: boolean) {
    if (!detail) return;
    setBusy(true);
    try {
      await staffSend(`/api/exams/${detail.exam.id}/results/${detail.student.studentId}`, "PATCH", { questionId, isCorrect });
      await openDetail(detail.exam, detail.student);
      await load(true);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  // Export CSV support: Global, Per Kelas, atau Per Ujian
  async function exportCsv(classroomId?: string, customExamId?: string, label?: string) {
    setExporting(true);
    setError("");
    try {
      const exportParams = new URLSearchParams({ format: "csv", csvLayout: "grouped", mode: "list" });
      if (classroomId) exportParams.set("classroomId", classroomId);
      else if (!customExamId && label && label !== "global") {
        exportParams.set("className", label);
        if (selectedGradeId) exportParams.set("gradeLevelId", selectedGradeId);
      }
      if (customExamId) exportParams.set("examId", customExamId);
      const blob = await staffDownload(`/api/dashboard/results?${exportParams.toString()}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const cleanLabel = (label || classroomId || (customExamId ? `ujian-${customExamId.slice(0, 8)}` : "global")).replace(/[^a-zA-Z0-9_-]/g, "_");
      link.download = `hasil-${cleanLabel}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(message(err));
    } finally {
      setExporting(false);
    }
  }

  const attempts = result?.attempts || [];
  const students = result?.students || [];
  const selected = result?.exams || [];

  // Grade level stats calculation
  const gradeLevelStats = useMemo(() => {
    return gradeLevels.map((gl) => {
      const matchingGroups = hierarchicalGroups.filter(g => g.gradeLevelId === gl.id);
      matchingGroups.push(...classrooms.filter(c => c.gradeLevelId === gl.id && !matchingGroups.some(g => g.classroomId === c.id))
        .map(c => ({ classroomId: c.id, className: c.name, gradeLevelId: c.gradeLevelId, gradeLevelName: gl.name, totalExams: 0, totalCompletedStudents: 0, averageScore: null, subjects: [] })));
      const totalClasses = matchingGroups.length;
      const totalExams = matchingGroups.reduce((acc, g) => acc + g.totalExams, 0);
      const totalCompletedStudents = matchingGroups.reduce((acc, g) => acc + g.totalCompletedStudents, 0);
      const scoreSum = matchingGroups.reduce(
        (acc, g) => acc + (g.averageScore ? g.averageScore * g.totalCompletedStudents : 0),
        0
      );
      const averageScore = totalCompletedStudents > 0 ? Math.round((scoreSum / totalCompletedStudents) * 10) / 10 : null;

      return {
        ...gl,
        totalClasses,
        totalExams,
        totalCompletedStudents,
        averageScore,
        classes: matchingGroups,
      };
    });
  }, [gradeLevels, hierarchicalGroups, classrooms]);

  const currentGrade = useMemo(() => {
    if (!selectedGradeId) return null;
    return gradeLevelStats.find((gl) => gl.id === selectedGradeId) || null;
  }, [gradeLevelStats, selectedGradeId]);

  const classesInCurrentGrade = useMemo(() => {
    if (!currentGrade) return [];
    return currentGrade.classes;
  }, [currentGrade]);

  const selectedClassGroup = useMemo(() => {
    if (!selectedClassroomId) return null;
    return classesInCurrentGrade.find((g) => (g.classroomId || g.className) === selectedClassroomId) || null;
  }, [classesInCurrentGrade, selectedClassroomId]);

  const classAttempts = useMemo(() => {
    if (!selectedClassGroup || !result) return [];
    const examIdsInClass = new Set(selectedClassGroup.subjects.flatMap((s) => s.exams.map((e) => e.id)));
    return result.attempts.filter((a) => examIdsInClass.has(a.exam.id));
  }, [selectedClassGroup, result]);

  return (
    <>
      <div className="staff-section-head">
        <div>
          <h2>Hasil ujian</h2>
          <p>
            {!selectedGradeId
              ? "Pilih tingkatan untuk melihat hasil dan nilai ujian per kelas."
              : !selectedClassroomId
              ? `Pilih kelas di Tingkat ${currentGrade?.name || ""} untuk melihat detail nilai.`
              : `Hasil dan pengerjaan siswa pada Kelas ${selectedClassGroup?.className || ""}.`}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <MotionButton
            className="staff-secondary"
            disabled={exporting}
            onClick={() => void exportCsv(undefined, undefined, "global")}
            title="Ekspor seluruh hasil ujian dari semua kelas dan tingkat"
          >
            <Icon name="file" size={14} /> {exporting ? "Menyiapkan CSV…" : "Ekspor CSV Global"}
          </MotionButton>
        </div>
      </div>

      <ErrorText error={error} />
      <ErrorText error={filterError} />
      <HierarchyBreadcrumb grade={currentGrade?.name} classroom={selectedClassGroup?.className} onRoot={() => { setMode("hierarchy"); setSelectedGradeId(null); }} onGrade={() => { setMode("hierarchy"); setSelectedClassroomId(null); }} />

      <div className="staff-results-controls">
        <input
          className="staff-search"
          aria-label="Cari hasil ujian"
          placeholder="Cari kelas, mata pelajaran, kategori, atau periode"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
        />
        {selectedClassroomId && <LayoutGroup id="results-mode-tabs">
          <div className="staff-segment" role="group" aria-label="Tampilan hasil">
            <motion.button
              type="button"
              className={mode === "hierarchy" ? "active" : ""}
              aria-pressed={mode === "hierarchy"}
              whileTap={reduceMotion ? undefined : { scale: 0.96 }}
              onClick={() => { setMode("hierarchy"); setPage(1); }}
            >
              {mode === "hierarchy" && (
                <motion.span
                  layoutId="active-results-mode"
                  className="staff-segment-thumb"
                  transition={reduceMotion ? { duration: 0 } : motionTokens.softSpring}
                />
              )}
              <span className="staff-segment-label">Per Tingkat &amp; Kelas</span>
            </motion.button>
            <motion.button
              type="button"
              className={mode === "list" ? "active" : ""}
              aria-pressed={mode === "list"}
              whileTap={reduceMotion ? undefined : { scale: 0.96 }}
              onClick={() => { setMode("list"); setPage(1); }}
            >
              {mode === "list" && (
                <motion.span
                  layoutId="active-results-mode"
                  className="staff-segment-thumb"
                  transition={reduceMotion ? { duration: 0 } : motionTokens.softSpring}
                />
              )}
              <span className="staff-segment-label">Daftar Siswa</span>
            </motion.button>
            <motion.button
              type="button"
              className={mode === "matrix" ? "active" : ""}
              aria-pressed={mode === "matrix"}
              whileTap={reduceMotion ? undefined : { scale: 0.96 }}
              onClick={() => { setMode("matrix"); setPage(1); }}
            >
              {mode === "matrix" && (
                <motion.span
                  layoutId="active-results-mode"
                  className="staff-segment-thumb"
                  transition={reduceMotion ? { duration: 0 } : motionTokens.softSpring}
                />
              )}
              <span className="staff-segment-label">Matriks Nilai</span>
            </motion.button>
          </div>
        </LayoutGroup>}
      </div>

      {mode === "hierarchy" || !selectedClassroomId ? (
        loading && !hierarchicalGroups.length ? (
          <div className="drilldown-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="drilldown-card drilldown-theme-white" style={{ minHeight: "160px", opacity: 0.7 }}>
                <TableSkeleton columns={2} label="" />
              </div>
            ))}
          </div>
        ) : !selectedGradeId ? (
          /* TAHAP 1: BOX PILIHAN TINGKATAN (STYLE OVERVIEW CARDS) */
          <div>
            <div className="drilldown-grid">
              {gradeLevelStats.map((gl, index) => <HierarchyCard key={gl.id} index={index} name={`Tingkat ${gl.name}`} count={`${gl.totalCompletedStudents} pengerjaan`} detail={`${gl.totalClasses} kelas · ${gl.totalExams} ujian`} onClick={() => setSelectedGradeId(gl.id)} />)}
            </div>
            {gradeLevelStats.length === 0 && (
              <div className="staff-empty">
                <h3>Belum ada tingkatan</h3>
                <p>Tambahkan tingkatan terlebih dahulu di menu Kelas &amp; Mapel.</p>
              </div>
            )}
          </div>
        ) : !selectedClassGroup ? (
          /* TAHAP 2: BOX PILIHAN KELAS DI TINGKAT TERPILIH */
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "10px" }}>
            <div className="class-detail-banner">
              <div className="class-detail-info">
                <h3>Pilihan Kelas · Tingkat {currentGrade?.name}</h3>
                <p>
                  {classesInCurrentGrade.length} Kelas terdaftar · {currentGrade?.totalExams || 0} Ujian selesai · {currentGrade?.totalCompletedStudents || 0} Siswa mengumpulkan
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <MotionButton
                  className="staff-secondary"
                  onClick={() => setSelectedGradeId(null)}
                >
                  ← Kembali ke Pilihan Tingkat
                </MotionButton>
              </div>
            </div>

            <div className="class-box-grid">
              {classesInCurrentGrade.map((cls) => {
                const boxKey = cls.classroomId || cls.className;
                return (
                  <motion.div
                    key={boxKey}
                    className="class-box-card"
                    role="button"
                    tabIndex={0}
                    whileHover={reduceMotion ? undefined : { y: -2 }}
                    whileTap={reduceMotion ? undefined : { scale: 0.985 }}
                    transition={motionTokens.softSpring}
                    onClick={() => setSelectedClassroomId(boxKey)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedClassroomId(boxKey);
                      }
                    }}
                  >
                    <div className="class-box-top">
                      <div>
                        <h3 className="class-box-name">{cls.className}</h3>
                        <p style={{ fontSize: "11px", color: "var(--staff-muted)", margin: "2px 0 0" }}>
                          {cls.subjects.map((s) => s.subjectName).filter(Boolean).slice(0, 3).join(", ") || "Mata pelajaran"}
                        </p>
                      </div>
                      <span className="class-box-badge">Tingkat {currentGrade?.name}</span>
                    </div>

                    <div className="class-box-stats">
                      <div className="class-box-stat-item">
                        <span className="class-box-stat-label">Total Ujian</span>
                        <span className="class-box-stat-val">{cls.totalExams} Ujian</span>
                      </div>
                      <div className="class-box-stat-item">
                        <span className="class-box-stat-label">Peserta Selesai</span>
                        <span className="class-box-stat-val">{cls.totalCompletedStudents} Siswa</span>
                      </div>
                      <div className="class-box-stat-item">
                        <span className="class-box-stat-label">Rata-rata Nilai</span>
                        <span className="class-box-stat-val">{cls.averageScore != null ? cls.averageScore : "—"}</span>
                      </div>
                      <div className="class-box-stat-item">
                        <span className="class-box-stat-label">Mata Pelajaran</span>
                        <span className="class-box-stat-val">{cls.subjects.length} Mapel</span>
                      </div>
                    </div>

                    <div className="class-box-footer">
                      <span style={{ color: "#4f46e5" }}>Buka Hasil Kelas</span>
                      <span>→</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            {classesInCurrentGrade.length === 0 && (
              <div className="staff-empty">
                <h3>Belum ada kelas atau ujian di Tingkat {currentGrade?.name}</h3>
                <p>Ujian dan pengerjaan siswa akan muncul setelah pelaksanaan ujian selesai.</p>
              </div>
            )}
          </div>
        ) : (
          /* TAHAP 3: DETAIL UJIAN & SISWA DI KELAS TERPILIH */
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "14px" }}>
            <div className="class-detail-banner">
              <div className="class-detail-info">
                <h3>Hasil Kelas {selectedClassGroup.className}</h3>
                <p>
                  Tingkat {currentGrade?.name || selectedClassGroup.gradeLevelName || "—"} ·{" "}
                  {selectedClassGroup.totalExams} Ujian · {selectedClassGroup.totalCompletedStudents} Peserta Selesai
                  {selectedClassGroup.averageScore != null ? ` · Rata-rata Nilai: ${selectedClassGroup.averageScore}` : ""}
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                <MotionButton
                  className="staff-primary"
                  onClick={() => void exportCsv(selectedClassGroup.classroomId || undefined, undefined, selectedClassGroup.className)}
                  disabled={exporting}
                  title={`Ekspor seluruh hasil pengerjaan siswa kelas ${selectedClassGroup.className}`}
                >
                  <Icon name="file" size={14} /> Ekspor CSV Kelas Ini
                </MotionButton>
                <MotionButton
                  className="staff-secondary"
                  onClick={() => setSelectedClassroomId(null)}
                >
                  ← Kembali ke Daftar Kelas
                </MotionButton>
              </div>
            </div>

            {/* Daftar Ujian per Mata Pelajaran di Kelas ini dengan tombol Ekspor CSV per Ujian */}
            <div className="subject-group-list">
              {selectedClassGroup.subjects.map((sub) => (
                <div key={sub.subjectId || sub.subjectName} className="subject-group-card">
                  <div className="subject-group-head">
                    <h4>{sub.subjectName}</h4>
                    <span className="subject-group-meta">
                      {sub.exams.length} Ujian · Rata-rata: {sub.averageScore ?? "—"}
                    </span>
                  </div>
                  <div className="hierarchical-exams-list">
                    {sub.exams.map((ex) => (
                      <div key={ex.id} className="hierarchical-exam-item">
                        <div className="hierarchical-exam-info">
                          <strong>{ex.title}</strong>
                          <div className="hierarchical-exam-meta">
                            <span>Selesai: {ex.completedStudents} peserta</span>
                            <span>·</span>
                            <span>Rata-rata: {ex.averageScore ?? "—"}</span>
                            {ex.passingScore != null && <span>· KKM: {ex.passingScore}</span>}
                            {ex.pendingGradingCount > 0 && (
                              <span style={{ color: "#d97706", fontWeight: 600 }}>
                                · {ex.pendingGradingCount} menunggu koreksi manual
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <MotionButton
                            className="staff-secondary hierarchy-export-exam"
                            style={{ fontSize: "11px", padding: "4px 10px", height: "30px" }}
                            onClick={() => void exportCsv(undefined, ex.id, `${selectedClassGroup.className}-${ex.title}`)}
                            disabled={exporting || ex.completedStudents === 0}
                            title={`Ekspor CSV khusus ujian ${ex.title}`}
                          >
                            <Icon name="file" size={13} /> Ekspor CSV Ujian
                          </MotionButton>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Rincian Pengerjaan Siswa Kelas Ini */}
            <div style={{ marginTop: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0 }}>Rincian Pengerjaan Siswa</h3>
                <span style={{ fontSize: "11px", color: "var(--staff-muted)" }}>
                  {classAttempts.length} Pengerjaan tercatat
                </span>
              </div>
              {classAttempts.length === 0 ? (
                <div className="staff-empty" style={{ padding: "24px" }}>
                  <p>Belum ada rincian pengerjaan yang tersimpan untuk kelas ini.</p>
                </div>
              ) : (
                <div className="staff-table-wrap">
                  <table className="staff-table">
                    <thead>
                      <tr>
                        <th>Peserta</th>
                        <th>Ujian</th>
                        <th>Nilai</th>
                        <th>Status Kelulusan</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {classAttempts.map(({ exam, student }) => (
                        <tr key={`${exam.id}-${student.studentId}`}>
                          <td>
                            <strong>{student.name}</strong>
                            <small>{student.nisn}</small>
                          </td>
                          <td>
                            {exam.title}
                            <small>{exam.subjectName || "—"}</small>
                          </td>
                          <td>
                            <strong>{student.pendingManualCount ? "—" : student.finalScore}</strong>
                          </td>
                          <td>
                            {student.pendingManualCount
                              ? "Menunggu koreksi"
                              : exam.passingScore == null
                              ? "Selesai"
                              : student.finalScore >= exam.passingScore
                              ? "Lulus"
                              : "Belum lulus"}
                          </td>
                          <td>
                            <MotionButton onClick={() => void openDetail(exam, student)}>
                              Periksa jawaban
                            </MotionButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )
      ) : loading && !result ? (
        <TableSkeleton columns={mode === "list" ? 5 : Math.max(3, selected.length + 1)} label="" />
      ) : !result?.total ? (
        <div className="staff-empty">
          <h3>Belum ada hasil</h3>
          <p>Hasil peserta tersedia setelah ujian selesai dan dikumpulkan. Periksa kembali filter yang digunakan.</p>
        </div>
      ) : (
        <>
          <div className="staff-table-wrap">
            <table className="staff-table">
              <thead>
                {mode === "list" ? (
                  <tr>
                    <th>Peserta</th>
                    <th>Ujian</th>
                    <th>Nilai</th>
                    <th>Penilaian</th>
                    <th />
                  </tr>
                ) : (
                  <tr>
                    <th>Peserta</th>
                    {selected.map((e) => (
                      <th key={e.id}>
                        {e.title}
                        <small>{e.subjectName || "—"} · {e.className || "—"} · {e.academicYear || "—"} · {e.semester || "—"}</small>
                      </th>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody>
                {mode === "list" ? (
                  attempts.map(({ exam, student }) => (
                    <tr key={`${exam.id}-${student.studentId}`}>
                      <td>
                        <strong>{student.name}</strong>
                        <small>{student.nisn}</small>
                      </td>
                      <td>
                        {exam.title}
                        <small>{exam.className || "—"} · {exam.academicYear || "—"} · {exam.semester || "—"}</small>
                      </td>
                      <td>{student.pendingManualCount ? "—" : student.finalScore}</td>
                      <td>
                        {student.pendingManualCount
                          ? "Menunggu penilaian"
                          : exam.passingScore == null
                          ? "Final"
                          : student.finalScore >= exam.passingScore
                          ? "Lulus"
                          : "Belum lulus"}
                      </td>
                      <td>
                        <MotionButton onClick={() => void openDetail(exam, student)}>
                          Lihat jawaban
                        </MotionButton>
                      </td>
                    </tr>
                  ))
                ) : (
                  students.map((student) => (
                    <tr key={student.nisn}>
                      <td>
                        <strong>{student.name}</strong>
                        <small>{student.nisn}</small>
                      </td>
                      {selected.map((exam) => {
                        const score = student.scores[exam.id];
                        return (
                          <td key={exam.id}>
                            {!score ? "—" : score.pendingManualCount ? "Menunggu penilaian" : score.finalScore}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <nav className="staff-pagination" aria-label="Halaman hasil">
            <span>Halaman {result.page} dari {result.totalPages} · {result.total} {mode === "list" ? "pengerjaan" : "peserta"}</span>
            <div>
              <MotionButton className="staff-secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                Sebelumnya
              </MotionButton>
              <MotionButton className="staff-secondary" disabled={page >= result.totalPages} onClick={() => setPage((value) => value + 1)}>
                Berikutnya
              </MotionButton>
            </div>
          </nav>
        </>
      )}

      <Dialog open={!!detail} title={`Jawaban ${detail?.student.name || "peserta"}`} onClose={() => setDetail(null)}>
        {detail && (
          <div className="staff-editor">
            <ErrorText error={error} />
            {detail.data.answers.map((q) => {
              const earned = q.earnedPoints ?? (q.isCorrect ? q.points : 0);
              const isShortAnswer = q.type === "short_answer";
              const isMultiSelect = q.type === "multi_select";
              const isPendingShort = isShortAnswer && q.selectedOption && q.isCorrect === null;
              const isPartial = isMultiSelect && (q.isPartiallyCorrect || (earned > 0 && earned < q.points));
              const isFull = !isPendingShort && (earned >= q.points || q.isCorrect === true);

              let statusLabel = "Jawaban belum benar";
              let statusColor = "#991b1b";

              if (isPendingShort) {
                statusLabel = "Menunggu penilaian guru";
                statusColor = "#475569";
              } else if (isPartial) {
                statusLabel = "Jawaban sebagian benar";
                statusColor = "#b45309";
              } else if (isFull) {
                statusLabel = "Jawaban benar";
                statusColor = "#166534";
              }

              return (
                <section className="staff-question" key={q.questionId}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong>Soal {q.orderIndex}</strong>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 9999, background: "#f1f5f9", color: "#334155" }}>
                      Poin: {isPendingShort ? `— / ${q.points}` : `${earned} / ${q.points}`}
                    </span>
                  </div>
                  <QuestionContent text={q.questionText} content={q.content} imageUrl={q.imageUrl} imageAlt={q.imageAlt} />
                  <p>Jawaban: {q.selectedOption || "Tidak dijawab"}</p>
                  {q.correctAnswer && <p style={{ color: "var(--staff-muted)" }}>Kunci jawaban: {q.correctAnswer}</p>}
                  <p style={{ color: statusColor, fontWeight: 500 }}>{statusLabel}</p>
                  {isShortAnswer && q.selectedOption && (
                    <div className="staff-action-wrap">
                      <MotionButton disabled={busy} onClick={() => void grade(q.questionId, true)}>Tandai benar</MotionButton>
                      <MotionButton disabled={busy} onClick={() => void grade(q.questionId, false)}>Tandai salah</MotionButton>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </Dialog>
    </>
  );
}
