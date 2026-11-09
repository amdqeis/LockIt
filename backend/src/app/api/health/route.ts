import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/response";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return successResponse({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "connected",
      uptime: process.uptime(),
    });
  } catch {
    return errorResponse("HEALTH_CHECK_FAILED", "Database tidak tersedia", 503);
  }
}
