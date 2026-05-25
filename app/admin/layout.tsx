'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/admin',                       icon: '🏠', label: 'Dashboard'          },
  { href: '/admin/channels',              icon: '📋', label: 'All Channels'        },
  { href: '/admin/channels?type=long_form',   icon: '📹', label: '→ Long Form'    },
  { href: '/admin/channels?type=short_form',  icon: '▶️', label: '→ Short Form'   },
  { href: '/admin/channels?type=real_time',   icon: '🔴', label: '→ Real Time'    },
  { href: '/admin/channels?type=terminated',  icon: '⛔', label: '→ Terminated'   },
  { href: '/admin/users',                 icon: '👥', label: 'Users'              },
  { href: '/admin/tasks',                 icon: '🛠️', label: 'Tasks & Scripts'    },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false)
  }, [])

  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-[#0a0a0a]">

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Admin Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-56 bg-[#1e293b] flex flex-col z-50 transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-sm">⚙ Admin Panel</p>
            <p className="text-slate-400 text-xs mt-0.5">Niche Finder CMS</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-white md:hidden">✕</button>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(item => (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                pathname === item.href
                  ? 'bg-white/15 text-white font-medium'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </a>
          ))}
          <div className="pt-3 border-t border-white/10 mt-3">
            <a href="/" className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
              ← Back to App
            </a>
          </div>
        </nav>
      </aside>

      {/* Main content */}
      <main className={`flex-1 min-h-screen flex flex-col transition-all duration-300 ${
        sidebarOpen ? 'md:ml-56' : 'ml-0'
      }`}>
        {/* Admin top bar */}
        <div className="sticky top-0 z-30 bg-white dark:bg-[#111] border-b border-gray-200 dark:border-[#1e1e1e] px-4 h-12 flex items-center gap-3 flex-shrink-0">
          {!sidebarOpen ? (
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a] rounded-lg transition-colors"
            >
              <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => setSidebarOpen(false)}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a] rounded-lg transition-colors"
            >
              <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          )}
          <span className="font-semibold text-gray-700 dark:text-gray-300 text-sm">Admin Panel</span>
          <div className="flex-1" />
          <a href="/" className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
            ← Live Site
          </a>
        </div>

        {/* Page content */}
        <div className="flex-1">{children}</div>
      </main>
    </div>
  )
}
