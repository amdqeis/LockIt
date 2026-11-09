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

  const exams = [
    {
      id: 'exam-1',
      title: 'Ujian Matematika Wajib',
      subject: 'Matematika',
      className: 'XII MIPA 1',
      status: 'active',
      durationMinutes: 60,
      passingScore: 75,
      _count: { questions: 25 },
      createdAt: new Date().toISOString(),
    }
  ];

  await page.route('**/api/**', route => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname === '/api/auth/me') {
      return route.fulfill({ json: { success: true, data: { id: 'admin-1', fullName: 'Kepala Sekolah', role: 'ADMIN', isActive: true } } });
    }
    if (url.pathname === '/api/exams') {
      return route.fulfill({ json: { success: true, data: { items: exams, nextCursor: null } } });
    }
    if (url.pathname === '/api/dashboard/overview') {
      return route.fulfill({ json: { success: true, data: { activeCount: 1, waiting: 0, ungraded: 0, exams } } });
    }
    if (url.pathname === '/api/subjects') {
      return route.fulfill({ json: { success: true, data: [{ id: 'sub-1', name: 'Matematika' }] } });
    }
    return route.fulfill({ json: { success: true, data: [] } });
  });

  try {
    // 1. Uji Halaman Overview (Beranda): Pastikan tombol "Buat ujian" ada dan terlihat jelas
    await page.goto(`${origin}/dashboard`);
    const overviewCreateBtn = page.getByRole('link', { name: 'Buat ujian' }).first();
    await overviewCreateBtn.waitFor();
    assert.ok(await overviewCreateBtn.isVisible(), 'Tombol Buat Ujian harus terlihat di halaman Beranda');

    // 2. Klik tombol Buat Ujian dari Beranda -> Harus langsung membuka form Buat Ujian di /dashboard/ujian
    await overviewCreateBtn.click();
    await page.waitForURL('**/dashboard/ujian?create=true');
    const entryTitle = page.locator('#entry-title');
    await entryTitle.waitFor();
    assert.ok((await entryTitle.innerText()).includes('Buat ujian baru'));

    // Kembali ke daftar ujian
    await page.getByRole('button', { name: '← Kembali ke daftar ujian' }).click();

    // 3. Uji Halaman Daftar Ujian: Tombol Buat Ujian harus menjadi TOMBOL PERTAMA di header
    const actionWrap = page.locator('.staff-action-wrap').first();
    await actionWrap.waitFor();

    const buttons = actionWrap.locator('button');
    const firstButtonText = await buttons.first().innerText();
    assert.ok(firstButtonText.includes('Buat ujian'), `Tombol pertama harus "Buat ujian", didapat: "${firstButtonText}"`);

    // Pastikan tombol Buat Ujian terlihat dan tidak terpotong
    const buatUjianBtn = actionWrap.getByRole('button', { name: 'Buat ujian' });
    assert.ok(await buatUjianBtn.isVisible(), 'Tombol Buat Ujian harus terlihat di header Daftar Ujian');
    
    // Periksa styling computed style: text-decoration TIDAK boleh underline
    const textDecoration = await buatUjianBtn.evaluate(el => window.getComputedStyle(el).textDecorationLine);
    assert.notEqual(textDecoration, 'underline', 'Teks tombol Buat Ujian tidak boleh bergaris bawah');

    // Periksa tombol Mulai Tahun Ajaran Baru di sampingnya
    const rolloverBtn = actionWrap.getByRole('button', { name: 'Mulai Tahun Ajaran Baru' });
    assert.ok(await rolloverBtn.isVisible(), 'Tombol Mulai Tahun Ajaran Baru harus terlihat di sampingnya');
    const rolloverDeco = await rolloverBtn.evaluate(el => window.getComputedStyle(el).textDecorationLine);
    assert.notEqual(rolloverDeco, 'underline', 'Teks tombol Mulai Tahun Ajaran Baru tidak boleh bergaris bawah');

    // Ambil screenshot hasil tampilan untuk verifikasi visual
    await page.screenshot({ path: '/tmp/verified-buat-ujian-desktop.png', fullPage: true });

    // 4. Uji tampilan Mobile (390px)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    assert.ok(await buatUjianBtn.isVisible(), 'Tombol Buat Ujian harus tetap terlihat di tampilan mobile');
    await page.screenshot({ path: '/tmp/verified-buat-ujian-mobile.png', fullPage: true });

    assert.deepEqual(errors, []);
    console.log('PASS: Tombol Buat Ujian terlihat jelas, di urutan pertama, tanpa underline, dan tersedia di Beranda');
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});

