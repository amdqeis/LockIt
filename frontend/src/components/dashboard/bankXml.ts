import { staffApi, staffDownload } from "@/lib/staff-api";
import type { Bank, Subject } from "./types";

export type Backup = { title: string; questionCount: number; mediaCount: number; warnings: string[] };
export async function exportBankXml(bank: Bank) {
  const data = await staffDownload(`/api/question-banks/${encodeURIComponent(bank.id)}/xml`);
  const url = URL.createObjectURL(data); const link = document.createElement("a");
  link.href = url; link.download = `${bank.title.replace(/[^a-z0-9_-]/gi, "_") || "bank-soal"}.xml`; link.click(); URL.revokeObjectURL(url);
  return true;
}
export async function readBankXml(file: File): Promise<Backup> {
  if (file.size > 20 * 1024 * 1024) throw new Error("Ukuran XML maksimal 20 MB.");
  const body = new FormData(); body.append("file", file);
  return staffApi<Backup>("/api/question-banks/xml/preview", { method: "POST", body });
}
export async function importBankXml(file: File, subject: Subject) {
  const body = new FormData(); body.append("file", file); body.append("subjectId", subject.id);
  return staffApi<{ bankId: string; draftId: string | null; draftOwnedByCaller: boolean; alreadyImported: boolean }>("/api/question-banks/xml/import", { method: "POST", body });
}
