import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export async function migrations() {
  const entries = await readdir("prisma/migrations", { withFileTypes: true });
  const names = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const sql = await readFile(`prisma/migrations/${entry.name}/migration.sql`);
      names.push({ name: entry.name, checksum: hash(sql) });
    } catch (error) {
      if (error.code === "ENOENT") throw new Error(`Direktori migrasi ${entry.name} tidak memiliki migration.sql; periksa workspace sebelum melanjutkan.`);
      throw error;
    }
  }
  return names.sort((a, b) => a.name.localeCompare(b.name));
}
export async function databaseIsEmpty() {
  const result = await prisma.$queryRawUnsafe(`
    SELECT NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = current_schema() AND c.relkind IN ('r','p','v','m','S','f')
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = current_schema() AND t.typtype IN ('e','d','r')
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = current_schema()
    ) AS empty`);
  return result[0].empty;
}
export async function verifyHistory() {
  const found = await prisma.$queryRawUnsafe(`SELECT to_regclass(format('%I.%I', current_schema(), '_prisma_migrations')) IS NOT NULL AS present`);
  if (!found[0].present) throw new Error("Riwayat migrasi tidak ditemukan. Untuk database baru yang kosong, jalankan prosedur bootstrap; periksa database yang sudah ada secara manual.");
  const rows = await prisma.$queryRawUnsafe('SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at');
  const local = await migrations();
  const applied = rows.filter((row) => !row.rolled_back_at);
  if (applied.some((row) => !row.finished_at)) throw new Error("Ada migrasi gagal atau belum selesai; periksa riwayat database sebelum deploy.");
  for (let i = 0; i < applied.length; i++) {
    if (!local[i] || local[i].name !== applied[i].migration_name || local[i].checksum !== applied[i].checksum) {
      throw new Error("Riwayat atau checksum migrasi berbeda dari repo; hentikan deploy dan periksa database.");
    }
  }
  if (applied.length === 0) throw new Error("Riwayat migrasi kosong; periksa database sebelum deploy.");
}
