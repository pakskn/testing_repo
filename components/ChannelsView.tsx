'use client'

import { useState, useEffect } from 'react'
import SortOptions from './SortOptions'
import SearchBar from './SearchBar'
import ChannelCard from './ChannelCard'
import NicheDropdown from './NicheDropdown'
import AdvancedFilters, { FilterValues, DEFAULT_FILTERS } from './AdvancedFilters'
import { Channel, ChannelsResponse, SortType, OrderType } from '@/types'

interface ChannelsViewProps {
  channelType: string
  title: string
}

export default function ChannelsView({ channelType, title }: ChannelsViewProps) {
  const [sort, setSort]       = useState<SortType>('created_at')
  const [order, setOrder]     = useState<OrderType>('desc')
  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)
  const [channels, setChannels] = useState<Channel[]>([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [advFilters, setAdvFilters]   = useState<FilterValues>(DEFAULT_FILTERS)

  // Count active advanced filters for badge
  const advActiveCount = [
    advFilters.monetization !== 'all',
    advFilters.faceless !== 'all',
    advFilters.selectedNiches.length > 0,
    advFilters.subsMin > 0 || advFilters.subsMax < 50_000_000,
    advFilters.avgViewsMin > 0 || advFilters.avgViewsMax < 10_000_000,
    advFilters.outlierMin > 0 || advFilters.outlierMax < 100,
    advFilters.totalVideosMin > 0 || advFilters.totalVideosMax < 10_000,
  ].filter(Boolean).length

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (page === 1) setLoading(true)
      else setLoadingMore(true)

      try {
        const params = new URLSearchParams({
          type: channelType,
          filter: 'all',
          sort,
          order,
          search,
          page: page.toString(),
          limit: '20',
          // Advanced filter params
          niches:          advFilters.selectedNiches.join(','),
          monetization:    advFilters.monetization,
          subsMin:         String(advFilters.subsMin),
          subsMax:         String(advFilters.subsMax),
          avgViewsMin:     String(advFilters.avgViewsMin),
          avgViewsMax:     String(advFilters.avgViewsMax),
          outlierMin:      String(advFilters.outlierMin),
          outlierMax:      String(advFilters.outlierMax),
          totalVideosMin:  String(advFilters.totalVideosMin),
          totalVideosMax:  String(advFilters.totalVideosMax),
        })
        const res  = await fetch(`/api/channels?${params}`)
        const json: ChannelsResponse = await res.json()

        if (!cancelled) {
          if (page === 1) setChannels(json.channels)
          else setChannels(prev => [...prev, ...json.channels])
          setTotal(json.total)
        }
      } catch (err) {
        console.error('Fetch error:', err)
      } finally {
        if (!cancelled) { setLoading(false); setLoadingMore(false) }
      }
    }

    load()
    return () => { cancelled = true }
  }, [channelType, sort, order, search, page, advFilters])

  const reset = (updates: { sort?: SortType; order?: OrderType; search?: string }) => {
    if (updates.sort   !== undefined) setSort(updates.sort)
    if (updates.order  !== undefined) setOrder(updates.order)
    if (updates.search !== undefined) setSearch(updates.search)
    setPage(1)
  }

  const handleApplyFilters = (f: FilterValues) => {
    setAdvFilters(f)
    setPage(1)
  }

  const hasMore = channels.length < total
  const isFiltered = advActiveCount > 0 || search !== ''
  const nicheLabel = advFilters.selectedNiches.length > 0
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
            onChange={s => { setSearch(s); setPage(1) }}
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

      {/* Results count */}
      <div className="flex items-center gap-3 mb-5 text-sm">
        <span className="text-gray-700 dark:text-gray-300 font-medium">
          Showing {channels.length.toLocaleString()} of {total.toLocaleString()} Results
          {advFilters.selectedNiches.length > 0 && (
            <span className="ml-1 text-gray-400 dark:text-gray-500">
              in {advFilters.selectedNiches.length === 1 ? advFilters.selectedNiches[0] : `${advFilters.selectedNiches.length} categories`}
            </span>
          )}
        </span>
        {isFiltered && (
          <button
            onClick={() => { reset({ search: '' }); setAdvFilters(DEFAULT_FILTERS); setPage(1) }}
            className="text-xs text-blue-500 hover:text-blue-600 underline transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
          <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-gray-600 dark:border-t-white rounded-full animate-spin" />
          <span className="text-sm">Loading channels...</span>
        </div>
      ) : channels.length === 0 ? (
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
                onClick={() => { reset({ filter: 'all', search: '' }); setAdvFilters(DEFAULT_FILTERS); setPage(1) }}
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
            {channels.map(ch => <ChannelCard key={ch.channelId} channel={ch} />)}
          </div>
          {hasMore && (
            <div className="flex justify-center mt-8">
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={loadingMore}
                className="flex items-center gap-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] text-gray-700 dark:text-white px-8 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-[#252525] hover:border-gray-300 dark:hover:border-[#3a3a3a] transition-all disabled:opacity-50 text-sm font-medium shadow-sm dark:shadow-none"
              >
                {loadingMore && <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />}
                {loadingMore ? 'Loading...' : `Load More (${total - channels.length} remaining)`}
              </button>
            </div>
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
