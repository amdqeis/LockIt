"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import LatexRenderer from "./LatexRenderer";
import {
  parseXmlToQuestions,
  getSampleXmlTemplate,
  downloadXmlFile,
  ParsedXmlResult,
  MAX_XML_FILE_SIZE,
} from "@/lib/questionBankXml";
import {
  QuestionBank,
  importQuestionsToBank,
  createBankWithQuestions,
} from "@/lib/questionBank";

interface ImportXmlModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBank?: QuestionBank | null;
  allBanks: QuestionBank[];
  onSuccess: (result: { message: string; targetBankId: string }) => void;
}

export default function ImportXmlModal({
  isOpen,
  onClose,
  currentBank,
  allBanks,
  onSuccess,
}: ImportXmlModalProps) {
  const [activeTab, setActiveTab] = useState<"file" | "paste">("file");
  const [rawXml, setRawXml] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parseResult, setParseResult] = useState<ParsedXmlResult | null>(null);
  const [expandedPreview, setExpandedPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Target destination state
  // 'all_banks' | 'current' | 'new' | 'existing'
  const [targetMode, setTargetMode] = useState<"all_banks" | "current" | "new" | "existing">(
    currentBank ? "current" : "new"
  );
  const [selectedExistingBankId, setSelectedExistingBankId] = useState<string>(
    currentBank?.id || allBanks[0]?.id || ""
  );
  const [newBankTitle, setNewBankTitle] = useState("");
  const [newBankSubject, setNewBankSubject] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setRawXml("");
      setFileName(null);
      setParseResult(null);
      setErrorMsg(null);
      setExpandedPreview(false);
      setIsSubmitting(false);
      setTargetMode(currentBank ? "current" : "new");
      setSelectedExistingBankId(currentBank?.id || allBanks[0]?.id || "");
    }
  }, [isOpen, currentBank, allBanks]);

  // Debounced XML parsing when rawXml changes (300ms)
  useEffect(() => {
    if (!rawXml.trim()) {
      setParseResult(null);
      setErrorMsg(null);
      return;
    }

    const timer = setTimeout(() => {
      const result = parseXmlToQuestions(rawXml);
      if (!result.success) {
        setParseResult(null);
        setErrorMsg(result.error || "Gagal memproses berkas XML.");
      } else {
        setParseResult(result);
        setErrorMsg(null);

        // Jika terdapat lebih dari 1 folder bank di dalam XML, default ke opsi "all_banks"
        if (result.banks.length > 1) {
          setTargetMode("all_banks");
        } else if (result.banks.length === 1) {
          setNewBankTitle(result.banks[0].title);
          setNewBankSubject(result.banks[0].subject);
          if (!currentBank) setTargetMode("new");
        } else {
          setNewBankTitle(fileName ? fileName.replace(/\.xml$/i, "") : "Bank Soal Hasil Impor XML");
          setNewBankSubject("Umum");
          if (!currentBank) setTargetMode("new");
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [rawXml, fileName, currentBank]);

  // Read file contents
  const processFile = (file: File) => {
    if (!file) return;
    if (file.size > MAX_XML_FILE_SIZE) {
      setErrorMsg("Ukuran berkas melebihi batas maksimal 2MB.");
      return;
    }
    if (!file.name.endsWith(".xml") && file.type !== "text/xml" && file.type !== "application/xml") {
      setErrorMsg("Format berkas harus berupa .xml.");
      return;
    }

    setFileName(file.name);
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = (e.target?.result as string) || "";
      setRawXml(content);
    };
    reader.onerror = () => {
      setErrorMsg("Gagal membaca berkas. Silakan coba lagi.");
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset file input value agar pemilihan ulang file yang sama tetap memicu event change
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // Download sample template
  const handleDownloadSample = () => {
    downloadXmlFile(getSampleXmlTemplate(), "Template-Bank-Soal-EduQuas.xml");
  };

  // Extract all questions from parseResult (flattened)
  const allParsedQuestions = useMemo(() => {
    if (!parseResult) return [];
    if (parseResult.banks.length > 0) {
      return parseResult.banks.flatMap((b) => b.questions);
    }
    return parseResult.directQuestions;
  }, [parseResult]);

  // Statistics breakdown
  const stats = useMemo(() => {
    if (!allParsedQuestions.length) return null;
    let single = 0;
    let multi = 0;
    let latex = 0;
    let totalPoints = 0;

    allParsedQuestions.forEach((q) => {
      if (q.type === "single_choice") single++;
      else if (q.type === "multi_select") multi++;
      else if (q.type === "latex") latex++;
      totalPoints += q.points || 0;
    });

    return { total: allParsedQuestions.length, single, multi, latex, totalPoints };
  }, [allParsedQuestions]);

  // Handle final import execution
  const handleExecuteImport = () => {
    if (!parseResult || (allParsedQuestions.length === 0 && parseResult.banks.length === 0)) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (targetMode === "all_banks" && parseResult.banks.length > 0) {
        // Impor masing-masing bank secara terpisah sesuai struktur XML
        let totalImported = 0;
        let lastBankId = "";

        for (const b of parseResult.banks) {
          const res = createBankWithQuestions(
            {
              title: b.title,
              subject: b.subject,
              description: b.description || null,
              tags: b.tags || ["XML-Import"],
              difficulty: b.difficulty || "medium",
              status: b.status || "active",
              createdBy: "Guru Pengampu",
            },
            b.questions
          );
          totalImported += res.questions.length;
          lastBankId = res.bank.id;
        }

        onSuccess({
          message: `Berhasil mengimpor ${parseResult.banks.length} folder bank soal (${totalImported} butir soal)!`,
          targetBankId: lastBankId,
        });
        onClose();
        return;
      }

      if (targetMode === "current" && currentBank) {
        // Impor ke bank saat ini
        const res = importQuestionsToBank(currentBank.id, allParsedQuestions);
        onSuccess({
          message: `Berhasil mengimpor ${res.addedCount} butir soal ke folder "${currentBank.title}"!`,
          targetBankId: currentBank.id,
        });
        onClose();
      } else if (targetMode === "existing" && selectedExistingBankId) {
        // Impor ke bank pilihan lain
        const targetB = allBanks.find((b) => b.id === selectedExistingBankId);
        const res = importQuestionsToBank(selectedExistingBankId, allParsedQuestions);
        onSuccess({
          message: `Berhasil mengimpor ${res.addedCount} butir soal ke folder "${targetB?.title || "Bank Soal"}"!`,
          targetBankId: selectedExistingBankId,
        });
        onClose();
      } else {
        // Buat satu bank baru
        const firstBankMeta = parseResult.banks[0];
        const res = createBankWithQuestions(
          {
            title: newBankTitle.trim() || firstBankMeta?.title || "Bank Soal Hasil Impor XML",
            subject: newBankSubject.trim() || firstBankMeta?.subject || "Umum",
            description: firstBankMeta?.description || "Diimpor dari berkas XML",
            tags: firstBankMeta?.tags || ["XML-Import"],
            difficulty: firstBankMeta?.difficulty || "medium",
            status: firstBankMeta?.status || "active",
            createdBy: "Guru Pengampu",
          },
          allParsedQuestions
        );
        onSuccess({
          message: `Berhasil membuat folder baru "${res.bank.title}" dengan ${res.questions.length} butir soal!`,
          targetBankId: res.bank.id,
        });
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Gagal menyimpan data butir soal ke penyimpanan lokal.");
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        className="modal modal-lg"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "800px",
          width: "100%",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: "12px",
          background: "#FFFFFF",
          boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#F8FAFC",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "24px" }}>📥</span>
            <div>
              <div style={{ fontSize: "17px", fontWeight: 700, color: "#0F172A" }}>
                Impor Soal dari Berkas XML
              </div>
              <div style={{ fontSize: "12px", color: "#64748B" }}>
                Unggah berkas XML atau tempel kode XML untuk menambahkan soal secara instan.
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "6px",
              border: "1px solid #CBD5E1",
              background: "white",
              cursor: "pointer",
              fontSize: "14px",
              color: "#64748B",
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab & Template Download Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            borderBottom: "1px solid #E2E8F0",
            background: "#FFFFFF",
          }}
        >
          <div style={{ display: "flex", gap: "4px" }}>
            <button
              type="button"
              onClick={() => setActiveTab("file")}
              style={{
                padding: "12px 16px",
                fontSize: "13px",
                fontWeight: activeTab === "file" ? 700 : 500,
                color: activeTab === "file" ? "#1B76BF" : "#64748B",
                borderBottom: `2.5px solid ${activeTab === "file" ? "#1B76BF" : "transparent"}`,
                background: "transparent",
                borderTop: "none",
                borderLeft: "none",
                borderRight: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>📁</span>
              <span>Unggah Berkas XML</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("paste")}
              style={{
                padding: "12px 16px",
                fontSize: "13px",
                fontWeight: activeTab === "paste" ? 700 : 500,
                color: activeTab === "paste" ? "#1B76BF" : "#64748B",
                borderBottom: `2.5px solid ${activeTab === "paste" ? "#1B76BF" : "transparent"}`,
                background: "transparent",
                borderTop: "none",
                borderLeft: "none",
                borderRight: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>📝</span>
              <span>Tempel Teks XML</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownloadSample}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid #CBD5E1",
              background: "#F8FAFC",
              color: "#334155",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            title="Unduh contoh template XML lengkap dengan soal pilihan ganda, multi-pilih, dan KaTeX"
          >
            <span>📄</span>
            <span>Unduh Contoh Template XML</span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "18px" }}>
          
          {/* TAB 1: FILE UPLOAD (DRAG & DROP) */}
          {activeTab === "file" && (
            <div>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragging ? "#1B76BF" : fileName ? "#10B981" : "#CBD5E1"}`,
                  borderRadius: "10px",
                  padding: "28px 20px",
                  textAlign: "center",
                  background: isDragging ? "#F0F9FF" : fileName ? "#F0FDF4" : "#F8FAFC",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xml,text/xml,application/xml"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
                <span style={{ fontSize: "36px", pointerEvents: "none" }}>
                  {fileName ? "✅" : isDragging ? "📂" : "📤"}
                </span>
                {fileName ? (
                  <div style={{ pointerEvents: "none" }}>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#065F46" }}>
                      Berkas terpilih: {fileName}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
                      Klik atau seret berkas lain untuk mengganti
                    </div>
                  </div>
                ) : (
                  <div style={{ pointerEvents: "none" }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "#1E293B" }}>
                      Seret & jatuhkan berkas <code style={{ color: "#1B76BF", background: "#E0F2FE", padding: "1px 6px", borderRadius: "4px" }}>.xml</code> ke sini, atau klik untuk memilih
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}>
                      Maksimal ukuran berkas 2MB. Format XML UTF-8.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PASTE RAW XML TEXT */}
          {activeTab === "paste" && (
            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>
                  Tempel Kode XML Soal:
                </label>
                {rawXml && (
                  <button
                    type="button"
                    onClick={() => setRawXml("")}
                    style={{ fontSize: "11px", color: "#DC2626", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                  >
                    ✕ Bersihkan Teks
                  </button>
                )}
              </div>
              <textarea
                className="form-textarea"
                rows={8}
                value={rawXml}
                onChange={(e) => {
                  setFileName(null);
                  setRawXml(e.target.value);
                }}
                placeholder='Tempelkan kode XML di sini, contoh:
<questionBankExport>
  <bank>
    <title>Kuis Matematika</title>
    <questions>
      <question>
        <type>latex</type>
        <questionText><![CDATA[Hitung $\sqrt{16}$]]></questionText>
        <correctAnswer>a</correctAnswer>
        <options>
          <option id="a"><text><![CDATA[4]]></text></option>
          <option id="b"><text><![CDATA[8]]></text></option>
        </options>
      </question>
    </questions>
  </bank>
</questionBankExport>'
                style={{
                  fontFamily: "monospace",
                  fontSize: "12px",
                  lineHeight: 1.5,
                  whiteSpace: "pre",
                  width: "100%",
                }}
              />
            </div>
          )}

          {/* ERROR ALERT BANNER */}
          {errorMsg && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                color: "#991B1B",
                fontSize: "13px",
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
              }}
            >
              <span style={{ fontSize: "16px" }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, marginBottom: "2px" }}>Kesalahan Validasi XML</div>
                <div>{errorMsg}</div>
              </div>
            </div>
          )}

          {/* PARSE SUCCESS PREVIEW & SUMMARY */}
          {parseResult && (stats || parseResult.banks.length > 0) && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              
              {/* Summary Stats Cards */}
              <div
                style={{
                  background: "#F0FDF4",
                  border: "1.5px solid #BBF7D0",
                  borderRadius: "8px",
                  padding: "14px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "18px" }}>🎉</span>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#166534" }}>
                      XML Berhasil Divalidasi: {parseResult.totalQuestionsCount} Butir Soal Terdeteksi
                      {parseResult.banks.length > 1 && ` (${parseResult.banks.length} Folder Bank Soal)`}
                    </span>
                  </div>
                  {stats && (
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#15803D" }}>
                      Total Bobot: {stats.totalPoints} Poin
                    </span>
                  )}
                </div>

                {/* Badge Breakdown */}
                {stats && (
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "3px 10px",
                        borderRadius: "12px",
                        background: "#E0F2FE",
                        color: "#0369A1",
                        border: "1px solid #BAE6FD",
                      }}
                    >
                      🔘 {stats.single} Pilihan Ganda
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "3px 10px",
                        borderRadius: "12px",
                        background: "#FEF3C7",
                        color: "#B45309",
                        border: "1px solid #FDE68A",
                      }}
                    >
                      ☑️ {stats.multi} Multi-Pilih
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "3px 10px",
                        borderRadius: "12px",
                        background: "#EDE9FE",
                        color: "#6D28D9",
                        border: "1px solid #DDD6FE",
                      }}
                    >
                      🧮 {stats.latex} KaTeX Matematika
                    </span>
                  </div>
                )}

                {/* Warnings Notice (if any) */}
                {parseResult.validationWarnings.length > 0 && (
                  <div
                    style={{
                      marginTop: "4px",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      background: "#FFFBEB",
                      border: "1px solid #FDE68A",
                      fontSize: "12px",
                      color: "#92400E",
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: "2px" }}>
                      ⚠️ {parseResult.validationWarnings.length} Catatan Penyesuaian:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: "18px", lineHeight: 1.5 }}>
                      {parseResult.validationWarnings.slice(0, 3).map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                      {parseResult.validationWarnings.length > 3 && (
                        <li>...dan {parseResult.validationWarnings.length - 3} lainnya</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              {/* Destination Selector */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "8px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <label className="form-label" style={{ fontWeight: 700, margin: 0 }}>
                  Tentukan Folder Bank Soal Tujuan:
                </label>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {/* Option Multi-Bank: JIKA XML berisi >1 folder bank */}
                  {parseResult.banks.length > 1 && (
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "13px",
                        cursor: "pointer",
                        fontWeight: targetMode === "all_banks" ? 700 : 500,
                        color: targetMode === "all_banks" ? "#1B76BF" : "#1E293B",
                      }}
                    >
                      <input
                        type="radio"
                        name="import-destination-mode"
                        checked={targetMode === "all_banks"}
                        onChange={() => setTargetMode("all_banks")}
                        style={{ accentColor: "#1B76BF" }}
                      />
                      <span>
                        📦 Impor seluruh folder secara terpisah sesuai isi berkas XML (<strong>{parseResult.banks.length} folder</strong> bank soal)
                      </span>
                    </label>
                  )}

                  {/* Option 1: Current bank (if open) */}
                  {currentBank && (
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "13px",
                        cursor: "pointer",
                        fontWeight: targetMode === "current" ? 700 : 500,
                      }}
                    >
                      <input
                        type="radio"
                        name="import-destination-mode"
                        checked={targetMode === "current"}
                        onChange={() => setTargetMode("current")}
                        style={{ accentColor: "#1B76BF" }}
                      />
                      <span>
                        Impor ke folder aktif saat ini: <strong>&ldquo;{currentBank.title}&rdquo;</strong> ({currentBank.subject})
                      </span>
                    </label>
                  )}

                  {/* Option 2: Create new bank */}
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "13px",
                      cursor: "pointer",
                      fontWeight: targetMode === "new" ? 700 : 500,
                    }}
                  >
                    <input
                      type="radio"
                      name="import-destination-mode"
                      checked={targetMode === "new"}
                      onChange={() => setTargetMode("new")}
                      style={{ accentColor: "#1B76BF" }}
                    />
                    <span>Buat 1 folder bank soal baru dari data XML</span>
                  </label>

                  {/* Option 3: Existing other bank */}
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "13px",
                      cursor: "pointer",
                      fontWeight: targetMode === "existing" ? 700 : 500,
                    }}
                  >
                    <input
                      type="radio"
                      name="import-destination-mode"
                      checked={targetMode === "existing"}
                      onChange={() => setTargetMode("existing")}
                      style={{ accentColor: "#1B76BF" }}
                    />
                    <span>Pilih folder bank soal yang sudah ada...</span>
                  </label>
                </div>

                {/* Sub-inputs based on selection */}
                {targetMode === "new" && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.5fr 1fr",
                      gap: "10px",
                      marginTop: "6px",
                      padding: "10px 14px",
                      borderRadius: "6px",
                      background: "#FFFFFF",
                      border: "1px solid #E2E8F0",
                    }}
                  >
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", display: "block", marginBottom: "4px" }}>
                        Judul Folder Baru <span style={{ color: "#DC2626" }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={newBankTitle}
                        onChange={(e) => setNewBankTitle(e.target.value)}
                        placeholder="Judul Bank Soal..."
                        maxLength={200}
                        style={{ height: "36px", fontSize: "13px" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", display: "block", marginBottom: "4px" }}>
                        Mata Pelajaran <span style={{ color: "#DC2626" }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={newBankSubject}
                        onChange={(e) => setNewBankSubject(e.target.value)}
                        placeholder="Contoh: Matematika"
                        maxLength={100}
                        style={{ height: "36px", fontSize: "13px" }}
                      />
                    </div>
                  </div>
                )}

                {targetMode === "existing" && (
                  <div style={{ marginTop: "6px" }}>
                    <select
                      className="form-select"
                      value={selectedExistingBankId}
                      onChange={(e) => setSelectedExistingBankId(e.target.value)}
                      style={{ width: "100%", height: "38px" }}
                    >
                      {allBanks.map((b) => (
                        <option key={b.id} value={b.id}>
                          📚 {b.title} — ({b.subject}) [{b.questionCount} soal]
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Questions Preview Accordion (Windowed to max 25 for rendering performance) */}
              {allParsedQuestions.length > 0 && (
                <div
                  style={{
                    border: "1px solid #E2E8F0",
                    borderRadius: "8px",
                    overflow: "hidden",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedPreview(!expandedPreview)}
                    style={{
                      width: "100%",
                      padding: "10px 16px",
                      background: "#F8FAFC",
                      border: "none",
                      borderBottom: expandedPreview ? "1px solid #E2E8F0" : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#334155",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>👁️</span>
                      <span>Pratinjau Butir Soal ({allParsedQuestions.length} Soal)</span>
                    </div>
                    <span>{expandedPreview ? "▲ Sembunyikan" : "▼ Tampilkan Rincian"}</span>
                  </button>

                  {expandedPreview && (
                    <div style={{ maxHeight: "280px", overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px", background: "#FFFFFF" }}>
                      {allParsedQuestions.length > 25 && (
                        <div style={{ fontSize: "12px", color: "#64748B", background: "#F1F5F9", padding: "6px 12px", borderRadius: "6px" }}>
                          ℹ️ Menampilkan 25 butir soal pertama untuk pratinjau (seluruh {allParsedQuestions.length} butir soal tetap akan diimpor).
                        </div>
                      )}
                      {allParsedQuestions.slice(0, 25).map((q, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: "10px 12px",
                            borderRadius: "6px",
                            border: "1px solid #E2E8F0",
                            background: "#F8FAFC",
                            fontSize: "13px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                            <span style={{ fontWeight: 700, color: "#1E293B" }}>
                              Soal #{idx + 1} ({q.type === "latex" ? "🧮 KaTeX" : q.type === "multi_select" ? "☑️ Multi" : "🔘 Pilihan Ganda"})
                            </span>
                            <span style={{ fontSize: "11px", fontWeight: 600, color: "#059669", background: "#D1FAE5", padding: "1px 6px", borderRadius: "4px" }}>
                              {q.points} Poin
                            </span>
                          </div>
                          <div style={{ color: "#0F172A", marginBottom: "8px", lineHeight: 1.5 }}>
                            <LatexRenderer text={q.questionText} />
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", fontSize: "12px", color: "#475569" }}>
                            {q.options.map((opt) => {
                              const isCorrect = q.type === "multi_select"
                                ? q.correctAnswers?.includes(opt.id)
                                : q.correctAnswer === opt.id;
                              return (
                                <div
                                  key={opt.id}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    padding: "3px 6px",
                                    borderRadius: "4px",
                                    background: isCorrect ? "#D1FAE5" : "#FFFFFF",
                                    border: `1px solid ${isCorrect ? "#10B981" : "#E2E8F0"}`,
                                    color: isCorrect ? "#065F46" : "#334155",
                                  }}
                                >
                                  <strong style={{ color: isCorrect ? "#059669" : "#64748B" }}>{opt.label}.</strong>
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    <LatexRenderer text={opt.text} />
                                  </span>
                                  {isCorrect && <span style={{ marginLeft: "auto", fontSize: "10px", fontWeight: 700 }}>✓</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #E2E8F0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#F8FAFC",
          }}
        >
          <button
            type="button"
            className="btn btn-secondary btn-md"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Batal
          </button>
          
          <button
            type="button"
            className="btn btn-primary btn-md"
            onClick={handleExecuteImport}
            disabled={!parseResult || isSubmitting}
            style={{ fontWeight: 700 }}
          >
            {isSubmitting
              ? "⏳ Menyimpan Data..."
              : `📥 Impor ${targetMode === "all_banks" && parseResult?.banks.length ? `${parseResult.banks.length} Folder` : `${allParsedQuestions.length} Soal`} Sekarang`}
          </button>
        </div>

      </div>
    </div>
  );
}
