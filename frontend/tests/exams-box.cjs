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
    if (url.pathname === "/api/academic/grade-levels") {
      return route.fulfill({ json: { success: true, data: [{ id: "g-1", name: "XII" }] } });
    }
    if (url.pathname === "/api/academic/classrooms") {
      return route.fulfill({ json: { success: true, data: [{ id: "c-1", name: "XII-Aljabar", gradeLevelId: "g-1" }] } });
    }
    if (url.pathname === "/api/subjects") {
      return route.fulfill({ json: { success: true, data: [{ id: "s-1", name: "Matematika", gradeLevelId: "g-1", _count: { banks: 1 } }] } });
    }
    if (url.pathname === "/api/question-banks") {
      return route.fulfill({ json: { success: true, data: [] } });
    }
    if (url.pathname === "/api/exams/groups") {
      return route.fulfill({
        json: {
          success: true,
          data: [
            {
              classroomId: "c-1",
              className: "XII-Aljabar",
              gradeLevelId: "g-1",
              gradeLevelName: "XII",
              totalExams: 1,
              activeExams: 1,
              subjects: [
                {
                  subjectId: "s-1",
                  subjectName: "Matematika",
                  gradeLevelName: "XII",
                  exams: [
                    {
                      id: "e-1",
                      title: "Quiz 1",
                      status: "active",
                      className: "XII-Aljabar",
                      subjectName: "Matematika",
                      accessCode: "XYZ123",
                      durationMinutes: 60,
                      _count: { questions: 10 }
                    }
                  ]
                }
              ]
            }
          ]
        }
      });
    }
    if (url.pathname === "/api/exams") {
      return route.fulfill({
        json: {
          success: true,
          data: {
            items: [
              {
                id: "e-1",
                title: "Quiz 1",
                status: "active",
                className: "XII-Aljabar",
                subjectName: "Matematika",
                accessCode: "XYZ123",
                durationMinutes: 60,
                _count: { questions: 10 }
              }
            ],
            nextCursor: null
          }
        }
      });
    }
    route.continue();
  });

  page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err));

  await page.goto("http://localhost:3000/dashboard/ujian");
  await page.waitForSelector(".drilldown-card");

  const content = await page.content();
  console.log("Grade card visible for Tingkat XII:", content.includes("Tingkat XII"));
  console.log("Has Filter Tingkat text in exams:", content.includes("Filter Tingkat"));

  // Click grade card
  await page.click(".drilldown-card");
  await page.waitForSelector(".class-box-card");
  const gradeContent = await page.content();
  console.log("Exam box card visible for XII-Aljabar:", gradeContent.includes("XII-Aljabar"));

  // Click class card
  await page.click(".class-box-card");
  await page.waitForSelector(".class-detail-banner");

  const detailContent = await page.content();
  console.log("Detail view has Quiz 1:", detailContent.includes("Quiz 1"));
  console.log("Detail view has Kode XYZ123:", detailContent.includes("XYZ123"));

  // Click back button
  await page.click("button:has-text(\"Kembali ke Semua Kelas\")");
  await page.waitForSelector(".class-box-card");
  console.log("Returned to exam class box grid successfully!");

  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

