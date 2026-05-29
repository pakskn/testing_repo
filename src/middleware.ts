import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

// SECURE HEADERS HELPER:
// Appends Content Security Policy (CSP) and Helmet-equivalent security headers to every response.
function applySecurityHeaders(response: NextResponse) {
  // Generate robust CSP
  // Allow Google OAuth, YouTube images/thumbnails, Google user avatars, and core app elements
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline';
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https://lh3.googleusercontent.com https://i.ytimg.com https://yt3.ggpht.com;
    font-src 'self' data:;
    connect-src 'self' https://accounts.google.com;
    frame-src 'self' https://accounts.google.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self' https://accounts.google.com;
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim()

  response.headers.set('Content-Security-Policy', cspHeader)
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()')

  return response
}

function applyCorsHeaders(response: NextResponse, origin: string) {
  response.headers.set('Access-Control-Allow-Origin', origin)
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE, PUT')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

export default auth(async function middleware(req) {
  const token = req.auth // In Auth.js v5, the session is in req.auth
  const path  = req.nextUrl.pathname
  const origin = req.headers.get('origin') || '*'

  // OPTIONS preflight requests bypass normal auth to return allowed headers instantly
  if (path.startsWith('/api/')) {
    if (req.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 200 })
      applyCorsHeaders(response, origin)
      response.headers.set('Access-Control-Max-Age', '86400')
      return response
    }
  }

  // 1. Authenticated check for protected routes
  const isAuthenticated = !!token
  const isPublicPath = path.startsWith('/signin') ||
                       path.startsWith('/pending') ||
                       path.startsWith('/api/auth') ||
                       path.startsWith('/api/image-proxy') ||
                       path.startsWith('/api/discovered/report') || // Whitelist discovery report endpoint for Chrome Extension
                       path.startsWith('/_next') ||
                       path === '/favicon.ico'

  if (!isAuthenticated && !isPublicPath) {
    if (path.startsWith('/api/')) {
      const response = NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to access this feature.' },
        { status: 401 }
      )
      applyCorsHeaders(response, origin)
      return applySecurityHeaders(response)
    }
    return applySecurityHeaders(NextResponse.redirect(new URL('/signin', req.url)))
  }

  // 2. Global API Rate Limiting (excluding NextAuth and Image Proxy endpoints)
  if (path.startsWith('/api') && !path.startsWith('/api/auth') && !path.startsWith('/api/image-proxy')) {
    const userId = token?.user?.id || token?.user?.email || undefined
    const limitResult = await rateLimit(req, path, userId)

    if (!limitResult.success) {
      const resetSeconds = Math.max(1, Math.ceil((limitResult.reset - Date.now()) / 1000))
      const errorResponse = new NextResponse(
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
      applyCorsHeaders(errorResponse, origin)
      return applySecurityHeaders(errorResponse)
    }

    // If rate limit checks out, proceed and attach rate limit headers to client response
    const response = NextResponse.next()
    response.headers.set('X-RateLimit-Limit', limitResult.limit.toString())
    response.headers.set('X-RateLimit-Remaining', limitResult.remaining.toString())
    response.headers.set('X-RateLimit-Reset', Math.ceil(limitResult.reset / 1000).toString())
    applyCorsHeaders(response, origin)
    return applySecurityHeaders(response)
  }

  // 3. Admin-only routes
  if (path.startsWith('/admin') && token?.user?.role !== 'admin') {
    return applySecurityHeaders(NextResponse.redirect(new URL('/channels/long-form', req.url)))
  }

  // 4. Pending users → pending page
  if (
    token?.user?.status === 'pending' &&
    !path.startsWith('/pending') &&
    !path.startsWith('/api')
  ) {
    return applySecurityHeaders(NextResponse.redirect(new URL('/pending', req.url)))
  }

  // 5. Blocked users → signin with error
  if (token?.user?.status === 'blocked' && !path.startsWith('/signin')) {
    return applySecurityHeaders(NextResponse.redirect(new URL('/signin?error=Blocked', req.url)))
  }

  const finalResponse = NextResponse.next()
  if (path.startsWith('/api/')) {
    applyCorsHeaders(finalResponse, origin)
  }
  return applySecurityHeaders(finalResponse)
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
