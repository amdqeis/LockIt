import {
  QuestionBank,
  BankQuestion,
  BankQuestionOption,
  QuestionType,
  DifficultyLevel,
  QuestionBankStatus,
} from "./questionBank";

export const MAX_XML_FILE_SIZE = 2 * 1024 * 1024; // 2MB
export const MAX_IMPORT_QUESTIONS = 300;

export interface ParsedXmlBank {
  title: string;
  subject: string;
  description?: string | null;
  difficulty?: DifficultyLevel;
  status?: QuestionBankStatus;
  tags?: string[];
  questions: Array<Omit<BankQuestion, "id" | "bankId" | "createdAt" | "updatedAt">>;
}

export interface ParsedXmlResult {
  success: boolean;
  error?: string;
  banks: ParsedXmlBank[];
  directQuestions: Array<Omit<BankQuestion, "id" | "bankId" | "createdAt" | "updatedAt">>;
  totalQuestionsCount: number;
  validationWarnings: string[];
}

/**
 * Escape karakter khusus dalam atribut XML agar tidak merusak struktur XML
 */
export function escapeXmlAttr(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Membungkus teks ke dalam CDATA dengan escape jika terdapat urutan ']]>'
 */
function wrapCData(text: string): string {
  if (!text) return "";
  const sanitized = text.replace(/]]>/g, "]]]]><![CDATA[>");
  return `<![CDATA[${sanitized}]]>`;
}

/**
 * Membersihkan URL gambar untuk mencegah injeksi script / skema berbahaya
 * dan membatasi ukuran data URI agar tidak memenuhi penyimpanan lokal
 */
function sanitizeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // Validasi URL HTTP/HTTPS standar (maks 2048 karakter)
  if (/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(trimmed) && trimmed.length <= 2048) {
    return trimmed;
  }

  // Validasi Data URI khusus format gambar standar yang aman (maks 1MB)
  if (
    /^data:image\/(?:png|jpeg|jpg|webp|gif|svg\+xml)(?:;charset=[^;,]+)?(?:;base64)?,/i.test(trimmed) &&
    trimmed.length <= 1024 * 1024
  ) {
    return trimmed;
  }

  return null;
}

/**
 * Format butir soal tunggal ke string XML
 */
function formatQuestionXml(
  q: BankQuestion | Omit<BankQuestion, "id" | "bankId" | "createdAt" | "updatedAt">,
  indent = "      "
): string {
  const i2 = indent + "  ";
  const i3 = indent + "    ";

  let optionsXml = `${i2}<options>\n`;
  (q.options || []).forEach(opt => {
    optionsXml += `${i3}<option id="${escapeXmlAttr(opt.id)}" label="${escapeXmlAttr(opt.label)}">\n`;
    optionsXml += `${i3}  <text>${wrapCData(opt.text || "")}</text>\n`;
    if (opt.imageUrl) {
      optionsXml += `${i3}  <imageUrl>${wrapCData(opt.imageUrl)}</imageUrl>\n`;
    }
    optionsXml += `${i3}</option>\n`;
  });
  optionsXml += `${i2}</options>`;

  let correctAnsXml = "";
  if (q.type === "multi_select" && q.correctAnswers && q.correctAnswers.length > 0) {
    correctAnsXml =
      `${i2}<correctAnswers>\n` +
      q.correctAnswers.map(ans => `${i3}<answer>${escapeXmlAttr(ans.toLowerCase())}</answer>`).join("\n") +
      `\n${i2}</correctAnswers>`;
  } else {
    correctAnsXml = `${i2}<correctAnswer>${escapeXmlAttr((q.correctAnswer || "a").toLowerCase())}</correctAnswer>`;
  }

  return [
    `${indent}<question>`,
    `${i2}<type>${escapeXmlAttr(q.type)}</type>`,
    `${i2}<orderIndex>${q.orderIndex || 1}</orderIndex>`,
    `${i2}<points>${q.points || 10}</points>`,
    `${i2}<questionText>${wrapCData(q.questionText || "")}</questionText>`,
    q.imageUrl ? `${i2}<imageUrl>${wrapCData(q.imageUrl)}</imageUrl>` : null,
    q.imageAlt ? `${i2}<imageAlt>${wrapCData(q.imageAlt)}</imageAlt>` : null,
    q.hint ? `${i2}<hint>${wrapCData(q.hint)}</hint>` : null,
    correctAnsXml,
    optionsXml,
    `${indent}</question>`,
  ].filter(Boolean).join("\n");
}

/**
 * Format satu folder bank soal dan butir-butir soalnya ke string XML
 */
export function exportBankToXml(bank: QuestionBank, questions: BankQuestion[]): string {
  const now = new Date().toISOString();
  const bankQuestions = questions.filter(q => q.bankId === bank.id);

  let tagsXml = "";
  if (bank.tags && bank.tags.length > 0) {
    tagsXml =
      "      <tags>\n" +
      bank.tags.map(t => `        <tag>${wrapCData(t)}</tag>`).join("\n") +
      "\n      </tags>\n";
  }

  const questionsXml = bankQuestions.map(q => formatQuestionXml(q, "        ")).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<questionBankExport version="1.0" exportedAt="${now}" source="EduQuas">
  <banks>
    <bank id="${escapeXmlAttr(bank.id)}">
      <title>${wrapCData(bank.title)}</title>
      <subject>${wrapCData(bank.subject)}</subject>
      <description>${wrapCData(bank.description || "")}</description>
      <difficulty>${escapeXmlAttr(bank.difficulty || "medium")}</difficulty>
      <status>${escapeXmlAttr(bank.status || "active")}</status>
${tagsXml}      <questions>
${questionsXml}
      </questions>
    </bank>
  </banks>
</questionBankExport>`;
}

/**
 * Format seluruh folder bank soal dan seluruh soalnya ke dalam satu berkas XML gabungan
 */
export function exportAllBanksToXml(banks: QuestionBank[], questions: BankQuestion[]): string {
  const now = new Date().toISOString();

  const banksXml = banks
    .map(bank => {
      const bankQuestions = questions.filter(q => q.bankId === bank.id);
      let tagsXml = "";
      if (bank.tags && bank.tags.length > 0) {
        tagsXml =
          "      <tags>\n" +
          bank.tags.map(t => `        <tag>${wrapCData(t)}</tag>`).join("\n") +
          "\n      </tags>\n";
      }

      const questionsXml = bankQuestions.map(q => formatQuestionXml(q, "        ")).join("\n");

      return `    <bank id="${escapeXmlAttr(bank.id)}">
      <title>${wrapCData(bank.title)}</title>
      <subject>${wrapCData(bank.subject)}</subject>
      <description>${wrapCData(bank.description || "")}</description>
      <difficulty>${escapeXmlAttr(bank.difficulty || "medium")}</difficulty>
      <status>${escapeXmlAttr(bank.status || "active")}</status>
${tagsXml}      <questions>
${questionsXml}
      </questions>
    </bank>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<questionBankExport version="1.0" exportedAt="${now}" source="EduQuas">
  <banks>
${banksXml}
  </banks>
</questionBankExport>`;
}

/**
 * Format daftar soal tertentu (tanpa metadata bank luar) ke XML
 */
export function exportQuestionsToXml(questions: BankQuestion[], title = "Kumpulan Soal"): string {
  const now = new Date().toISOString();
  const questionsXml = questions.map(q => formatQuestionXml(q, "    ")).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<questionBankExport version="1.0" exportedAt="${now}" source="EduQuas">
  <title>${wrapCData(title)}</title>
  <questions>
${questionsXml}
  </questions>
</questionBankExport>`;
}

/**
 * Mengunduh string XML sebagai berkas di peramban pengguna
 */
export function downloadXmlFile(xmlContent: string, filename: string): void {
  if (typeof window === "undefined") return;

  // Sertakan UTF-8 BOM agar terbaca sempurna di berbagai aplikasi (Excel/Notepad/dsb)
  const blob = new Blob(["\ufeff" + xmlContent], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xml") ? filename : `${filename}.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Contoh Template Berkas XML Siap Pakai yang bisa diunduh oleh guru sebagai panduan
 */
export function getSampleXmlTemplate(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- 
  =======================================================================
  TEMPLATE BANK SOAL XML - EduQuas Exam Platform
  =======================================================================
  Panduan Pengisian:
  - Tipe soal (<type>): 'single_choice' (Pilihan Ganda), 'multi_select' (Multi-Pilih), atau 'latex' (Matematika KaTeX).
  - Untuk teks dengan karakter khusus atau rumus, gunakan tag CDATA seperti: <![CDATA[Teks disini]]>
  - Untuk soal rumus matematika, gunakan notasi KaTeX $...$ untuk inline atau $$...$$ untuk baris baru.
  - Untuk soal multi_select, cantumkan semua kunci jawaban dalam tag <correctAnswers><answer>a</answer>...</correctAnswers>.
  =======================================================================
-->
<questionBankExport version="1.0" source="EduQuas">
  <banks>
    <bank>
      <title><![CDATA[Contoh Bank Soal Matematika & Teknologi]]></title>
      <subject><![CDATA[Ilmu Pengetahuan]]></subject>
      <description><![CDATA[Berkas contoh template impor soal untuk ujian online.]]></description>
      <difficulty>medium</difficulty>
      <status>active</status>
      <tags>
        <tag><![CDATA[Matematika]]></tag>
        <tag><![CDATA[Informatika]]></tag>
        <tag><![CDATA[Sample]]></tag>
      </tags>
      <questions>
        
        <!-- Contoh Soal 1: Pilihan Ganda Biasa (single_choice) -->
        <question>
          <type>single_choice</type>
          <orderIndex>1</orderIndex>
          <points>10</points>
          <questionText><![CDATA[Protokol jaringan yang bertugas menerjemahkan nama domain (seperti google.com) menjadi alamat IP adalah...]]></questionText>
          <hint><![CDATA[Singkatan dari Domain Name System]]></hint>
          <correctAnswer>b</correctAnswer>
          <options>
            <option id="a" label="A"><text><![CDATA[DHCP]]></text></option>
            <option id="b" label="B"><text><![CDATA[DNS]]></text></option>
            <option id="c" label="C"><text><![CDATA[HTTP]]></text></option>
            <option id="d" label="D"><text><![CDATA[FTP]]></text></option>
          </options>
        </question>

        <!-- Contoh Soal 2: Pilihan Ganda Kompleks / Multi-Pilih (multi_select) -->
        <question>
          <type>multi_select</type>
          <orderIndex>2</orderIndex>
          <points>15</points>
          <questionText><![CDATA[Manakah dari pilihan di bawah ini yang merupakan komponen perangkat lunak (software) sistem operasi? (Pilih semua yang benar)]]></questionText>
          <hint><![CDATA[Pilih lebih dari satu opsi]]></hint>
          <correctAnswers>
            <answer>a</answer>
            <answer>b</answer>
            <answer>d</answer>
          </correctAnswers>
          <options>
            <option id="a" label="A"><text><![CDATA[Kernel]]></text></option>
            <option id="b" label="B"><text><![CDATA[Device Driver]]></text></option>
            <option id="c" label="C"><text><![CDATA[Random Access Memory (RAM)]]></text></option>
            <option id="d" label="D"><text><![CDATA[File System]]></text></option>
          </options>
        </question>

        <!-- Contoh Soal 3: Matematika Rumus KaTeX (latex) -->
        <question>
          <type>latex</type>
          <orderIndex>3</orderIndex>
          <points>20</points>
          <questionText><![CDATA[Akar-akar dari persamaan kuadrat $ax^2 + bx + c = 0$ dapat dicari menggunakan rumus kuadratis (rumus ABC). Manakah rumus yang tepat?]]></questionText>
          <hint><![CDATA[Perhatikan tanda $\pm$ dan pembagian oleh $2a$]]></hint>
          <correctAnswer>a</correctAnswer>
          <options>
            <option id="a" label="A"><text><![CDATA[$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$]]></text></option>
            <option id="b" label="B"><text><![CDATA[$x = \\frac{b \\pm \\sqrt{b^2 - 4ac}}{2a}$]]></text></option>
            <option id="c" label="C"><text><![CDATA[$x = \\frac{-b \\pm \\sqrt{b^2 + 4ac}}{2a}$]]></text></option>
            <option id="d" label="D"><text><![CDATA[$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{a}$]]></text></option>
          </options>
        </question>

        <!-- Contoh Soal 4: Soal Bergambar (image) -->
        <question>
          <type>single_choice</type>
          <orderIndex>4</orderIndex>
          <points>15</points>
          <questionText><![CDATA[Berdasarkan diagram alir (flowchart) di atas, simbol belah ketupat (diamond) melambangkan proses...]]></questionText>
          <imageUrl><![CDATA[https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80]]></imageUrl>
          <imageAlt><![CDATA[Simbol Flowchart Algoritma]]></imageAlt>
          <hint><![CDATA[Simbol percabangan kondisi Ya atau Tidak]]></hint>
          <correctAnswer>c</correctAnswer>
          <options>
            <option id="a" label="A"><text><![CDATA[Awal atau akhir program (Terminator)]]></text></option>
            <option id="b" label="B"><text><![CDATA[Operasi perhitungan matematis]]></text></option>
            <option id="c" label="C"><text><![CDATA[Pengambilan keputusan (Decision/Kondisi)]]></text></option>
            <option id="d" label="D"><text><![CDATA[Input atau output data pengguna]]></text></option>
          </options>
        </question>

      </questions>
    </bank>
  </banks>
</questionBankExport>`;
}

/**
 * Parser & Validator XML: Mengubah string XML menjadi daftar soal & bank terstruktur
 * Dilengkapi pengamanan ketat terhadap ancaman XXE, Billion Laughs, dan skrip berbahaya.
 */
export function parseXmlToQuestions(xmlString: string): ParsedXmlResult {
  const result: ParsedXmlResult = {
    success: false,
    banks: [],
    directQuestions: [],
    totalQuestionsCount: 0,
    validationWarnings: [],
  };

  if (!xmlString || typeof xmlString !== "string" || !xmlString.trim()) {
    result.error = "Teks XML kosong. Silakan unggah berkas atau tempel kode XML.";
    return result;
  }

  // 1. Batas Ukuran (2MB) untuk mencegah memory exhaustion dan kompatibilitas LocalStorage
  if (xmlString.length > MAX_XML_FILE_SIZE) {
    result.error = "Ukuran berkas XML melebihi batas maksimal 2MB demi keamanan dan performa.";
    return result;
  }

  // 2. Proteksi XXE & Billion Laughs: Tolak deklarasi DOCTYPE atau ENTITY eksternal
  if (/<!DOCTYPE/i.test(xmlString) || /<!ENTITY/i.test(xmlString)) {
    result.error = "Berkas XML ditolak: Mengandung deklarasi DOCTYPE atau ENTITY eksternal yang dilarang demi keamanan sistem.";
    return result;
  }

  // 3. Parsing menggunakan DOMParser bawaan peramban
  let doc: Document;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(xmlString, "text/xml");
  } catch (err: any) {
    result.error = `Gagal memproses XML: ${err?.message || "Kesalahan parser"}`;
    return result;
  }

  // Periksa apakah ada parsererror
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    const errorText = parserError.textContent || "Format XML tidak valid.";
    result.error = `Sintaks XML tidak valid: ${errorText.slice(0, 150)}...`;
    return result;
  }

  // Helper untuk membaca nilai teks dari elemen
  const getText = (parent: Element, selector: string): string => {
    const el = parent.querySelector(selector);
    return el ? (el.textContent || "").trim() : "";
  };

  // Helper untuk mem-parsing satu elemen <question>
  const parseSingleQuestion = (
    qEl: Element,
    idx: number
  ): Omit<BankQuestion, "id" | "bankId" | "createdAt" | "updatedAt"> | null => {
    const rawQText =
      getText(qEl, ":scope > questionText") ||
      getText(qEl, "questionText") ||
      getText(qEl, ":scope > text") ||
      getText(qEl, "questiontext > text");

    const questionText = rawQText.slice(0, 5000);
    if (!questionText) {
      result.validationWarnings.push(`Butir soal #${idx + 1} dilewati karena teks soal kosong.`);
      return null;
    }

    // Tipe Soal
    let rawType = getText(qEl, "type").toLowerCase();
    let type: QuestionType = "single_choice";
    if (rawType === "multi_select" || rawType === "multiselect" || rawType === "multiple") {
      type = "multi_select";
    } else if (rawType === "latex" || rawType === "math" || questionText.includes("$")) {
      type = "latex";
    }

    // Poin
    const rawPoints = parseInt(getText(qEl, "points") || getText(qEl, "defaultmark") || "10", 10);
    const points = isNaN(rawPoints) || rawPoints <= 0 ? 10 : Math.min(1000, rawPoints);

    // Lampiran Gambar & Hint
    const imageUrl = sanitizeImageUrl(getText(qEl, "imageUrl") || getText(qEl, "image"));
    const imageAlt = (getText(qEl, "imageAlt") || null)?.slice(0, 300) || null;
    const hint = (getText(qEl, "hint") || getText(qEl, "generalfeedback > text") || null)?.slice(0, 1000) || null;

    // Pilihan Jawaban:
    // PENTING: Gunakan 'options > option' terlebih dahulu agar TIDAK mencocokkan <correctAnswers><answer>
    let optionEls = Array.from(qEl.querySelectorAll(":scope > options > option, options > option"));
    if (optionEls.length === 0) {
      // Fallback format tanpa wrapper <options>, namun khusus anak langsung agar tidak salah ambil <correctAnswers><answer>
      optionEls = Array.from(qEl.querySelectorAll(":scope > option, :scope > answer"));
    }

    // Batasi maksimal 8 opsi
    if (optionEls.length > 8) {
      optionEls = optionEls.slice(0, 8);
      result.validationWarnings.push(`Soal #${idx + 1}: Pilihan jawaban dibatasi maksimal 8 opsi.`);
    }

    const options: BankQuestionOption[] = [];
    const seenIds = new Set<string>();

    optionEls.forEach((optEl, optIdx) => {
      const fallbackChar = String.fromCharCode(97 + optIdx); // 'a', 'b', ...
      let id = (optEl.getAttribute("id") || fallbackChar).toLowerCase().trim();
      if (seenIds.has(id) || !id) {
        id = fallbackChar;
      }
      seenIds.add(id);

      const label = (optEl.getAttribute("label") || id.toUpperCase()).trim().slice(0, 10);
      const text = (getText(optEl, "text") || optEl.textContent?.trim() || "").slice(0, 1000);
      const optImage = sanitizeImageUrl(getText(optEl, "imageUrl"));

      options.push({
        id,
        label,
        text,
        imageUrl: optImage,
      });
    });

    // Validasi opsi minimal 2
    if (options.length < 2) {
      result.validationWarnings.push(
        `Soal #${idx + 1} ("${questionText.slice(0, 30)}...") memiliki kurang dari 2 pilihan jawaban. Opsi otomatis ditambahkan.`
      );
      while (options.length < 2) {
        const nextIdx = options.length;
        const char = String.fromCharCode(97 + nextIdx);
        options.push({ id: char, label: char.toUpperCase(), text: `Pilihan ${char.toUpperCase()}` });
      }
    }

    const validOptionIds = new Set(options.map(o => o.id));

    // Kunci Jawaban
    let correctAnswer: string | null = null;
    let correctAnswers: string[] | null = null;

    if (type === "multi_select") {
      const rawAnswersList: string[] = [];
      const answerEls = Array.from(qEl.querySelectorAll(":scope > correctAnswers > answer, correctAnswers > answer"));
      answerEls.forEach(el => {
        const txt = (el.textContent || "").trim();
        if (txt.includes(",")) {
          txt.split(",").forEach(s => {
            if (s.trim()) rawAnswersList.push(s.trim().toLowerCase());
          });
        } else if (txt) {
          rawAnswersList.push(txt.toLowerCase());
        }
      });

      // Fallback jika berupa teks koma di tag <correctAnswers> atau <correctAnswer>
      if (rawAnswersList.length === 0) {
        const rawAnswers = getText(qEl, "correctAnswers") || getText(qEl, "correctAnswer");
        if (rawAnswers) {
          rawAnswers.split(",").forEach(a => {
            const trimmed = a.trim().toLowerCase();
            if (trimmed) rawAnswersList.push(trimmed);
          });
        }
      }

      // Validasi terhadap opsi yang valid
      const filteredAnswers = rawAnswersList.filter(a => validOptionIds.has(a));
      if (filteredAnswers.length > 0) {
        correctAnswers = Array.from(new Set(filteredAnswers));
      } else {
        correctAnswers = [options[0].id];
        result.validationWarnings.push(
          `Soal multi-pilih #${idx + 1} tidak memiliki kunci jawaban valid. Opsi '${options[0].label}' dijadikan kunci default.`
        );
      }
    } else {
      // single_choice atau latex
      const rawAns = (getText(qEl, ":scope > correctAnswer") || getText(qEl, "correctAnswer") || "a").toLowerCase().trim();
      if (validOptionIds.has(rawAns)) {
        correctAnswer = rawAns;
      } else {
        correctAnswer = options[0].id;
        result.validationWarnings.push(
          `Soal #${idx + 1} memiliki kunci '${rawAns}' yang tidak cocok dengan daftar opsi. Opsi '${options[0].label}' dijadikan kunci default.`
        );
      }
    }

    return {
      orderIndex: idx + 1,
      type,
      questionText,
      imageUrl,
      imageAlt,
      options,
      correctAnswer,
      correctAnswers,
      points,
      hint,
    };
  };

  // 4. Deteksi apakah terdapat elemen <bank>
  const bankEls = Array.from(doc.querySelectorAll("banks > bank, bank"));
  if (bankEls.length > 0) {
    bankEls.forEach((bEl, bIdx) => {
      const title = (getText(bEl, ":scope > title") || getText(bEl, "title") || `Bank Soal Impor #${bIdx + 1}`).slice(0, 200);
      const subject = (getText(bEl, ":scope > subject") || getText(bEl, "subject") || "Umum").slice(0, 100);
      const description = (getText(bEl, ":scope > description") || getText(bEl, "description") || null)?.slice(0, 500) || null;

      const rawDiff = getText(bEl, ":scope > difficulty").toLowerCase();
      const difficulty: DifficultyLevel = ["easy", "medium", "hard", "mixed"].includes(rawDiff)
        ? (rawDiff as DifficultyLevel)
        : "medium";

      const rawStatus = getText(bEl, ":scope > status").toLowerCase();
      const status: QuestionBankStatus = ["active", "draft", "archived"].includes(rawStatus)
        ? (rawStatus as QuestionBankStatus)
        : "active";

      // Ambil tag khusus dari :scope > tags > tag
      const tagContainer = bEl.querySelector(":scope > tags");
      const tagEls = tagContainer ? Array.from(tagContainer.querySelectorAll("tag")) : [];
      const tags = tagEls.map(t => (t.textContent || "").trim().slice(0, 50)).filter(Boolean);

      const qEls = Array.from(bEl.querySelectorAll(":scope > questions > question, questions > question"));
      const parsedQuestions: Array<Omit<BankQuestion, "id" | "bankId" | "createdAt" | "updatedAt">> = [];

      qEls.forEach((qEl, qIdx) => {
        if (result.totalQuestionsCount + parsedQuestions.length >= MAX_IMPORT_QUESTIONS) {
          return;
        }
        const q = parseSingleQuestion(qEl, qIdx);
        if (q) parsedQuestions.push(q);
      });

      result.banks.push({
        title,
        subject,
        description,
        difficulty,
        status,
        tags,
        questions: parsedQuestions,
      });

      result.totalQuestionsCount += parsedQuestions.length;
    });
  }

  // 5. Cek apakah ada elemen <question> langsung (tanpa bungkus <bank>)
  const directQEls = Array.from(doc.querySelectorAll(":root > questions > question, :root > question"));
  if (directQEls.length > 0 && result.banks.length === 0) {
    directQEls.forEach((qEl, qIdx) => {
      if (result.totalQuestionsCount >= MAX_IMPORT_QUESTIONS) {
        return;
      }
      const q = parseSingleQuestion(qEl, qIdx);
      if (q) {
        result.directQuestions.push(q);
        result.totalQuestionsCount += 1;
      }
    });
  }

  if (result.totalQuestionsCount >= MAX_IMPORT_QUESTIONS) {
    result.validationWarnings.push(
      `Batas maksimal ${MAX_IMPORT_QUESTIONS} soal per proses impor tercapai. Butir soal selebihnya dilewati demi performa peramban.`
    );
  }

  // Izinkan hasil jika ada bank (meskipun kosong) atau ada soal
  if (result.totalQuestionsCount === 0 && result.banks.length === 0) {
    result.error = "Tidak ada butir soal atau struktur bank soal yang valid ditemukan di dalam berkas XML ini.";
    return result;
  }

  result.success = true;
  return result;
}
