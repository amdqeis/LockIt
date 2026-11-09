/* Browser checks against controlled API responses; no database fixtures are changed. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

const origin = process.env.EDUQUAS_TEST_FRONTEND_URL || 'http://localhost:3000';
const executablePath = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a2kAAAAASUVORK5CYII=', 'base64');
const questions = [
  { id: 'q1', orderIndex: 0, type: 'single_choice', questionText: 'Hitung $x^2$', content: { type: 'doc', content: [{ type: 'text', text: 'Hitung ' }, { type: 'equation', attrs: { latex: `\\frac{${Array.from({ length: 22 }, (_, i) => `x_{${i + 1}}`).join('+')}}{2}` } }] }, imageUrl: '/api/question-banks/media/test', imageAlt: 'Gambar soal', points: 1, options: [{ label: 'AA', text: 'Pilihan $x+1$', imageUrl: '/uploads/exams/test.png' }, { label: 'A', text: 'Pilihan lain' }] },
  { id: 'q2', orderIndex: 1, type: 'multi_select', questionText: 'Pilih beberapa', points: 1, options: [{ label: 'AA', text: 'Pilihan panjang' }, { label: 'B', text: 'Pilihan kedua' }] },
  { id: 'q3', orderIndex: 2, type: 'short_answer', questionText: 'Jelaskan hasilnya', points: 1, options: [] },
];

async function setup(browser, options = {}) {
  const context = await browser.newContext({ viewport: { width: options.width || 390, height: 900 }, reducedMotion: options.reducedMotion || 'no-preference' });
  if (options.storageBlocked) await context.addInitScript(() => { Storage.prototype.getItem = () => { throw new Error('blocked'); }; Storage.prototype.setItem = () => { throw new Error('blocked'); }; });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const saved = {};
  const items = options.many ? Array.from({ length: 25 }, (_, index) => ({ ...questions[0], id: `many-${index}`, orderIndex: index })) : questions;
  const state = { locked: false, online: true };
  let submitted = false;
  const end = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url());
    const now = new Date().toISOString();
    if (url.pathname.endsWith('/student-1/review')) return route.fulfill({json:{success:true,data:{exam:{title:'Ujian matematika'},showScoreToStudent:options.showScore !== false,summary:options.showScore === false ? null : {score:85,pendingManualCount:1},questions:items.map(question => ({...question,studentAnswer:saved[question.id] || null,isCorrect:null}))}}});
    if (url.pathname === '/api/student-history' && route.request().method() === 'GET') return route.fulfill({json:{success:true,data:{items:submitted ? [{studentId:'student-1',studentName:'Siswa Uji',status:'submitted',score:options.showScore === false ? null : 85,pendingManualCount:options.showScore === false ? undefined : 1,canReview:options.canReview !== false,exam:{title:'Ujian matematika'}}] : [],nextCursor:null}}});
    if (url.pathname.startsWith('/api/question-banks/media/')) return options.brokenImage ? route.abort() : route.fulfill({ status: 200, contentType: 'image/png', body: image });
    if (!state.online && url.pathname.startsWith('/api/exam-session')) return route.abort();
    if (url.pathname === '/api/exam-session/waiting') return route.fulfill({ json: { success: true, data: { student: { id: 'student-1', name: 'Siswa Uji', nisn: '1234567890', status: 'active', isLocked: state.locked }, exam: { id: 'exam-1', title: 'Ujian matematika', accessCode: 'ABC123', status: 'active', durationMinutes: 60, endTime: end, serverTime: now } } } });
    if (url.pathname === '/api/exam-session') return route.fulfill({ json: { success: true, data: { student: { id: 'student-1', name: 'Siswa Uji', nisn: '1234567890', isLocked: false }, exam: { id: 'exam-1', title: 'Ujian matematika', description: 'Persamaan dan gambar', endTime: end, settings: { display_mode: options.mode || 'one_by_one' }, violationPolicy: {} }, questions: items, totalQuestions: items.length, hasMore: false, answers: Object.entries(saved).map(([questionId, selectedOption]) => ({ questionId, selectedOption })), serverTime: now } } });
    if (url.pathname === '/api/exam-session/answer') { const body = route.request().postDataJSON(); saved[body.questionId] = body.selectedOption; return route.fulfill({ json: { success: true, data: { selectedOption: body.selectedOption } } }); }
    if (url.pathname === '/api/exam-session/heartbeat') return route.fulfill({ json: { success: true, data: { isLocked: state.locked, isExamActive: true, serverTime: now, warning: null } } });
    if (url.pathname === '/api/exam-session/submit') { submitted = true; return route.fulfill({ json: { success: true, data: {} } }); }
    return route.fulfill({ json: { success: true, data: { items: [], nextCursor: null } } });
  });
  await page.route('**/uploads/exams/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: image }));
  await page.goto(`${origin}/exam/session`);
  await page.getByRole('heading', { name: 'Ujian matematika' }).waitFor();
  return { page, context, saved, state, end, isSubmitted: () => submitted };
}

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  try {
    for (const width of [320, 390, 768, 1024, 1440]) {
      const { page, context } = await setup(browser, { width });
      await page.locator('.navigator-item').first().waitFor();
      const overflow = await page.evaluate(() => ({ bad: document.documentElement.scrollWidth > innerWidth, elements: [...document.querySelectorAll('.exam-content *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1 && !el.closest('.math')).slice(0, 8).map(el => `${el.tagName}.${el.className?.toString()}:${Math.round(el.getBoundingClientRect().right)}`) }));
      assert.equal(overflow.bad, false, `overflow ${width}: ${overflow.elements.join(', ')}`);
      assert.equal(await page.locator('.navigator-item').count(), 3);
      assert.equal(await page.locator('.navigator-summary strong').allTextContents().then(values => values.join(',')), '0,3,1,0');
      assert.equal(await page.locator('.timer').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(242, 242, 244)');
      if (width < 1024) assert.ok(await page.locator('.exam-navigator').evaluate(el => el.getBoundingClientRect().top) < await page.locator('.exam-content').evaluate(el => el.getBoundingClientRect().top));
      if (width >= 1024) assert.equal(await page.locator('.navigator-grid').evaluate(el => el.scrollWidth <= el.clientWidth), true, `navigator overflow ${width}`);
      if (width === 390 || width === 1440) await page.screenshot({ path: `/tmp/eduquas-exam-${width}.png`, fullPage: true });
      await context.close();
    }
    const { page, context, saved, isSubmitted } = await setup(browser);
    assert.equal(await page.getByRole('button', {name:'Kumpulkan jawaban'}).count(), 0);
    assert.equal(await page.locator('.choice .option-letter').count(), 0);
    assert.ok(await page.locator('.katex').count() >= 2);
    await page.getByText('Geser untuk melihat persamaan').waitFor();
    await page.getByAltText('Gambar soal').waitFor();
    await page.locator('.choice input').first().check();
    await page.getByText('1 dari 3 terisi').waitFor();
    await page.screenshot({path:'/tmp/eduquas-exam-selected.png', fullPage:true});
    assert.equal(await page.getByRole('progressbar', {name:'Progres soal terisi'}).getAttribute('aria-valuenow'), '1');
    assert.equal(await page.locator('.choice').first().evaluate(el => getComputedStyle(el).borderTopColor), 'rgb(52, 49, 59)');
    assert.equal(await page.locator('.navigator-summary strong').allTextContents().then(values => values.join(',')), '1,2,1,0');
    await page.getByRole('button', { name: 'Periksa lagi', exact: true }).click();
    await page.waitForTimeout(800);
    assert.equal(saved.q1, 'AA');
    await page.reload();
    await page.getByRole('button', { name: 'Ditandai', exact: true }).waitFor();
    assert.equal(await page.locator('.choice input').first().isChecked(), true);
    await page.getByRole('button', { name: /Soal 2, belum diisi/ }).focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.activeElement?.id === 'question-item-q2');
    await page.locator('.choice input').first().check();
    await page.locator('.choice input').nth(1).check();
    await page.waitForTimeout(800);
    assert.equal(saved.q2, 'AA,B');
    await page.getByRole('button', { name: /Soal 3, belum diisi/ }).click();
    await page.getByLabel('Jawaban Anda').fill('Jawaban singkat');
    await page.waitForTimeout(800);
    assert.equal(saved.q3, 'Jawaban singkat');
    await page.getByText('3 dari 3 terisi').waitFor();
    assert.equal(await page.getByRole('progressbar', {name:'Progres soal terisi'}).getAttribute('aria-valuenow'), '3');
    await page.getByRole('button', { name: 'Kumpulkan jawaban' }).click();
    await page.setViewportSize({width:320,height:568});
    const dialogLayout = await page.getByRole('dialog').evaluate(dialog => {
      const buttons = [...dialog.querySelectorAll('.dialog-actions button')].map(button => button.getBoundingClientRect());
      const content = dialog.querySelector('.dialog-content');
      return { width: dialog.getBoundingClientRect().width, scrollWidth: content.scrollWidth, contentWidth: content.clientWidth, buttons: buttons.map(button => ({top: button.top, bottom: button.bottom, left: button.left, right: button.right})) };
    });
    assert.equal(dialogLayout.width, 320);
    assert.equal(dialogLayout.scrollWidth, dialogLayout.contentWidth);
    assert.ok(dialogLayout.buttons[0].top >= dialogLayout.buttons[1].bottom, 'mobile actions are vertically stacked');
    await page.screenshot({path:'/tmp/eduquas-dialog-mobile.png'});
    await page.getByText('1 soal ditandai untuk diperiksa.', {exact:false}).waitFor();
    await page.getByRole('button', {name:'Lanjutkan pengumpulan'}).click();
    assert.equal(isSubmitted(), false);
    await page.getByRole('button', { name: 'Ya, kumpulkan' }).click();
    await page.waitForURL('**/exam/done?studentId=*');
    assert.equal(isSubmitted(), true);
    await page.getByRole('heading',{name:'Ujian selesai'}).waitFor();
    await page.getByText('Nilai Anda').waitFor();
    await page.getByText('Sebagian jawaban masih menunggu penilaian guru.').waitFor();
    await page.getByRole('button',{name:'Review jawaban'}).click();
    await page.getByRole('dialog').getByText('Jawaban Anda',{exact:false}).first().waitFor();
    await page.getByRole('dialog').locator('h2').evaluate(el => { el.textContent = 'Judul ujian yang sangat panjang untuk memeriksa tampilan popup pada layar ponsel '.repeat(3); });
    await page.waitForTimeout(400);
    const reviewLayout = await page.getByRole('dialog').evaluate(dialog => { const header = dialog.querySelector('.dialog-header').getBoundingClientRect(); const content = dialog.querySelector('.dialog-content'); content.scrollTop = content.scrollHeight; const body = content.getBoundingClientRect(); return { headerBottom: header.bottom, bodyTop: body.top, bodyBottom: body.bottom, scrollTop: content.scrollTop, scrollHeight: content.scrollHeight, clientHeight: content.clientHeight }; });
    assert.ok(reviewLayout.bodyTop >= reviewLayout.headerBottom - 1 && reviewLayout.bodyBottom <= 568);
    assert.ok(reviewLayout.scrollHeight > reviewLayout.clientHeight && reviewLayout.scrollTop > 0, 'long review remains scrollable below long header');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Review jawaban');
    assert.equal(await page.evaluate(() => localStorage.getItem('eduquas:exam-flags:exam-1:student-1')), null);
    await context.close();

    const all = await setup(browser, { mode: 'all_at_once', reducedMotion: 'reduce' });
    assert.equal(await all.page.locator('.exam-question').count(), 3);
    assert.equal(await all.page.locator('.navigator-item.marked').count(), 0, 'flags are isolated between browsers');
    await all.page.getByRole('button', { name: /Soal 3, belum diisi/ }).click();
    assert.equal(await all.page.evaluate(() => document.activeElement.id), 'question-item-q3');
    await all.context.close();

    const incomplete = await setup(browser, {showScore:false,canReview:false});
    await incomplete.page.getByRole('button',{name:/Soal 3, belum diisi/}).click();
    await incomplete.page.getByRole('button',{name:'Kumpulkan jawaban'}).click();
    await incomplete.page.getByText('Masih ada 3 soal belum diisi.').waitFor();
    await incomplete.page.getByRole('button',{name:'Lanjutkan pengumpulan'}).click();
    await incomplete.page.getByRole('button',{name:'Ya, kumpulkan'}).click();
    await incomplete.page.waitForURL('**/exam/done?studentId=*');
    await incomplete.page.getByRole('heading',{name:'Ujian matematika'}).waitFor();
    assert.equal(await incomplete.page.getByText('Nilai Anda').count(),0);
    assert.equal(await incomplete.page.getByRole('button',{name:'Review jawaban'}).count(),0);
    await incomplete.context.close();

    for (const permissions of [{showScore:false,canReview:true}, {showScore:true,canReview:false}]) {
      const scenario = await setup(browser, permissions);
      await scenario.page.getByRole('button',{name:/Soal 3, belum diisi/}).click();
      await scenario.page.getByRole('button',{name:'Kumpulkan jawaban'}).click();
      await scenario.page.getByRole('button',{name:'Lanjutkan pengumpulan'}).click();
      await scenario.page.getByRole('button',{name:'Ya, kumpulkan'}).click();
      await scenario.page.waitForURL('**/exam/done?studentId=*');
      await scenario.page.getByRole('heading',{name:'Ujian matematika'}).waitFor();
      assert.equal(await scenario.page.getByText('Nilai Anda').count(), permissions.showScore ? 1 : 0);
      assert.equal(await scenario.page.getByRole('button',{name:'Review jawaban'}).count(), permissions.canReview ? 1 : 0);
      if (permissions.canReview) {
        await scenario.page.getByRole('button',{name:'Review jawaban'}).click();
        await scenario.page.getByRole('dialog').getByText('Soal 1').waitFor();
        assert.equal(await scenario.page.getByRole('dialog').getByText('Nilai', {exact:false}).count(), 0);
      }
      await scenario.context.close();
    }

    const many = await setup(browser, { many: true });
    await many.page.locator('.navigator-item').nth(24).evaluate(el => el.click());
    await many.page.waitForTimeout(700);
    const isVisibleInStrip = await many.page.evaluate(() => { const strip = document.querySelector('.navigator-grid').getBoundingClientRect(); const item = document.querySelector('.navigator-item[aria-current="step"]').getBoundingClientRect(); return item.left >= strip.left && item.right <= strip.right; });
    assert.equal(isVisibleInStrip, true, 'current question scrolls into the mobile strip');
    await many.context.close();

    const blocked = await setup(browser, { storageBlocked: true });
    await blocked.page.getByRole('button', { name: 'Periksa lagi', exact: true }).click();
    await blocked.page.getByRole('button', { name: 'Ditandai', exact: true }).waitFor();
    await blocked.context.close();

    const failure = await setup(browser, { brokenImage: true });
    await failure.page.getByText('Gambar tidak dapat dimuat. Hubungi pengawas.').waitFor();
    await failure.page.locator('.choice input').first().check();
    await failure.page.waitForTimeout(800);
    failure.state.locked = true;
    await failure.page.evaluate(() => dispatchEvent(new Event('online')));
    await failure.page.getByRole('heading', { name: 'Sesi terkunci sementara' }).waitFor();
    assert.equal(await failure.page.locator('.choice input').first().isDisabled(), true);
    failure.state.locked = false;
    await failure.page.evaluate(() => dispatchEvent(new Event('online')));
    await failure.page.getByRole('heading', { name: 'Sesi terkunci sementara' }).waitFor({ state: 'detached' });
    assert.equal(await failure.page.locator('.choice input').first().isChecked(), true);
    failure.state.online = false;
    await failure.page.evaluate(() => dispatchEvent(new Event('online')));
    await failure.page.getByText('Koneksi terputus').waitFor();
    failure.state.online = true;
    await failure.page.evaluate(() => dispatchEvent(new Event('online')));
    await failure.page.getByText('Terhubung', { exact: true }).waitFor();
    assert.equal(await failure.page.locator('.choice input').first().isChecked(), true);
    const seconds = await failure.page.locator('.timer strong').getAttribute('aria-label');
    const expected = Math.floor((Date.parse(failure.end) - Date.now()) / 1000);
    assert.ok(Math.abs(Number(seconds.match(/\d+/)?.[0]) - expected) < 5, 'timer follows server end time');
    await failure.context.close();
    console.log('PASS: responsive navigator, neutral global timer, structured math/media, answer types, autosave, flags, submit, all-at-once, blocked storage, media failure, lock/unlock and reconnect');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
