import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { NextRequest } from "next/server";

const enabled = process.env.EDUQUAS_TEMP_DB_TEST === "1" && process.env.DATABASE_URL?.startsWith("postgresql://key@127.0.0.1:15437/") && !!process.env.EDUQUAS_QUESTION_MEDIA_DIR;
test("temporary database: server XML backup, validation, media and idempotent import", { skip: !enabled }, async () => {
  process.env.JWT_ACCESS_SECRET = "temporary-test-access";
  const [{ prisma }, { generateAccessToken }, exporter, preview, importer, bankDetail, bankList, subjectDetail] = await Promise.all([
    import("@/lib/prisma"), import("@/lib/auth"), import("@/app/api/question-banks/[id]/xml/route"), import("./preview/route"), import("./import/route"), import("@/app/api/question-banks/[id]/route"), import("@/app/api/question-banks/route"), import("@/app/api/subjects/[id]/route"),
  ]);
  const teacher = await prisma.teacher.create({ data: { email: `${randomUUID()}@example.invalid`, fullName: "Guru Uji", passwordHash: "test-only" } });
  const token = generateAccessToken({ teacherId: teacher.id, email: teacher.email, fullName: teacher.fullName, role: "TEACHER" });
  const headers = { Authorization: `Bearer ${token}` };
  const directory = process.env.EDUQUAS_QUESTION_MEDIA_DIR!;
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6ZkAAAAASUVORK5CYII=", "base64");
  try {
    const source = await prisma.subject.create({ data: { name: `Sumber ${randomUUID()}` } });
    const target = await prisma.subject.create({ data: { name: `Tujuan ${randomUUID()}` } });
    const bank = await prisma.questionBank.create({ data: { title: "Aljabar", subject: source.name, subjectId: source.id, createdBy: teacher.id, updatedBy: teacher.id } });
    const filename = `${randomUUID()}.png`; await mkdir(directory, { recursive: true }); await writeFile(path.join(directory, filename), png);
    const media = await prisma.questionBankMedia.create({ data: { filename, mimeType: "image/png", size: png.length, uploadedBy: teacher.id } });
    const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "equation", attrs: { latex: "x^2" } }] }] };
    await prisma.bankQuestion.create({ data: { bankId: bank.id, orderIndex: 1, type: "multi_select", questionText: "$x^2$", content, imageUrl: `/api/question-banks/media/${media.id}`, imageAlt: "Grafik", options: [{ id: "AA", label: "AA", text: "Satu" }, { id: "BB", label: "BB", text: "Dua" }], correctAnswers: ["AA", "BB"], points: 10 } });
    const response = await exporter.GET(new NextRequest("http://localhost/api/export", { headers }), { params: Promise.resolve({ id: bank.id }) });
    assert.equal(response.status, 200); const bytes = new Uint8Array(await response.arrayBuffer());
    const form = (subjectId?: string) => { const value = new FormData(); value.append("file", new File([bytes], "bank.xml", { type: "application/xml" })); if (subjectId) value.append("subjectId", subjectId); return value; };
    const examined = await preview.POST(new NextRequest("http://localhost/api/preview", { method: "POST", headers, body: form() }));
    assert.equal(examined.status, 200); const checked = await examined.json(); assert.equal(checked.data.questionCount, 1); assert.equal(checked.data.mediaCount, 1);
    const imported = await importer.POST(new NextRequest("http://localhost/api/import", { method: "POST", headers, body: form(target.id) }));
    assert.equal(imported.status, 201, JSON.stringify(await imported.clone().json())); const result = await imported.json();
    const draft = await prisma.questionBankDraft.findUniqueOrThrow({ where: { id: result.data.draftId } });
    const q = (draft.content as { questions: { imageUrl: string; imageAlt: string; content: unknown; correctAnswers: string[] }[] }).questions[0];
    assert.deepEqual(q.correctAnswers, ["AA", "BB"]); assert.deepEqual(q.content, content); assert.equal(q.imageAlt, "Grafik"); assert.notEqual(q.imageUrl, `/api/question-banks/media/${media.id}`);
    const importedMedia = await prisma.questionBankMedia.findUniqueOrThrow({ where: { id: q.imageUrl.split("/").pop()! } }); assert.deepEqual(await readFile(path.join(directory, importedMedia.filename)), png);
    const again = await importer.POST(new NextRequest("http://localhost/api/import", { method: "POST", headers, body: form(target.id) }));
    const duplicate = await again.json(); assert.equal(duplicate.data.alreadyImported, true); assert.equal(duplicate.data.bankId, result.data.bankId); assert.equal(duplicate.data.draftOwnedByCaller, true);
    const other = await prisma.teacher.create({ data: { email: `${randomUUID()}@example.invalid`, fullName: "Guru Lain", passwordHash: "test-only" } });
    const otherToken = generateAccessToken({ teacherId: other.id, email: other.email, fullName: other.fullName, role: "TEACHER" });
    const otherImport = await importer.POST(new NextRequest("http://localhost/api/import", { method: "POST", headers: { Authorization: `Bearer ${otherToken}` }, body: form(target.id) }));
    const otherResult = await otherImport.json(); assert.equal(otherResult.data.alreadyImported, true); assert.equal(otherResult.data.draftOwnedByCaller, false);
    const moveRequest = new NextRequest("http://localhost/api/question-banks/id", { method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ revision: 1, subjectId: target.id }) });
    assert.equal((await bankDetail.PATCH(moveRequest, { params: Promise.resolve({ id: bank.id }) })).status, 200);
    const moved = await prisma.questionBank.findUniqueOrThrow({ where: { id: bank.id }, include: { _count: { select: { questions: true } } } });
    assert.equal(moved.subjectId, target.id); assert.equal(moved.subject, target.name); assert.equal(moved._count.questions, 1);
    const listed = await bankList.GET(new NextRequest(`http://localhost/api/question-banks?limit=1&subjectId=${target.id}`, { headers }));
    const listedBody = await listed.json(); assert.equal(listed.status, 200); assert.equal(listedBody.data.items.length, 1); assert.ok(listedBody.data.nextCursor);
    const badCursor = await bankList.GET(new NextRequest(`http://localhost/api/question-banks?limit=1&subjectId=${source.id}&cursor=${bank.id}`, { headers })); assert.equal(badCursor.status, 400);
    assert.equal((await subjectDetail.DELETE(new NextRequest("http://localhost/api/subjects/id", { method: "DELETE", headers }), { params: Promise.resolve({ id: target.id }) })).status, 409);
    assert.equal((await subjectDetail.DELETE(new NextRequest("http://localhost/api/subjects/id", { method: "DELETE", headers }), { params: Promise.resolve({ id: source.id }) })).status, 200);
    const malicious = new FormData(); malicious.append("file", new File(['<!DOCTYPE foo [<!ENTITY x SYSTEM "file:///etc/passwd">]><exam>&x;</exam>'], "bad.xml"));
    assert.equal((await preview.POST(new NextRequest("http://localhost/api/preview", { method: "POST", headers, body: malicious }))).status, 400);
    assert.equal((await exporter.GET(new NextRequest("http://localhost/api/export"), { params: Promise.resolve({ id: bank.id }) })).status, 401);
  } finally { await prisma.$disconnect(); }
});
