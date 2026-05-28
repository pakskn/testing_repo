import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // 1. Query user's SavedChannel bookmarks
    const savedBookmarks = await prisma.savedChannel.findMany({
      where: { userId: session.user.id },
      select: {
        channelId: true,
        folder: true,
      },
    })

    if (savedBookmarks.length === 0) {
      return NextResponse.json([])
    }

    const channelIds = savedBookmarks.map(b => b.channelId)

    // 2. Fetch full details of saved channels along with their outlier videos
    const channels = await prisma.channel.findMany({
      where: {
        channelId: { in: channelIds },
      },
      select: {
        id: true,
        channelId: true,
        channelName: true,
        channelHandle: true,
        thumbnailUrl: true,
        subscribers: true,
        totalVideos: true,
        totalViews: true,
        channelType: true,
        niche: true,
        daysSinceStart: true,
        avgViewsPerVideo: true,
        outlierScore: true,
        isMonetized: true,
        isKids: true,
        isNews: true,
        isEntertainment: true,
        isFaceless: true,
        isAi: true,
        isNano: true,
        avgVideoLength: true,
        shortsRatioLast30d: true,
        createdAt: true,
        updatedAt: true,
        videos: {
          orderBy: { views: 'desc' },
          take: 10,
          select: {
            id: true,
            videoId: true,
            title: true,
            thumbnailUrl: true,
            views: true,
            duration: true,
            publishedAt: true,
            isOutlier: true,
            isNano: true,
            isShort: true,
          }
        }
      }
    })

    const durationToSeconds = (dur: string | null): number => {
      if (!dur) return 0
      const parts = dur.split(':').map(Number)
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
      if (parts.length === 2) return parts[0] * 60 + parts[1]
      return parts[0] || 0
    }

    // 3. Serialize BigInts and Format dates to match main API
    const serialized = channels.map(ch => {
      let videos = ch.videos

      if (ch.channelType === 'long') {
        const noShorts = ch.videos.filter(v => durationToSeconds(v.duration) > 60)
        const longVids = noShorts.filter(v => durationToSeconds(v.duration) >= 180)
        videos = longVids.length > 0 ? longVids : noShorts.length > 0 ? noShorts : ch.videos
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

    return NextResponse.json(serialized)

  } catch (error: any) {
    console.error('Error serving saved channels full details:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
