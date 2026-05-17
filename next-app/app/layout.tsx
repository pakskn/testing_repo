import type { Metadata } from 'next'
import './globals.css'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import SessionProvider from '@/components/SessionProvider'
import AppLayout from '@/components/AppLayout'

export const metadata: Metadata = {
  title: 'Waqasalee.com — Niche Research Tool',
  description: 'Find profitable YouTube niches with outlier channel analysis',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `(function(){var t=localStorage.getItem('niche-theme')||'light';if(t==='dark')document.documentElement.classList.add('dark');})()`
        }} />
      </head>
      <body>
        <SessionProvider session={session}>
          <AppLayout>{children}</AppLayout>
        </SessionProvider>
      </body>
    </html>
  )
}
