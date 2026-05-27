import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { auth } from '@/lib/auth'

function parseDurationSecs(dur: string | null): number {
  if (!dur) return 0
  const p = dur.split(':').map(Number)
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2]
  if (p.length === 2) return p[0] * 60 + p[1]
  return p[0] || 0
}

// Duration subtype ranges (seconds)
const SUBTYPE_RANGES: Record<string, { min: number; max: number }> = {
  micro:           { min: 0,    max: 179   },
  standard_long:   { min: 180,  max: 1199  },
  prime:           { min: 1200, max: 3599  },
  ultra:           { min: 3600, max: 43200 },
  nano:            { min: 0,    max: 12    },
  standard_shorts: { min: 14,   max: 60    },
  super:           { min: 60,   max: 179   },
}

export async function GET(req: NextRequest) {
  // Local route fallback rate limiting
  const session = await auth()
  const userId = session?.user?.id || session?.user?.email || undefined
  const limitResult = await rateLimit(req, undefined, userId)

  if (!limitResult.success) {
    const resetSeconds = Math.max(1, Math.ceil((limitResult.reset - Date.now()) / 1000))
    return new NextResponse(
      JSON.stringify({
        error: 'Too Many Requests',
        message: 'You have exceeded the rate limit. Please try again later.',
        remaining: limitResult.remaining,
        limit: limitResult.limit,
        reset: limitResult.reset,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': resetSeconds.toString(),
          'X-RateLimit-Limit': limitResult.limit.toString(),
          'X-RateLimit-Remaining': limitResult.remaining.toString(),
          'X-RateLimit-Reset': Math.ceil(limitResult.reset / 1000).toString(),
        },
      }
    )
  }

  const { searchParams } = new URL(req.url)

  const channelType     = searchParams.get('channelType')   || 'long_form'
  const search          = searchParams.get('search')        || ''
  const niches          = searchParams.get('niches')?.split(',').filter(Boolean) || []
  const excludeNiches   = searchParams.get('excludeNiches')?.split(',').filter(Boolean) || []
  const onlyKids        = searchParams.get('onlyKids')    === 'true'
  const onlyNews        = searchParams.get('onlyNews')    === 'true'
  const excludeKids          = searchParams.get('excludeKids')           === 'true'
  const excludeNews          = searchParams.get('excludeNews')           === 'true'
  const includeNews          = searchParams.get('includeNews')           === 'true'
  const excludeEntertainment = searchParams.get('excludeEntertainment')  === 'true'
  const includeEntertainment = searchParams.get('includeEntertainment')  === 'true'
  const onlyFaceless         = searchParams.get('onlyFaceless')          === 'true'
  const durationSubtype = searchParams.get('durationSubtype') || ''
  const outlierOnly     = searchParams.get('outlierOnly') === 'true'
  const dateFr          = searchParams.get('dateFrom') || ''
  const language        = searchParams.get('language') || 'all'

  // For Long Form (faceless only), auto-apply 4-year filter if no explicit dateFrom
  const fourYearsAgo = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 3); return d })()
  const dateFrom = dateFr
    ? dateFr
    : (onlyFaceless ? fourYearsAgo.toISOString().split('T')[0] : '')
  const page            = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit           = Math.min(40, parseInt(searchParams.get('limit') || '20'))
  const skip            = (page - 1) * limit

  // Build niche/category OR filter for Songs/Movies (Music niches OR News OR Entertainment)
  const orConditions: any[] = []
  if (niches.length > 0) orConditions.push({ niche: { in: niches } })
  if (includeNews)        orConditions.push({ isNews: true })
  if (includeEntertainment) orConditions.push({ isEntertainment: true })

  const nicheFilter = orConditions.length > 0
    ? { OR: orConditions }
    : {}

  const channelWhere: any = {
    channelType,
    isActive: true,
    ...(orConditions.length > 0      ? nicheFilter                        : {}),
    ...(excludeNiches.length > 0     ? { niche: { notIn: excludeNiches } } : {}),
    ...(onlyKids                     ? { isKids: true }                   : {}),
    ...(onlyNews                     ? { isNews: true }                   : {}),
    ...(excludeKids                  ? { isKids: false }                  : {}),
    ...(excludeNews                  ? { isNews: false }                  : {}),
    ...(excludeEntertainment         ? { isEntertainment: false }         : {}),
    ...(onlyFaceless                 ? { isFaceless: true }               : {}),
  }

  const MUSIC_TITLE_PATTERNS = [
    'official video', 'official music video', 'music video', 'official mv',
    'official audio', 'lyric video', 'lyrics video', 'official lyric',
    '(official)', 'official clip', 'official hd', 'official 4k',
    'full song', 'audio song', 'new song', 'latest song',
    'official vevo', 'hd official', 'live performance', 'official live',
    'acoustic version', 'radio edit', 'extended mix', 'feat.', 'ft.',
  ]

  // Build video filter with DB-level date filter (Prisma handles SQLite DateTime correctly)
  const andClauses: any[] = [
    { channel: channelWhere },
    ...(outlierOnly ? [{ isOutlier: true }] : []),
    ...(dateFrom    ? [{ publishedAt: { gte: new Date(dateFrom) } }] : []),
    ...(excludeNiches.includes('Music')
      ? [{ NOT: { OR: MUSIC_TITLE_PATTERNS.map(p => ({ title: { contains: p } })) } }]
      : []),
    ...(language !== 'all' ? [{ language: language }] : []),
    ...(search ? [{
      OR: [
        { title:   { contains: search } },
        { channel: { channelName: { contains: search } } },
        { channel: { niche:       { contains: search } } },
      ]
    }] : []),
  ]

  const where: any = { AND: andClauses }

  // JS backup filter for date (handles any format edge cases)
  const dateCutoff = dateFrom ? new Date(dateFrom).getTime() : 0

  try {
    const [total, videos] = await Promise.all([
      prisma.video.count({ where }),
      prisma.video.findMany({
        where,
        orderBy: { views: 'desc' },
        skip,
        take: limit * 3,
        select: {
          id: true,
          videoId: true,
          title: true,
          thumbnailUrl: true,
          views: true,
          duration: true,
          publishedAt: true,
          isOutlier: true,
          isShort: true,
          channel: {
            select: {
              channelId: true,
              channelName: true,
              channelHandle: true,
              thumbnailUrl: true,
              niche: true,
              channelType: true,
              subscribers: true,
              outlierScore: true,
            },
          },
        },
      }),
    ])

    // Apply JS filters (date + duration) — JS filter is reliable for SQLite DateTime
    let filtered = videos

    // Date filter: hide videos older than cutoff
    if (dateCutoff > 0) {
      filtered = filtered.filter(v => {
        if (!v.publishedAt) return true  // keep videos with no date
        return new Date(v.publishedAt).getTime() >= dateCutoff
      })
    }

    // Duration subtype filter
    if (durationSubtype && SUBTYPE_RANGES[durationSubtype]) {
      const { min, max } = SUBTYPE_RANGES[durationSubtype]
      filtered = filtered.filter(v => {
        const s = parseDurationSecs(v.duration)
        return s >= min && s <= max
      })
    }

    const paginated = filtered.slice(0, limit)

    const serialized = paginated.map(v => ({
      videoId:     v.videoId,
      title:       v.title,
      thumbnailUrl: v.thumbnailUrl,
      views:       Number(v.views),
      duration:    v.duration,
      publishedAt: v.publishedAt?.toISOString() ?? null,
      channel: {
        channelId:   v.channel.channelId,
        channelName: v.channel.channelName,
        thumbnailUrl:v.channel.thumbnailUrl,
        niche:       v.channel.niche,
        subscribers: v.channel.subscribers,
        outlierScore:v.channel.outlierScore,
      },
    }))

    const response = NextResponse.json({
      total: durationSubtype ? filtered.length : total,
      page,
      videos: serialized,
    })
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60')
    return response
  } catch (err: any) {
    console.error('Videos API error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
