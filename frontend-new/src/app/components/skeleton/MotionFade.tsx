"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";

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
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration, delay, ease: "easeOut" }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
};

export { motion, AnimatePresence };
export default MotionFade;
