#!/usr/bin/env node
/**
 * seed-admin.mjs — Buat Admin pertama di LockIt
 *
 * Penggunaan:
 *   DATABASE_URL="postgresql://..." node backend/prisma/seed-admin.mjs
 *
 * Atau dengan env otomatis (jika DATABASE_URL ada di backend/.env):
 *   cd backend && DATABASE_URL="postgresql://key:Ra_sy6a7e2@localhost/lockit?schema=public" \
 *     node prisma/seed-admin.mjs
 *
 * Env yang diperlukan:
 *   DATABASE_URL — koneksi PostgreSQL
 *   ADMIN_EMAIL  — (opsional) default: admin@lockit.local
 *   ADMIN_NAME   — (opsional) default: Administrator
 *   ADMIN_PASS   — (opsional) default: Admin@2026! (GANTI DI PRODUCTION!)
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@lockit.local";
const ADMIN_NAME  = process.env.ADMIN_NAME  ?? "Administrator";
const ADMIN_PASS  = process.env.ADMIN_PASS  ?? "Admin@2026!";

async function main() {
  console.log("🔑  LockIt — Seed Admin Script");
  console.log(`📧  Email  : ${ADMIN_EMAIL}`);
  console.log(`👤  Nama   : ${ADMIN_NAME}`);
  console.log(`🔒  Pass   : ${"*".repeat(ADMIN_PASS.length)}`);
  console.log("");

  const existing = await prisma.teacher.findUnique({
    where: { email: ADMIN_EMAIL.toLowerCase() },
  });

  if (existing) {
    if (existing.role === "ADMIN") {
      console.log("✅  Admin sudah ada, tidak ada perubahan.");
      console.log(`    ID: ${existing.id}`);
    } else {
      // Upgrade ke ADMIN jika sudah ada sebagai TEACHER
      await prisma.teacher.update({
        where: { id: existing.id },
        data:  { role: "ADMIN" },
      });
      console.log(`✅  Akun ${ADMIN_EMAIL} di-upgrade ke ADMIN.`);
    }
    return;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(ADMIN_PASS, salt);

  const admin = await prisma.teacher.create({
    data: {
      email:        ADMIN_EMAIL.toLowerCase(),
      fullName:     ADMIN_NAME,
      passwordHash,
      role:         "ADMIN",
      isActive:     true,
    },
  });

  console.log("✅  Admin berhasil dibuat!");
  console.log(`    ID   : ${admin.id}`);
  console.log(`    Email: ${admin.email}`);
  console.log("");
  console.log("⚠️   PENTING: Segera ganti password Admin setelah login pertama!");
}

main()
  .catch((e) => {
    console.error("❌  Seed gagal:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
