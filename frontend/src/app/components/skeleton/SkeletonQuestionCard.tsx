"use client";

import React from "react";
import { SkeletonBase } from "./SkeletonBase";

export interface SkeletonQuestionCardProps {
  className?: string;
  style?: React.CSSProperties;
  hasImage?: boolean;
}

export const SkeletonQuestionCard: React.FC<SkeletonQuestionCardProps> = ({
  className = "",
  style,
  hasImage = false,
}) => {
  return (
    <div
      role="status"
      aria-label="Memuat soal ujian..."
      aria-busy="true"
      className={className}
      style={{
        background: "var(--bg-card, #FFFFFF)",
        border: "1px solid var(--border, #E1E6ED)",
        borderRadius: "var(--radius-card, 8px)",
        padding: "24px",
        boxShadow: "var(--shadow-card, 0 2px 8px rgba(20, 24, 40, 0.08))",
        boxSizing: "border-box",
        ...style,
      }}
    >
      {/* Top Header: Number pill + Points */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "18px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <SkeletonBase width="75px" height="26px" borderRadius="999px" />
          <SkeletonBase width="90px" height="20px" borderRadius="4px" />
        </div>
        <SkeletonBase width="60px" height="20px" borderRadius="4px" />
      </div>

      {/* Question Text */}
      <div style={{ marginBottom: "20px" }}>
        <SkeletonBase width="95%" height="18px" borderRadius="4px" style={{ marginBottom: "8px" }} />
        <SkeletonBase width="80%" height="18px" borderRadius="4px" style={{ marginBottom: "8px" }} />
        <SkeletonBase width="50%" height="18px" borderRadius="4px" />
      </div>

      {/* Optional image placeholder */}
      {hasImage && (
        <div style={{ marginBottom: "20px" }}>
          <SkeletonBase width="100%" height="180px" borderRadius="8px" />
        </div>
      )}

      {/* 4 Options */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
        {["A", "B", "C", "D"].map((opt) => (
          <div
            key={opt}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px 16px",
              borderRadius: "8px",
              border: "1px solid var(--border, #E1E6ED)",
              background: "var(--bg-page, #F6F8FB)",
            }}
          >
            <SkeletonBase width="20px" height="20px" borderRadius="50%" />
            <SkeletonBase width={`${50 + (opt.charCodeAt(0) % 3) * 20}%`} height="15px" borderRadius="4px" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkeletonQuestionCard;
