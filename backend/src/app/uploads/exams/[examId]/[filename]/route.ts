import { readFile } from "fs/promises";
import path from "path";

const mimeTypes: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

// Legacy exam images were written to public/ at runtime, after Next's build.
export async function GET(_request: Request, { params }: { params: Promise<{ examId: string; filename: string }> }) {
  const { examId, filename } = await params;
  const extension = path.extname(filename).toLowerCase();
  if (!/^[a-zA-Z0-9-]+$/.test(examId) || !/^[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/i.test(filename) || !mimeTypes[extension]) {
    return new Response(null, { status: 404 });
  }
  try {
    const image = await readFile(path.join(process.cwd(), "public", "uploads", "exams", examId, filename));
    return new Response(image, { headers: { "Content-Type": mimeTypes[extension], "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response(null, { status: 404 });
  }
}
