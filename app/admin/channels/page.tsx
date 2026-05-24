'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface Channel {
  id: string
  channelId: string
  channelName: string
  channelHandle: string | null
  thumbnailUrl: string | null
  subscribers: number
  totalVideos: number
  totalViews: number
  channelType: string
  niche: string | null
  avgViewsPerVideo: number
  outlierScore: number
  isMonetized: boolean
  isActive: boolean
  sortOrder: number
  updatedAt: string
}

const TYPE_OPTS = ['', 'long_form', 'short_form', 'real_time', 'terminated']
const TYPE_LABELS: Record<string, string> = {
  long_form: 'Long Form', short_form: 'Short Form',
  real_time: 'Real Time', terminated: 'Terminated',
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n/1_000).toFixed(1)}K`
  return String(n)
}

export default function AdminChannels() {
  const [channels, setChannels]   = useState<Channel[]>([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(1)
  const [search, setSearch]       = useState('')
  // Read type from URL on mount
  const [typeFilter, setTypeFilter] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('type') || ''
    }
    return ''
  })
  const [loading, setLoading]     = useState(true)
  const [deleting, setDeleting]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams({ page: String(page), search, type: typeFilter })
    const r = await fetch(`/api/admin/channels?${p}`)
    const d = await r.json()
    setChannels(d.channels)
    setTotal(d.total)
    setLoading(false)
  }, [page, search, typeFilter])

  useEffect(() => { load() }, [load])

  const toggle = async (id: string, field: 'isMonetized' | 'isActive', current: boolean) => {
    setChannels(prev => prev.map(c => c.id === id ? { ...c, [field]: !current } : c))
    await fetch(`/api/admin/channels/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: !current }),
    })
  }

  const deleteChannel = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?\n\nThis will also delete all their videos. This cannot be undone.`)) return
    setDeleting(id)
    await fetch(`/api/admin/channels/${id}`, { method: 'DELETE' })
    setDeleting(null)
    load()
  }

  const moveOrder = async (id: string, currentOrder: number, dir: 'up' | 'down') => {
    const newOrder = dir === 'up' ? currentOrder - 1 : currentOrder + 1
    await fetch(`/api/admin/channels/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sortOrder: newOrder }),
    })
    load()
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Channels</h1>
          <p className="text-gray-500 text-sm">{total} total channels</p>
        </div>
        <Link href="/admin/channels/new"
          className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
          ➕ Add Channel
        </Link>
      </div>

      {/* Type Tab Buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { value: '',           label: '📋 All',          color: 'bg-gray-900 text-white' },
          { value: 'long_form',  label: '📹 Long Form',    color: 'bg-blue-600 text-white' },
          { value: 'short_form', label: '▶️ Short Form',    color: 'bg-purple-600 text-white' },
          { value: 'real_time',  label: '🔴 Real Time',    color: 'bg-red-500 text-white' },
          { value: 'terminated', label: '⛔ Terminated',   color: 'bg-gray-500 text-white' },
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => { setTypeFilter(tab.value); setPage(1) }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              typeFilter === tab.value
                ? tab.color + ' shadow-sm'
                : 'bg-white dark:bg-[#1a1a1a] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-[#2a2a2a] hover:bg-gray-50 dark:hover:bg-[#252525]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-5">
        <input
          type="text"
          placeholder="Search by name, handle, niche..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="flex-1 border border-gray-200 dark:border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white focus:outline-none focus:border-blue-400"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-[#2a2a2a] overflow-hidden shadow-sm">
        <div className="overflow-x-auto w-full">
          <table className="text-sm" style={{ minWidth: '900px', width: '100%' }}>
            <thead className="bg-gray-50 dark:bg-[#111] border-b border-gray-100 dark:border-[#2a2a2a]">
              <tr>
                {['#','Channel','Type','Category','Subscribers','Avg Views','Outlier','Monetized','Active','Order','Actions'].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-[#1e1e1e]">
              {loading ? (
                <tr><td colSpan={11} className="px-4 py-12 text-center text-gray-400">Loading...</td></tr>
              ) : channels.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-12 text-center text-gray-400">No channels found</td></tr>
              ) : channels.map((ch, i) => (
                <tr key={ch.id} className={`hover:bg-gray-50 dark:hover:bg-[#111] transition-colors ${!ch.isActive ? 'opacity-50' : ''}`}>
                  {/* Row number */}
                  <td className="px-4 py-3 text-gray-400 text-xs">{(page-1)*20 + i + 1}</td>

                  {/* Channel */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5 min-w-[160px]">
                      {ch.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ch.thumbnailUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-[#333] flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-400 flex-shrink-0">
                          {ch.channelName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate max-w-[140px]">{ch.channelName}</p>
                        <p className="text-xs text-gray-400 truncate">{ch.channelHandle || ch.channelId.slice(0,12)+'...'}</p>
                      </div>
                    </div>
                  </td>

                  {/* Type */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-[#252525] text-gray-600 dark:text-gray-400">
                      {TYPE_LABELS[ch.channelType] || ch.channelType}
                    </span>
                  </td>

                  {/* Category */}
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{ch.niche || '—'}</td>

                  {/* Subscribers */}
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-medium">{fmt(ch.subscribers)}</td>

                  {/* Avg Views */}
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{fmt(ch.avgViewsPerVideo)}</td>

                  {/* Outlier Score */}
                  <td className="px-4 py-3">
                    <span className={`font-bold text-xs ${
                      ch.outlierScore >= 5 ? 'text-green-600' :
                      ch.outlierScore >= 2 ? 'text-yellow-500' : 'text-red-400'
                    }`}>{ch.outlierScore.toFixed(2)}x</span>
                  </td>

                  {/* Monetized toggle */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggle(ch.id, 'isMonetized', ch.isMonetized)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${ch.isMonetized ? 'bg-green-500' : 'bg-gray-300 dark:bg-[#444]'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${ch.isMonetized ? 'translate-x-5' : ''}`} />
                    </button>
                  </td>

                  {/* Active toggle */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggle(ch.id, 'isActive', ch.isActive)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${ch.isActive ? 'bg-blue-500' : 'bg-gray-300 dark:bg-[#444]'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${ch.isActive ? 'translate-x-5' : ''}`} />
                    </button>
                  </td>

                  {/* Order up/down */}
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => moveOrder(ch.id, ch.sortOrder, 'up')}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-[#252525] rounded text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors" title="Move up">▲</button>
                      <button onClick={() => moveOrder(ch.id, ch.sortOrder, 'down')}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-[#252525] rounded text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors" title="Move down">▼</button>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/channels/${ch.id}`}
                        className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors">
                        ✏️ Edit
                      </Link>
                      <button
                        onClick={() => deleteChannel(ch.id, ch.channelName)}
                        disabled={deleting === ch.id}
                        className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        {deleting === ch.id ? '...' : '🗑 Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 20 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-[#2a2a2a]">
            <p className="text-xs text-gray-500">
              Showing {Math.min((page-1)*20+1, total)}–{Math.min(page*20, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => p-1)} disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-200 dark:border-[#2a2a2a] rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors">
                ← Prev
              </button>
              <button onClick={() => setPage(p => p+1)} disabled={page*20 >= total}
                className="px-3 py-1.5 text-sm border border-gray-200 dark:border-[#2a2a2a] rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
