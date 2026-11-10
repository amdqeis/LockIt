/* Editor and XML controls tested against simulated API responses. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const origin = process.env.EDUQUAS_TEST_FRONTEND_URL || 'http://localhost:3000';
const executablePath = process.env.CHROMIUM_PATH || '/usr/bin/chromium';

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  let draftBody = null;
  let imported = false;
  const bank = {
    id: 'bank-1',
    title: 'Aljabar',
    subject: 'Matematika',
    subjectId: 'subject-1',
    subjectFolder: { id: 'subject-1', name: 'Matematika', gradeLevelId: 'grade-1', gradeLevel: { id: 'grade-1', name: 'Tingkat X' } },
    revision: 1,
    _count: { questions: 0 },
    questions: [],
    drafts: [],
  };

  await page.route('**/api/**', route => {
    const req = route.request();
    const url = new URL(req.url());
    let data = [];
    if (url.pathname === '/api/auth/me') {
      data = { id: 'teacher-1', fullName: 'Guru Uji', email: 'guru@example.invalid', role: 'ADMIN', isActive: true };
    } else if (url.pathname === '/api/academic/grade-levels') {
      data = [{ id: 'grade-1', name: 'Tingkat X' }];
    } else if (url.pathname === '/api/academic/classrooms') {
      data = [{ id: 'class-1', name: 'Kelas A', gradeLevelId: 'grade-1' }];
    } else if (url.pathname === '/api/subjects') {
      data = [{ id: 'subject-1', name: 'Matematika', gradeLevelId: 'grade-1', gradeLevel: { id: 'grade-1', name: 'Tingkat X' }, _count: { banks: 1 } }];
    } else if (url.pathname === '/api/question-banks' && req.method() === 'POST') {
      const body = req.postDataJSON();
      data = { id: 'bank-new', title: body.title, subject: body.subject, revision: 1 };
    } else if (url.pathname === '/api/question-banks' && url.searchParams.has('limit')) {
      data = { items: [bank], nextCursor: null };
    } else if (url.pathname === '/api/question-banks/bank-1') {
      data = bank;
    } else if (url.pathname.includes('/drafts') && req.method() === 'POST') {
      draftBody = req.postDataJSON();
      data = { id: 'draft-1', revision: 1 };
    } else if (url.pathname === '/api/question-banks/bank-1/xml') {
      return route.fulfill({ status: 200, contentType: 'application/xml', body: '<?xml version="1.0"?><eduquas-bank version="1"/>' });
    } else if (url.pathname === '/api/question-banks/xml/preview') {
      data = { title: 'Aljabar', questionCount: 1, mediaCount: 0, warnings: [] };
    } else if (url.pathname === '/api/question-banks/xml/import') {
      imported = true;
      data = { bankId: 'bank-1', draftId: 'draft-1', draftOwnedByCaller: true, alreadyImported: false };
    }
    return route.fulfill({ json: { success: true, data } });
  });

  try {
    await page.goto(`${origin}/dashboard/bank-soal`);

    // 1. Uji tombol primer "Buat Soal" langsung dari header Bank Soal
    const headerCreateBtn = page.getByRole('button', { name: 'Buat Soal', exact: true });
    await headerCreateBtn.waitFor();
    await headerCreateBtn.click();

    // Verifikasi in-place editor langsung terbuka
    const headingNew = page.locator('#bank-creator-title');
    await headingNew.waitFor();
    assert.ok((await headingNew.innerText()).includes('Bank Soal'));

    // Cek keberadaan input nama bank soal
    const bankTitleInput = page.locator('#new-bank-title');
    await bankTitleInput.waitFor();
    await bankTitleInput.fill('Bank Soal Trigonometri');

    // Cek input isi soal 1 dan tombol compact matematika
    const promptNew = page.getByRole('textbox', { name: 'Isi soal 1' });
    await promptNew.fill('Sederhanakan persamaan ');
    await page.getByRole('button', { name: 'Sisipkan persamaan inline' }).first().click();
    await page.locator('math-field').first().click();
    await page.keyboard.type('\\sin x');

    // Batalkan dan kembali ke daftar bank
    await page.getByRole('button', { name: '← Kembali ke daftar bank soal' }).click();
    await page.locator('.drilldown-card').filter({ hasText: 'Tingkat X' }).first().click();
    await page.getByRole('button', { name: /Kelas A/ }).click();

    // 2. Uji tombol "Preview" di tabel membuka Dialog Modal Pop-up
    await page.getByRole('button', { name: 'Preview', exact: true }).first().click();
    const previewModal = page.getByRole('dialog', { name: 'Pratinjau — Aljabar' });
    await previewModal.waitFor();
    assert.ok(await previewModal.isVisible());
    // Tutup popup preview
    await page.keyboard.press('Escape');

    // 3. Uji tombol "Tambah soal" dari baris bank
    await page.getByRole('button', { name: 'Tambah soal' }).first().click();
    const heading = page.locator('#bank-creator-title');
    await heading.waitFor();
    assert.equal(await heading.innerText(), 'Aljabar');

    // Tahap 1: Buat Soal
    const prompt = page.getByRole('textbox', { name: 'Isi soal 1' });
    await prompt.fill('Hitung nilai ');
    await page.getByRole('button', { name: 'Sisipkan persamaan inline' }).first().click();
    await page.locator('math-field').first().click();
    await page.keyboard.type('x');

    // Pindah ke Tahap 2: Pratinjau Siswa
    await page.getByRole('button', { name: 'Lanjutkan ke Pratinjau Siswa →' }).click();
    await page.getByRole('heading', { name: 'Pratinjau Lembar Soal Siswa' }).waitFor();

    // Pindah ke Tahap 3: Konfirmasi Unggah
    await page.getByRole('button', { name: 'Lanjutkan ke Konfirmasi Unggah →' }).click();
    await page.getByRole('heading', { name: 'Konfirmasi Unggah Bank Soal' }).waitFor();

    // Simpan draf di Tahap 3
    await page.getByRole('button', { name: 'Simpan Draf' }).click();
    await page.waitForFunction(() => !!localStorage.getItem('eduquas:bank-draft:teacher-1:bank-1'));
    assert.ok(draftBody && JSON.stringify(draftBody.questions[0].content).includes('equation'));

    // Kembali ke daftar bank soal
    await page.getByRole('button', { name: '← Kembali ke daftar bank soal' }).click();

    // 4. Ekspor & Impor XML
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Ekspor XML' }).click();
    const file = await downloading;
    const target = '/tmp/eduquas-bank-ui-test.xml';
    await file.saveAs(target);

    await page.locator('input[type=file][accept^=".xml"]').setInputFiles(target);
    await page.getByRole('dialog', { name: 'Preview impor XML' }).waitFor();
    await page.getByRole('dialog', { name: 'Preview impor XML' }).getByLabel('Mata pelajaran tujuan').selectOption('subject-1');
    await page.getByRole('button', { name: 'Impor sebagai draf' }).click();
    await page.waitForFunction(() => !!document.querySelector('.exam-creator-entry'));
    assert.equal(imported, true);
    assert.deepEqual(errors, []);

    console.log('PASS: header Buat Soal CTA, in-place 3-step bank question editor, mathway compact CTA, popup preview, and XML controls');
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
