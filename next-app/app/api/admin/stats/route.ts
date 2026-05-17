import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const [total, active, inactive, byType, videos] = await Promise.all([
    prisma.channel.count(),
    prisma.channel.count({ where: { isActive: true } }),
    prisma.channel.count({ where: { isActive: false } }),
    prisma.channel.groupBy({ by: ['channelType'], _count: { _all: true } }),
    prisma.video.count(),
  ])
  return NextResponse.json({ total, active, inactive, byType, videos })
}
