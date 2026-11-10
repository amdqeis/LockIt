type CsvAttempt = {
  exam: {
    title: string; className: string | null; subjectName: string | null; subjectId: string | null;
    academicYear: string | null; semester: string | null;
    classroom: { gradeLevel: { id: string; name: string } } | null;
    subjectFolder: { gradeLevel: { id: string; name: string } | null } | null;
  };
  student: { name: string; nisn: string; pendingManualCount: number; finalScore: number; violationCount: number; submittedAt: Date | null };
};

export const resultsHeader = ["Nama", "NISN", "Ujian", "Kelas", "Mata pelajaran", "Tahun ajaran", "Semester", "Nilai", "Status penilaian", "Pelanggaran", "Waktu selesai"];

export function groupedResultRows(attempts: CsvAttempt[]): unknown[][] {
  const rows: unknown[][] = [];
  const sorted = [...attempts].sort((a, b) => {
    const values = (item: CsvAttempt) => {
      const grade = item.exam.classroom?.gradeLevel || item.exam.subjectFolder?.gradeLevel;
      return [grade?.name || "Perlu dipetakan", grade?.id || "", item.exam.subjectName || "Perlu dipetakan", item.exam.subjectId || "", item.exam.className || "", item.exam.title, item.student.name, item.student.nisn];
    };
    const left = values(a), right = values(b);
    for (let i = 0; i < left.length; i++) {
      const comparison = left[i].localeCompare(right[i], "id", { numeric: true, sensitivity: "base" });
      if (comparison) return comparison;
    }
    return 0;
  });
  let previous = "";
  for (const { exam, student } of sorted) {
    const grade = exam.classroom?.gradeLevel || exam.subjectFolder?.gradeLevel;
    const key = JSON.stringify([grade?.id || null, exam.subjectId || exam.subjectName || null]);
    if (key !== previous) {
      if (rows.length) rows.push([]);
      rows.push(["Tingkat", grade?.name || "Perlu dipetakan"], ["Mata pelajaran", exam.subjectName || "Perlu dipetakan"], resultsHeader);
      previous = key;
    }
    rows.push([student.name, student.nisn, exam.title, exam.className, exam.subjectName, exam.academicYear, exam.semester, student.pendingManualCount ? "" : student.finalScore, student.pendingManualCount ? "Menunggu penilaian" : "Final", student.violationCount, student.submittedAt?.toISOString()]);
  }
  return rows.length ? rows : [resultsHeader];
}

export function serializeCsv(rows: unknown[][]): string {
  const cell = (value: unknown) => {
    const text = String(value ?? "");
    return `"${(/^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
  };
  return `\uFEFF${rows.map(row => row.map(cell).join(",")).join("\r\n")}`;
}
