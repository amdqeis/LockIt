import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashRefreshToken } from "@/lib/auth";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
export async function POST(req: NextRequest) {
  try {
    const rawRefreshToken = req.cookies.get("refreshToken")?.value;

    if (rawRefreshToken) {
      const tokenHash = hashRefreshToken(rawRefreshToken);
      await prisma.refreshToken
        .updateMany({
          where: { tokenHash, isRevoked: false },
          data: { isRevoked: true },
        })
        .catch(() => {});
    }

    const response = successResponse({ message: "Berhasil keluar dari akun" });
    response.cookies.delete("refreshToken");
    response.cookies.delete("hasTeacherSession");

    return response;
  } catch (err: any) {
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal melakukan logout"), 500);
  }
}
