"use client";

import { LoadingContainer, Skeleton, SkeletonText } from "./Skeleton";

export function BankListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <LoadingContainer label="Memuat bank soal...">
      {/* Subject folders pills skeleton */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
        <Skeleton width={80} height={30} style={{ borderRadius: 999 }} />
        <Skeleton width={110} height={30} style={{ borderRadius: 999 }} />
        <Skeleton width={95} height={30} style={{ borderRadius: 999 }} />
        <Skeleton width={120} height={30} style={{ borderRadius: 999 }} />
      </div>

      <div className="staff-list">
        {Array.from({ length: rows }).map((_, i) => (
          <div className="staff-row staff-exam-row" key={i} style={{ pointerEvents: "none" }}>
            <span style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <SkeletonText width={200} height={14} style={{ borderRadius: 4 }} />
              <SkeletonText width={140} height={10} style={{ borderRadius: 4 }} />
            </span>
            <div className="staff-row-actions" style={{ display: "flex", gap: 6 }}>
              <Skeleton width={60} height={28} style={{ borderRadius: 6 }} />
              <Skeleton width={48} height={28} style={{ borderRadius: 6 }} />
              <Skeleton width={88} height={28} style={{ borderRadius: 6 }} />
              <Skeleton width={76} height={28} style={{ borderRadius: 6 }} />
            </div>
          </div>
        ))}
      </div>
    </LoadingContainer>
  );
}

export function BankEditorSkeleton() {
  return (
    <LoadingContainer label="Memuat editor bank soal..." className="bank-editor-layout">
      {/* Top Banner Skeleton */}
      <div style={{ padding: "16px 20px", background: "#fff", border: "1px solid #e9e9ec", borderRadius: 12, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton width={90} height={18} style={{ borderRadius: 999 }} />
          <SkeletonText width={260} height={18} />
          <SkeletonText width={180} height={11} />
        </div>
        <Skeleton width={120} height={34} style={{ borderRadius: 8 }} />
      </div>

      {/* Split Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Left Column: Question Editor */}
        <div style={{ background: "#fff", border: "1px solid #e9e9ec", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <Skeleton width={160} height={36} style={{ borderRadius: 8 }} />
            <Skeleton width={100} height={36} style={{ borderRadius: 8 }} />
          </div>
          {/* Toolbar */}
          <div style={{ display: "flex", gap: 6, padding: "8px 0", borderBottom: "1px solid #f0f0f2" }}>
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton key={i} width={28} height={28} style={{ borderRadius: 4 }} />
            ))}
          </div>
          {/* Editor box */}
          <Skeleton width="100%" height={120} style={{ borderRadius: 8 }} />
          {/* Answer Options */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SkeletonText width={120} height={12} />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", border: "1px solid #ececef", borderRadius: 8 }}>
                <Skeleton width={16} height={16} style={{ borderRadius: 4 }} />
                <Skeleton width={24} height={24} style={{ borderRadius: "50%" }} />
                <SkeletonText width="70%" height={12} />
                <Skeleton width={20} height={20} style={{ marginLeft: "auto", borderRadius: 4 }} />
              </div>
            ))}
          </div>
          {/* Footer buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <Skeleton width={100} height={36} style={{ borderRadius: 8 }} />
            <Skeleton width={120} height={36} style={{ borderRadius: 8 }} />
          </div>
        </div>

        {/* Right Column: Student Preview */}
        <div style={{ background: "#fafafc", border: "1px solid #e9e9ec", borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <SkeletonText width={120} height={13} />
            <div style={{ display: "flex", gap: 6 }}>
              <Skeleton width={70} height={26} style={{ borderRadius: 6 }} />
              <Skeleton width={70} height={26} style={{ borderRadius: 6 }} />
            </div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #e2e2e8", borderRadius: 10, padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
            <SkeletonText width={80} height={12} style={{ borderRadius: 4 }} />
            <SkeletonText width="95%" height={14} />
            <SkeletonText width="80%" height={14} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", border: "1px solid #ebebf0", borderRadius: 8 }}>
                  <Skeleton width={18} height={18} style={{ borderRadius: "50%" }} />
                  <SkeletonText width="50%" height={12} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </LoadingContainer>
  );
}

