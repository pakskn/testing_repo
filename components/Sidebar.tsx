'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const CHANNEL_ITEMS = [
  { href: '/channels/long-form',   label: 'Long Form Channels',  icon: '📹' },
  { href: '/channels/short-form',  label: 'Short Form Channels', icon: '▶️'  },
  { href: '/channels/nano-shorts', label: 'Nano Shorts',         icon: '⚡' },
  { href: '/channels/kids',        label: 'Kids',                icon: '🧒' },
]

interface SidebarProps { onClose?: () => void; isAdmin?: boolean }

export default function Sidebar({ onClose, isAdmin = false }: SidebarProps) {
  const pathname = usePathname()
  const [channelsOpen, setChannelsOpen] = useState(true)

  return (
    <aside className="w-60 h-full bg-white dark:bg-[#111111] border-r border-gray-200 dark:border-[#1e1e1e] flex flex-col">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-200 dark:border-[#1e1e1e] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          <div>
            <h1 className="text-gray-900 dark:text-white font-bold text-base leading-tight">Niche Finder</h1>
            <p className="text-gray-400 dark:text-gray-600 text-xs">YouTube Research Tool</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} title="Collapse"
            className="text-gray-400 dark:text-gray-600 hover:text-gray-700 dark:hover:text-white p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1a1a1a] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>

      <nav className="flex-1 py-3 overflow-y-auto scrollbar-hide">
        {/* ── CHANNELS ── */}
        <div className="px-3 mb-1">
          <button onClick={() => setChannelsOpen(o => !o)}
            className="w-full flex items-center justify-between px-2 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors group">
            <div className="flex items-center gap-2">
              <span className="text-base">📁</span>
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Channels</span>
            </div>
            <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${channelsOpen ? 'rotate-0' : '-rotate-90'}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div className={`overflow-hidden transition-all duration-200 ${channelsOpen ? 'max-h-64 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
            <div className="space-y-0.5">
              {CHANNEL_ITEMS.map(item => {
                const active = pathname === item.href
                return (
                  <Link key={item.href} href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                      active
                        ? 'bg-gray-900 text-white dark:bg-white dark:text-black font-semibold'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]'
                    }`}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-[#1e1e1e]">
        {isAdmin && (
          <Link href="/admin"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-400 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1a1a1a] transition-colors">
            <span>⚙</span><span>Admin Panel</span>
          </Link>
        )}
      </div>
    </aside>
  )
}
