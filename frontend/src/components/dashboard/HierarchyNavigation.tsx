"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { motionTokens } from "@/lib/motion";
import { Icon } from "./Dashboard";

export function useHierarchyNavigation() {
  const read = () => {
    const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
    return { grade: params.get("gradeLevelId") || "", classroom: params.get("classroomId") || "" };
  };
  const [selection, setSelection] = useState(read);
  useEffect(() => {
    const restore = () => setSelection(read());
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  const update = useCallback((grade: string, classroom: string) => {
    const url = new URL(window.location.href);
    if (grade) url.searchParams.set("gradeLevelId", grade); else url.searchParams.delete("gradeLevelId");
    if (classroom) url.searchParams.set("classroomId", classroom); else url.searchParams.delete("classroomId");
    if (url.href !== window.location.href) window.history.pushState(window.history.state, "", url);
    setSelection({ grade, classroom });
  }, []);
  const setGrade = useCallback((grade: string | null) => update(grade || "", ""), [update]);
  const setClassroom = useCallback((classroom: string | null) => {
    const grade = new URLSearchParams(window.location.search).get("gradeLevelId") || "";
    update(grade, classroom || "");
  }, [update]);
  return { selectedGradeId: selection.grade, selectedClassroomId: selection.classroom, setSelectedGradeId: setGrade, setSelectedClassroomId: setClassroom };
}

type CardProps = { name: string; detail: string; count?: string; index?: number; onClick: () => void };

export function HierarchyCard({ name, detail, count, index = 0, onClick }: CardProps) {
  const reduced = useReducedMotion();
  const themes = ["drilldown-theme-purple", "drilldown-theme-blue", "drilldown-theme-coral", "drilldown-theme-magenta"];
  const parts = count?.match(/^(\d+)\s+(.+)$/);
  return (
    <motion.button type="button" className={`drilldown-card ${themes[index % themes.length]}`} onClick={onClick}
      whileHover={reduced ? undefined : { y: -3 }} whileTap={reduced ? undefined : { scale: 0.98 }} transition={motionTokens.softSpring}>
      <span className="drilldown-card-top"><span>{name.replace(/^Tingkat Tingkat\s+/i, "Tingkat ")}</span><span className="drilldown-card-icon"><Icon name="arrow" size={14} /></span></span>
      {count && <span className="drilldown-card-number">{parts ? <>{parts[1]}<small>{parts[2]}</small></> : count}</span>}
      <span className="drilldown-card-bottom">{detail}</span>
    </motion.button>
  );
}

export function HierarchyBreadcrumb({ grade, classroom, onRoot, onGrade }: { grade?: string; classroom?: string; onRoot: () => void; onGrade: () => void }) {
  if (!grade) return null;
  return <nav className="hierarchy-breadcrumb" aria-label="Lokasi navigasi">
    <button type="button" onClick={onRoot}>Tingkatan</button><span>/</span>
    {classroom ? <><button type="button" onClick={onGrade}>{grade}</button><span>/</span><strong>{classroom}</strong></> : <strong>{grade}</strong>}
  </nav>;
}
