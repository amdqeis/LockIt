"use client";

import React from "react";
import { SkeletonBase } from "./SkeletonBase";

export interface SkeletonExamCardProps {
  viewMode?: "grid" | "list";
  className?: string;
  style?: React.CSSProperties;
}

export const SkeletonExamCard: React.FC<SkeletonExamCardProps> = ({
  viewMode = "grid",
  className = "",
  style,
}) => {
  if (viewMode === "list") {
    return (
      <tr
        role="status"
        aria-label="Memuat data ujian..."
        aria-busy="true"
        className={className}
        style={{
          height: "56px",
          borderBottom: "1px solid var(--border, #D7DEE3)",
          ...style,
        }}
      >
        {/* Status */}
        <td style={{ padding: "0 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <SkeletonBase width="8px" height="8px" borderRadius="50%" />
            <SkeletonBase width="60px" height="13px" borderRadius="4px" />
          </div>
        </td>
        {/* Title */}
        <td style={{ padding: "0 16px" }}>
          <SkeletonBase width="180px" height="15px" borderRadius="4px" />
        </td>
        {/* Durasi */}
        <td style={{ padding: "0 16px" }}>
          <SkeletonBase width="65px" height="13px" borderRadius="4px" />
        </td>
        {/* Soal */}
        <td style={{ padding: "0 16px" }}>
          <SkeletonBase width="50px" height="13px" borderRadius="4px" />
        </td>
        {/* Peserta */}
        <td style={{ padding: "0 16px" }}>
          <SkeletonBase width="70px" height="13px" borderRadius="4px" />
        </td>
        {/* Jadwal */}
        <td style={{ padding: "0 16px" }}>
          <SkeletonBase width="90px" height="13px" borderRadius="4px" />
        </td>
        {/* Kode Akses */}
        <td style={{ padding: "0 16px" }}>
          <SkeletonBase width="75px" height="24px" borderRadius="6px" />
        </td>
        {/* Action button */}
        <td style={{ padding: "0 16px", textAlign: "right" }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <SkeletonBase width="80px" height="32px" borderRadius="6px" />
          </div>
        </td>
      </tr>
    );
  }

  // Grid Mode (Exam Card)
  return (
    <article
      role="status"
      aria-label="Memuat kartu ujian..."
      aria-busy="true"
      className={`exam-card ${className}`.trim()}
      style={{
        background: "var(--bg-card, #FFFFFF)",
        border: "1px solid var(--border, #D7DEE3)",
        borderRadius: "var(--radius-card, 8px)",
        padding: "16px",
        boxShadow: "var(--shadow-card, 0 2px 8px rgba(20, 24, 40, 0.08))",
        display: "flex",
        flexDirection: "column",
        minHeight: "220px",
        boxSizing: "border-box",
        ...style,
      }}
    >
      {/* Top Row: Status Dot on left, 3-dots on right */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <SkeletonBase width="8px" height="8px" borderRadius="50%" />
          <SkeletonBase width="70px" height="13px" borderRadius="4px" />
        </div>
        <SkeletonBase width="24px" height="24px" borderRadius="6px" />
      </div>

      {/* Exam Title: 2 lines */}
      <div style={{ marginBottom: "12px" }}>
        <SkeletonBase width="88%" height="16px" borderRadius="4px" style={{ marginBottom: "6px" }} />
        <SkeletonBase width="55%" height="16px" borderRadius="4px" />
      </div>

      {/* Meta Line: Duration & Question Count chips */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        <SkeletonBase width="70px" height="14px" borderRadius="4px" />
        <SkeletonBase width="60px" height="14px" borderRadius="4px" />
      </div>

      {/* Access code or schedule box */}
      <div style={{ marginBottom: "16px" }}>
        <SkeletonBase width="120px" height="28px" borderRadius="6px" />
      </div>

      {/* Push footer to bottom */}
      <div style={{ marginTop: "auto" }}>
        <SkeletonBase width="100%" height="36px" borderRadius="6px" />
      </div>
    </article>
  );
};

export default SkeletonExamCard;
