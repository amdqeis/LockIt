"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

export function Skeleton({
  className = "",
  width,
  height,
  style,
}: {
  className?: string;
  width?: string | number;
  height?: string | number;
  style?: CSSProperties;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      aria-hidden="true"
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        ...style,
      }}
      animate={
        reduceMotion
          ? undefined
          : { opacity: [0.55, 0.9, 0.55] }
      }
      transition={{
        duration: 1.8,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}

export function SkeletonText({
  width = "100%",
  height = "12px",
  className = "",
  style,
}: {
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Skeleton
      className={`skeleton-text ${className}`}
      style={{ width, height, ...style }}
    />
  );
}

export function SkeletonCircle({
  size = 32,
  className = "",
  style,
}: {
  size?: number | string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Skeleton
      className={`skeleton-circle ${className}`}
      style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, ...style }}
    />
  );
}

export function LoadingContainer({
  label = "Memuat data...",
  children,
  className = "",
  style,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`loading-container ${className}`} role="status" aria-busy="true" style={style}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
