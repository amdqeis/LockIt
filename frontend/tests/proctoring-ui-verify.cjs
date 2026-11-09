/* Verify updated proctoring interface layout matches reference mockup */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

const origin = process.env.EDUQUAS_TEST_FRONTEND_URL || 'http://localhost:3000';
const executablePath = process.env.CHROMIUM_PATH || '/usr/bin/chromium';

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  const now = new Date();
  const endTime = new Date(Date.now() + 42 * 60 * 1000 + 18 * 1000).toISOString();

  const studentsList = [
    { id: 's1', name: 'Alice Johnson', nisn: 'STU-1001', status: 'active', isLocked: false, answeredCount: 18, totalQuestions: 30, violationCount: 0, violationCycleCount: 0, lastSeen: now.toISOString() },
    { id: 's2', name: 'Brian Lee', nisn: 'STU-1002', status: 'active', isLocked: false, answeredCount: 16, totalQuestions: 30, violationCount: 3, violationCycleCount: 1, lastSeen: now.toISOString() },
    { id: 's3', name: 'Carla Mendes', nisn: 'STU-1003', status: 'submitted', isLocked: false, answeredCount: 30, totalQuestions: 30, violationCount: 0, violationCycleCount: 0, lastSeen: now.toISOString() },
    { id: 's4', name: 'Daniel Kim', nisn: 'STU-1004', status: 'active', isLocked: true, answeredCount: 14, totalQuestions: 30, violationCount: 4, violationCycleCount: 2, lastSeen: now.toISOString() },
    { id: 's5', name: 'Emma Davis', nisn: 'STU-1005', status: 'active', isLocked: false, answeredCount: 21, totalQuestions: 30, violationCount: 1, violationCycleCount: 0, lastSeen: now.toISOString() },
    { id: 's6', name: 'Farah Ahmad', nisn: 'STU-1006', status: 'active', isLocked: false, answeredCount: 19, totalQuestions: 30, violationCount: 2, violationCycleCount: 1, lastSeen: now.toISOString() },
    { id: 's7', name: 'Gabriel Santos', nisn: 'STU-1007', status: 'active', isLocked: false, answeredCount: 20, totalQuestions: 30, violationCount: 0, violationCycleCount: 0, lastSeen: now.toISOString() },
    { id: 's8', name: 'Hannah Brooks', nisn: 'STU-1008', status: 'submitted', isLocked: false, answeredCount: 30, totalQuestions: 30, violationCount: 0, violationCycleCount: 0, lastSeen: now.toISOString() },
    { id: 's9', name: 'Ian Mitchell', nisn: 'STU-1009', status: 'active', isLocked: false, answeredCount: 17, totalQuestions: 30, violationCount: 2, violationCycleCount: 1, lastSeen: now.toISOString() },
    { id: 'w1', name: 'Kyle Morgan', nisn: 'STU-783921', status: 'waiting', isLocked: false, answeredCount: 0, totalQuestions: 30, violationCount: 0, violationCycleCount: 0 },
    { id: 'w2', name: 'Nicole Park', nisn: 'STU-783946', status: 'waiting', isLocked: false, answeredCount: 0, totalQuestions: 30, violationCount: 0, violationCycleCount: 0 }
  ];

  await page.route('**/socket.io/**', route => route.abort());
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/auth/me') {
      return route.fulfill({ json: { success: true, data: { id: 't1', fullName: 'Dr. Semyon Carter', email: 'semyon@pulse.edu', role: 'ADMIN', isActive: true } } });
    }
    if (url.pathname === '/api/exams/exam-1/dashboard') {
      return route.fulfill({
        json: {
          success: true,
          data: {
            exam: {
              id: 'exam-1',
              title: 'Data Structures — Midterm Quiz',
              className: 'CS201: Data Structures',
              subjectName: 'Computer Science',
              accessCode: 'STU-784293',
              status: 'active',
              startTime: now.toISOString(),
              endTime: endTime,
            },
            overview: {
              waitingCount: 2,
              activeCount: 18,
              submittedCount: 5,
              lockedCount: 1
            },
            serverTime: now.toISOString()
          }
        }
      });
    }
    if (url.pathname === '/api/exams/exam-1/students') {
      return route.fulfill({
        json: {
          success: true,
          data: {
            students: studentsList,
            totalStudents: 24,
            totalPages: 1
          }
        }
      });
    }
    return route.fulfill({ json: { success: true, data: {} } });
  });

  try {
    await page.goto(`${origin}/dashboard/monitoring?exam=exam-1`);

    // Verify Title & Live Badge
    await page.getByRole('heading', { name: 'Exam Proctoring' }).waitFor();
    const liveBadge = page.locator('.proctor-live-badge').first();
    assert.ok(await liveBadge.isVisible(), 'Live badge must be visible');

    // Verify End Proctoring button
    const endBtn = page.locator('.proctor-btn-end');
    assert.ok(await endBtn.isVisible(), 'End Proctoring button must be visible');

    // Verify Banner Card
    const banner = page.locator('.proctor-banner-card');
    assert.ok(await banner.isVisible(), 'Banner card must be visible');
    assert.ok(await banner.getByText('Data Structures — Midterm Quiz').isVisible());
    assert.ok(await banner.getByText('STU-784293').isVisible());

    // Verify 5 Stat Metric Cards
    const metricCards = page.locator('.proctor-metric-card');
    assert.equal(await metricCards.count(), 5, 'Must have exactly 5 metric cards');
    assert.ok(await page.locator('.proctor-metric-card.time-card').isVisible(), '5th card must be dark time card');
    assert.ok(await page.getByText('Time Remaining').isVisible());

    // Verify Filter Pills
    assert.ok(await page.getByRole('button', { name: /All Students/i }).isVisible());
    assert.ok(await page.getByRole('button', { name: /In Progress/i }).isVisible());
    assert.ok(await page.getByRole('button', { name: /Completed/i }).isVisible());

    // Verify Student Cards
    const studentCards = page.locator('.proctor-student-card');
    const cardCount = await studentCards.count();
    assert.ok(cardCount >= 8, 'Should render student cards');

    // Carla Mendes (Completed card state)
    const carlaCard = page.locator('.proctor-student-card.is-completed').first();
    assert.ok(await carlaCard.isVisible(), 'Carla Mendes completed card must have .is-completed');
    assert.ok(await carlaCard.locator('.proctor-completed-box').isVisible(), 'Completed card must have score box');
    assert.ok(await carlaCard.locator('.proctor-btn-view-results').isVisible(), 'Completed card must have View Results button');

    // Daniel Kim (Locked card state)
    const danielCard = page.locator('.proctor-student-card.is-locked').first();
    assert.ok(await danielCard.isVisible(), 'Daniel Kim card must have .is-locked');
    assert.ok(await danielCard.locator('.proctor-status-pill.locked').isVisible(), 'Locked status pill must be visible');
    const unlockBtn = danielCard.locator('.proctor-btn-unlock');
    assert.equal(await unlockBtn.isEnabled(), true, 'Unlock button on locked card must be enabled');

    // Brian Lee (Warning card state)
    const brianCard = page.locator('.proctor-student-card.is-warning').first();
    assert.ok(await brianCard.isVisible(), 'Brian Lee card must have .is-warning');
    assert.ok(await brianCard.locator('.proctor-status-pill.warning').isVisible());

    // Verify Live Event Feed
    assert.ok(await page.getByRole('heading', { name: 'Live Event Feed' }).isVisible());

    // Verify Lobby Requests Floating Popup
    const lobbyPopup = page.locator('.proctor-lobby-popup');
    assert.ok(await lobbyPopup.isVisible(), 'Lobby requests popup must be visible');
    assert.ok(await lobbyPopup.getByText('Kyle Morgan').isVisible());
    assert.ok(await lobbyPopup.getByText('Nicole Park').isVisible());
    assert.ok(await lobbyPopup.locator('.proctor-btn-approve').first().isVisible());
    assert.ok(await lobbyPopup.locator('.proctor-btn-reject').first().isVisible());
    assert.ok(await lobbyPopup.locator('.proctor-btn-view').first().isVisible());

    // Take full-page screenshot
    const screenshotPath = '/tmp/eduquas-proctoring-redesign.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`PASS: Proctoring layout verified and screenshot captured at ${screenshotPath}`);
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});

