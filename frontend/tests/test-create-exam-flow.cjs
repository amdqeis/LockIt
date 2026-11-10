const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const origin = process.env.EDUQUAS_TEST_FRONTEND_URL || 'http://localhost:3000';
const executablePath = process.env.CHROMIUM_PATH || '/usr/bin/chromium';

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  const subject = { id: 'sub-1', name: 'Matematika', gradeLevelId: 'grade-1' };
  const bank = {
    id: 'bank-1',
    title: 'Aljabar',
    subject: 'Matematika',
    subjectId: 'sub-1',
    revision: 1,
    _count: { questions: 2 },
    questions: [
      { id: 'q-1', orderIndex: 1, type: 'single_choice', questionText: 'Berapakah 2 + 2?', options: [{ id: 'A', label: 'A', text: '4' }, { id: 'B', label: 'B', text: '5' }], correctAnswer: 'A', points: 10 },
      { id: 'q-2', orderIndex: 2, type: 'single_choice', questionText: 'Berapakah 3 x 3?', options: [{ id: 'A', label: 'A', text: '9' }, { id: 'B', label: 'B', text: '6' }], correctAnswer: 'A', points: 10 },
    ],
  };

  const interceptedPayloads = [];

  await page.route('**/api/**', route => {
    const req = route.request();
    const url = new URL(req.url());

    if (url.pathname === '/api/auth/me') {
      return route.fulfill({ json: { success: true, data: { id: 'teacher-1', fullName: 'Guru Penguji', role: 'TEACHER', isActive: true } } });
    }
    if (url.pathname === '/api/academic/grade-levels') {
      return route.fulfill({ json: { success: true, data: [{ id: 'grade-1', name: 'X' }] } });
    }
    if (url.pathname === '/api/academic/classrooms') {
      return route.fulfill({ json: { success: true, data: [{ id: 'class-1', name: '10-A', gradeLevelId: 'grade-1' }] } });
    }
    if (url.pathname === '/api/subjects') {
      return route.fulfill({ json: { success: true, data: [subject] } });
    }
    if (url.pathname === '/api/question-banks/bank-1') {
      return route.fulfill({ json: { success: true, data: bank } });
    }
    if (url.pathname === '/api/question-banks' && url.searchParams.has('limit')) {
      return route.fulfill({ json: { success: true, data: { items: [bank], nextCursor: null } } });
    }
    if (url.pathname === '/api/question-banks') {
      return route.fulfill({ json: { success: true, data: [bank] } });
    }
    if (url.pathname === '/api/exams' && req.method() === 'GET') {
      return route.fulfill({ json: { success: true, data: { items: [], nextCursor: null } } });
    }
    if (url.pathname === '/api/exams' && req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      interceptedPayloads.push(body);
      return route.fulfill({
        status: 201,
        json: {
          success: true,
          data: {
            id: 'exam-new-1',
            title: body.title,
            accessCode: 'TEST99',
            status: 'draft',
            _count: { questions: 2, students: 0 },
          },
        },
      });
    }
    return route.fulfill({ json: { success: true, data: [] } });
  });

  try {
    // 1. Buka halaman daftar ujian
    await page.goto(`${origin}/dashboard/ujian`);
    await page.getByRole('button', { name: 'Buat ujian' }).waitFor();

    // 2. Klik Buat Ujian
    await page.getByRole('button', { name: 'Buat ujian' }).click();
    const heading = page.locator('#entry-title');
    await heading.waitFor();
    assert.ok((await heading.innerText()).includes('Buat ujian baru'));

    // 3. Isi Langkah 1: Informasi Dasar (biarkan deskripsi, nomor kategori, dan jadwal kosong)
    await page.locator('#exam-title').fill('Penilaian Harian Matematika');
    await page.locator('#exam-grade-level').selectOption('grade-1');
    await page.locator('#exam-class').selectOption('class-1');
    await page.locator('#exam-subject').selectOption('sub-1');
    await page.locator('#exam-duration').fill('60');

    // Pastikan deskripsi, categoryNumber, dan scheduledStartAt kosong
    assert.equal(await page.locator('#exam-description').inputValue(), '');
    assert.equal(await page.locator('#exam-category-number').inputValue(), '');
    assert.equal(await page.locator('#exam-schedule').inputValue(), '');

    // Klik tombol lanjutkan ke soal
    await page.getByRole('button', { name: 'Lanjutkan ke pilihan soal →' }).click();

    // 4. Langkah 2: Pilih Soal
    await page.locator('#exam-bank').waitFor();
    await page.locator('#exam-bank').selectOption('bank-1');
    await page.getByText('Daftar butir soal').waitFor();

    // Klik Lanjutkan ke aturan & keamanan
    await page.getByRole('button', { name: 'Lanjutkan ke aturan & keamanan →' }).click();

    // 5. Langkah 3: Aturan & Simpan
    const submitBtn = page.getByRole('button', { name: 'Simpan & terbitkan ujian' });
    await submitBtn.waitFor();
    await submitBtn.click();

    // 6. Verifikasi Request Payload yang terkirim
    await page.waitForFunction(() => !document.querySelector('.exam-creator-entry'));
    assert.equal(interceptedPayloads.length, 1, 'Harus ada 1 panggilan POST ke /api/exams');

    const p = interceptedPayloads[0];
    assert.equal(p.title, 'Penilaian Harian Matematika');
    assert.equal(p.className, '10-A');
    assert.equal(p.durationMinutes, 60);
    assert.equal(p.subjectId, 'sub-1');
    assert.equal(p.bankId, 'bank-1');
    assert.equal(p.description, null, 'Deskripsi kosong harus dikirim sebagai null');
    assert.equal(p.categoryNumber, null, 'Category number kosong harus dikirim sebagai null');
    assert.equal(p.scheduledStartAt, null, 'Scheduled start at kosong harus dikirim sebagai null');
    assert.deepEqual(p.questionIds, ['q-1', 'q-2']);

    // Pastikan tidak ada pesan error di halaman
    assert.equal(await page.locator('.error[role="alert"]').count(), 0);
    assert.deepEqual(errors, []);
    await page.goto(`${origin}/dashboard/ujian?create=true`);
    await page.locator('#entry-title').waitFor();

    console.log('PASS: test-create-exam-flow completed successfully without validation error');
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
