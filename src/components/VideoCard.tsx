'use client'

import { useState } from 'react'
import Image from 'next/image'

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n/1_000).toFixed(1)}K`
  return String(n)
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return ''
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (d < 1) return 'today'; if (d < 7) return `${d}d`
  if (d < 30) return `${Math.floor(d/7)}w`; if (d < 365) return `${Math.floor(d/30)}mo`
  return `${Math.floor(d/365)}y`
}

function isRealId(id: string) { return /^[A-Za-z0-9_-]{11}$/.test(id) }

function extractKeywords(title: string): string {
  const stop = new Set(['the','a','an','and','or','of','in','on','at','to','for',
    'how','what','why','when','is','are','was','were','i','my','you','your','this',
    'that','it','be','do','did','with','from','by','as','up','about','into','like'])
  return title.toLowerCase()
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stop.has(w))
    .slice(0, 3)
    .join(' ')
}

export interface VideoData {
  videoId: string; title: string; thumbnailUrl: string | null
  views: number; duration: string | null; publishedAt: string | null
  channel: {
    channelId: string; channelName: string; thumbnailUrl: string | null
    niche: string | null; subscribers: number; outlierScore: number
  }
}

type HoverTab = 'titles' | 'thumbnails' | 'channels'

export default function VideoCard({ video, onSave, onSimilarTitles, onSimilarNiche }: {
  video: VideoData
  onSave?: (video: VideoData) => void
  onSimilarTitles?: (q: string) => void
  onSimilarNiche?: (niche: string) => void
}) {
  const [thumbFailed, setThumbFailed] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const [hoverTab, setHoverTab] = useState<HoverTab>('titles')
  const [saved, setSaved] = useState(false)

  const thumbSrc = video.thumbnailUrl ||
    (isRealId(video.videoId) ? `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg` : null)

  const outlierColor = video.channel.outlierScore >= 5 ? 'bg-green-500' :
    video.channel.outlierScore >= 2 ? 'bg-yellow-500' : 'bg-red-400'

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    setSaved(s => !s)
    onSave?.(video)
  }

  const handleSimilarTitles = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    const q = extractKeywords(video.title)
    if (q) onSimilarTitles?.(q)
  }

  const handleSimilarThumbnails = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (video.channel.niche) onSimilarNiche?.(video.channel.niche)
  }

  const handleGenerateIdea = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(video.title)}`, '_blank')
  }

  const handleViewChannel = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    window.open(`https://youtube.com/channel/${video.channel.channelId}`, '_blank')
  }

  const handleChannelClick = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (video.channel.niche) {
      window.location.href = `/channels/long-form?q=${encodeURIComponent(video.channel.niche)}`
    } else {
      window.open(`https://youtube.com/channel/${video.channel.channelId}`, '_blank')
    }
  }

  return (
    <div className="group relative bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-[#2a2a2a] rounded-xl overflow-hidden hover:border-blue-300 dark:hover:border-blue-600 transition-all shadow-sm hover:shadow-lg">

      {/* Thumbnail area */}
      <div className="relative aspect-video bg-gray-100 dark:bg-[#252525] overflow-hidden cursor-pointer"
        onClick={() => isRealId(video.videoId) && window.open(`https://youtube.com/watch?v=${video.videoId}`, '_blank')}>

        {thumbSrc && !thumbFailed ? (
          <Image
            src={`/api/image-proxy?url=${encodeURIComponent(thumbSrc)}`}
            alt={video.title}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover group-hover:brightness-50 transition-all duration-300"
            onError={() => setThumbFailed(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600 text-3xl group-hover:opacity-30">▶</div>
        )}

        {video.duration && video.duration !== '0:00' && (
          <span className="absolute bottom-1.5 right-1.5 bg-black/90 text-white text-[10px] font-mono px-1.5 py-0.5 rounded z-10">
            {video.duration}
          </span>
        )}

        <span className={`absolute top-1.5 left-1.5 ${outlierColor} text-white text-[10px] font-bold px-1.5 py-0.5 rounded z-10`}>
          {video.channel.outlierScore.toFixed(1)}x
        </span>

        {/* ── HOVER OVERLAY ── */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col z-20">
          <div className="flex gap-1 p-2">
            {(['titles','thumbnails','channels'] as HoverTab[]).map(tab => (
              <button key={tab} onClick={e => { e.preventDefault(); e.stopPropagation(); setHoverTab(tab) }}
                className={`flex-1 py-1.5 text-[10px] font-semibold rounded transition-colors ${
                  hoverTab === tab ? 'bg-white text-gray-900' : 'bg-white/20 text-white hover:bg-white/30'
                }`}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex-1 flex flex-col items-center justify-center gap-2 px-3">
            {hoverTab === 'titles' && (
              <>
                <button onClick={handleSimilarTitles}
                  className="w-full py-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-xs rounded-xl font-semibold transition-colors border border-white/20">
                  🔍 Similar titles
                </button>
                <button onClick={handleGenerateIdea}
                  className="w-full py-2.5 bg-blue-600/90 hover:bg-blue-600 text-white text-xs rounded-xl font-semibold transition-colors">
                  💡 Generate idea
                </button>
              </>
            )}
            {hoverTab === 'thumbnails' && (
              <>
                <button onClick={handleSimilarThumbnails}
                  className="w-full py-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-xs rounded-xl font-semibold transition-colors border border-white/20">
                  🖼️ Similar videos (same niche)
                </button>
                <button onClick={handleGenerateIdea}
                  className="w-full py-2.5 bg-purple-600/90 hover:bg-purple-600 text-white text-xs rounded-xl font-semibold transition-colors">
                  ✨ Search on YouTube
                </button>
              </>
            )}
            {hoverTab === 'channels' && (
              <>
                <button onClick={handleViewChannel}
                  className="w-full py-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-xs rounded-xl font-semibold transition-colors border border-white/20">
                  📺 View channel on YouTube
                </button>
                <button onClick={handleChannelClick}
                  className="w-full py-2.5 bg-green-600/90 hover:bg-green-600 text-white text-xs rounded-xl font-semibold transition-colors">
                  🔍 Find similar channels
                </button>
                <div className="text-center text-white/80 text-[10px] mt-1">
                  <p className="font-semibold">{video.channel.channelName}</p>
                  <p>{fmt(video.channel.subscribers)} subs · {video.channel.niche}</p>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 p-2">
            <button onClick={handleSave}
              className={`p-2 rounded-lg transition-colors ${saved ? 'bg-blue-600 text-white' : 'bg-white/15 hover:bg-white/25 text-white'}`}
              title={saved ? 'Saved' : 'Save'}>
              <svg className="w-3.5 h-3.5" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 3H7a2 2 0 00-2 2v16l7-3 7 3V5a2 2 0 00-2-2z" />
              </svg>
            </button>
            <button onClick={e => { e.preventDefault(); e.stopPropagation();
              window.open(`https://youtube.com/watch?v=${video.videoId}`, '_blank') }}
              className="p-2 bg-white/15 hover:bg-white/25 rounded-lg text-white transition-colors"
              title="Watch video">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Card info */}
      <div className="p-3">
        {/* Title — click to find similar videos */}
        <p
          onClick={() => { const q = extractKeywords(video.title); if(q) onSimilarTitles?.(q) }}
          className="text-xs font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug mb-2 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          title="Click to find similar videos"
        >
          {video.title}
        </p>

        {/* Channel — click to find channels from same niche */}
        <button onClick={handleChannelClick}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity w-full text-left"
          title={video.channel.niche ? `Find ${video.channel.niche} channels` : 'Open on YouTube'}>
          {video.channel.thumbnailUrl && !avatarFailed ? (
            <Image
              src={`/api/image-proxy?url=${encodeURIComponent(video.channel.thumbnailUrl)}`}
              alt=""
              width={20}
              height={20}
              className="w-5 h-5 rounded-full object-cover flex-shrink-0"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-[#333] flex items-center justify-center text-[9px] font-bold text-gray-500 flex-shrink-0">
              {video.channel.channelName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{video.channel.channelName}</span>
        </button>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-600">
            <span>👁 {fmt(video.views)}</span>
            {video.channel.niche && (
              <button
                onClick={() => onSimilarNiche?.(video.channel.niche!)}
                className="bg-gray-100 dark:bg-[#252525] px-1.5 py-0.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title={`Filter by ${video.channel.niche}`}>
                {video.channel.niche}
              </button>
            )}
          </div>
          <span className="text-[10px] text-gray-400 dark:text-gray-600">{timeAgo(video.publishedAt)}</span>
        </div>
      </div>
    </div>
  )
}
