/* Editor and XML controls tested against simulated API responses. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const origin = process.env.EDUQUAS_TEST_FRONTEND_URL || 'http://localhost:3002';
const executablePath = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
(async () => {
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  let draftBody = null; let imported = false;
  const bank = { id: 'bank-1', title: 'Aljabar', subject: 'Matematika', subjectId: 'subject-1', revision: 1, _count: { questions: 0 }, questions: [], drafts: [] };
  await page.route('**/api/**', route => {
    const req = route.request(); const url = new URL(req.url()); let data = [];
    if (url.pathname === '/api/auth/me') data = { id: 'teacher-1', fullName: 'Guru Uji', email: 'guru@example.invalid', role: 'ADMIN', isActive: true };
    else if (url.pathname === '/api/subjects') data = [{ id: 'subject-1', name: 'Matematika', _count: { banks: 1 } }];
    else if (url.pathname === '/api/question-banks' && url.searchParams.has('limit')) data = { items: [bank], nextCursor: null };
    else if (url.pathname === '/api/question-banks/bank-1') data = bank;
    else if (url.pathname === '/api/question-banks/bank-1/drafts') { draftBody = req.postDataJSON(); data = { id: 'draft-1', revision: 1 }; }
    else if (url.pathname === '/api/question-banks/bank-1/xml') return route.fulfill({ status: 200, contentType: 'application/xml', body: '<?xml version="1.0"?><eduquas-bank version="1"/>' });
    else if (url.pathname === '/api/question-banks/xml/preview') data = { title: 'Aljabar', questionCount: 1, mediaCount: 0, warnings: [] };
    else if (url.pathname === '/api/question-banks/xml/import') { imported = true; data = { bankId: 'bank-1', draftId: 'draft-1', draftOwnedByCaller: true, alreadyImported: false }; }
    return route.fulfill({ json: { success: true, data } });
  });
  try {
    await page.goto(`${origin}/dashboard/bank-soal`);
    await page.getByRole('button', { name: 'Matematika 1', exact: true }).click();
    await page.getByRole('button', { name: 'Tambah soal' }).click();
    const editor = page.getByRole('dialog', { name: 'Edit Aljabar' }); await editor.waitFor();
    const prompt = editor.getByRole('textbox', { name: 'Isi soal 1' }); await prompt.fill('Hitung nilai ');
    await editor.getByRole('button', { name: 'Sisipkan persamaan' }).first().click();
    await editor.locator('math-field').first().click(); await page.keyboard.type('x');
    await editor.getByRole('button', { name: 'Simpan draf' }).click();
    await page.waitForFunction(() => !!localStorage.getItem('eduquas:bank-draft:teacher-1:bank-1'));
    assert.ok(draftBody && JSON.stringify(draftBody.questions[0].content).includes('equation'));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByRole('dialog', { name: 'Edit Aljabar' }).waitFor();
    assert.ok((await page.getByRole('textbox', { name: 'Isi soal 1' }).innerText()).includes('Hitung nilai'));
    await page.keyboard.press('Escape');
    const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Ekspor XML' }).click();
    const file = await downloading; const target = '/tmp/eduquas-bank-ui-test.xml'; await file.saveAs(target);
    await page.locator('input[type=file][accept^=".xml"]').setInputFiles(target);
    await page.getByRole('dialog', { name: 'Preview impor XML' }).waitFor(); await page.getByRole('button', { name: 'Impor sebagai draf' }).click();
    await page.waitForFunction(() => !!document.querySelector('dialog[open]'));
    assert.equal(imported, true); assert.deepEqual(errors, []);
    console.log('PASS: mobile equation editor, local draft recovery and XML controls');
  } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
