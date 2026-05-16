import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path  = req.nextUrl.pathname

    // Admin-only routes
    if (path.startsWith('/admin') && token?.role !== 'admin') {
      return NextResponse.redirect(new URL('/channels/long-form', req.url))
    }

    // Pending users → pending page
    if (
      token?.status === 'pending' &&
      !path.startsWith('/pending') &&
      !path.startsWith('/api')
    ) {
      return NextResponse.redirect(new URL('/pending', req.url))
    }

    // Blocked users → signin with error
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
