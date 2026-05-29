'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/admin',                       icon: '📊', label: 'Dashboard'          },
  { href: '/admin/channels',              icon: '📁', label: 'All Channels'        },
  { href: '/admin/channels?type=long_form',   icon: '📹', label: 'Long Form'    },
  { href: '/admin/channels?type=short_form',  icon: '▶️', label: 'Short Form'   },
  { href: '/admin/channels?type=real_time',   icon: '🔴', label: 'Real Time'    },
  { href: '/admin/channels?type=terminated',  icon: '⛔', label: 'Terminated'   },
  { href: '/admin/users',                 icon: '👥', label: 'Users'              },
  { href: '/admin/tasks',                 icon: '⚡', label: 'Tasks & Scripts'    },
  { href: '/admin/discovered',            icon: '📥', label: 'Discovered Queue'   },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false)
  }, [])

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-[#09090b] text-gray-900 dark:text-zinc-100 font-sans antialiased">

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Admin Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-56 bg-white dark:bg-[#09090b] border-r border-gray-200 dark:border-zinc-800 flex flex-col z-50 transition-transform duration-200 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Header Branding */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-gray-900 dark:text-zinc-100 font-semibold text-sm tracking-tight flex items-center gap-1.5">
              <span>⚙️</span> CMS Admin Panel
            </p>
            <p className="text-gray-500 dark:text-zinc-500 text-[10px] uppercase font-mono tracking-wider mt-0.5">Niche Finder Tool</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="text-gray-400 dark:text-zinc-400 hover:text-gray-950 dark:hover:text-zinc-100 md:hidden transition-colors">✕</button>
        </div>

        {/* Sidebar Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-hide">
          {NAV.map(item => {
            const active = pathname === item.href
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  active
                    ? 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 font-semibold'
                    : 'text-gray-600 dark:text-zinc-400 hover:text-gray-955 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-900 border border-transparent'
                }`}
              >
                <span className="text-sm opacity-80">{item.icon}</span>
                <span>{item.label}</span>
              </a>
            )
          })}
          
          <div className="pt-3 border-t border-gray-200 dark:border-zinc-800 mt-3">
            <a 
              href="/" 
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-500 dark:text-zinc-500 hover:text-gray-900 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-900 border border-transparent transition-colors"
            >
              <span>🏡</span> Back to App
            </a>
          </div>
        </nav>
      </aside>

      {/* Main content */}
      <main className={`flex-1 min-h-screen flex flex-col transition-all duration-200 ${
        sidebarOpen ? 'md:ml-56' : 'ml-0'
      }`}>
        {/* Admin top bar */}
        <div className="sticky top-0 z-30 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 px-4 h-12 flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="w-8 h-8 flex items-center justify-center text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-lg transition-colors"
            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          >
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <span className="font-semibold text-gray-750 dark:text-zinc-300 text-xs tracking-tight uppercase font-mono">CMS Panel</span>
          
          <div className="flex-1" />
          
          <a 
            href="/" 
            className="text-xs text-gray-650 dark:text-zinc-400 hover:text-gray-950 dark:hover:text-zinc-100 transition-colors border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 hover:bg-gray-100 dark:hover:bg-zinc-900 px-3 py-1 rounded-lg"
          >
            ← Live Site
          </a>
        </div>

        {/* Page content */}
        <div className="flex-1 bg-gray-50 dark:bg-[#09090b]">{children}</div>
      </main>
    </div>
  )
}
