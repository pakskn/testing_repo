import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET — list all channels (including inactive)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const typeParam = searchParams.get('type') || ''
  const type = typeParam === 'long_form' ? 'long' : typeParam === 'short_form' ? 'short' : typeParam
  const page   = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit  = 20
  const skip   = (page - 1) * limit

  const where: any = {}
  if (search) {
    where.OR = [
      { channelName: { contains: search } },
      { channelHandle: { contains: search } },
      { niche: { contains: search } },
    ]
  }
  if (type) where.channelType = type

  const [total, channels] = await Promise.all([
    prisma.channel.count({ where }),
    prisma.channel.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
      select: {
        id: true, channelId: true, channelName: true, channelHandle: true,
        thumbnailUrl: true, subscribers: true, totalVideos: true, totalViews: true,
        channelType: true, niche: true, daysSinceStart: true, avgViewsPerVideo: true,
        outlierScore: true, isMonetized: true, isActive: true, sortOrder: true,
        createdAt: true, updatedAt: true,
      },
    }),
  ])

  const serialized = channels.map(ch => ({
    ...ch,
    totalViews: Number(ch.totalViews),
    createdAt: ch.createdAt.toISOString(),
    updatedAt: ch.updatedAt.toISOString(),
  }))

  return NextResponse.json({ total, page, channels: serialized })
}

// POST — create new channel
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const incomingType = body.channelType || 'long'
    const normalizedType = incomingType === 'long_form' ? 'long' : incomingType === 'short_form' ? 'short' : incomingType

    const channel = await prisma.channel.create({
      data: {
        channelId:        body.channelId,
        channelName:      body.channelName,
        channelHandle:    body.channelHandle || null,
        thumbnailUrl:     body.thumbnailUrl || null,
        subscribers:      Number(body.subscribers) || 0,
        totalVideos:      Number(body.totalVideos) || 0,
        totalViews:       BigInt(body.totalViews || 0),
        channelType:      normalizedType,
        niche:            body.niche || null,
        daysSinceStart:   Number(body.daysSinceStart) || 0,
        avgViewsPerVideo: parseFloat(body.avgViewsPerVideo) || 0,
        outlierScore:     parseFloat(body.outlierScore) || 0,
        isMonetized:      Boolean(body.isMonetized),
        isActive:         body.isActive !== false,
        sortOrder:        Number(body.sortOrder) || 0,
      },
    })
    return NextResponse.json({ success: true, id: channel.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
