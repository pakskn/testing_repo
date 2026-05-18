'use client'

import { SortType, OrderType } from '@/types'

const SORTS: { value: SortType; label: string }[] = [
  { value: 'created_at',       label: 'Recently Added'       },
  { value: 'subscribers',      label: 'Subscribers'          },
  { value: 'avg_views',        label: 'Avg. Views Per Video' },
  { value: 'days_since_start', label: 'Days Since Start'     },
  { value: 'total_videos',     label: 'Total Videos'         },
  { value: 'total_revenue',    label: 'Total Revenue'        },
]

interface SortOptionsProps {
  sort: SortType
  order: OrderType
  onSortChange: (sort: SortType, order: OrderType) => void
}

export default function SortOptions({ sort, order, onSortChange }: SortOptionsProps) {
  const handleClick = (value: SortType) => {
    if (sort === value) {
      onSortChange(value, order === 'desc' ? 'asc' : 'desc')
    } else {
      onSortChange(value, 'desc')
    }
  }

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {SORTS.map(s => {
        const isActive = sort === s.value
        const arrow = isActive ? (order === 'desc' ? '↓' : '↑') : '↕'
        return (
          <button
            key={s.value}
            onClick={() => handleClick(s.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all ${
              isActive
                ? 'bg-gray-900 text-white border-gray-900 font-medium dark:bg-white dark:text-black dark:border-white'
                : 'bg-white text-gray-500 border-gray-200 hover:text-gray-900 hover:border-gray-300 dark:bg-transparent dark:text-gray-400 dark:border-[#2a2a2a] dark:hover:text-white dark:hover:border-[#3a3a3a]'
            }`}
          >
            <span className="font-mono text-xs">{arrow}</span>
            {s.label}
          </button>
        )
      })}
    </div>
  )
}
