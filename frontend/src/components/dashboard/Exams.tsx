"use client";

import { MotionButton } from "@/components/MotionButton";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion, LayoutGroup } from "framer-motion";
import { Dialog } from "@/components/Dialog";
import { QuestionContent } from "@/components/QuestionContent";
import { getCurrentAcademicPeriod } from "@/lib/academic-year";
import { staffApi, staffSend } from "@/lib/staff-api";
import { queryCache } from "@/lib/data-cache";
import { motionTokens } from "@/lib/motion";
import { ExamListSkeleton, ExamQuestionSkeleton } from "@/components/skeletons";
import type { Question } from "@/lib/api";
import { ErrorText, Icon, message } from "./Dashboard";
import type { Bank, Classroom, Exam, GradeLevel, Subject } from "./types";
import { HierarchyBreadcrumb, HierarchyCard, useHierarchyNavigation } from "./HierarchyNavigation";

type Form = {
  title: string;
  description: string;
  gradeLevelId: string;
  classroomId: string;
  subjectId: string;
  className: string;
  academicYear: string;
  semester: string;
  category: string;
  categoryNumber: string;
  durationMinutes: string;
  scheduledStartAt: string;
  bankId: string;
  passingScore: string;
  maxViolations: string;
  randomQuestions: boolean;
  randomOptions: boolean;
  showScore: boolean;
  review: boolean;
  displayMode: string;
  screenshot: boolean;
  devtools: boolean;
  focus: boolean;
  fullscreen: boolean;
  ip: boolean;
};

type HierarchicalSubject = {
  subjectId: string | null;
  subjectName: string;
  gradeLevelName: string | null;
  totalExams: number;
  activeExams: number;
  exams: Exam[];
};

type HierarchicalClassroom = {
  classroomId: string | null;
  className: string;
  classNameMissing?: boolean;
  gradeLevelId: string | null;
  gradeLevelName: string | null;
  totalExams: number;
  activeExams: number;
  subjects: HierarchicalSubject[];
};

const currentPeriod = getCurrentAcademicPeriod();

const initial: Form = {
  title: "",
  description: "",
  gradeLevelId: "",
  classroomId: "",
  subjectId: "",
  className: "",
  academicYear: currentPeriod.academicYear,
  semester: currentPeriod.semester,
  category: "Quiz",
  categoryNumber: "",
  durationMinutes: "60",
  scheduledStartAt: "",
  bankId: "",
  passingScore: "75",
  maxViolations: "3",
  randomQuestions: true,
  randomOptions: true,
  showScore: true,
  review: false,
  displayMode: "one_by_one",
  screenshot: true,
  devtools: true,
  focus: true,
  fullscreen: true,
  ip: true,
};

const stepNames = ["Informasi", "Pilih soal", "Aturan & Simpan"];

export function Exams({ teacherRole }: { teacherRole?: "ADMIN" | "TEACHER" } = {}) {
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();

  const [isCreating, setIsCreating] = useState(() => searchParams.get("create") === "true");
  const [activeStep, setActiveStep] = useState(0);
  const [rolloverOpen, setRolloverOpen] = useState(false);
  const [rolloverConfirmed, setRolloverConfirmed] = useState(false);
  const [rolloverBusy, setRolloverBusy] = useState(false);
  const [rolloverNotice, setRolloverNotice] = useState("");
  const [editing, setEditing] = useState<Exam | null>(null);
  const [replaceQuestions, setReplaceQuestions] = useState(false);
  const [view, setView] = useState<Exam | null>(null);
  const [preview, setPreview] = useState<Question[] | null>(null);
  const [form, setForm] = useState<Form>(initial);

  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bank, setBank] = useState<Bank | null>(null);
  const [ids, setIds] = useState<string[]>([]);
  const [filter, setFilter] = useState(() => searchParams.get("search") || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // View mode and groups
  const [viewMode, setViewMode] = useState<"hierarchy" | "flat">("hierarchy");
  const [groups, setGroups] = useState<HierarchicalClassroom[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const { selectedGradeId, selectedClassroomId, setSelectedGradeId, setSelectedClassroomId } = useHierarchyNavigation();

  const gradeLevelExamStats = useMemo(() => {
    const levels = groups.some(g => !g.gradeLevelId) ? [...gradeLevels, { id: "__unmapped__", name: "Perlu dipetakan" }] : gradeLevels;
    return levels.map((gl) => {
      const matchingGroups = groups.filter(g => gl.id === "__unmapped__" ? !g.gradeLevelId : g.gradeLevelId === gl.id);
      matchingGroups.push(...classrooms.filter(c => c.gradeLevelId === gl.id && !matchingGroups.some(g => g.classroomId === c.id))
        .map(c => ({ classroomId: c.id, className: c.name, gradeLevelId: c.gradeLevelId, gradeLevelName: gl.name, totalExams: 0, activeExams: 0, subjects: [] })));
      const totalClasses = matchingGroups.length;
      const totalExams = matchingGroups.reduce((acc, g) => acc + g.totalExams, 0);
      const activeExams = matchingGroups.reduce((acc, g) => acc + g.activeExams, 0);

      return {
        ...gl,
        totalClasses,
        totalExams,
        activeExams,
        classes: matchingGroups,
      };
    });
  }, [gradeLevels, groups, classrooms]);

  const currentGrade = useMemo(() => {
    if (!selectedGradeId) return null;
    return gradeLevelExamStats.find((gl) => gl.id === selectedGradeId) || null;
  }, [gradeLevelExamStats, selectedGradeId]);

  const classesInCurrentGrade = useMemo(() => {
    if (!currentGrade) return [];
    return currentGrade.classes;
  }, [currentGrade]);

  const selectedClassGroup = useMemo(() => {
    if (!selectedClassroomId) return null;
    return classesInCurrentGrade.find((g) => (g.classroomId || g.className) === selectedClassroomId) || null;
  }, [classesInCurrentGrade, selectedClassroomId]);

  // Duplicate modal
  const [duplicateModalExam, setDuplicateModalExam] = useState<Exam | null>(null);
  const [dupTargetClassroomId, setDupTargetClassroomId] = useState("");
  const [dupTitle, setDupTitle] = useState("");
  const [dupSubjectId, setDupSubjectId] = useState("");
  const [dupBusy, setDupBusy] = useState(false);

  const [filters, setFilters] = useState(() => ({
    status: searchParams.get("status") || "",
    gradeLevelId: "",
    subject: searchParams.get("subject") || "",
    className: searchParams.get("className") || "",
    academicYear: searchParams.get("academicYear") || "",
    semester: searchParams.get("semester") || "",
    category: searchParams.get("category") || "",
  }));

  const [shown, setShown] = useState<Exam[]>(() => {
    const initial = queryCache.get<{ items: Exam[]; nextCursor: string | null }>("/api/exams?limit=25");
    return initial ? initial.data.items : [];
  });
  const [nextCursor, setNextCursor] = useState<string | null>(() => {
    const initial = queryCache.get<{ items: Exam[]; nextCursor: string | null }>("/api/exams?limit=25");
    return initial ? initial.data.nextCursor : null;
  });
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [cursorIndex, setCursorIndex] = useState(0);
  const [listLoading, setListLoading] = useState(() => {
    const initial = queryCache.get<{ items: Exam[]; nextCursor: string | null }>("/api/exams?limit=25");
    return !initial;
  });
  const requestNumber = useRef(0);

  // Load master data
  useEffect(() => {
    let active = true;
    Promise.all([
      staffApi<GradeLevel[]>("/api/academic/grade-levels"),
      staffApi<Classroom[]>("/api/academic/classrooms"),
      staffApi<Subject[]>("/api/subjects"),
      staffApi<Bank[]>("/api/question-banks"),
    ])
      .then(([gls, cls, subs, bks]) => {
        if (!active) return;
        setGradeLevels(gls);
        setClassrooms(cls);
        setSubjects(subs);
        setBanks(bks);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const parameters = useMemo(() => {
    const params = new URLSearchParams({ limit: "25" });
    if (viewMode === "flat" && selectedClassroomId) {
      if (classrooms.some(c => c.id === selectedClassroomId)) params.set("classroomId", selectedClassroomId);
      else {
        const missingName = groups.some(g => !g.classroomId && g.className === selectedClassroomId && g.gradeLevelId === (selectedGradeId === "__unmapped__" ? null : selectedGradeId) && g.classNameMissing);
        if (missingName) params.set("missingClassName", "true"); else params.set("className", selectedClassroomId);
        params.set("unmappedClassroom", "true");
        if (selectedGradeId === "__unmapped__") params.set("unmappedGrade", "true");
        else if (selectedGradeId) params.set("gradeLevelId", selectedGradeId);
      }
    }
    if (filter.trim()) params.set("search", filter.trim());
    for (const [key, value] of Object.entries(filters)) {
      if (key === "className" && selectedClassroomId) continue;
      if (value.trim()) params.set(key, value.trim());
    }
    const cursor = cursors[cursorIndex];
    if (cursor) params.set("cursor", cursor);
    return params.toString();
  }, [filter, filters, cursors, cursorIndex, viewMode, selectedClassroomId, selectedGradeId, classrooms, groups]);

  const reload = useCallback(async (force = false) => {
    const request = ++requestNumber.current;
    const currentKey = `/api/exams?${parameters}`;
    const cached = queryCache.get<{ items: Exam[]; nextCursor: string | null }>(currentKey);
    if (!cached || force) {
      if (!shown.length) setListLoading(true);
    }

    const groupParams = new URLSearchParams();
    if (filter.trim()) groupParams.set("search", filter.trim());
    if (filters.gradeLevelId) groupParams.set("gradeLevelId", filters.gradeLevelId);
    if (filters.subject) groupParams.set("subject", filters.subject);
    if (filters.className) groupParams.set("className", filters.className);
    if (filters.academicYear) groupParams.set("academicYear", filters.academicYear);
    if (filters.semester) groupParams.set("semester", filters.semester);
    if (filters.category) groupParams.set("category", filters.category);
    if (filters.status) groupParams.set("status", filters.status);

    try {
      setGroupsLoading(true);
      const [data, groupData] = await Promise.all([
        queryCache.fetch<{ items: Exam[]; nextCursor: string | null }>(
          currentKey,
          () => staffApi<{ items: Exam[]; nextCursor: string | null }>(currentKey),
          60000
        ),
        staffApi<HierarchicalClassroom[]>(`/api/exams/groups?${groupParams}`),
      ]);

      if (request === requestNumber.current) {
        setShown(data.items);
        setNextCursor(data.nextCursor);
        const rawGroups = (groupData as { groups?: HierarchicalClassroom[] })?.groups ?? groupData;
        setGroups(Array.isArray(rawGroups) ? rawGroups : []);
        setError("");
      }
    } catch (e) {
      if (request === requestNumber.current) setError(message(e));
    } finally {
      if (request === requestNumber.current) {
        setListLoading(false);
        setGroupsLoading(false);
      }
    }
  }, [parameters, filter, filters, shown.length]);

  useEffect(() => {
    const url = new URLSearchParams(parameters);
    url.delete("limit");
    url.delete("cursor");
    url.delete("classroomId");
    url.delete("unmappedClassroom");
    url.delete("unmappedGrade");
    url.delete("missingClassName");
    if (!filters.className) url.delete("className");
    if (selectedGradeId) url.set("gradeLevelId", selectedGradeId);
    if (selectedClassroomId) url.set("classroomId", selectedClassroomId);
    window.history.replaceState(window.history.state, "", `/dashboard/ujian${url.size ? `?${url}` : ""}`);
    const timer = window.setTimeout(() => void reload(), 180);
    const counter = requestNumber;
    return () => {
      window.clearTimeout(timer);
      counter.current++;
    };
  }, [parameters, reload, selectedGradeId, selectedClassroomId, filters.className]);

  function setExamFilter(key: keyof typeof filters, value: string) {
    setFilters(current => ({ ...current, [key]: value }));
    setCursors([null]);
    setCursorIndex(0);
  }

  useEffect(() => {
    if (!open) return;
    void Promise.all([staffApi<Subject[]>("/api/subjects"), staffApi<Bank[]>("/api/question-banks")])
      .then(([s, b]) => {
        setSubjects(s);
        setBanks(b);
      })
      .catch(e => setError(message(e)));
  }, [isCreating, editing]);

  useEffect(() => {
    if (!form.bankId) return;
    let live = true;
    staffApi<Bank>(`/api/question-banks/${form.bankId}`)
      .then(b => {
        if (live) {
          setBank(b);
          setIds((b.questions || []).flatMap(q => (q.id ? [q.id] : [])));
        }
      })
      .catch(e => setError(message(e)));
    return () => {
      live = false;
    };
  }, [form.bankId]);

  function change<K extends keyof Form>(key: K, value: Form[K]) {
    setForm(v => ({ ...v, [key]: value }));
  }

  function validateStep(step: number): boolean {
    setError("");
    if (step === 0) {
      if (form.title.trim().length < 3) {
        setError("Nama ujian minimal 3 karakter.");
        return false;
      }
      if (!form.subjectId) {
        setError("Pilih mata pelajaran ujian.");
        return false;
      }
      if (!form.className.trim()) {
        setError("Masukkan kelas ujian (misalnya: 10-A).");
        return false;
      }
      const duration = Number(form.durationMinutes);
      if (isNaN(duration) || duration < 5 || duration > 360) {
        setError("Durasi ujian harus antara 5 hingga 360 menit.");
        return false;
      }
      return true;
    }
    if (step === 1) {
      if ((!editing || replaceQuestions) && (!bank || bank.id !== form.bankId || !ids.length)) {
        setError("Pilih bank soal dan setidaknya satu butir soal.");
        return false;
      }
      return true;
    }
    return true;
  }

  function nextStep() {
    if (validateStep(activeStep)) {
      setActiveStep(current => Math.min(2, current + 1));
    }
  }

  function prevStep() {
    setError("");
    setActiveStep(current => Math.max(0, current - 1));
  }

  async function handleRollover() {
    if (!rolloverConfirmed) return;
    setRolloverBusy(true);
    setError("");
    try {
      const res = await staffSend<{ archivedCount: number; period: { academicYear: string; semester: string } }>(
        "/api/admin/academic-year/rollover",
        "POST"
      );
      setRolloverOpen(false);
      setRolloverConfirmed(false);
      setRolloverNotice(
        `Tahun ajaran baru dimulai (${res.period.academicYear} · semester ${res.period.semester}). Sebanyak ${res.archivedCount} ujian lama berhasil diarsipkan.`
      );
      queryCache.invalidate("/api/exams");
      queryCache.invalidate("/api/dashboard/overview");
      await reload(true);
    } catch (e) {
      setError(message(e));
    } finally {
      setRolloverBusy(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!validateStep(0) || !validateStep(1)) return;

    const passing = Number(form.passingScore);
    if (isNaN(passing) || passing < 0 || passing > 100) {
      setError("Nilai kelulusan harus antara 0 dan 100.");
      return;
    }
    const maxV = Number(form.maxViolations);
    if (isNaN(maxV) || maxV < 1) {
      setError("Batas pelanggaran minimal 1.");
      return;
    }

    setBusy(true);
    try {
      const rawCatNum = form.categoryNumber ? parseInt(form.categoryNumber, 10) : null;
      const categoryNumber = rawCatNum && !isNaN(rawCatNum) && rawCatNum > 0 ? rawCatNum : null;

      let scheduleIso: string | null = null;
      if (form.scheduledStartAt) {
        const d = new Date(form.scheduledStartAt);
        if (!isNaN(d.getTime())) {
          scheduleIso = d.toISOString();
        }
      }

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        classroomId: form.classroomId || null,
        className: form.className.trim(),
        academicYear: (form.academicYear || currentPeriod.academicYear).trim(),
        semester: form.semester,
        category: form.category.trim() || "Quiz",
        categoryNumber,
        durationMinutes: Number(form.durationMinutes),
        scheduledStartAt: scheduleIso,
        passingScore: passing,
        ...(editing ? { revision: editing.revision } : { subjectId: form.subjectId }),
        ...(!editing || replaceQuestions ? { bankId: bank!.id, bankRevision: bank!.revision, questionIds: ids } : {}),
        settings: {
          ...(!editing || replaceQuestions ? { bank_id: bank!.id, bank_title: bank!.title } : {}),
          randomize_questions: form.randomQuestions,
          randomize_choices: form.randomOptions,
          show_score_to_student: form.showScore,
          allow_answer_review: form.review,
          display_mode: form.displayMode,
        },
        violationPolicy: {
          max_violations: maxV,
          action: "lock",
          detect_screenshot: form.screenshot,
          detect_devtools: form.devtools,
          detect_tab_switch: form.focus,
          detect_fullscreen_exit: form.fullscreen,
          detect_ip_change: form.ip,
          detect_right_click: false,
          detect_copy_paste: false,
        },
      };

      await staffSend(editing ? `/api/exams/${editing.id}` : "/api/exams", editing ? "PUT" : "POST", payload);
      setIsCreating(false);
      setEditing(null);
      setForm(initial);
      setActiveStep(0);
      await reload();
    } catch (err: unknown) {
      const errorObj = err as { status?: number; message?: string };
      if (errorObj?.status === 409 || errorObj?.message?.includes("Bank soal berubah")) {
        setError("Bank soal telah diperbarui. Pilihan input ujian Anda tetap tersimpan. Silakan periksa kembali dan muat ulang soal.");
      } else {
        setError(message(err));
      }
    } finally {
      setBusy(false);
    }
  }

  function editExam(exam: Exam) {
    const settings = exam.settings || {};
    const policy = exam.violationPolicy || {};
    const date = exam.scheduledStartAt ? new Date(exam.scheduledStartAt) : null;
    const local = date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
    const cls = classrooms.find(c => c.id === exam.classroomId);

    setEditing(exam);
    setIsCreating(false);
    setReplaceQuestions(false);
    setError("");
    setForm({
      ...initial,
      title: exam.title,
      description: exam.description || "",
      gradeLevelId: cls?.gradeLevelId || exam.classroom?.gradeLevelId || "",
      classroomId: exam.classroomId || "",
      subjectId: exam.subjectId || "",
      className: exam.className || "",
      academicYear: exam.academicYear || "",
      semester: exam.semester || "ganjil",
      category: exam.category || "Quiz",
      categoryNumber: exam.categoryNumber ? String(exam.categoryNumber) : "",
      durationMinutes: String(exam.durationMinutes),
      scheduledStartAt: local,
      passingScore: String(exam.passingScore ?? 75),
      maxViolations: String(policy.max_violations ?? 3),
      randomQuestions: settings.randomize_questions !== false,
      randomOptions: settings.randomize_choices !== false,
      showScore: settings.show_score_to_student !== false,
      review: settings.allow_answer_review === true,
      displayMode: String(settings.display_mode || "one_by_one"),
      screenshot: policy.detect_screenshot !== false,
      devtools: policy.detect_devtools !== false,
      focus: policy.detect_tab_switch !== false,
      fullscreen: policy.detect_fullscreen_exit !== false,
      ip: policy.detect_ip_change !== false,
    });
    setActiveStep(0);
  }

  async function openPreview(exam: Exam) {
    setView(exam);
    setPreview(null);
    setError("");
    try {
      const result = await staffApi<{ questions: Question[] }>(`/api/exams/${exam.id}/questions/preview`);
      setPreview(result.questions);
    } catch (e) {
      setError(message(e));
    }
  }

  function openDuplicateModal(exam: Exam) {
    setDuplicateModalExam(exam);
    setDupTitle(`${exam.title} (Salinan)`);
    setDupTargetClassroomId(exam.classroomId || "");
    setDupSubjectId(exam.subjectId || "");
    setError("");
  }

  async function handleConfirmDuplicate(e: React.FormEvent) {
    e.preventDefault();
    if (!duplicateModalExam) return;
    setDupBusy(true);
    setError("");
    try {
      await staffSend(`/api/exams/${duplicateModalExam.id}/duplicate`, "POST", {
        title: dupTitle.trim(),
        targetClassroomId: dupTargetClassroomId || undefined,
        subjectId: dupSubjectId || undefined,
      });
      setDuplicateModalExam(null);
      queryCache.invalidate("/api/exams");
      queryCache.invalidate("/api/dashboard/overview");
      await reload(true);
    } catch (err) {
      setError(message(err));
    } finally {
      setDupBusy(false);
    }
  }

  // Tampilan Buat Ujian In-Place (Layout bergaya input kode siswa, Sidenav tetap ada)
  if (isCreating) {
    return (
      <motion.section
        className="entry exam-creator-entry"
        aria-labelledby="entry-title"
        initial={reduceMotion ? false : { opacity: 0.85, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <MotionButton
          className="back-button"
          type="button"
          onClick={() => {
            setIsCreating(false);
            setEditing(null);
            setError("");
          }}
        >
          ← Kembali ke daftar ujian
        </MotionButton>

        <ol className="steps" aria-label="Tahapan buat ujian">
          {stepNames.map((label, index) => (
            <li
              key={label}
              className={index === activeStep ? "current" : index < activeStep ? "complete" : ""}
              onClick={() => {
                if (index < activeStep) setActiveStep(index);
                else if (index === activeStep + 1) nextStep();
              }}
              style={{ cursor: index <= activeStep ? "pointer" : "default" }}
            >
              {index < stepNames.length - 1 && (
                <span className="step-connector" aria-hidden="true">
                  <motion.span
                    initial={false}
                    animate={{ scaleX: index < activeStep ? 1 : 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.22 }}
                  />
                </span>
              )}
              <span className="step-number">{index + 1}</span>
              <span>{label}</span>
            </li>
          ))}
        </ol>

        <div className="entry-frame">
          <div className="entry-card-surface" />
          <div className="entry-body">
            <form onSubmit={save} noValidate>
              {activeStep === 0 && (
                <>
                  <h1 id="entry-title">{editing ? "Edit ujian" : "Buat ujian baru"}</h1>
                  <p className="lead">
                    {editing
                      ? "Perbarui informasi dasar pelaksanaan ujian."
                      : "Lengkapi nama ujian, kelas, dan jadwal pelaksanaan."}
                  </p>

                  <div className="exam-creator-field">
                    <label className="field-label" htmlFor="exam-title">
                      Nama ujian *
                    </label>
                    <input
                      id="exam-title"
                      required
                      minLength={3}
                      placeholder="Contoh: Penilaian Harian Matematika Bab 1"
                      value={form.title}
                      onChange={e => change("title", e.target.value)}
                    />
                  </div>

                  <div className="exam-creator-grid">
                    <div className="exam-creator-field">
                      <label htmlFor="exam-grade-level">Tingkat *</label>
                      <select
                        id="exam-grade-level"
                        required
                        disabled={!!editing}
                        value={form.gradeLevelId}
                        onChange={e => {
                          const gId = e.target.value;
                          change("gradeLevelId", gId);
                          change("classroomId", "");
                          change("className", "");
                          change("subjectId", "");
                          change("bankId", "");
                        }}
                      >
                        <option value="">-- Pilih Tingkat --</option>
                        {gradeLevels.map(gl => (
                          <option key={gl.id} value={gl.id}>
                            {gl.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="exam-creator-field">
                      <label htmlFor="exam-class">Kelas *</label>
                      <select
                        id="exam-class"
                        required
                        disabled={!!editing || !form.gradeLevelId}
                        value={form.classroomId}
                        onChange={e => {
                          const cId = e.target.value;
                          const cls = classrooms.find(c => c.id === cId);
                          change("classroomId", cId);
                          change("className", cls?.name || "");
                        }}
                      >
                        <option value="">{form.gradeLevelId ? "-- Pilih Kelas --" : "-- Pilih Tingkat Terlebih Dahulu --"}</option>
                        {classrooms
                          .filter(c => !form.gradeLevelId || c.gradeLevelId === form.gradeLevelId)
                          .map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="exam-creator-field">
                    <label htmlFor="exam-subject">Mata pelajaran *</label>
                    <select
                      id="exam-subject"
                      required
                      disabled={!!editing || !form.gradeLevelId}
                      value={form.subjectId}
                      onChange={e => {
                        change("subjectId", e.target.value);
                        change("bankId", "");
                      }}
                    >
                      <option value="">{form.gradeLevelId ? "-- Pilih Mata Pelajaran --" : "-- Pilih Tingkat Terlebih Dahulu --"}</option>
                      {subjects
                        .filter(s => !form.gradeLevelId || s.gradeLevelId === form.gradeLevelId)
                        .map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name}{s.gradeLevel ? ` · ${s.gradeLevel.name}` : ""}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="exam-creator-field">
                    <label>Periode kalender akademik</label>
                    <div style={{ background: "#f8f8fa", border: "1px solid #e5e4ea", borderRadius: "10px", padding: "8px 12px", fontSize: "11px", color: "#17171a", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <span>Tahun ajaran: <strong>{form.academicYear || currentPeriod.academicYear}</strong></span>
                      <span style={{ opacity: 0.35 }}>|</span>
                      <span>Semester: <strong>{form.semester === "ganjil" ? "Ganjil" : "Genap"}</strong></span>
                      <span style={{ marginLeft: "auto", fontSize: "10px", color: "#7867d9", fontWeight: 600 }}>Tahun ajaran aktif</span>
                    </div>
                  </div>

                  <div className="exam-creator-grid">
                    <div className="exam-creator-field">
                      <label htmlFor="exam-category">Kategori ujian</label>
                      <input
                        id="exam-category"
                        required
                        list="exam-categories"
                        placeholder="Pilih atau ketik..."
                        value={form.category}
                        onChange={e => change("category", e.target.value)}
                      />
                      <datalist id="exam-categories">
                        <option value="Quiz" />
                        <option value="Tugas" />
                        <option value="UTS" />
                        <option value="UAS" />
                        <option value="Ulangan Harian" />
                        <option value="Tryout" />
                      </datalist>
                    </div>

                    <div className="exam-creator-field">
                      <label htmlFor="exam-category-number">
                        Nomor ke- <small>(opsional)</small>
                      </label>
                      <input
                        id="exam-category-number"
                        type="number"
                        min="1"
                        placeholder="Misal: 1, 2"
                        value={form.categoryNumber}
                        onChange={e => change("categoryNumber", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="exam-creator-grid">
                    <div className="exam-creator-field">
                      <label htmlFor="exam-duration">Durasi pengerjaan (menit) *</label>
                      <input
                        id="exam-duration"
                        required
                        type="number"
                        min="5"
                        max="360"
                        placeholder="60"
                        value={form.durationMinutes}
                        onChange={e => change("durationMinutes", e.target.value)}
                      />
                    </div>

                    <div className="exam-creator-field">
                      <label htmlFor="exam-schedule">
                        Jadwal mulai <small>({Intl.DateTimeFormat().resolvedOptions().timeZone})</small>
                      </label>
                      <input
                        id="exam-schedule"
                        type="datetime-local"
                        value={form.scheduledStartAt}
                        onChange={e => change("scheduledStartAt", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="exam-creator-field" style={{ marginTop: 14 }}>
                    <label htmlFor="exam-description">
                      Petunjuk / Deskripsi ujian <small>(opsional)</small>
                    </label>
                    <textarea
                      id="exam-description"
                      placeholder="Tuliskan petunjuk pengerjaan bagi peserta..."
                      value={form.description}
                      onChange={e => change("description", e.target.value)}
                    />
                  </div>

                  {error && <p className="error" role="alert">{error}</p>}

                  <div className="exam-creator-actions">
                    <MotionButton
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setIsCreating(false);
                        setEditing(null);
                        setError("");
                      }}
                    >
                      Batal
                    </MotionButton>
                    <MotionButton
                      type="button"
                      className="primary-button"
                      onClick={nextStep}
                    >
                      Lanjutkan ke pilihan soal →
                    </MotionButton>
                  </div>
                </>
              )}

              {activeStep === 1 && (
                <>
                  <h1 id="entry-title">Pilih butir soal</h1>
                  <p className="lead">Tentukan bank soal sumber dan butir pertanyaan yang akan diujikan.</p>

                  {editing && (
                    <label className="exam-creator-check-card" style={{ marginBottom: 14 }}>
                      <input
                        type="checkbox"
                        checked={replaceQuestions}
                        onChange={e => {
                          setReplaceQuestions(e.target.checked);
                          change("bankId", e.target.checked ? String(editing.settings?.bank_id || "") : "");
                        }}
                      />
                      <span>Ganti bank soal atau pilihan butir soal ujian ini</span>
                    </label>
                  )}

                  {editing && !replaceQuestions ? (
                    <div style={{ background: "#f8f7fb", padding: "12px 16px", borderRadius: 12, border: "1px dashed #d5cce6", color: "#504764", fontSize: 11, lineHeight: 1.5, marginBottom: 18 }}>
                      Soal yang telah disalin ke ujian ini akan tetap digunakan tanpa perubahan.
                    </div>
                  ) : (
                    <>
                      <div className="exam-creator-field">
                        <label htmlFor="exam-bank">Pilih bank soal *</label>
                        <select
                          id="exam-bank"
                          required
                          value={form.bankId}
                          onChange={e => change("bankId", e.target.value)}
                        >
                          <option value="">-- Pilih bank soal --</option>
                          {banks
                            .filter(b => !form.subjectId || b.subjectId === form.subjectId)
                            .map(b => (
                              <option value={b.id} key={b.id}>
                                {b.title} {b.targetGrade ? `(Tingkat ${b.targetGrade})` : ""} ({b._count.questions} soal)
                              </option>
                            ))}
                        </select>
                      </div>

                      {bank && bank.id === form.bankId && (
                        <div style={{ marginTop: 16 }}>
                          <div className="exam-select-toolbar">
                            <span>Daftar butir soal ({ids.length} dari {bank.questions?.length || 0} dipilih)</span>
                            <div style={{ display: "flex", gap: 12 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  const all = (bank.questions || []).flatMap(q => (q.id ? [q.id] : []));
                                  setIds(all);
                                }}
                              >
                                Pilih semua
                              </button>
                              <button
                                type="button"
                                onClick={() => setIds([])}
                              >
                                Kosongkan
                              </button>
                            </div>
                          </div>

                          <div className="exam-question-selector">
                            {(bank.questions || []).map((q, i) => (
                              <label key={q.id || i} className="exam-question-item">
                                <input
                                  type="checkbox"
                                  checked={!!q.id && ids.includes(q.id)}
                                  onChange={e => {
                                    if (!q.id) return;
                                    setIds(v => (e.target.checked ? [...v, q.id!] : v.filter(id => id !== q.id)));
                                  }}
                                />
                                <div>
                                  <strong>Soal {i + 1}: </strong>
                                  <QuestionContent text={q.questionText} content={q.content} />
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <h3 style={{ fontSize: 14, margin: "20px 0 6px", color: "var(--staff-ink)", fontWeight: 650, letterSpacing: "-.03em" }}>
                    Pengaturan urutan & tampilan
                  </h3>

                  <div className="exam-creator-checks">
                    <label className="exam-creator-check-card">
                      <input
                        type="checkbox"
                        checked={form.randomQuestions}
                        onChange={e => change("randomQuestions", e.target.checked)}
                      />
                      <span>Acak urutan butir soal</span>
                    </label>

                    <label className="exam-creator-check-card">
                      <input
                        type="checkbox"
                        checked={form.randomOptions}
                        onChange={e => change("randomOptions", e.target.checked)}
                      />
                      <span>Acak urutan pilihan jawaban</span>
                    </label>

                    <label className="exam-creator-check-card">
                      <input
                        type="checkbox"
                        checked={form.showScore}
                        onChange={e => change("showScore", e.target.checked)}
                      />
                      <span>Tampilkan nilai akhir ke siswa</span>
                    </label>

                    <label className="exam-creator-check-card">
                      <input
                        type="checkbox"
                        checked={form.review}
                        onChange={e => change("review", e.target.checked)}
                      />
                      <span>Izinkan review soal setelah selesai</span>
                    </label>
                  </div>

                  <div className="exam-creator-field">
                    <label htmlFor="exam-display-mode">Mode navigasi soal siswa</label>
                    <select
                      id="exam-display-mode"
                      value={form.displayMode}
                      onChange={e => change("displayMode", e.target.value)}
                    >
                      <option value="one_by_one">Satu per satu (Fokus per nomor)</option>
                      <option value="all_at_once">Sekaligus (Daftar memanjang)</option>
                    </select>
                  </div>

                  {error && <p className="error" role="alert">{error}</p>}

                  <div className="exam-creator-actions">
                    <MotionButton
                      type="button"
                      className="secondary-button"
                      onClick={prevStep}
                    >
                      ← Kembali ke informasi
                    </MotionButton>
                    <MotionButton
                      type="button"
                      className="primary-button"
                      onClick={nextStep}
                    >
                      Lanjutkan ke aturan & keamanan →
                    </MotionButton>
                  </div>
                </>
              )}

              {activeStep === 2 && (
                <>
                  <h1 id="entry-title">Aturan & keamanan proctoring</h1>
                  <p className="lead">Atur ambang batas pelanggaran otomatis dan kriteria kelulusan peserta.</p>

                  <div className="exam-creator-grid">
                    <div className="exam-creator-field">
                      <label htmlFor="exam-passing-score">Nilai kelulusan (KKM) *</label>
                      <input
                        id="exam-passing-score"
                        type="number"
                        min="0"
                        max="100"
                        required
                        value={form.passingScore}
                        onChange={e => change("passingScore", e.target.value)}
                      />
                    </div>

                    <div className="exam-creator-field">
                      <label htmlFor="exam-max-violations">Kunci ujian setelah berapa pelanggaran? *</label>
                      <input
                        id="exam-max-violations"
                        type="number"
                        min="1"
                        required
                        value={form.maxViolations}
                        onChange={e => change("maxViolations", e.target.value)}
                      />
                    </div>
                  </div>

                  <h3 style={{ fontSize: 14, margin: "20px 0 6px", color: "var(--staff-ink)", fontWeight: 650, letterSpacing: "-.03em" }}>
                    Deteksi kecurangan otomatis (Web Proctoring)
                  </h3>

                  <div className="exam-creator-checks">
                    <label className="exam-creator-check-card">
                      <input
                        type="checkbox"
                        checked={form.screenshot}
                        onChange={e => change("screenshot", e.target.checked)}
                      />
                      <span>Deteksi shortcut screenshot (PrtScn, Win+Shift+S)</span>
                    </label>

                    <label className="exam-creator-check-card">
                      <input
                        type="checkbox"
                        checked={form.devtools}
                        onChange={e => change("devtools", e.target.checked)}
                      />
                      <span>Deteksi shortcut Developer Tools (F12, Inspect)</span>
                    </label>

                    <label className="exam-creator-check-card">
                      <input
                        type="checkbox"
                        checked={form.focus}
                        onChange={e => change("focus", e.target.checked)}
                      />
                      <span>Deteksi pindah tab atau kehilangan fokus</span>
                    </label>

                    <label className="exam-creator-check-card">
                      <input
                        type="checkbox"
                        checked={form.fullscreen}
                        onChange={e => change("fullscreen", e.target.checked)}
                      />
                      <span>Deteksi keluar dari mode layar penuh (Fullscreen)</span>
                    </label>

                    <label className="exam-creator-check-card">
                      <input
                        type="checkbox"
                        checked={form.ip}
                        onChange={e => change("ip", e.target.checked)}
                      />
                      <span>Deteksi perubahan alamat IP peserta</span>
                    </label>
                  </div>

                  <p className="hint" style={{ marginTop: 8, lineHeight: 1.5 }}>
                    Catatan: Deteksi shortcut mendeteksi penekanan tombol kombinasi di browser. Sistem secara otomatis mencatat dan melaporkannya ke monitoring guru.
                  </p>

                  {error && <p className="error" role="alert">{error}</p>}

                  <div className="exam-creator-actions">
                    <MotionButton
                      type="button"
                      className="secondary-button"
                      onClick={prevStep}
                    >
                      ← Kembali ke soal
                    </MotionButton>
                    <MotionButton
                      type="submit"
                      className="primary-button"
                      disabled={busy}
                    >
                      {busy ? "Menyimpan ujian…" : editing ? "Perbarui ujian" : "Simpan & terbitkan ujian"}
                    </MotionButton>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      </motion.section>
    );
  }

  // Tampilan Daftar Ujian (Normal)
  return (
    <>
      <div className="staff-section-head" style={{ marginBottom: "12px" }}>
        <div>
          <h2>Daftar ujian</h2>
          <p>Pilih kelas untuk mengatur ujian, soal, dan kode akses pelaksanaan.</p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <MotionButton
            className="staff-primary"
            onClick={() => {
              setError("");
              setEditing(null);
              setReplaceQuestions(false);
              setForm(initial);
              setActiveStep(0);
              setIsCreating(true);
            }}
          >
            <Icon name="plus" size={16} /> Buat ujian
          </MotionButton>
          {teacherRole === "ADMIN" && (
            <MotionButton
              className="staff-secondary"
              onClick={() => {
                setError("");
                setRolloverOpen(true);
              }}
              title="Arsipkan seluruh ujian aktif/draf/selesai dan mulai tahun ajaran baru"
            >
              <Icon name="archive" size={16} /> Mulai Tahun Ajaran Baru
            </MotionButton>
          )}
        </div>
      </div>

      {rolloverNotice && <p role="status" className="staff-note" style={{ background: "#edfdf5", borderColor: "#c6f6d5", color: "#22543d" }}>{rolloverNotice}</p>}

      <ErrorText error={error} />
      <HierarchyBreadcrumb grade={currentGrade?.name} classroom={selectedClassGroup?.className} onRoot={() => setSelectedGradeId(null)} onGrade={() => setSelectedClassroomId(null)} />

      <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "10px", flexWrap: "wrap" }}>
        <input
          className="staff-search"
          style={{ flex: 1, minWidth: "240px", margin: 0 }}
          placeholder="Cari nama, kelas, mata pelajaran, atau periode"
          aria-label="Cari ujian"
          value={filter}
          onChange={e => {
            setFilter(e.target.value);
            setCursors([null]);
            setCursorIndex(0);
          }}
        />
        {selectedClassroomId && <LayoutGroup id="exams-view-mode-tabs">
          <div className="staff-segment" style={{ margin: 0 }} role="group" aria-label="Tampilan ujian">
            <motion.button
              type="button"
              className={viewMode === "hierarchy" ? "active" : ""}
              aria-pressed={viewMode === "hierarchy"}
              whileTap={reduceMotion ? undefined : { scale: 0.96 }}
              onClick={() => setViewMode("hierarchy")}
            >
              {viewMode === "hierarchy" && (
                <motion.span
                  layoutId="active-exams-view-mode"
                  className="staff-segment-thumb"
                  transition={reduceMotion ? { duration: 0 } : motionTokens.softSpring}
                />
              )}
              <span className="staff-segment-label">Per Kelas</span>
            </motion.button>
            <motion.button
              type="button"
              className={viewMode === "flat" ? "active" : ""}
              aria-pressed={viewMode === "flat"}
              whileTap={reduceMotion ? undefined : { scale: 0.96 }}
              onClick={() => setViewMode("flat")}
            >
              {viewMode === "flat" && (
                <motion.span
                  layoutId="active-exams-view-mode"
                  className="staff-segment-thumb"
                  transition={reduceMotion ? { duration: 0 } : motionTokens.softSpring}
                />
              )}
              <span className="staff-segment-label">Semua Ujian</span>
            </motion.button>
          </div>
        </LayoutGroup>}
      </div>

      <details className="staff-filter-panel">
        <summary>Filter ujian</summary>
        <div className="staff-result-filters">
          <label>
            Status
            <select value={filters.status} onChange={e => setExamFilter("status", e.target.value)}>
              <option value="">Semua status</option>
              <option value="draft">Persiapan</option>
              <option value="active">Berlangsung</option>
              <option value="ended">Selesai</option>
              <option value="archived">Diarsipkan</option>
            </select>
          </label>
          <label>
            Mata pelajaran
            <input value={filters.subject} onChange={e => setExamFilter("subject", e.target.value)} />
          </label>
          <label>
            Kelas
            <input value={filters.className} onChange={e => setExamFilter("className", e.target.value)} />
          </label>
          <label>
            Tahun ajaran
            <input value={filters.academicYear} onChange={e => setExamFilter("academicYear", e.target.value)} />
          </label>
          <label>
            Semester
            <select value={filters.semester} onChange={e => setExamFilter("semester", e.target.value)}>
              <option value="">Semua semester</option>
              <option value="ganjil">Ganjil</option>
              <option value="genap">Genap</option>
            </select>
          </label>
          <label>
            Kategori
            <input value={filters.category} onChange={e => setExamFilter("category", e.target.value)} />
          </label>
        </div>
      </details>

      {/* Render Mode: Tampilan per Kelas */}
      <motion.div
        key={`${viewMode}-${selectedGradeId || "root"}-${selectedClassroomId || "all"}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        style={{ display: "flex", flexDirection: "column", gap: "10px" }}
      >
        {viewMode === "hierarchy" || !selectedClassroomId ? (
        groupsLoading && !groups.length ? (
          <div className="drilldown-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="drilldown-card drilldown-theme-white" style={{ minHeight: "160px", opacity: 0.7 }}>
                <ExamListSkeleton />
              </div>
            ))}
          </div>
        ) : !selectedGradeId ? (
          /* TAHAP 1: PILIHAN TINGKATAN (STYLE OVERVIEW CARDS) */
          <div>
            <div className="drilldown-grid">
              {gradeLevelExamStats.map((gl, index) => <HierarchyCard key={gl.id} index={index} name={gl.id === "__unmapped__" ? gl.name : `Tingkat ${gl.name}`} count={`${gl.totalExams} ujian`} detail={`${gl.totalClasses} kelas · ${gl.activeExams} berlangsung`} onClick={() => setSelectedGradeId(gl.id)} />)}
            </div>
            {gradeLevelExamStats.length === 0 && (
              <div className="staff-empty">
                <h3>Belum ada tingkatan</h3>
                <p>Tambahkan tingkatan terlebih dahulu di menu Kelas &amp; Mapel.</p>
              </div>
            )}
          </div>
        ) : !selectedClassGroup ? (
          /* TAHAP 2: PILIHAN KELAS DI TINGKAT TERPILIH */
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "10px" }}>
            <div className="class-detail-banner">
              <div className="class-detail-info">
                <h3>Pilihan Kelas · Tingkat {currentGrade?.name}</h3>
                <p>
                  {classesInCurrentGrade.length} Kelas terdaftar · {currentGrade?.totalExams || 0} Ujian · {currentGrade?.activeExams || 0} Sedang aktif
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
              {classesInCurrentGrade.map((group) => {
                const boxKey = group.classroomId || group.className;
                const subjectNames = group.subjects.map((s) => s.subjectName).filter(Boolean);
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
                        <h3 className="class-box-name">{group.className}</h3>
                        <p style={{ fontSize: "11px", color: "var(--staff-muted)", margin: "2px 0 0" }}>
                          {subjectNames.length > 0 ? subjectNames.slice(0, 3).join(", ") : "Mata pelajaran"}
                          {subjectNames.length > 3 ? ` +${subjectNames.length - 3}` : ""}
                        </p>
                      </div>
                      <span className="class-box-badge">Tingkat {currentGrade?.name}</span>
                    </div>

                    <div className="class-box-stats">
                      <div className="class-box-stat-item">
                        <span className="class-box-stat-label">Total Ujian</span>
                        <span className="class-box-stat-val">{group.totalExams} Ujian</span>
                      </div>
                      <div className="class-box-stat-item">
                        <span className="class-box-stat-label">Sedang Aktif</span>
                        <span className="class-box-stat-val">{group.activeExams} Berlangsung</span>
                      </div>
                      <div className="class-box-stat-item">
                        <span className="class-box-stat-label">Mata Pelajaran</span>
                        <span className="class-box-stat-val">{group.subjects.length} Mapel</span>
                      </div>
                      <div className="class-box-stat-item">
                        <span className="class-box-stat-label">Status</span>
                        <span className="class-box-stat-val">{group.activeExams > 0 ? "Aktif" : "Tersedia"}</span>
                      </div>
                    </div>

                    <div className="class-box-footer">
                      <span>Buka Ujian Kelas</span>
                      <span>→</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            {classesInCurrentGrade.length === 0 && (
              <div className="staff-empty">
                <h3>Belum ada kelas atau ujian di Tingkat {currentGrade?.name}</h3>
                <p>Tambahkan kelas atau buat ujian pertama untuk tingkat ini.</p>
              </div>
            )}
          </div>
        ) : (
          /* TAHAP 3: DETAIL UJIAN DI KELAS TERPILIH */
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "10px" }}>
            <div className="class-detail-banner">
              <div className="class-detail-info">
                <h3>Ujian Kelas {selectedClassGroup.className}</h3>
                <p>
                  Tingkat {currentGrade?.name || selectedClassGroup.gradeLevelName || "—"} ·{" "}
                  {selectedClassGroup.totalExams} Ujian · {selectedClassGroup.activeExams} Berlangsung
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <MotionButton
                  className="staff-primary"
                  onClick={() => {
                    setError("");
                    setEditing(null);
                    setReplaceQuestions(false);
                    const targetClass = classrooms.find(
                      (c) => c.name === selectedClassGroup.className || c.id === selectedClassGroup.classroomId
                    );
                    setForm({
                      ...initial,
                      classroomId: targetClass?.id || "",
                      className: selectedClassGroup.className,
                      gradeLevelId: targetClass?.gradeLevelId || selectedClassGroup.gradeLevelId || "",
                    });
                    setActiveStep(0);
                    setIsCreating(true);
                  }}
                >
                  <Icon name="plus" size={14} /> Buat Ujian di Kelas Ini
                </MotionButton>
                <MotionButton
                  className="staff-secondary"
                  onClick={() => setSelectedClassroomId(null)}
                >
                  ← Kembali ke Daftar Kelas
                </MotionButton>
              </div>
            </div>

            <div className="subject-group-list">
              {!selectedClassGroup.subjects.length && <div className="staff-empty"><h3>Belum ada ujian di kelas ini</h3><p>Buat ujian untuk mulai mengatur soal dan jadwal.</p></div>}
              {selectedClassGroup.subjects.map((sub: HierarchicalSubject) => (
                <div key={sub.subjectId || sub.subjectName} className="subject-group-card">
                  <div className="subject-group-head">
                    <h4>{sub.subjectName}</h4>
                    <span className="subject-group-meta">{sub.exams.length} ujian</span>
                  </div>

                  <div className="hierarchical-exams-list">
                    {sub.exams.map((exam: Exam) => (
                      <div key={exam.id} className="hierarchical-exam-item">
                        <div className="hierarchical-exam-info">
                          <strong>{exam.title}</strong>
                          <div className="hierarchical-exam-meta">
                            <span className="staff-status">
                              {{ draft: "Persiapan", active: "Berlangsung", ended: "Selesai", archived: "Diarsipkan" }[exam.status]}
                            </span>
                            <span>·</span>
                            <span>Kode: {exam.accessCode}</span>
                            <span>·</span>
                            <span>{exam._count.questions} soal</span>
                            <span>·</span>
                            <span>{exam.durationMinutes} menit</span>
                          </div>
                        </div>
                        <div className="staff-row-actions">
                          <MotionButton onClick={() => void openPreview(exam)}>Preview</MotionButton>
                          {exam.status === "draft" && <MotionButton onClick={() => editExam(exam)}>Edit</MotionButton>}
                          <MotionButton onClick={() => openDuplicateModal(exam)}>Duplikasi</MotionButton>
                          <Link href={`/dashboard/monitoring?exam=${encodeURIComponent(exam.id)}&gradeLevelId=${encodeURIComponent(selectedGradeId)}&classroomId=${encodeURIComponent(selectedClassroomId)}`} className="action-link highlight">
                            Monitoring
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        /* Render Mode: Daftar Datar */
        listLoading && !shown.length ? (
          <ExamListSkeleton />
        ) : shown.length ? (
          <>
            <div className="staff-list">
              {shown.map(exam => (
                <div className="staff-row staff-exam-row" key={exam.id}>
                  <span>
                    <strong>{exam.title}</strong>
                    <small>
                      {exam.subjectName || "Belum dikelompokkan"} · {exam.className || "Kelas belum ditentukan"} ·{" "}
                      {exam._count.questions} soal
                    </small>
                  </span>
                  <span className="staff-status">
                    {{ draft: "Persiapan", active: "Berlangsung", ended: "Selesai", archived: "Diarsipkan" }[exam.status]}
                  </span>
                  <div className="staff-row-actions">
                    <MotionButton onClick={() => void openPreview(exam)}>Preview</MotionButton>
                    {exam.status === "draft" && <MotionButton onClick={() => editExam(exam)}>Edit</MotionButton>}
                    <MotionButton onClick={() => openDuplicateModal(exam)}>Duplikasi</MotionButton>
                    <Link href={`/dashboard/monitoring?exam=${encodeURIComponent(exam.id)}`}>Monitoring</Link>
                  </div>
                </div>
              ))}
            </div>
            <nav className="staff-pagination" aria-label="Halaman ujian">
              <span>{shown.length} ujian pada halaman ini</span>
              <div>
                <MotionButton
                  className="staff-secondary"
                  disabled={cursorIndex === 0}
                  onClick={() => setCursorIndex(i => i - 1)}
                >
                  Sebelumnya
                </MotionButton>
                <MotionButton
                  className="staff-secondary"
                  disabled={!nextCursor}
                  onClick={() => {
                    if (!nextCursor) return;
                    setCursors(current => [...current.slice(0, cursorIndex + 1), nextCursor]);
                    setCursorIndex(i => i + 1);
                  }}
                >
                  Berikutnya
                </MotionButton>
              </div>
            </nav>
          </>
        ) : (
          <div className="staff-empty">
            <h3>{filter ? "Ujian tidak ditemukan" : "Belum ada ujian"}</h3>
            <p>{filter ? "Coba kata pencarian lain." : "Buat ujian untuk mulai mengatur peserta dan soal."}</p>
          </div>
        )
      )}
      </motion.div>

      {/* Modal: Duplikasi Ujian */}
      <Dialog
        open={!!duplicateModalExam}
        title="Duplikasi Ujian"
        onClose={() => setDuplicateModalExam(null)}
      >
        <form onSubmit={handleConfirmDuplicate} className="academic-modal-form">
          <p>
            Duplikasi ujian <strong>{duplicateModalExam?.title}</strong> ke kelas lain.
          </p>

          <label htmlFor="dup-title">Judul Ujian Baru</label>
          <input
            id="dup-title"
            required
            className="staff-input"
            value={dupTitle}
            onChange={(e) => setDupTitle(e.target.value)}
          />

          <label htmlFor="dup-classroom">Kelas Tujuan</label>
          <select
            id="dup-classroom"
            required
            className="staff-input"
            value={dupTargetClassroomId}
            onChange={(e) => {
              setDupTargetClassroomId(e.target.value);
              const targetCls = classrooms.find(c => c.id === e.target.value);
              const sourceCls = duplicateModalExam?.classroomId ? classrooms.find(c => c.id === duplicateModalExam.classroomId) : null;
              if (targetCls && sourceCls && targetCls.gradeLevelId !== sourceCls.gradeLevelId) {
                setDupSubjectId("");
              } else {
                setDupSubjectId(duplicateModalExam?.subjectId || "");
              }
            }}
          >
            <option value="">-- Pilih Kelas Tujuan --</option>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.gradeLevel ? `· ${c.gradeLevel.name}` : ""}
              </option>
            ))}
          </select>

          {(() => {
            const targetCls = classrooms.find(c => c.id === dupTargetClassroomId);
            const sourceCls = duplicateModalExam?.classroomId ? classrooms.find(c => c.id === duplicateModalExam.classroomId) : null;
            const isCrossGrade = targetCls && sourceCls && targetCls.gradeLevelId !== sourceCls.gradeLevelId;

            if (isCrossGrade) {
              const matchingSubjects = subjects.filter(s => s.gradeLevelId === targetCls.gradeLevelId);
              return (
                <div style={{ marginTop: 8 }}>
                  <p className="staff-note" style={{ background: "#fffbeb", borderColor: "#fef3c7", color: "#92400e" }}>
                    Duplikasi ke tingkat berbeda mewajibkan pemilihan mata pelajaran dari tingkat yang dituju.
                  </p>
                  <label htmlFor="dup-subject">Mata Pelajaran Tingkat Tujuan</label>
                  <select
                    id="dup-subject"
                    required
                    className="staff-input"
                    value={dupSubjectId}
                    onChange={(e) => setDupSubjectId(e.target.value)}
                  >
                    <option value="">-- Pilih Mata Pelajaran --</option>
                    {matchingSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {targetCls.gradeLevel?.name}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }
            return null;
          })()}

          <ErrorText error={error} />

          <div className="modal-actions">
            <button
              type="button"
              className="staff-secondary"
              disabled={dupBusy}
              onClick={() => setDuplicateModalExam(null)}
            >
              Batal
            </button>
            <button
              type="submit"
              className="staff-primary"
              disabled={dupBusy || !dupTargetClassroomId || !dupTitle.trim()}
            >
              {dupBusy ? "Menduplikasi..." : "Duplikasi Ujian"}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Modal: Detail / Pratinjau Ujian */}
      <Dialog open={!!view} title="Detail ujian" onClose={() => setView(null)}>
        {view && (
          <div className="staff-form">
            <h3>{view.title}</h3>
            <p>{view.description || "Tidak ada deskripsi."}</p>
            <p>
              Kode akses: <strong>{view.accessCode}</strong>
            </p>
            <p>
              {view.durationMinutes} menit · {view._count.questions} soal · {view._count.students} peserta
            </p>
            <ErrorText error={error} />
            {preview ? (
              preview.map((q, i) => (
                <section key={q.id} className="staff-question">
                  <strong>Soal {i + 1}</strong>
                  <QuestionContent text={q.questionText} content={q.content} imageUrl={q.imageUrl} imageAlt={q.imageAlt} />
                  {q.options.map((o, j) => (
                    <p key={j}>
                      {typeof o === "string" ? (
                        o
                      ) : (
                        <QuestionContent text={o.text} content={o.content} imageUrl={o.imageUrl} imageAlt={o.imageAlt} />
                      )}
                    </p>
                  ))}
                </section>
              ))
            ) : (
              !error && <ExamQuestionSkeleton />
            )}
            <Link href={`/dashboard/monitoring?exam=${encodeURIComponent(view.id)}`} className="staff-primary staff-link-button">
              Buka monitoring <Icon name="arrow" size={16} />
            </Link>
          </div>
        )}
      </Dialog>

      <Dialog
        open={rolloverOpen}
        title="Mulai Tahun Ajaran Baru"
        onClose={() => {
          if (!rolloverBusy) {
            setRolloverOpen(false);
            setRolloverConfirmed(false);
          }
        }}
      >
        <div className="staff-form">
          <p>
            Tindakan ini akan mengarsipkan seluruh ujian yang berstatus <strong>Persiapan (Draf)</strong>, <strong>Berlangsung</strong>, atau <strong>Selesai</strong>.
          </p>
          <div className="staff-note" style={{ background: "#fff5f5", border: "1px solid #fed7d7", color: "#c53030", padding: "10px 14px", borderRadius: "8px" }}>
            Perhatian: Bank soal dan data guru tetap tersimpan aman. Siswa tidak lagi dapat mengakses ujian yang diarsipkan.
          </div>
          <label className="staff-check" style={{ marginTop: "12px", cursor: "pointer", display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type="checkbox"
              checked={rolloverConfirmed}
              onChange={(e) => setRolloverConfirmed(e.target.checked)}
            />
            Saya memahami dan mengonfirmasi pengarsipan massal ujian untuk tahun ajaran baru.
          </label>
          <ErrorText error={error} />
          <div className="staff-dialog-actions">
            <MotionButton
              type="button"
              className="staff-secondary"
              disabled={rolloverBusy}
              onClick={() => {
                setRolloverOpen(false);
                setRolloverConfirmed(false);
              }}
            >
              Batal
            </MotionButton>
            <MotionButton
              type="button"
              className="staff-primary"
              disabled={!rolloverConfirmed || rolloverBusy}
              onClick={() => void handleRollover()}
            >
              {rolloverBusy ? "Memproses…" : "Arsipkan & Mulai Baru"}
            </MotionButton>
          </div>
        </div>
      </Dialog>

      {/* Modal: Edit Ujian */}
      <Dialog open={!!editing} title="Edit ujian" onClose={() => setEditing(null)}>
        {editing && (
          <form className="staff-form" onSubmit={save}>
            <h3>Informasi ujian</h3>
            <label>
              Nama ujian
              <input
                required
                minLength={3}
                value={form.title}
                onChange={e => change("title", e.target.value)}
              />
            </label>
            <label>
              Deskripsi <span className="staff-muted">(opsional)</span>
              <textarea
                value={form.description}
                onChange={e => change("description", e.target.value)}
              />
            </label>
            <div className="staff-fields">
              <label>
                Mata pelajaran
                <select
                  required
                  disabled
                  value={form.subjectId}
                  onChange={e => {
                    change("subjectId", e.target.value);
                    change("bankId", "");
                  }}
                >
                  <option value="">Pilih mata pelajaran</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Kelas
                <input
                  required
                  value={form.className}
                  onChange={e => change("className", e.target.value)}
                />
              </label>
              <label>
                Tahun ajaran
                <input
                  required
                  placeholder="Contoh: 2026/2027"
                  value={form.academicYear}
                  onChange={e => change("academicYear", e.target.value)}
                />
              </label>
              <label>
                Semester
                <select
                  value={form.semester}
                  onChange={e => change("semester", e.target.value)}
                >
                  <option value="ganjil">Ganjil</option>
                  <option value="genap">Genap</option>
                </select>
              </label>
              <label>
                Kategori
                <input
                  required
                  list="exam-categories"
                  value={form.category}
                  onChange={e => change("category", e.target.value)}
                />
                <datalist id="exam-categories">
                  <option value="Quiz" />
                  <option value="Tugas" />
                  <option value="UTS" />
                  <option value="UAS" />
                </datalist>
              </label>
              <label>
                Nomor kategori (opsional)
                <input
                  type="number"
                  min="1"
                  value={form.categoryNumber}
                  onChange={e => change("categoryNumber", e.target.value)}
                />
              </label>
              <label>
                Durasi (menit)
                <input
                  required
                  type="number"
                  min="5"
                  max="360"
                  value={form.durationMinutes}
                  onChange={e => change("durationMinutes", e.target.value)}
                />
              </label>
              <label>
                Jadwal mulai <small>({Intl.DateTimeFormat().resolvedOptions().timeZone})</small>
                <input
                  type="datetime-local"
                  value={form.scheduledStartAt}
                  onChange={e => change("scheduledStartAt", e.target.value)}
                />
              </label>
            </div>

            <h3>Soal</h3>
            <label className="staff-check">
              <input
                type="checkbox"
                checked={replaceQuestions}
                onChange={e => {
                  setReplaceQuestions(e.target.checked);
                  change("bankId", e.target.checked ? String(editing.settings?.bank_id || "") : "");
                }}
              />
              Ganti bank atau pilihan soal
            </label>
            {!replaceQuestions ? (
              <p>Soal yang telah disalin ke ujian tetap digunakan.</p>
            ) : (
              <>
                <label>
                  Bank soal
                  <select
                    required
                    value={form.bankId}
                    onChange={e => change("bankId", e.target.value)}
                  >
                    <option value="">Pilih bank soal</option>
                    {banks
                      .filter(b => b.subjectId === form.subjectId)
                      .map(b => (
                        <option value={b.id} key={b.id}>
                          {b.title} ({b._count.questions} soal)
                        </option>
                      ))}
                  </select>
                </label>
                {bank && bank.id === form.bankId && (
                  <fieldset className="staff-question-select">
                    <legend>Pilih soal ({ids.length} terpilih)</legend>
                    {(bank.questions || []).map((q, i) => (
                      <label key={q.id} className="staff-check">
                        <input
                          type="checkbox"
                          checked={!!q.id && ids.includes(q.id)}
                          onChange={e =>
                            q.id &&
                            setIds(v =>
                              e.target.checked ? [...v, q.id!] : v.filter(id => id !== q.id)
                            )
                          }
                        />
                        <span>
                          Soal {i + 1}: <QuestionContent text={q.questionText} content={q.content} />
                        </span>
                      </label>
                    ))}
                  </fieldset>
                )}
              </>
            )}

            <div className="staff-checks">
              {([
                ["randomQuestions", "Acak urutan soal"],
                ["randomOptions", "Acak pilihan jawaban"],
                ["showScore", "Tampilkan nilai akhir"],
                ["review", "Izinkan review soal"],
              ] as const).map(([key, label]) => (
                <label key={key} className="staff-check">
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={e => change(key, e.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>

            <label>
              Tampilan soal
              <select
                value={form.displayMode}
                onChange={e => change("displayMode", e.target.value)}
              >
                <option value="one_by_one">Satu per satu</option>
                <option value="all_at_once">Sekaligus</option>
              </select>
            </label>

            <h3>Aturan dan deteksi</h3>
            <div className="staff-fields">
              <label>
                Nilai kelulusan
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  value={form.passingScore}
                  onChange={e => change("passingScore", e.target.value)}
                />
              </label>
              <label>
                Kunci setelah pelanggaran
                <input
                  type="number"
                  min="1"
                  required
                  value={form.maxViolations}
                  onChange={e => change("maxViolations", e.target.value)}
                />
              </label>
            </div>

            <div className="staff-checks">
              {([
                ["screenshot", "Shortcut screenshot"],
                ["devtools", "Shortcut devtools"],
                ["focus", "Pindah tab atau kehilangan fokus"],
                ["fullscreen", "Keluar layar penuh"],
                ["ip", "Perubahan alamat IP"],
              ] as const).map(([key, label]) => (
                <label key={key} className="staff-check">
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={e => change(key, e.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>

            <p className="staff-note">
              Deteksi shortcut menunjukkan tombol ditekan; browser tidak dapat memastikan screenshot berhasil atau semua cara membuka devtools.
            </p>
            <ErrorText error={error} />
            <div className="staff-dialog-actions">
              <MotionButton
                type="button"
                className="staff-secondary"
                onClick={() => setEditing(null)}
              >
                Batal
              </MotionButton>
              <MotionButton className="staff-primary" disabled={busy}>
                {busy ? "Menyimpan…" : "Simpan ujian"}
              </MotionButton>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
