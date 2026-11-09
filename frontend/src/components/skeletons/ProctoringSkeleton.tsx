"use client";

import { LoadingContainer, Skeleton, SkeletonCircle, SkeletonText } from "./Skeleton";

export function ProctoringSkeleton() {
  return (
    <LoadingContainer label="Memuat dashboard pengawasan..." className="proctoring-skeleton">
      {/* Banner Card Skeleton */}
      <section className="proctor-banner-card" style={{ pointerEvents: "none" }}>
        <div className="proctor-banner-left">
          <div className="proctor-exam-icon-shell">
            <Skeleton width={26} height={26} style={{ borderRadius: 6 }} />
          </div>
          <div className="proctor-exam-meta" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <SkeletonText width={220} height={18} />
            <SkeletonText width={160} height={11} />
          </div>
        </div>
        <div className="proctor-banner-code" style={{ pointerEvents: "none" }}>
          <SkeletonCircle size={18} />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <SkeletonText width={55} height={9} />
            <SkeletonText width={95} height={16} />
          </div>
        </div>
      </section>

      {/* 5 Stats Cards Grid Skeleton */}
      <div className="proctor-metrics-grid" style={{ pointerEvents: "none", margin: "14px 0" }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="proctor-metric-card">
            <SkeletonCircle size={40} />
            <div className="proctor-metric-info" style={{ gap: 4, width: "100%" }}>
              <SkeletonText width="60%" height={10} />
              <SkeletonText width="40%" height={20} />
            </div>
          </div>
        ))}
        <div className="proctor-metric-card time-card" style={{ background: "#17171a" }}>
          <SkeletonCircle size={40} style={{ opacity: 0.25 }} />
          <div className="proctor-metric-info" style={{ gap: 4, width: "100%" }}>
            <SkeletonText width="70%" height={10} style={{ opacity: 0.35 }} />
            <SkeletonText width="55%" height={20} style={{ opacity: 0.35 }} />
          </div>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="proctor-main-split">
        {/* Left Pane: Student Cards Grid */}
        <div>
          <div className="proctor-filter-bar" style={{ pointerEvents: "none" }}>
            <div className="proctor-filter-pills">
              {[105, 95, 90].map((w, i) => (
                <Skeleton key={i} width={w} height={32} style={{ borderRadius: 999 }} />
              ))}
            </div>
            <Skeleton width={220} height={34} style={{ borderRadius: 10 }} />
          </div>

          <div className="proctor-student-grid" style={{ pointerEvents: "none" }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="proctor-student-card"
                style={{
                  background: "#fff",
                  border: "1px solid #e5e4ea",
                  borderRadius: 16,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div className="proctor-card-head">
                  <div className="proctor-card-user">
                    <SkeletonCircle size={36} />
                    <SkeletonText width={110} height={12} />
                  </div>
                  <Skeleton width={68} height={20} style={{ borderRadius: 999 }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid #f1f0f4", borderBottom: "1px solid #f1f0f4" }}>
                  <SkeletonText width={55} height={11} />
                  <SkeletonText width={35} height={11} />
                  <SkeletonText width={25} height={11} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "2px 0" }}>
                  <SkeletonText width={75} height={9} />
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <SkeletonText width={110} height={10} />
                    <SkeletonText width={45} height={9} />
                  </div>
                </div>
                <div className="proctor-card-footer" style={{ borderTop: "1px solid #f1f0f4" }}>
                  <Skeleton width="45%" height={32} style={{ borderRadius: 8 }} />
                  <Skeleton width="55%" height={32} style={{ borderRadius: 8 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Pane: Live Feed Panel */}
        <aside className="proctor-feed-panel" style={{ pointerEvents: "none" }}>
          <div className="proctor-feed-head">
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <SkeletonText width={120} height={14} />
              <SkeletonText width={150} height={10} />
            </div>
            <Skeleton width={50} height={20} style={{ borderRadius: 999 }} />
          </div>
          <div className="proctor-feed-pills">
            {[45, 65, 60, 50, 55].map((w, i) => (
              <Skeleton key={i} width={w} height={26} style={{ borderRadius: 999 }} />
            ))}
          </div>
          <div className="proctor-feed-list" style={{ gap: 8 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 4px" }}>
                <SkeletonCircle size={28} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                  <SkeletonText width="85%" height={11} />
                  <SkeletonText width="55%" height={10} />
                </div>
                <SkeletonText width={40} height={9} />
              </div>
            ))}
          </div>
        </aside>
      </div>
    </LoadingContainer>
  );
}
