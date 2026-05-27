import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    console.log('Admin Action: Re-categorizing all channels based on last 30 days activity...')
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 30)

    // 1. Fetch all videos from the last 30 days
    const videos = await prisma.video.findMany({
      where: {
        publishedAt: {
          gte: cutoffDate,
        },
      },
      select: {
        channelId: true,
        isShort: true,
      },
    })

    // 2. Group stats in memory
    const statsMap: Record<string, { total: number; shorts: number; longs: number }> = {}
    for (const v of videos) {
      if (!statsMap[v.channelId]) {
        statsMap[v.channelId] = { total: 0, shorts: 0, longs: 0 }
      }
      statsMap[v.channelId].total++
      if (v.isShort) {
        statsMap[v.channelId].shorts++
      } else {
        statsMap[v.channelId].longs++
      }
    }

    // 3. Fetch all active channels
    const channels = await prisma.channel.findMany({
      select: {
        channelId: true,
      },
    })

    // 4. Group into categorizations for transaction updates
    const updates: { channelId: string; channelType: string; shortsRatio: number }[] = []
    
    for (const c of channels) {
      const stats = statsMap[c.channelId]
      let channelType = 'long'
      let shortsRatio = 0.0

      if (stats && stats.total > 0) {
        const { total, shorts, longs } = stats
        if (shorts === 0) {
          channelType = 'long'
        } else if (longs === 0) {
          channelType = 'short'
        } else if ((shorts / total) >= 0.65) {
          channelType = 'short'
        } else {
          channelType = 'long'
        }
        shortsRatio = (shorts / total) * 100
      }

      updates.push({
        channelId: c.channelId,
        channelType,
        shortsRatio,
      })
    }

    // 5. Update database using transaction in chunks of 1,000 for high performance
    const chunkSize = 1000
    const now = new Date()
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize)
      
      await prisma.$transaction(
        chunk.map(u => 
          prisma.channel.update({
            where: { channelId: u.channelId },
            data: {
              channelType: u.channelType,
              shortsRatioLast30d: u.shortsRatio,
              lastCategorizedAt: now,
            },
          })
        )
      )
    }

    const totalLong = updates.filter(u => u.channelType === 'long').length
    const totalShort = updates.filter(u => u.channelType === 'short').length

    console.log(`Re-categorization completed successfully: Long=${totalLong}, Short=${totalShort}`)

    return NextResponse.json({
      success: true,
      message: 'All channels re-categorized successfully!',
      stats: {
        total: updates.length,
        long: totalLong,
        short: totalShort,
      },
    })
  } catch (err: any) {
    console.error('Failed to re-categorize channels:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
