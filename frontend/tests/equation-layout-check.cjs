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

  const bank = {
    id: 'bank-1',
    title: 'Aljabar',
    subject: 'Matematika',
    subjectId: 'subject-1',
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
    } else if (url.pathname === '/api/subjects') {
      data = [{ id: 'subject-1', name: 'Matematika', _count: { banks: 1 } }];
    } else if (url.pathname === '/api/question-banks' && url.searchParams.has('limit')) {
      data = { items: [bank], nextCursor: null };
    } else if (url.pathname === '/api/question-banks/bank-1') {
      data = bank;
    }
    return route.fulfill({ json: { success: true, data } });
  });

  try {
    await page.goto(`${origin}/dashboard/bank-soal`);

    // Buka editor bank soal
    await page.getByRole('button', { name: 'Buat Soal', exact: true }).click();
    await page.locator('#bank-creator-title').waitFor();

    // 1. Sisipkan persamaan inline ke editor teks
    await page.getByRole('button', { name: 'Sisipkan persamaan inline' }).first().click();
    const mathBox = page.locator('.equation-math-box').first();
    await mathBox.waitFor();

    // Verifikasi DI DALAM BOX TEKS HANYA ada math-field
    const captionCount = await mathBox.locator('.equation-caption').count();
    assert.equal(captionCount, 0, 'Tidak boleh ada caption "Persamaan" di dalam box teks');

    const insideRibbonCount = await mathBox.locator('.mathway-ribbon').count();
    assert.equal(insideRibbonCount, 0, 'Pilihan dasar/operator tidak boleh ada di bawah box dalam teks');

    const insideSvgCount = await mathBox.locator('svg').count();
    assert.equal(insideSvgCount, 0, 'Ikon keyboard atau garis tiga tidak boleh ada di dalam box teks');

    // 2. Verifikasi tombol di toolbar header: Eq, Keyboard, Garis Tiga sejajar
    const toolbar = page.locator('.bank-editor-toolbar').first();
    const eqBtn = toolbar.getByRole('button', { name: 'Persamaan Matematika' });
    const keyboardBtn = toolbar.getByRole('button', { name: 'Papan Ketik Matematika' });
    const menuBtn = toolbar.getByRole('button', { name: 'Menu Rumus' });

    assert.ok(await eqBtn.isVisible(), 'Tombol Eq harus ada di toolbar header');
    assert.ok(await keyboardBtn.isVisible(), 'Tombol Keyboard harus ada di toolbar header');
    assert.ok(await menuBtn.isVisible(), 'Tombol Garis Tiga harus ada di toolbar header');

    // Periksa bahwa ketiga tombol sejajar (posisi Y mendekati sama di toolbar)
    const eqBox = await eqBtn.boundingBox();
    const kbBox = await keyboardBtn.boundingBox();
    const menuBox = await menuBtn.boundingBox();
    assert.ok(Math.abs(eqBox.y - kbBox.y) < 6, 'Tombol Keyboard harus sejajar secara vertikal dengan tombol Eq');
    assert.ok(Math.abs(kbBox.y - menuBox.y) < 6, 'Tombol Garis Tiga harus sejajar secara vertikal dengan tombol Keyboard');

    // 3. Verifikasi klik Eq membuka ribbon di header
    await eqBtn.click();
    const headerRibbon = page.locator('.bank-editor-shell .mathway-ribbon').first();
    await headerRibbon.waitFor();
    assert.ok(await headerRibbon.isVisible(), 'Ribbon harus muncul di header saat Eq diklik');

    // Cek tab Dasar, Operator, dll. berada di header ribbon
    const dasarTab = headerRibbon.getByRole('tab', { name: 'Dasar' });
    const operatorTab = headerRibbon.getByRole('tab', { name: 'Operator' });
    assert.ok(await dasarTab.isVisible(), 'Tab Dasar harus ada di ribbon header');
    assert.ok(await operatorTab.isVisible(), 'Tab Operator harus ada di ribbon header');

    // 4. Verifikasi klik tombol Garis Tiga membuka tab LaTeX di header ribbon
    await menuBtn.click();
    const latexInput = headerRibbon.locator('input[placeholder*="LaTeX"]');
    await latexInput.waitFor();
    assert.ok(await latexInput.isVisible(), 'Input LaTeX harus muncul saat tombol Garis Tiga diklik');

    // 5. Screenshot untuk inspeksi visual
    await page.screenshot({ path: '/tmp/equation-layout-check.png', fullPage: true });

    assert.deepEqual(errors, []);
    console.log('PASS: equation pure box inside text and toolbar Eq/Keyboard/Garis-Tiga layout verified');
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});

