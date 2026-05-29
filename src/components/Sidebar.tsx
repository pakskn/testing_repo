'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { isPremium } from '@/lib/premium'
import PremiumModal from '@/components/PremiumModal'

const CHANNEL_ITEMS = [
  { href: '/channels/long-form',   label: 'Long Form Channels',  icon: '📹' },
  { href: '/channels/short-form',  label: 'Short Form Channels', icon: '▶️'  },
  { href: '/channels/terminated',  label: 'Terminated Channels', icon: '⛔'  },
  { href: '/channels/kids',        label: 'Kids',                icon: '🧒' },
]

interface SidebarProps { onClose?: () => void; isAdmin?: boolean }

export default function Sidebar({ onClose, isAdmin = false }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [channelsOpen, setChannelsOpen] = useState(true)
  const [savedOpen, setSavedOpen] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  const premium = isPremium(session?.user)

  return (
    <>
      <aside className="w-60 h-full bg-white dark:bg-[#111111] border-r border-gray-200 dark:border-[#1e1e1e] flex flex-col">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-gray-200 dark:border-[#1e1e1e] flex items-center justify-between">
          <Link href="/channels/long-form" className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer">
            <span className="text-2xl">🎯</span>
            <div>
              <h1 className="text-gray-900 dark:text-white font-bold text-base leading-tight">Niche Finder</h1>
              <p className="text-gray-400 dark:text-gray-600 text-xs">YouTube Research Tool</p>
            </div>
          </Link>
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

            <div className={`overflow-hidden transition-all duration-200 ${channelsOpen ? 'max-h-80 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
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

          {/* ── SAVED FOLDERS ── */}
          {session?.user && (
            <div className="px-3 mt-4 mb-1">
              <button onClick={() => setSavedOpen(o => !o)}
                className="w-full flex items-center justify-between px-2 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors group">
                <div className="flex items-center gap-2">
                  <span className="text-base">💎</span>
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Saved Folders</span>
                </div>
                <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${savedOpen ? 'rotate-0' : '-rotate-90'}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <div className={`overflow-hidden transition-all duration-200 ${savedOpen ? 'max-h-64 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                <div className="space-y-0.5">
                  {[
                    { href: '/channels/saved?folder=long_form',  label: 'Long Form Saved',  icon: '📁' },
                    { href: '/channels/saved?folder=short_form', label: 'Shorts Saved',     icon: '📁' },
                  ].map(item => {
                    const active = pathname === '/channels/saved' && (
                      typeof window !== 'undefined'
                        ? new URLSearchParams(window.location.search).get('folder') === item.href.split('=')[1]
                        : false
                    )
                    return (
                      <Link key={item.href} href={item.href}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all ${
                          active
                            ? 'bg-indigo-600 text-white font-semibold shadow-md'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]'
                        }`}
                      >
                        <span className="flex-shrink-0 text-sm">{item.icon}</span>
                        <span>{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-[#1e1e1e] flex flex-col gap-3">
          {/* User Account Plan Indicator */}
          {session?.user && (
            <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-[#161617] border border-gray-100 dark:border-[#222] transition-all">
              <div className="flex items-center gap-2.5">
                {session.user.image ? (
                  <img src={session.user.image} alt={session.user.name || 'User'} className="w-8 h-8 rounded-full border border-gray-200 dark:border-white/10" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm">
                    {session.user.name?.[0] || 'U'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate leading-tight">
                    {session.user.name || 'User'}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate leading-tight">
                    {session.user.email}
                  </p>
                </div>
              </div>

              {/* Dynamic Tier Badge & Button */}
              {premium ? (
                <div className="flex items-center justify-between mt-1 px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                    💎 Premium
                  </span>
                  <span className="text-[9px] text-gray-400">Active</span>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 mt-1">
                  <div className="flex items-center justify-between px-2 py-1 rounded bg-gray-100 dark:bg-white/5">
                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Free Tier
                    </span>
                    <button 
                      onClick={() => setModalOpen(true)}
                      className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider"
                    >
                      Upgrade
                    </button>
                  </div>
                  <button
                    onClick={() => setModalOpen(true)}
                    className="w-full py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-[11px] transition-all shadow-md active:scale-95 flex items-center justify-center gap-1"
                  >
                    💎 Go Premium
                  </button>
                </div>
              )}
            </div>
          )}

          {isAdmin && (
            <Link href="/admin"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-400 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1a1a1a] transition-colors">
              <span>⚙</span><span>Admin Panel</span>
            </Link>
          )}
        </div>
      </aside>

      {/* Upgrade Premium Modal */}
      <PremiumModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}
