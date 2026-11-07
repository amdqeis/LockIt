"use client";

import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

export interface MotionFadeProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const MotionFade: React.FC<MotionFadeProps> = ({
  children,
  delay = 0,
  duration = 0.25,
  className = "",
  style,
}) => {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
      transition={{ duration: reducedMotion ? 0 : duration, delay: reducedMotion ? 0 : delay, ease: "easeOut" }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
};

export { motion, AnimatePresence };
export default MotionFade;
