"use client";

import React from "react";
import { SkeletonBase } from "./SkeletonBase";

export interface SkeletonLiveStripProps {
  className?: string;
  style?: React.CSSProperties;
}

export const SkeletonLiveStrip: React.FC<SkeletonLiveStripProps> = ({
  className = "",
  style,
}) => {
  return (
    <section
      role="status"
      aria-label="Memuat status ujian aktif..."
      aria-busy="true"
      className={className}
      style={{
        background: "var(--bg-card, #FFFFFF)",
        border: "1px solid var(--border, #D7DEE3)",
        borderLeft: "3px solid var(--border-input, #8597A3)",
        borderRadius: "var(--radius-card, 8px)",
        boxShadow: "var(--shadow-card, 0 2px 8px rgba(20, 24, 40, 0.08))",
        padding: "16px 20px",
        marginBottom: "20px",
        boxSizing: "border-box",
        ...style,
      }}
    >
      {/* Top label: dot + Sedang berlangsung */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "12px",
        }}
      >
        <SkeletonBase width="6px" height="6px" borderRadius="50%" />
        <SkeletonBase width="120px" height="12px" borderRadius="4px" />
      </div>

      {/* Main Strip Row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        {/* Title */}
        <div style={{ minWidth: "220px", flex: "1 1 220px" }}>
          <SkeletonBase width="75%" height="20px" borderRadius="4px" />
        </div>

        {/* Online count */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <SkeletonBase width="110px" height="14px" borderRadius="4px" />
        </div>

        {/* 4 Flag dots */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <SkeletonBase width="55px" height="14px" borderRadius="4px" />
          <SkeletonBase width="55px" height="14px" borderRadius="4px" />
          <SkeletonBase width="55px" height="14px" borderRadius="4px" />
          <SkeletonBase width="55px" height="14px" borderRadius="4px" />
        </div>

        {/* Countdown */}
        <div>
          <SkeletonBase width="70px" height="24px" borderRadius="6px" />
        </div>

        {/* Primary Action Button */}
        <div>
          <SkeletonBase width="135px" height="36px" borderRadius="8px" />
        </div>
      </div>
    </section>
  );
};

export default SkeletonLiveStrip;
