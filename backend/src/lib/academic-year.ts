export interface AcademicPeriod {
  academicYear: string;
  semester: "ganjil" | "genap";
}

/**
 * Returns the current academic year and semester based on the given date.
 * If month (1-indexed) >= 7 (July - December):
 *   academicYear = `${year}/${year + 1}`, semester = 'ganjil'
 * If month 1 - 6 (January - June):
 *   academicYear = `${year - 1}/${year}`, semester = 'genap'
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
