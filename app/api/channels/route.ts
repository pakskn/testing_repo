import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const type   = searchParams.get('type')   || 'long_form'
  const filter = searchParams.get('filter') || 'all'
  const sort   = searchParams.get('sort')   || 'created_at'
  const order  = (searchParams.get('order') || 'desc') as 'asc' | 'desc'
  const search = searchParams.get('search') || ''
  const page       = Math.max(1, parseInt(searchParams.get('page')  || '1'))
  const limit      = Math.min(100, parseInt(searchParams.get('limit') || '20'))
  const skip       = (page - 1) * limit
  const randomSeed = parseInt(searchParams.get('randomSeed') || '0')

  // Advanced filter params
  const niches         = searchParams.get('niches')?.split(',').filter(Boolean) || []
  const excludeNiches  = searchParams.get('excludeNiches')?.split(',').filter(Boolean) || []
  const onlyKids          = searchParams.get('onlyKids')           === 'true'
  const onlyNews          = searchParams.get('onlyNews')           === 'true'
  const excludeKids       = searchParams.get('excludeKids')        === 'true'
  const excludeNews       = searchParams.get('excludeNews')        === 'true'
  const excludeEntertainment = searchParams.get('excludeEntertainment') === 'true'
  const includeEntertainment = searchParams.get('includeEntertainment') === 'true'
  const onlyFaceless      = searchParams.get('onlyFaceless')       === 'true'
  const hideInactive      = searchParams.get('hideInactive')        === 'true'
  const onlyInactive      = searchParams.get('onlyInactive')        === 'true'
  const onlyNano          = searchParams.get('onlyNano')            === 'true'
  const onlyStandard      = searchParams.get('onlyStandard')        === 'true'
  const onlySuper         = searchParams.get('onlySuper')           === 'true'
  const monetize    = searchParams.get('monetization') || 'all'
  const aiChannel   = searchParams.get('aiChannel') || 'all'
  const kidsContent = searchParams.get('kidsContent') || 'all'
  const shortsOnly  = searchParams.get('shortsOnly') || 'all'
  const subsMin     = parseInt(searchParams.get('subsMin')  || '0')
  const subsMax     = parseInt(searchParams.get('subsMax')  || '999999999')
  const avgViewMin  = parseInt(searchParams.get('avgViewsMin') || '0')
  const avgViewMax  = parseInt(searchParams.get('avgViewsMax') || '999999999')
  const outlierMin  = parseFloat(searchParams.get('outlierMin') || '0')
  const outlierMax  = parseFloat(searchParams.get('outlierMax') || '9999')
  const videosMin   = parseInt(searchParams.get('totalVideosMin') || '0')
  const videosMax   = parseInt(searchParams.get('totalVideosMax') || '9999999')
  // Total views range
  const totalViewsMin = parseInt(searchParams.get('totalViewsMin') || '0')
  const totalViewsMax = parseInt(searchParams.get('totalViewsMax') || '999999999999')
  // Date filters
  const dateFrom    = searchParams.get('dateFrom') || ''
  const dateTo      = searchParams.get('dateTo')   || ''
  // Similarity-specific filters
  const daysMin     = parseInt(searchParams.get('daysMin') || '0')
  const daysMax     = parseInt(searchParams.get('daysMax') || '999999')
  const titleKw     = searchParams.get('titleKeyword') || ''

  // Map long_form -> long and short_form -> short for database compatibility
  const dbChannelType = type === 'long_form' ? 'long' : type === 'short_form' ? 'short' : type

  // Build WHERE clause
  const baseType: Prisma.ChannelWhereInput = { channelType: dbChannelType, isActive: true }

  // Search: regular text OR title keyword similarity
  const activeSearch = search || titleKw
  const searchClause: Prisma.ChannelWhereInput = activeSearch
    ? {
        OR: [
          { channelName: { contains: activeSearch } },
          { niche:        { contains: activeSearch } },
          { channelHandle:{ contains: activeSearch } },
        ],
      }
    : {}

  const includeNews = searchParams.get('includeNews') === 'true'

  // Songs/Movies: OR across Music niches + isNews + isEntertainment
  const orParts: Prisma.ChannelWhereInput[] = []
  if (niches.length > 0)     orParts.push({ niche: { in: niches } })
  if (includeNews)            orParts.push({ isNews: true })
  if (includeEntertainment)   orParts.push({ isEntertainment: true })

  const nicheClause: Prisma.ChannelWhereInput = orParts.length > 0
    ? { OR: orParts }
    : {}

  const excludeNicheClause: Prisma.ChannelWhereInput = excludeNiches.length > 0
    ? { niche: { notIn: excludeNiches } }
    : {}

  const where: Prisma.ChannelWhereInput = {
    AND: [
      baseType,
      ...(activeSearch                                      ? [searchClause] : []),
      ...(orParts.length > 0                              ? [nicheClause]  : []),
      ...(excludeNiches.length                  ? [excludeNicheClause]   : []),
      ...(onlyKids               ? [{ isKids: true }]           : []),
      ...(onlyNews               ? [{ isNews: true }]           : []),
      ...(excludeKids            ? [{ isKids: false }]          : []),
      ...(excludeNews            ? [{ isNews: false }]          : []),
      ...(excludeEntertainment   ? [{ isEntertainment: false }] : []),
      ...(includeEntertainment   ? [{ isEntertainment: true }]  : []),
      ...(onlyFaceless           ? [{ isFaceless: true }]       : []),
      // hideInactive: exclude sortOrder=-1 (old/inactive channels)
      ...(hideInactive  ? [{ sortOrder: { gte: 0 } }]     : []),
      // onlyInactive: show ONLY the archived/inactive channels
      ...(onlyInactive  ? [{ sortOrder: { equals: -1 } }] : []),
      ...(onlyNano      ? [{ isNano: true }]               : []),
      // Standard = short_form, not nano, not super (videos 13-59s)
      // Super = short_form, not nano (videos 60-180s)
      // We use isNano=false for both standard+super; for super we check via video data (approximate)
      ...(onlyStandard  ? [{ isNano: false }]             : []),
      ...(onlySuper     ? [{ isNano: false }]             : []),
      { subscribers:      { gte: subsMin,        lte: subsMax        } },
      { avgViewsPerVideo: { gte: avgViewMin,     lte: avgViewMax     } },
      { totalViews:       { gte: totalViewsMin,  lte: totalViewsMax  } },
      { outlierScore:     { gte: outlierMin,     lte: outlierMax     } },
      { totalVideos:      { gte: videosMin,      lte: videosMax      } },
      // Date filters (channel creation date)
      ...(dateFrom ? [{ createdAt: { gte: new Date(dateFrom) } }] : []),
      ...(dateTo   ? [{ createdAt: { lte: new Date(dateTo + 'T23:59:59') } }] : []),
      // Similarity: age range
      ...(daysMin > 0 || daysMax < 999999
        ? [{ daysSinceStart: { gte: daysMin, lte: daysMax } }] : []),
    ],
  }

  // Monetization filter from advanced panel
  if (monetize === 'on')  where.isMonetized = true
  if (monetize === 'off') where.isMonetized = false
  
  if (aiChannel === 'yes') where.isAi = true
  if (aiChannel === 'no')  where.isAi = false
  
  if (kidsContent === 'yes') where.isKids = true
  if (kidsContent === 'no')  where.isKids = false
  
  if (shortsOnly === 'yes') where.shortsRatioLast30d = { gte: 90 }
  if (shortsOnly === 'no')  where.shortsRatioLast30d = { lt: 90 }

  switch (filter) {
    case 'outliers':
      where.outlierScore = { gte: 2.0 }
      break
    case 'high_views_low_subs':
      where.avgViewsPerVideo = { gt: 50000 }
      where.subscribers = { lt: 50000 }
      break
    case 'above_50k':
      where.avgViewsPerVideo = { gt: 50000 }
      break
    case 'high_revenue':
      where.isMonetized = true
      where.avgViewsPerVideo = { gt: 30000 }
      break
    case 'new_channels':
      where.daysSinceStart = { lt: 365 }
      break
    case 'monetized':
      where.isMonetized = true
      break
  }

  let primaryOrder: Prisma.ChannelOrderByWithRelationInput
  switch (sort) {
    case 'created_at':
      primaryOrder = { createdAt: order }
      break
    case 'avg_views':
    case 'total_revenue':
      primaryOrder = { avgViewsPerVideo: order }
      break
    case 'days_since_start':
      primaryOrder = { daysSinceStart: order }
      break
    case 'total_videos':
      primaryOrder = { totalVideos: order }
      break
    case 'subscribers':
    default:
      primaryOrder = { subscribers: order }
  }

  // 1st: channels with fetched videos (visible thumbnails in card) → 2nd: channels with avatar thumbnail → 3rd: user's chosen sort
  const orderBy: Prisma.ChannelOrderByWithRelationInput[] = sort === 'random'
    ? [{ videos: { _count: 'desc' } }, { sortOrder: 'desc' }]
    : [{ videos: { _count: 'desc' } }, { sortOrder: 'desc' }, primaryOrder]

  // For random sort: use seed-based random skip to show different channels each click
  const effectiveSkip = sort === 'random' && randomSeed > 0
    ? Math.floor((randomSeed % 1000) / 1000 * Math.max(0, Math.min(50000, skip + 50000))) % Math.max(1, 50000)
    : skip

  // Parse duration string "H:MM:SS" or "M:SS" → seconds
  function durationToSeconds(dur: string | null): number {
    if (!dur) return 0
    const parts = dur.split(':').map(Number)
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
    if (parts.length === 2) return parts[0] * 60 + parts[1]
    return parts[0] || 0
  }

  try {
    const [total, channels] = await Promise.all([
      prisma.channel.count({ where }),
      prisma.channel.findMany({
        where,
        orderBy,
        skip: effectiveSkip,
        take: limit,
        include: {
          videos: {
            where: {
              isShort: dbChannelType === 'short' ? true : false,
            },
            orderBy: { views: 'desc' },
            take: 10,  // show up to 10 videos per channel (horizontal scroll)
          },
        },
      }),
    ])

    const serialized = channels.map(ch => {
      let videos = ch.videos

      if (type === 'long_form') {
        // Step 1: Remove Shorts (< 61 sec) completely from long form
        const noShorts = ch.videos.filter(v => durationToSeconds(v.duration) > 60)
        // Step 2: Prefer videos >= 3 min; fallback to any non-shorts video
        const longVids = noShorts.filter(v => durationToSeconds(v.duration) >= 180)
        videos = longVids.length > 0 ? longVids : noShorts.length > 0 ? noShorts : ch.videos
      }

      if (type === 'short_form') {
        const shortVids = ch.videos.filter(v => {
          const s = durationToSeconds(v.duration)
          return s > 0 && s < 240
        })
        videos = shortVids.length > 0 ? shortVids : ch.videos
      }

      return {
        ...ch,
        totalViews: Number(ch.totalViews),
        videos: videos.slice(0, 10).map(v => ({
          ...v,
          views: Number(v.views),
          publishedAt: v.publishedAt?.toISOString() ?? null,
        })),
        createdAt: ch.createdAt.toISOString(),
        updatedAt: ch.updatedAt.toISOString(),
      }
    })

    const response = NextResponse.json({ total, page, channels: serialized })
    // Cache for 5 minutes — reduces DB load on repeated identical queries
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60')
    return response
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch channels' },
      { status: 500 }
    )
  }
}
