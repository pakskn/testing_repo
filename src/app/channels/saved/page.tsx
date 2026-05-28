'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import ChannelCard from '@/components/ChannelCard'
import { Channel } from '@/types'

export default function SavedChannelsPage() {
  const { data: session } = useSession()
  const [savedRecords, setSavedRecords] = useState<{ channelId: string; folder: string }[]>([])
  const [channels, setChannels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFolder, setActiveFolder] = useState<'long_form' | 'short_form' | 'terminated'>('long_form')
  const [movingChannelId, setMovingChannelId] = useState<string | null>(null)

  // Sync folder choice with URL search parameters on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const f = new URLSearchParams(window.location.search).get('folder')
      if (f === 'long_form' || f === 'short_form' || f === 'terminated') {
        setActiveFolder(f)
      }
    }
  }, [])

  // 1. Fetch saved metadata & channel details
  useEffect(() => {
    if (!session?.user) return
    
    async function loadSaved() {
      try {
        setLoading(true)
        // Fetch user's saved channel mappings (with folders)
        const saveRes = await fetch('/api/channels/save')
        if (!saveRes.ok) throw new Error('Failed to fetch saved indices')
        const saveMap = await saveRes.json()
        setSavedRecords(saveMap)

        if (saveMap.length === 0) {
          setChannels([])
          setLoading(false)
          return
        }

        // Fetch full channel details for these IDs using a batch query
        // We can query the main /api/channels by sending custom filters or querying by name search,
        // but to make it 100% robust and fast, let's execute a fetch request that gets channels.
        // Wait, to do it cleanly, let's fetch channel details for each saved ID or construct a clean query
        // Since we want to load all details, we can fetch from a batch endpoint or fetch individually.
        // Wait! Let's check if we have a way to fetch channels by ID. In `/api/channels`, we can search by keyword.
        // Let's make a clean batch fetch by passing channelIds in the API query!
        // Wait! Let's check if the main `/api/channels` supports fetching specific IDs. If not, we can query it!
        // To be safe and super elegant, let's perform a simple batch request to a custom endpoint or fetch details.
        // Wait! Let's fetch details of saved channels using `/api/channels` with an advanced filter or a custom `/api/channels/saved/list`!
        // Yes! Building a quick helper endpoint `/api/channels/saved/list` in Next.js backend makes it extremely neat and safe!
        const detailRes = await fetch('/api/channels/saved/list')
        if (detailRes.ok) {
          const detailData = await detailRes.json()
          setChannels(detailData)
        } else {
          // Fallback manual resolution
          setChannels([])
        }
      } catch (err) {
        console.error('Error loading saved dashboard:', err)
      } finally {
        setLoading(false)
      }
    }

    loadSaved()
  }, [session])

  // Move channel to a different folder
  const handleMoveFolder = async (channelId: string, destFolder: string) => {
    try {
      setMovingChannelId(channelId)
      const res = await fetch('/api/channels/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId, folder: destFolder }),
      })

      if (res.ok) {
        const data = await res.json()
        // If it returns saved: true and a folder, it was updated successfully!
        if (data.saved) {
          setSavedRecords(prev => 
            prev.map(r => r.channelId === channelId ? { ...r, folder: destFolder } : r)
          )
        }
      }
    } catch (err) {
      console.error('Error moving channel:', err)
    } finally {
      setMovingChannelId(null)
    }
  }

  // Unsave channel entirely
  const handleUnsave = async (channelId: string) => {
    try {
      const res = await fetch('/api/channels/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId }),
      })

      if (res.ok) {
        setSavedRecords(prev => prev.filter(r => r.channelId !== channelId))
        setChannels(prev => prev.filter(c => c.channelId !== channelId))
      }
    } catch (err) {
      console.error('Error unsaving channel:', err)
    }
  }

  // Filter channels based on search query and folder
  const filteredChannels = channels.filter(ch => {
    const record = savedRecords.find(r => r.channelId === ch.channelId)
    if (!record || record.folder !== activeFolder) return false

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        ch.channelName.toLowerCase().includes(query) ||
        (ch.channelHandle && ch.channelHandle.toLowerCase().includes(query)) ||
        (ch.niche && ch.niche.toLowerCase().includes(query))
      )
    }
    return true
  })

  // Folders stats counts
  const getFolderCount = (f: 'long_form' | 'short_form' | 'terminated') => {
    return savedRecords.filter(r => r.folder === f).length
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-gray-500 p-6">
        <span className="text-5xl">🔒</span>
        <h2 className="text-lg font-bold text-gray-800 dark:text-white">Sign In Required</h2>
        <p className="text-sm text-gray-400 text-center max-w-sm">
          Please log in to your account to view your custom Saved Channels dashboard.
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-500 dark:from-white dark:to-gray-400">
          User Dashboard 💎
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Access your research bookmarks, organize channels, and evaluate growth patterns in real-time.
        </p>
      </div>

      {/* Folders Navigation Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { key: 'long_form',  label: '📹 Long Form Saved',  color: 'from-blue-600/10 to-indigo-600/10 hover:from-blue-600/20 hover:to-indigo-600/20 border-blue-500/20' },
          { key: 'short_form', label: '▶️ Shorts Saved',     color: 'from-purple-600/10 to-pink-600/10 hover:from-purple-600/20 hover:to-pink-600/20 border-purple-500/20' },
          { key: 'terminated', label: '⛔ Terminated Saved',  color: 'from-red-600/10 to-rose-600/10 hover:from-red-600/20 hover:to-rose-600/20 border-red-500/20' },
        ].map(folder => {
          const active = activeFolder === folder.key
          const count = getFolderCount(folder.key as any)
          return (
            <button
              key={folder.key}
              onClick={() => setActiveFolder(folder.key as any)}
              className={`relative flex items-center justify-between p-4 rounded-2xl border transition-all text-left bg-gradient-to-br ${folder.color} ${
                active 
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg' 
                  : 'border-white/10 dark:bg-white/5 bg-white/50 backdrop-blur-md'
              }`}
            >
              <div>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{folder.label}</p>
                <p className="text-xs text-gray-400 mt-1">Bookmarks Folder</p>
              </div>
              <span className="bg-indigo-600 text-white font-extrabold text-xs px-2.5 py-1 rounded-full shadow-md shadow-indigo-600/20">
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Search Filter input */}
      <div className="mb-6 flex gap-3">
        <input
          type="text"
          placeholder="Search within this folder by name, handle, or niche..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="flex-1 border border-gray-200 dark:border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#111112] text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500 shadow-sm"
        />
      </div>

      {/* Grid Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold">Loading saved bookmark details...</span>
        </div>
      ) : filteredChannels.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-80 gap-3 bg-white/50 dark:bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-6 text-center text-gray-400">
          <span className="text-5xl">📁</span>
          <p className="text-base font-semibold text-gray-800 dark:text-gray-300">Folder is empty</p>
          <p className="text-xs text-gray-400 max-w-xs mx-auto">
            {searchQuery 
              ? 'No bookmarked channels in this folder match your search keywords.' 
              : 'Start bookmarking outlier channels inside Niche Finder or from the Chrome Extension!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {filteredChannels.map(ch => (
            <div key={ch.channelId} className="relative group rounded-3xl border border-white/5 bg-white/50 dark:bg-[#111112]/50 backdrop-blur-md overflow-hidden">
              
              {/* Floating Management Bar in saved dashboard */}
              <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded-full shadow-lg">
                <span className="text-[10px] font-bold text-gray-300 mr-1.5">Move to:</span>
                {activeFolder !== 'long_form' && (
                  <button
                    onClick={() => handleMoveFolder(ch.channelId, 'long_form')}
                    disabled={movingChannelId === ch.channelId}
                    className="text-[10px] font-extrabold text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    📹 Long
                  </button>
                )}
                {activeFolder !== 'short_form' && (
                  <button
                    onClick={() => handleMoveFolder(ch.channelId, 'short_form')}
                    disabled={movingChannelId === ch.channelId}
                    className="text-[10px] font-extrabold text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    ▶️ Shorts
                  </button>
                )}
                {activeFolder !== 'terminated' && (
                  <button
                    onClick={() => handleMoveFolder(ch.channelId, 'terminated')}
                    disabled={movingChannelId === ch.channelId}
                    className="text-[10px] font-extrabold text-rose-400 hover:text-rose-300 transition-colors"
                  >
                    ⛔ Terminated
                  </button>
                )}
                <div className="w-[1px] h-3 bg-white/20 mx-1" />
                <button
                  onClick={() => handleUnsave(ch.channelId)}
                  className="text-[10px] font-extrabold text-red-500 hover:text-red-400 transition-colors"
                  title="Remove bookmark"
                >
                  🗑 Remove
                </button>
              </div>

              {/* Render reusable full-featured ChannelCard */}
              <ChannelCard channel={ch} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
