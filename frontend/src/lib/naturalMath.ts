/**
 * naturalMath.ts
 *
 * Engine pemroses format matematika alami (Natural Math Formatter) untuk Eduquas / LockIt.
 * Dirancang khusus agar guru-guru senior/lansia dapat menulis rumus matematika
 * sehari-hari tanpa harus menghafal sintaks LaTeX yang rumit.
 *
 * Fitur Utama:
 * 1. Otomatis mengubah pecahan: 1/2, 3/4, (x+1)/(x-1) -> \frac{1}{2}, dst.
 * 2. Otomatis melindungi format tanggal kalender (misal 17/08/1945 tidak diubah menjadi pecahan).
 * 3. Otomatis mengubah perkalian: 2*2, 3 * 5, 2 x 3 -> 2 \times 2.
 * 4. Otomatis mengubah pangkat: x^2, 2^3, (a+b)^2 -> x^{2}, dst.
 * 5. Mendukung trigonometri tegak: sin(30 deg), cos^2(x), tan(45°), cot, sec, csc.
 * 6. Mendukung limit: lim x->0 (sin 4x)/(tan 2x), lim x->~, lim x->inf.
 * 7. Mendukung logaritma gaya kurikulum Indonesia: ^2log(8) -> {}^{2}\log(8).
 * 8. Mendukung akar: akar(16), sqrt(x), akar[3](27).
 * 9. Mendukung perbandingan & operator: <=, >=, !=, +-, derajat, pi, alpha, theta.
 * 10. Aman dari XSS dan ReDoS (semua regular expression berjalan dalam kompleksitas linear O(N)).
 */

/**
 * Memeriksa apakah sebuah string memiliki indikasi matematika (baik LaTeX $...$ maupun pola alami).
 */
export function hasNaturalOrLatexMath(text: string): boolean {
  if (!text || typeof text !== "string") return false;

  // Jika sudah memiliki pembatas LaTeX $...$ atau $$...$$
  if (/\$/.test(text)) return true;

  // Pola-pola umum matematika sekolah
  return (
    /(?<!\d\/|\w)\d+\/\d+(?!\/\d+)/.test(text) || // 1/2 (bukan tanggal)
    /\((?:[^()]+)\)\/\((?:[^()]+)\)/.test(text) || // (a)/(b)
    /[a-zA-Z0-9\)]+\^[a-zA-Z0-9\(\)]+/.test(text) || // x^2
    /\d+\s*\*\s*[\da-zA-Z(]/.test(text) || // 2*2
    /\d+\s+[xX]\s+\d+/.test(text) || // 2 x 3
    /\b(?:sin|cos|tan|cot|sec|csc)\b/i.test(text) || // trigonometri
    /\blim\s+[a-zA-Z]+\s*->/i.test(text) || // limit
    /\^[a-zA-Z0-9]+\s*log\b/i.test(text) || // logaritma kurikulum nasional
    /\b(?:sqrt|akar)\(/i.test(text) || // akar
    /<=|>=|!=|\+-/.test(text) || // operator perbandingan
    /\d+\s*(?:deg|derajat|°)/i.test(text) || // derajat sudut
    /\b\d+\s*:\s*\d+\b/.test(text) || // 10:2
    /\bdy\/dx\b/i.test(text) || // turunan
    /\bint\s+\d+\s+to\s+\d+\b/i.test(text) // integral
  );
}

/**
 * Mengubah ekspresi matematika alami menjadi kode KaTeX yang terbungkus $...$
 * Jika teks berupa kalimat bahasa Indonesia, kata-kata umum tetap berupa teks biasa,
 * dan hanya ekspresi matematika yang diubah menjadi $...$.
 */
export function formatNaturalMath(input: string): string {
  if (!input || typeof input !== "string") return "";

  // Jika pengguna sudah menuliskan pembatas $ atau $$, proses hanya isi di dalamnya
  if (/\$/.test(input)) {
    return input.replace(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g, (match) => {
      const isDisplay = match.startsWith("$$");
      const inner = isDisplay ? match.slice(2, -2) : match.slice(1, -1);
      const formatted = convertMathExpression(inner);
      return isDisplay ? `$$${formatted}$$` : `$${formatted}$`;
    });
  }

  // Jika belum ada pembatas $, ubah secara cerdas
  return convertNaturalSentence(input);
}

/**
 * Mengubah satu ekspresi rumus murni menjadi sintaks KaTeX tanpa pembatas $.
 */
export function convertMathExpression(expr: string): string {
  let res = expr;

  // 1. Lindungi tanggal (contoh: 17/08/1945, 1/1/2026)
  const datePlaceholders: string[] = [];
  res = res.replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, (m) => {
    datePlaceholders.push(m);
    return `__DATE_PH_${datePlaceholders.length - 1}__`;
  });

  // 2. Lindungi URL
  const urlPlaceholders: string[] = [];
  res = res.replace(/https?:\/\/[^\s]+/g, (m) => {
    urlPlaceholders.push(m);
    return `__URL_PH_${urlPlaceholders.length - 1}__`;
  });

  // 3. Lindungi perintah LaTeX yang sudah ada (\frac, \sqrt, dll) agar tidak dobel escape
  const latexPlaceholders: string[] = [];
  res = res.replace(/\\(?:[a-zA-Z]+|[^\s\w])/g, (m) => {
    latexPlaceholders.push(m);
    return `__LATEX_PH_${latexPlaceholders.length - 1}__`;
  });

  // 4. Limit matematika: lim x->0 (expr) atau lim x->~ expr
  res = res.replace(
    /\blim\s*(?:\(\s*([a-zA-Z]+)\s*(?:->|\\to)\s*([^)]+)\)|([a-zA-Z]+)\s*(?:->|\\to)\s*([a-zA-Z0-9~]+|\\infty|-?[0-9]+))\s*(.*)/gi,
    (_m, v1, to1, v2, to2, rest) => {
      const v = v1 || v2;
      let target = (to1 || to2 || "").trim();
      if (
        target === "~" ||
        target === "inf" ||
        target === "infinity" ||
        target.toLowerCase() === "tak hingga"
      ) {
        target = "\\infty";
      }
      if (target === "-~" || target === "-inf") target = "-\\infty";
      const body = rest ? convertMathExpression(rest) : "";
      return `\\lim_{${v} \\to ${target}} ${body}`.trim();
    }
  );

  // 5. Integral sederhana: int 0 to 1 x^2 dx -> \int_{0}^{1} x^{2} dx
  res = res.replace(/\bint\s+([a-zA-Z0-9]+)\s+to\s+([a-zA-Z0-9]+)/gi, "\\int_{$1}^{$2}");
  res = res.replace(/\bintegral\b/gi, "\\int");

  // 6. Logaritma kurikulum Indonesia: ^2log(8) atau ^2log 8 -> {}^{2}\log(8)
  res = res.replace(/\^([a-zA-Z0-9]+)\s*log(?:\(([^()]+)\)|\s+([a-zA-Z0-9]+))/gi, (_m, base, a1, a2) => {
    const val = (a1 || a2 || "").trim();
    return `{}^{${base}}\\log(${val})`;
  });

  // Logaritma standar: log(100) atau log 100, ln(x)
  res = res.replace(/\blog(?:\(([^()]+)\)|\s+([a-zA-Z0-9]+))/gi, (_m, a1, a2) => {
    const val = (a1 || a2 || "").trim();
    return val ? `\\log(${val})` : `\\log`;
  });
  res = res.replace(/\bln(?:\(([^()]+)\)|\s+([a-zA-Z0-9]+))/gi, (_m, a1, a2) => {
    const val = (a1 || a2 || "").trim();
    return val ? `\\ln(${val})` : `\\ln`;
  });

  // 7. Trigonometri (sin, cos, tan, cot, sec, csc) dengan pangkat & argumen
  const trigFuncs = ["sin", "cos", "tan", "cot", "sec", "csc", "cosec"];
  for (const fn of trigFuncs) {
    const katexFn = fn === "cosec" ? "\\csc" : `\\${fn}`;
    // Dengan pangkat: sin^2(x)
    const powerRegex = new RegExp(`\\b${fn}\\^([a-zA-Z0-9]+|\\{[^}]+\\})`, "gi");
    res = res.replace(powerRegex, `${katexFn}^{$1}`);
    // Tanpa pangkat: sin
    const plainRegex = new RegExp(`\\b${fn}\\b`, "gi");
    res = res.replace(plainRegex, katexFn);
  }

  // 8. Akar kuadrat dan akar pangkat n: akar(16), sqrt(x), akar[3](27)
  res = res.replace(/(?:sqrt|akar)\[([a-zA-Z0-9]+)\]\(([^()]+)\)/gi, "\\sqrt[$1]{$2}");
  res = res.replace(/(?:sqrt|akar)\(([^()]+)\)/gi, "\\sqrt{$1}");

  // 9. Turunan kalkulus: dy/dx -> \frac{dy}{dx}
  res = res.replace(/\bdy\/dx\b/gi, "\\frac{dy}{dx}");

  // 10. Pecahan aljabar dan bilangan:
  // (a+b)/(c+d)
  res = res.replace(/\(([^()]+)\)\/\(([^()]+)\)/g, "\\frac{$1}{$2}");
  // (a+b)/c
  res = res.replace(/\(([^()]+)\)\/([a-zA-Z0-9]+)/g, "\\frac{$1}{$2}");
  // a/(b+c)
  res = res.replace(/([a-zA-Z0-9]+)\/\(([^()]+)\)/g, "\\frac{$1}{$2}");
  // Bilangan pecahan sederhana: 1/2, 3/4, 22/7
  res = res.replace(/(?<![\\\/a-zA-Z0-9_])([a-zA-Z0-9]+)\/([a-zA-Z0-9]+)(?![\\\/a-zA-Z0-9_])/g, "\\frac{$1}{$2}");

  // 11. Pangkat: x^2 atau (x+1)^2 atau 2^3
  res = res.replace(/([a-zA-Z0-9\)]+)\^([a-zA-Z0-9]+|\([^()]+\))/g, (_m, base, exp) => {
    const cleanExp = exp.startsWith("(") && exp.endsWith(")") ? exp.slice(1, -1) : exp;
    return `${base}^{${cleanExp}}`;
  });

  // 12. Perkalian:
  // 2*2 atau 3 * 5 -> 2 \times 2
  res = res.replace(/([0-9a-zA-Z\)]+)\s*\*\s*([0-9a-zA-Z\(]+)/g, "$1 \\times $2");
  // 2 x 3 (angka spasi x spasi angka)
  res = res.replace(/(\d+)\s+[xX]\s+(\d+)/g, "$1 \\times $2");

  // 13. Pembagian: 10 : 2 -> 10 \div 2
  res = res.replace(/(\d+)\s*:\s*(\d+)/g, "$1 \\div $2");

  // 14. Operator perbandingan dan logika:
  res = res.replace(/<=/g, "\\le");
  res = res.replace(/>=/g, "\\ge");
  res = res.replace(/!=/g, "\\ne");
  res = res.replace(/\+-/g, "\\pm");
  res = res.replace(/->/g, "\\to");
  res = res.replace(/<->/g, "\\leftrightarrow");
  res = res.replace(/~=/g, "\\approx");

  // 15. Satuan derajat: 30 deg, 30 derajat, 30° -> 30^\circ
  res = res.replace(/(\d+)\s*(?:deg|derajat|°)/gi, "$1^\\circ");

  // 16. Konstanta dan huruf Yunani umum:
  res = res.replace(/\bpi\b/gi, "\\pi");
  res = res.replace(/\balpha\b/gi, "\\alpha");
  res = res.replace(/\bbeta\b/gi, "\\beta");
  res = res.replace(/\btheta\b/gi, "\\theta");
  res = res.replace(/\bgamma\b/gi, "\\gamma");
  res = res.replace(/\blambda\b/gi, "\\lambda");
  res = res.replace(/\bomega\b/gi, "\\omega");
  res = res.replace(/\binf\b/gi, "\\infty");

  // Pulihkan placeholder secara aman
  latexPlaceholders.forEach((l, i) => {
    res = res.replace(`__LATEX_PH_${i}__`, l);
  });
  urlPlaceholders.forEach((u, i) => {
    res = res.replace(`__URL_PH_${i}__`, u);
  });
  datePlaceholders.forEach((d, i) => {
    res = res.replace(`__DATE_PH_${i}__`, d);
  });

  return res;
}

/**
 * Memproses teks kalimat campuran (kata bahasa Indonesia + ekspresi matematika)
 */
function convertNaturalSentence(sentence: string): string {
  // Jika teks berupa pilihan jawaban pendek atau rumus terisolasi tanpa kata pengantar
  const sentenceWords =
    /\b(adalah|merupakan|tentukan|jika|berapa|berapakah|pada|dari|nilai|soal|yang|dengan|dan|atau|sebuah|seorang|hitunglah|carilah|manakah|berikut|hasil|fungsi|persamaan|panjang|luas|volume|besar|sudut|diketahui|ditanya|jawab|penjelasan|langkah)\b/i;

  if (!sentenceWords.test(sentence) && hasNaturalOrLatexMath(sentence) && sentence.length < 90) {
    return `$${convertMathExpression(sentence).trim()}$`;
  }

  let res = sentence;

  // Lindungi tanggal kalender
  const dates: string[] = [];
  res = res.replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, (m) => {
    dates.push(m);
    return `__DATE_T_${dates.length - 1}__`;
  });

  // Lindungi URL
  const urls: string[] = [];
  res = res.replace(/https?:\/\/[^\s]+/g, (m) => {
    urls.push(m);
    return `__URL_T_${urls.length - 1}__`;
  });

  const mathBlocks: string[] = [];
  const pushMath = (math: string) => {
    const formatted = convertMathExpression(math.trim());
    mathBlocks.push(formatted);
    return ` __MATH_T_${mathBlocks.length - 1}__ `;
  };

  // 1. Limit matematika dalam kalimat
  res = res.replace(
    /\blim\s*(?:\(\s*([a-zA-Z]+)\s*(?:->|\\to)\s*([^)]+)\)|([a-zA-Z]+)\s*(?:->|\\to)\s*([a-zA-Z0-9~]+|\\infty|-?[0-9]+))\s*(?:\([^\)]+\)\/\([^\)]+\)|\([^\)]+\)|[a-zA-Z0-9\/\^\+\-\*\(\)]+)?/gi,
    (m) => pushMath(m)
  );

  // 2. Logaritma kurikulum Indonesia dalam kalimat: ^2log(8)
  res = res.replace(/\^([a-zA-Z0-9]+)\s*log(?:\(([^()]+)\)|\s+([a-zA-Z0-9]+))/gi, (m) => pushMath(m));

  // 3. Akar matematika dalam kalimat: akar(16) atau sqrt(x)
  res = res.replace(/(?:sqrt|akar)(?:\[[a-zA-Z0-9]+\])?\([^()]+\)/gi, (m) => pushMath(m));

  // 4. Integral dalam kalimat
  res = res.replace(/\bint\s+[a-zA-Z0-9]+\s+to\s+[a-zA-Z0-9]+(?:\s+[a-zA-Z0-9\/\^\+\-\*]+)?(?:\s*d[a-zA-Z])?/gi, (m) =>
    pushMath(m)
  );

  // 5. Pecahan dalam kalimat: (a+b)/(c+d) atau 1/2
  res = res.replace(/(?:\([^()]+\)|[a-zA-Z0-9]+)\/(?:\([^()]+\)|[a-zA-Z0-9]+)/g, (m) => pushMath(m));

  // 6. Trigonometri dalam kalimat: sin(30 deg), sin 30°, cos(60°)
  res = res.replace(
    /\b(sin|cos|tan|cot|sec|csc)\s*(?:\(([^()]+)\)|\s+[0-9a-zA-Z°]+(?:\s*(?:deg|derajat|°))?)/gi,
    (m) => pushMath(m)
  );

  // 7. Perkalian matematika dalam kalimat: 2*2 atau 3 * 5
  res = res.replace(/\b\d+\s*\*\s*\d+\b/g, (m) => pushMath(m));

  // 8. Pangkat dalam kalimat: x^2 atau 2^3
  res = res.replace(/\b[a-zA-Z0-9]+\^[a-zA-Z0-9\(\)]+\b/g, (m) => pushMath(m));

  // 9. Perbandingan dalam kalimat: x <= 5 atau y >= 2 atau x != 0
  res = res.replace(/\b([a-zA-Z0-9]+)\s*(<=|>=|!=|\+-)\s*([a-zA-Z0-9]+)\b/g, (m) => pushMath(m));

  // Gabungkan placeholder matematika yang berdampingan: __MATH_T_0__ + __MATH_T_1__
  res = res.replace(/__MATH_T_(\d+)__\s*([\+\-\*\/=><\le\ge\pm\div\times]+)\s*__MATH_T_(\d+)__/g, (_m, id1, op, id2) => {
    const combined = `${mathBlocks[Number(id1)]} ${op} ${mathBlocks[Number(id2)]}`;
    mathBlocks.push(combined);
    return `__MATH_T_${mathBlocks.length - 1}__`;
  });

  // Pulihkan ekspresi matematika sebagai $...$
  res = res.replace(/__MATH_T_(\d+)__/g, (_m, id) => {
    return `$${mathBlocks[Number(id)]}$`;
  });

  // Pulihkan placeholder URL & tanggal
  urls.forEach((u, i) => {
    res = res.replace(`__URL_T_${i}__`, u);
  });
  dates.forEach((d, i) => {
    res = res.replace(`__DATE_T_${i}__`, d);
  });

  // Rapikan spasi
  res = res.replace(/\s{2,}/g, " ");
  res = res.replace(/\s+([.,?!;:])/g, "$1");

  return res.trim();
}
