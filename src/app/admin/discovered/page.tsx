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
  const [niches, setNiches] = useState<Record<string, string>>({}) // Inline niche inputs state
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
        // Filter out from the active queue
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

  // Filter based on search term
  const filteredList = list.filter(item => {
    const term = searchTerm.toLowerCase()
    return (
      item.channelName.toLowerCase().includes(term) ||
      (item.channelHandle || '').toLowerCase().includes(term) ||
      item.channelId.toLowerCase().includes(term)
    )
  })

  return (
    <div className="p-8">
      {/* Page Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Discovered Channels Queue</h1>
          <p className="text-gray-500 text-sm mt-1">
            Review and import new YouTube niche channels harvested organically by your Chrome Extension users.
          </p>
        </div>
        <button
          onClick={fetchDiscovered}
          className="bg-gray-100 dark:bg-[#222] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-[#333] px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-[#2b2b2b] transition-colors flex items-center gap-1.5 self-start"
        >
          🔄 Refresh Queue
        </button>
      </div>

      {/* Alerts */}
      {message && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 rounded-xl text-sm font-medium border border-green-200 dark:border-green-900 flex items-center gap-2">
          <span>✅</span> {message}
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium border border-red-200 dark:border-red-900 flex items-center gap-2">
          <span>❌</span> {error}
        </div>
      )}

      {/* Search Bar & Stats */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-[#2a2a2a] p-4 mb-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Search discovered channels..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-[#333] rounded-xl bg-gray-50 dark:bg-[#111] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
          />
          <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-4 whitespace-nowrap self-end md:self-center">
          <p>Discovered Pending: <strong className="text-gray-800 dark:text-white">{list.length}</strong></p>
          <p>Filtered List: <strong className="text-blue-500">{filteredList.length}</strong></p>
        </div>
      </div>

      {/* Queue Body */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-[#2a2a2a] shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center gap-3">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-sm">Loading discoveries from database...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-16 text-center text-gray-500">
            <p className="text-3xl mb-3">📁</p>
            <p className="font-medium text-gray-800 dark:text-gray-300 text-sm">Your discovery queue is empty!</p>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              Channels will automatically appear here when your extension users browse YouTube channel pages.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#111] text-xs text-gray-500 dark:text-gray-400 font-semibold border-b border-gray-100 dark:border-[#2a2a2a]">
                  <th className="py-4 px-5">Channel Details</th>
                  <th className="py-4 px-4">Subscribers</th>
                  <th className="py-4 px-4">Search Hits</th>
                  <th className="py-4 px-4">Last Searched</th>
                  <th className="py-4 px-4 min-w-[150px]">Niche Category</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#2a2a2a] text-gray-800 dark:text-gray-200">
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
                    <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-[#161618] transition-colors">
                      {/* Details */}
                      <td className="py-4 px-5 flex items-center gap-3">
                        <img
                          src={item.thumbnailUrl || 'https://www.youtube.com/s/desktop/99863c37/img/avatar_placeholder_dark_32.png'}
                          alt="avatar"
                          className="w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-800 object-cover flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://www.youtube.com/s/desktop/99863c37/img/avatar_placeholder_dark_32.png'
                          }}
                        />
                        <div className="min-w-0">
                          <a
                            href={youtubeUrl}
                            target="_blank"
                            className="font-medium text-gray-900 dark:text-white hover:text-blue-500 hover:underline block truncate max-w-[200px]"
                            title="Open on YouTube"
                          >
                            {item.channelName}
                          </a>
                          <span className="text-[10px] text-gray-500 font-mono block truncate max-w-[150px]">
                            {handleText}
                          </span>
                        </div>
                      </td>

                      {/* Subs */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="font-semibold text-gray-900 dark:text-white">{subsFmt}</span>
                      </td>

                      {/* Search Hits */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-bold px-2 py-0.5 rounded-full text-xs">
                          📈 {item.viewCount} hits
                        </span>
                      </td>

                      {/* Last Searched */}
                      <td className="py-4 px-4 text-xs text-gray-500 whitespace-nowrap">
                        {dateFmt}
                      </td>

                      {/* Assign Niche */}
                      <td className="py-4 px-4">
                        <input
                          type="text"
                          placeholder="e.g. Finance"
                          value={niches[item.channelId] || ''}
                          onChange={e => handleNicheChange(item.channelId, e.target.value)}
                          className="w-full px-2.5 py-1 border border-gray-200 dark:border-[#333] rounded-lg bg-gray-50 dark:bg-[#111] text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Reject */}
                          <button
                            onClick={() => handleReject(item.channelId)}
                            disabled={isActioning}
                            className={`p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors ${
                              isActioning ? 'opacity-40 cursor-not-allowed' : ''
                            }`}
                            title="Ignore/Dismiss Discovery"
                          >
                            {isActioning && actionType === 'reject' ? (
                              <div className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            )}
                          </button>

                          {/* Import */}
                          <button
                            onClick={() => handleImport(item.channelId)}
                            disabled={isActioning}
                            className={`px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1 ${
                              isActioning ? 'bg-green-400 dark:bg-green-800 cursor-not-allowed' : ''
                            }`}
                          >
                            {isActioning && actionType === 'import' ? (
                              <>
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Saving...</span>
                              </>
                            ) : (
                              <>
                                <span>⚡ 1-Click Import</span>
                              </>
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
