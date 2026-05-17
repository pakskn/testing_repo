'use client'

import { useState, useRef, useEffect } from 'react'

const NICHES = [
  'Sports', 'History', 'Crime', 'Finance', 'Technology',
  'Gaming', 'Education', 'Science', 'Travel', 'Motivation',
  'Psychology', 'Business', 'Cooking', 'Health', 'Fitness',
  'Nature', 'Wildlife', 'DIY', 'Productivity', 'Self Improvement',
  'True Crime', 'Space', 'Conspiracy',
]

interface NicheDropdownProps {
  selected: string[]           // multi-select array
  onChange: (niches: string[]) => void
}

export default function NicheDropdown({ selected, onChange }: NicheDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const toggle = (niche: string) => {
    onChange(
      selected.includes(niche)
        ? selected.filter(n => n !== niche)
        : [...selected, niche]
    )
  }

  const label = selected.length === 0
    ? 'Category'
    : selected.length === 1
    ? selected[0]
    : `${selected.length} Categories`

  const isActive = selected.length > 0

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all border ${
          isActive
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 dark:bg-[#1a1a1a] dark:text-gray-400 dark:border-[#2a2a2a] dark:hover:border-[#3a3a3a]'
        }`}
      >
        🏷️ {label}
        {isActive && (
          <span
            onClick={e => { e.stopPropagation(); onChange([]) }}
            className="ml-1 text-white/70 hover:text-white text-xs"
          >
            ✕
          </span>
        )}
        {!isActive && <span className="text-xs opacity-60">{open ? '▲' : '▼'}</span>}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 z-50 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-[#2a2a2a] rounded-xl shadow-xl p-3 w-64">
          {/* All Categories */}
          <button
            onClick={() => onChange([])}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors mb-1 ${
              selected.length === 0
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#252525]'
            }`}
          >
            ✓ All Categories
          </button>
          <div className="border-t border-gray-100 dark:border-[#2a2a2a] my-1" />
          {/* Individual niches */}
          <div className="max-h-56 overflow-y-auto scrollbar-hide space-y-0.5">
            {NICHES.map(niche => {
              const active = selected.includes(niche)
              return (
                <button
                  key={niche}
                  onClick={() => toggle(niche)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                    active
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#252525]'
                  }`}
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                    active
                      ? 'bg-blue-600 border-blue-600 text-white text-[10px]'
                      : 'border-gray-300 dark:border-[#444]'
                  }`}>
                    {active && '✓'}
                  </span>
                  {niche}
                </button>
              )
            })}
          </div>
          {selected.length > 0 && (
            <>
              <div className="border-t border-gray-100 dark:border-[#2a2a2a] mt-2 pt-2">
                <p className="text-[11px] text-gray-400 text-center">
                  {selected.length} {selected.length === 1 ? 'category' : 'categories'} selected
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
