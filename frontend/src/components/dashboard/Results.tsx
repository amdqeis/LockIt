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
import type { Exam, ResultStudent } from "./types";

type ResultExam = Pick<Exam, "id" | "title" | "subjectName" | "className" | "academicYear" | "semester" | "category" | "categoryNumber" | "passingScore">;
type Detail = { answers: { questionId: string; orderIndex: number; questionText: string; content?: unknown; imageUrl?: string | null; imageAlt?: string | null; type: string; selectedOption: string | null; isCorrect: boolean | null }[] };
type ResultPage = { exams: ResultExam[]; attempts: { exam: ResultExam; student: ResultStudent }[]; students: { nisn: string; name: string; scores: Record<string, { finalScore: number; pendingManualCount: number }> }[]; page: number; total: number; totalPages: number };
type Filters = { subject: string; className: string; period: string; category: string };

export function Results() {
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(() => searchParams.get("search") || "");
  const [filters, setFilters] = useState<Filters>(() => ({ subject: searchParams.get("subject") || "", className: searchParams.get("className") || "", period: searchParams.get("academicYear") && searchParams.get("semester") ? `${searchParams.get("academicYear")} · ${searchParams.get("semester")}` : "", category: searchParams.get("category") || "" }));
  const [mode, setMode] = useState<"list" | "matrix">(() => searchParams.get("mode") === "matrix" ? "matrix" : "list");
  const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get("page")) || 1));
  const [result, setResult] = useState<ResultPage | null>(null);
  const [detail, setDetail] = useState<{ exam: ResultExam; student: ResultStudent; data: Detail } | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const requestNumber = useRef(0);
  const [choices, setChoices] = useState<Record<keyof Filters, string[]>>({ subject: [], className: [], period: [], category: [] });
  const [filterError, setFilterError] = useState("");
  useEffect(() => { let active = true; staffApi<Record<keyof Filters, string[]>>("/api/dashboard/results/facets").then(value => { if (active) setChoices(value); }).catch(err => { if (active) setFilterError(message(err)); }); return () => { active = false; }; }, []);
  const parameters = useMemo(() => {
    const params = new URLSearchParams({ mode, page: String(page), limit: "25" });
    if (query.trim()) params.set("search", query.trim());
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
    try {
      const data = await queryCache.fetch<ResultPage>(
        cacheKey,
        () => staffApi<ResultPage>(cacheKey),
        30000
      );
      if (request === requestNumber.current) setResult(data);
    } catch (err) {
      if (request === requestNumber.current) setError(message(err));
    } finally {
      if (request === requestNumber.current) setLoading(false);
    }
  }, [parameters, result]);
  useEffect(() => {
    window.history.replaceState(window.history.state, "", `/dashboard/hasil?${parameters}`);
    const timer = window.setTimeout(() => void load(), 180);
    const counter = requestNumber;
    return () => { window.clearTimeout(timer); counter.current++; };
  }, [load, parameters]);
  async function openDetail(exam: ResultExam, student: ResultStudent) { try { setDetail({ exam, student, data: await staffApi<Detail>(`/api/exams/${exam.id}/results/${student.studentId}`) }); } catch (err) { setError(message(err)); } }
  async function grade(questionId: string, isCorrect: boolean) {
    if (!detail) return;
    setBusy(true);
    try { await staffSend(`/api/exams/${detail.exam.id}/results/${detail.student.studentId}`, "PATCH", { questionId, isCorrect }); await openDetail(detail.exam, detail.student); await load(); }
    catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  async function exportCsv() {
    setExporting(true); setError("");
    try {
      const blob = await staffDownload(`/api/dashboard/results?${parameters}&format=csv`);
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `hasil-${mode}.csv`; link.click(); URL.revokeObjectURL(url);
    } catch (err) { setError(message(err)); } finally { setExporting(false); }
  }
  const attempts = result?.attempts || [];
  const students = result?.students || [];
  const selected = result?.exams || [];
  return <><div className="staff-section-head"><div><h2>Hasil ujian</h2><p>Periksa pengerjaan dan nilai berdasarkan ujian yang selesai.</p></div><MotionButton className="staff-secondary" disabled={!result?.total || exporting} onClick={() => void exportCsv()}>{exporting ? "Menyiapkan CSV…" : "Ekspor CSV"}</MotionButton></div>
    <ErrorText error={error}/><ErrorText error={filterError}/>
    <div className="staff-results-controls"><input className="staff-search" aria-label="Cari hasil ujian" placeholder="Cari kelas, mata pelajaran, kategori, atau periode" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }}/><div className="staff-segment"><MotionButton className={mode === "list" ? "active" : ""} onClick={() => { setMode("list"); setPage(1); }}>Daftar</MotionButton><MotionButton className={mode === "matrix" ? "active" : ""} onClick={() => { setMode("matrix"); setPage(1); }}>Matriks</MotionButton></div></div>
    <div className="staff-result-filters">{([["subject", "Semua mata pelajaran"], ["className", "Semua kelas"], ["period", "Semua periode"], ["category", "Semua kategori"]] as const).map(([key,label]) => <select key={key} aria-label={label} value={filters[key]} onChange={e => { setFilters(v => ({ ...v, [key]: e.target.value })); setPage(1); }}><option value="">{label}</option>{choices[key].map(value => <option key={value} value={value}>{value}</option>)}</select>)}</div>
    {loading && !result ? <TableSkeleton columns={mode === "list" ? 5 : Math.max(3, selected.length + 1)} label="Memuat hasil ujian..." /> : !result?.total ? <div className="staff-empty"><h3>Belum ada hasil</h3><p>Hasil peserta tersedia setelah ujian selesai dan dikumpulkan. Periksa kembali filter yang digunakan.</p></div> : <><div className="staff-table-wrap"><table className="staff-table"><thead>{mode === "list" ? <tr><th>Peserta</th><th>Ujian</th><th>Nilai</th><th>Penilaian</th><th /></tr> : <tr><th>Peserta</th>{selected.map(e => <th key={e.id}>{e.title}<small>{e.subjectName || "—"} · {e.className || "—"} · {e.academicYear || "—"} · {e.semester || "—"}</small></th>)}</tr>}</thead><tbody>{mode === "list" ? attempts.map(({exam,student}) => <tr key={`${exam.id}-${student.studentId}`}><td><strong>{student.name}</strong><small>{student.nisn}</small></td><td>{exam.title}<small>{exam.className || "—"} · {exam.academicYear || "—"} · {exam.semester || "—"}</small></td><td>{student.pendingManualCount ? "—" : student.finalScore}</td><td>{student.pendingManualCount ? "Menunggu penilaian" : exam.passingScore == null ? "Final" : student.finalScore >= exam.passingScore ? "Lulus" : "Belum lulus"}</td><td><MotionButton onClick={() => void openDetail(exam,student)}>Lihat jawaban</MotionButton></td></tr>) : students.map(student => <tr key={student.nisn}><td><strong>{student.name}</strong><small>{student.nisn}</small></td>{selected.map(exam => { const score = student.scores[exam.id]; return <td key={exam.id}>{!score ? "—" : score.pendingManualCount ? "Menunggu penilaian" : score.finalScore}</td>; })}</tr>)}</tbody></table></div><nav className="staff-pagination" aria-label="Halaman hasil"><span>Halaman {result.page} dari {result.totalPages} · {result.total} {mode === "list" ? "pengerjaan" : "peserta"}</span><div><MotionButton className="staff-secondary" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Sebelumnya</MotionButton><MotionButton className="staff-secondary" disabled={page >= result.totalPages} onClick={() => setPage(value => value + 1)}>Berikutnya</MotionButton></div></nav></>}
    <Dialog open={!!detail} title={`Jawaban ${detail?.student.name || "peserta"}`} onClose={() => setDetail(null)}>{detail && <div className="staff-editor"><ErrorText error={error}/>{detail.data.answers.map(q => <section className="staff-question" key={q.questionId}><strong>Soal {q.orderIndex}</strong><QuestionContent text={q.questionText} content={q.content} imageUrl={q.imageUrl} imageAlt={q.imageAlt}/><p>Jawaban: {q.selectedOption || "Tidak dijawab"}</p>{q.type === "short_answer" && q.selectedOption && <><p>{q.isCorrect === null ? "Menunggu penilaian" : q.isCorrect ? "Benar" : "Salah"}</p><div className="staff-action-wrap"><MotionButton disabled={busy} onClick={() => void grade(q.questionId,true)}>Tandai benar</MotionButton><MotionButton disabled={busy} onClick={() => void grade(q.questionId,false)}>Tandai salah</MotionButton></div></>}</section>)}</div>}</Dialog>
  </>;
}
