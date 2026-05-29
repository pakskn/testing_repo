import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { channelId, niche } = body

    if (!channelId) {
      return NextResponse.json({ error: 'Missing channelId parameter' }, { status: 400 })
    }

    // 1. Fetch metadata from DiscoveredChannel
    const discovery = await prisma.discoveredChannel.findUnique({
      where: { channelId }
    })

    if (!discovery) {
      return NextResponse.json({ error: 'Channel not found in discovered queue' }, { status: 404 })
    }

    // 2. Check if already exists in the main Channel table (to prevent unique constraint violations)
    const exists = await prisma.channel.findUnique({
      where: { channelId }
    })

    if (exists) {
      // Mark discovery as imported if it was already in main Channel
      await prisma.discoveredChannel.update({
        where: { channelId },
        data: { status: 'imported' }
      })
      return NextResponse.json({ success: true, message: 'Channel was already imported' })
    }

    // 3. Create active channel in main table using discovered DOM metadata
    const cleanNiche = niche || 'General'
    const handle = discovery.channelHandle || ("@" + discovery.channelName.toLowerCase().replace(/[^a-z0-9]/g, ''))

    await prisma.channel.create({
      data: {
        channelId,
        channelName:      discovery.channelName,
        channelHandle:    handle,
        thumbnailUrl:     discovery.thumbnailUrl || null,
        subscribers:      discovery.subscribers || 0,
        totalVideos:      0,
        totalViews:       BigInt(0),
        channelType:      'long', // Default to long (daily scraper updates metrics dynamically)
        niche:            cleanNiche,
        daysSinceStart:   0,
        avgViewsPerVideo: 0,
        outlierScore:     0,
        isMonetized:      false,
        isActive:         true,
        sortOrder:        0
      }
    })

    // 4. Mark discovery status as imported
    await prisma.discoveredChannel.update({
      where: { channelId },
      data: { status: 'imported' }
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[Admin Import Error]:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
