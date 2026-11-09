import { createHash } from "crypto";
import { createClient } from "redis";

const TTL_SECONDS = 10;
const RETRY_DELAY_MS = 10_000;
function makeClient(url: string) {
  return createClient({ url, disableOfflineQueue: true, socket: { connectTimeout: 500, reconnectStrategy: false } });
}
type Client = ReturnType<typeof makeClient>;
type CacheState = { client: Client | null; connecting: Promise<Client | null> | null; retryAfter: number };
const globalCache = globalThis as typeof globalThis & { dashboardCache?: CacheState };
const state = globalCache.dashboardCache ??= { client: null, connecting: null, retryAfter: 0 };

async function redisClient(): Promise<Client | null> {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (state.client?.isReady) return state.client;
  if (state.connecting) return state.connecting;
  if (Date.now() < state.retryAfter) return null;
  const client = makeClient(url);
  client.on("error", () => { /* Cache failures must not interrupt dashboard requests. */ });
  state.connecting = client.connect().then(() => {
    state.client = client;
    return client;
  }).catch(() => {
    state.retryAfter = Date.now() + RETRY_DELAY_MS;
    if (client.isOpen) client.destroy();
    return null;
  }).finally(() => { state.connecting = null; });
  return state.connecting;
}

export function dashboardCacheKey(role: string, teacherId: string): string {
  const scope = role === "ADMIN" ? "admin" : `teacher:${createHash("sha256").update(teacherId).digest("hex")}`;
  return `eduquas:dashboard:overview:v1:${scope}`;
}

export async function readDashboardCache<T>(key: string): Promise<T | null> {
  try {
    const client = await redisClient();
    if (!client) return null;
    const value = await client.withAbortSignal(AbortSignal.timeout(300)).get(key);
    return value === null ? null : JSON.parse(value) as T;
  } catch { return null; }
}

export async function writeDashboardCache(key: string, value: unknown): Promise<void> {
  try {
    const client = await redisClient();
    if (client) await client.withAbortSignal(AbortSignal.timeout(300)).set(key, JSON.stringify(value), { EX: TTL_SECONDS });
  } catch { /* A failed cache write does not affect the source of truth. */ }
}
