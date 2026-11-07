import { NextRequest } from "next/server";
import { authenticateStudent } from "@/lib/middleware/auth";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { buildStudentReview } from "@/services/student-review";

export async function GET(req: NextRequest) {
  try {
    const { student } = await authenticateStudent(req, { skipSubmittedCheck: true });
    return successResponse(await buildStudentReview(student));
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengambil data review ujian"), 500);
  }
}

