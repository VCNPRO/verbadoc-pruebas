/**
 * api/lib/rateLimit.ts
 *
 * Rate limiting using in-memory store (works per serverless instance).
 * For production with multiple instances, use Vercel KV or Redis.
 *
 * Sliding window: configurable requests per window.
 */

interface RateLimitEntry {
  timestamps: number[];
}

// In-memory store (per serverless instance)
const store = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
const CLEANUP_INTERVAL = 60_000; // 1 min
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  const cutoff = now - windowMs;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter(t => t > cutoff);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

interface RateLimitOptions {
  /** Maximum number of requests in the window */
  maxRequests: number;
  /** Window size in milliseconds (default: 60000 = 1 minute) */
  windowMs?: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for a given key (usually IP or userId).
 */
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const { maxRequests, windowMs = 60_000 } = options;
  const now = Date.now();
  const cutoff = now - windowMs;

  cleanup(windowMs);

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter(t => t > cutoff);

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      resetAt: oldestInWindow + windowMs
    };
  }

  // Record this request
  entry.timestamps.push(now);

  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    resetAt: now + windowMs
  };
}

/**
 * Get rate limit key from request (prefer userId, fallback to IP).
 */
export function getRateLimitKey(req: any, userId?: string): string {
  if (userId) return `user:${userId}`;
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

/**
 * Apply rate limit headers to response.
 */
export function setRateLimitHeaders(res: any, result: RateLimitResult, maxRequests: number) {
  res.setHeader('X-RateLimit-Limit', maxRequests.toString());
  res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
  res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString());
}
