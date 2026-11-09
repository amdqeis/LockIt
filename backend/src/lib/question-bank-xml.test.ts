import assert from "node:assert/strict";
import test from "node:test";
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.STUDENT_SESSION_SECRET = "test-student-secret";
const library = import("./question-bank-xml");

const question = { type: "multi_select", questionText: "$x^2$", content: { type: "doc", content: [{ type: "equation", attrs: { latex: "x^2" } }] }, imageAlt: "Grafik", options: [{ id: "AA", label: "AA", text: "Satu" }, { id: "BB", label: "BB", text: "Dua" }], correctAnswers: ["AA", "BB"], points: 10 };
test("versioned XML retains structured equations and multi-character answer keys", async () => {
  const { makeBankXml, validateBankXml } = await library;
  const archive = { title: "Aljabar", questions: [question], media: {}, warnings: [] };
  const parsed = validateBankXml(makeBankXml(archive));
  assert.deepEqual(parsed.questions[0], question);
});
test("legacy local image references produce an explicit warning", async () => {
  const { validateBankXml } = await library;
  const xml = Buffer.from('<exam title="Lama"><question><text>Hitung</text><image>/uploads/exams/abc123/gambar.png</image><options><option label="A" correct="true">Satu</option><option label="B">Dua</option></options></question></exam>');
  const parsed = validateBankXml(xml);
  assert.equal(parsed.warnings.length, 1);
  assert.equal((parsed.questions[0] as { imageUrl: string | null }).imageUrl, null);
});
test("XML rejects entity declarations and missing managed attachments", async () => {
  const { makeBankXml, validateBankXml } = await library;
  assert.throws(() => validateBankXml(Buffer.from('<!DOCTYPE foo [<!ENTITY x SYSTEM "file:///etc/passwd">]><exam>&x;</exam>')));
  const xml = makeBankXml({ title: "Aljabar", questions: [{ ...question, imageUrl: "/api/question-banks/media/missing" }], media: {}, warnings: [] });
  assert.throws(() => validateBankXml(xml), /tidak tersedia/);
});
