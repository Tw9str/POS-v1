import "server-only";

/**
 * In-memory sliding-window rate limiter.
 *
 * Each limiter instance tracks requests per key (typically IP address).
 * Old entries are pruned on every check to prevent unbounded memory growth.
 */

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimiterOptions {
  /** Maximum number of requests allowed in the window. */
  limit: number;
  /** Window size in seconds. */
  windowSeconds: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

export function rateLimit({ limit, windowSeconds }: RateLimiterOptions) {
  const storeKey = `${limit}:${windowSeconds}`;
  if (!stores.has(storeKey)) {
    stores.set(storeKey, new Map());
  }
  const store = stores.get(storeKey)!;

  return {
    /**
     * Check if a request from `key` is allowed.
     * Returns `{ success: true }` if under the limit,
     * or `{ success: false, retryAfterSeconds }` if rate-limited.
     */
    check(
      key: string,
    ): { success: true } | { success: false; retryAfterSeconds: number } {
      const now = Date.now();
      const windowMs = windowSeconds * 1000;
      const cutoff = now - windowMs;

      let entry = store.get(key);
      if (!entry) {
        entry = { timestamps: [] };
        store.set(key, entry);
      }

      // Remove expired timestamps
      entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

      if (entry.timestamps.length >= limit) {
        const oldest = entry.timestamps[0];
        const retryAfterSeconds = Math.ceil((oldest + windowMs - now) / 1000);
        return { success: false, retryAfterSeconds };
      }

      entry.timestamps.push(now);
      return { success: true };
    },
  };
}

/**
 * Extract client IP from request headers.
 * Uses cf-connecting-ip (Cloudflare) first for reliability,
 * then x-forwarded-for rightmost-untrusted IP, then x-real-ip.
 */
export function getClientIp(request: Request): string {
  // Cloudflare sets this header and it cannot be spoofed by the client
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const ips = xff.split(",").map((s) => s.trim());
    // Use the rightmost IP (closest to our server) which is harder to spoof
    // In a single-proxy setup this is the client IP added by the proxy
    return ips[ips.length - 1] || "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
