/* Real backend integration. Uses only uniquely marked fixtures and removes them in finally. */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { chromium } = require('playwright-core');

const frontend = process.env.EDUQUAS_TEST_FRONTEND_URL || 'http://localhost:3012';
const backend = process.env.EDUQUAS_TEST_BACKEND_URL || 'http://127.0.0.1:3011';
const prisma = new PrismaClient();
const unique = crypto.randomUUID();
const imageName = `eduquas-e2e-${unique}.png`;
const imagePath = path.resolve(process.env.EDUQUAS_QUESTION_MEDIA_DIR || path.resolve(__dirname, '../../backend/storage/question-bank'), imageName);
const imageBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+nm+8AAAAASUVORK5CYII=', 'base64');
let teacher, exam, media, student, browser, page, token;
let legacyImagePath;

async function teacherRequest(method, endpoint, body) {
  const response = await fetch(`${backend}${endpoint}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  assert.ok(response.ok && result.success, `${method} ${endpoint}: ${result.error?.message || response.status}`);
  return result.data;
}

async function waitForAnswer(questionId, expected) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const answer = await prisma.answer.findUnique({ where: { studentId_questionId: { studentId: student.id, questionId } } });
    if (answer?.selectedOption === expected) return;
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  throw new Error(`Jawaban untuk soal uji tidak tersimpan: ${expected}`);
}

async function clean() {
  if (browser) await browser.close();
  if (exam) {
    const current = await prisma.exam.findUnique({ where: { id: exam.id } });
    if (current?.status === 'active' && token) await teacherRequest('PUT', `/api/exams/${exam.id}/status`, { status: 'ended' });
    const links = await prisma.browserStudent.findMany({ where: { student: { examId: exam.id } }, select: { browserId: true } });
    await prisma.warning.deleteMany({ where: { examId: exam.id } });
    await prisma.proctoringEvent.deleteMany({ where: { examId: exam.id } });
    await prisma.answer.deleteMany({ where: { student: { examId: exam.id } } });
    await prisma.admissionHistory.deleteMany({ where: { student: { examId: exam.id } } });
    await prisma.browserStudent.deleteMany({ where: { student: { examId: exam.id } } });
    await prisma.student.deleteMany({ where: { examId: exam.id } });
    await prisma.question.deleteMany({ where: { examId: exam.id } });
    await prisma.exam.delete({ where: { id: exam.id } });
    const ids = [...new Set(links.map(link => link.browserId))];
    if (ids.length) await prisma.browserIdentity.deleteMany({ where: { id: { in: ids }, students: { none: {} } } });
  }
  if (media) await prisma.questionBankMedia.deleteMany({ where: { id: media.id } });
  await fs.unlink(imagePath).catch(error => { if (error.code !== 'ENOENT') throw error; });
  if (legacyImagePath) {
    await fs.unlink(legacyImagePath).catch(error => { if (error.code !== 'ENOENT') throw error; });
    await fs.rmdir(path.dirname(legacyImagePath)).catch(error => { if (!['ENOENT', 'ENOTEMPTY'].includes(error.code)) throw error; });
  }
  if (teacher) await prisma.teacher.deleteMany({ where: { id: teacher.id } });
  await prisma.$disconnect();
}

async function main() {
  if (process.env.EDUQUAS_E2E_ALLOW_DATABASE !== '1' || !process.env.EDUQUAS_TEST_DATABASE_URL || process.env.DATABASE_URL !== process.env.EDUQUAS_TEST_DATABASE_URL) throw new Error('Uji ini menulis fixture; gunakan database pengujian terisolasi dan konfirmasi melalui EDUQUAS_TEST_DATABASE_URL serta EDUQUAS_E2E_ALLOW_DATABASE=1.');
  if (!process.env.DATABASE_URL || !process.env.JWT_ACCESS_SECRET) throw new Error('Jalankan dengan environment backend yang dikonfigurasi.');
  teacher = await prisma.teacher.create({ data: { email: `eduquas-e2e-${unique}@example.invalid`, fullName: 'Pengawas uji sementara', passwordHash: 'not-a-login', role: 'TEACHER' } });
  token = jwt.sign({ teacherId: teacher.id, email: teacher.email, fullName: teacher.fullName, role: 'TEACHER' }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
  await fs.mkdir(path.dirname(imagePath), { recursive: true });
  await fs.writeFile(imagePath, imageBytes, { flag: 'wx', mode: 0o600 });
  media = await prisma.questionBankMedia.create({ data: { filename: imageName, mimeType: 'image/png', size: imageBytes.length, uploadedBy: teacher.id } });
  const mediaUrl = `/api/question-banks/media/${media.id}`;
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code = Array.from(crypto.randomBytes(6), byte => alphabet[byte % alphabet.length]).join(''); } while (await prisma.exam.findUnique({ where: { accessCode: code } }));
  const math = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hitung ' }, { type: 'equation', attrs: { latex: '\\frac{1}{2}' } }] }] };
  exam = await prisma.exam.create({ data: {
    teacherId: teacher.id, title: `Ujian integrasi sementara ${unique.slice(0, 6)}`, accessCode: code, durationMinutes: 5,
    settings: { randomize_questions: false, randomize_choices: true, display_mode: 'one_by_one', allow_answer_review: true, show_score_to_student: false },
    violationPolicy: { max_violations: 3, action: 'lock', detect_screenshot: true, detect_ip_change: false },
    questions: { create: [
      { orderIndex: 1, type: 'single_choice', questionText: 'Hitung pecahan', content: math, imageUrl: mediaUrl, imageAlt: 'Gambar soal uji', correctAnswer: 'AA', options: [{ id: 'A', label: 'A', text: 'Pilihan satu' }, { id: 'AA', label: 'AA', text: 'Pilihan panjang' }] },
      { orderIndex: 2, type: 'multi_select', questionText: 'Pilih dua jawaban', correctAnswer: 'A,AA', options: [{ id: 'A', label: 'A', text: 'Opsi pertama', imageUrl: mediaUrl, imageAlt: 'Gambar pilihan uji' }, { id: 'AA', label: 'AA', text: 'Opsi kedua', content: math }, { id: 'C', label: 'C', text: 'Opsi ketiga' }] },
      { orderIndex: 3, type: 'short_answer', questionText: 'Tuliskan jawaban singkat', correctAnswer: '', options: [] },
      { orderIndex: 4, type: 'latex', questionText: `Hitung $\\frac{${Array.from({ length: 22 }, (_, index) => `x_{${index + 1}}`).join('+')}}{2}$`, correctAnswer: 'A', options: [{ id: 'A', label: 'A', text: 'Jawaban terakhir' }, { id: 'B', label: 'B', text: 'Jawaban lain' }] },
    ] },
  }, include: { questions: { orderBy: { orderIndex: 'asc' } } } });
  legacyImagePath = path.resolve(__dirname, '../../backend/public/uploads/exams', exam.id, imageName);
  await fs.mkdir(path.dirname(legacyImagePath), { recursive: true });
  await fs.writeFile(legacyImagePath, imageBytes, { flag: 'wx', mode: 0o600 });
  await prisma.question.update({ where: { id: exam.questions[3].id }, data: { imageUrl: `/uploads/exams/${exam.id}/${imageName}`, imageAlt: 'Gambar unggahan lama' } });

  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const testIp = `198.18.${crypto.randomInt(1, 255)}.${crypto.randomInt(1, 255)}`;
  const context = await browser.newContext({ baseURL: frontend, viewport: { width: 390, height: 844 }, extraHTTPHeaders: { 'x-forwarded-for': testIp } });
  page = await context.newPage();
  page.setDefaultTimeout(25000);
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.locator('form').getByRole('button', { name: 'Lanjutkan', exact: true }).click();
  await page.getByText('Masukkan 6 huruf atau angka dari pengawas.').waitFor();
  let invalidCode;
  do { invalidCode = Array.from(crypto.randomBytes(6), byte => alphabet[byte % alphabet.length]).join(''); } while (invalidCode === code || await prisma.exam.findUnique({ where: { accessCode: invalidCode } }));
  await page.locator('#exam-code').fill(invalidCode);
  await page.locator('form').getByRole('button', { name: 'Lanjutkan', exact: true }).click();
  await page.getByText('Kode ujian tidak ditemukan').waitFor();
  await page.locator('#exam-code').fill(code.toLowerCase());
  assert.equal(await page.locator('#exam-code').inputValue(), code);
  await page.locator('form').getByRole('button', { name: 'Lanjutkan', exact: true }).click();
  await page.getByRole('heading', { name: 'Isi identitas' }).waitFor();
  await page.locator('form').getByRole('button', { name: 'Lanjutkan', exact: true }).click();
  await page.getByText('Masukkan nama minimal 2 karakter.').waitFor();
  await page.locator('#student-name').fill('Peserta Uji Sementara');
  await page.locator('#student-nisn').fill('123');
  await page.locator('form').getByRole('button', { name: 'Lanjutkan', exact: true }).click();
  await page.getByText('NISN harus terdiri dari 10 angka.').waitFor();
  const nisn = String(crypto.randomInt(1000000000, 2000000000));
  await page.locator('#student-nisn').fill(nisn);
  await page.locator('form').getByRole('button', { name: 'Lanjutkan', exact: true }).click();
  await page.getByRole('heading', { name: 'Sebelum masuk ujian' }).waitFor();
  assert.equal(await prisma.student.findUnique({ where: { examId_nisn: { examId: exam.id, nisn } } }), null);
  await page.getByRole('button', { name: 'Ajukan masuk', exact: true }).click();
  await page.getByText('Centang pernyataan berikut sebelum mengajukan masuk.').waitFor();
  assert.equal(await prisma.student.findUnique({ where: { examId_nisn: { examId: exam.id, nisn } } }), null);
  await page.getByRole('checkbox', { name: 'Saya sudah membaca dan memahami informasi di atas.' }).check();
  await page.getByRole('button', { name: 'Ajukan masuk', exact: true }).click();
  console.log('Memeriksa permintaan masuk...');
  await page.getByRole('heading', { name: 'Menunggu persetujuan' }).waitFor();
  student = await prisma.student.findUniqueOrThrow({ where: { examId_nisn: { examId: exam.id, nisn } } });
  await page.reload();
  await page.getByRole('heading', { name: 'Menunggu persetujuan' }).waitFor();
  await page.getByRole('region', { name: 'Riwayat ujian' }).getByRole('button', { name: 'Lanjutkan', exact: true }).click();
  await page.getByRole('heading', { name: 'Menunggu persetujuan' }).waitFor();
  await teacherRequest('POST', `/api/exams/${exam.id}/students/${student.id}/reject`, { reason: 'Periksa identitas uji.' });
  await page.getByRole('heading', { name: 'Permintaan belum disetujui' }).waitFor();
  await page.getByText('Periksa identitas uji.').waitFor();
  await page.getByRole('button', { name: 'Ajukan ulang' }).click();
  await page.locator('form').getByRole('button', { name: 'Lanjutkan', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Saya sudah membaca dan memahami informasi di atas.' }).check();
  await page.locator('.entry-body').filter({ has: page.getByRole('heading', { name: 'Sebelum masuk ujian' }) }).getByRole('button', { name: 'Ajukan ulang', exact: true }).click();
  console.log('Memeriksa pengajuan ulang...');
  await page.getByRole('heading', { name: 'Menunggu persetujuan' }).waitFor();
  assert.equal(await prisma.admissionHistory.count({ where: { studentId: student.id } }), 3);
  await teacherRequest('POST', `/api/exams/${exam.id}/students/${student.id}/accept`);
  await page.getByRole('heading', { name: 'Anda sudah disetujui' }).waitFor();
  await teacherRequest('PUT', `/api/exams/${exam.id}/status`, { status: 'active' });
  await page.waitForURL('**/exam/session');
  await page.getByText('Pilihan panjang').waitFor();
  await teacherRequest('POST', `/api/exams/${exam.id}/students/${student.id}/warn`, { message: 'Peringatan uji sementara.' });
  await page.getByText('Peringatan uji sementara.').waitFor();
  await page.getByRole('button', { name: 'Saya mengerti' }).click();
  assert.ok(await page.locator('.katex').count(), 'Persamaan terstruktur ditampilkan');
  await page.getByAltText('Gambar soal uji').waitFor();
  await page.waitForFunction(() => { const image = document.querySelector('img[alt="Gambar soal uji"]'); return image && image.complete && image.naturalWidth > 0; });
  const other = await browser.newContext({ baseURL: frontend });
  const forbiddenMedia = await other.request.get(mediaUrl);
  assert.equal(forbiddenMedia.status(), 404);
  const otherHistory = await (await other.request.get('/api/student-history')).json();
  assert.deepEqual(otherHistory.data.items, []);
  await other.close();
  await page.locator('label.choice').filter({ hasText: 'Pilihan panjang' }).locator('input').check();
  await waitForAnswer(exam.questions[0].id, 'AA');
  console.log('Pilihan tunggal, gambar privat dan persamaan terverifikasi.');
  await page.getByRole('button', { name: 'Berikutnya', exact: true }).click();
  await page.getByText('Pilih dua jawaban').waitFor();
  await page.locator('label.choice').filter({ hasText: 'Opsi pertama' }).locator('input').check();
  await page.locator('label.choice').filter({ has: page.locator('.katex') }).locator('input').check();
  await waitForAnswer(exam.questions[1].id, 'A,AA');
  console.log('Pilihan jamak dan pengacakan terverifikasi.');
  await page.getByRole('button', { name: 'Berikutnya', exact: true }).click();
  await page.getByText('Tuliskan jawaban singkat').waitFor();
  await context.setOffline(true);
  await page.getByLabel('Jawaban Anda').fill('Jawaban singkat uji');
  await page.getByText('Ada jawaban yang belum tersimpan').waitFor();
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await waitForAnswer(exam.questions[2].id, 'Jawaban singkat uji');
  console.log('Isian singkat dan pemulihan koneksi terverifikasi.');
  await page.getByRole('button', { name: 'Berikutnya', exact: true }).click();
  await page.getByText('Jawaban terakhir').waitFor();
  assert.ok(await page.locator('.katex').count(), 'LaTeX dalam teks ditampilkan');
  await page.setViewportSize({ width: 320, height: 720 });
  await page.getByText('Geser untuk melihat persamaan').waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByAltText('Gambar unggahan lama').waitFor();
  await page.waitForFunction(() => { const image = document.querySelector('img[alt="Gambar unggahan lama"]'); return image && image.complete && image.naturalWidth > 0; });
  await page.locator('label.choice').filter({ hasText: 'Jawaban terakhir' }).locator('input').check();
  await waitForAnswer(exam.questions[3].id, 'A');
  await page.keyboard.press('PrintScreen');
  await page.getByRole('heading', { name: 'Sesi terkunci sementara' }).waitFor();
  const lockDeadline = Date.now() + 20000;
  while (!(await prisma.student.findUniqueOrThrow({ where: { id: student.id } })).isLocked) {
    if (Date.now() > lockDeadline) throw new Error('Server tidak mengonfirmasi kunci shortcut.');
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  await teacherRequest('POST', `/api/exams/${exam.id}/students/${student.id}/unlock`);
  await page.getByRole('heading', { name: 'Sesi terkunci sementara' }).waitFor({ state: 'hidden' });
  console.log('Kunci shortcut dan unlock terverifikasi.');
  const afterUnlock = await prisma.student.findUniqueOrThrow({ where: { id: student.id } });
  assert.equal(afterUnlock.violationCycleCount, 0);
  assert.ok(afterUnlock.violationCount >= 1);
  assert.equal(await prisma.answer.count({ where: { studentId: student.id } }), 4);
  const incidentId = crypto.randomUUID();
  const incident = { incidentId, eventType: 'right_click' };
  const firstIncident = await (await page.request.post('/api/proctoring/event', { data: incident })).json();
  const secondIncident = await (await page.request.post('/api/proctoring/event', { data: incident })).json();
  assert.equal(firstIncident.success, true);
  assert.equal(secondIncident.data.duplicate, true);
  assert.equal(secondIncident.data.violationCount, firstIncident.data.violationCount);
  await page.reload();
  await page.getByText('Pilihan panjang').waitFor();
  assert.equal(await page.locator('label.choice').filter({ hasText: 'Pilihan panjang' }).locator('input').isChecked(), true);
  await page.getByRole('button', { name: /Soal 4,/ }).click();
  await page.getByRole('button', { name: 'Kumpulkan jawaban' }).click();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Kumpulkan jawaban');
  await page.getByRole('button', { name: 'Kumpulkan jawaban' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lanjutkan pengumpulan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ya, kumpulkan' }).click();
  await page.waitForURL('**/exam/done?studentId=*', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Review jawaban' }).waitFor();
  await page.getByRole('button', { name: 'Review jawaban' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText('Tuliskan jawaban singkat').waitFor();
  assert.equal(await dialog.getByText('Kunci:', { exact: false }).count(), 0);
  const hiddenReview = await (await page.request.get(`/api/student-history/${student.id}/review`)).json();
  assert.equal(hiddenReview.data.showScoreToStudent, false);
  assert.ok(hiddenReview.data.questions.every(question => !('correctAnswer' in question) && !('isCorrect' in question)));
  assert.ok(await dialog.locator('.katex').count(), 'Review menampilkan persamaan');
  await dialog.getByAltText('Gambar soal uji').waitFor();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => !!document.activeElement?.closest('dialog')), true);
  await page.keyboard.press('Escape');
  await prisma.exam.update({ where: { id: exam.id }, data: { settings: { randomize_questions: false, randomize_choices: true, display_mode: 'one_by_one', allow_answer_review: true, show_score_to_student: true } } });
  await page.reload();
  await page.getByRole('button', { name: 'Review jawaban' }).click();
  await page.getByRole('dialog').getByText('Menunggu penilaian guru', { exact: false }).first().waitFor();
  await page.keyboard.press('Escape');
  await prisma.exam.update({ where: { id: exam.id }, data: { settings: { allow_answer_review: false, show_score_to_student: false } } });
  await page.reload();
  await page.getByText(exam.title).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Review jawaban' }).count(), 0);
  const forbiddenReview = await page.request.get(`/api/student-history/${student.id}/review`);
  assert.equal(forbiddenReview.status(), 403);
  const forbiddenAfterReviewDisabled = await page.request.get(mediaUrl);
  assert.equal(forbiddenAfterReviewDisabled.status(), 404);
  const lateContext = await browser.newContext({ baseURL: frontend, viewport: { width: 1280, height: 800 }, extraHTTPHeaders: { 'x-forwarded-for': `198.19.${crypto.randomInt(1, 255)}.${crypto.randomInt(1, 255)}` } });
  const latePage = await lateContext.newPage();
  latePage.setDefaultTimeout(25000);
  await latePage.goto('/', { waitUntil: 'networkidle' });
  await latePage.locator('#exam-code').fill(code);
  await latePage.getByRole('button', { name: 'Lanjutkan', exact: true }).click();
  await latePage.locator('#student-name').fill('Peserta Terlambat Uji');
  const lateNisn = String(crypto.randomInt(2000000000, 2100000000));
  await latePage.locator('#student-nisn').fill(lateNisn);
  await latePage.getByRole('button', { name: 'Lanjutkan', exact: true }).click();
  await latePage.getByRole('checkbox', { name: 'Saya sudah membaca dan memahami informasi di atas.' }).check();
  await latePage.getByRole('button', { name: 'Ajukan masuk', exact: true }).click();
  await latePage.getByRole('heading', { name: 'Menunggu persetujuan' }).waitFor();
  const lateStudent = await prisma.student.findUniqueOrThrow({ where: { examId_nisn: { examId: exam.id, nisn: lateNisn } } });
  const globalEnd = (await prisma.exam.findUniqueOrThrow({ where: { id: exam.id } })).endTime.toISOString();
  const admitted = await teacherRequest('POST', `/api/exams/${exam.id}/students/${lateStudent.id}/accept`);
  assert.equal(admitted.status, 'active');
  assert.equal(admitted.endTime, globalEnd);
  await latePage.waitForURL('**/exam/session');
  await latePage.getByText('Pilihan panjang').waitFor();
  await latePage.locator('label.choice').filter({ hasText: 'Pilihan panjang' }).locator('input').check();
  student = lateStudent;
  await waitForAnswer(exam.questions[0].id, 'AA');
  await teacherRequest('PUT', `/api/exams/${exam.id}/status`, { status: 'ended' });
  await latePage.waitForURL('**/exam/done', { waitUntil: 'domcontentloaded' });
  assert.equal((await prisma.student.findUniqueOrThrow({ where: { id: lateStudent.id } })).status, 'submitted');
  await waitForAnswer(exam.questions[0].id, 'AA');
  await lateContext.close();
  console.log('Admission terlambat, waktu global dan akhir ujian terverifikasi.');
  console.log('PASS: alur peserta, approval/reapply, gambar privat, persamaan, tipe soal, penyimpanan, reconnect, lock/unlock, review dan privasi browser');
}

main().then(() => clean()).catch(async error => {
  console.error('FAIL:', error.message);
  if (page) await page.screenshot({ path: '/tmp/eduquas-e2e-failure.png', fullPage: true }).catch(() => {});
  try { await clean(); } catch (cleanupError) { console.error('Pembersihan fixture gagal:', cleanupError.message); }
  process.exitCode = 1;
});
