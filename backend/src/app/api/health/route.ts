import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/response";

export async function GET(req: NextRequest) {
  try {
    let dbStatus = "disconnected";
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = "connected";
    } catch (dbErr: any) {
      dbStatus = `error: ${dbErr.message || "database unreachable"}`;
    }

    return successResponse({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: dbStatus,
      uptime: process.uptime(),
    });
  } catch (err: any) {
    return errorResponse("HEALTH_CHECK_FAILED", err.message || "Service check failed", 500);
  }
}
