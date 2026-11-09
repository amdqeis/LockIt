/* Dashboard checks with controlled API responses; no database fixtures are changed. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const origin = process.env.EDUQUAS_TEST_FRONTEND_URL || 'http://localhost:3002';
const executablePath = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
const exam = { id: 'exam-1', title: 'Ujian Matematika', accessCode: 'ABC234', status: 'draft', durationMinutes: 60, subjectId: 'subject-1', subjectName: 'Matematika', className: 'X A', academicYear: '2026/2027', semester: 'ganjil', category: 'Quiz', revision: 1, settings: { bank_id: 'bank-1' }, violationPolicy: {}, _count: { questions: 1, students: 2 } };
const bank = { id: 'bank-1', title: 'Aljabar', subject: 'Matematika', subjectId: 'subject-1', revision: 2, _count: { questions: 1 }, questions: [{ id: 'q1', type: 'single_choice', questionText: 'Hitung', options: [{ id: 'A', label: 'A', text: 'Satu' }, { id: 'B', label: 'B', text: 'Dua' }], correctAnswer: 'A', points: 10 }], drafts: [] };
const student = { studentId: 'student-1', name: 'Peserta Uji', nisn: '1234567890', status: 'submitted', finalScore: 100, pendingManualCount: 0, violationCount: 0, submittedAt: '2026-11-09T00:00:00Z' };

async function setup(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const calls = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/socket.io/**', route => route.abort());
  await page.route('**/api/**', route => {
    const req = route.request(); const url = new URL(req.url()); calls.push({ path: url.pathname, query: url.search, method: req.method(), body: req.postData() });
    let data = [];
    if (url.pathname === '/api/auth/me') data = { id: 'teacher-1', fullName: 'Guru Pengawas', email: 'guru@example.invalid', role: 'ADMIN', isActive: true };
    else if (url.pathname === '/api/auth/me/profile') data = { id: 'teacher-1', fullName: 'Guru Baru', email: 'guru@example.invalid', role: 'ADMIN', isActive: true };
    else if (url.pathname === '/api/dashboard/overview') data = { waiting: 2, ungraded: 1, activeCount: 0, exams: [exam] };
    else if (url.pathname === '/api/exams' && url.searchParams.has('limit')) data = { items: [exam], nextCursor: url.searchParams.has('cursor') ? null : 'exam-1' };
    else if (url.pathname === '/api/exams') data = [exam, { ...exam, id: 'ended-1', status: 'ended' }];
    else if (url.pathname === '/api/exams/exam-1/dashboard') data = { exam: { id: 'exam-1', title: exam.title, className: 'X A', accessCode: exam.accessCode, status: 'draft', startTime: null, endTime: null }, overview: { waitingCount: 1, activeCount: 0, submittedCount: 0, lockedCount: 0 }, serverTime: new Date().toISOString() };
    else if (url.pathname === '/api/exams/exam-1/students') data = { students: [{ id: 'student-1', name: 'Peserta Pantau', nisn: '1234567890', status: 'waiting', isLocked: false, answeredCount: 0, totalQuestions: 1, violationCount: 0, violationCycleCount: 0 }], totalStudents: 1, totalPages: 1 };
    else if (url.pathname === '/api/exams/exam-1/students/student-1/violations') data = { events: [], warnings: [], admissionHistory: [] };
    else if (url.pathname === '/api/subjects') data = [{ id: 'subject-1', name: 'Matematika', _count: { banks: 1 } }];
    else if (url.pathname === '/api/question-banks' && url.searchParams.has('limit')) data = { items: [bank], nextCursor: null };
    else if (url.pathname === '/api/question-banks') data = [bank];
    else if (url.pathname === '/api/question-banks/bank-1') data = bank;
    else if (url.pathname === '/api/question-banks/bank-1/drafts') data = { id: 'draft-1', revision: 1 };
    else if (url.pathname === '/api/dashboard/results/facets') data = { subject: ['Matematika'], className: ['X A'], period: ['2026/2027 · ganjil'], category: ['Quiz'] };
    else if (url.pathname === '/api/dashboard/results' && url.searchParams.get('format') === 'csv') return route.fulfill({ status: 200, contentType: 'text/csv', body: 'Nama,NISN\r\nPeserta,1234567890' });
    else if (url.pathname === '/api/dashboard/results') data = { exams: [{ ...exam, id: 'ended-1' }], attempts: url.searchParams.get('mode') === 'matrix' ? [] : [{ exam: { ...exam, id: 'ended-1' }, student }], students: url.searchParams.get('mode') === 'matrix' ? [{ name: student.name, nisn: student.nisn, scores: { 'ended-1': { finalScore: 100, pendingManualCount: 0 } } }] : [], page: Number(url.searchParams.get('page') || 1), total: 26, totalPages: 2 };
    else if (url.pathname === '/api/admin/teachers') data = { data: [{ id: 'teacher-1', fullName: 'Guru Pengawas', email: 'guru@example.invalid', role: 'ADMIN', isActive: true }] };
    return route.fulfill({ json: { success: true, data } });
  });
  return { context, page, calls, errors };
}

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  try {
    for (const width of [320, 390, 768, 1024, 1440]) {
      const { context, page, errors } = await setup(browser, width);
      await page.goto(`${origin}/dashboard`);
      await page.getByText('Ujian yang memerlukan perhatian').waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `dashboard overflow at ${width}`);
      if (width === 390 || width === 1440) await page.screenshot({ path: `/tmp/eduquas-dashboard-${width}.png`, fullPage: true });
      if (width < 800) await page.getByRole('button', { name: 'Buka navigasi' }).click();
      await page.locator('.staff-sidebar').getByRole('link', { name: 'Bank Soal', exact: true }).click();
      await page.getByRole('heading', { name: 'Bank soal', exact: true }).waitFor();
      const trigger = page.getByRole('button', { name: 'Mata pelajaran' });
      await trigger.click(); await page.getByRole('dialog', { name: 'Buat mata pelajaran' }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `dialog overflow at ${width}`);
      await page.keyboard.press('Escape'); await assert.equal(await page.getByRole('dialog', { name: 'Buat mata pelajaran' }).isVisible(), false);
      assert.equal(await trigger.evaluate(element => element === document.activeElement), true, 'focus returns to the trigger');
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}: layout, navigation and dialog keyboard`);
      await context.close();
    }
    {
      const { context, page, calls, errors } = await setup(browser, 1440);
      await page.goto(`${origin}/dashboard`);
      await page.getByText('Ujian yang memerlukan perhatian').waitFor();
      const initialAuthRequests = calls.filter(call => call.path === '/api/auth/me').length;
      const sidebar = page.locator('.staff-sidebar');
      await sidebar.getByRole('link', { name: 'Ujian', exact: true }).click();
      await page.getByRole('button', { name: 'Buat ujian' }).waitFor();
      await sidebar.getByRole('link', { name: 'Bank Soal', exact: true }).click();
      await page.getByRole('heading', { name: 'Bank soal', exact: true }).waitFor();
      await page.goBack();
      await page.getByRole('button', { name: 'Buat ujian' }).waitFor();
      assert.equal(calls.filter(call => call.path === '/api/auth/me').length, initialAuthRequests, 'navigation keeps the authenticated dashboard mounted');
      assert.equal(await sidebar.getByRole('link', { name: 'Ujian', exact: true }).getAttribute('aria-current'), 'page');
      assert.deepEqual(errors, []);
      console.log('PASS: persistent dashboard, navigation and browser back');
      await context.close();
    }
    {
      const { context, page, calls, errors } = await setup(browser, 1440);
      await page.goto(`${origin}/dashboard`);
      await page.getByText('Ujian yang memerlukan perhatian').waitFor();
      await page.getByRole('button', { name: /Cari ujian atau menu/ }).click();
      const search = page.getByRole('dialog', { name: 'Cari' });
      await search.getByLabel('Cari ujian atau menu').fill('Matematika');
      await search.getByRole('link', { name: /Ujian Matematika/ }).waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Notifikasi' }).click();
      const notifications = page.getByRole('dialog', { name: 'Notifikasi' });
      await notifications.getByText('2 permintaan peserta').waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Buka profil' }).click();
      const profile = page.getByRole('dialog', { name: 'Profil saya' });
      await profile.getByLabel('Nama lengkap').fill('Guru Baru');
      await profile.getByRole('button', { name: 'Simpan profil' }).click();
      await profile.getByText('Profil berhasil disimpan.').waitFor();
      assert.ok(calls.some(call => call.path === '/api/auth/me/profile' && call.method === 'PUT'));
      await page.keyboard.press('Escape');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.getByRole('button', { name: 'Notifikasi' }).click();
      await page.evaluate(() => window.dispatchEvent(new WheelEvent('wheel', { deltaY: 300 })));
      assert.equal(new URL(page.url()).pathname, '/dashboard', 'open dialog blocks bottom navigation');
      await page.keyboard.press('Escape');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.mouse.move(1420, 860);
      await page.mouse.wheel(0, 1000);
      await page.waitForFunction(() => document.querySelector('[aria-label="Progres menuju Ujian"]')?.getAttribute('aria-valuenow') === '18');
      assert.equal(new URL(page.url()).pathname, '/dashboard', 'one strong scroll must not navigate');
      for (let i = 0; i < 5; i++) await page.mouse.wheel(0, 80);
      await page.waitForTimeout(700);
      await page.mouse.wheel(0, 80);
      await page.waitForURL('**/dashboard/ujian');
      assert.deepEqual(errors, []);
      console.log('PASS: search, notifications, profile and bottom navigation');
      await context.close();
    }
    {
      const { context, page } = await setup(browser, 390);
      await page.goto(`${origin}/dashboard`);
      await page.getByText('Ujian yang memerlukan perhatian').waitFor();
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.evaluate(() => {
        const start = new Touch({ identifier: 1, target: document.body, clientX: 10, clientY: 500 });
        const move = new Touch({ identifier: 1, target: document.body, clientX: 10, clientY: 400 });
        document.body.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [start] }));
        document.body.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: [move] }));
      });
      await page.waitForFunction(() => document.querySelector('[aria-label="Progres menuju Ujian"]')?.getAttribute('aria-valuenow') === '50');
      await page.screenshot({ path: '/tmp/eduquas-pull-progress-390.png' });
      await page.evaluate(() => document.body.dispatchEvent(new TouchEvent('touchcancel', { bubbles: true })));
      await page.waitForFunction(() => document.querySelector('[aria-label="Progres menuju Ujian"]')?.getAttribute('aria-valuenow') === '0');
      await page.evaluate(() => {
        const start = new Touch({ identifier: 1, target: document.body, clientX: 10, clientY: 500 });
        const move = new Touch({ identifier: 1, target: document.body, clientX: 10, clientY: 250 });
        document.body.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [start] }));
        document.body.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: [move] }));
      });
      await page.getByText('Siap berpindah').waitFor();
      await page.evaluate(() => {
        const end = new Touch({ identifier: 1, target: document.body, clientX: 10, clientY: 250 });
        document.body.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [end] }));
      });
      await page.waitForURL('**/dashboard/ujian');
      console.log('PASS: mobile bottom swipe');
      await context.close();
    }
    const { context, page, calls, errors } = await setup(browser, 390);
    await page.goto(`${origin}/dashboard/ujian`); await page.getByRole('button', { name: 'Edit', exact: true }).waitFor();
    const nextExamPage = page.waitForResponse(response => response.url().includes('/api/exams?') && response.url().includes('cursor=exam-1'));
    await page.getByRole('button', { name: 'Berikutnya' }).click();
    await nextExamPage;
    assert.ok(calls.some(call => call.path === '/api/exams' && call.query.includes('cursor=exam-1')));
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const edit = page.getByRole('dialog', { name: 'Edit ujian' }); await edit.getByLabel('Ganti bank atau pilihan soal').check();
    await edit.getByText('Soal 1:').waitFor(); await page.keyboard.press('Escape');
    await page.goto(`${origin}/dashboard/hasil`); await page.getByText('Peserta Uji').waitFor();
    await page.getByRole('button', { name: 'Berikutnya' }).click();
    await page.waitForFunction(() => location.search.includes('page=2'));
    await page.getByRole('button', { name: 'Matriks' }).click();
    await page.waitForFunction(() => location.search.includes('mode=matrix'));
    await page.getByRole('button', { name: 'Ekspor CSV' }).click();
    await page.waitForTimeout(300);
    assert.ok(calls.some(call => call.path === '/api/dashboard/results' && call.query.includes('format=csv') && call.query.includes('mode=matrix')));
    await page.goto(`${origin}/dashboard/monitoring?exam=exam-1`);
    await page.getByRole('button', { name: /Peserta Pantau/ }).click();
    const drawer = page.getByRole('dialog', { name: 'Peserta Pantau' });
    await drawer.waitFor();
    assert.equal(await drawer.evaluate(element => Math.round(element.getBoundingClientRect().width)), 390, 'drawer fills a mobile viewport');
    await drawer.getByRole('button', { name: 'Setujui' }).click();
    await drawer.getByText('Peserta akan disetujui mengikuti ujian.').waitFor();
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
    console.log('PASS: exam pagination, edit selection, result pagination, matrix and CSV');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
