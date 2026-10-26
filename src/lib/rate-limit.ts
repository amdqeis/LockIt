interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup stale keys every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix?: string;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(identifier: string, options: RateLimitOptions): RateLimitResult {
  const { windowMs, max, keyPrefix = "" } = options;
  const key = `${keyPrefix}:${identifier}`;
  const now = Date.now();

  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    const newRecord: RateLimitRecord = {
      count: 1,
      resetTime: now + windowMs,
    };
    rateLimitStore.set(key, newRecord);
    return {
      success: true,
      limit: max,
      remaining: max - 1,
      resetTime: newRecord.resetTime,
      retryAfterSeconds: 0,
    };
  }

  if (record.count >= max) {
    const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
    return {
      success: false,
      limit: max,
      remaining: 0,
      resetTime: record.resetTime,
      retryAfterSeconds,
    };
  }

  record.count += 1;
  return {
    success: true,
    limit: max,
    remaining: max - record.count,
    resetTime: record.resetTime,
    retryAfterSeconds: 0,
  };
}

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}
