import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { channelId, channelName, channelHandle, thumbnailUrl, subscribers } = body

    if (!channelId || !channelName) {
      return NextResponse.json({ error: 'Missing channelId or channelName' }, { status: 400 })
    }

    // 1. Check if it already exists in the main Channel table (if so, ignore)
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
        subscribers: subsCount > 0 ? subsCount : undefined, // Update subscriber size if valid
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
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
