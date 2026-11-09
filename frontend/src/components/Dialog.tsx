"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MotionButton } from "./MotionButton";

export function Dialog({ open, title, onClose, children, variant = "modal" }: { open: boolean; title: string; onClose: () => void; children: ReactNode; variant?: "modal" | "drawer" }) {
  const ref = useRef<HTMLDialogElement>(null);
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); if (trigger?.isConnected) trigger.focus(); };
  }, [open]);
  return <motion.dialog ref={ref} className={`dialog${variant === "drawer" ? " staff-drawer" : ""}`} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} initial={false} animate={open && !reduceMotion ? variant === "drawer" ? { opacity: [0.9, 1], x: [20, 0], y: 0 } : { opacity: [0.85, 1], y: [8, 0], x: 0 } : { opacity: 1, x: 0, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}>
    <header className="dialog-header"><h2 id={titleId}>{title}</h2><MotionButton className="icon-button" type="button" aria-label="Tutup" onClick={onClose}>×</MotionButton></header>
    <div className="dialog-content">{children}</div>
  </motion.dialog>;
}
