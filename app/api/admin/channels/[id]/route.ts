import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET single channel
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const channel = await prisma.channel.findUnique({
    where: { id: params.id },
    include: { videos: { orderBy: { views: 'desc' }, take: 10 } },
  })
  if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    ...channel,
    totalViews: Number(channel.totalViews),
    videos: channel.videos.map(v => ({ ...v, views: Number(v.views) })),
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
  })
}

// PUT — update channel
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const data: any = {}

    if (body.channelName      !== undefined) data.channelName      = body.channelName
    if (body.channelHandle    !== undefined) data.channelHandle    = body.channelHandle || null
    if (body.thumbnailUrl     !== undefined) data.thumbnailUrl     = body.thumbnailUrl || null
    if (body.channelType      !== undefined) data.channelType      = body.channelType
    if (body.niche            !== undefined) data.niche            = body.niche || null
    if (body.subscribers      !== undefined) data.subscribers      = Number(body.subscribers)
    if (body.totalVideos      !== undefined) data.totalVideos      = Number(body.totalVideos)
    if (body.totalViews       !== undefined) data.totalViews       = BigInt(body.totalViews)
    if (body.daysSinceStart   !== undefined) data.daysSinceStart   = Number(body.daysSinceStart)
    if (body.avgViewsPerVideo !== undefined) data.avgViewsPerVideo = parseFloat(body.avgViewsPerVideo)
    if (body.outlierScore     !== undefined) data.outlierScore     = parseFloat(body.outlierScore)
    if (body.isMonetized      !== undefined) data.isMonetized      = Boolean(body.isMonetized)
    if (body.isActive         !== undefined) data.isActive         = Boolean(body.isActive)
    if (body.sortOrder        !== undefined) data.sortOrder        = Number(body.sortOrder)

    await prisma.channel.update({ where: { id: params.id }, data })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

// DELETE channel (and its videos)
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ch = await prisma.channel.findUnique({ where: { id: params.id } })
    if (!ch) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.video.deleteMany({ where: { channelId: ch.channelId } })
    await prisma.channel.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
