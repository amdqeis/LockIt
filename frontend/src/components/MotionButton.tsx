"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ComponentProps } from "react";
import { motionTokens } from "@/lib/motion";

export function MotionButton({ disabled, ...props }: ComponentProps<typeof motion.button>) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.button
      {...props}
      disabled={disabled}
      whileHover={disabled || reduceMotion ? undefined : { y: -2, scale: 1.012 }}
      whileTap={disabled || reduceMotion ? undefined : { scale: 0.965 }}
      transition={reduceMotion ? { duration: 0 } : motionTokens.press}
    />
  );
}
