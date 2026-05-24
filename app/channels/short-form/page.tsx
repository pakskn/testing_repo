'use client'

import { useState } from 'react'
import ContentView from '@/components/ContentView'

type ShortTab = 'all' | 'nano' | 'standard' | 'super'

const TABS: { id: ShortTab; label: string; icon: string; desc: string }[] = [
  { id: 'all',      label: 'All Shorts',   icon: '▶️',  desc: 'All short-form channels'  },
  { id: 'nano',     label: 'Nano',         icon: '⚡',  desc: 'Max 12 seconds'            },
  { id: 'standard', label: 'Standard',     icon: '📱',  desc: '13 – 59 seconds'           },
  { id: 'super',    label: 'Super',        icon: '🔥',  desc: '1:00 – 3:00 minutes'       },
]

export default function Page() {
  const [tab, setTab] = useState<ShortTab>('all')

  return (
    <div className="flex flex-col min-h-full">
      {/* ── Duration Filter Tabs ── */}
      <div className="sticky top-12 z-20 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-gray-100 dark:border-[#1e1e1e] px-5 pt-3 pb-0">
        <div className="flex gap-1 max-w-[1400px] overflow-x-auto scrollbar-hide">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-colors rounded-t-lg whitespace-nowrap ${
                tab === t.id
                  ? 'text-gray-900 dark:text-white bg-white dark:bg-[#1a1a1a] border border-b-0 border-gray-100 dark:border-[#2a2a2a]'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
              <span className="text-[10px] font-normal opacity-60">({t.desc})</span>
              {tab === t.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1">
        <ContentView
          key={tab}
          channelType="short_form"
          title={`Short Form — ${TABS.find(t => t.id === tab)?.label}`}
          onlyNano={tab === 'nano'}
          onlyStandard={tab === 'standard'}
          onlySuper={tab === 'super'}
        />
      </div>
    </div>
  )
}
