// server/middleware/rateLimit.js
import { getRedis } from "../lib/redis.js";

/**
 * Redis-based sliding window rate limiter.
 * Falls back to in-memory if Redis is unavailable.
 */

/* ── In-memory fallback ─────────────────────────────────── */
const memStore = new Map();

function memCheck(key, limit, windowMs) {
  const now = Date.now();
  const rec = memStore.get(key) || { count: 0, resetAt: now + windowMs };

  if (now > rec.resetAt) {
    rec.count   = 1;
    rec.resetAt = now + windowMs;
  } else {
    rec.count++;
  }

  memStore.set(key, rec);

  /* Clean old entries every 1000 checks */
  if (memStore.size > 1_000) {
    for (const [k, v] of memStore) {
      if (now > v.resetAt) memStore.delete(k);
    }
  }

  return rec.count <= limit;
}

/* ── Middleware factory ──────────────────────────────────── */
export function rateLimit({
  windowMs  = 60_000,  // 1 minute
  max       = 60,      // requests per window
  keyPrefix = "rl",
} = {}) {
  const windowSec = Math.ceil(windowMs / 1_000);

  return async (req, res, next) => {
    const ip  = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const key = `${keyPrefix}:${ip}`;

    try {
      const r = await getRedis();

      if (r) {
        /* Redis sliding window */
        const count = await r.incr(key);
        if (count === 1) await r.expire(key, windowSec);

        res.set("X-RateLimit-Limit",     String(max));
        res.set("X-RateLimit-Remaining", String(Math.max(0, max - count)));

        if (count > max) {
          return res.status(429).json({
            error  : "Too many requests",
            retryIn: `${windowSec}s`,
          });
        }
      } else {
        /* In-memory fallback */
        if (!memCheck(key, max, windowMs)) {
          return res.status(429).json({
            error  : "Too many requests",
            retryIn: `${windowSec}s`,
          });
        }
      }
    } catch {
      /* Rate limiter error → allow request through */
    }

    next();
  };
}

/* ── Pre-configured limiters ────────────────────────────── */
export const homepageLimiter = rateLimit({
  windowMs  : 60_000,
  max       : 120,   // 120 req/min per IP
  keyPrefix : "rl:homepage",
});

export const analyticsLimiter = rateLimit({
  windowMs  : 60_000,
  max       : 300,   // 300 clicks/views per min
  keyPrefix : "rl:analytics",
});