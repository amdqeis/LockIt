export interface AcademicPeriod {
  academicYear: string;
  semester: "ganjil" | "genap";
}

/**
 * Menghitung tahun ajaran dan semester aktif berdasarkan kalender akademik Indonesia.
 * Bulan 7-12 (Juli - Desember): ${year}/${year + 1}, semester ganjil.
 * Bulan 1-6 (Januari - Juni): ${year - 1}/${year}, semester genap.
 */
export function getCurrentAcademicPeriod(now: Date = new Date()): AcademicPeriod {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  if (month >= 7) {
    return {
      academicYear: `${year}/${year + 1}`,
      semester: "ganjil",
    };
  }

  return {
    academicYear: `${year - 1}/${year}`,
    semester: "genap",
  };
}

