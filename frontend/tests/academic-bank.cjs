/* Browser coverage with simulated APIs; no database is modified. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const origin = process.env.EDUQUAS_TEST_FRONTEND_URL || 'http://localhost:3000';
const executablePath = process.env.CHROMIUM_PATH || '/usr/bin/chromium';

function contrast(foreground, background) {
  const parse = (color) => color.match(/[\d.]+/g).map(Number);
  const fg = parse(foreground);
  const bg = parse(background);
  const alpha = bg[3] ?? 1;
  const surface = bg.slice(0, 3).map((channel) => channel * alpha + 255 * (1 - alpha));
  const luminance = (rgb) => rgb.slice(0, 3).map((value) => value / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const light = luminance(surface);
  const ink = luminance(fg);
  return (Math.max(light, ink) + 0.05) / (Math.min(light, ink) + 0.05);
}

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const grades = [{ id: 'grade-x', name: 'Tingkat X' }, { id: 'grade-xi', name: 'Tingkat XI' }, { id: 'grade-xii', name: 'Tingkat XII' }];
  const subjects = [
    { id: 'math-x', name: 'Matematika', gradeLevelId: 'grade-x', gradeLevel: grades[0], _count: { banks: 1, exams: 0 } },
    { id: 'physics-x', name: 'Fisika', gradeLevelId: 'grade-x', gradeLevel: grades[0], _count: { banks: 0, exams: 0 } },
    { id: 'math-xi', name: 'Matematika', gradeLevelId: 'grade-xi', gradeLevel: grades[1], _count: { banks: 0, exams: 0 } },
  ];
  let bank = { id: 'bank-1', title: 'Aljabar', subject: 'Matematika', subjectId: 'math-x', subjectFolder: subjects[0], revision: 1, _count: { questions: 0 }, questions: [], drafts: [] };
  let createdBank;
  let patchBody;
  let draftBody;
  let subjectPosts = 0;
  let slowGrade = false;
  let failGrade = false;
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await context.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    let data = [];
    if (url.pathname === '/api/auth/me') data = { id: 'teacher-1', fullName: 'Guru Uji', email: 'guru@example.invalid', role: 'ADMIN', isActive: true };
    else if (url.pathname === '/api/academic/grade-levels') data = grades;
    else if (url.pathname === '/api/academic/classrooms') {
      if (slowGrade && url.searchParams.get('gradeLevelId') === 'grade-xi') await new Promise((resolve) => setTimeout(resolve, 400));
      if (failGrade && url.searchParams.get('gradeLevelId') === 'grade-xi') return route.fulfill({ status: 500, json: { success: false, error: { message: 'Kelas gagal dimuat.' } } });
      const gradeId = url.searchParams.get('gradeLevelId');
      data = gradeId === 'grade-xii' ? [] : (gradeId ? [gradeId] : ['grade-x', 'grade-xi']).map(id => ({ id: `class-${id}`, name: 'Kelas 1', gradeLevelId: id, _count: { exams: 0 } }));
    } else if (url.pathname === '/api/academic/legacy-mapping') data = { summary: { totalUnmapped: 0, unmappedSubjectsCount: 0, unmappedExamsCount: 0 }, unmappedSubjects: [], unmappedExams: [], availableGradeLevels: [], availableClassrooms: [], availableSubjects: [] };
    else if (url.pathname === '/api/subjects' && req.method() === 'POST') {
      subjectPosts++;
      const body = req.postDataJSON();
      if (subjects.some((item) => item.gradeLevelId === body.gradeLevelId && item.name.toLowerCase() === body.name.toLowerCase())) return route.fulfill({ status: 409, json: { success: false, error: { message: 'Mata pelajaran sudah terdaftar pada tingkat tersebut.' } } });
      data = { id: `subject-${subjectPosts}`, name: body.name, gradeLevelId: body.gradeLevelId, gradeLevel: grades.find((grade) => grade.id === body.gradeLevelId), _count: { banks: 0, exams: 0 } };
      subjects.push(data);
    } else if (url.pathname === '/api/subjects') data = subjects.filter((item) => !url.searchParams.has('gradeLevelId') || item.gradeLevelId === url.searchParams.get('gradeLevelId'));
    else if (url.pathname === '/api/question-banks' && req.method() === 'POST') {
      createdBank = req.postDataJSON();
      data = { id: 'bank-new', ...createdBank, revision: 1, _count: { questions: 0 } };
    } else if (url.pathname === '/api/question-banks' && url.searchParams.has('limit')) data = { items: [bank], nextCursor: null };
    else if (url.pathname === '/api/question-banks/bank-1' && req.method() === 'PATCH') {
      patchBody = req.postDataJSON();
      const subject = subjects.find((item) => item.id === patchBody.subjectId) || bank.subjectFolder;
      bank = { ...bank, title: patchBody.title, subjectId: subject.id, subject: subject.name, subjectFolder: subject, revision: bank.revision + 1 };
      data = bank;
    } else if (url.pathname === '/api/question-banks/bank-1') data = bank;
    else if (url.pathname.includes('/drafts') && req.method() === 'POST') {
      draftBody = req.postDataJSON();
      data = { id: 'draft-1', revision: 1 };
    }
    return route.fulfill({ json: { success: true, data } });
  });

  async function checkOverflow(label) {
    const overflow = await page.evaluate(() => ({ bad: document.documentElement.scrollWidth > innerWidth, elements: [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 12).map((el) => `${el.tagName}.${el.className?.toString()}:${Math.round(el.getBoundingClientRect().right)}`) }));
    assert.equal(overflow.bad, false, `${label}: horizontal overflow: ${overflow.elements.join(', ')}`);
  }
  async function toConfirmation() {
    await page.getByRole('button', { name: 'Lanjutkan ke Pratinjau Siswa →' }).click();
    await page.getByRole('button', { name: 'Lanjutkan ke Konfirmasi Unggah →' }).click();
  }
  async function chooseGrade(name) {
    await page.locator('.drilldown-card').filter({ hasText: name }).first().click();
  }
  async function chooseClass() {
    await page.getByRole('button', { name: /Kelas 1/ }).first().click();
  }
  async function goToGrades() {
    await page.getByRole('navigation', { name: 'Lokasi navigasi' }).getByRole('button', { name: 'Tingkatan' }).click();
  }

  try {
    await page.goto(`${origin}/dashboard/kelas-mapel`);
    await chooseGrade('Tingkat X');
    await chooseClass();
    await page.getByRole('heading', { name: /Daftar Kelas/ }).waitFor();
    await page.getByRole('heading', { name: /Mata Pelajaran/ }).last().waitFor();
    assert.equal(await page.getByRole('tab').count(), 0);
    assert.equal(await page.getByText('1 bank soal', { exact: true }).count(), 1);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await checkOverflow(`academic ${width}`);
      await page.screenshot({ path: `/tmp/eduquas-academic-${width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.getByRole('button', { name: 'Tambah Mata Pelajaran' }).first().click();
    const input = page.getByLabel('Nama mata pelajaran untuk Tingkat X');
    const academicColors = await input.evaluate((el) => ({ foreground: getComputedStyle(el.labels[0]).color, background: getComputedStyle(el.closest('.academic-modal-form') || document.querySelector('.staff-app')).backgroundColor }));
    assert.ok(contrast(academicColors.foreground, academicColors.background) >= 4.5, 'academic label contrast');
    await input.fill('Matematika');
    await page.getByRole('button', { name: 'Tambah mata pelajaran', exact: true }).click();
    await page.getByRole('alert').getByText('Mata pelajaran sudah terdaftar pada tingkat tersebut.').waitFor();
    await input.fill('Biologi');
    await page.getByRole('button', { name: 'Tambah mata pelajaran', exact: true }).click();
    await page.getByRole('status').getByText('Mata pelajaran "Biologi" tersimpan di Tingkat X.').waitFor();
    await page.getByText('Biologi · Tingkat X').waitFor();
    assert.equal(subjects.find((item) => item.name === 'Biologi').gradeLevelId, 'grade-x');

    await page.getByRole('button', { name: 'Tambah Mata Pelajaran' }).first().click();
    const draftInput = page.getByLabel('Nama mata pelajaran untuk Tingkat X');
    await draftInput.fill('Teks yang belum disimpan');
    await page.getByRole('button', { name: 'Batal', exact: true }).click();
    slowGrade = true;
    await goToGrades();
    await chooseGrade('Tingkat XI');
    await goToGrades();
    await chooseGrade('Tingkat X');
    await chooseClass();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Tambah Mata Pelajaran' }).first().click();
    assert.equal(await page.getByLabel('Nama mata pelajaran untuk Tingkat X').inputValue(), '');
    await page.getByRole('button', { name: 'Batal', exact: true }).click();
    assert.equal(await page.getByText('Biologi · Tingkat X').count(), 1);

    await goToGrades();
    await chooseGrade('Tingkat XII');
    await page.getByText('Belum ada kelas pada tingkat ini. Tambahkan kelas untuk melanjutkan.').waitFor();
    failGrade = true;
    await goToGrades();
    await chooseGrade('Tingkat XI');
    await page.getByRole('alert').getByText('Kelas gagal dimuat.').waitFor();
    assert.equal(await page.getByText('Biologi · Tingkat X').count(), 0);
    failGrade = false;
    await page.getByRole('button', { name: 'Coba lagi' }).click();
    await chooseClass();
    await page.getByText('Matematika · Tingkat XI').waitFor();
    await page.getByRole('link', { name: 'Buka Bank Soal' }).click();
    await page.waitForURL('**/dashboard/bank-soal?**');
    assert.equal(new URL(page.url()).searchParams.get('subjectId'), 'math-xi');
    await page.getByRole('button', { name: 'Buat Soal', exact: true }).click();
    await page.locator('#new-bank-subject').waitFor();
    await page.waitForFunction(() => document.querySelector('#new-bank-subject')?.value === 'math-xi');
    assert.equal(await page.locator('#new-bank-grade').inputValue(), 'grade-xi');
    assert.equal(await page.locator('#new-bank-subject option').count(), 2);

    await page.goto(`${origin}/dashboard/bank-soal`);
    await page.getByRole('button', { name: 'Buat Soal', exact: true }).click();
    await page.locator('#new-bank-grade:not([disabled])').waitFor();
    const bankColors = await page.locator('label[for="new-bank-grade"]').evaluate((el) => ({ foreground: getComputedStyle(el).color, background: getComputedStyle(el.parentElement.parentElement).backgroundColor }));
    assert.ok(contrast(bankColors.foreground, bankColors.background) >= 4.5, 'bank dropdown label contrast');
    assert.equal(await page.locator('#new-bank-grade').inputValue(), '');
    assert.equal(await page.locator('#new-bank-subject').isDisabled(), true);
    assert.equal(await page.getByRole('textbox', { name: 'Isi soal 1' }).count(), 1);
    await page.locator('#new-bank-title').fill('Bank baru');
    await page.getByRole('textbox', { name: 'Isi soal 1' }).fill('Soal yang tetap ada');
    await page.locator('#new-bank-grade').selectOption('grade-xii');
    const manageLink = page.getByRole('link', { name: 'Kelola Kelas & Mapel (tab baru)' });
    assert.equal(await manageLink.getAttribute('target'), '_blank');
    assert.ok((await manageLink.getAttribute('href')).includes('gradeLevelId=grade-xii'));
    const opened = context.waitForEvent('page');
    await manageLink.click();
    const popup = await opened;
    await popup.getByRole('button', { name: /Tambah Mata Pelajaran/ }).first().click();
    await popup.getByLabel('Nama mata pelajaran untuk Tingkat XII').fill('Sejarah XII');
    await popup.getByRole('button', { name: 'Tambah mata pelajaran', exact: true }).click();
    await popup.getByRole('status').getByText('Mata pelajaran "Sejarah XII" tersimpan di Tingkat XII.').waitFor();
    await popup.close();
    await page.bringToFront();
    await page.evaluate(() => dispatchEvent(new Event('focus')));
    await page.locator('#new-bank-subject option').filter({ hasText: 'Sejarah XII' }).waitFor({ state: 'attached' });
    assert.equal(await page.getByRole('textbox', { name: 'Isi soal 1' }).textContent(), 'Soal yang tetap ada');
    await page.locator('#new-bank-grade').selectOption('grade-x');
    await page.locator('#new-bank-subject').selectOption('physics-x');
    await page.locator('#new-bank-grade').selectOption('grade-xi');
    assert.equal(await page.locator('#new-bank-subject').inputValue(), '');
    assert.equal(await page.locator('#new-bank-subject option').count(), 2);
    subjects.push({ id: 'history-xi', name: 'Sejarah', gradeLevelId: 'grade-xi', gradeLevel: grades[1], _count: { banks: 0, exams: 0 } });
    await page.evaluate(() => dispatchEvent(new Event('focus')));
    await page.locator('#new-bank-subject option[value="history-xi"]').waitFor({ state: 'attached' });
    assert.equal(await page.getByRole('textbox', { name: 'Isi soal 1' }).textContent(), 'Soal yang tetap ada');
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await checkOverflow(`editor ${width}`);
      await page.screenshot({ path: `/tmp/eduquas-bank-editor-${width}.png`, fullPage: true });
    }
    await page.locator('#new-bank-subject').selectOption('history-xi');
    await toConfirmation();
    await page.getByRole('button', { name: 'Simpan Draf' }).click();
    await page.waitForFunction(() => !!localStorage.getItem('eduquas:bank-draft:teacher-1:bank-new'));
    assert.equal(createdBank.subjectId, 'history-xi');
    assert.equal(createdBank.subject, 'Sejarah');
    assert.equal(subjectPosts, 3, 'the editor did not create a subject');

    await page.goto(`${origin}/dashboard/bank-soal`);
    await chooseGrade('Tingkat X');
    await page.getByRole('button', { name: /Matematika/ }).first().click();
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    await page.getByRole('button', { name: 'Ubah judul bank soal' }).click();
    await page.locator('#new-bank-title').fill('Aljabar baru');
    assert.equal(await page.locator('#new-bank-grade').isDisabled(), true);
    await page.locator('#new-bank-subject').selectOption('physics-x');
    await toConfirmation();
    await page.getByRole('button', { name: 'Simpan Draf' }).click();
    await page.waitForFunction(() => !!localStorage.getItem('eduquas:bank-draft:teacher-1:bank-1'));
    assert.equal(patchBody.revision, 1);
    assert.equal(patchBody.subjectId, 'physics-x');
    assert.equal(draftBody.bankRevision, 2);
    await page.goto(`${origin}/dashboard/bank-soal?gradeLevelId=grade-xi&folder=math-xi`);
    await page.waitForFunction(() => new URL(location.href).searchParams.get('subjectId') === 'math-xi');
    await page.locator('.hierarchy-subject-filter select').waitFor();
    assert.equal(await page.locator('.hierarchy-subject-filter select').inputValue(), 'math-xi');
    await page.goto(`${origin}/dashboard/bank-soal?gradeLevelId=grade-x&subjectId=math-xi`);
    await page.waitForFunction(() => !new URL(location.href).searchParams.has('subjectId'));
    assert.equal(new URL(page.url()).searchParams.get('gradeLevelId'), 'grade-x');
    assert.deepEqual(errors, []);
    console.log('PASS: academic level switching, subject creation, dropdowns, bank metadata and responsive layout');
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
