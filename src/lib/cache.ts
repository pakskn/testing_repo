import { redis } from './redis'

// Check if credentials are set to enable Redis caching, otherwise fallback to In-Memory Map
const isRedisEnabled = !!(
  process.env.REDIS_URL ||
  (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
)

// ── OFFLINE IN-MEMORY CACHE ENGINE (High-Performance Fallback) ─────────────────
interface CacheRecord {
  value: any
  expiresAt: number
}

const memoryCache = new Map<string, CacheRecord>()

export async function getCache<T>(key: string): Promise<T | null> {
  const now = Date.now()

  // 1. Try Upstash Redis
  if (isRedisEnabled) {
    try {
      const cached = await redis.get(key)
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
  if (isRedisEnabled) {
    try {
      await redis.set(key, JSON.stringify(value), { ex: ttlSeconds })
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
  if (isRedisEnabled) {
    try {
      await redis.del(key)
      return
    } catch (err) {
      console.error('Redis invalidateCache error, falling back to In-Memory:', err)
    }
  }
  memoryCache.delete(key)
}
