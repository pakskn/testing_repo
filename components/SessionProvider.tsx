'use client'
import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'
import type { Session } from 'next-auth'
import { useEffect } from 'react'

export default function SessionProvider({
  children,
  session,
}: {
  children: React.ReactNode
  session: Session | null
}) {
  useEffect(() => {
    // Prevent Chrome extension "Failed to fetch" from triggering Next.js dev overlay
    const handler = (e: PromiseRejectionEvent) => {
      const msg = String(e.reason?.message || e.reason || '')
      const stack = String(e.reason?.stack || '')
      if (
        msg.includes('Failed to fetch') ||
        stack.includes('chrome-extension://') ||
        stack.includes('frame_ant')
      ) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    }
    window.addEventListener('unhandledrejection', handler, true)
    return () => window.removeEventListener('unhandledrejection', handler, true)
  }, [])

  return (
    <NextAuthSessionProvider session={session} refetchInterval={0} refetchOnWindowFocus={false}>
      {children}
    </NextAuthSessionProvider>
  )
}
