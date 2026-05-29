'use client'

import { useEffect, useState } from 'react'

interface DiscoveredChannel {
  id: string
  channelId: string
  channelName: string
  channelHandle: string | null
  thumbnailUrl: string | null
  subscribers: number
  viewCount: number
  status: string
  createdAt: string
  lastViewedAt: string
}

export default function AdminDiscoveredPage() {
  const [list, setList] = useState<DiscoveredChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [niches, setNiches] = useState<Record<string, string>>({})
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [actionType, setActionType] = useState<'import' | 'reject' | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const fetchDiscovered = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/discovered')
      const data = await res.json()
      if (data.success) {
        setList(data.list)
      } else {
        setError(data.error || 'Failed to fetch discovered channels')
      }
    } catch (err: any) {
      console.error('Error fetching discovered channels:', err)
      setError(err.message || 'Error occurred while loading discovered channels')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDiscovered()
  }, [])

  const handleNicheChange = (channelId: string, value: string) => {
    setNiches(prev => ({
      ...prev,
      [channelId]: value
    }))
  }

  const handleImport = async (channelId: string) => {
    setActioningId(channelId)
    setActionType('import')
    setMessage('')
    setError('')

    const assignedNiche = niches[channelId] || 'General'

    try {
      const res = await fetch('/api/admin/discovered/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channelId,
          niche: assignedNiche
        })
      })

      const data = await res.json()
      if (data.success) {
        setMessage(`Successfully imported channel into database!`)
        setList(prev => prev.filter(c => c.channelId !== channelId))
      } else {
        setError(data.error || 'Failed to import channel')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during import')
    } finally {
      setActioningId(null)
      setActionType(null)
    }
  }

  const handleReject = async (channelId: string) => {
    if (!confirm('Are you sure you want to ignore this channel and remove it from the discovered queue?')) {
      return
    }

    setActioningId(channelId)
    setActionType('reject')
    setMessage('')
    setError('')

    try {
      const res = await fetch(`/api/admin/discovered?channelId=${channelId}`, {
        method: 'DELETE'
      })

      const data = await res.json()
      if (data.success) {
        setMessage('Removed discovered channel from queue.')
        setList(prev => prev.filter(c => c.channelId !== channelId))
      } else {
        setError(data.error || 'Failed to reject channel')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during rejection')
    } finally {
      setActioningId(null)
      setActionType(null)
    }
  }

  const filteredList = list.filter(item => {
    const term = searchTerm.toLowerCase()
    return (
      item.channelName.toLowerCase().includes(term) ||
      (item.channelHandle || '').toLowerCase().includes(term) ||
      item.channelId.toLowerCase().includes(term)
    )
  })

  return (
    <div className="p-8 max-w-[1400px] mx-auto min-h-screen">
      {/* Page Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Discovered Queue</h1>
          <p className="text-zinc-400 text-xs mt-1">
            Review and import new YouTube niche channels harvested dynamically by your Chrome Extension users.
          </p>
        </div>
        <button
          onClick={fetchDiscovered}
          className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-4 py-2 rounded-lg text-xs font-semibold hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-1.5 self-start sm:self-center"
        >
          🔄 Refresh Queue
        </button>
      </div>

      {/* Alerts */}
      {message && (
        <div className="mb-6 p-4 bg-indigo-950/20 text-indigo-400 border border-indigo-900/40 rounded-xl text-xs font-mono">
          ✅ {message}
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-950/20 text-red-400 border border-red-900/40 rounded-xl text-xs font-mono">
          ❌ {error}
        </div>
      )}

      {/* Search Bar & Stats */}
      <div className="bg-[#09090b] border border-zinc-800 rounded-lg p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Search discovered channels..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-zinc-800 rounded-lg bg-[#09090b] text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
          <span className="absolute left-3 top-2.5 text-zinc-500 text-xs">🔍</span>
        </div>
        <div className="text-[11px] font-mono text-zinc-500 flex items-center gap-4 whitespace-nowrap self-end md:self-center">
          <p>Pending: <strong className="text-zinc-300">{list.length}</strong></p>
          <p>Filtered: <strong className="text-indigo-400">{filteredList.length}</strong></p>
        </div>
      </div>

      {/* Discovered table */}
      <div className="bg-[#09090b] border border-zinc-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-zinc-400 text-xs font-mono uppercase tracking-widest flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
            Loading discovery queue...
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-16 text-center text-zinc-500 text-xs font-mono">
            Discovered queue is empty
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#09090b] text-[10px] uppercase font-mono tracking-wider text-zinc-400 border-b border-zinc-800">
                  <th className="py-3 px-5 font-semibold">Channel Details</th>
                  <th className="py-3 px-4 font-semibold">Subscribers</th>
                  <th className="py-3 px-4 font-semibold">Search Hits</th>
                  <th className="py-3 px-4 font-semibold">Last Searched</th>
                  <th className="py-3 px-4 font-semibold min-w-[150px]">Niche Category</th>
                  <th className="py-3 px-5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 text-zinc-300 font-sans">
                {filteredList.map(item => {
                  const subsFmt = item.subscribers >= 1000000
                    ? (item.subscribers / 1000000).toFixed(2).replace(/\.?0+$/, "") + "M"
                    : item.subscribers >= 1000
                      ? (item.subscribers / 1000).toFixed(1).replace(/\.?0+$/, "") + "K"
                      : item.subscribers.toString();

                  const dateFmt = new Date(item.lastViewedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })

                  const youtubeUrl = `https://youtube.com/channel/${item.channelId}`
                  const handleText = item.channelHandle || '@' + item.channelName.toLowerCase().replace(/[^a-z0-9]/g, '')
                  const isActioning = actioningId === item.channelId

                  return (
                    <tr key={item.id} className="hover:bg-zinc-900/30 transition-colors">
                      {/* details */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <img
                            src={item.thumbnailUrl ? `/api/image-proxy?url=${encodeURIComponent(item.thumbnailUrl)}` : 'https://www.youtube.com/s/desktop/99863c37/img/avatar_placeholder_dark_32.png'}
                            alt="avatar"
                            className="w-8 h-8 rounded-full bg-zinc-800 object-cover flex-shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://www.youtube.com/s/desktop/99863c37/img/avatar_placeholder_dark_32.png'
                            }}
                          />
                          <div className="min-w-0">
                            <a
                              href={youtubeUrl}
                              target="_blank"
                              className="font-semibold text-zinc-100 hover:text-indigo-400 hover:underline block truncate max-w-[200px]"
                              title="Open on YouTube"
                            >
                              {item.channelName}
                            </a>
                            <span className="text-[10px] text-zinc-500 font-mono block truncate max-w-[150px]">
                              {handleText}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* subs */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-semibold text-zinc-200">{subsFmt}</span>
                      </td>

                      {/* Search Hits */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold px-2 py-0.5 rounded-full text-[10px] font-mono">
                          📈 {item.viewCount} hits
                        </span>
                      </td>

                      {/* Last Searched */}
                      <td className="py-3.5 px-4 text-[11px] text-zinc-400 font-mono whitespace-nowrap">
                        {dateFmt}
                      </td>

                      {/* Assign Niche input */}
                      <td className="py-3.5 px-4">
                        <input
                          type="text"
                          placeholder="e.g. Finance"
                          value={niches[item.channelId] || ''}
                          onChange={e => handleNicheChange(item.channelId, e.target.value)}
                          className="w-full px-2.5 py-1 border border-zinc-800 rounded-lg bg-[#09090b] text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                        />
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Reject / Ignore */}
                          <button
                            onClick={() => handleReject(item.channelId)}
                            disabled={isActioning}
                            className={`p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors ${
                              isActioning ? 'opacity-40 cursor-not-allowed' : ''
                            }`}
                            title="Dismiss Discovery"
                          >
                            {isActioning && actionType === 'reject' ? (
                              <div className="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            )}
                          </button>

                          {/* Import */}
                          <button
                            onClick={() => handleImport(item.channelId)}
                            disabled={isActioning}
                            className={`px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                              isActioning ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          >
                            {isActioning && actionType === 'import' ? (
                              <>
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Saving...</span>
                              </>
                            ) : (
                              <span>⚡ 1-Click Import</span>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
