import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

export default auth(async function middleware(req) {
  const token = req.auth // In Auth.js v5, the session is in req.auth
  const path  = req.nextUrl.pathname

  // 1. Authenticated check for protected routes
  const isAuthenticated = !!token
  const isPublicPath = path.startsWith('/signin') ||
                       path.startsWith('/pending') ||
                       path.startsWith('/api/auth') ||
                       path.startsWith('/_next') ||
                       path === '/favicon.ico'

  if (!isAuthenticated && !isPublicPath) {
    return NextResponse.redirect(new URL('/signin', req.url))
  }

  // 2. Global API Rate Limiting (excluding NextAuth endpoints)
  if (path.startsWith('/api') && !path.startsWith('/api/auth')) {
    const userId = token?.user?.id || token?.user?.email || undefined
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

  // 3. Admin-only routes
  if (path.startsWith('/admin') && token?.user?.role !== 'admin') {
    return NextResponse.redirect(new URL('/channels/long-form', req.url))
  }

  // 4. Pending users → pending page
  if (
    token?.user?.status === 'pending' &&
    !path.startsWith('/pending') &&
    !path.startsWith('/api')
  ) {
    return NextResponse.redirect(new URL('/pending', req.url))
  }

  // 5. Blocked users → signin with error
  if (token?.user?.status === 'blocked' && !path.startsWith('/signin')) {
    return NextResponse.redirect(new URL('/signin?error=Blocked', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
