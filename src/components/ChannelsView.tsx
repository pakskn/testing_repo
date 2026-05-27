'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import SortOptions from './SortOptions'
import SearchBar from './SearchBar'
import ChannelCard from './ChannelCard'
import NicheDropdown from './NicheDropdown'
import AdvancedFilters, { FilterValues, DEFAULT_FILTERS } from './AdvancedFilters'
import { Channel, ChannelsResponse, SortType, OrderType } from '@/types'
import { type SimilarRequest } from './ChannelCard'

const fmtN = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(0)}K` : String(n)

function InfiniteScrollSentinel({ loading, onLoadMore }: { loading: boolean; onLoadMore: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const cb = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0].isIntersecting && !loading) onLoadMore()
  }, [loading, onLoadMore])

  useEffect(() => {
    const el = ref.current
    if (!el) return
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

interface ChannelsViewProps {
  channelType: string
  title: string
  defaultNiches?: string[]
  excludeNiches?: string[]
  onlyKids?: boolean
  onlyNews?: boolean
  includeNews?: boolean
  excludeKids?: boolean
  excludeNews?: boolean
  excludeEntertainment?: boolean
  includeEntertainment?: boolean
  onlyFaceless?: boolean
  hideInactive?: boolean
  onlyInactive?: boolean
  onlyNano?: boolean
  onlyStandard?: boolean
  onlySuper?: boolean
  onTabChange?: (tab: 'channels' | 'videos') => void
}

export default function ChannelsView({
  channelType, title,
  defaultNiches = [], excludeNiches = [],
  onlyKids = false, onlyNews = false, includeNews = false,
  excludeKids = false, excludeNews = false,
  excludeEntertainment = false, includeEntertainment = false,
  onlyFaceless = false,
  hideInactive = false,
  onlyInactive = false,
  onlyNano = false,
  onlyStandard = false,
  onlySuper = false,
  onTabChange,
}: ChannelsViewProps) {
  const [sort, setSort]       = useState<SortType>('created_at')
  const [order, setOrder]     = useState<OrderType>('desc')
  const [randomSeed, setRandomSeed] = useState(() => Math.floor(Math.random() * 9999))
  const [search, setSearch]   = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [advFilters, setAdvFilters]   = useState<FilterValues>({
    ...DEFAULT_FILTERS,
    selectedNiches: defaultNiches,
  })
  const [similarTo, setSimilarTo]     = useState<string | null>(null)
  const [similarType, setSimilarType] = useState<string>('')
  const [daysRange, setDaysRange]     = useState<{ min: number; max: number } | null>(null)
  const [titleKw, setTitleKw]         = useState('')

  // Read ?q= param from URL on mount (set when user clicks channel niche in VideoCard)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q')
    if (q) {
      setSearch(q)
      // Clean URL without reload
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // Count active advanced filters for badge
  const advActiveCount = [
    advFilters.monetization !== 'all',
    advFilters.faceless !== 'all',
    advFilters.aiChannel !== 'all',
    advFilters.kidsContent !== 'all',
    advFilters.shortsOnly !== 'all',
    advFilters.selectedNiches.length > 0,
    advFilters.subsMin > 0 || advFilters.subsMax < 100_000_000,
    advFilters.avgViewsMin > 0 || advFilters.avgViewsMax < 100_000_000,
    advFilters.totalViewsMin > 0 || advFilters.totalViewsMax < 900_000_000_000,
    advFilters.monthlyViewsMin > 0 || advFilters.monthlyViewsMax < 900_000_000,
    advFilters.avgVideoLengthMin > 0 || advFilters.avgVideoLengthMax < 43200,
    advFilters.outlierMin > 0 || advFilters.outlierMax < 100,
    advFilters.totalVideosMin > 0 || advFilters.totalVideosMax < 100_000,
  ].filter(Boolean).length

  // React Query Infinite scroll fetching hook
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery<ChannelsResponse>({
    queryKey: ['channels', {
      channelType,
      sort,
      order,
      search,
      advFilters,
      daysRange,
      titleKw,
      randomSeed,
      excludeNiches,
      onlyKids,
      onlyNews,
      includeNews,
      excludeKids,
      excludeNews,
      excludeEntertainment,
      includeEntertainment,
      onlyFaceless,
      hideInactive,
      onlyInactive,
      onlyNano,
      onlyStandard,
      onlySuper
    }],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({
        type: channelType,
        filter: 'all',
        sort,
        order,
        search,
        page: String(pageParam),
        ...(sort === 'random' ? { randomSeed: randomSeed.toString() } : {}),
        limit: '20',
        niches:           advFilters.selectedNiches.join(','),
        excludeNiches:    excludeNiches.join(','),
        ...(onlyKids             ? { onlyKids:             'true' } : {}),
        ...(onlyNews             ? { onlyNews:             'true' } : {}),
        ...(includeNews          ? { includeNews:          'true' } : {}),
        ...(excludeKids          ? { excludeKids:          'true' } : {}),
        ...(excludeNews          ? { excludeNews:          'true' } : {}),
        ...(excludeEntertainment ? { excludeEntertainment: 'true' } : {}),
        ...(includeEntertainment ? { includeEntertainment: 'true' } : {}),
        ...(onlyFaceless         ? { onlyFaceless:         'true' } : {}),
        ...(hideInactive         ? { hideInactive:         'true' } : {}),
        ...(onlyInactive         ? { onlyInactive:         'true' } : {}),
        ...(onlyNano             ? { onlyNano:             'true' } : {}),
        ...(onlyStandard         ? { onlyStandard:         'true' } : {}),
        ...(onlySuper            ? { onlySuper:            'true' } : {}),
        monetization:     advFilters.monetization,
        aiChannel:        advFilters.aiChannel,
        kidsContent:      advFilters.kidsContent,
        shortsOnly:       advFilters.shortsOnly,
        subsMin:          String(advFilters.subsMin),
        subsMax:          String(advFilters.subsMax),
        avgViewsMin:      String(advFilters.avgViewsMin),
        avgViewsMax:      String(advFilters.avgViewsMax),
        totalViewsMin:    String(advFilters.totalViewsMin),
        totalViewsMax:    String(advFilters.totalViewsMax),
        outlierMin:       String(advFilters.outlierMin),
        outlierMax:       String(advFilters.outlierMax),
        totalVideosMin:   String(advFilters.totalVideosMin),
        totalVideosMax:   String(advFilters.totalVideosMax),
        ...(advFilters.dateFrom ? { dateFrom: advFilters.dateFrom } : {}),
        ...(advFilters.dateTo   ? { dateTo:   advFilters.dateTo   } : {}),
        ...(daysRange ? { daysMin: String(daysRange.min), daysMax: String(daysRange.max) } : {}),
        ...(titleKw   ? { titleKeyword: titleKw } : {}),
      })
      const res = await fetch(`/api/channels?${params}`)
      if (!res.ok) throw new Error('Fetch channels failed')
      return res.json()
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((acc, p) => acc + (p.channels?.length ?? 0), 0)
      if (currentCount < lastPage.total) {
        return allPages.length + 1
      }
      return undefined
    },
    staleTime: 60 * 1000,
  })

  const channels = data ? data.pages.flatMap(p => p.channels || []) : []
  const total = data?.pages[0]?.total ?? 0

  const reset = (updates: { sort?: SortType; order?: OrderType; search?: string }) => {
    if (updates.sort   !== undefined) {
      setSort(updates.sort)
      if (updates.sort === 'random') setRandomSeed(Math.floor(Math.random() * 999999))
    }
    if (updates.order  !== undefined) setOrder(updates.order)
    if (updates.search !== undefined) setSearch(updates.search)
  }

  const handleApplyFilters = (f: FilterValues) => {
    if (f.contentMode === 'videos' && onTabChange) {
      onTabChange('videos')
      return
    }
    setAdvFilters(f)
  }

  // Similar Channels — multi-type handler
  const handleFindSimilar = (req: SimilarRequest) => {
    setSimilarTo(req.channelName)
    setSimilarType(req.type)
    // Reset all similarity state first
    setDaysRange(null)
    setTitleKw('')
    setAdvFilters(DEFAULT_FILTERS)
    setSearch('')

    switch (req.type) {
      case 'niche':
        setAdvFilters({ ...DEFAULT_FILTERS, selectedNiches: req.niches ?? [] })
        break
      case 'related_niches':
        setAdvFilters({ ...DEFAULT_FILTERS, selectedNiches: req.niches ?? [] })
        break
      case 'title':
        setTitleKw(req.keyword ?? '')
        break
      case 'same_age':
        setDaysRange({ min: req.daysMin ?? 0, max: req.daysMax ?? 999999 })
        break
      case 'similar_size':
        setAdvFilters({ ...DEFAULT_FILTERS, subsMin: req.subsMin ?? 0, subsMax: req.subsMax ?? 999999999 })
        break
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const clearSimilar = () => {
    setSimilarTo(null)
    setSimilarType('')
    setDaysRange(null)
    setTitleKw('')
    setAdvFilters(DEFAULT_FILTERS)
  }

  // Human-readable similar type label
  const similarTypeLabel: Record<string, string> = {
    niche:          '🏷️ Same Niche',
    related_niches: '🔗 Related Niches',
    title:          '📝 Similar Titles',
    same_age:       '📅 Started Same Time',
    similar_size:   '👤 Similar Size',
  }

  const isFiltered = advActiveCount > 0 || search !== '' || !!daysRange || !!titleKw
  const nicheLabel = (advFilters?.selectedNiches?.length ?? 0) > 0
    ? ` in ${advFilters.selectedNiches.length === 1 ? advFilters.selectedNiches[0] : `${advFilters.selectedNiches.length} categories`}`
    : ''

  return (
    <div className="p-5 max-w-[1400px]">
      {/* Title */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-0.5">
          Discover high-performing YouTube channels in this category
        </p>
      </div>

      {/* Search + Filters button in same row */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1">
          <SearchBar
            value={search}
            onChange={s => setSearch(s)}
            placeholder="Search by channel name, handle or keyword..."
          />
        </div>
        {/* Category dropdown — same row as search & filters */}
        <NicheDropdown
          selected={advFilters.selectedNiches}
          onChange={n => { handleApplyFilters({ ...advFilters, selectedNiches: n }) }}
        />
        {/* Filters button */}
        <button
          onClick={() => setShowFilters(true)}
          title="Advanced Filters"
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all flex-shrink-0 ${
            advActiveCount > 0
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white dark:bg-[#1a1a1a] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-[#2a2a2a] hover:border-gray-300 dark:hover:border-[#3a3a3a]'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          <span className="hidden sm:inline">Filters</span>
          {advActiveCount > 0 && (
            <span className="bg-white text-blue-600 text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
              {advActiveCount}
            </span>
          )}
        </button>
      </div>

      {/* Sort row */}
      <div className="mb-4">
        <SortOptions sort={sort} order={order} onSortChange={(s, o) => reset({ sort: s, order: o })} />
      </div>

      {/* Similar Channels Banner */}
      {similarTo && (
        <div className="flex items-center gap-3 mb-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">
                {similarTypeLabel[similarType] || '🔍 Similar'}
              </span>
              <span className="text-sm text-blue-700 dark:text-blue-300">
                Similar to <strong>{similarTo}</strong>
              </span>
            </div>
            <p className="text-[11px] text-blue-500 dark:text-blue-400 mt-0.5">
              {similarType === 'niche' && `Showing channels in "${advFilters.selectedNiches[0]}" niche`}
              {similarType === 'related_niches' && `Showing ${advFilters.selectedNiches.length} related niches`}
              {similarType === 'title' && `Searching for keyword: "${titleKw}"`}
              {similarType === 'same_age' && `Channels from ${daysRange?.min} to ${daysRange?.max} days old`}
              {similarType === 'similar_size' && `Channels with ${fmtN(advFilters.subsMin)}–${fmtN(advFilters.subsMax)} subscribers`}
            </p>
          </div>
          <button onClick={clearSimilar} className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-200 font-medium flex-shrink-0 transition-colors">
            ✕ Clear
          </button>
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center gap-3 mb-5 text-sm">
        <span className="text-gray-700 dark:text-gray-300 font-medium">
          Showing {(channels?.length ?? 0).toLocaleString()} of {(total ?? 0).toLocaleString()} Results
          {advFilters.selectedNiches.length > 0 && !similarTo && (
            <span className="ml-1 text-gray-400 dark:text-gray-500">
              in {advFilters.selectedNiches.length === 1 ? advFilters.selectedNiches[0] : `${advFilters.selectedNiches.length} categories`}
            </span>
          )}
        </span>
        {isFiltered && (
          <button
            onClick={() => { reset({ search: '' }); setAdvFilters(DEFAULT_FILTERS); setSimilarTo(null); }}
            className="text-xs text-blue-500 hover:text-blue-600 underline transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
          <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-gray-600 dark:border-t-white rounded-full animate-spin" />
          <span className="text-sm">Loading channels...</span>
        </div>
      ) : (channels?.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center justify-center h-72 gap-3 text-gray-400">
          <span className="text-5xl">📭</span>
          {!isFiltered ? (
            <>
              <p className="text-base font-medium text-gray-500 dark:text-gray-400">No channels yet</p>
              <p className="text-sm text-gray-400 text-center max-w-xs">Run the collector to add data.</p>
              <code className="text-xs bg-gray-100 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] text-gray-600 dark:text-gray-400 px-3 py-2 rounded-lg font-mono">
                python -X utf8 collector_local.py
              </code>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No channels match your filters</p>
              <button
                onClick={() => { reset({ search: '' }); setAdvFilters(DEFAULT_FILTERS); setSimilarTo(null); }}
                className="text-xs text-blue-500 hover:text-blue-600 underline transition-colors"
              >
                Clear all filters
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {channels.map(ch => (
              <ChannelCard
                key={ch.channelId}
                channel={ch}
                onFindSimilar={handleFindSimilar}
              />
            ))}
          </div>
          {/* Infinite scroll sentinel — auto loads when visible */}
          {hasNextPage && (
            <InfiniteScrollSentinel loading={isFetchingNextPage} onLoadMore={fetchNextPage} />
          )}
        </>
      )}

      {/* Advanced Filters Panel */}
      {showFilters && (
        <AdvancedFilters
          initial={advFilters}
          onApply={handleApplyFilters}
          onClose={() => setShowFilters(false)}
        />
      )}
    </div>
  )
}
