import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/middleware/auth";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { getCurrentAcademicPeriod } from "@/lib/academic-year";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    const period = getCurrentAcademicPeriod();

    const result = await prisma.exam.updateMany({
      where: {
        status: {
          in: ["draft", "active", "ended"],
        },
      },
      data: {
        status: "archived",
      },
    });

    return successResponse({
      archivedCount: result.count,
      period,
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse(
      "INTERNAL_SERVER_ERROR",
      safeErrorMessage(err, "Gagal melakukan rollover tahun ajaran"),
      500
    );
  }
}
