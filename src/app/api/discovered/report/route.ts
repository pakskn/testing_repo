import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// ── IN-MEMORY RATE LIMITING STORES (Zero-Dependency & Self-Contained) ────────
// Key formats:
// - `ip:<ip>`
// - `channel:<channelId>`
const ipLimitStore = new Map<string, { count: number; windowReset: number }>()
const channelLimitStore = new Map<string, { count: number; windowReset: number }>()

const IP_MAX_REQUESTS = 10
const IP_WINDOW_MS = 60000 // 1 minute

const CHANNEL_MAX_REQUESTS = 3
const CHANNEL_WINDOW_MS = 3600000 // 1 hour

// Helper to clean maps lazy-pruning when they get large (> 5,000 items)
function lazyPruneCache(store: Map<string, any>, now: number) {
  if (store.size > 5000) {
    store.forEach((v, k) => {
      if (now > v.windowReset) {
        store.delete(k)
      }
    })
  }
}

export async function POST(req: NextRequest) {
  const now = Date.now()

  // Extract client IP securely
  const ip =
    req.ip ||
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // LAYER 1: Origin & Referer Protection
    // ─────────────────────────────────────────────────────────────────────────
    const origin = req.headers.get('origin') || ''
    const referer = req.headers.get('referer') || ''

    const isYoutubeOrigin = origin.startsWith('https://www.youtube.com') || origin.startsWith('https://youtube.com')
    const isYoutubeReferer = referer.startsWith('https://www.youtube.com') || referer.startsWith('https://youtube.com')

    if (!isYoutubeOrigin && !isYoutubeReferer) {
      console.warn(`[Suspicious Request]: Blocked by Layer 1 (Origin/Referer). Origin: "${origin}", Referer: "${referer}", IP: ${ip}`)
      return NextResponse.json({ error: 'Forbidden: Request origin invalid' }, { status: 403 })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LAYER 2: Secret Key Authentication
    // ─────────────────────────────────────────────────────────────────────────
    const extKeyHeader = req.headers.get('x-extension-key')
    const serverSecret = process.env.EXTENSION_SECRET_KEY || 'niche_finder_secret_ext_key_2026_xyz'

    if (!extKeyHeader || extKeyHeader !== serverSecret) {
      console.warn(`[Suspicious Request]: Blocked by Layer 2 (Secret Key Auth). Supplied Key: "${extKeyHeader}", IP: ${ip}`)
      return NextResponse.json({ error: 'Unauthorized: Invalid extension secret key' }, { status: 401 })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LAYER 3: Strong Rate Limiting (IP & reported channelId)
    // ─────────────────────────────────────────────────────────────────────────
    // 3a. IP Rate Limiting (Max 10 reqs per minute)
    lazyPruneCache(ipLimitStore, now)
    const ipKey = `ip:${ip}`
    let ipRecord = ipLimitStore.get(ipKey)

    if (!ipRecord || now > ipRecord.windowReset) {
      ipRecord = { count: 0, windowReset: now + IP_WINDOW_MS }
    }

    if (ipRecord.count >= IP_MAX_REQUESTS) {
      console.warn(`[Rate Limit Exceeded]: IP "${ip}" exceeded maximum limit of ${IP_MAX_REQUESTS} requests/min.`)
      return NextResponse.json(
        { error: 'Too Many Requests', message: 'IP rate limit exceeded.' },
        { status: 429, headers: { 'Retry-After': Math.ceil((ipRecord.windowReset - now) / 1000).toString() } }
      )
    }
    ipRecord.count++
    ipLimitStore.set(ipKey, ipRecord)

    // Parse Body
    const body = await req.json()
    const { channelId, channelName, channelHandle, thumbnailUrl, subscribers } = body

    // ─────────────────────────────────────────────────────────────────────────
    // LAYER 4: Strict Schema Data Validation & channelId checks
    // ─────────────────────────────────────────────────────────────────────────
    if (!channelId || !channelName) {
      console.warn(`[Suspicious Request]: Missing required params. IP: ${ip}`)
      return NextResponse.json({ error: 'Bad Request: Missing channelId or channelName' }, { status: 400 })
    }

    // YouTube channel IDs must start with 'UC' and have exactly 24 alphanumeric/hyphen characters
    const ytChannelIdRegex = /^UC[A-Za-z0-9_-]{22}$/
    if (!ytChannelIdRegex.test(channelId)) {
      console.warn(`[Suspicious Request]: Blocked by Layer 4 (Invalid channelId format: "${channelId}"). IP: ${ip}`)
      return NextResponse.json({ error: 'Bad Request: Invalid channelId format' }, { status: 400 })
    }

    if (typeof channelName !== 'string' || channelName.trim().length === 0 || channelName.length > 150) {
      console.warn(`[Suspicious Request]: Blocked by Layer 4 (Invalid channelName). IP: ${ip}`)
      return NextResponse.json({ error: 'Bad Request: Invalid channelName parameter' }, { status: 400 })
    }

    // 3b. Reported ChannelId Rate Limiting (Max 3 reqs per hour to prevent spamming single ID)
    lazyPruneCache(channelLimitStore, now)
    const channelKey = `channel:${channelId}`
    let channelRecord = channelLimitStore.get(channelKey)

    if (!channelRecord || now > channelRecord.windowReset) {
      channelRecord = { count: 0, windowReset: now + CHANNEL_WINDOW_MS }
    }

    if (channelRecord.count >= CHANNEL_MAX_REQUESTS) {
      console.warn(`[Rate Limit Exceeded]: ChannelId "${channelId}" exceeded max spam limit of ${CHANNEL_MAX_REQUESTS} requests/hour. IP: ${ip}`)
      return NextResponse.json(
        { error: 'Too Many Requests', message: 'Channel reporting rate limit exceeded.' },
        { status: 429, headers: { 'Retry-After': Math.ceil((channelRecord.windowReset - now) / 1000).toString() } }
      )
    }
    channelRecord.count++
    channelLimitStore.set(channelKey, channelRecord)

    // ─────────────────────────────────────────────────────────────────────────
    // DB UPSERT LOGIC
    // ─────────────────────────────────────────────────────────────────────────
    // 1. Check if already exists in the main Channel table (if so, ignore)
    const existsInMain = await prisma.channel.findUnique({
      where: { channelId }
    })

    if (existsInMain) {
      return NextResponse.json({ success: true, message: 'Channel already exists in database' })
    }

    // 2. Upsert in DiscoveredChannel
    const subsCount = Number(subscribers) || 0
    await prisma.discoveredChannel.upsert({
      where: { channelId },
      update: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date(),
        subscribers: subsCount > 0 ? subsCount : undefined, // Update subs size only if valid
        channelName,
        channelHandle: channelHandle || undefined,
        thumbnailUrl: thumbnailUrl || undefined,
      },
      create: {
        channelId,
        channelName,
        channelHandle: channelHandle || null,
        thumbnailUrl: thumbnailUrl || null,
        subscribers: subsCount,
        viewCount: 1,
        status: 'pending'
      }
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[Discovery API Error]:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
