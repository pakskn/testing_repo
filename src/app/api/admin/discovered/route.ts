import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET — list all pending discovered channels
export async function GET() {
  const session = await auth()
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const list = await prisma.discoveredChannel.findMany({
      where: { status: 'pending' },
      orderBy: [
        { viewCount: 'desc' },
        { lastViewedAt: 'desc' }
      ]
    })
    return NextResponse.json({ success: true, list })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE — ignore/reject a discovered channel from queue (mark as rejected)
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const channelId = searchParams.get('channelId')

    if (!channelId) {
      return NextResponse.json({ error: 'Missing channelId parameter' }, { status: 400 })
    }

    await prisma.discoveredChannel.update({
      where: { channelId },
      data: { status: 'rejected' }
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
