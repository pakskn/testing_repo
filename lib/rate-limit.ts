import { NextRequest } from 'next/server'

// ── TYPES & INTERFACES ────────────────────────────────────────────────────────
export interface RateLimitResponse {
  success: boolean
  limit: number
  remaining: number
  reset: number // timestamp in ms when the limit fully resets
}

interface InMemRecord {
  tokens: number
  lastRefill: number
}

// ── ENVIRONMENT CONFIGURATION ────────────────────────────────────────────────
const DEFAULT_WINDOW_MS = 60000 // 1 minute
const DEFAULT_MAX = 100

const DEFAULT_ADMIN_WINDOW_MS = 60000 // 1 minute
const DEFAULT_ADMIN_MAX = 30

// ── IN-MEMORY RATE LIMIT ENGINE (Zero-Dependency & High-Performance) ─────────
const cache = new Map<string, InMemRecord>()

/**
 * Custom Token Bucket Rate Limiter with Lazy Pruning.
 * Perfect for single-server standalone Node.js and local dev environment.
 */
function inMemoryRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResponse {
  const now = Date.now()
  const refillRate = maxRequests / windowMs // tokens refilled per millisecond

  // 1. Lazy memory pruning if cache size gets large (> 10,000 concurrent IPs)
  if (cache.size > 10000) {
    cache.forEach((v, k) => {
      // If the record has not been touched in more than the window limit, prune it safely
      if (now - v.lastRefill > windowMs) {
        cache.delete(k)
      }
    })
  }

  // 2. Fetch or initialize the token bucket
  let record = cache.get(key)
  if (!record) {
    record = {
      tokens: maxRequests,
      lastRefill: now,
    }
  }

  // 3. Calculate dynamic refill
  const elapsedMs = now - record.lastRefill
  const newlyRefilled = elapsedMs * refillRate
  const tokens = Math.min(maxRequests, record.tokens + newlyRefilled)

  // 4. Evaluate limit
  if (tokens >= 1) {
    record.tokens = tokens - 1
    record.lastRefill = now
    cache.set(key, record)

    return {
      success: true,
      limit: maxRequests,
      remaining: Math.floor(record.tokens),
      reset: now + Math.max(0, (maxRequests - record.tokens) / refillRate),
    }
  } else {
    // Exceeded rate limit
    record.tokens = tokens
    record.lastRefill = now
    cache.set(key, record)

    // Calculate time to wait before at least 1 token is refilled
    const waitTimeMs = (1 - tokens) / refillRate
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      reset: now + waitTimeMs,
    }
  }
}

// ── UPSTASH REDIS CLUSTERING (Lazy loaded on execution) ──────────────────────
let redisClient: any = null
let upstashRateLimit: any = null

async function getUpstashLimiter() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }

  if (!redisClient || !upstashRateLimit) {
    try {
      // Lazy load standard packages to avoid compile failures when not installed
      const { Redis } = await import('@upstash/redis')
      const { Ratelimit } = await import('@upstash/ratelimit')

      redisClient = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })

      upstashRateLimit = Ratelimit
    } catch (err) {
      console.warn('Failed to initialize Upstash Redis. Falling back to in-memory rate limiter:', err)
      return null
    }
  }

  return { redis: redisClient, Ratelimit: upstashRateLimit }
}

// ── CORE RATE LIMIT METHOD ───────────────────────────────────────────────────
/**
 * Core rateLimit function to run on all endpoints.
 * @param req NextRequest
 * @param pathOverride Optional path selector to determine admin limits
 * @param userIdOptional Optional authenticated user's ID/Email (NextAuth token sub/email)
 */
export async function rateLimit(
  req: NextRequest,
  pathOverride?: string,
  userIdOptional?: string
): Promise<RateLimitResponse> {
  const path = pathOverride || new URL(req.url).pathname
  const isAdminRoute = path.startsWith('/api/admin') || path.startsWith('/admin')

  // Load environment variables dynamically with strict defaults
  const limitMax = parseInt(
    process.env.RATE_LIMIT_MAX || String(DEFAULT_MAX),
    10
  )
  const limitWindow = parseInt(
    process.env.RATE_LIMIT_WINDOW_MS || String(DEFAULT_WINDOW_MS),
    10
  )

  const adminLimitMax = parseInt(
    process.env.RATE_LIMIT_ADMIN_MAX || String(DEFAULT_ADMIN_MAX),
    10
  )
  const adminLimitWindow = parseInt(
    process.env.RATE_LIMIT_ADMIN_WINDOW_MS || String(DEFAULT_ADMIN_WINDOW_MS),
    10
  )

  const maxRequests = isAdminRoute ? adminLimitMax : limitMax
  const windowMs = isAdminRoute ? adminLimitWindow : limitWindow

  // Extract client IP address securely
  const ip =
    req.ip ||
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'

  // Build composite user key: userId + IP, or fallback to anonymous + IP
  const userIdentifier = userIdOptional ? `user:${userIdOptional}` : 'anonymous'
  const rateLimitKey = `ratelimit:${isAdminRoute ? 'admin' : 'general'}:${userIdentifier}:${ip}`

  // Try clustered Upstash Redis first (if environment credentials are present)
  const upstash = await getUpstashLimiter()
  if (upstash) {
    try {
      const limiter = new upstash.Ratelimit({
        redis: upstash.redis,
        // Sliding window rate limit logic
        limiter: upstash.Ratelimit.slidingWindow(maxRequests, `${windowMs} ms`),
        analytics: true,
        prefix: '@upstash/ratelimit',
      })

      const { success, limit, remaining, reset } = await limiter.limit(rateLimitKey)
      return {
        success,
        limit,
        remaining,
        reset,
      }
    } catch (err) {
      console.error('Upstash Rate Limiting failed. Falling back to In-Memory rate limiter:', err)
    }
  }

  // Fallback to offline high-performance in-memory rate limiting
  return inMemoryRateLimit(rateLimitKey, maxRequests, windowMs)
}
