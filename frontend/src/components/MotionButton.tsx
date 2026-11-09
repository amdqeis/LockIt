"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ComponentProps } from "react";

export function MotionButton({ disabled, ...props }: ComponentProps<typeof motion.button>) {
  const reduceMotion = useReducedMotion();
  return <motion.button {...props} disabled={disabled}
    whileHover={disabled || reduceMotion ? undefined : { y: -2 }}
    whileTap={disabled || reduceMotion ? undefined : { scale: 0.965 }}
    transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }} />;
}
