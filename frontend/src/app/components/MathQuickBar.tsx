"use client";

import { useState } from "react";

interface MathQuickBarProps {
  onInsert: (snippet: string) => void;
  onClose?: () => void;
  compact?: boolean;
}

interface MathItem {
  label: string;
  display: string;
  snippet: string;
  hint: string;
}

const BASIC_ITEMS: MathItem[] = [
  { label: "Pecahan", display: "½", snippet: "1/2", hint: "Pecahan sederhana (contoh: 1/2)" },
  { label: "Pangkat", display: "x²", snippet: "x^2", hint: "Pangkat angka atau variabel (contoh: x^2 atau 2^3)" },
  { label: "Akar", display: "√x", snippet: "akar(16)", hint: "Akar bilangan (contoh: akar(16))" },
  { label: "Perkalian", display: "×", snippet: " * ", hint: "Tanda perkalian silang (contoh: 2*2)" },
  { label: "Pembagian", display: "÷", snippet: " : ", hint: "Tanda pembagian rapi (contoh: 10:2)" },
  { label: "Derajat", display: "°", snippet: "°", hint: "Satuan sudut derajat (contoh: 30° atau 90 deg)" },
  { label: "Plus Minus", display: "±", snippet: "+-", hint: "Tanda plus minus" },
  { label: "Kurang Dari", display: "≤", snippet: "<=", hint: "Kurang dari sama dengan" },
  { label: "Lebih Dari", display: "≥", snippet: ">=", hint: "Lebih dari sama dengan" },
  { label: "Beda / Tidak Sama", display: "≠", snippet: "!=", hint: "Tidak sama dengan" },
];

const ADVANCED_ITEMS: MathItem[] = [
  { label: "Sinus", display: "sin", snippet: "sin(30°)", hint: "Fungsi sinus sudut (contoh: sin(30°))" },
  { label: "Cosinus", display: "cos", snippet: "cos(60°)", hint: "Fungsi cosinus sudut (contoh: cos(60°))" },
  { label: "Tangen", display: "tan", snippet: "tan(45°)", hint: "Fungsi tangen sudut (contoh: tan(45°))" },
  { label: "Limit", display: "lim x→0", snippet: "lim x->0 (x)", hint: "Limit fungsi (contoh: lim x->0 (sin 4x)/(tan 2x))" },
  { label: "Logaritma", display: "ᵃlog b", snippet: "^2log(8)", hint: "Logaritma kurikulum nasional (contoh: ^2log(8) atau ^3log x)" },
  { label: "Integral", display: "∫ dx", snippet: "int 0 to 1 x dx", hint: "Integral tentu (contoh: int 0 to 1 x^2 dx)" },
  { label: "Tak Hingga", display: "∞", snippet: "inf", hint: "Simbol tak hingga (infinity)" },
  { label: "Pi", display: "π", snippet: "pi", hint: "Konstanta pi (3.14 atau 22/7)" },
  { label: "Theta", display: "θ", snippet: "theta", hint: "Simbol sudut theta" },
  { label: "Alpha", display: "α", snippet: "alpha", hint: "Simbol sudut alpha" },
];

export default function MathQuickBar({ onInsert, onClose, compact = false }: MathQuickBarProps) {
  const [activeTab, setActiveTab] = useState<"basic" | "advanced">("basic");
  const [hoveredHint, setHoveredHint] = useState<string | null>(null);

  const currentItems = activeTab === "basic" ? BASIC_ITEMS : ADVANCED_ITEMS;

  return (
    <div
      style={{
        background: "#F8FAFC",
        border: "1.5px solid #E2E8F0",
        borderRadius: "10px",
        padding: compact ? "8px 10px" : "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {/* Header bar: Tab selector & Helpful explanation */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#1E293B" }}>
            📐 Bantuan Rumus Cepat:
          </span>
          <div style={{ display: "inline-flex", background: "#E2E8F0", padding: "2px", borderRadius: "6px" }}>
            <button
              type="button"
              onClick={() => setActiveTab("basic")}
              style={{
                fontSize: "12px",
                fontWeight: activeTab === "basic" ? 700 : 500,
                padding: "3px 10px",
                borderRadius: "4px",
                background: activeTab === "basic" ? "#FFFFFF" : "transparent",
                color: activeTab === "basic" ? "#1B76BF" : "#475569",
                border: "none",
                cursor: "pointer",
                boxShadow: activeTab === "basic" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.15s",
              }}
            >
              Simbol Umum
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("advanced")}
              style={{
                fontSize: "12px",
                fontWeight: activeTab === "advanced" ? 700 : 500,
                padding: "3px 10px",
                borderRadius: "4px",
                background: activeTab === "advanced" ? "#FFFFFF" : "transparent",
                color: activeTab === "advanced" ? "#7C3AED" : "#475569",
                border: "none",
                cursor: "pointer",
                boxShadow: activeTab === "advanced" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.15s",
              }}
            >
              Simbol Lanjutan
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "11px", color: "#64748B" }}>
            💡 Klik tombol untuk menyisipkan
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "#E2E8F0",
                border: "none",
                color: "#475569",
                fontSize: "11px",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: "4px",
                cursor: "pointer",
              }}
              title="Tutup panel tombol rumus"
            >
              ✕ Tutup
            </button>
          )}
        </div>
      </div>

      {/* Buttons Grid */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
        }}
      >
        {currentItems.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => onInsert(` ${item.snippet} `)}
            onMouseEnter={() => setHoveredHint(item.hint)}
            onMouseLeave={() => setHoveredHint(null)}
            title={item.hint}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              minHeight: compact ? "32px" : "38px",
              padding: compact ? "2px 8px" : "4px 12px",
              borderRadius: "6px",
              border: "1px solid #CBD5E1",
              background: "#FFFFFF",
              color: "#1E293B",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = activeTab === "basic" ? "#1B76BF" : "#7C3AED";
              e.currentTarget.style.background = activeTab === "basic" ? "#EFF6FF" : "#F5F3FF";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = "#CBD5E1";
              e.currentTarget.style.background = "#FFFFFF";
            }}
          >
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "14px",
                fontWeight: 700,
                color: activeTab === "basic" ? "#1B76BF" : "#7C3AED",
              }}
            >
              {item.display}
            </span>
            {!compact && <span style={{ fontSize: "11px", color: "#475569", fontWeight: 500 }}>{item.label}</span>}
          </button>
        ))}
      </div>

      {/* Helpful Hint Footnote */}
      <div style={{ fontSize: "11px", color: hoveredHint ? "#1E293B" : "#64748B", fontStyle: "italic", minHeight: "16px" }}>
        {hoveredHint ? `🔍 ${hoveredHint}` : "Tips: Anda cukup mengetik biasa (misal 1/2 atau 2*2), hasil rumus langsung otomatis rapi di pratinjau lembar ujian sebelah kanan."}
      </div>
    </div>
  );
}
