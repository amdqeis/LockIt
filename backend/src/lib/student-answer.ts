type SelectionResult = { ok: true; value: string | null } | { ok: false; message: string };

/** Canonicalise the existing comma-separated wire format using the question's own options. */
export function validateChoiceAnswer(options: unknown, selectedOption: string | null | undefined, multi: boolean): SelectionResult {
  const raw = selectedOption?.trim().toUpperCase() || "";
  if (!raw) return { ok: true, value: null };
  if (!Array.isArray(options)) return { ok: false, message: "Pilihan soal tidak tersedia." };
  const choices = options.map((option, index) => {
    const fallback = String.fromCharCode(65 + index);
    if (typeof option === "string") return { id: fallback, label: fallback };
    const item = option && typeof option === "object" ? option as Record<string, unknown> : {};
    const id = String(item.id || item.label || fallback).trim().toUpperCase();
    const label = String(item.label || item.id || fallback).trim().toUpperCase();
    return { id, label };
  });
  if (choices.some(choice => [choice.id, choice.label].some(key => key.includes(",") && key === raw))) {
    return { ok: false, message: "ID pilihan soal mengandung koma dan tidak dapat disimpan. Hubungi pengawas." };
  }
  const tokens = raw.split(",").map(part => part.trim());
  if (tokens.some(token => !token) || (!multi && tokens.length !== 1)) return { ok: false, message: "Pilihan jawaban tidak valid." };
  const values: string[] = [];
  for (const token of tokens) {
    const matches = choices.filter(choice => choice.id === token || choice.label === token);
    if (matches.length !== 1) return { ok: false, message: "Pilihan jawaban tidak sesuai dengan soal." };
    const canonical = matches[0].label;
    if (!canonical || canonical.includes(",")) return { ok: false, message: "ID pilihan soal mengandung koma dan tidak dapat disimpan. Hubungi pengawas." };
    values.push(canonical);
  }
  return { ok: true, value: [...new Set(values)].sort().join(",") };
}
