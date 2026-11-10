import { NextRequest } from "next/server";
import { readJobState, isMaintenanceActive, getMaintenanceReason } from "@/lib/backup-restore";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const statusToken = req.nextUrl.searchParams.get("statusToken") || req.headers.get("x-status-token");
    let authorized = false;

    const job = await readJobState();

    if (statusToken && job && job.statusToken === statusToken) {
      authorized = true;
    } else {
      try {
        const teacher = await authenticateTeacher(req);
        if (teacher.role === "ADMIN") {
          authorized = true;
        }
      } catch {
        // Not authorized via session
      }
    }

    if (!authorized) {
      return errorResponse("UNAUTHORIZED", "Akses status pekerjaan ditolak.", 401);
    }

    return successResponse(
      {
        job,
        maintenance: isMaintenanceActive(),
        maintenanceReason: getMaintenanceReason(),
      },
      200,
      {
        "Cache-Control": "private, no-store",
      }
    );
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengambil status pekerjaan"), 500);
  }
}

