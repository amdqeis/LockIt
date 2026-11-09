import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { databaseIsEmpty, hash, migrations, prisma } from "./migration-guard.mjs";

// This snapshot may only initialize a new, completely empty database.
const schemaHash = "4f8b0a30f8b88fc007ce2bdf63c9ae20c416b19a959ec920828808a92c0e227e";
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");
const baseline = [
  ["20261027_rename_session_token_to_hash", "b70d42aca88198a1b75c6c01a0562c9a1de3c06a1df580ab4e3945da2b7e9045"],
  ["20261028_add_rbac_teacher_fields", "4e9a7a1a5638e1c31ab2bc8d7fd548f935298d94744e26a2ef084070ea20bd34"],
  ["20261102_add_question_type", "b375520ee6a88587e75f6d2502421612a52fb41726fb6c24a72adcadbe8f5e6e"],
  ["20261106_add_browser_history", "7ef9c8c22087df9ac287d7deba6ee989b5dca6358c01bb2899efbd0f70696a2a"],
  ["20261107_add_question_bank", "d2f03855b99313cc28b2f39459fc893fcc8dc76b5ac764e4eadc007747ef7e9a"],
  ["20261108_exam_admission_violation_cycles", "d20d4cefde63bb8ef4f07c95963e931614de679335f58720474dac899f6758ba"],
  ["20261109_dashboard_metadata", "798b3f57ec763a9ac3f37b515292cd3e42b485a8773f72620d36c3746306db86"],
];
function run(...args) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], { stdio: "inherit", env: process.env });
  if (result.status !== 0) throw new Error(`Prisma ${args.join(" ")} gagal.`);
}
try {
  const local = await migrations();
  if (hash(await readFile("prisma/schema.prisma")) !== schemaHash || JSON.stringify(local.map(({ name, checksum }) => [name, checksum])) !== JSON.stringify(baseline)) {
    throw new Error("Snapshot baseline berubah; perbarui prosedur bootstrap setelah meninjau skema dan migrasi.");
  }
  if (!(await databaseIsEmpty())) throw new Error("Database tidak kosong; bootstrap dihentikan tanpa mengubah database.");
  await prisma.$disconnect();
  run("db", "push", "--skip-generate");
  run("migrate", "diff", "--from-schema-datasource", "prisma/schema.prisma", "--to-schema-datamodel", "prisma/schema.prisma", "--exit-code");
  for (const [name] of baseline) run("migrate", "resolve", "--applied", name);
  run("migrate", "status");
  console.log("Database baru berhasil diinisialisasi.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
