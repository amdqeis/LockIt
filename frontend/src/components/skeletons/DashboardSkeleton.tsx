"use client";

import { LoadingContainer, Skeleton, SkeletonCircle, SkeletonText } from "./Skeleton";

export function DashboardSkeleton() {
  return (
    <LoadingContainer label="Memuat ringkasan dashboard..." className="overview-example">
      <div className="overview-example-heading">
        <div>
          <SkeletonText width={100} height={11} style={{ marginBottom: 6 }} />
          <SkeletonText width={180} height={24} style={{ borderRadius: 6 }} />
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Skeleton width={90} height={32} style={{ borderRadius: 999 }} />
          <Skeleton width={110} height={36} style={{ borderRadius: 999 }} />
        </div>
      </div>

      <div className="overview-example-grid">
        {/* Hero Card */}
        <div className="overview-card overview-hero" style={{ background: "#f8f8fb" }}>
          <div className="overview-hero-top">
            <SkeletonText width={110} height={12} />
            <SkeletonCircle size={28} />
          </div>
          <div className="overview-hero-number" style={{ margin: "14px 0" }}>
            <SkeletonText width={50} height={36} style={{ marginBottom: 4 }} />
            <SkeletonText width={140} height={11} />
          </div>
          <div className="overview-hero-content">
            <SkeletonText width="80%" height={12} style={{ marginBottom: 8 }} />
            <SkeletonText width={100} height={12} />
          </div>
        </div>

        {/* Status Card */}
        <div className="overview-card overview-status" style={{ background: "#ffffff" }}>
          <div className="overview-card-head">
            <div>
              <SkeletonText width={90} height={11} style={{ marginBottom: 6 }} />
              <SkeletonText width={44} height={28} />
            </div>
            <Skeleton width={50} height={20} style={{ borderRadius: 999 }} />
          </div>
          <div className="overview-status-items" style={{ margin: "14px 0" }}>
            <div style={{ padding: "8px 0", display: "flex", justifyContent: "space-between" }}>
              <SkeletonText width={120} height={12} />
              <SkeletonText width={24} height={12} />
            </div>
            <div style={{ padding: "8px 0", display: "flex", justifyContent: "space-between" }}>
              <SkeletonText width={130} height={12} />
              <SkeletonText width={24} height={12} />
            </div>
          </div>
          <SkeletonText width={140} height={10} />
        </div>

        {/* Metric Pair */}
        <div className="overview-metric-pair">
          <div className="overview-card overview-metric overview-blue" style={{ background: "#f0f4ff" }}>
            <div className="overview-metric-head" style={{ marginBottom: 12 }}>
              <SkeletonText width={110} height={12} />
              <SkeletonCircle size={20} />
            </div>
            <SkeletonText width={36} height={24} style={{ marginBottom: 4 }} />
            <SkeletonText width={120} height={10} />
          </div>
          <div className="overview-card overview-metric overview-coral" style={{ background: "#fff5f0" }}>
            <div className="overview-metric-head" style={{ marginBottom: 12 }}>
              <SkeletonText width={90} height={12} />
              <SkeletonCircle size={20} />
            </div>
            <SkeletonText width={36} height={24} style={{ marginBottom: 4 }} />
            <SkeletonText width={140} height={10} />
          </div>
        </div>

        {/* Action Card */}
        <div className="overview-card overview-action" style={{ background: "#fafafc" }}>
          <SkeletonText width={70} height={11} style={{ marginBottom: 8 }} />
          <SkeletonText width="85%" height={18} style={{ marginBottom: 8 }} />
          <SkeletonText width="60%" height={12} style={{ marginBottom: 16 }} />
          <SkeletonText width={110} height={12} />
        </div>
      </div>

      {/* Feeds */}
      <div className="overview-feeds">
        <div className="overview-card overview-feed">
          <div className="overview-feed-head">
            <div>
              <SkeletonText width={80} height={10} style={{ marginBottom: 6 }} />
              <SkeletonText width={180} height={16} />
            </div>
            <Skeleton width={90} height={28} style={{ borderRadius: 999 }} />
          </div>
          <SkeletonText width={200} height={11} style={{ margin: "10px 0 16px" }} />
          <div className="overview-feed-list">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="overview-feed-row"
                style={{ pointerEvents: "none", display: "flex", alignItems: "center", gap: 12 }}
              >
                <SkeletonCircle size={32} />
                <div style={{ flex: 1 }}>
                  <SkeletonText width="60%" height={13} style={{ marginBottom: 4 }} />
                  <SkeletonText width="40%" height={10} />
                </div>
                <Skeleton width={64} height={20} style={{ borderRadius: 999 }} />
              </div>
            ))}
          </div>
        </div>

        <div className="overview-card overview-feed">
          <div className="overview-feed-head">
            <div>
              <SkeletonText width={90} height={10} style={{ marginBottom: 6 }} />
              <SkeletonText width={130} height={16} />
            </div>
          </div>
          <SkeletonText width={160} height={11} style={{ margin: "10px 0 16px" }} />
          <div className="overview-feed-list">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="overview-feed-row"
                style={{ pointerEvents: "none", display: "flex", alignItems: "center", gap: 12 }}
              >
                <SkeletonCircle size={32} />
                <div style={{ flex: 1 }}>
                  <SkeletonText width="50%" height={13} style={{ marginBottom: 4 }} />
                  <SkeletonText width="70%" height={10} />
                </div>
                <SkeletonText width={20} height={16} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </LoadingContainer>
  );
}

