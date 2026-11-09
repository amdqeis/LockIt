import { NextRequest } from "next/server";
import { bankError, bankTeacher } from "@/lib/question-bank";
import { validateBankXml } from "@/lib/question-bank-xml";
import { errorResponse, successResponse } from "@/lib/response";

export async function POST(req: NextRequest) {
  try {
    await bankTeacher(req);
    const length = Number(req.headers.get("content-length") || 0);
    if (length > 20 * 1024 * 1024 + 64 * 1024) return errorResponse("INVALID_XML", "Ukuran XML maksimal 20 MB", 413);
    const file = (await req.formData()).get("file");
    if (!(file instanceof File) || file.size > 20 * 1024 * 1024) return errorResponse("INVALID_XML", "Pilih XML berukuran maksimal 20 MB", 400);
    const archive = validateBankXml(Buffer.from(await file.arrayBuffer()));
    return successResponse({ title: archive.title, questionCount: archive.questions.length, mediaCount: Object.keys(archive.media).length, warnings: archive.warnings });
  } catch (err) { return bankError(err); }
}
