'use client'

import { Channel, Video } from '@/types'
import { useState, useRef, useEffect } from 'react'
import { getRelatedNiches, describeRelated } from '@/lib/nicheGroups'
import Image from 'next/image'
import { useSession } from 'next-auth/react'

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

function getFirstUploadDate(videos: Video[], daysSinceStart?: number): string {
  if (!videos || videos.length === 0) {
    return daysSinceStart ? getActualCreationDate(daysSinceStart) : 'N/A'
  }
  const dates = videos
    .map(v => v.publishedAt ? new Date(v.publishedAt).getTime() : 0)
    .filter(t => t > 0)
  if (dates.length === 0) {
    return daysSinceStart ? getActualCreationDate(daysSinceStart) : 'N/A'
  }
  const minDate = new Date(Math.min(...dates))
  return minDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function getEstimatedCreationDate(daysSinceStart: number): string {
  if (!daysSinceStart) return 'N/A'
  const d = new Date()
  d.setDate(d.getDate() - daysSinceStart)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function outlierColor(score: number) {
  if (score >= 5) return { text: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Very High Outlier' }
  if (score >= 2) return { text: 'text-amber-400 border-amber-500/20 bg-amber-500/10', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Outlier' }
  return { text: 'text-rose-400 border-rose-500/20 bg-rose-500/10', bg: 'bg-rose-500/10', border: 'border-rose-500/20', label: 'Standard' }
}

function getRelativeAge(daysSinceStart: number): string {
  if (!daysSinceStart) return 'N/A'
  const years = daysSinceStart / 365
  if (years >= 1) {
    return `${years.toFixed(1)} years ago`
  }
  const months = Math.floor(daysSinceStart / 30)
  if (months >= 1) {
    return `${months} months ago`
  }
  return `${daysSinceStart} days ago`
}

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
      setSrcIndex(i => i + 1)
    } else {
      setSrcIndex(sources.length)
    }
  }

  const aspectClass = isShortForm ? 'aspect-[9/16]' : 'aspect-video'
  const proxiedSrc = currentSrc ? `/api/image-proxy?url=${encodeURIComponent(currentSrc)}` : ''

  return (
    <div className={`relative ${aspectClass} rounded-lg overflow-hidden bg-gray-50 dark:bg-zinc-900/50 mb-1.5 border border-gray-150 dark:border-zinc-800/80`}>
      {!showPlaceholder ? (
        <Image
          key={currentSrc}
          src={proxiedSrc}
          alt={title}
          fill
          sizes="(max-width: 768px) 33vw, 15vw"
          className="object-contain group-hover:opacity-75 transition-all duration-300"
          onError={handleError}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1">
          <span className="text-gray-400 dark:text-zinc-500 text-3xl">▶</span>
          {isShortForm && <span className="text-[9px] text-gray-500 dark:text-zinc-600">#Shorts</span>}
        </div>
      )}
      {duration && !showPlaceholder && (
        <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded font-mono z-10">
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
    const proxiedAvatar = `/api/image-proxy?url=${encodeURIComponent(thumbnailUrl)}`
    return (
      <a href={`https://youtube.com/channel/${channelId}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
        <Image
          src={proxiedAvatar}
          alt={channelName}
          width={44}
          height={44}
          className="w-11 h-11 rounded-full object-cover border border-gray-200 dark:border-zinc-800"
          onError={() => setFailed(true)}
        />
      </a>
    )
  }

  return (
    <a href={`https://youtube.com/channel/${channelId}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
      <div className="w-11 h-11 rounded-full bg-gray-100 dark:bg-zinc-850 flex items-center justify-center text-gray-700 dark:text-zinc-300 font-bold text-sm border border-gray-200 dark:border-zinc-800">
        {channelName.charAt(0).toUpperCase()}
      </div>
    </a>
  )
}

function VideoScroller({ videos, isShortForm }: { videos: Channel['videos']; isShortForm: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft,  setCanScrollLeft]  = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const [isDragging, setIsDragging] = useState(false)
  const startX = useRef(0)
  const scrollLeftStart = useRef(0)

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const t = setTimeout(() => {
      const overflows = el.scrollWidth > el.clientWidth + 4
      setCanScrollRight(overflows)
    }, 150)
    return () => clearTimeout(t)
  }, [videos])

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

  const handleMouseDown = (e: React.MouseEvent) => {
    const el = scrollRef.current
    if (!el) return
    setIsDragging(true)
    startX.current = e.pageX - el.offsetLeft
    scrollLeftStart.current = el.scrollLeft
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    e.preventDefault()
    const el = scrollRef.current
    if (!el) return
    const x = e.pageX - el.offsetLeft
    const walk = (x - startX.current) * 1.5
    el.scrollLeft = scrollLeftStart.current - walk
  }

  const handleMouseUpOrLeave = () => {
    setIsDragging(false)
  }

  const ARROW_BTN = 'w-6 h-6 bg-white dark:bg-zinc-900 hover:bg-gray-100 dark:hover:bg-zinc-800 border border-gray-200 dark:border-zinc-800 text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 rounded-full flex items-center justify-center transition-all text-xs leading-none select-none flex-shrink-0'

  return (
    <div className="border-t border-gray-100 dark:border-zinc-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-gray-400 dark:text-zinc-500 font-semibold uppercase tracking-widest font-mono">
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

      <div
        ref={scrollRef}
        onScroll={checkScroll}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        className="flex gap-2 overflow-x-auto pb-1 cursor-grab active:cursor-grabbing select-none scrollbar-hide"
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
            <p className="text-[11px] text-gray-600 dark:text-zinc-400 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-white transition-colors leading-tight mt-0.5">
              {video.title}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-mono mt-0.5">
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

function getActualCreationDate(daysSinceStart: number): string {
  if (!daysSinceStart) return 'N/A'
  const d = new Date()
  d.setDate(d.getDate() - daysSinceStart)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatAvgVideoLength(seconds: number): string {
  if (!seconds) return 'N/A'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins > 0) return `${mins}m ${secs}s`
  return `${secs}s`
}

function getEstimatedVideoLength(videos: Video[], dbAvgLength?: number): string {
  if (dbAvgLength && dbAvgLength > 0) {
    return formatAvgVideoLength(dbAvgLength);
  }
  if (!videos || videos.length === 0) return 'N/A';
  
  let totalSeconds = 0;
  let count = 0;
  videos.forEach(v => {
    if (!v.duration) return;
    const parts = v.duration.split(':').map(Number);
    let sec = 0;
    if (parts.length === 3) {
      sec = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      sec = parts[0] * 60 + parts[1];
    } else {
      sec = parts[0] || 0;
    }
    if (sec > 0) {
      totalSeconds += sec;
      count++;
    }
  });
  
  if (count === 0) return 'N/A';
  const avgSeconds = Math.round(totalSeconds / count);
  return formatAvgVideoLength(avgSeconds);
}

export default function ChannelCard({ channel, onFindSimilar }: {
  channel: Channel
  onFindSimilar?: (req: SimilarRequest) => void
}) {
  const { text: scoreText, bg: scoreBg, border: scoreBorder, label: scoreLabel } = outlierColor(channel.outlierScore)
  const isShortForm = channel.channelType === 'short_form' || channel.channelType === 'short'
  const [expanded, setExpanded] = useState(false)
  const { msg: toast, show: showToast } = useToast()

  const { data: session } = useSession()
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!session?.user) return
    async function checkSaved() {
      try {
        const res = await fetch('/api/channels/save')
        if (res.ok) {
          const list: { channelId: string; folder: string }[] = await res.json()
          const isSaved = list.some(item => item.channelId === channel.channelId)
          setSaved(isSaved)
        }
      } catch {}
    }
    checkSaved()
  }, [session, channel.channelId])

  const toggleSave = async () => {
    if (!session?.user) {
      showToast('Sign in to save channels!')
      return
    }
    try {
      const folder = isShortForm ? 'short_form' : 'long_form'
      const res = await fetch('/api/channels/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: channel.channelId, folder }),
      })
      if (res.ok) {
        const data = await res.json()
        setSaved(data.saved)
        showToast(data.saved ? 'Saved to bookmarks!' : 'Removed bookmark!')
      } else {
        showToast('Failed to save bookmark')
      }
    } catch {
      showToast('Error syncing bookmark')
    }
  }

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

  const getDaysRange = () => {
    const d = channel.daysSinceStart
    const spread = Math.max(5, Math.floor(d * 0.1))
    return { daysMin: Math.max(0, d - spread), daysMax: d + spread }
  }

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

  // ── NexLev + vidIQ Estimation Metrics ──
  const shortsRatio = channel.shortsRatioLast30d !== undefined ? channel.shortsRatioLast30d : (isShortForm ? 100.0 : 0.0)
  const monthlyViewsEst = Number(channel.monthlyViews) || (channel.avgViewsPerVideo * (isShortForm ? 15 : 4))
  
  // Split monthly views between long-form and shorts
  const shortsViews = monthlyViewsEst * (shortsRatio / 100.0)
  const longViews = monthlyViewsEst * ((100.0 - shortsRatio) / 100.0)
  
  // Calculate split earnings
  const minEarnings = (longViews / 1000) * 2.00 + (shortsViews / 1000) * 0.05
  const maxEarnings = (longViews / 1000) * 6.00 + (shortsViews / 1000) * 0.15

  const formatRevenue = (val: number): string => {
    if (val <= 0) return '$0'
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`
    return `$${val.toFixed(0)}`
  }

  const revenueRange = `${formatRevenue(minEarnings)} - ${formatRevenue(maxEarnings)}`

  // Oldest Upload Date Check
  const oldestVideoUpload = getFirstUploadDate(channel.videos, channel.daysSinceStart)
  
  // Dynamic extraction of video language
  const channelLang = channel.videos.find(v => v.language)?.language || 'English'
  const subNiches = channel.niche ? getRelatedNiches(channel.niche).slice(0, 3) : []

  // Clean, Deduplicated niches tags (main category + sub-niches case-insensitive deduplication)
  const uniqueNiches = new Set<string>()
  if (channel.niche) {
    uniqueNiches.add(channel.niche.trim())
  }
  subNiches.forEach(sn => {
    const exists = Array.from(uniqueNiches).some(un => un.toLowerCase() === sn.trim().toLowerCase())
    if (!exists) {
      uniqueNiches.add(sn.trim())
    }
  })
  const nichesToRender = Array.from(uniqueNiches)

  // Dynamic Country Fallback
  const channelCountry = (channel as any).country || 'N/A'

  // Monetization status badge next to Avatar
  const monetizationState = channel.isMonetized
    ? 'monetized'
    : (channel.subscribers < 1000 ? 'demonetized' : 'checking')

  const monetBadgeColor = monetizationState === 'monetized'
    ? 'bg-emerald-500 ring-emerald-400/30'
    : (monetizationState === 'demonetized' ? 'bg-rose-500 ring-rose-400/30' : 'bg-amber-500 ring-amber-400/30')

  const monetTooltip = monetizationState === 'monetized'
    ? 'Monetized'
    : (monetizationState === 'demonetized' ? 'Demonetized' : 'Unknown / Checking')

  const monetTextColor = monetizationState === 'monetized'
    ? 'text-emerald-600 dark:text-emerald-400'
    : (monetizationState === 'demonetized' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400')

  const monetBgColor = monetizationState === 'monetized'
    ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-250 dark:border-emerald-900/40'
    : (monetizationState === 'demonetized' ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-250 dark:border-rose-900/40' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-250 dark:border-amber-900/40')

  // Dynamic calculation for Has Shorts / Has Long labels and counts
  const hasShortsLabel = isShortForm ? "Has Long?" : "Has Shorts?";
  const shortsCountVal = channel.shortsVideosCount || 0;
  const longCountVal = channel.longVideosCount || 0;
  const hasShortsVal = isShortForm
    ? (longCountVal > 0 ? `Yes (${longCountVal})` : 'No')
    : (shortsCountVal > 0 ? `Yes (${shortsCountVal})` : 'No');

  // Dynamic last 30d uploads from scroller
  const last30dVideos = channel.videos.filter(v => {
    if (!v.publishedAt) return false;
    const ageInDays = (Date.now() - new Date(v.publishedAt).getTime()) / 86400000;
    return ageInDays <= 30;
  });
  
  const last30dShortsCount = last30dVideos.filter(v => {
    if (!v.duration) return false;
    const parts = v.duration.split(':').map(Number);
    let sec = 0;
    if (parts.length === 3) sec = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) sec = parts[0] * 60 + parts[1];
    else sec = parts[0] || 0;
    return sec <= 60;
  }).length;
  
  const last30dLongCount = last30dVideos.length - last30dShortsCount;

  return (
    <div className="relative bg-white dark:bg-[#09090b] border border-gray-100 dark:border-zinc-800 rounded-xl overflow-hidden hover:border-gray-200 dark:hover:border-zinc-700 transition-colors shadow-sm">

      {/* Toast Notification */}
      {toast && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white text-xs font-mono px-3.5 py-2 rounded-lg border border-gray-200 dark:border-zinc-850 shadow-xl z-50 whitespace-nowrap pointer-events-none">
          {toast}
        </div>
      )}

      {/* ── HEADER BLOCK ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3.5 min-w-0">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <ChannelAvatar
              channelId={channel.channelId}
              thumbnailUrl={channel.thumbnailUrl}
              channelName={channel.channelName}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={`https://youtube.com/channel/${channel.channelId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-gray-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-colors truncate max-w-[180px] text-sm"
              >
                {channel.channelName}
              </a>
              
              {/* Premium Pill Dollar Monetization Badge */}
              <span
                title={monetTooltip}
                className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border shadow-sm select-none cursor-help font-mono transition-colors ${monetBgColor} ${monetTextColor}`}
              >
                $
              </span>
              
              {/* Only show Faceless Badge */}
              {channel.isFaceless && (
                <span className="inline-flex items-center gap-1.5 bg-gray-50 dark:bg-zinc-900 border border-gray-150 dark:border-zinc-800 text-gray-600 dark:text-zinc-400 px-2 py-0.5 rounded text-[10px] font-mono font-semibold select-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" /> Faceless
                </span>
              )}
            </div>
            
            <p className="text-[10px] text-gray-500 dark:text-zinc-500 font-mono mt-0.5 truncate select-all">
              {channel.channelHandle || `@${channel.channelName.toLowerCase().replace(/[^a-z0-9]/g, '')}`}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          {/* Similar competitors dropdown */}
          {onFindSimilar && (
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setShowSimilarMenu(s => !s)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  showSimilarMenu
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-gray-50 dark:bg-zinc-900 text-gray-600 dark:text-zinc-400 border-gray-200 dark:border-zinc-800 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800'
                }`}
              >
                🔍 Similar
                <svg className={`w-2.5 h-2.5 transition-transform ${showSimilarMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Similar Options */}
              {showSimilarMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-white dark:bg-[#09090b] border border-gray-200 dark:border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden font-sans">
                  <div className="px-3 py-2 bg-gray-50 dark:bg-[#0d0d0f] border-b border-gray-200 dark:border-zinc-800">
                    <p className="text-[9px] font-mono font-bold text-gray-500 dark:text-zinc-500 uppercase tracking-widest">
                      Competitors Finder
                    </p>
                  </div>

                  <div className="py-1">
                    {channel.niche && (
                      <button
                        onClick={() => fireSimilar({ type: 'niche', channelName: channel.channelName, niches: [channel.niche!] })}
                        className="w-full flex items-start gap-2.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors text-left"
                      >
                        <span className="text-xs">🏷️</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800 dark:text-zinc-200">Same Niche</p>
                          <p className="text-[10px] text-gray-500 dark:text-zinc-500 truncate">{channel.niche} channels only</p>
                        </div>
                      </button>
                    )}

                    {channel.niche && (
                      <button
                        onClick={() => fireSimilar({ type: 'related_niches', channelName: channel.channelName, niches: getRelatedNiches(channel.niche!) })}
                        className="w-full flex items-start gap-2.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors text-left"
                      >
                        <span className="text-xs">🔗</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800 dark:text-zinc-200">Related Niches</p>
                          <p className="text-[10px] text-gray-500 dark:text-zinc-500 truncate">{describeRelated(channel.niche!)}</p>
                        </div>
                      </button>
                    )}

                    {titleKeyword && (
                      <button
                        onClick={() => fireSimilar({ type: 'title', channelName: channel.channelName, keyword: titleKeyword })}
                        className="w-full flex items-start gap-2.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors text-left"
                      >
                        <span className="text-xs">📝</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800 dark:text-zinc-200">Similar Titles</p>
                          <p className="text-[10px] text-gray-500 dark:text-zinc-500 truncate">Keyword: &quot;{titleKeyword}&quot;</p>
                        </div>
                      </button>
                    )}

                    {channel.daysSinceStart > 0 && (
                      <button
                        onClick={() => fireSimilar({ type: 'same_age', channelName: channel.channelName, ...getDaysRange() })}
                        className="w-full flex items-start gap-2.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors text-left"
                      >
                        <span className="text-xs">📅</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800 dark:text-zinc-200">Same Channel Age</p>
                          <p className="text-[10px] text-gray-500 dark:text-zinc-500">Started around same time</p>
                        </div>
                      </button>
                    )}

                    <button
                      onClick={() => fireSimilar({ type: 'similar_size', channelName: channel.channelName, ...getSubsRange() })}
                      className="w-full flex items-start gap-2.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors text-left"
                    >
                      <span className="text-xs">👤</span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800 dark:text-zinc-200">Similar Size</p>
                        <p className="text-[10px] text-gray-500 dark:text-zinc-500">Same subscriber size range</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bookmarks, Copy & Expand Toggle controls */}
          <div className="flex items-center gap-1 border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 rounded-lg p-0.5">
            <button
              onClick={toggleSave}
              title={saved ? 'Remove from saved' : 'Save channel'}
              className="p-1.5 rounded-md hover:bg-gray-250/70 dark:hover:bg-zinc-800 transition-colors"
            >
              <svg className={`w-3.5 h-3.5 transition-all duration-300 ${saved ? 'text-indigo-500 fill-indigo-500 stroke-indigo-500' : 'stroke-gray-500 dark:stroke-zinc-400 text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white'}`} fill={saved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 3H7a2 2 0 00-2 2v16l7-3 7 3V5a2 2 0 00-2-2z" />
              </svg>
            </button>
            
            <button
              onClick={handleShare}
              title="Copy channel URL"
              className="p-1.5 rounded-md hover:bg-gray-250/70 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </button>
            
            <button
              onClick={() => setExpanded(e => !e)}
              title={expanded ? 'Collapse' : 'Expand'}
              className="p-1.5 rounded-md hover:bg-gray-250/70 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180 text-indigo-500' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── NICHES CHIP SECTION (Light Gray non-duplicated uniform modern pills) ── */}
      <div className="px-5 pb-4 flex flex-wrap gap-1.5">
        {nichesToRender.map((nch, idx) => (
          <span
            key={nch}
            className="bg-gray-100 text-gray-700 dark:bg-zinc-850 dark:text-zinc-300 border border-gray-200 dark:border-zinc-800 px-3 py-1 rounded-full text-[10px] font-medium tracking-wide shadow-sm flex items-center gap-1 select-none"
          >
            {idx === 0 ? '🏷️' : '·'} {nch}
          </span>
        ))}
      </div>

      {/* ── CORE 4 STATS BOXES ROW (Sirf 4 boxes - 1 line mein) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-5 border-t border-gray-100 dark:border-zinc-900 bg-gray-50/50 dark:bg-zinc-950/20">
        {[
          { label: 'Subscribers', value: formatNumber(channel.subscribers) },
          { label: 'Total Videos', value: channel.totalVideos.toLocaleString() },
          { label: 'Total Views', value: formatNumber(channel.totalViews) },
          { label: 'Creation Date', value: getActualCreationDate(channel.daysSinceStart), valueClass: 'font-mono' },
        ].map(stat => (
          <div key={stat.label} className="bg-white dark:bg-[#09090b] border border-gray-150 dark:border-zinc-850 rounded-xl p-3.5 flex flex-col justify-between hover:border-gray-200 dark:hover:border-zinc-850 transition-colors shadow-sm">
            <span className="text-[9px] font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-widest font-semibold">{stat.label}</span>
            <p className={`text-xs font-bold text-gray-800 dark:text-zinc-200 mt-2 ${stat.valueClass || ''}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ── EXPANDED EXTRA INFO SECTION (Down arrow expanded - 11 Stats Grid) ── */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-zinc-900 p-5 bg-gray-50/30 dark:bg-zinc-950/30">
          <p className="text-[9px] text-gray-500 dark:text-zinc-500 font-mono font-bold uppercase tracking-widest mb-4">Metadata & Performance Insights</p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* 1. Monetization Status Card */}
            <div className={`border rounded-xl p-3.5 flex flex-col justify-between shadow-sm ${monetBgColor}`}>
              <span className="text-[9px] font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-widest font-semibold">Monetization Status</span>
              <p className={`text-xs font-bold mt-2 flex items-center gap-1 ${monetTextColor}`}>
                {monetizationState === 'monetized' && '✅ Monetized'}
                {monetizationState === 'demonetized' && '❌ Demonetized'}
                {monetizationState === 'checking' && '⏳ Unknown / Checking'}
              </p>
            </div>

            {/* 2. Language Card */}
            <div className="bg-white dark:bg-[#09090b] border border-gray-150 dark:border-zinc-850 rounded-xl p-3.5 flex flex-col justify-between shadow-sm hover:border-gray-200 dark:hover:border-zinc-800 transition-colors">
              <span className="text-[9px] font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-widest font-semibold">Language</span>
              <p className="text-xs font-bold text-gray-800 dark:text-zinc-200 mt-2">{channelLang}</p>
            </div>

            {/* 3. Country Card */}
            <div className="bg-white dark:bg-[#09090b] border border-gray-150 dark:border-zinc-850 rounded-xl p-3.5 flex flex-col justify-between shadow-sm hover:border-gray-200 dark:hover:border-zinc-800 transition-colors">
              <span className="text-[9px] font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-widest font-semibold">Country</span>
              <p className="text-xs font-bold text-gray-800 dark:text-zinc-200 mt-2">{channelCountry}</p>
            </div>

            {/* 4. 1st Upload Date Card */}
            <div className="bg-white dark:bg-[#09090b] border border-gray-150 dark:border-zinc-850 rounded-xl p-3.5 flex flex-col justify-between shadow-sm hover:border-gray-200 dark:hover:border-zinc-800 transition-colors">
              <span className="text-[9px] font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-widest font-semibold">1st Upload Date</span>
              <p className="text-xs font-bold text-gray-800 dark:text-zinc-200 mt-2 font-mono">{oldestVideoUpload}</p>
            </div>

            {/* 5. Content Type Card */}
            <div className="bg-white dark:bg-[#09090b] border border-gray-150 dark:border-zinc-850 rounded-xl p-3.5 flex flex-col justify-between shadow-sm hover:border-gray-200 dark:hover:border-zinc-800 transition-colors">
              <span className="text-[9px] font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-widest font-semibold">Content Type</span>
              <p className="text-xs font-bold text-gray-800 dark:text-zinc-200 mt-2">{isShortForm ? 'Shorts' : 'Long-Form'}</p>
            </div>

            {/* 6. Has Shorts? / Has Long? Card */}
            <div className="bg-white dark:bg-[#09090b] border border-gray-150 dark:border-zinc-850 rounded-xl p-3.5 flex flex-col justify-between shadow-sm hover:border-gray-200 dark:hover:border-zinc-800 transition-colors">
              <span className="text-[9px] font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-widest font-semibold">{hasShortsLabel}</span>
              <p className="text-xs font-bold text-gray-800 dark:text-zinc-200 mt-2">{hasShortsVal}</p>
            </div>

            {/* 7. Average Views Per Video Card */}
            <div className="bg-white dark:bg-[#09090b] border border-gray-150 dark:border-zinc-850 rounded-xl p-3.5 flex flex-col justify-between shadow-sm hover:border-gray-200 dark:hover:border-zinc-800 transition-colors">
              <span className="text-[9px] font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-widest font-semibold">Avg Views / Video</span>
              <p className="text-xs font-bold text-gray-800 dark:text-zinc-200 mt-2 font-mono">{formatNumber(channel.avgViewsPerVideo)}</p>
            </div>

            {/* 8. Average Video Length Card */}
            <div className="bg-white dark:bg-[#09090b] border border-gray-150 dark:border-zinc-850 rounded-xl p-3.5 flex flex-col justify-between shadow-sm hover:border-gray-200 dark:hover:border-zinc-800 transition-colors">
              <span className="text-[9px] font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-widest font-semibold">Avg Video Length</span>
              <p className="text-xs font-bold text-gray-800 dark:text-zinc-200 mt-2 font-mono">{getEstimatedVideoLength(channel.videos, channel.avgVideoLength)}</p>
            </div>

            {/* 9. Outlier Growth Card */}
            <div className={`border rounded-xl p-3.5 flex flex-col justify-between shadow-sm ${scoreBg} ${scoreBorder} hover:border-gray-200 dark:hover:border-zinc-800 transition-colors`}>
              <span className="text-[9px] font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-widest font-semibold">Outlier Growth</span>
              <div className="mt-2 flex items-center justify-between">
                <span className={`text-xs font-bold font-mono ${scoreText}`}>{channel.outlierScore.toFixed(2)}x</span>
                <span className={`text-[8px] uppercase font-mono tracking-wider font-semibold ${scoreText}`}>{scoreLabel}</span>
              </div>
            </div>

            {/* 10. Last 30 Days Views Card */}
            <div className="bg-white dark:bg-[#09090b] border border-gray-150 dark:border-zinc-850 rounded-xl p-3.5 flex flex-col justify-between shadow-sm hover:border-gray-200 dark:hover:border-zinc-800 transition-colors">
              <span className="text-[9px] font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-widest font-semibold">Last 30 Days Views</span>
              <p className="text-xs font-bold text-gray-800 dark:text-zinc-200 mt-2 font-mono">{formatNumber(monthlyViewsEst)}</p>
            </div>

            {/* 11. Last 30 Days Estimated Earnings Card */}
            <div className="bg-white dark:bg-[#09090b] border border-gray-150 dark:border-zinc-850 rounded-xl p-3.5 flex flex-col justify-between shadow-sm hover:border-gray-200 dark:hover:border-zinc-800 transition-colors col-span-2 md:col-span-1">
              <span className="text-[9px] font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-widest font-semibold">Last 30d Earnings</span>
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-2 font-mono">{revenueRange}</p>
            </div>

            {/* 12. Long Videos Count Card */}
            <div className="bg-white dark:bg-[#09090b] border border-gray-150 dark:border-zinc-850 rounded-xl p-3.5 flex flex-col justify-between shadow-sm hover:border-gray-200 dark:hover:border-zinc-800 transition-colors">
              <span className="text-[9px] font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-widest font-semibold">Long Videos Count</span>
              <p className="text-xs font-bold text-gray-800 dark:text-zinc-200 mt-2 font-mono">{longCountVal.toLocaleString()}</p>
            </div>

            {/* 13. Shorts Videos Count Card */}
            <div className="bg-white dark:bg-[#09090b] border border-gray-150 dark:border-zinc-850 rounded-xl p-3.5 flex flex-col justify-between shadow-sm hover:border-gray-200 dark:hover:border-zinc-800 transition-colors">
              <span className="text-[9px] font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-widest font-semibold">Shorts Videos Count</span>
              <p className="text-xs font-bold text-gray-800 dark:text-zinc-200 mt-2 font-mono">{shortsCountVal.toLocaleString()}</p>
            </div>

            {/* 14. Last 30d Long Uploads Card */}
            <div className="bg-white dark:bg-[#09090b] border border-gray-150 dark:border-zinc-850 rounded-xl p-3.5 flex flex-col justify-between shadow-sm hover:border-gray-200 dark:hover:border-zinc-800 transition-colors">
              <span className="text-[9px] font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-widest font-semibold">Last 30d Long Uploads</span>
              <p className="text-xs font-bold text-gray-800 dark:text-zinc-200 mt-2 font-mono">{last30dLongCount}</p>
            </div>

            {/* 15. Last 30d Shorts Uploads Card */}
            <div className="bg-white dark:bg-[#09090b] border border-gray-150 dark:border-zinc-850 rounded-xl p-3.5 flex flex-col justify-between shadow-sm hover:border-gray-200 dark:hover:border-zinc-800 transition-colors">
              <span className="text-[9px] font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-widest font-semibold">Last 30d Shorts Uploads</span>
              <p className="text-xs font-bold text-gray-800 dark:text-zinc-200 mt-2 font-mono">{last30dShortsCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Most Popular Videos Scroller ── */}
      {channel.videos.length > 0 && (
        <VideoScroller videos={channel.videos} isShortForm={isShortForm} />
      )}
    </div>
  )
}
