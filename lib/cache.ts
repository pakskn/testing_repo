import { Redis } from '@upstash/redis'

let redisClient: Redis | null = null

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  } catch (err) {
    console.warn('Failed to initialize Upstash Redis client. Falling back to In-Memory cache:', err)
  }
}

// ── OFFLINE IN-MEMORY CACHE ENGINE (High-Performance Fallback) ─────────────────
interface CacheRecord {
  value: any
  expiresAt: number
}

const memoryCache = new Map<string, CacheRecord>()

export async function getCache<T>(key: string): Promise<T | null> {
  const now = Date.now()

  // 1. Try Upstash Redis
  if (redisClient) {
    try {
      const cached = await redisClient.get(key)
      if (cached) {
        // Upstash Redis SDK auto-parses JSON, but we ensure structure compatibility
        return (typeof cached === 'string' ? JSON.parse(cached) : cached) as T
      }
      return null
    } catch (err) {
      console.error('Redis getCache error, falling back to In-Memory:', err)
    }
  }

  // 2. Try In-Memory Fallback
  const record = memoryCache.get(key)
  if (record) {
    if (now < record.expiresAt) {
      return record.value as T
    }
    // Lazy delete expired record
    memoryCache.delete(key)
  }

  return null
}

export async function setCache<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const now = Date.now()

  // 1. Try Upstash Redis
  if (redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(value), { ex: ttlSeconds })
      return
    } catch (err) {
      console.error('Redis setCache error, falling back to In-Memory:', err)
    }
  }

  // 2. Try In-Memory Fallback
  memoryCache.set(key, {
    value,
    expiresAt: now + ttlSeconds * 1000,
  })

  // Prevent memory leaks: lazy prune memoryCache if it gets large (> 2,000 keys)
  if (memoryCache.size > 2000) {
    memoryCache.forEach((v, k) => {
      if (now >= v.expiresAt) {
        memoryCache.delete(k)
      }
    })
  }
}

export async function invalidateCache(key: string): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.del(key)
      return
    } catch (err) {
      console.error('Redis invalidateCache error, falling back to In-Memory:', err)
    }
  }
  memoryCache.delete(key)
}
