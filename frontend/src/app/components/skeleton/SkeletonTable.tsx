"use client";

import React from "react";
import { SkeletonBase } from "./SkeletonBase";

export interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  cols?: number;
  columnWidths?: (string | number)[];
  className?: string;
  style?: React.CSSProperties;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({
  rows = 5,
  columns,
  cols,
  columnWidths,
  className = "",
  style,
}) => {
  const columnCount = columns ?? cols ?? 5;
  return (
    <div
      role="status"
      aria-label="Memuat tabel..."
      aria-busy="true"
      className={`skeleton-table-wrapper ${className}`.trim()}
      style={{
        background: "var(--bg-card, #FFFFFF)",
        border: "1px solid var(--border, #E1E6ED)",
        borderRadius: "var(--radius-card, 8px)",
        overflow: "hidden",
        boxShadow: "var(--shadow-card, 0 2px 8px rgba(20, 24, 40, 0.08))",
        ...style,
      }}
    >
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
          <thead>
            <tr
              style={{
                background: "var(--bg-subtle, #F0F3F8)",
                borderBottom: "1px solid var(--border, #E1E6ED)",
                height: "44px",
              }}
            >
              {Array.from({ length: columnCount }).map((_, cIdx) => (
                <th key={cIdx} style={{ padding: "0 16px" }}>
                  <SkeletonBase
                    width={columnWidths?.[cIdx] || "65%"}
                    height="12px"
                    borderRadius="4px"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rIdx) => (
              <tr
                key={rIdx}
                style={{
                  height: "54px",
                  borderBottom: rIdx === rows - 1 ? "none" : "1px solid var(--border, #E1E6ED)",
                }}
              >
                {Array.from({ length: columnCount }).map((_, cIdx) => (
                  <td key={cIdx} style={{ padding: "0 16px" }}>
                    <SkeletonBase
                      width={columnWidths?.[cIdx] ? `calc(${typeof columnWidths[cIdx] === "number" ? `${columnWidths[cIdx]}px` : columnWidths[cIdx]} * 0.8)` : `${45 + ((rIdx + cIdx) % 4) * 15}%`}
                      height="14px"
                      borderRadius="4px"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SkeletonTable;
