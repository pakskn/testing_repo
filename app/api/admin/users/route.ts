import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''

  const where: any = {}
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
    ]
  }
  if (status) where.status = status

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      emailVerified: true,
      signInLogs: {
        orderBy: { signedInAt: 'desc' },
        take: 1,
        select: { signedInAt: true },
      },
      _count: { select: { signInLogs: true } },
    },
  })

  const serialized = users.map(u => ({
    ...u,
    lastSignIn:   u.signInLogs[0]?.signedInAt?.toISOString() ?? null,
    signInCount:  u._count.signInLogs,
    signInLogs:   undefined,
    _count:       undefined,
    emailVerified: u.emailVerified?.toISOString() ?? null,
    createdAt:    u.createdAt.toISOString(),
    updatedAt:    u.updatedAt.toISOString(),
  }))

  return NextResponse.json({ users: serialized, total: serialized.length })
}
