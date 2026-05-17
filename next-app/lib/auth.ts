import { AuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '@/lib/prisma'

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/signin' },

  callbacks: {
    async signIn({ user }) {
      try {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
          select: { id: true, status: true, role: true },
        })
        if (!dbUser) return true
        if (dbUser.status === 'blocked') return '/signin?error=Blocked'

        const adminEmails = (process.env.ADMIN_EMAIL || '').split(',').map(e => e.trim())
        if (adminEmails.includes(user.email!) && dbUser.role !== 'admin') {
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { role: 'admin', status: 'active' },
          })
        }
        await prisma.signInLog.create({ data: { userId: dbUser.id } })
      } catch {}
      return true
    },

    async jwt({ token }) {
      if (token.email) {
        const dbUser = await prisma.user.findUnique({
          where:  { email: token.email },
          select: { id: true, role: true, status: true },
        })
        if (dbUser) {
          token.id     = dbUser.id
          token.role   = dbUser.role
          token.status = dbUser.status
        }
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id     = token.id as string
        session.user.role   = (token.role as string) || 'user'
        session.user.status = (token.status as string) || 'pending'
      }
      return session
    },
  },
}
