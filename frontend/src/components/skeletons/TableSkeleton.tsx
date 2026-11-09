"use client";

import { LoadingContainer, Skeleton, SkeletonText } from "./Skeleton";

export function TableSkeleton({
  columns = 5,
  rows = 6,
  label = "Memuat data tabel...",
}: {
  columns?: number;
  rows?: number;
  label?: string;
}) {
  return (
    <LoadingContainer label={label}>
      <div className="staff-table-wrap">
        <table className="staff-table" style={{ width: "100%", pointerEvents: "none" }}>
          <thead>
            <tr>
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i}>
                  <SkeletonText width={i === 0 ? 120 : 80} height={12} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r}>
                {Array.from({ length: columns }).map((_, c) => (
                  <td key={c}>
                    {c === 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <SkeletonText width={130} height={13} />
                        <SkeletonText width={80} height={10} />
                      </div>
                    ) : c === columns - 1 ? (
                      <Skeleton width={70} height={26} style={{ borderRadius: 6 }} />
                    ) : (
                      <SkeletonText width={60} height={12} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav className="staff-pagination" aria-label="Memuat navigasi halaman">
        <SkeletonText width={160} height={12} />
        <div style={{ display: "flex", gap: 8 }}>
          <Skeleton width={76} height={32} style={{ borderRadius: 6 }} />
          <Skeleton width={76} height={32} style={{ borderRadius: 6 }} />
        </div>
      </nav>
    </LoadingContainer>
  );
}

export function ListRowsSkeleton({
  rows = 5,
  label = "Memuat daftar...",
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <LoadingContainer label={label}>
      <div className="staff-list">
        {Array.from({ length: rows }).map((_, i) => (
          <div className="staff-row staff-exam-row" key={i} style={{ pointerEvents: "none" }}>
            <span style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <SkeletonText width={180} height={14} style={{ borderRadius: 4 }} />
              <SkeletonText width={140} height={10} style={{ borderRadius: 4 }} />
            </span>
            <Skeleton width={64} height={20} style={{ borderRadius: 999 }} />
            <div className="staff-row-actions" style={{ display: "flex", gap: 6 }}>
              <Skeleton width={50} height={28} style={{ borderRadius: 6 }} />
              <Skeleton width={80} height={28} style={{ borderRadius: 6 }} />
            </div>
          </div>
        ))}
      </div>
      <nav className="staff-pagination" aria-label="Memuat navigasi">
        <SkeletonText width={140} height={12} />
        <div style={{ display: "flex", gap: 8 }}>
          <Skeleton width={76} height={32} style={{ borderRadius: 6 }} />
          <Skeleton width={76} height={32} style={{ borderRadius: 6 }} />
        </div>
      </nav>
    </LoadingContainer>
  );
}

