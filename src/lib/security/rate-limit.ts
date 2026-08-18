/**
 * Simple in-memory rate limiter for server actions.
 * For production with multiple instances, use Redis-based rate limiting.
 */

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 30,
};

const STRICT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 5,
};

/**
 * Check rate limit for a given key (e.g., userId, IP, action name).
 * Returns true if allowed, false if rate limited.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + config.windowMs });
    return true;
  }

  if (entry.count >= config.maxRequests) {
    return false;
  }

  entry.count += 1;
  return true;
}

/**
 * Rate limit config for sensitive actions (login, password reset, etc.)
 */
export function checkStrictRateLimit(key: string): boolean {
  return checkRateLimit(key, STRICT_CONFIG);
}

/**
 * Clean up expired entries periodically (call in a long-running process)
 */
export function cleanupRateLimit(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}

// Auto-cleanup every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(cleanupRateLimit, 5 * 60 * 1000);
}
