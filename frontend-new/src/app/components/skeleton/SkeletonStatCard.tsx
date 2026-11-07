"use client";

import React from "react";
import { SkeletonBase } from "./SkeletonBase";

export interface SkeletonStatCardProps {
  className?: string;
  style?: React.CSSProperties;
}

export const SkeletonStatCard: React.FC<SkeletonStatCardProps> = ({
  className = "",
  style,
}) => {
  return (
    <div
      role="status"
      aria-label="Memuat statistik..."
      aria-busy="true"
      className={className}
      style={{
        background: "var(--bg-card, #FFFFFF)",
        border: "1px solid var(--border, #D7DEE3)",
        borderRadius: "var(--radius-card, 8px)",
        padding: "16px 20px",
        boxShadow: "var(--shadow-card, 0 2px 8px rgba(20, 24, 40, 0.08))",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: "92px",
        width: "100%",
        boxSizing: "border-box",
        ...style,
      }}
    >
      {/* Top row: Label placeholder on left, small icon placeholder on right */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
        }}
      >
        <SkeletonBase width="90px" height="14px" borderRadius="4px" />
        <SkeletonBase width="18px" height="18px" borderRadius="4px" />
      </div>

      {/* Bottom row: Big numeric value placeholder */}
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <SkeletonBase width="48px" height="32px" borderRadius="6px" />
      </div>
    </div>
  );
};

export default SkeletonStatCard;
