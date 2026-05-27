import { Redis } from '@upstash/redis'

// Centralized Upstash Redis client
// Optimized for Edge & Serverless runtimes via HTTPS REST protocol
export const redis = new Redis({
  url: process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
})
