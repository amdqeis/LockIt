import { NextRequest } from "next/server";
import { findBrowserIdentity } from "@/lib/browser-identity";
import { successResponse } from "@/lib/response";

export async function GET(req: NextRequest) {
  try {
    const identity = await findBrowserIdentity(req);
    if (!identity || (!identity.lastStudentName && !identity.lastStudentNisn)) {
      return successResponse(null, 200, {
        "Cache-Control": "private, no-store",
      });
    }

    return successResponse(
      {
        name: identity.lastStudentName || null,
        nisn: identity.lastStudentNisn || null,
      },
      200,
      {
        "Cache-Control": "private, no-store",
      }
    );
  } catch {
    return successResponse(null, 200, {
      "Cache-Control": "private, no-store",
    });
  }
}

