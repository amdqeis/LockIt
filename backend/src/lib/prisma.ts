import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

// MED-03: Konfigurasi pool size via env.
// connection_limit di DATABASE_URL overrides default Prisma pool (default: num_cpus * 2 + 1)
// Untuk ujian online: set ke 10-20 tergantung resource server.
// Contoh: DATABASE_URL="postgresql://...?connection_limit=10&pool_timeout=20"
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

