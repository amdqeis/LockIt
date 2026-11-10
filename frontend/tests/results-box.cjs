const { chromium } = require("playwright-core");
const executablePath = process.env.CHROMIUM_PATH || "/usr/bin/chromium";

async function run() {
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  await context.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/auth/me") {
      return route.fulfill({ json: { success: true, data: { id: "t1", fullName: "Admin Guru", role: "ADMIN" } } });
    }
    if (url.pathname === "/api/dashboard/results/facets") {
      return route.fulfill({ json: { success: true, data: { subject: ["Matematika"], className: ["XII-Aljabar"], period: ["2026/2027 · ganjil"], category: ["Quiz"] } } });
    }
    if (url.pathname === "/api/dashboard/results/groups") {
      return route.fulfill({
        json: {
          success: true,
          data: {
            totalExams: 1,
            groups: [
              {
                classroomId: "c-1",
                className: "XII-Aljabar",
                gradeLevelId: "g-1",
                gradeLevelName: "XII",
                totalExams: 1,
                totalCompletedStudents: 1,
                averageScore: 100,
                subjects: [
                  {
                    subjectId: "s-1",
                    subjectName: "Matematika",
                    gradeLevelName: "XII",
                    totalExams: 1,
                    totalCompletedStudents: 1,
                    averageScore: 100,
                    exams: [
                      {
                        id: "e-1",
                        title: "Quiz 1",
                        status: "ended",
                        subjectName: "Matematika",
                        className: "XII-Aljabar",
                        academicYear: "2026/2027",
                        semester: "ganjil",
                        category: "Quiz",
                        categoryNumber: 1,
                        passingScore: 75,
                        completedStudents: 1,
                        averageScore: 100,
                        pendingGradingCount: 0
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
      });
    }
    if (url.pathname === "/api/dashboard/results") {
      return route.fulfill({
        json: {
          success: true,
          data: {
            exams: [{ id: "e-1", title: "Quiz 1", subjectName: "Matematika", className: "XII-Aljabar", academicYear: "2026/2027", semester: "ganjil", category: "Quiz", categoryNumber: 1, passingScore: 75 }],
            attempts: [
              {
                exam: { id: "e-1", title: "Quiz 1", subjectName: "Matematika", className: "XII-Aljabar", academicYear: "2026/2027", semester: "ganjil", category: "Quiz", categoryNumber: 1, passingScore: 75 },
                student: { studentId: "st-1", name: "Ahmad Key", nisn: "1232131313", status: "submitted", submittedAt: new Date().toISOString(), violationCount: 0, finalScore: 100, pendingManualCount: 0 }
              }
            ],
            students: [],
            page: 1,
            total: 1,
            totalPages: 1
          }
        }
      });
    }
    route.continue();
  });

  await page.goto("http://localhost:3000/dashboard/hasil");
  await page.waitForSelector(".class-box-card");

  const content = await page.content();
  console.log("Box card visible for XII-Aljabar:", content.includes("XII-Aljabar"));
  console.log("Has Filter Tingkat:", content.includes("Filter Tingkat"));

  // Click card
  await page.click(".class-box-card");
  await page.waitForSelector(".class-detail-banner");

  const detailContent = await page.content();
  console.log("Detail view has Quiz 1:", detailContent.includes("Quiz 1"));
  console.log("Detail view has Ahmad Key:", detailContent.includes("Ahmad Key"));
  console.log("Detail view has score 100:", detailContent.includes("100"));

  // Click back button
  await page.click("button:has-text(\"Kembali ke Semua Kelas\")");
  await page.waitForSelector(".class-box-card");
  console.log("Returned to class box grid successfully!");

  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

