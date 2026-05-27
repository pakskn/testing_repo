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
  long:       '📹 Long Form',
  short:      '▶️ Short Form',
  long_form:  '📹 Long Form',
  short_form: '▶️ Short Form',
  real_time:  '🔴 Real Time',
  terminated: '⛔ Terminated',
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [recategorizing, setRecategorizing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadStats = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/stats')
      const json = await res.json()
      setStats(json)
    } catch (err) {
      console.error('Failed to load stats:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  const handleRecategorize = async () => {
    if (!confirm('Are you sure you want to re-categorize all channels based on the last 30 days of activity?')) {
      return
    }

    try {
      setRecategorizing(true)
      setMessage('')
      setError('')
      
      const res = await fetch('/api/admin/recategorize', {
        method: 'POST',
      })
      const json = await res.json()

      if (json.success) {
        setMessage(`Success! Re-categorized ${json.stats.total} channels (${json.stats.long} Long, ${json.stats.short} Short).`)
        loadStats() // Refresh stats dashboard
      } else {
        setError(json.error || 'Failed to re-categorize channels')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during re-categorization.')
    } finally {
      setRecategorizing(false)
    }
  }

  if (loading && !stats) return (
    <div className="p-8 text-gray-500 flex items-center gap-2">
      <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      Loading...
    </div>
  )

  const cards = [
    { label: 'Total Channels', value: stats?.total ?? 0,    color: 'bg-blue-500',  icon: '📺' },
    { label: 'Active',         value: stats?.active ?? 0,   color: 'bg-green-500', icon: '✅' },
    { label: 'Inactive',       value: stats?.inactive ?? 0, color: 'bg-red-400',   icon: '⏸' },
    { label: 'Total Videos',   value: stats?.videos ?? 0,   color: 'bg-purple-500',icon: '🎬' },
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
                {c.value.toLocaleString()}
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
          {(['long','short','real_time','terminated'] as const).map(type => {
            const found = stats?.byType.find(
              b => b.channelType === type || 
              (type === 'long' && b.channelType === 'long_form') || 
              (type === 'short' && b.channelType === 'short_form')
            )
            return (
              <div key={type} className="bg-gray-50 dark:bg-[#111] rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{found?._count._all ?? 0}</p>
                <p className="text-xs text-gray-500 mt-1">{TYPE_LABELS[type]}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick links & actions */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-6 shadow-sm border border-gray-100 dark:border-[#2a2a2a]">
        <h2 className="font-semibold text-gray-800 dark:text-white mb-4">Quick Actions</h2>
        
        {message && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 rounded-xl text-sm font-medium border border-green-200 dark:border-green-900">
            ✅ {message}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium border border-red-200 dark:border-red-900">
            ❌ {error}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Link href="/admin/channels" className="px-4 py-2 bg-gray-100 dark:bg-[#252525] text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-[#2a2a2a] transition-colors flex items-center gap-1.5">
            📋 Manage Channels
          </Link>
          <Link href="/admin/channels/new" className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-sm hover:bg-blue-100 transition-colors flex items-center gap-1.5">
            ➕ Add New Channel
          </Link>
          
          <button 
            onClick={handleRecategorize}
            disabled={recategorizing}
            className={`px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
              recategorizing 
                ? 'bg-blue-400 dark:bg-blue-800 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {recategorizing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Categorizing...
              </>
            ) : (
              <>
                🔄 Re-categorize All Channels
              </>
            )}
          </button>
          
          <a href="/" className="px-4 py-2 bg-gray-100 dark:bg-[#252525] text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-[#2a2a2a] transition-colors flex items-center gap-1.5">
            🔙 View Live Site
          </a>
        </div>
      </div>
    </div>
  )
}
