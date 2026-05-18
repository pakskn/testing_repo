'use client'

import { FilterType } from '@/types'

const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all',               label: 'All Channels'        },
  { value: 'outliers',          label: 'Outliers'            },
  { value: 'high_views_low_subs', label: 'High Views, Low Subs' },
  { value: 'above_50k',         label: 'Above 50k Avg. Views' },
  { value: 'new_channels',      label: '🌱 Newest (<1 Year)' },
  { value: 'high_revenue',      label: 'High Monthly Revenue' },
  { value: 'monetized',         label: 'Monetized'           },
]

interface FilterTabsProps {
  active: FilterType
  onChange: (filter: FilterType) => void
}

export default function FilterTabs({ active, onChange }: FilterTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
      {FILTERS.map(f => (
        <button
          key={f.value}
          onClick={() => onChange(f.value)}
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 border shadow-sm ${
            active === f.value
              ? 'bg-gray-900 text-white border-gray-900 shadow-md dark:bg-white dark:text-black dark:border-white'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-900 hover:shadow-md dark:bg-[#1a1a1a] dark:text-gray-400 dark:border-[#2a2a2a] dark:hover:text-white dark:hover:border-[#4a4a4a]'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}
