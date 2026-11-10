"use client";
import { MotionButton } from "@/components/MotionButton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Dialog } from "@/components/Dialog";
import { QuestionContent } from "@/components/QuestionContent";
import { staffApi, staffDownload, staffSend } from "@/lib/staff-api";
import { queryCache } from "@/lib/data-cache";
import { TableSkeleton } from "@/components/skeletons";
import { ErrorText, message } from "./Dashboard";
import type { Exam, GradeLevel, ResultStudent } from "./types";

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
type ResultPage = { exams: ResultExam[]; attempts: { exam: ResultExam; student: ResultStudent }[]; students: { nisn: string; name: string; scores: Record<string, { finalScore: number; pendingManualCount: number }> }[]; page: number; total: number; totalPages: number };
type Filters = { gradeLevelId: string; subject: string; className: string; period: string; category: string };

type HierarchicalResultGroup = {
  classroomId: string | null;
  className: string;
  gradeLevelId: string | null;
  gradeLevelName: string | null;
  totalExams: number;
  subjects: Array<{
    subjectId: string | null;
    subjectName: string;
    gradeLevelName: string | null;
    exams: Array<{
      id: string;
      title: string;
      passingScore: number | null;
      stats: { totalStudents: number; passedCount: number; averageScore: number };
    }>;
  }>;
  crossSubjectRecap: {
    totalStudents: number;
    students: Array<{
      nisn: string;
      name: string;
      examsCompleted: number;
      averageScore: number;
    }>;
  };
};

export function Results() {
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(() => searchParams.get("search") || "");
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [filters, setFilters] = useState<Filters>(() => ({
    gradeLevelId: searchParams.get("gradeLevelId") || "",
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
  const [choices, setChoices] = useState<Record<"subject" | "className" | "period" | "category", string[]>>({ subject: [], className: [], period: [], category: [] });
  const [filterError, setFilterError] = useState("");

  useEffect(() => {
    let active = true;
    staffApi<Record<"subject" | "className" | "period" | "category", string[]>>("/api/dashboard/results/facets")
      .then(value => { if (active) setChoices(value); })
      .catch(err => { if (active) setFilterError(message(err)); });
    staffApi<GradeLevel[]>("/api/academic/grade-levels")
      .then(gls => { if (active) setGradeLevels(gls); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const parameters = useMemo(() => {
    const params = new URLSearchParams({ mode, page: String(page), limit: "25" });
    if (query.trim()) params.set("search", query.trim());
    if (filters.gradeLevelId) params.set("gradeLevelId", filters.gradeLevelId);
    if (filters.subject) params.set("subject", filters.subject);
    if (filters.className) params.set("className", filters.className);
    if (filters.category) params.set("category", filters.category);
    if (filters.period) { const [academicYear, semester] = filters.period.split(" · "); params.set("academicYear", academicYear); params.set("semester", semester); }
    return params.toString();
  }, [filters, mode, page, query]);

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
    if (filters.gradeLevelId) groupParams.set("gradeLevelId", filters.gradeLevelId);
    if (filters.category) groupParams.set("category", filters.category);
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
        staffApi<{ classrooms: HierarchicalResultGroup[] }>(`/api/dashboard/results/groups?${groupParams}`).catch(() => ({ classrooms: [] })),
      ]);

      if (request === requestNumber.current) {
        setResult(data);
        setHierarchicalGroups(groupData.classrooms || []);
      }
    } catch (err) {
      if (request === requestNumber.current) setError(message(err));
    } finally {
      if (request === requestNumber.current) setLoading(false);
    }
  }, [parameters, query, filters, result]);

  useEffect(() => {
    window.history.replaceState(window.history.state, "", `/dashboard/hasil?${parameters}`);
    const timer = window.setTimeout(() => void load(), 180);
    const counter = requestNumber;
    return () => { window.clearTimeout(timer); counter.current++; };
  }, [load, parameters]);

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
      await load();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    setExporting(true);
    setError("");
    try {
      const blob = await staffDownload(`/api/dashboard/results?${parameters}&format=csv`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `hasil-${mode}.csv`;
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

  return (
    <>
      <div className="staff-section-head">
        <div>
          <h2>Hasil ujian</h2>
          <p>Periksa pengerjaan dan nilai berdasarkan ujian yang selesai.</p>
        </div>
        <MotionButton className="staff-secondary" disabled={!result?.total || exporting} onClick={() => void exportCsv()}>
          {exporting ? "Menyiapkan CSV…" : "Ekspor CSV"}
        </MotionButton>
      </div>

      <ErrorText error={error} />
      <ErrorText error={filterError} />

      {/* Grade Selector Strip */}
      <div className="grade-selector-strip" style={{ marginBottom: "12px" }}>
        <span className="grade-selector-label">Filter Tingkat:</span>
        <div className="grade-pills">
          <button
            type="button"
            className={`grade-pill ${!filters.gradeLevelId ? "active" : ""}`}
            onClick={() => { setFilters(f => ({ ...f, gradeLevelId: "" })); setPage(1); }}
          >
            Semua Tingkat
          </button>
          {gradeLevels.map((gl) => (
            <button
              key={gl.id}
              type="button"
              className={`grade-pill ${gl.id === filters.gradeLevelId ? "active" : ""}`}
              onClick={() => { setFilters(f => ({ ...f, gradeLevelId: gl.id })); setPage(1); }}
            >
              {gl.name}
            </button>
          ))}
        </div>
      </div>

      <div className="staff-results-controls">
        <input
          className="staff-search"
          aria-label="Cari hasil ujian"
          placeholder="Cari kelas, mata pelajaran, kategori, atau periode"
          value={query}
          onChange={e => { setQuery(e.target.value); setPage(1); }}
        />
        <div className="staff-segment">
          <MotionButton className={mode === "hierarchy" ? "active" : ""} onClick={() => { setMode("hierarchy"); setPage(1); }}>
            Hierarki Rombel
          </MotionButton>
          <MotionButton className={mode === "list" ? "active" : ""} onClick={() => { setMode("list"); setPage(1); }}>
            Daftar
          </MotionButton>
          <MotionButton className={mode === "matrix" ? "active" : ""} onClick={() => { setMode("matrix"); setPage(1); }}>
            Matriks
          </MotionButton>
        </div>
      </div>

      <div className="staff-result-filters">
        {([["subject", "Semua mata pelajaran"], ["className", "Semua kelas"], ["period", "Semua periode"], ["category", "Semua kategori"]] as const).map(([key, label]) => (
          <select
            key={key}
            aria-label={label}
            value={filters[key]}
            onChange={e => { setFilters(v => ({ ...v, [key]: e.target.value })); setPage(1); }}
          >
            <option value="">{label}</option>
            {choices[key].map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        ))}
      </div>

      {mode === "hierarchy" ? (
        loading && !hierarchicalGroups.length ? (
          <TableSkeleton columns={4} label="Memuat hasil ujian..." />
        ) : hierarchicalGroups.length === 0 ? (
          <div className="staff-empty">
            <h3>Belum ada hasil</h3>
            <p>Hasil peserta tersedia setelah ujian selesai dan dikumpulkan. Periksa kembali filter yang digunakan.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
            {hierarchicalGroups.map((group) => (
              <div key={group.classroomId || group.className} className="classroom-group-card">
                <div className="classroom-group-header">
                  <div className="classroom-group-title">
                    <h3>{group.className}</h3>
                    {group.gradeLevelName && <span className="classroom-grade-badge">{group.gradeLevelName}</span>}
                  </div>
                  <span className="classroom-group-stats">
                    {group.totalExams} ujian selesai · {group.crossSubjectRecap.totalStudents} peserta
                  </span>
                </div>

                <div className="subject-group-list">
                  {group.subjects.map((sub: HierarchicalResultGroup["subjects"][number]) => (
                    <div key={sub.subjectId || sub.subjectName} className="subject-group-card">
                      <div className="subject-group-head">
                        <h4>{sub.subjectName}</h4>
                        <span className="subject-group-meta">{sub.exams.length} ujian</span>
                      </div>
                      <div className="hierarchical-exams-list">
                        {sub.exams.map((ex: HierarchicalResultGroup["subjects"][number]["exams"][number]) => (
                          <div key={ex.id} className="hierarchical-exam-item">
                            <div className="hierarchical-exam-info">
                              <strong>{ex.title}</strong>
                              <div className="hierarchical-exam-meta">
                                <span>Rata-rata: {ex.stats.averageScore}</span>
                                <span>·</span>
                                <span>Lulus: {ex.stats.passedCount} dari {ex.stats.totalStudents} siswa</span>
                                {ex.passingScore != null && <span>· KKM: {ex.passingScore}</span>}
                              </div>
                            </div>
                            <MotionButton onClick={() => { setMode("list"); setFilters(f => ({ ...f, subject: sub.subjectName, className: group.className })); }}>
                              Rincian Siswa
                            </MotionButton>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Cross-subject recap per classroom */}
                {group.crossSubjectRecap.students.length > 0 && (
                  <details style={{ marginTop: "10px", fontSize: "11px", color: "#4b4a52" }}>
                    <summary style={{ cursor: "pointer", fontWeight: 650, padding: "6px 0" }}>
                      Rekap Semua Mata Pelajaran pada {group.className} ({group.crossSubjectRecap.students.length} siswa)
                    </summary>
                    <div className="staff-table-wrap" style={{ marginTop: "8px" }}>
                      <table className="staff-table">
                        <thead>
                          <tr>
                            <th>Siswa</th>
                            <th>NISN</th>
                            <th>Ujian Diikuti</th>
                            <th>Rata-rata Nilai</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.crossSubjectRecap.students.map((st: HierarchicalResultGroup["crossSubjectRecap"]["students"][number]) => (
                            <tr key={st.nisn}>
                              <td><strong>{st.name}</strong></td>
                              <td>{st.nisn}</td>
                              <td>{st.examsCompleted} ujian</td>
                              <td><strong>{st.averageScore}</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        )
      ) : loading && !result ? (
        <TableSkeleton columns={mode === "list" ? 5 : Math.max(3, selected.length + 1)} label="Memuat hasil ujian..." />
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
                    {selected.map(e => (
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
                      <td><strong>{student.name}</strong><small>{student.nisn}</small></td>
                      <td>{exam.title}<small>{exam.className || "—"} · {exam.academicYear || "—"} · {exam.semester || "—"}</small></td>
                      <td>{student.pendingManualCount ? "—" : student.finalScore}</td>
                      <td>{student.pendingManualCount ? "Menunggu penilaian" : exam.passingScore == null ? "Final" : student.finalScore >= exam.passingScore ? "Lulus" : "Belum lulus"}</td>
                      <td><MotionButton onClick={() => void openDetail(exam, student)}>Lihat jawaban</MotionButton></td>
                    </tr>
                  ))
                ) : (
                  students.map(student => (
                    <tr key={student.nisn}>
                      <td><strong>{student.name}</strong><small>{student.nisn}</small></td>
                      {selected.map(exam => {
                        const score = student.scores[exam.id];
                        return <td key={exam.id}>{!score ? "—" : score.pendingManualCount ? "Menunggu penilaian" : score.finalScore}</td>;
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
              <MotionButton className="staff-secondary" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>
                Sebelumnya
              </MotionButton>
              <MotionButton className="staff-secondary" disabled={page >= result.totalPages} onClick={() => setPage(value => value + 1)}>
                Berikutnya
              </MotionButton>
            </div>
          </nav>
        </>
      )}
    <Dialog open={!!detail} title={`Jawaban ${detail?.student.name || "peserta"}`} onClose={() => setDetail(null)}>
      {detail && (
        <div className="staff-editor">
          <ErrorText error={error}/>
          {detail.data.answers.map(q => {
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
                <QuestionContent text={q.questionText} content={q.content} imageUrl={q.imageUrl} imageAlt={q.imageAlt}/>
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
