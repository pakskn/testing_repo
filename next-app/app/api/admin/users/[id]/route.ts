import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET — user with full sign-in history
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      signInLogs: { orderBy: { signedInAt: 'desc' }, take: 50 },
      _count: { select: { signInLogs: true } },
    },
  })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    ...user,
    signInCount:  user._count.signInLogs,
    createdAt:    user.createdAt.toISOString(),
    updatedAt:    user.updatedAt.toISOString(),
    emailVerified: user.emailVerified?.toISOString() ?? null,
    signInLogs:   user.signInLogs.map(l => ({ ...l, signedInAt: l.signedInAt.toISOString() })),
  })
}

// PUT — update role/status
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const data: any = {}
    if (body.status !== undefined) data.status = body.status
    if (body.role   !== undefined) data.role   = body.role
    await prisma.user.update({ where: { id: params.id }, data })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

// DELETE — remove user and all their data
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.signInLog.deleteMany({ where: { userId: params.id } })
    await prisma.session.deleteMany({ where: { userId: params.id } })
    await prisma.account.deleteMany({ where: { userId: params.id } })
    await prisma.user.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
