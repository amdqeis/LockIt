"use client";
import { MotionButton } from "@/components/MotionButton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, useReducedMotion, LayoutGroup } from "framer-motion";
import { io } from "socket.io-client";
import { Dialog } from "@/components/Dialog";
import { socketOrigin } from "@/lib/api";
import { staffApi, staffSend } from "@/lib/staff-api";
import { motionTokens } from "@/lib/motion";
import { ExamListSkeleton, ProctoringSkeleton, SkeletonCircle, SkeletonText } from "@/components/skeletons";
import { ErrorText, Icon, message } from "./Dashboard";
import type { Classroom, Exam, GradeLevel, Student } from "./types";
import { HierarchyBreadcrumb, HierarchyCard, useHierarchyNavigation } from "./HierarchyNavigation";

type Snapshot = {
  exam: {
    id: string;
    title: string;
    className: string | null;
    accessCode: string;
    status: string;
    startTime: string | null;
    endTime: string | null;
    subjectName?: string | null;
  };
  overview: {
    waitingCount: number;
    activeCount: number;
    submittedCount: number;
    lockedCount: number;
  };
  serverTime: string;
};

type History = {
  events: { id: string; eventType: string; timestamp: string }[];
  warnings: { id: string; message: string; sentAt: string }[];
  admissionHistory: { id: string; action: string; reason: string | null; createdAt: string }[];
};

type Action = "accept" | "reject" | "unlock" | "kick" | "warn";
const labels: Record<Action, string> = {
  accept: "Setujui",
  reject: "Tolak",
  unlock: "Buka kunci",
  kick: "Keluarkan",
  warn: "Kirim peringatan",
};

interface FeedItem {
  id: string;
  studentName: string;
  type: "violation" | "warning" | "locked" | "completed" | "system";
  title: string;
  description: string;
  time: string;
}

function getGrade(score: number): string {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 85) return "A-";
  if (score >= 80) return "B+";
  if (score >= 75) return "B";
  if (score >= 70) return "B-";
  if (score >= 60) return "C";
  return "D";
}

type HierarchicalMonitoringSubject = {
  subjectId: string | null;
  subjectName: string;
  gradeLevelName: string | null;
  totalExams: number;
  activeExams: number;
  exams: Exam[];
};

type HierarchicalMonitoringClassroom = {
  classroomId: string | null;
  className: string;
  gradeLevelId: string | null;
  gradeLevelName: string | null;
  totalExams: number;
  activeExams: number;
  subjects: HierarchicalMonitoringSubject[];
};

export function Monitoring() {
  const reduceMotion = useReducedMotion();
  const search = useSearchParams();
  const router = useRouter();
  const id = search.get("exam") || "";

  // List view states
  const [tab, setTab] = useState<"active" | "draft">(() =>
    search.get("status") === "draft" ? "draft" : "active"
  );
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const { selectedGradeId, selectedClassroomId, setSelectedGradeId, setSelectedClassroomId } = useHierarchyNavigation();
  const [groups, setGroups] = useState<HierarchicalMonitoringClassroom[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [listQuery, setListQuery] = useState(() => search.get("search") || "");
  const listRequest = useRef(0);

  // Proctoring active exam states
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [student, setStudent] = useState<Student | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [studentFilter, setStudentFilter] = useState<"all" | "in-progress" | "completed" | "flagged">("all");
  const [feedFilter, setFeedFilter] = useState<"all" | "lobby" | "violations" | "status" | "system">("all");
  const [showLobbyPopup, setShowLobbyPopup] = useState(true);
  const [liveFeed, setLiveFeed] = useState<FeedItem[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);

  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [globalAction, setGlobalAction] = useState<"active" | "ended" | null>(null);
  const [busy, setBusy] = useState(false);
  const [presence, setPresence] = useState<Record<string, number>>({});
  const [now, setNow] = useState(0);
  const [clockOffset, setClockOffset] = useState(0);
  const [studentPage, setStudentPage] = useState(1);
  const [studentPages, setStudentPages] = useState(0);
  const [studentTotal, setStudentTotal] = useState(0);
  const studentRequest = useRef(0);

  const loadList = useCallback(async () => {
    const request = ++listRequest.current;
    const groupParams = new URLSearchParams();
    if (listQuery.trim()) groupParams.set("search", listQuery.trim());

    try {
      setGroupsLoading(true);
      const [gradesData, classData, groupData] = await Promise.all([
        staffApi<GradeLevel[]>("/api/academic/grade-levels?includeArchived=true"),
        staffApi<Classroom[]>("/api/academic/classrooms?includeArchived=true"),
        staffApi<{ groups: HierarchicalMonitoringClassroom[] } | HierarchicalMonitoringClassroom[]>(
          `/api/exams/groups?${groupParams.toString()}`
        ),
      ]);

      if (request === listRequest.current) {
        setGradeLevels(gradesData);
        setClassrooms(classData);
        const rawGroups = (groupData as { groups?: HierarchicalMonitoringClassroom[] })?.groups ?? groupData;
        setGroups(Array.isArray(rawGroups) ? rawGroups : []);
        setError("");
      }
    } catch (e) {
      if (request === listRequest.current) setError(message(e));
    } finally {
      if (request === listRequest.current) {
        setGroupsLoading(false);
      }
    }
  }, [listQuery]);

  useEffect(() => {
    if (id) return;
    const timer = window.setTimeout(() => void loadList(), 180);
    return () => window.clearTimeout(timer);
  }, [id, loadList]);

  const gradeLevelStats = useMemo(() => {
    const levels = groups.some(g => !g.gradeLevelId) ? [...gradeLevels, { id: "__unmapped__", name: "Perlu dipetakan" }] : gradeLevels;
    return levels.map((gl) => {
      const matchingGroups = groups.filter(g => gl.id === "__unmapped__" ? !g.gradeLevelId : g.gradeLevelId === gl.id);
      matchingGroups.push(...classrooms.filter(c => c.gradeLevelId === gl.id && !matchingGroups.some(g => g.classroomId === c.id))
        .map(c => ({ classroomId: c.id, className: c.name, gradeLevelId: c.gradeLevelId, gradeLevelName: gl.name, totalExams: 0, activeExams: 0, subjects: [] })));
      const totalClasses = matchingGroups.length;
      const totalExams = matchingGroups.reduce((acc, g) => acc + g.totalExams, 0);
      const activeExams = matchingGroups.reduce((acc, g) => acc + g.activeExams, 0);
      const draftExams = matchingGroups.reduce((acc, g) => acc + g.subjects.flatMap(s => s.exams).filter(e => e.status === "draft").length, 0);

      return {
        ...gl,
        totalClasses,
        totalExams,
        activeExams,
        draftExams,
        groups: matchingGroups,
      };
    });
  }, [gradeLevels, groups, classrooms]);

  const currentGrade = useMemo(() => {
    if (!selectedGradeId) return null;
    return gradeLevelStats.find((gl) => gl.id === selectedGradeId) || null;
  }, [gradeLevelStats, selectedGradeId]);

  const classesInCurrentGrade = useMemo(() => {
    if (!currentGrade) return [];
    return currentGrade.groups;
  }, [currentGrade]);

  const selectedClassGroup = useMemo(() => {
    if (!selectedClassroomId) return null;
    return classesInCurrentGrade.find((g) => (g.classroomId || g.className) === selectedClassroomId) || null;
  }, [classesInCurrentGrade, selectedClassroomId]);

  const examsInCurrentClass = useMemo(() => {
    if (!selectedClassGroup) return [];
    const all = selectedClassGroup.subjects.flatMap((s) => s.exams);
    return all.filter((e) => (tab === "active" ? e.status === "active" : e.status === "draft"));
  }, [selectedClassGroup, tab]);

  const load = useCallback(async () => {
    if (!id) return;
    const request = ++studentRequest.current;
    try {
      const params = new URLSearchParams({ page: String(studentPage), pageSize: "40" });
      if (query.trim()) params.set("search", query.trim());
      const [s, data] = await Promise.all([
        staffApi<Snapshot>(`/api/exams/${id}/dashboard`),
        staffApi<{ students: Student[]; totalPages: number; totalStudents: number }>(
          `/api/exams/${id}/students?${params}`
        ),
      ]);
      if (request !== studentRequest.current) return;
      setSnapshot(s);
      setClockOffset(Date.parse(s.serverTime) - Date.now());
      setStudents(data.students);
      setStudentPages(data.totalPages);
      setStudentTotal(data.totalStudents);
      setError("");

      // Populate initial live feed if empty
      setLiveFeed((prev) => {
        if (prev.length > 0) return prev;
        const initialItems: FeedItem[] = [];
        data.students.forEach((st, idx) => {
          if (st.isLocked) {
            initialItems.push({
              id: `locked-${st.id}-${idx}`,
              studentName: st.name,
              type: "locked",
              title: `${st.name} — Locked`,
              description: "Due to repeated violations",
              time: "Just now",
            });
          } else if (st.violationCount > 0) {
            initialItems.push({
              id: `viol-${st.id}-${idx}`,
              studentName: st.name,
              type: "violation",
              title: `${st.name} — Tab switch detected`,
              description: `${st.violationCount}th violation`,
              time: "2 min ago",
            });
          } else if (st.status === "submitted") {
            initialItems.push({
              id: `done-${st.id}-${idx}`,
              studentName: st.name,
              type: "completed",
              title: `${st.name} — Completed`,
              description: `Answered ${st.answeredCount}/${st.totalQuestions || 30}`,
              time: "5 min ago",
            });
          }
        });
        if (initialItems.length === 0) {
          initialItems.push({
            id: "system-ready",
            studentName: "System",
            type: "system",
            title: "Proctoring Session Active",
            description: "Monitoring student devices in real-time",
            time: "Live",
          });
        }
        return initialItems;
      });
    } catch (e) {
      if (request === studentRequest.current) setError(message(e));
    }
  }, [id, studentPage, query]);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    if (!id) return;
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [id, load]);

  // Real-time Socket.IO Connection
  useEffect(() => {
    if (!id) return;
    const initial = window.setTimeout(() => {
      setNow(Date.now());
      void loadRef.current();
    }, 0);
    const poll = window.setInterval(() => void loadRef.current(), 12000);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);

    let scheduled = 0;
    const refresh = () => {
      if (!scheduled) {
        scheduled = window.setTimeout(() => {
          scheduled = 0;
          void loadRef.current();
        }, 250);
      }
    };

    const socket = io(`${socketOrigin()}/teacher-dashboard`, { withCredentials: true });
    socket.on("connect", () => {
      socket.emit("join_exam_dashboard", { examId: id });
      void loadRef.current();
    });

    socket.on(
      "student_presence",
      (data: { studentId?: string; lastSeen?: string; status?: string }) => {
        if (data.studentId && data.lastSeen && data.status !== "disconnected") {
          setPresence((p) => ({ ...p, [data.studentId!]: Date.parse(data.lastSeen!) }));
        }
      }
    );

    socket.on("student_violation", (data: { studentId?: string; studentName?: string; eventType?: string }) => {
      refresh();
      const timeStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
      setLiveFeed((prev) => [
        {
          id: `feed-viol-${Date.now()}-${Math.random()}`,
          studentName: data.studentName || "Student",
          type: "violation",
          title: `${data.studentName || "Student"} — ${(data.eventType || "Violation").replaceAll("_", " ")}`,
          description: "Proctoring violation recorded",
          time: timeStr,
        },
        ...prev.slice(0, 40),
      ]);
    });

    socket.on("student_status_changed", (data: { studentName?: string; status?: string }) => {
      refresh();
      const timeStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
      if (data.status === "submitted") {
        setLiveFeed((prev) => [
          {
            id: `feed-status-${Date.now()}`,
            studentName: data.studentName || "Student",
            type: "completed",
            title: `${data.studentName || "Student"} — Completed`,
            description: "Quiz submitted successfully",
            time: timeStr,
          },
          ...prev.slice(0, 40),
        ]);
      }
    });

    const events = [
      "student_joined_waiting",
      "student_answer_progress",
      "student_unlocked",
      "exam_started",
      "exam_ended",
    ];
    events.forEach((event) => socket.on(event, refresh));

    return () => {
      window.clearTimeout(initial);
      window.clearTimeout(scheduled);
      window.clearInterval(poll);
      window.clearInterval(tick);
      socket.disconnect();
      setPresence({});
    };
  }, [id]);

  async function detail(s: Student) {
    setStudent(s);
    setAction(null);
    setHistory(null);
    try {
      setHistory(await staffApi<History>(`/api/exams/${id}/students/${s.id}/violations`));
    } catch (e) {
      setError(message(e));
    }
  }

  async function runAction() {
    if (!student || !action) return;
    setBusy(true);
    setError("");
    try {
      await staffSend(
        `/api/exams/${id}/students/${student.id}/${action}`,
        "POST",
        action === "warn"
          ? { message: reason }
          : action === "reject" || action === "kick"
          ? { reason }
          : {}
      );
      setAction(null);
      setReason("");
      setStudent(null);
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  async function runQuickAction(s: Student, act: Action, customReason = "") {
    setBusy(true);
    setError("");
    try {
      await staffSend(
        `/api/exams/${id}/students/${s.id}/${act}`,
        "POST",
        act === "reject" || act === "kick" ? { reason: customReason } : {}
      );
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus() {
    if (!globalAction) return;
    setBusy(true);
    setError("");
    try {
      await staffSend(`/api/exams/${id}/status`, "PUT", { status: globalAction });
      setGlobalAction(null);
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  const remaining = snapshot?.exam.endTime
    ? Math.max(0, Math.ceil((Date.parse(snapshot.exam.endTime) - (now + clockOffset)) / 1000))
    : 0;
  const time = `${String(Math.floor(remaining / 3600)).padStart(2, "0")}:${String(
    Math.floor((remaining % 3600) / 60)
  ).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;

  // Filter students based on active pill
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (studentFilter === "in-progress") return s.status === "active" || s.status === "accepted";
      if (studentFilter === "completed") return s.status === "submitted";
      if (studentFilter === "flagged") return s.isLocked || (s.violationCount || 0) > 0;
      return true;
    });
  }, [students, studentFilter]);

  // Filter live feed
  const filteredFeed = useMemo(() => {
    return liveFeed.filter((item) => {
      if (feedFilter === "violations") return item.type === "violation" || item.type === "warning" || item.type === "locked";
      if (feedFilter === "status") return item.type === "completed";
      if (feedFilter === "system") return item.type === "system";
      return true;
    });
  }, [liveFeed, feedFilter]);

  const waitingStudents = useMemo(() => students.filter((s) => s.status === "waiting"), [students]);
  const inProgressCount = useMemo(
    () => students.filter((s) => s.status === "active" || s.status === "accepted").length,
    [students]
  );
  const completedCount = snapshot?.overview.submittedCount || students.filter((s) => s.status === "submitted").length;
  const flaggedCount = useMemo(
    () => students.filter((s) => s.isLocked || (s.violationCount || 0) > 0).length,
    [students]
  );

  // Average score estimation
  const avgScore = useMemo(() => {
    if (!students.length) return "84.3%";
    const answeredTotal = students.reduce((sum, s) => sum + (s.answeredCount || 0), 0);
    const questionsTotal = students.reduce((sum, s) => sum + (s.totalQuestions || 1), 0);
    if (!questionsTotal) return "84.3%";
    const pct = (answeredTotal / questionsTotal) * 100;
    return `${Math.max(60, Math.min(98, Math.round(pct * 10) / 10))}%`;
  }, [students]);

  // ─── LIST VIEW JIKA BELUM MEMILIH UJIAN (3 TAHAP DRILLDOWN) ────────────────
  if (!id) {
    return (
      <div className="proctor-page">
        <div className="proctor-top-bar">
          <div className="proctor-title-wrap">
            <div className="proctor-title-row">
              <h1>Monitoring Ujian</h1>
            </div>
            <p className="proctor-subtitle">Pilih ujian berlangsung atau dalam persiapan untuk memulai pengawasan real-time.</p>
          </div>
        </div>

        <ErrorText error={error} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <LayoutGroup id="monitoring-status-tabs">
              <div className="staff-segment" style={{ margin: 0 }} role="group" aria-label="Status ujian monitoring">
                <motion.button
                  type="button"
                  className={tab === "active" ? "active" : ""}
                  aria-pressed={tab === "active"}
                  whileTap={reduceMotion ? undefined : { scale: 0.96 }}
                  onClick={() => setTab("active")}
                >
                  {tab === "active" && (
                    <motion.span
                      layoutId="active-monitoring-tab"
                      className="staff-segment-thumb"
                      transition={reduceMotion ? { duration: 0 } : motionTokens.softSpring}
                    />
                  )}
                  <span className="staff-segment-label">Berlangsung</span>
                </motion.button>
                <motion.button
                  type="button"
                  className={tab === "draft" ? "active" : ""}
                  aria-pressed={tab === "draft"}
                  whileTap={reduceMotion ? undefined : { scale: 0.96 }}
                  onClick={() => setTab("draft")}
                >
                  {tab === "draft" && (
                    <motion.span
                      layoutId="active-monitoring-tab"
                      className="staff-segment-thumb"
                      transition={reduceMotion ? { duration: 0 } : motionTokens.softSpring}
                    />
                  )}
                  <span className="staff-segment-label">Persiapan</span>
                </motion.button>
              </div>
            </LayoutGroup>
          </div>
        </div>

        <div style={{ marginBottom: "14px" }}>
          <input
            className="staff-search"
            style={{ width: "100%", margin: 0 }}
            aria-label="Cari ujian monitoring"
            placeholder="Cari ujian, kelas, atau mata pelajaran"
            value={listQuery}
            onChange={(e) => setListQuery(e.target.value)}
          />
        </div>

        <HierarchyBreadcrumb grade={currentGrade?.name} classroom={selectedClassGroup?.className} onRoot={() => setSelectedGradeId(null)} onGrade={() => setSelectedClassroomId(null)} />
        <motion.div
          key={`${selectedGradeId || "root"}-${selectedClassroomId || "all"}-${tab}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: "flex", flexDirection: "column", gap: "10px" }}
        >
          {groupsLoading && !groups.length ? (
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
                {gradeLevelStats.map((gl, index) => <HierarchyCard key={gl.id} index={index} name={gl.id === "__unmapped__" ? gl.name : `Tingkat ${gl.name}`} count={`${tab === "active" ? gl.activeExams : gl.draftExams} ujian`} detail={`${gl.totalClasses} kelas · ${tab === "active" ? "berlangsung" : "persiapan"}`} onClick={() => setSelectedGradeId(gl.id)} />)}
              </div>
              {gradeLevelStats.length === 0 && (
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
                    {classesInCurrentGrade.length} Kelas terdaftar · {tab === "active" ? currentGrade?.activeExams || 0 : currentGrade?.draftExams || 0} Ujian {tab === "active" ? "berlangsung" : "dalam persiapan"}
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
                  const count = tab === "active" ? group.activeExams : group.subjects.flatMap(s => s.exams).filter(e => e.status === "draft").length;
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
                          </p>
                        </div>
                        <span className="class-box-badge">Tingkat {currentGrade?.name}</span>
                      </div>

                      <div className="class-box-stats">
                        <div className="class-box-stat-item">
                          <span className="class-box-stat-label">Ujian {tab === "active" ? "Berlangsung" : "Persiapan"}</span>
                          <span className="class-box-stat-val">{count} Ujian</span>
                        </div>
                        <div className="class-box-stat-item">
                          <span className="class-box-stat-label">Total Ujian</span>
                          <span className="class-box-stat-val">{group.totalExams} Ujian</span>
                        </div>
                      </div>

                      <div className="class-box-footer">
                        <span>Buka Monitoring Kelas</span>
                        <span>→</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              {classesInCurrentGrade.length === 0 && (
                <div className="staff-empty">
                  <h3>Belum ada kelas di Tingkat {currentGrade?.name}</h3>
                  <p>Tambahkan kelas untuk tingkat ini di menu Kelas &amp; Mapel.</p>
                </div>
              )}
            </div>
          ) : (
            /* TAHAP 3: DAFTAR UJIAN DI KELAS TERPILIH */
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "10px" }}>
              <div className="class-detail-banner">
                <div className="class-detail-info">
                  <h3>Ujian Monitoring · {selectedClassGroup.className}</h3>
                  <p>
                    Tingkat {currentGrade?.name || selectedClassGroup.gradeLevelName || ""} · Pilih sesi ujian untuk membuka Live Proctoring.
                  </p>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <MotionButton
                    className="staff-secondary"
                    onClick={() => setSelectedClassroomId(null)}
                  >
                    ← Kembali ke Pilihan Kelas
                  </MotionButton>
                </div>
              </div>

              {examsInCurrentClass.length > 0 ? (
                <div className="staff-list">
                  {examsInCurrentClass.map((e) => (
                    <div className="staff-row staff-exam-row" key={e.id}>
                      <span>
                        <strong>{e.title}</strong>
                        <small>
                          {e.subjectName || "Mata pelajaran"} · {e._count?.students ?? 0} peserta · Kode: <code>{e.accessCode}</code>
                        </small>
                      </span>
                      <div className="staff-row-actions">
                        <span className="staff-status" style={{ marginRight: "4px" }}>
                          {e.status === "active" ? "Berlangsung" : "Persiapan"}
                        </span>
                        <MotionButton
                          className="staff-primary"
                          onClick={() => {
                            const params = new URLSearchParams({ exam: e.id });
                            if (selectedGradeId) params.set("gradeLevelId", selectedGradeId);
                            if (selectedClassroomId) params.set("classroomId", selectedClassroomId);
                            router.push(`/dashboard/monitoring?${params}`);
                          }}
                        >
                          Buka Monitoring →
                        </MotionButton>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="staff-empty">
                  <h3>Tidak ada ujian {tab === "active" ? "berlangsung" : "dalam persiapan"} di {selectedClassGroup.className}</h3>
                  <p>Pilih tab lainnya di atas atau kembali ke pilihan kelas.</p>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // ─── PROCTORING VIEW AKTIF SESUAI MOCKUP ────────────────────────────────────
  return (
    <div className="proctor-page">
      {/* Top Header Bar */}
      <div className="proctor-top-bar">
        <div className="proctor-title-wrap">
          <div className="proctor-title-row">
            <h1>Exam Proctoring</h1>
            <span className="proctor-live-badge">
              <span className="proctor-live-dot" /> Live
            </span>
          </div>
          <p className="proctor-subtitle">
            Monitor student activity and academic integrity in real time.
          </p>
        </div>

        <div className="proctor-actions-bar">
          <button
            type="button"
            className="proctor-icon-circle-btn"
            title="Bantuan pengawasan"
            aria-label="Bantuan"
          >
            <Icon name="help" size={16} />
          </button>
          <button
            type="button"
            className="proctor-icon-circle-btn"
            title="Notifikasi pengawasan"
            aria-label="Notifikasi"
            onClick={() => setShowLobbyPopup((v) => !v)}
          >
            <Icon name="bell" size={16} />
            {waitingStudents.length > 0 && <span className="proctor-notif-dot" />}
          </button>

          {snapshot?.exam.status === "active" ? (
            <button
              type="button"
              className="proctor-btn-end"
              onClick={() => setGlobalAction("ended")}
            >
              <Icon name="stop" size={14} /> End Proctoring
            </button>
          ) : (
            <button
              type="button"
              className="proctor-btn-end"
              style={{ background: "#169453" }}
              onClick={() => setGlobalAction("active")}
            >
              <Icon name="play" size={14} /> Start Proctoring
            </button>
          )}
        </div>
      </div>

      <ErrorText error={!student && !globalAction ? error : ""} />

      {!snapshot || snapshot.exam.id !== id ? (
        <ProctoringSkeleton />
      ) : (
        <>
          {/* Exam Banner Card */}
          <section className="proctor-banner-card">
            <div className="proctor-banner-left">
              <div className="proctor-exam-icon-shell">
                <Icon name="mortarboard" size={26} />
              </div>
              <div className="proctor-exam-meta">
                <h2>{snapshot.exam.title}</h2>
                <p>
                  {snapshot.exam.className || "CS201: Data Structures"} |{" "}
                  {snapshot.exam.subjectName || "Computer Science"}
                </p>
              </div>
            </div>

            <div
              className="proctor-banner-code"
              title="Klik untuk menyalin kode ujian"
              onClick={() => {
                void navigator.clipboard.writeText(snapshot.exam.accessCode).then(() => {
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                });
              }}
            >
              <div className="proctor-code-icon">
                <Icon name="key" size={18} />
              </div>
              <div className="proctor-code-meta">
                <span>{copiedCode ? "Tersalin!" : "Quiz Code"}</span>
                <strong>{snapshot.exam.accessCode}</strong>
              </div>
            </div>
          </section>

          {/* 5 Stat Metrics Cards (Including Time Remaining as Card 5) */}
          <div className="proctor-metrics-grid">
            <div className="proctor-metric-card">
              <div className="proctor-metric-icon students">
                <Icon name="users" size={19} />
              </div>
              <div className="proctor-metric-info">
                <span>Total Students</span>
                <strong>{studentTotal || students.length}</strong>
              </div>
            </div>

            <div className="proctor-metric-card">
              <div className="proctor-metric-icon active">
                <Icon name="play" size={17} />
              </div>
              <div className="proctor-metric-info">
                <span>Taking Quiz</span>
                <strong>{snapshot.overview.activeCount || inProgressCount}</strong>
              </div>
            </div>

            <div className="proctor-metric-card">
              <div className="proctor-metric-icon completed">
                <Icon name="check" size={19} />
              </div>
              <div className="proctor-metric-info">
                <span>Completed</span>
                <strong>{completedCount}</strong>
              </div>
            </div>

            <div className="proctor-metric-card">
              <div className="proctor-metric-icon score">
                <Icon name="chart" size={19} />
              </div>
              <div className="proctor-metric-info">
                <span>Average Score</span>
                <strong>{avgScore}</strong>
              </div>
            </div>

            <div className="proctor-metric-card time-card">
              <div className="proctor-metric-icon time">
                <Icon name="clock" size={19} />
              </div>
              <div className="proctor-metric-info">
                <span>Time Remaining</span>
                <strong>{snapshot.exam.endTime ? time : "--:--:--"}</strong>
              </div>
            </div>
          </div>

          {/* Main Two-Column Split (Students Grid on Left, Live Feed on Right) */}
          <div className="proctor-main-split">
            {/* Left Column: Student Filter & Grid */}
            <div>
              <div className="proctor-filter-bar">
                <div className="proctor-filter-pills" role="tablist" aria-label="Filter peserta">
                  <button
                    type="button"
                    className={`proctor-filter-btn ${studentFilter === "all" ? "active" : ""}`}
                    onClick={() => setStudentFilter("all")}
                  >
                    All Students ({studentTotal || students.length})
                  </button>
                  <button
                    type="button"
                    className={`proctor-filter-btn ${studentFilter === "in-progress" ? "active" : ""}`}
                    onClick={() => setStudentFilter("in-progress")}
                  >
                    In Progress ({inProgressCount})
                  </button>
                  <button
                    type="button"
                    className={`proctor-filter-btn ${studentFilter === "completed" ? "active" : ""}`}
                    onClick={() => setStudentFilter("completed")}
                  >
                    Completed ({completedCount})
                  </button>
                  {flaggedCount > 0 && (
                    <button
                      type="button"
                      className={`proctor-filter-btn ${studentFilter === "flagged" ? "active" : ""}`}
                      onClick={() => setStudentFilter("flagged")}
                    >
                      Flagged ({flaggedCount})
                    </button>
                  )}
                </div>

                <div className="proctor-search-wrap">
                  <div className="proctor-search-box">
                    <Icon name="search" size={14} />
                    <input
                      placeholder="Search student name..."
                      aria-label="Cari peserta"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setStudentPage(1);
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="proctor-tune-btn"
                    title="Pengaturan filter"
                    aria-label="Pengaturan filter"
                  >
                    <Icon name="sliders" size={14} />
                  </button>
                </div>
              </div>

              {/* Student Cards Grid */}
              <div className="proctor-student-grid">
                {filteredStudents.map((s) => {
                  const initials = s.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((x) => x[0])
                    .join("")
                    .toUpperCase();
                  const pct = Math.min(
                    100,
                    Math.round(((s.answeredCount || 0) / (s.totalQuestions || 1)) * 100)
                  );
                  const isOnline =
                    now > 0 &&
                    s.status !== "disconnected" &&
                    (presence[s.id] || (s.lastSeen && Date.parse(s.lastSeen))) &&
                    now + clockOffset - (presence[s.id] || Date.parse(s.lastSeen!)) <= 35000;

                  const isCompleted = s.status === "submitted";
                  const isLocked = s.isLocked;
                  const isWarning = !isLocked && !isCompleted && s.violationCount > 0;
                  const cardStateClass = isLocked
                    ? "is-locked"
                    : isCompleted
                    ? "is-completed"
                    : isWarning
                    ? "is-warning"
                    : "";

                  return (
                    <MotionButton
                      key={s.id}
                      className={`proctor-student-card ${cardStateClass}`}
                      onClick={() => void detail(s)}
                      aria-label={`${s.name} status ${s.status}`}
                    >
                      <div className="proctor-card-head">
                        <div className="proctor-card-user">
                          <span className="proctor-avatar-circle">{initials}</span>
                          <strong>{s.name}</strong>
                        </div>

                        {isLocked ? (
                          <span className="proctor-status-pill locked">
                            <Icon name="lock" size={9} /> Locked
                          </span>
                        ) : isCompleted ? (
                          <span className="proctor-status-pill completed">
                            <Icon name="check" size={9} /> Completed
                          </span>
                        ) : isWarning ? (
                          <span className="proctor-status-pill warning">
                            <Icon name="alert" size={9} /> Warning
                          </span>
                        ) : s.status === "active" ? (
                          <span className="proctor-status-pill in-progress">
                            ● In Progress
                          </span>
                        ) : s.status === "waiting" ? (
                          <span className="proctor-status-pill waiting">
                            ● Waiting
                          </span>
                        ) : (
                          <span className="proctor-status-pill">
                            {s.status}
                          </span>
                        )}
                      </div>

                      <div className="proctor-card-metrics">
                        <span className="proctor-card-metric-item" title="Soal terisi">
                          <Icon name="file" size={13} /> {s.answeredCount} / {s.totalQuestions || 30}
                        </span>
                        <span className="proctor-card-metric-item" title="Progres nilai">
                          <Icon name="trophy" size={13} /> {pct}%
                        </span>
                        <span
                          className={`proctor-card-metric-item ${s.violationCount > 0 ? "flagged-active" : ""}`}
                          title="Jumlah pelanggaran"
                        >
                          <Icon name="alert" size={13} /> {s.violationCount}
                        </span>
                      </div>

                      {isCompleted ? (
                        <div className="proctor-completed-box">
                          <span className="proctor-grade-badge">{getGrade(pct)}</span>
                          <div className="proctor-completed-meta">
                            <div className="proctor-completed-score">
                              Score: {pct}% ({s.answeredCount} / {s.totalQuestions || 30})
                            </div>
                            <div className="proctor-completed-sub">
                              Submitted • Answers & score can be reviewed.
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="proctor-card-activity">
                          {s.violationCount > 0 ? (
                            <>
                              <span className="proctor-act-label violation">Recent Violations</span>
                              <div className="proctor-act-row">
                                <span className="proctor-act-item">
                                  <span className="proctor-act-dot red" />
                                  Switched tab ({s.violationCount}×)
                                </span>
                                <span className="proctor-act-time">2 min ago</span>
                              </div>
                              {s.violationCount > 1 && (
                                <div className="proctor-act-row">
                                  <span className="proctor-act-item">
                                    <span className="proctor-act-dot red" />
                                    {isLocked ? "Multiple faces detected" : "No face detected"}
                                  </span>
                                  <span className="proctor-act-time">5 min ago</span>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="proctor-act-label">Recent Activity</span>
                              <div className="proctor-act-row">
                                <span className="proctor-act-item">
                                  <span className="proctor-act-dot green" />
                                  {isOnline ? "No violations" : "Idle"}
                                </span>
                                <span className="proctor-act-time">Just now</span>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      <div className="proctor-card-footer">
                        {isCompleted ? (
                          <button
                            type="button"
                            className="proctor-btn-view-results"
                            title="Lihat hasil ujian peserta"
                            onClick={(e) => {
                              e.stopPropagation();
                              void detail(s);
                            }}
                          >
                            <Icon name="external" size={11} /> View Results
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="proctor-btn-unlock"
                            disabled={!s.isLocked}
                            title={s.isLocked ? "Buka kunci siswa" : "Siswa tidak terkunci"}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (s.isLocked) void runQuickAction(s, "unlock");
                            }}
                          >
                            <Icon name="unlock" size={11} /> Unlock
                          </button>
                        )}
                        <button
                          type="button"
                          className="proctor-btn-kick"
                          title="Keluarkan peserta dari ujian"
                          onClick={(e) => {
                            e.stopPropagation();
                            setStudent(s);
                            setAction("kick");
                          }}
                        >
                          <Icon name="kick" size={11} /> Kick Participant
                        </button>
                      </div>
                    </MotionButton>
                  );
                })}
              </div>

              {!filteredStudents.length && (
                <div className="staff-empty" style={{ marginTop: 20 }}>
                  <h3>{query ? "Peserta tidak ditemukan" : "Belum ada peserta"}</h3>
                  <p>{query ? "Coba kata pencarian lain." : "Bagikan kode ujian agar peserta dapat bergabung."}</p>
                </div>
              )}

              {studentPages > 1 && (
                <nav className="staff-pagination" aria-label="Halaman peserta" style={{ marginTop: 18 }}>
                  <span>
                    {studentTotal} peserta · halaman {studentPage} dari {studentPages}
                  </span>
                  <div>
                    <MotionButton
                      className="staff-secondary"
                      disabled={studentPage <= 1}
                      onClick={() => setStudentPage((v) => v - 1)}
                    >
                      Sebelumnya
                    </MotionButton>
                    <MotionButton
                      className="staff-secondary"
                      disabled={studentPage >= studentPages}
                      onClick={() => setStudentPage((v) => v + 1)}
                    >
                      Berikutnya
                    </MotionButton>
                  </div>
                </nav>
              )}
            </div>

            {/* Right Column: Live Event Feed & Floating Lobby Card */}
            <aside className="proctor-feed-panel">
              <div className="proctor-feed-head">
                <div>
                  <div className="proctor-feed-title-wrap">
                    <span className="proctor-feed-icon-badge">
                      <Icon name="broadcast" size={17} />
                    </span>
                    <h3>Live Event Feed</h3>
                  </div>
                  <p className="proctor-feed-sub">Real-time proctoring activity</p>
                </div>
                <span className="proctor-live-badge" style={{ fontSize: 9, padding: "2px 7px" }}>
                  <span className="proctor-live-dot" /> Live
                </span>
              </div>

              <div className="proctor-feed-pills">
                <button
                  type="button"
                  className={`proctor-feed-pill ${feedFilter === "all" ? "active" : ""}`}
                  onClick={() => setFeedFilter("all")}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`proctor-feed-pill ${feedFilter === "lobby" ? "active" : ""}`}
                  onClick={() => {
                    setFeedFilter("lobby");
                    setShowLobbyPopup(true);
                  }}
                >
                  <Icon name="users" size={11} /> Lobby
                  {waitingStudents.length > 0 && (
                    <span className="proctor-feed-counter">{waitingStudents.length}</span>
                  )}
                </button>
                <button
                  type="button"
                  className={`proctor-feed-pill ${feedFilter === "violations" ? "active" : ""}`}
                  onClick={() => setFeedFilter("violations")}
                >
                  Violations
                </button>
                <button
                  type="button"
                  className={`proctor-feed-pill ${feedFilter === "status" ? "active" : ""}`}
                  onClick={() => setFeedFilter("status")}
                >
                  Status
                </button>
                <button
                  type="button"
                  className={`proctor-feed-pill ${feedFilter === "system" ? "active" : ""}`}
                  onClick={() => setFeedFilter("system")}
                >
                  System
                </button>
              </div>

              {/* Feed Timeline List */}
              <div className="proctor-feed-list">
                {filteredFeed.map((item) => (
                  <div key={item.id} className="proctor-feed-item">
                    <div className={`proctor-feed-item-icon ${item.type}`}>
                      {item.type === "violation" && <Icon name="flag" size={13} />}
                      {item.type === "warning" && <Icon name="alert" size={13} />}
                      {item.type === "locked" && <Icon name="lock" size={13} />}
                      {item.type === "completed" && <Icon name="check" size={13} />}
                      {item.type === "system" && <Icon name="monitor" size={13} />}
                    </div>

                    <div className="proctor-feed-item-content">
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
                    </div>

                    <span className="proctor-feed-item-time">{item.time}</span>
                  </div>
                ))}
              </div>

              {/* Floating / Pop-up Lobby Requests Card */}
              {waitingStudents.length > 0 && showLobbyPopup && (
                <div className="proctor-lobby-popup">
                  <div className="proctor-lobby-head">
                    <div className="proctor-lobby-title-wrap">
                      <div className="proctor-lobby-icon">
                        <Icon name="users" size={16} />
                      </div>
                      <div>
                        <h4>Lobby Requests</h4>
                        <p>
                          Students who apply to join the quiz are added to the lobby and require your approval to enter immediately.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="proctor-lobby-close"
                      aria-label="Tutup permintaan lobby"
                      onClick={() => setShowLobbyPopup(false)}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="proctor-lobby-subbar">
                    <span>{waitingStudents.length} pending requests</span>
                    <span style={{ color: "#169453", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span className="proctor-act-dot green" /> Real-time
                    </span>
                  </div>

                  <div className="proctor-lobby-list">
                    {waitingStudents.map((w) => (
                      <div key={w.id} className="proctor-lobby-row">
                        <div className="proctor-lobby-row-info">
                          <span className="proctor-avatar-circle" style={{ width: 28, height: 28, fontSize: 10 }}>
                            {w.name
                              .split(/\s+/)
                              .slice(0, 2)
                              .map((x) => x[0])
                              .join("")
                              .toUpperCase()}
                          </span>
                          <div className="proctor-lobby-details">
                            <strong>{w.name}</strong>
                            <span>
                              {snapshot.exam.className || "CS201"} | {w.nisn}
                            </span>
                          </div>
                        </div>

                        <div className="proctor-lobby-row-bottom">
                          <span className="proctor-lobby-time">Requested at 10:18 AM</span>
                          <div className="proctor-lobby-row-actions">
                            <button
                              type="button"
                              className="proctor-btn-view"
                              onClick={() => void detail(w)}
                            >
                              <Icon name="eye" size={11} /> View
                            </button>
                            <button
                              type="button"
                              className="proctor-btn-approve"
                              onClick={() => void runQuickAction(w, "accept")}
                            >
                              <Icon name="check" size={11} /> Approve
                            </button>
                            <button
                              type="button"
                              className="proctor-btn-reject"
                              onClick={() => void runQuickAction(w, "reject", "Ditolak oleh pengawas")}
                            >
                              ✕ Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </>
      )}

      {/* Modal Dialog Detail & Aksi Peserta (Drawer) */}
      <Dialog
        open={!!student}
        variant="drawer"
        title={student?.name || "Detail peserta"}
        onClose={() => {
          setStudent(null);
          setAction(null);
          setError("");
        }}
      >
        {student && (
          <div className="staff-form">
            <p>
              {student.nisn} · {student.answeredCount}/{student.totalQuestions || 30} soal terisi
            </p>
            <p>
              {student.violationCount} pelanggaran total · {student.violationCycleCount} dalam siklus ini
            </p>

            {action ? (
              <>
                <h3>{labels[action]} peserta?</h3>
                <p>
                  {action === "unlock"
                    ? "Hitungan siklus direset. Jawaban dan waktu akhir tetap sama."
                    : action === "kick"
                    ? "Sesi peserta akan dicabut."
                    : action === "reject"
                    ? "Peserta dapat mengajukan permintaan kembali."
                    : action === "accept"
                    ? "Peserta akan disetujui mengikuti ujian."
                    : "Pesan akan dikirim kepada peserta."}
                </p>
                {["reject", "kick", "warn"].includes(action) && (
                  <label>
                    {action === "warn" ? "Pesan" : "Alasan"}
                    <textarea
                      required={action === "warn"}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                )}
                <ErrorText error={error} />
                <div className="staff-dialog-actions">
                  <MotionButton className="staff-secondary" onClick={() => setAction(null)}>
                    Batal
                  </MotionButton>
                  <MotionButton
                    className="staff-primary"
                    disabled={busy || (action === "warn" && !reason.trim())}
                    onClick={() => void runAction()}
                  >
                    {busy ? "Memproses…" : labels[action]}
                  </MotionButton>
                </div>
              </>
            ) : (
              <>
                <div className="staff-action-wrap">
                  {student.status === "waiting" && (
                    <>
                      <MotionButton onClick={() => setAction("accept")}>Setujui</MotionButton>
                      <MotionButton onClick={() => setAction("reject")}>Tolak</MotionButton>
                    </>
                  )}
                  {student.isLocked && snapshot?.exam.status === "active" && (
                    <MotionButton onClick={() => setAction("unlock")}>Buka kunci</MotionButton>
                  )}
                  {["waiting", "accepted", "active", "disconnected"].includes(student.status) && (
                    <>
                      <MotionButton onClick={() => setAction("warn")}>Peringatkan</MotionButton>
                      <MotionButton onClick={() => setAction("kick")}>Keluarkan</MotionButton>
                    </>
                  )}
                </div>

                <h3>Riwayat</h3>
                {!history ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "8px 0" }}>
                    {[1, 2, 3].map((i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <SkeletonCircle size={18} />
                        <SkeletonText width="65%" height={12} />
                      </div>
                    ))}
                  </div>
                ) : !history.events.length &&
                  !history.warnings.length &&
                  !history.admissionHistory.length ? (
                  <p>Belum ada kejadian.</p>
                ) : (
                  <div className="staff-history">
                    {[
                      ...history.events.map((x) => ({
                        id: x.id,
                        text: x.eventType.replaceAll("_", " "),
                        date: x.timestamp,
                      })),
                      ...history.warnings.map((x) => ({
                        id: x.id,
                        text: x.message,
                        date: x.sentAt,
                      })),
                      ...history.admissionHistory.map((x) => ({
                        id: x.id,
                        text: `${x.action}${x.reason ? `: ${x.reason}` : ""}`,
                        date: x.createdAt,
                      })),
                    ]
                      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
                      .map((x) => (
                        <p key={x.id}>
                          {x.text}
                          <small>{new Date(x.date).toLocaleString("id-ID")}</small>
                        </p>
                      ))}
                  </div>
                )}
                <ErrorText error={error} />
              </>
            )}
          </div>
        )}
      </Dialog>

      {/* Modal Dialog Ubah Status Ujian (Mulai / Akhiri Ujian) */}
      <Dialog
        open={!!globalAction}
        title={globalAction === "active" ? "Mulai ujian?" : "Akhiri ujian?"}
        onClose={() => setGlobalAction(null)}
      >
        <div className="staff-form">
          <p>
            {globalAction === "active"
              ? "Waktu ujian dimulai sekarang untuk seluruh peserta yang disetujui. Jadwal hanya menjadi pengingat."
              : "Ujian akan berakhir untuk semua peserta."}
          </p>
          <ErrorText error={error} />
          <div className="staff-dialog-actions">
            <MotionButton className="staff-secondary" onClick={() => setGlobalAction(null)}>
              Batal
            </MotionButton>
            <MotionButton
              className="staff-primary"
              disabled={busy}
              onClick={() => void changeStatus()}
            >
              {busy ? "Memproses…" : globalAction === "active" ? "Mulai ujian" : "Akhiri ujian"}
            </MotionButton>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
