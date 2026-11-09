import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { NextRequest } from "next/server";

const enabled = process.env.EDUQUAS_TEMP_DB_TEST === "1" && process.env.DATABASE_URL?.startsWith("postgresql://key@127.0.0.1:15437/");
test("temporary database: bank snapshot, approval, answer, lock, unlock and submit", { skip: !enabled }, async () => {
  process.env.JWT_ACCESS_SECRET = "temporary-test-access";
  process.env.JWT_REFRESH_SECRET = "temporary-test-refresh";
  process.env.STUDENT_SESSION_SECRET = "temporary-test-student";
  const [{ prisma }, auth, subjects, banks, drafts, commit, exams, examDetail, studentList, accept, status, answer, event, unlock, submit, scheduler] = await Promise.all([
    import("@/lib/prisma"), import("@/lib/auth"), import("@/app/api/subjects/route"), import("@/app/api/question-banks/route"),
    import("@/app/api/question-banks/[id]/drafts/route"), import("@/app/api/question-banks/[id]/drafts/[draftId]/commit/route"),
    import("./route"), import("@/app/api/exams/[id]/route"), import("@/app/api/exams/[id]/students/route"), import("@/app/api/exams/[id]/students/[sid]/accept/route"), import("@/app/api/exams/[id]/status/route"),
    import("@/app/api/exam-session/answer/route"), import("@/app/api/proctoring/event/route"),
    import("@/app/api/exams/[id]/students/[sid]/unlock/route"), import("@/app/api/exam-session/submit/route"), import("@/lib/scheduler"),
  ]);
  const request = (path: string, body: unknown, token: string, method = "POST", student = false) => new NextRequest(`http://localhost${path}`, { method, headers: { "Content-Type": "application/json", ...(student ? { "x-student-session": token } : { Authorization: `Bearer ${token}` }) }, body: JSON.stringify(body) });
  const check = async (response: Response, expected: number) => { const json = await response.json(); assert.equal(response.status, expected, JSON.stringify(json)); return json.data; };
  const teacher = await prisma.teacher.create({ data: { email: `${randomUUID()}@example.invalid`, fullName: "Guru Uji", passwordHash: "test-only" } });
  const teacherToken = auth.generateAccessToken({ teacherId: teacher.id, email: teacher.email, fullName: teacher.fullName, role: "TEACHER" });
  let examId = "";
  try {
    const subject = await check(await subjects.POST(request("/api/subjects", { name: `Matematika ${randomUUID()}` }, teacherToken)), 201);
    const bank = await check(await banks.POST(request("/api/question-banks", { title: "Aljabar", subject: subject.name, subjectId: subject.id }, teacherToken)), 201);
    const bankParams = { params: Promise.resolve({ id: bank.id }) };
    const question = { type: "multi_select", questionText: "Hitung $x^2$", content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "equation", attrs: { latex: "x^2" } }] }] }, options: [{ id: "AA", label: "AA", text: "Satu" }, { id: "BB", label: "BB", text: "Dua" }], correctAnswers: ["AA", "BB"], points: 10 };
    const draft = await check(await drafts.POST(request("/api/drafts", { questions: [question] }, teacherToken), bankParams), 201);
    await check(await commit.POST(request("/api/commit", { revision: draft.revision }, teacherToken), { params: Promise.resolve({ id: bank.id, draftId: draft.id }) }), 200);
    const updatedBank = await prisma.questionBank.findUniqueOrThrow({ where: { id: bank.id }, include: { questions: true } });
    const created = await check(await exams.POST(request("/api/exams", { title: "Ujian Uji", durationMinutes: 60, subjectId: subject.id, bankId: bank.id, bankRevision: updatedBank.revision, questionIds: [updatedBank.questions[0].id], settings: { show_score_to_student: true, allow_answer_review: true }, violationPolicy: { max_violations: 3, action: "lock", detect_screenshot: true, detect_tab_switch: true } }, teacherToken)), 201);
    examId = created.id;
    const savedQuestion = await prisma.question.findFirstOrThrow({ where: { examId } });
    assert.equal(savedQuestion.correctAnswer, "AA,BB"); assert.deepEqual(savedQuestion.content, question.content);
    await prisma.bankQuestion.update({ where: { id: updatedBank.questions[0].id }, data: { questionText: "Soal bank berubah" } });
    assert.equal((await prisma.question.findUniqueOrThrow({ where: { id: savedQuestion.id } })).questionText, question.questionText);
    const otherToken = auth.generateAccessToken({ teacherId: randomUUID(), email: "other@example.invalid", fullName: "Guru Lain", role: "TEACHER" });
    const adminToken = auth.generateAccessToken({ teacherId: randomUUID(), email: "admin@example.invalid", fullName: "Admin", role: "ADMIN" });
    const detailReq = (token: string) => new NextRequest("http://localhost/api/exams/detail", { headers: { Authorization: `Bearer ${token}` } });
    assert.equal((await examDetail.GET(detailReq(otherToken), { params: Promise.resolve({ id: examId }) })).status, 404);
    assert.equal((await examDetail.GET(detailReq(adminToken), { params: Promise.resolve({ id: examId }) })).status, 200);
    const studentId = randomUUID(); const nisn = "1234567890";
    const studentToken = auth.generateStudentSessionToken({ studentId, examId, nisn });
    await prisma.student.create({ data: { id: studentId, examId, name: "Peserta Uji", nisn, sessionTokenHash: auth.hashStudentToken(studentToken) } });
    const params = { params: Promise.resolve({ id: examId, sid: studentId }) };
    await check(await accept.POST(request("/api/accept", {}, teacherToken), params), 200);
    const startResponses = await Promise.all([0, 1].map(() => status.PUT(request("/api/status", { status: "active" }, teacherToken, "PUT"), { params: Promise.resolve({ id: examId }) })));
    const [started, startedAgain] = await Promise.all(startResponses.map(response => check(response, 200)));
    assert.equal(started.exam.endTime, startedAgain.exam.endTime);
    const lateId = randomUUID(); const lateNisn = "0987654321";
    const lateToken = auth.generateStudentSessionToken({ studentId: lateId, examId, nisn: lateNisn });
    await prisma.student.create({ data: { id: lateId, examId, name: "Peserta Terlambat", nisn: lateNisn, sessionTokenHash: auth.hashStudentToken(lateToken) } });
    const late = await check(await accept.POST(request("/api/accept", {}, teacherToken), { params: Promise.resolve({ id: examId, sid: lateId }) }), 200);
    assert.equal(late.status, "active"); assert.equal(late.endTime, started.exam.endTime);
    const studentSearch = new NextRequest("http://localhost/api/students?search=Terlambat&page=1&pageSize=1", { headers: { Authorization: `Bearer ${teacherToken}` } });
    const filteredStudents = await check(await studentList.GET(studentSearch, { params: Promise.resolve({ id: examId }) }), 200);
    assert.equal(filteredStudents.totalStudents, 1); assert.equal(filteredStudents.students[0].id, lateId);
    await check(await answer.POST(request("/api/answer", { questionId: savedQuestion.id, selectedOption: "BB,AA" }, studentToken, "POST", true)), 200);
    const incidentIds = [randomUUID(), randomUUID(), randomUUID()];
    for (const incidentId of incidentIds) await check(await event.POST(request("/api/event", { eventType: "window_blur", incidentId }, studentToken, "POST", true)), 200);
    let current = await prisma.student.findUniqueOrThrow({ where: { id: studentId } }); assert.equal(current.isLocked, true); assert.equal(current.violationCycleCount, 3);
    await check(await event.POST(request("/api/event", { eventType: "window_blur", incidentId: incidentIds[0] }, studentToken, "POST", true)), 200);
    await check(await unlock.POST(request("/api/unlock", {}, teacherToken), params), 200);
    current = await prisma.student.findUniqueOrThrow({ where: { id: studentId } }); assert.equal(current.isLocked, false); assert.equal(current.violationCount, 3); assert.equal(current.violationCycleCount, 0);
    assert.equal((await prisma.answer.findFirstOrThrow({ where: { studentId } })).selectedOption, "AA,BB");
    const after = await prisma.exam.findUniqueOrThrow({ where: { id: examId } }); assert.equal(after.endTime?.toISOString(), started.exam.endTime);
    await check(await event.POST(request("/api/event", { eventType: "screenshot", incidentId: randomUUID(), metadata: { source: "keyboard_shortcut", shortcut: "print_screen" } }, studentToken, "POST", true)), 200);
    assert.equal((await prisma.student.findUniqueOrThrow({ where: { id: studentId } })).isLocked, true);
    await check(await unlock.POST(request("/api/unlock", {}, teacherToken), params), 200);
    await check(await submit.POST(request("/api/submit", {}, studentToken, "POST", true)), 200);
  } finally { if (examId) scheduler.cancelExamAutoEnd(examId); await prisma.$disconnect(); }
});
