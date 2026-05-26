'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import VideoCard, { type VideoData } from './VideoCard'
import SearchBar from './SearchBar'
import NicheDropdown from './NicheDropdown'
import VideoFilters, { type VideoFilterValues, DEFAULT_VIDEO_FILTERS } from './VideoFilters'

// Date preset → days back
const DATE_DAYS: Record<string, number> = {
  week: 7, month: 30, '3months': 90, '6months': 180, year: 365, '2years': 730
}

function VideoInfiniteScroll({ loading, onLoadMore }: { loading: boolean; onLoadMore: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const cb = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0].isIntersecting && !loading) onLoadMore()
  }, [loading, onLoadMore])
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(cb, { rootMargin: '300px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [cb])
  return (
    <div ref={ref} className="flex justify-center py-8">
      {loading && (
        <div className="flex items-center gap-2 text-gray-400 dark:text-gray-600 text-sm">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
          Loading more...
        </div>
      )}
    </div>
  )
}

const COL_CLASSES: Record<number, string> = {
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5',
  6: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6',
}

interface Props {
  channelType: string; title: string
  defaultNiches?: string[]; excludeNiches?: string[]
  onlyKids?: boolean; onlyNews?: boolean; includeNews?: boolean
  excludeKids?: boolean; excludeNews?: boolean
  excludeEntertainment?: boolean; includeEntertainment?: boolean
  onlyFaceless?: boolean
  defaultDateFrom?: string  // ISO date string e.g. "2022-05-21" to hide older videos
}

export default function VideoGrid({
  channelType, title,
  defaultNiches = [], excludeNiches = [],
  onlyKids = false, onlyNews = false, includeNews = false,
  excludeKids = false, excludeNews = false,
  excludeEntertainment = false, includeEntertainment = false,
  onlyFaceless = false,
  defaultDateFrom = '',
}: Props) {
  const [videos, setVideos]     = useState<VideoData[]>([])
  const [total, setTotal]       = useState(0)
  const [search, setSearch]     = useState('')
  const [niches, setNiches]     = useState<string[]>(defaultNiches)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [vf, setVf]             = useState<VideoFilterValues>(DEFAULT_VIDEO_FILTERS)

  // Compute active filter count
  const filterCount = [
    vf.language !== 'all',
    vf.outlierMin > 0 || vf.outlierMax < 100,
    vf.viewsMin > 0 || vf.viewsMax < 1_000_000_000,
    vf.subsMin > 0 || vf.subsMax < 50_000_000,
    vf.durationMin > 0 || vf.durationMax < 43200,
    vf.datePreset !== '',
  ].filter(Boolean).length

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (page === 1) setLoading(true); else setLoadingMore(true)
      try {
        // Build date filter — user preset overrides default, default hides old videos
        let dateFrom = defaultDateFrom
        if (vf.datePreset && DATE_DAYS[vf.datePreset]) {
          const d = new Date(); d.setDate(d.getDate() - DATE_DAYS[vf.datePreset])
          dateFrom = d.toISOString().split('T')[0]
        }
        const p = new URLSearchParams({
          channelType, search, page: String(page), limit: '24',
          niches: niches.join(','),
          excludeNiches: excludeNiches.join(','),
          ...(onlyKids             ? { onlyKids:             'true' } : {}),
          ...(onlyNews             ? { onlyNews:             'true' } : {}),
          ...(includeNews          ? { includeNews:          'true' } : {}),
          ...(excludeKids          ? { excludeKids:          'true' } : {}),
          ...(excludeNews          ? { excludeNews:          'true' } : {}),
          ...(excludeEntertainment ? { excludeEntertainment: 'true' } : {}),
          ...(includeEntertainment ? { includeEntertainment: 'true' } : {}),
          ...(onlyFaceless         ? { onlyFaceless:         'true' } : {}),
          ...(dateFrom             ? { dateFrom }                    : {}),
          outlierMin: String(vf.outlierMin), outlierMax: String(vf.outlierMax),
          viewsMin: String(vf.viewsMin), viewsMax: String(vf.viewsMax),
          subsMin: String(vf.subsMin), subsMax: String(vf.subsMax),
          ...(vf.durationMin > 0 ? { durationMin: String(vf.durationMin) } : {}),
          ...(vf.durationMax < 43200 ? { durationMax: String(vf.durationMax) } : {}),
          ...(dateFrom ? { dateFrom } : {}),
          ...(vf.language !== 'all' ? { language: vf.language } : {}),
        })
        const r = await fetch(`/api/videos?${p}`)
        const d = await r.json()
        if (!cancelled) {
          if (page === 1) setVideos(d.videos || [])
          else setVideos(prev => [...prev, ...(d.videos || [])])
          setTotal(d.total || 0)
        }
      } finally {
        if (!cancelled) { setLoading(false); setLoadingMore(false) }
      }
    }
    load()
    return () => { cancelled = true }
  }, [channelType, search, niches, page, vf])

  const applyFilters = (f: VideoFilterValues) => { setVf(f); setPage(1); setVideos([]) }

  return (
    <div className="p-5 max-w-[1400px]">

      {/* Top bar: Search + Niche + Filters + Save */}
      <div className="flex gap-2 mb-4 items-center">
        <div className="flex-1">
          <SearchBar value={search} onChange={s => { setSearch(s); setPage(1); setVideos([]) }}
            placeholder="Search videos by title, channel name or niche..." />
        </div>
        <NicheDropdown selected={niches} onChange={n => { setNiches(n); setPage(1); setVideos([]) }} />

        {/* Filters button */}
        <button onClick={() => setShowFilters(true)}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all flex-shrink-0 ${
            filterCount > 0
              ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-black dark:border-white'
              : 'bg-white dark:bg-[#1a1a1a] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-[#2a2a2a] hover:border-gray-400'
          }`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          Filters
          {filterCount > 0 && (
            <span className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {filterCount}
            </span>
          )}
        </button>
      </div>

      {/* Active filter pills */}
      {(vf.language !== 'all' || vf.datePreset || filterCount > 0) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {vf.language !== 'all' && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-medium capitalize">
              🌐 {vf.language}
              <button onClick={() => applyFilters({ ...vf, language: 'all' })} className="hover:text-blue-900 dark:hover:text-blue-200">✕</button>
            </span>
          )}
          {vf.datePreset && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-xs font-medium">
              📅 {vf.datePreset}
              <button onClick={() => applyFilters({ ...vf, datePreset: '' })} className="hover:text-purple-900">✕</button>
            </span>
          )}
          <button onClick={() => { applyFilters(DEFAULT_VIDEO_FILTERS); setSearch(''); setNiches([]) }}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 underline">
            Clear all
          </button>
        </div>
      )}

      {/* Results count + columns */}
      <div className="flex items-center justify-between mb-5">
        <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
          {loading ? 'Loading...' : `${(videos?.length ?? 0).toLocaleString()} of ${(total ?? 0).toLocaleString()} videos`}
        </span>
        {/* Column quick select */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400 mr-1">Columns:</span>
          {[4,5,6].map(n => (
            <button key={n} onClick={() => setVf(prev => ({ ...prev, columns: n as any }))}
              className={`w-7 h-7 rounded text-xs font-bold transition-all ${
                vf.columns === n
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-black'
                  : 'bg-gray-100 dark:bg-[#252525] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#333]'
              }`}
            >{n}</button>
          ))}
        </div>
      </div>

      {/* Video grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64 gap-3 text-gray-400">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          <span className="text-sm">Loading videos...</span>
        </div>
      ) : videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-2 text-gray-400">
          <span className="text-4xl">🎬</span>
          <p className="text-sm font-medium">No videos found</p>
          <button onClick={() => { applyFilters(DEFAULT_VIDEO_FILTERS); setSearch(''); setNiches([]) }}
            className="text-xs text-blue-500 hover:text-blue-600 underline">Clear all filters</button>
        </div>
      ) : (
        <>
          <div className={`grid gap-3 ${COL_CLASSES[vf.columns] || COL_CLASSES[4]}`}>
            {videos.map(v => (
              <VideoCard
                key={v.videoId}
                video={v}
                onSimilarTitles={(q) => { setSearch(q); setPage(1); setVideos([]); window.scrollTo({top:0,behavior:'smooth'}) }}
                onSimilarNiche={(niche) => { setNiches([niche]); setSearch(''); setPage(1); setVideos([]); window.scrollTo({top:0,behavior:'smooth'}) }}
              />
            ))}
          </div>
          {videos.length < total && (
            <VideoInfiniteScroll loading={loadingMore} onLoadMore={() => setPage(p => p + 1)} />
          )}
        </>
      )}

      {/* VideoFilters panel */}
      {showFilters && (
        <VideoFilters initial={vf} onApply={applyFilters} onClose={() => setShowFilters(false)} />
      )}
    </div>
  )
}
