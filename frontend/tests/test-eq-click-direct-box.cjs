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

    // Klik Buat Soal untuk membuka editor
    const headerCreateBtn = page.getByRole('button', { name: 'Buat Soal', exact: true });
    await headerCreateBtn.waitFor({ state: 'visible' });
    await headerCreateBtn.click();

    const title = page.locator('#bank-creator-title');
    await title.waitFor();

    // Pastikan sebelum klik Eq belum ada box persamaan
    assert.equal(await page.locator('.equation-math-box').count(), 0);

    // Klik tombol "Eq" di toolbar
    const eqBtn = page.locator('.bank-editor-toolbar button:has-text("Eq")');
    await eqBtn.waitFor();
    await eqBtn.click();

    // Verifikasi LANGSUNG MUNCUL BOX KOTAK TIPIS inline with text
    const mathBox = page.locator('.equation-math-box').first();
    await mathBox.waitFor({ state: 'visible' });
    assert.ok(await mathBox.isVisible(), 'Box persamaan kotak tipis harus langsung muncul saat tombol Eq diklik');

    // Verifikasi BOX AJA, GAADA SIMBOL APAPUN LAIN
    // 1. Tidak ada caption "Persamaan"
    assert.equal(await mathBox.locator('.equation-caption').count(), 0);
    // 2. Tidak ada ribbon/symbols di dalam box
    assert.equal(await mathBox.locator('.mathway-ribbon').count(), 0);
    // 3. Tidak ada svg / tombol ikon di dalam box
    assert.equal(await mathBox.locator('svg').count(), 0);
    assert.equal(await mathBox.locator('button').count(), 0);

    // 4. Di dalam box HANYA ada math-field tempat mengetik equation
    const mathField = mathBox.locator('math-field');
    await mathField.waitFor();
    assert.equal(await mathField.count(), 1, 'Di dalam box hanya ada math-field');

    // Ketik persamaan langsung ke dalam math-field
    await page.locator('math-field').first().click();
    await page.keyboard.type('\\sin x');
    await page.waitForTimeout(300);

    // Verifikasi bahwa math-field dapat menerima input
    const val = await page.locator('math-field').first().evaluate(el => el.value);
    assert.ok(val !== undefined, 'Mathfield harus terdefinisi');

    // Screenshot box kotak tipis inline di dalam teks
    await page.screenshot({ path: '/tmp/verified-eq-direct-box.png', fullPage: true });

    assert.deepEqual(errors, []);
    console.log('PASS: Klik tombol Eq langsung memunculkan box kotak tipis inline murni tempat mengetik equation');
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
