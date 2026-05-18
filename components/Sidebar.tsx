'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/channels/long-form',  label: 'Long Form Channels',  icon: '📹' },
  { href: '/channels/short-form', label: 'Short Form Channels', icon: '▶️'  },
  { href: '/channels/real-time',  label: 'Real Time Channels',  icon: '🔴' },
  { href: '/channels/terminated', label: 'Terminated Channels', icon: '⛔' },
]

interface SidebarProps {
  onClose?: () => void
  isAdmin?: boolean
}

export default function Sidebar({ onClose, isAdmin = false }: SidebarProps) {
  const pathname = usePathname()
  const [channelsOpen, setChannelsOpen] = useState(true)

  return (
    <aside className="w-60 h-full bg-white dark:bg-[#111111] border-r border-gray-200 dark:border-[#1e1e1e] flex flex-col">
      {/* Logo + Collapse button */}
      <div className="px-4 py-4 border-b border-gray-200 dark:border-[#1e1e1e] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          <div>
            <h1 className="text-gray-900 dark:text-white font-bold text-base leading-tight">Niche Finder</h1>
            <p className="text-gray-400 dark:text-gray-600 text-xs">YouTube Research Tool</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            title="Collapse sidebar"
            className="text-gray-400 dark:text-gray-600 hover:text-gray-700 dark:hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1a1a1a]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 overflow-y-auto scrollbar-hide">

        {/* ── Collapsible CHANNELS section ── */}
        <button
          onClick={() => setChannelsOpen(o => !o)}
          className="w-full flex items-center justify-between px-2 py-2 mb-1 rounded-lg hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors group"
        >
          <span className="text-[10px] text-gray-400 dark:text-gray-600 uppercase tracking-widest font-semibold group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors">
            📁 Channels
          </span>
          <svg
            className={`w-3 h-3 text-gray-400 dark:text-gray-600 transition-transform duration-200 ${channelsOpen ? 'rotate-0' : '-rotate-90'}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Channel links — collapse/expand */}
        <div className={`space-y-0.5 overflow-hidden transition-all duration-250 ${
          channelsOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
        }`}>
          {NAV_ITEMS.map(item => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  isActive
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-black font-semibold'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-[#1e1e1e]">
        {isAdmin && (
          <Link
            href="/admin"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-400 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1a1a1a] transition-colors mb-1"
          >
            <span>⚙</span>
            <span>Admin Panel</span>
          </Link>
        )}
      </div>
    </aside>
  )
}
