"use client";

import Image from "next/image";
import { Skeleton, SkeletonCircle, SkeletonText } from "./Skeleton";
import { DashboardSkeleton } from "./DashboardSkeleton";

export function ShellSkeleton() {
  return (
    <div className="staff-app" aria-busy="true">
      <aside className="staff-sidebar" aria-label="Memuat navigasi">
        <div className="staff-brand">
          <Image src="/eduquas-logo.png" alt="EduQuas" width={126} height={32} priority />
        </div>
        <div style={{ padding: "0 14px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <SkeletonText width={70} height={10} style={{ marginBottom: 10 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px" }}>
                  <Skeleton width={18} height={18} style={{ borderRadius: 4 }} />
                  <SkeletonText width={80} height={12} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <SkeletonText width={80} height={10} style={{ marginBottom: 10 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px" }}>
                  <Skeleton width={18} height={18} style={{ borderRadius: 4 }} />
                  <SkeletonText width={90} height={12} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="staff-profile" style={{ marginTop: "auto", pointerEvents: "none" }}>
          <SkeletonCircle size={32} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <SkeletonText width={90} height={12} />
            <SkeletonText width={60} height={9} />
          </div>
        </div>
      </aside>

      <main className="staff-main">
        <header className="staff-header">
          <div>
            <SkeletonText width={120} height={10} style={{ marginBottom: 8 }} />
            <SkeletonText width={240} height={26} style={{ marginBottom: 6 }} />
            <SkeletonText width={200} height={12} />
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <SkeletonCircle size={32} />
            <SkeletonCircle size={32} />
          </div>
        </header>

        <div className="staff-content">
          <DashboardSkeleton />
        </div>
      </main>
    </div>
  );
}
