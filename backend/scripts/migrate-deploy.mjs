import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { prisma, verifyHistory } from "./migration-guard.mjs";

try {
  await verifyHistory();
  await prisma.$disconnect();
  for (const args of [["migrate", "deploy"], ["migrate", "status"]]) {
    const cli = createRequire(import.meta.url).resolve("prisma/build/index.js");
    const result = spawnSync(process.execPath, [cli, ...args], { stdio: "inherit", env: process.env });
    if (result.status !== 0) throw new Error(`Prisma ${args.join(" ")} gagal.`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
