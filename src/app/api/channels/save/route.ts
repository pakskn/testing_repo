import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const saved = await prisma.savedChannel.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        channelId: true,
        folder: true,
      },
    })

    return NextResponse.json(saved)
  } catch (error: any) {
    console.error('Error fetching saved channels:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const body = await req.json()
    const { channelId, folder = 'long_form' } = body

    if (!channelId) {
      return new NextResponse('Missing channelId', { status: 400 })
    }

    // Verify channel exists in database
    const channelExists = await prisma.channel.findUnique({
      where: { channelId }
    })
    if (!channelExists) {
      return new NextResponse('Channel not found in database', { status: 404 })
    }

    const existing = await prisma.savedChannel.findUnique({
      where: {
        userId_channelId: {
          userId: session.user.id,
          channelId,
        },
      },
    })

    if (existing) {
      // If folder is different, update instead of deleting
      if (existing.folder !== folder) {
        const updated = await prisma.savedChannel.update({
          where: {
            userId_channelId: {
              userId: session.user.id,
              channelId,
            },
          },
          data: {
            folder,
          },
        })
        return NextResponse.json({ saved: true, folder: updated.folder, updated: true })
      } else {
        // Unsave (toggle off)
        await prisma.savedChannel.delete({
          where: {
            userId_channelId: {
              userId: session.user.id,
              channelId,
            },
          },
        })
        return NextResponse.json({ saved: false })
      }
    } else {
      // Create new save record
      const saved = await prisma.savedChannel.create({
        data: {
          userId: session.user.id,
          channelId,
          folder,
        },
      })
      return NextResponse.json({ saved: true, folder: saved.folder })
    }
  } catch (error: any) {
    console.error('Error toggling saved channel:', error)
    return new NextResponse(error.message || 'Internal Server Error', { status: 500 })
  }
}
