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
  long:       'Long Form',
  short:      'Short Form',
  long_form:  'Long Form',
  short_form: 'Short Form',
  real_time:  'Real Time',
  terminated: 'Terminated',
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
        loadStats()
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
    <div className="p-8 text-gray-500 dark:text-zinc-400 flex items-center justify-center min-h-[60vh] gap-3">
      <div className="w-5 h-5 border-2 border-gray-200 dark:border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
      <span className="text-sm font-mono uppercase tracking-widest">Loading statistics...</span>
    </div>
  )

  const cards = [
    { label: 'Total Channels', value: stats?.total ?? 0,    color: 'text-indigo-600 dark:text-indigo-400',  icon: '📊' },
    { label: 'Active Channels', value: stats?.active ?? 0,   color: 'text-emerald-600 dark:text-emerald-400', icon: '🟢' },
    { label: 'Inactive Channels', value: stats?.inactive ?? 0, color: 'text-gray-400 dark:text-zinc-500',    icon: '⚪' },
    { label: 'Total Videos',   value: stats?.videos ?? 0,   color: 'text-amber-600 dark:text-amber-400',   icon: '🎥' },
  ]

  return (
    <div className="p-8 max-w-[1400px] mx-auto min-h-screen">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100 tracking-tight">System Overview</h1>
          <p className="text-gray-500 dark:text-zinc-400 text-xs mt-1">Real-time counts, index distributions, and database states.</p>
        </div>
        <Link
          href="/admin/channels/new"
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors self-start sm:self-center"
        >
          ➕ Add Channel
        </Link>
      </div>

      {/* Stat Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(c => (
          <div key={c.label} className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-zinc-800 rounded-xl p-5 hover:border-gray-300 dark:hover:border-zinc-700 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 dark:text-zinc-500 uppercase tracking-wider">{c.label}</span>
              <span className="text-sm">{c.icon}</span>
            </div>
            <p className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">{c.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* By Type Breakdown */}
      <div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-zinc-800 rounded-xl p-6 mb-8 shadow-sm">
        <h2 className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-widest mb-4">Distribution by Channel Type</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {(['long','short','real_time','terminated'] as const).map(type => {
            const found = stats?.byType.find(
              b => b.channelType === type || 
              (type === 'long' && b.channelType === 'long_form') || 
              (type === 'short' && b.channelType === 'short_form')
            )
            const count = found?._count._all ?? 0
            const percentage = stats?.total ? ((count / stats.total) * 100).toFixed(1) : '0'

            return (
              <div key={type} className="bg-gray-50 dark:bg-[#09090b] border border-gray-150 dark:border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between shadow-sm">
                <div>
                  <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{count.toLocaleString()}</p>
                  <p className="text-[11px] font-medium text-gray-500 dark:text-zinc-400 mt-0.5">{TYPE_LABELS[type]}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-zinc-900 flex justify-between items-center text-[10px] font-mono text-gray-500 dark:text-zinc-500">
                  <span>RATIO</span>
                  <span>{percentage}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick Links & Actions */}
      <div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-widest mb-4">Database & CMS Controls</h2>
        
        {message && (
          <div className="mb-4 p-3 bg-indigo-950/10 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/50 rounded-lg text-xs font-mono">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-950/10 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-900/50 rounded-lg text-xs font-mono">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Link href="/admin/channels" className="px-4 py-2 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 rounded-lg text-xs font-semibold hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white transition-colors">
            📋 Manage Channels
          </Link>
          <Link href="/admin/channels/new" className="px-4 py-2 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 rounded-lg text-xs font-semibold hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white transition-colors">
            ➕ Add New Channel
          </Link>
          
          <button 
            onClick={handleRecategorize}
            disabled={recategorizing}
            className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              recategorizing ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {recategorizing ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Running Scraper Analysis...</span>
              </>
            ) : (
              <span>🔄 Re-categorize All Channels</span>
            )}
          </button>
          
          <a href="/" className="px-4 py-2 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-500 dark:text-zinc-400 rounded-lg text-xs font-semibold hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white transition-colors">
            🔙 View Live App
          </a>
        </div>
      </div>
    </div>
  )
}
