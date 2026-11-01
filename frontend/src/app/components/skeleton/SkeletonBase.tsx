"use client";

import React from "react";

export interface SkeletonBaseProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
  variant?: "shimmer" | "pulse";
  "aria-label"?: string;
}

export const SkeletonBase: React.FC<SkeletonBaseProps> = ({
  width = "100%",
  height = "16px",
  borderRadius = "6px",
  className = "",
  style,
  variant = "shimmer",
  "aria-label": ariaLabel = "Memuat data...",
}) => {
  const animClass = variant === "pulse" ? "skeleton-pulse" : "skeleton-shimmer";

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
      className={`${animClass} ${className}`.trim()}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        borderRadius: typeof borderRadius === "number" ? `${borderRadius}px` : borderRadius,
        display: "block",
        flexShrink: 0,
        ...style,
      }}
    />
  );
};

export default SkeletonBase;
