"use client";

import { LoadingContainer, Skeleton, SkeletonText } from "./Skeleton";

export function DoneResultSkeleton() {
  return (
    <LoadingContainer label="Memeriksa hasil ujian..." className="done-result" style={{ pointerEvents: "none" }}>
      <SkeletonText width={200} height={20} style={{ margin: "0 auto 10px" }} />
      <SkeletonText width={140} height={13} style={{ margin: "0 auto 16px" }} />
      <div className="done-score" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, margin: "16px auto" }}>
        <SkeletonText width={70} height={12} />
        <SkeletonText width={60} height={32} />
      </div>
      <Skeleton width={130} height={38} style={{ margin: "16px auto 0", borderRadius: 999 }} />
    </LoadingContainer>
  );
}

export function HistorySkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <LoadingContainer label="Memuat riwayat ujian...">
      <div className="history-list" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            style={{
              padding: "12px 16px",
              background: "#fff",
              border: "1px solid #e9e9ec",
              borderRadius: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <SkeletonText width={160} height={13} />
              <SkeletonText width={100} height={10} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Skeleton width={40} height={18} style={{ borderRadius: 999 }} />
              <Skeleton width={60} height={28} style={{ borderRadius: 6 }} />
            </div>
          </div>
        ))}
      </div>
    </LoadingContainer>
  );
}
