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
  const page   = Math.max(1, parseInt(searchParams.get('page')  || '1'))
  const limit  = Math.min(100, parseInt(searchParams.get('limit') || '20'))
  const skip   = (page - 1) * limit

  // Advanced filter params
  const niches      = searchParams.get('niches')?.split(',').filter(Boolean) || []
  const monetize    = searchParams.get('monetization') || 'all'  // on | all | off
  const subsMin     = parseInt(searchParams.get('subsMin')  || '0')
  const subsMax     = parseInt(searchParams.get('subsMax')  || '999999999')
  const avgViewMin  = parseInt(searchParams.get('avgViewsMin') || '0')
  const avgViewMax  = parseInt(searchParams.get('avgViewsMax') || '999999999')
  const outlierMin  = parseFloat(searchParams.get('outlierMin') || '0')
  const outlierMax  = parseFloat(searchParams.get('outlierMax') || '9999')
  const videosMin   = parseInt(searchParams.get('totalVideosMin') || '0')
  const videosMax   = parseInt(searchParams.get('totalVideosMax') || '9999999')

  // Build WHERE clause — always filter to active channels only
  const baseType: Prisma.ChannelWhereInput = { channelType: type, isActive: true }
  const searchClause: Prisma.ChannelWhereInput = search
    ? {
        OR: [
          { channelName: { contains: search } },
          { niche: { contains: search } },
          { channelHandle: { contains: search } },
        ],
      }
    : {}

  // Multi-niche filter
  const nicheClause: Prisma.ChannelWhereInput = niches.length > 0
    ? { niche: { in: niches } }
    : {}

  const where: Prisma.ChannelWhereInput = {
    AND: [
      baseType,
      ...(search        ? [searchClause]          : []),
      ...(niches.length ? [nicheClause]           : []),
      // Advanced range filters
      { subscribers:      { gte: subsMin,    lte: subsMax    } },
      { avgViewsPerVideo: { gte: avgViewMin, lte: avgViewMax } },
      { outlierScore:     { gte: outlierMin, lte: outlierMax } },
      { totalVideos:      { gte: videosMin,  lte: videosMax  } },
    ],
  }

  // Monetization filter from advanced panel
  if (monetize === 'on')  where.isMonetized = true
  if (monetize === 'off') where.isMonetized = false

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

  let orderBy: Prisma.ChannelOrderByWithRelationInput
  switch (sort) {
    case 'created_at':
      orderBy = { createdAt: order }
      break
    case 'avg_views':
    case 'total_revenue':
      orderBy = { avgViewsPerVideo: order }
      break
    case 'days_since_start':
      orderBy = { daysSinceStart: order }
      break
    case 'total_videos':
      orderBy = { totalVideos: order }
      break
    case 'subscribers':
    default:
      orderBy = { subscribers: order }
  }

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
        skip,
        take: limit,
        include: {
          videos: {
            orderBy: { views: 'desc' },
            take: 10,  // fetch extra so duration filter still yields 3
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
        videos: videos.slice(0, 3).map(v => ({
          ...v,
          views: Number(v.views),
          publishedAt: v.publishedAt?.toISOString() ?? null,
        })),
        createdAt: ch.createdAt.toISOString(),
        updatedAt: ch.updatedAt.toISOString(),
      }
    })

    return NextResponse.json({ total, page, channels: serialized })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch channels' },
      { status: 500 }
    )
  }
}
