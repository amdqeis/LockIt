"use client";

import { LoadingContainer, Skeleton, SkeletonText } from "./Skeleton";

export function ExamSessionSkeleton() {
  return (
    <LoadingContainer label="Memuat sesi ujian..." className="exam-page" style={{ opacity: 0.9 }}>
      {/* Topbar */}
      <div className="exam-topbar">
        <Skeleton width={140} height={32} style={{ borderRadius: 6 }} />
      </div>

      {/* Header */}
      <header className="exam-header">
        <div className="exam-title" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <SkeletonText width={240} height={22} />
          <SkeletonText width={160} height={12} />
        </div>
        <div className="exam-person" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <SkeletonText width={50} height={10} />
          <SkeletonText width={120} height={14} />
          <SkeletonText width={90} height={10} />
        </div>
        <div className="timer" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <SkeletonText width={60} height={10} />
          <SkeletonText width={80} height={20} />
        </div>
      </header>

      {/* Status Bar */}
      <div className="exam-status" style={{ pointerEvents: "none" }}>
        <SkeletonText width={80} height={12} />
        <SkeletonText width={130} height={12} />
      </div>

      {/* Workspace */}
      <div className="exam-workspace">
        {/* Main Content */}
        <section className="exam-content" aria-label="Memuat pengerjaan soal">
          <div className="exam-progress">
            <div className="exam-position">
              <SkeletonText width={110} height={14} />
            </div>
            <div className="exam-progress-status" style={{ flex: 1, margin: "0 16px" }}>
              <Skeleton width="100%" height={8} style={{ borderRadius: 4 }} />
            </div>
            <Skeleton width={88} height={28} style={{ borderRadius: 999 }} />
          </div>

          <article className="exam-question" style={{ pointerEvents: "none", minHeight: 280 }}>
            <div className="question-heading" style={{ marginBottom: 16 }}>
              <SkeletonText width={120} height={13} />
            </div>
            <div className="question-prompt" style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              <SkeletonText width="90%" height={15} />
              <SkeletonText width="98%" height={15} />
              <SkeletonText width="65%" height={15} />
            </div>
            <div className="choices" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="choice"
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}
                >
                  <Skeleton width={20} height={20} style={{ borderRadius: "50%" }} />
                  <SkeletonText width={`${40 + i * 15}%`} height={13} />
                </div>
              ))}
            </div>
          </article>

          <nav className="question-nav" style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
            <Skeleton width={110} height={42} style={{ borderRadius: 999 }} />
            <Skeleton width={110} height={42} style={{ borderRadius: 999 }} />
          </nav>
        </section>

        {/* Navigator Aside */}
        <aside className="exam-navigator" style={{ pointerEvents: "none" }}>
          <div className="navigator-heading">
            <div>
              <SkeletonText width={100} height={15} style={{ marginBottom: 4 }} />
              <SkeletonText width={140} height={10} />
            </div>
            <Skeleton width={50} height={18} style={{ borderRadius: 999 }} />
          </div>

          <div className="navigator-summary" style={{ margin: "12px 0" }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <SkeletonText width={40} height={9} />
                <SkeletonText width={24} height={16} />
              </div>
            ))}
          </div>

          <div className="navigator-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
            {Array.from({ length: 20 }).map((_, i) => (
              <Skeleton key={i} width="100%" height={36} style={{ borderRadius: 8 }} />
            ))}
          </div>
        </aside>
      </div>
    </LoadingContainer>
  );
}

