const assert = require("node:assert/strict");
const { chromium } = require("playwright-core");

const origin = process.env.EDUQUAS_TEST_FRONTEND_URL || "http://localhost:3000";
const exam = { id: "exam-1", title: "Ujian Aljabar", status: "active", className: "Kelas A", classroomId: "class-a", subjectId: "math", subjectName: "Matematika", accessCode: "ABC123", durationMinutes: 60, _count: { questions: 1, students: 1 } };
const grade = { id: "grade-x", name: "X", _count: { classrooms: 2, subjects: 1 } };
const gradeXi = { id: "grade-xi", name: "XI", _count: { classrooms: 1, subjects: 0 } };
const classes = [{ id: "class-a", name: "Kelas A", gradeLevelId: grade.id, _count: { exams: 1 } }, { id: "class-empty", name: "Kelas Kosong", gradeLevelId: grade.id, _count: { exams: 0 } }, { id: "class-xi", name: "Kelas XI", gradeLevelId: gradeXi.id, _count: { exams: 0 } }];
const subject = { id: "math", name: "Matematika", gradeLevelId: grade.id, gradeLevel: grade, _count: { banks: 1, exams: 1 } };
const bank = { id: "bank-1", title: "Bank Aljabar", subject: "Matematika", subjectId: subject.id, subjectFolder: subject, revision: 1, _count: { questions: 1 } };
const group = { classroomId: "class-a", className: "Kelas A", gradeLevelId: grade.id, gradeLevelName: "X", totalExams: 1, activeExams: 1, totalCompletedStudents: 1, averageScore: 90, subjects: [{ subjectId: subject.id, subjectName: subject.name, gradeLevelName: "X", totalExams: 1, activeExams: 1, totalCompletedStudents: 1, averageScore: 90, exams: [{ ...exam, completedStudents: 1, pendingGradingCount: 0, averageScore: 90 }] }] };
const legacyGroup = { classroomId: null, className: "Perlu Dipetakan", classNameMissing: true, gradeLevelId: null, gradeLevelName: null, totalExams: 1, activeExams: 1, totalCompletedStudents: 1, averageScore: 80, subjects: [{ subjectId: null, subjectName: "Perlu Dipetakan", gradeLevelName: null, totalExams: 1, activeExams: 1, totalCompletedStudents: 1, averageScore: 80, exams: [{ ...exam, id: "legacy-exam", title: "Ujian Lama", className: null, completedStudents: 1, pendingGradingCount: 0, averageScore: 80 }] }] };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: "reduce", acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  const exports = [];
  const examRequests = [];
  let failXi = false;
  let delayXi = false;
  page.on("pageerror", error => errors.push(error.message));
  await context.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    let data = [];
    if (url.pathname === "/api/auth/me") data = { id: "teacher-1", fullName: "Guru", email: "guru@example.invalid", role: "ADMIN", isActive: true };
    else if (url.pathname === "/api/academic/grade-levels") data = [grade, gradeXi];
    else if (url.pathname === "/api/academic/classrooms") {
      const level = url.searchParams.get("gradeLevelId");
      if (level === gradeXi.id && delayXi) await new Promise(resolve => setTimeout(resolve, 500));
      if (level === gradeXi.id && failXi) return route.fulfill({ status: 500, json: { success: false, error: { message: "Kelas gagal dimuat." } } });
      data = level ? classes.filter(c => c.gradeLevelId === level) : classes;
    }
    else if (url.pathname === "/api/subjects") data = url.searchParams.get("gradeLevelId") === gradeXi.id ? [] : [subject];
    else if (url.pathname === "/api/question-banks") data = url.searchParams.has("limit") ? { items: [bank], nextCursor: null } : [bank];
    else if (url.pathname === "/api/exams/groups") data = { groups: [group, legacyGroup] };
    else if (url.pathname === "/api/exams") { examRequests.push(url.searchParams); data = { items: [exam], nextCursor: null }; }
    else if (url.pathname === "/api/dashboard/results/groups") data = { groups: [group, legacyGroup] };
    else if (url.pathname === "/api/dashboard/results") {
      if (url.searchParams.get("format") === "csv") {
        exports.push(url.searchParams);
        return route.fulfill({ status: 200, contentType: "text/csv", body: "Tingkat,X\n" });
      }
      data = { exams: [exam], attempts: [{ exam, student: { studentId: "student-1", name: "Siswa", nisn: "123", status: "submitted", finalScore: 90, pendingManualCount: 0 } }], students: [], page: 1, total: 1, totalPages: 1 };
    }
    return route.fulfill({ json: { success: true, data } });
  });

  try {
    for (const path of ["ujian", "bank-soal", "kelas-mapel", "monitoring", "hasil"]) {
      await page.goto(`${origin}/dashboard/${path}`);
      const gradeCard = page.locator(".drilldown-card").filter({ hasText: "Tingkat X" }).first();
      await gradeCard.waitFor();
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${path} overflow at ${width}px`);
        await page.screenshot({ path: `/tmp/eduquas-hierarchy-${path}-${width}.png` });
      }
      await page.setViewportSize({ width: 320, height: 900 });
      const gradeBounds = await gradeCard.boundingBox();
      assert.ok(gradeBounds.width >= 44 && gradeBounds.height >= 44, `${path} grade target`);
      await gradeCard.focus();
      await page.keyboard.press("Enter");
      const classCard = page.getByRole("button", { name: /Kelas A/ }).first();
      await classCard.waitFor();
      const classBounds = await classCard.boundingBox();
      assert.ok(classBounds.width >= 44 && classBounds.height >= 44, `${path} class target`);
      await page.getByText("Kelas Kosong", { exact: true }).first().waitFor();
      assert.equal(new URL(page.url()).searchParams.get("gradeLevelId"), grade.id);
      await page.getByRole("button", { name: /Kelas Kosong/ }).first().click();
      await page.waitForFunction(() => new URL(location.href).searchParams.get("classroomId") === "class-empty");
      if (path === "ujian") await page.getByText("Belum ada ujian di kelas ini").waitFor();
      if (path === "monitoring") await page.getByText(/Tidak ada ujian berlangsung di Kelas Kosong/).waitFor();
      if (path === "hasil") await page.getByText("Belum ada rincian pengerjaan yang tersimpan untuk kelas ini.").waitFor();
      await page.getByRole("navigation", { name: "Lokasi navigasi" }).getByRole("button", { name: "X", exact: true }).click();
      await classCard.click();
      await page.waitForFunction(() => new URL(location.href).searchParams.get("classroomId") === "class-a");
      if (path === "bank-soal") await page.getByText("Bank Aljabar", { exact: false }).first().waitFor();
      else if (path === "kelas-mapel") await page.getByText("Matematika · X", { exact: true }).waitFor();
      else await page.getByText("Ujian Aljabar", { exact: false }).first().waitFor();
      if (path === "hasil") assert.equal(await page.getByRole("button", { name: "Per Tingkat & Kelas" }).getAttribute("aria-pressed"), "true");
      if (path === "ujian") assert.equal(await page.getByRole("button", { name: "Per Kelas" }).getAttribute("aria-pressed"), "true");
      if (path === "monitoring") assert.equal(await page.getByRole("button", { name: "Berlangsung", exact: true }).getAttribute("aria-pressed"), "true");
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const overflow = await page.evaluate(() => ({ bad: document.documentElement.scrollWidth > innerWidth, elements: [...document.querySelectorAll("body *")].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(el => `${el.tagName}.${el.className}:${Math.round(el.getBoundingClientRect().right)}`) }));
        assert.equal(overflow.bad, false, `${path} detail overflow at ${width}px: ${overflow.elements.join(", ")}`);
        await page.screenshot({ path: `/tmp/eduquas-hierarchy-${path}-detail-${width}.png` });
      }
      await page.reload();
      await page.waitForFunction(() => new URL(location.href).searchParams.get("classroomId") === "class-a");
      await page.getByRole("navigation", { name: "Lokasi navigasi" }).waitFor();
      if (path === "hasil") {
        await page.setViewportSize({ width: 320, height: 900 });
        for (const label of ["Ekspor CSV Global", "Ekspor CSV Kelas Ini", "Ekspor CSV Ujian"]) {
          const bounds = await page.getByRole("button", { name: label }).boundingBox();
          assert.ok(bounds.width >= 44 && bounds.height >= 44, `${label} touch target`);
        }
        await page.getByLabel("Cari hasil ujian").fill("filter aktif");
        for (const label of ["Ekspor CSV Global", "Ekspor CSV Kelas Ini", "Ekspor CSV Ujian"]) {
          const download = page.waitForEvent("download");
          await page.getByRole("button", { name: label }).click();
          await download;
        }
        assert.deepEqual(exports.map(p => [p.get("csvLayout"), p.get("classroomId"), p.get("examId")]), [["grouped", null, null], ["grouped", "class-a", null], ["grouped", null, "exam-1"]]);
        assert.ok(exports.every(p => !p.has("search") && !p.has("page") && !p.has("gradeLevelId")));
      }
      await page.getByRole("navigation", { name: "Lokasi navigasi" }).getByRole("button", { name: "X", exact: true }).click();
      await page.getByText("Kelas Kosong", { exact: true }).first().waitFor();
      assert.equal(new URL(page.url()).searchParams.has("classroomId"), false);
      await page.goBack();
      await page.waitForFunction(() => new URL(location.href).searchParams.get("classroomId") === "class-a");
    }
    await page.goto(`${origin}/dashboard/hasil`);
    await page.locator(".drilldown-card").filter({ hasText: "Perlu dipetakan" }).first().click();
    await page.getByRole("button", { name: /Perlu Dipetakan/ }).first().click();
    await page.getByText("Ujian Lama", { exact: false }).first().waitFor();
    const legacyDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Ekspor CSV Kelas Ini" }).click();
    await legacyDownload;
    const legacyExport = exports.at(-1);
    assert.equal(legacyExport.get("unmappedClassroom"), "true");
    assert.equal(legacyExport.get("unmappedGrade"), "true");
    assert.equal(legacyExport.get("missingClassName"), "true");
    assert.equal(legacyExport.has("className"), false);
    await page.goto(`${origin}/dashboard/ujian?className=Kelas%20Lain`);
    await page.locator(".drilldown-card").filter({ hasText: "Perlu dipetakan" }).first().click();
    await page.getByRole("button", { name: /Perlu Dipetakan/ }).first().click();
    await page.getByRole("button", { name: "Semua Ujian" }).click();
    assert.equal(await page.getByRole("button", { name: "Semua Ujian" }).getAttribute("aria-pressed"), "true");
    await page.waitForTimeout(400);
    const legacyExamRequest = examRequests.at(-1);
    assert.equal(legacyExamRequest.get("unmappedClassroom"), "true");
    assert.equal(legacyExamRequest.get("unmappedGrade"), "true");
    assert.equal(legacyExamRequest.get("missingClassName"), "true");
    assert.equal(legacyExamRequest.has("className"), false);
    await page.goto(`${origin}/dashboard/kelas-mapel`);
    failXi = true;
    await page.locator(".drilldown-card").filter({ hasText: "Tingkat XI" }).click();
    await page.getByRole("alert").getByText("Kelas gagal dimuat.").waitFor();
    failXi = false;
    await page.getByRole("button", { name: "Coba lagi" }).click();
    await page.getByRole("button", { name: /Kelas XI/ }).waitFor();
    await page.getByRole("navigation", { name: "Lokasi navigasi" }).getByRole("button", { name: "Tingkatan" }).click();
    delayXi = true;
    await page.locator(".drilldown-card").filter({ hasText: "Tingkat XI" }).click();
    await page.getByRole("navigation", { name: "Lokasi navigasi" }).getByRole("button", { name: "Tingkatan" }).click();
    await page.locator(".drilldown-card").filter({ hasText: "Tingkat X" }).first().click();
    await page.getByRole("button", { name: /Kelas A/ }).waitFor();
    await page.waitForTimeout(600);
    assert.equal(await page.getByText("Kelas XI", { exact: true }).count(), 0, "late grade response must not replace current classes");
    assert.deepEqual(errors, []);
    console.log("PASS: five hierarchy flows, keyboard, empty classes, reload/back, errors/races, CSV scopes and 320/390/768/1440px overflow");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
