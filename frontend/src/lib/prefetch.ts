"use client";

import { staffApi } from "./staff-api";
import { queryCache } from "./data-cache";

type RouterLike = {
  prefetch: (url: string) => void;
};

// Map of route path to data prefetch functions
const routeDataPrefetchers: Record<string, () => void> = {
  "/dashboard": () => {
    void queryCache.prefetch(
      "/api/dashboard/overview",
      () => staffApi("/api/dashboard/overview"),
      30000
    );
  },
  "/dashboard/ujian": () => {
    void queryCache.prefetch(
      "/api/exams?limit=25",
      () => staffApi("/api/exams?limit=25"),
      60000
    );
  },
  "/dashboard/bank-soal": () => {
    void queryCache.prefetch(
      "/api/subjects",
      () => staffApi("/api/subjects"),
      300000
    );
    void queryCache.prefetch(
      "/api/question-banks?limit=25",
      () => staffApi("/api/question-banks?limit=25"),
      60000
    );
  },
  "/dashboard/monitoring": () => {
    void queryCache.prefetch(
      "/api/exams?status=active",
      () => staffApi("/api/exams?limit=25"),
      30000
    );
  },
  "/dashboard/hasil": () => {
    void queryCache.prefetch(
      "/api/dashboard/results/facets",
      () => staffApi("/api/dashboard/results/facets"),
      300000
    );
  },
  "/dashboard/guru": () => {
    void queryCache.prefetch(
      "/api/admin/teachers?page=1&limit=25",
      () => staffApi("/api/admin/teachers?page=1&limit=25"),
      60000
    );
  },
};

export function prefetchRouteAndData(path: string, router?: RouterLike): void {
  // 1. Prefetch Next.js route bundle
  if (router && typeof router.prefetch === "function") {
    try {
      router.prefetch(path);
    } catch {
      // Ignore prefetch errors
    }
  }

  // 2. Prefetch API data
  const normalizedPath = path.split("?")[0];
  const prefetchData = routeDataPrefetchers[normalizedPath];
  if (prefetchData) {
    prefetchData();
  }
}

export function getPrefetchProps(path: string, router?: RouterLike) {
  let prefetched = false;

  const trigger = () => {
    if (prefetched) return;
    prefetched = true;
    prefetchRouteAndData(path, router);
  };

  return {
    onMouseEnter: trigger,
    onFocus: trigger,
    onTouchStart: trigger,
  };
}

export function scheduleIdlePrefetch(paths: string[], router?: RouterLike): () => void {
  if (typeof window === "undefined") return () => {};

  // Check if network is constrained
  const connection = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection;
  if (connection?.saveData || (connection?.effectiveType && /2g/.test(connection.effectiveType))) {
    return () => {};
  }

  let cancelled = false;

  const execute = () => {
    if (cancelled) return;
    paths.forEach((path, index) => {
      window.setTimeout(() => {
        if (!cancelled) {
          prefetchRouteAndData(path, router);
        }
      }, index * 400);
    });
  };

  const handle =
    typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback(execute, { timeout: 2000 })
      : window.setTimeout(execute, 1000);

  return () => {
    cancelled = true;
    if (typeof window.cancelIdleCallback === "function" && typeof handle === "number") {
      window.cancelIdleCallback(handle);
    } else {
      window.clearTimeout(handle);
    }
  };
}

