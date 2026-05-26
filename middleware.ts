import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

export default withAuth(
  async function middleware(req) {
    const token = req.nextauth.token
    const path  = req.nextUrl.pathname

    // 1. Global API Rate Limiting (excluding NextAuth endpoints)
    if (path.startsWith('/api') && !path.startsWith('/api/auth')) {
      const userId = token?.id || token?.email || undefined
      const limitResult = await rateLimit(req, path, userId)

      if (!limitResult.success) {
        const resetSeconds = Math.max(1, Math.ceil((limitResult.reset - Date.now()) / 1000))
        return new NextResponse(
          JSON.stringify({
            error: 'Too Many Requests',
            message: 'You have exceeded the rate limit. Please try again later.',
            remaining: limitResult.remaining,
            limit: limitResult.limit,
            reset: limitResult.reset,
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': resetSeconds.toString(),
              'X-RateLimit-Limit': limitResult.limit.toString(),
              'X-RateLimit-Remaining': limitResult.remaining.toString(),
              'X-RateLimit-Reset': Math.ceil(limitResult.reset / 1000).toString(),
            },
          }
        )
      }

      // If rate limit checks out, proceed and attach rate limit headers to client response
      const response = NextResponse.next()
      response.headers.set('X-RateLimit-Limit', limitResult.limit.toString())
      response.headers.set('X-RateLimit-Remaining', limitResult.remaining.toString())
      response.headers.set('X-RateLimit-Reset', Math.ceil(limitResult.reset / 1000).toString())
      return response
    }

    // 2. Admin-only routes
    if (path.startsWith('/admin') && token?.role !== 'admin') {
      return NextResponse.redirect(new URL('/channels/long-form', req.url))
    }

    // 3. Pending users → pending page
    if (
      token?.status === 'pending' &&
      !path.startsWith('/pending') &&
      !path.startsWith('/api')
    ) {
      return NextResponse.redirect(new URL('/pending', req.url))
    }

    // 4. Blocked users → signin with error
    if (token?.status === 'blocked' && !path.startsWith('/signin')) {
      return NextResponse.redirect(new URL('/signin?error=Blocked', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized({ token, req }) {
        const path = req.nextUrl.pathname
        // Public paths that don't need auth
        if (
          path.startsWith('/signin') ||
          path.startsWith('/pending') ||
          path.startsWith('/api/auth') ||
          path.startsWith('/_next') ||
          path === '/favicon.ico'
        ) {
          return true
        }
        return !!token
      },
    },
  }
)

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
