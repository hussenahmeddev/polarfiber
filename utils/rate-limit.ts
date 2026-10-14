interface Bucket {
  count: number;
  resetAt: number;
}

// Per-process only. On multi-instance hosting each instance enforces its own
// limit, which is the accepted trade-off (documented decision) versus adding a
// DB round-trip to every public request.
const buckets = new Map<string, Bucket>();

const MAX_TRACKED_KEYS = 5000;

function prune(now: number): void {
  if (buckets.size < MAX_TRACKED_KEYS) return;
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  prune(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: Math.max(0, max - 1), retryAfterSec: 0 };
  }

  existing.count += 1;
  const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

  if (existing.count > max) {
    return { ok: false, remaining: 0, retryAfterSec };
  }
  return { ok: true, remaining: max - existing.count, retryAfterSec: 0 };
}

/** Clears a bucket — used after a successful verification. */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

export function clearRateLimits(): void {
  buckets.clear();
}
