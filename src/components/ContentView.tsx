'use client'

import { useState } from 'react'
import ChannelsView from './ChannelsView'
import VideoGrid from './VideoGrid'

interface Props {
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
  defaultDateFrom?: string
}

export default function ContentView({
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
  defaultDateFrom = '',
}: Props) {
  const [tab, setTab] = useState<'channels' | 'videos'>('channels')

  return (
    <div className="flex flex-col min-h-full">
      {/* ── Tab Switcher ── */}
      <div className="sticky top-12 z-20 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-gray-100 dark:border-[#1e1e1e] px-5 pt-3 pb-0">
        <div className="flex gap-1 max-w-[1400px]">
          <button
            onClick={() => setTab('channels')}
            className={`relative flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-colors rounded-t-lg ${
              tab === 'channels'
                ? 'text-gray-900 dark:text-white bg-white dark:bg-[#1a1a1a] border border-b-0 border-gray-100 dark:border-[#2a2a2a]'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Channels
            {tab === 'channels' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
          </button>

          <button
            onClick={() => setTab('videos')}
            className={`relative flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-colors rounded-t-lg ${
              tab === 'videos'
                ? 'text-gray-900 dark:text-white bg-white dark:bg-[#1a1a1a] border border-b-0 border-gray-100 dark:border-[#2a2a2a]'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Videos
            {tab === 'videos' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
          </button>
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="flex-1 bg-gray-50 dark:bg-[#0a0a0a]">
        {tab === 'channels' ? (
          <ChannelsView channelType={channelType} title={title}
            defaultNiches={defaultNiches} excludeNiches={excludeNiches}
            onlyKids={onlyKids} onlyNews={onlyNews} includeNews={includeNews}
            excludeKids={excludeKids} excludeNews={excludeNews}
            excludeEntertainment={excludeEntertainment}
            includeEntertainment={includeEntertainment}
            onlyFaceless={onlyFaceless}
            hideInactive={hideInactive}
            onlyInactive={onlyInactive}
            onlyNano={onlyNano}
            onlyStandard={onlyStandard}
            onlySuper={onlySuper}
            onTabChange={setTab} />
        ) : (
          <VideoGrid channelType={channelType} title={title}
            defaultNiches={defaultNiches} excludeNiches={excludeNiches}
            onlyKids={onlyKids} onlyNews={onlyNews} includeNews={includeNews}
            excludeKids={excludeKids} excludeNews={excludeNews}
            excludeEntertainment={excludeEntertainment}
            includeEntertainment={includeEntertainment}
            onlyFaceless={onlyFaceless}
            defaultDateFrom={defaultDateFrom} />
        )}
      </div>
    </div>
  )
}
