'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import Sidebar from './Sidebar'
import ThemeToggle from './ThemeToggle'
import { useUIStore } from '@/lib/store'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const isSidebarOpen = useUIStore(state => state.isSidebarOpen)
  const toggleSidebar = useUIStore(state => state.toggleSidebar)
  const closeSidebar = useUIStore(state => state.closeSidebar)
  const [showMenu, setShowMenu]   = useState(false)
  const pathname  = usePathname()
  const { data: session } = useSession()
  const menuRef   = useRef<HTMLDivElement>(null)

  const isAdminOrAuth = pathname?.startsWith('/admin') ||
                        pathname?.startsWith('/signin') ||
                        pathname?.startsWith('/pending')

  useEffect(() => {
    if (isAdminOrAuth) return
    const isMobile = window.innerWidth < 768
    if (isMobile) closeSidebar()
  }, [isAdminOrAuth, closeSidebar])

  useEffect(() => {
    if (isAdminOrAuth) return
    if (window.innerWidth < 768) closeSidebar()
  }, [pathname, isAdminOrAuth, closeSidebar])

  // Close user menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (isAdminOrAuth) return <>{children}</>

  const user = session?.user
  const initials = user?.name?.charAt(0).toUpperCase() || 'U'

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">

      {/* Mobile backdrop */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={closeSidebar} />
      )}

      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full z-50 transition-transform duration-300 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <Sidebar onClose={closeSidebar} isAdmin={session?.user?.role === 'admin'} />
      </div>

      {/* Main */}
      <main className={`flex-1 min-h-screen flex flex-col transition-all duration-300 ${
        isSidebarOpen ? 'md:ml-60' : 'ml-0'
      }`}>

        {/* Top bar */}
        <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-gray-100 dark:border-[#1e1e1e] px-3 h-12 flex items-center gap-2 flex-shrink-0">

          {/* Hamburger — only when sidebar closed */}
          {!isSidebarOpen && (
            <button onClick={toggleSidebar} title="Open sidebar"
              className="w-8 h-8 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a] rounded-lg transition-colors flex-shrink-0">
              <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}

          {/* Logo when sidebar closed */}
          {!isSidebarOpen && (
            <div className="flex items-center gap-1.5">
              <span className="text-lg">🎯</span>
              <span className="font-bold text-gray-900 dark:text-white text-sm hidden sm:block">Waqasalee.com</span>
            </div>
          )}

          <div className="flex-1" />

          {/* Right icons */}
          <div className="flex items-center gap-1">
            <button title="Notifications" className="w-8 h-8 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a] rounded-lg transition-colors">
              <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>

            <ThemeToggle />

            {/* User avatar + dropdown */}
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setShowMenu(s => !s)}
                title="Account"
                className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-gray-200 dark:ring-[#2a2a2a] hover:ring-blue-400 transition-all"
              >
                {user?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.image} alt={user.name || ''} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                    {initials}
                  </div>
                )}
              </button>

              {/* Dropdown menu */}
              {showMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-xl border border-gray-100 dark:border-[#2a2a2a] overflow-hidden z-50">
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-[#2a2a2a]">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user?.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                    {session?.user?.role === 'admin' && (
                      <span className="inline-block mt-1 text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
                        Admin
                      </span>
                    )}
                  </div>
                  {/* Menu items */}
                  <div className="py-1">
                    {session?.user?.role === 'admin' && (
                      <a href="/admin" onClick={() => setShowMenu(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors">
                        ⚙ Admin Panel
                      </a>
                    )}
                    <button
                      onClick={() => { setShowMenu(false); signOut({ callbackUrl: '/signin' }) }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1">{children}</div>
      </main>
    </div>
  )
}
