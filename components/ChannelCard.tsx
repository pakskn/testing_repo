'use client'

import { Channel } from '@/types'
import { useState, useRef, useEffect } from 'react'
import { getRelatedNiches, describeRelated } from '@/lib/nicheGroups'

export type SimilarRequest = {
  type: 'niche' | 'related_niches' | 'title' | 'same_age' | 'similar_size'
  channelName: string
  niche?: string
  niches?: string[]
  keyword?: string
  daysMin?: number
  daysMax?: number
  subsMin?: number
  subsMax?: number
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days < 1)   return 'today'
  if (days < 7)   return `${days}d ago`
  if (days < 30)  return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

function outlierColor(score: number) {
  if (score >= 5) return { text: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-400/10' }
  if (score >= 2) return { text: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-400/10' }
  return { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-400/10' }
}

// YouTube video IDs are exactly 11 chars: A-Z a-z 0-9 _ -
function isRealYouTubeId(id: string): boolean {
  return /^[A-Za-z0-9_-]{11}$/.test(id)
}

function VideoThumbnail({ videoId, storedUrl, title, duration, isShortForm = false }: {
  videoId: string
  storedUrl: string | null
  title: string
  duration: string | null
  isShortForm?: boolean
}) {
  // Try 3 sources in order: mqdefault → hqdefault → stored API URL → placeholder
  const sources = [
    ...(isRealYouTubeId(videoId) ? [
      `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    ] : []),
    ...(storedUrl ? [storedUrl] : []),
  ]

  const [srcIndex, setSrcIndex] = useState(0)
  const currentSrc = sources[srcIndex]
  const showPlaceholder = !currentSrc

  const handleError = () => {
    if (srcIndex < sources.length - 1) {
      setSrcIndex(i => i + 1)  // try next source
    } else {
      setSrcIndex(sources.length)  // all failed → placeholder
    }
  }

  const aspectClass = isShortForm ? 'aspect-[9/16]' : 'aspect-video'

  return (
    <div className={`relative ${aspectClass} rounded-lg overflow-hidden bg-gray-100 dark:bg-[#252525] mb-1.5`}>
      {!showPlaceholder ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={currentSrc}
          src={currentSrc}
          alt={title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
          onError={handleError}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1">
          <span className="text-gray-300 dark:text-gray-600 text-3xl">▶</span>
          {isShortForm && <span className="text-[9px] text-gray-300 dark:text-gray-700">#Shorts</span>}
        </div>
      )}
      {duration && !showPlaceholder && (
        <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded font-mono">
          {duration}
        </span>
      )}
    </div>
  )
}

function ChannelAvatar({ channelId, thumbnailUrl, channelName }: {
  channelId: string
  thumbnailUrl: string | null
  channelName: string
}) {
  const [failed, setFailed] = useState(false)

  if (thumbnailUrl && !failed) {
    return (
      <a href={`https://youtube.com/channel/${channelId}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnailUrl}
          alt={channelName}
          loading="lazy"
          decoding="async"
          className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-200 dark:ring-[#2a2a2a]"
          onError={() => setFailed(true)}
        />
      </a>
    )
  }

  return (
    <a href={`https://youtube.com/channel/${channelId}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-[#2a2a2a] flex items-center justify-center text-gray-600 dark:text-white font-bold text-sm ring-2 ring-gray-300 dark:ring-[#3a3a3a]">
        {channelName.charAt(0).toUpperCase()}
      </div>
    </a>
  )
}

function VideoScroller({ videos, isShortForm }: { videos: Channel['videos']; isShortForm: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft,  setCanScrollLeft]  = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  // After render, check actual scrollability
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const t = setTimeout(() => {
      const overflows = el.scrollWidth > el.clientWidth + 4
      setCanScrollRight(overflows)
    }, 150)
    return () => clearTimeout(t)
  }, [videos])

  // Also re-check on window resize
  useEffect(() => {
    const handler = () => checkScroll()
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const step = el.clientWidth / 3 * 3
    el.scrollBy({ left: dir === 'right' ? step : -step, behavior: 'smooth' })
  }

  const ARROW_BTN = 'w-6 h-6 bg-gray-200 dark:bg-[#333] hover:bg-gray-300 dark:hover:bg-[#444] text-gray-700 dark:text-gray-200 rounded-full flex items-center justify-center transition-all text-base leading-none select-none flex-shrink-0'

  return (
    <div className="border-t border-gray-100 dark:border-[#2a2a2a] p-4">

      {/* Header row — arrows here in the title bar */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-widest">
          Most Popular Videos
        </span>
        <div className="flex items-center gap-1">
          {canScrollLeft && (
            <button onClick={() => scroll('left')} className={ARROW_BTN} title="Previous">‹</button>
          )}
          {canScrollRight && (
            <button onClick={() => scroll('right')} className={ARROW_BTN} title="More videos">›</button>
          )}
        </div>
      </div>

      {/* Scrollable videos — full width, no arrows inside */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        {videos.map(video => (
          <a
            key={video.videoId}
            href={`https://youtube.com/watch?v=${video.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group"
            style={{ flex: '0 0 calc(34% - 4px)', minWidth: 'calc(34% - 4px)' }}
          >
            <VideoThumbnail
              videoId={video.videoId}
              storedUrl={video.thumbnailUrl}
              title={video.title}
              duration={video.duration}
              isShortForm={isShortForm}
            />
            <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 group-hover:text-gray-900 dark:group-hover:text-white transition-colors leading-tight mt-0.5">
              {video.title}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-0.5">
              {formatNumber(video.views)} · {timeAgo(video.publishedAt)}
            </p>
          </a>
        ))}
      </div>
    </div>
  )
}

function useToast() {
  const [msg, setMsg] = useState('')
  const show = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2000) }
  return { msg, show }
}

export default function ChannelCard({ channel, onFindSimilar }: {
  channel: Channel
  onFindSimilar?: (req: SimilarRequest) => void
}) {
  const { text: scoreText, bg: scoreBg } = outlierColor(channel.outlierScore)
  const isShortForm = channel.channelType === 'short_form'
  const [expanded, setExpanded] = useState(false)
  const { msg: toast, show: showToast } = useToast()

  // Bookmark — persisted to localStorage
  const SAVE_KEY = 'nf-saved-channels'
  const [saved, setSaved] = useState(() => {
    try {
      const list: string[] = JSON.parse(localStorage.getItem(SAVE_KEY) || '[]')
      return list.includes(channel.channelId)
    } catch { return false }
  })

  const toggleSave = () => {
    try {
      const list: string[] = JSON.parse(localStorage.getItem(SAVE_KEY) || '[]')
      const next = saved
        ? list.filter(id => id !== channel.channelId)
        : [...list, channel.channelId]
      localStorage.setItem(SAVE_KEY, JSON.stringify(next))
      setSaved(!saved)
      showToast(saved ? 'Removed from saved' : 'Saved!')
    } catch {}
  }

  // Similar dropdown
  const [showSimilarMenu, setShowSimilarMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowSimilarMenu(false)
      }
    }
    if (showSimilarMenu) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showSimilarMenu])

  // Helper: extract keywords from channel name
  const titleKeyword = (() => {
    const stopwords = ['the','a','an','and','or','of','in','on','at','to','for','with','by','is','are','was']
    return channel.channelName
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopwords.includes(w))
      .slice(0, 2)
      .join(' ')
  })()

  // Helper: days range ±10% with min ±5 days
  const getDaysRange = () => {
    const d = channel.daysSinceStart
    const spread = Math.max(5, Math.floor(d * 0.1))
    return { daysMin: Math.max(0, d - spread), daysMax: d + spread }
  }

  // Helper: subscriber range ±10%
  const getSubsRange = () => ({
    subsMin: Math.max(100, Math.floor(channel.subscribers * 0.9)),
    subsMax: Math.ceil(channel.subscribers * 1.1),
  })

  const fireSimilar = (req: SimilarRequest) => {
    setShowSimilarMenu(false)
    onFindSimilar?.(req)
  }

  const handleShare = async () => {
    const url = `https://youtube.com/channel/${channel.channelId}`
    try {
      await navigator.clipboard.writeText(url)
      showToast('Channel URL copied!')
    } catch {
      showToast(url)
    }
  }

  return (
    <div className="relative bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-xl overflow-hidden hover:border-gray-300 dark:hover:border-[#3a3a3a] transition-colors shadow-sm dark:shadow-none">

      {/* ── Header ── */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 min-w-0">
          <ChannelAvatar
            channelId={channel.channelId}
            thumbnailUrl={channel.thumbnailUrl}
            channelName={channel.channelName}
          />

          <div className="min-w-0">
            <a
              href={`https://youtube.com/channel/${channel.channelId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 group"
            >
              <span className="text-gray-900 dark:text-white font-semibold text-sm group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors truncate max-w-[160px]">
                {channel.channelName}
              </span>
              <span
                title={channel.isMonetized ? 'Monetized' : 'Not Monetized'}
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0 ${
                  channel.isMonetized
                    ? 'bg-green-500 text-white'
                    : 'bg-red-400 text-white'
                }`}
              >
                $
              </span>
            </a>
            <div className="flex items-center gap-1.5 mt-0.5">
              {channel.niche && (
                <span className="text-[11px] bg-gray-100 dark:bg-[#252525] text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full border border-gray-200 dark:border-[#333]">
                  {channel.niche}
                </span>
              )}
              <span className="text-[11px] text-gray-400 dark:text-gray-600">
                {formatNumber(channel.subscribers)} subs
              </span>
            </div>
          </div>
        </div>

        {/* Toast notification */}
        {toast && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-medium px-3 py-1.5 rounded-full shadow-lg z-10 whitespace-nowrap pointer-events-none">
            {toast}
          </div>
        )}

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {/* Similar Channels dropdown */}
          {onFindSimilar && (
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setShowSimilarMenu(s => !s)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  showSimilarMenu
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-[#1a1a1a] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-[#2a2a2a] hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Similar
                <svg className={`w-2.5 h-2.5 transition-transform ${showSimilarMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown menu */}
              {showSimilarMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-[#2a2a2a] rounded-xl shadow-xl z-50 overflow-hidden">
                  {/* Header */}
                  <div className="px-3 py-2 bg-gray-50 dark:bg-[#111] border-b border-gray-100 dark:border-[#222]">
                    <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Find Similar to {channel.channelName.slice(0, 20)}{channel.channelName.length > 20 ? '...' : ''}
                    </p>
                  </div>

                  {/* Options */}
                  <div className="py-1">

                    {/* Same Niche */}
                    {channel.niche && (
                      <button
                        onClick={() => fireSimilar({ type: 'niche', channelName: channel.channelName, niches: [channel.niche!] })}
                        className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors text-left"
                      >
                        <span className="text-base mt-0.5">🏷️</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Same Niche</p>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{channel.niche} channels only</p>
                        </div>
                      </button>
                    )}

                    {/* Related Niches */}
                    {channel.niche && (
                      <button
                        onClick={() => fireSimilar({ type: 'related_niches', channelName: channel.channelName, niches: getRelatedNiches(channel.niche!) })}
                        className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors text-left"
                      >
                        <span className="text-base mt-0.5">🔗</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Related Niches</p>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{describeRelated(channel.niche!)}</p>
                        </div>
                      </button>
                    )}

                    {/* Similar Titles */}
                    {titleKeyword && (
                      <button
                        onClick={() => fireSimilar({ type: 'title', channelName: channel.channelName, keyword: titleKeyword })}
                        className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors text-left"
                      >
                        <span className="text-base mt-0.5">📝</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Similar Titles</p>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">Keyword: &quot;{titleKeyword}&quot;</p>
                        </div>
                      </button>
                    )}

                    {/* Same Age */}
                    {channel.daysSinceStart > 0 && (
                      <button
                        onClick={() => fireSimilar({ type: 'same_age', channelName: channel.channelName, ...getDaysRange() })}
                        className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors text-left"
                      >
                        <span className="text-base mt-0.5">📅</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Started Around Same Time</p>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500">
                            {Math.max(0, channel.daysSinceStart - Math.max(5, Math.floor(channel.daysSinceStart * 0.1)))}–
                            {channel.daysSinceStart + Math.max(5, Math.floor(channel.daysSinceStart * 0.1))} days old (±10%)
                          </p>
                        </div>
                      </button>
                    )}

                    {/* Similar Size */}
                    <button
                      onClick={() => fireSimilar({ type: 'similar_size', channelName: channel.channelName, ...getSubsRange() })}
                      className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors text-left"
                    >
                      <span className="text-base mt-0.5">👤</span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Similar Subscriber Count</p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">
                          {formatNumber(Math.max(100, Math.floor(channel.subscribers * 0.9)))}–
                          {formatNumber(Math.ceil(channel.subscribers * 1.1))} subs (±10%)
                        </p>
                      </div>
                    </button>

                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-1 text-gray-400 dark:text-gray-600">
            {/* Save/Bookmark button */}
            <button
              onClick={toggleSave}
              title={saved ? 'Remove from saved' : 'Save channel'}
              className={`p-1 rounded transition-colors hover:bg-gray-100 dark:hover:bg-[#2a2a2a] ${saved ? 'text-blue-500' : 'hover:text-gray-700 dark:hover:text-white'}`}
            >
              <svg className="w-4 h-4" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 3H7a2 2 0 00-2 2v16l7-3 7 3V5a2 2 0 00-2-2z" />
              </svg>
            </button>
            {/* Share/Copy button */}
            <button
              onClick={handleShare}
              title="Copy channel URL"
              className="hover:text-gray-700 dark:hover:text-white transition-colors p-1 rounded hover:bg-gray-100 dark:hover:bg-[#2a2a2a]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </button>
            {/* Expand / Collapse arrow */}
            <button
              onClick={() => setExpanded(e => !e)}
              title={expanded ? 'Collapse details' : 'Expand details'}
              className={`p-1 rounded transition-all hover:bg-gray-100 dark:hover:bg-[#2a2a2a] ${expanded ? 'text-blue-500' : 'hover:text-gray-700 dark:hover:text-white'}`}
            >
              <svg className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          <span className="text-[10px] text-gray-400 dark:text-gray-600" title="Last updated">
            ↻ {timeAgo(channel.updatedAt)}
          </span>
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-4 border-t border-gray-100 dark:border-[#2a2a2a] divide-x divide-gray-100 dark:divide-[#2a2a2a]">
        <div className="p-3 text-center">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wide">Avg Views/Video</p>
          <p className="text-gray-900 dark:text-white font-bold text-sm">{formatNumber(channel.avgViewsPerVideo)}</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wide">Days Since Start</p>
          <p className="text-gray-900 dark:text-white font-bold text-sm">{channel.daysSinceStart}</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wide">Uploads</p>
          <p className="text-gray-900 dark:text-white font-bold text-sm">{channel.totalVideos}</p>
        </div>
        <div className={`p-3 text-center ${scoreBg}`}>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wide">Outlier Score</p>
          <p className={`font-bold text-sm ${scoreText}`}>{channel.outlierScore.toFixed(2)}x</p>
        </div>
      </div>

      {/* ── Most Popular Videos — 3 visible, arrow + scroll to see 4-10 ── */}
      {channel.videos.length > 0 && (
        <VideoScroller videos={channel.videos} isShortForm={isShortForm} />
      )}

      {/* ── Expanded Detail Section ── */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-[#2a2a2a] p-4 bg-gray-50/50 dark:bg-[#111]">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-widest mb-3">Channel Details</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {[
              { label: 'Total Views',     value: formatNumber(channel.totalViews) },
              { label: 'Subscribers',     value: formatNumber(channel.subscribers) },
              { label: 'Total Videos',    value: channel.totalVideos.toLocaleString() },
              { label: 'Channel Age',     value: `${channel.daysSinceStart} days` },
              { label: 'Avg Views/Video', value: formatNumber(channel.avgViewsPerVideo) },
              { label: 'Outlier Score',   value: `${channel.outlierScore.toFixed(2)}x` },
            ].map(item => (
              <div key={item.label} className="bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-[#2a2a2a] rounded-lg p-2.5">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">{item.label}</p>
                <p className="text-gray-900 dark:text-white font-bold text-sm">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-[#2a2a2a] rounded-lg p-2.5">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Monetized</p>
              <p className={`font-bold text-sm ${channel.isMonetized ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                {channel.isMonetized ? '✓ Yes' : '✕ No'}
              </p>
            </div>
            <div className="bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-[#2a2a2a] rounded-lg p-2.5">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Type</p>
              <p className="text-gray-900 dark:text-white font-bold text-sm capitalize">
                {channel.channelType.replace('_', ' ')}
              </p>
            </div>
            {channel.channelHandle && (
              <div className="bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-[#2a2a2a] rounded-lg p-2.5 col-span-2">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Handle</p>
                <a
                  href={`https://youtube.com/${channel.channelHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600 dark:text-blue-400 font-medium text-sm"
                >
                  {channel.channelHandle}
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
