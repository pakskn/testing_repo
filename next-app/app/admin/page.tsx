'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Stats {
  total: number
  active: number
  inactive: number
  byType: { channelType: string; _count: { _all: number } }[]
  videos: number
}

const TYPE_LABELS: Record<string, string> = {
  long_form:  '📹 Long Form',
  short_form: '▶️ Short Form',
  real_time:  '🔴 Real Time',
  terminated: '⛔ Terminated',
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    fetch('/api/admin/stats').then(r => r.json()).then(setStats)
  }, [])

  if (!stats) return (
    <div className="p-8 text-gray-500 flex items-center gap-2">
      <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      Loading...
    </div>
  )

  const cards = [
    { label: 'Total Channels', value: stats.total,    color: 'bg-blue-500',  icon: '📺' },
    { label: 'Active',         value: stats.active,   color: 'bg-green-500', icon: '✅' },
    { label: 'Inactive',       value: stats.inactive, color: 'bg-red-400',   icon: '⏸' },
    { label: 'Total Videos',   value: stats.videos,   color: 'bg-purple-500',icon: '🎬' },
  ]

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Overview of your Niche Finder database</p>
        </div>
        <Link
          href="/admin/channels/new"
          className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          ➕ Add Channel
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {cards.map(c => (
          <div key={c.label} className="bg-white dark:bg-[#1a1a1a] rounded-xl p-5 shadow-sm border border-gray-100 dark:border-[#2a2a2a]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{c.icon}</span>
              <span className={`${c.color} text-white text-xs font-bold px-2 py-1 rounded-full`}>
                {c.value}
              </span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">{c.label}</p>
          </div>
        ))}
      </div>

      {/* By type breakdown */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-6 shadow-sm border border-gray-100 dark:border-[#2a2a2a] mb-6">
        <h2 className="font-semibold text-gray-800 dark:text-white mb-4">Channels by Type</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(['long_form','short_form','real_time','terminated'] as const).map(type => {
            const found = stats.byType.find(b => b.channelType === type)
            return (
              <div key={type} className="bg-gray-50 dark:bg-[#111] rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{found?._count._all ?? 0}</p>
                <p className="text-xs text-gray-500 mt-1">{TYPE_LABELS[type]}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick links */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-6 shadow-sm border border-gray-100 dark:border-[#2a2a2a]">
        <h2 className="font-semibold text-gray-800 dark:text-white mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/channels" className="px-4 py-2 bg-gray-100 dark:bg-[#252525] text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-[#2a2a2a] transition-colors">
            📋 Manage Channels
          </Link>
          <Link href="/admin/channels/new" className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-sm hover:bg-blue-100 transition-colors">
            ➕ Add New Channel
          </Link>
          <a href="/" className="px-4 py-2 bg-gray-100 dark:bg-[#252525] text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-[#2a2a2a] transition-colors">
            🔙 View Live Site
          </a>
        </div>
      </div>
    </div>
  )
}
