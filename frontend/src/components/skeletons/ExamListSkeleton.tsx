"use client";

import { LoadingContainer, Skeleton, SkeletonText } from "./Skeleton";

export function ExamListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <LoadingContainer label="Memuat daftar ujian...">
      <div className="staff-list">
        {Array.from({ length: rows }).map((_, i) => (
          <div className="staff-row staff-exam-row" key={i} style={{ pointerEvents: "none" }}>
            <span style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <SkeletonText width={220} height={14} style={{ borderRadius: 4 }} />
              <SkeletonText width={160} height={10} style={{ borderRadius: 4 }} />
            </span>
            <Skeleton width={70} height={22} style={{ borderRadius: 999 }} />
            <div className="staff-row-actions" style={{ display: "flex", gap: 6 }}>
              <Skeleton width={60} height={28} style={{ borderRadius: 6 }} />
              <Skeleton width={48} height={28} style={{ borderRadius: 6 }} />
              <Skeleton width={68} height={28} style={{ borderRadius: 6 }} />
              <Skeleton width={74} height={28} style={{ borderRadius: 6 }} />
            </div>
          </div>
        ))}
      </div>
      <nav className="staff-pagination" aria-label="Memuat navigasi halaman">
        <SkeletonText width={130} height={12} />
        <div style={{ display: "flex", gap: 8 }}>
          <Skeleton width={76} height={32} style={{ borderRadius: 6 }} />
          <Skeleton width={76} height={32} style={{ borderRadius: 6 }} />
        </div>
      </nav>
    </LoadingContainer>
  );
}

export function ExamQuestionSkeleton() {
  return (
    <LoadingContainer label="Memuat soal ujian..." style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SkeletonText width="40%" height={14} style={{ marginBottom: 6 }} />
      <SkeletonText width="90%" height={12} />
      <SkeletonText width="75%" height={12} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 12px", border: "1px solid #e9e9ec", borderRadius: 8 }}>
            <Skeleton width={18} height={18} style={{ borderRadius: "50%" }} />
            <SkeletonText width="60%" height={12} />
          </div>
        ))}
      </div>
    </LoadingContainer>
  );
}

