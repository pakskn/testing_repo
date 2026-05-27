import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true, // Dynamically trust host headers (solves dynamic port 3000 vs 3001 issue)
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },

  callbacks: {
    // SECURE SIGN-IN & SELF-BOOTSTRAPPING LOGIC:
    // If no admins exist in the DB, the first logging-in user is promoted to master admin automatically.
    // Otherwise, we fallback to checking the ADMIN_EMAIL list from environment variables.
    // Once established, admins can promote other users directly from the /admin/users interface.
    async signIn({ user }) {
      try {
        if (!user.email) return false
        
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true, status: true, role: true },
        })
        
        if (!dbUser) return true
        if (dbUser.status === 'blocked') return '/signin?error=Blocked'

        const adminCount = await prisma.user.count({
          where: { role: 'admin' },
        })

        let shouldPromote = false

        if (adminCount === 0) {
          // Self-bootstrapping master admin!
          shouldPromote = true
        } else {
          // Fallback to secure environment variable
          const adminEmails = (process.env.ADMIN_EMAIL || '').split(',').map(e => e.trim())
          if (adminEmails.includes(user.email)) {
            shouldPromote = true
          }
        }

        if (shouldPromote && dbUser.role !== 'admin') {
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { role: 'admin', status: 'active' },
          })
        }
        await prisma.signInLog.create({ data: { userId: dbUser.id } })
      } catch {}
      return true
    },

    // EDGE-SAFE JWT CALLBACK:
    // We only save role/status from the db-user during initial sign-in (when user parameter is present).
    // Subsequent calls (e.g. inside middleware) read from the token directly without calling Prisma.
    // This avoids edge-runtime SQLite filesystem access crashes in the Next.js Middleware!
    async jwt({ token, user }) {
      if (user) {
        token.id     = user.id
        token.role   = user.role
        token.status = user.status
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
})
