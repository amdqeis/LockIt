/* Browser checks use simulated API responses and never touch a database. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const origin = process.env.EDUQUAS_TEST_FRONTEND_URL || 'http://localhost:3000';
const executablePath = process.env.CHROMIUM_PATH || '/usr/bin/chromium';

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const sent = [];
  let connection = false;
  let locked = false;
  const end = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url());
    const now = new Date().toISOString();
    if (url.pathname === '/api/exam-session/waiting') return route.fulfill({ json: { success: true, data: { student: { id: 'student-1', name: 'Peserta Uji', nisn: '1234567890', status: 'active', isLocked: locked }, exam: { id: 'exam-1', title: 'Ujian Uji', accessCode: 'ABC234', status: 'active', durationMinutes: 60, startTime: now, endTime: end, serverTime: now } } } });
    if (url.pathname === '/api/exam-session') return route.fulfill({ json: { success: true, data: { student: { id: 'student-1', name: 'Peserta Uji', nisn: '1234567890', isLocked: locked }, exam: { id: 'exam-1', title: 'Ujian Uji', endTime: end, settings: { display_mode: 'one_by_one' }, violationPolicy: { detect_tab_switch: true, detect_devtools: true, detect_screenshot: true } }, questions: [{ id: 'question-1', orderIndex: 0, type: 'single_choice', questionText: 'Pertanyaan', points: 1, options: [{ id: 'A', label: 'A', text: 'Satu' }, { id: 'B', label: 'B', text: 'Dua' }] }], totalQuestions: 1, hasMore: false, answers: [], serverTime: now } } });
    if (url.pathname === '/api/exam-session/heartbeat') return route.fulfill({ json: { success: true, data: { isLocked: locked, isExamActive: true, serverTime: now, warning: null } } });
    if (url.pathname === '/api/proctoring/event') {
      const incident = route.request().postDataJSON(); sent.push(incident);
      if (!connection) return route.abort('failed');
      if (incident.eventType === 'screenshot') locked = true;
      return route.fulfill({ json: { success: true, data: { isLocked: locked } } });
    }
    return route.fulfill({ json: { success: true, data: {} } });
  });
  try {
    await page.goto(`${origin}/exam/session`);
    await page.getByRole('heading', { name: 'Ujian Uji' }).waitFor();
    await page.evaluate(() => { window.dispatchEvent(new Event('blur')); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    const queueKey = 'eduquas:pending-events:exam-1:student-1';
    await page.waitForFunction(key => !!localStorage.getItem(key), queueKey);
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), queueKey);
    assert.equal(saved.length, 1, 'blur and hidden visibility must be one incident');
    const ordinaryId = saved[0].incidentId;
    connection = true;
    await page.reload();
    await page.waitForFunction(key => !localStorage.getItem(key), queueKey);
    assert.ok(sent.filter(item => item.incidentId === ordinaryId).length >= 2, 'retry must preserve the incident ID');
    connection = false;
    await page.getByRole('heading', { name: 'Ujian Uji' }).waitFor();
    await page.keyboard.press('PrintScreen');
    const screenshotKey = 'eduquas:pending-screenshot:exam-1:student-1';
    await page.waitForFunction(key => !!localStorage.getItem(key), screenshotKey);
    const screenshot = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), screenshotKey);
    connection = true;
    await page.reload();
    await page.waitForFunction(key => !localStorage.getItem(key), screenshotKey);
    assert.equal(locked, true, 'server confirms the screenshot lock');
    assert.ok(sent.filter(item => item.incidentId === screenshot.incidentId).length >= 2, 'screenshot retry must preserve its incident ID');
    console.log('PASS: focus deduplication and offline incidents survive refresh');
  } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
