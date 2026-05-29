'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { isPremium } from '@/lib/premium'
import PremiumModal from '@/components/PremiumModal'

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
  long_form: 'Long Form', long: 'Long Form',
  short_form: 'Short Form', short: 'Short Form',
  real_time: 'Real Time', terminated: 'Terminated',
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n/1_000).toFixed(1)}K`
  return String(n)
}

export default function AdminChannels() {
  const { data: session } = useSession()
  const [modalOpen, setModalOpen] = useState(false)
  const [channels, setChannels]   = useState<Channel[]>([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(1)
  const [search, setSearch]       = useState('')

  const handleExportCSV = () => {
    if (!isPremium(session?.user)) {
      setModalOpen(true)
      return
    }
    
    const headers = ['Channel Name', 'Handle', 'Channel ID', 'Subscribers', 'Videos', 'Views', 'Type', 'Category', 'Outlier Score', 'Monetized', 'Active']
    const rows = channels.map(c => [
      `"${c.channelName.replace(/"/g, '""')}"`,
      c.channelHandle || '',
      c.channelId,
      c.subscribers,
      c.totalVideos,
      c.totalViews,
      c.channelType,
      c.niche || '',
      c.outlierScore.toFixed(2),
      c.isMonetized ? 'Yes' : 'No',
      c.isActive ? 'Yes' : 'No'
    ])
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `niche_finder_channels_page_${page}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

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
    <div className="p-8 max-w-[1400px] mx-auto min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100 tracking-tight">Channels Index</h1>
          <p className="text-gray-500 dark:text-zinc-400 text-xs mt-1">{total} total records in channels library.</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-750 dark:text-zinc-300 rounded-lg text-xs font-semibold hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-950 dark:hover:text-white transition-all active:scale-95"
          >
            📤 Export CSV
          </button>
          <Link href="/admin/channels/new"
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors">
            ➕ Add Channel
          </Link>
        </div>
      </div>

      {/* Tabs Row & Search bar */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center mb-6">
        {/* Navigation Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-zinc-800 pb-0 flex-shrink-0">
          {[
            { value: '',           label: 'All Channels' },
            { value: 'long_form',  label: 'Long Form' },
            { value: 'short_form', label: 'Short Form' },
            { value: 'real_time',  label: 'Real Time' },
            { value: 'terminated', label: 'Terminated' },
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => { setTypeFilter(tab.value); setPage(1) }}
              className={`px-4 py-2 border-b-2 text-xs font-medium transition-all ${
                typeFilter === tab.value
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-500/5'
                  : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-900/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full lg:w-80">
          <input
            type="text"
            placeholder="Search by name, handle, category..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-[#121214] text-xs text-gray-900 dark:text-zinc-100 placeholder-gray-405 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
          <span className="absolute left-3 top-2.5 text-gray-400 dark:text-zinc-500 text-xs">🔍</span>
        </div>
      </div>

      {/* SaaS Premium Data Table */}
      <div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#09090b] text-[10px] uppercase font-mono tracking-wider text-gray-500 dark:text-zinc-400 border-b border-gray-200 dark:border-zinc-800">
                <th className="py-3 px-5 font-semibold">Channel Details</th>
                <th className="py-3 px-4 font-semibold">Type</th>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold">Subscribers</th>
                <th className="py-3 px-4 font-semibold">Avg Views</th>
                <th className="py-3 px-4 font-semibold">Outlier</th>
                <th className="py-3 px-4 font-semibold">Monetized</th>
                <th className="py-3 px-4 font-semibold">Active</th>
                <th className="py-3 px-4 font-semibold">Order</th>
                <th className="py-3 px-5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150 dark:divide-zinc-800 text-gray-700 dark:text-zinc-300 font-sans">
              {loading ? (
                <tr><td colSpan={10} className="px-5 py-12 text-center text-gray-450 dark:text-zinc-500 font-mono tracking-wider">Loading channels library...</td></tr>
              ) : channels.length === 0 ? (
                <tr><td colSpan={10} className="px-5 py-12 text-center text-gray-455 dark:text-zinc-500 font-mono">No channels indexed</td></tr>
              ) : channels.map((ch, i) => (
                <tr key={ch.id} className={`hover:bg-gray-50 dark:hover:bg-zinc-900/30 transition-colors ${!ch.isActive ? 'opacity-40' : ''}`}>
                  {/* Channel detail */}
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-2.5 min-w-[180px]">
                      {ch.thumbnailUrl ? (
                        <img src={ch.thumbnailUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0 bg-gray-100 dark:bg-zinc-800" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-gray-550 dark:text-zinc-400">
                          {ch.channelName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-zinc-100 truncate max-w-[140px]">{ch.channelName}</p>
                        <p className="text-[10px] text-gray-500 dark:text-zinc-500 font-mono truncate max-w-[140px]">{ch.channelHandle || ch.channelId.slice(0,12)+'...'}</p>
                      </div>
                    </div>
                  </td>

                  {/* Type */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono border bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-400">
                      {TYPE_LABELS[ch.channelType] || ch.channelType}
                    </span>
                  </td>

                  {/* Category */}
                  <td className="py-3.5 px-4 text-gray-500 dark:text-zinc-400 font-mono text-[11px] whitespace-nowrap">{ch.niche || '—'}</td>

                  {/* Subscribers */}
                  <td className="py-3.5 px-4 text-gray-800 dark:text-zinc-300 font-semibold font-mono whitespace-nowrap">{fmt(ch.subscribers)}</td>

                  {/* Avg Views */}
                  <td className="py-3.5 px-4 text-gray-600 dark:text-zinc-400 font-mono whitespace-nowrap">{fmt(ch.avgViewsPerVideo)}</td>

                  {/* Outlier */}
                  <td className="py-3.5 px-4 whitespace-nowrap font-mono">
                    <span className={`font-bold ${
                      ch.outlierScore >= 5 ? 'text-emerald-600 dark:text-emerald-400' :
                      ch.outlierScore >= 2 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>{ch.outlierScore.toFixed(2)}x</span>
                  </td>

                  {/* Monetized toggle */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <button
                      onClick={() => toggle(ch.id, 'isMonetized', ch.isMonetized)}
                      className={`relative w-8 h-4.5 rounded-full transition-colors ${ch.isMonetized ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-zinc-800'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full transition-transform ${ch.isMonetized ? 'translate-x-3.5' : ''}`} />
                    </button>
                  </td>

                  {/* Active toggle */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <button
                      onClick={() => toggle(ch.id, 'isActive', ch.isActive)}
                      className={`relative w-8 h-4.5 rounded-full transition-colors ${ch.isActive ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-zinc-800'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full transition-transform ${ch.isActive ? 'translate-x-3.5' : ''}`} />
                    </button>
                  </td>

                  {/* Order */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="flex gap-0.5 font-mono text-[9px]">
                      <button onClick={() => moveOrder(ch.id, ch.sortOrder, 'up')}
                        className="px-1.5 py-0.5 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 hover:text-gray-950 dark:hover:text-white rounded" title="Move up">▲</button>
                      <button onClick={() => moveOrder(ch.id, ch.sortOrder, 'down')}
                        className="px-1.5 py-0.5 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 hover:text-gray-955 dark:hover:text-white rounded" title="Move down">▼</button>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <Link href={`/admin/channels/${ch.id}`}
                        className="px-2 py-1 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 rounded text-[10px] font-semibold hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-950 dark:hover:text-white transition-colors">
                        Edit
                      </Link>
                      <button
                        onClick={() => deleteChannel(ch.id, ch.channelName)}
                        disabled={deleting === ch.id}
                        className="px-2 py-1 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 rounded text-[10px] font-semibold hover:text-rose-600 dark:hover:text-rose-400 transition-colors disabled:opacity-50"
                      >
                        {deleting === ch.id ? '...' : 'Delete'}
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
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-[#09090b] text-gray-500 dark:text-zinc-500 font-mono text-[10px]">
            <p>
              Showing {Math.min((page-1)*20+1, total)}–{Math.min(page*20, total)} of {total}
            </p>
            <div className="flex gap-1.5 font-sans">
              <button onClick={() => setPage(p => p-1)} disabled={page === 1}
                className="px-2.5 py-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white transition-colors">
                ← Prev
              </button>
              <button onClick={() => setPage(p => p+1)} disabled={page*20 >= total}
                className="px-2.5 py-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white transition-colors">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
      <PremiumModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
