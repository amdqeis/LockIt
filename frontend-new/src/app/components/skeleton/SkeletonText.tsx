"use client";

import React from "react";
import { SkeletonBase } from "./SkeletonBase";

export interface SkeletonTextProps {
  lines?: number;
  width?: string | number;
  lastLineWidth?: string | number;
  height?: string | number;
  gap?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 3,
  width = "100%",
  lastLineWidth = "65%",
  height = "14px",
  gap = "8px",
  borderRadius = "4px",
  className = "",
  style,
}) => {
  return (
    <div
      className={`skeleton-text-container ${className}`.trim()}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: typeof gap === "number" ? `${gap}px` : gap,
        width: typeof width === "number" ? `${width}px` : width,
        ...style,
      }}
    >
      {Array.from({ length: lines }).map((_, idx) => {
        const isLast = idx === lines - 1;
        const lineWidth = isLast && lines > 1 ? lastLineWidth : "100%";
        return (
          <SkeletonBase
            key={idx}
            width={lineWidth}
            height={height}
            borderRadius={borderRadius}
          />
        );
      })}
    </div>
  );
};

export default SkeletonText;
