import type { NextRequest } from "next/server";
import { RateLimitError } from "./errors";

// In-memory token-bucket rate limiter; per-process, resets on restart, doesn't coordinate across instances.
interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

/** Consumes one token from `key`'s bucket (refills continuously at `limit`/`windowMs`), returning whether allowed. */
export function consumeToken(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const refillRatePerMs = limit / windowMs;
  const existing = buckets.get(key);
  const bucket: Bucket = existing ?? { tokens: limit, lastRefill: now };

  const elapsed = now - bucket.lastRefill;
  const refilled = Math.min(limit, bucket.tokens + elapsed * refillRatePerMs);

  if (refilled < 1) {
    buckets.set(key, { tokens: refilled, lastRefill: now });
    return false;
  }

  const remaining = refilled - 1;
  if (remaining >= limit) {
    buckets.delete(key);
  } else {
    buckets.set(key, { tokens: remaining, lastRefill: now });
  }
  return true;
}

/** Test-only: clears all bucket state between test cases. */
export function _resetRateLimitState(): void {
  buckets.clear();
}

/** Best-effort caller IP from standard proxy headers; falls back to "unknown" (still limits all-unknown callers together, better than not limiting at all). */
export function getClientIp(req: NextRequest | Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

interface RateLimitOptions {
  /** Namespace for this limiter, e.g. "auth.login" — combined with the caller's IP to form the bucket key. */
  key: string;
  limit: number;
  windowMs: number;
  /** Namespaced detail code for the thrown RateLimitError, e.g. "RATE_LIMIT.AUTH_LOGIN" — see server/http/errors.ts's code/detail convention. */
  detail: string;
}

/** Wraps a route handler to rate-limit per-caller-IP, throwing RateLimitError (429) once exhausted. Not applied to authenticated CRUD routes. */
export function withRateLimit(opts: RateLimitOptions) {
  return function <Args extends [NextRequest | Request, ...any[]]>(
    handler: (...args: Args) => Promise<Response>
  ) {
    return async (...args: Args): Promise<Response> => {
      const req = args[0];
      const ip = getClientIp(req);
      const allowed = consumeToken(`${opts.key}:${ip}`, opts.limit, opts.windowMs);
      if (!allowed) {
        throw new RateLimitError(undefined, opts.detail);
      }
      return handler(...args);
    };
  };
}
