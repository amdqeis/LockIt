"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type CacheEntry<T> = {
  data: T;
  timestamp: number;
  ttlMs: number;
};

type Listener = () => void;

class QueryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private inFlight = new Map<string, Promise<unknown>>();
  private listeners = new Map<string, Set<Listener>>();

  get<T>(key: string): { data: T; isStale: boolean } | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    const isStale = Date.now() - entry.timestamp > entry.ttlMs;
    return { data: entry.data, isStale };
  }

  set<T>(key: string, data: T, ttlMs = 60000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttlMs,
    });
    this.notify(key);
  }

  async fetch<T>(key: string, fetcher: () => Promise<T>, ttlMs = 60000): Promise<T> {
    const cached = this.get<T>(key);
    if (cached) {
      if (cached.isStale) {
        // Trigger background revalidation without waiting
        void this.revalidate(key, fetcher, ttlMs);
      }
      return cached.data;
    }

    if (this.inFlight.has(key)) {
      return this.inFlight.get(key) as Promise<T>;
    }

    const promise = fetcher()
      .then((data) => {
        this.set(key, data, ttlMs);
        return data;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  private async revalidate<T>(key: string, fetcher: () => Promise<T>, ttlMs: number): Promise<void> {
    if (this.inFlight.has(key)) return;
    const promise = fetcher()
      .then((data) => {
        this.set(key, data, ttlMs);
        return data;
      })
      .catch(() => {
        // Keep stale data on revalidation error
      })
      .finally(() => {
        this.inFlight.delete(key);
      });
    this.inFlight.set(key, promise);
    await promise;
  }

  async prefetch<T>(key: string, fetcher: () => Promise<T>, ttlMs = 60000): Promise<T> {
    const cached = this.get<T>(key);
    if (cached && !cached.isStale) {
      return cached.data;
    }
    return this.fetch(key, fetcher, ttlMs);
  }

  invalidate(pattern: string | RegExp | ((key: string) => boolean)): void {
    const matches: string[] = [];
    for (const key of this.cache.keys()) {
      let isMatch = false;
      if (typeof pattern === "string") {
        isMatch = key.startsWith(pattern) || key.includes(pattern);
      } else if (pattern instanceof RegExp) {
        isMatch = pattern.test(key);
      } else if (typeof pattern === "function") {
        isMatch = pattern(key);
      }
      if (isMatch) {
        matches.push(key);
      }
    }
    for (const key of matches) {
      this.cache.delete(key);
      this.notify(key);
    }
  }

  clear(): void {
    this.cache.clear();
    this.inFlight.clear();
    for (const set of this.listeners.values()) {
      set.forEach((fn) => fn());
    }
    this.listeners.clear();
  }

  subscribe(key: string, listener: Listener): () => void {
    let set = this.listeners.get(key);
    if (!set) {
      set = new Set();
      this.listeners.set(key, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
      if (set && set.size === 0) {
        this.listeners.delete(key);
      }
    };
  }

  private notify(key: string): void {
    const set = this.listeners.get(key);
    if (set) {
      set.forEach((fn) => fn());
    }
  }
}

export const queryCache = new QueryCache();

export type UseCachedQueryOptions = {
  ttlMs?: number;
  enabled?: boolean;
  revalidateOnMount?: boolean;
};

export function useCachedQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: UseCachedQueryOptions = {}
) {
  const { ttlMs = 60000, enabled = true } = options;

  const [data, setData] = useState<T | null>(() => (key ? queryCache.get<T>(key)?.data ?? null : null));
  const [loading, setLoading] = useState<boolean>(() => Boolean(enabled && key !== null && !queryCache.get<T>(key)));
  const [isRefetching, setIsRefetching] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const reload = useCallback(async () => {
    if (!key || !enabled) return;
    setIsRefetching(true);
    try {
      const fresh = await queryCache.fetch(key, () => fetcherRef.current(), ttlMs);
      setData(fresh);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data.");
    } finally {
      setLoading(false);
      setIsRefetching(false);
    }
  }, [key, enabled, ttlMs]);

  useEffect(() => {
    if (!key || !enabled) return;

    let mounted = true;

    queryCache
      .fetch(key, () => fetcherRef.current(), ttlMs)
      .then((fresh) => {
        if (mounted) {
          setData(fresh);
          setLoading(false);
          setIsRefetching(false);
          setError("");
        }
      })
      .catch((err) => {
        if (mounted) {
          setLoading(false);
          setIsRefetching(false);
          setError(err instanceof Error ? err.message : "Gagal memuat data.");
        }
      });

    const unsubscribe = queryCache.subscribe(key, () => {
      const updated = queryCache.get<T>(key);
      if (updated && mounted) {
        setData(updated.data);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [key, enabled, ttlMs]);

  const mutate = useCallback(
    (next: T | ((prev: T | null) => T)) => {
      if (!key) return;
      const value = typeof next === "function" ? (next as (prev: T | null) => T)(data) : next;
      queryCache.set(key, value, ttlMs);
      setData(value);
    },
    [key, data, ttlMs]
  );

  return {
    data,
    loading,
    isRefetching,
    error,
    mutate,
    reload,
  };
}
