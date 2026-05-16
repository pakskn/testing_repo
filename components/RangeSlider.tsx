'use client'

import { useState, useEffect } from 'react'

function fmt(n: number, type: 'number' | 'currency' | 'score' | 'seconds'): string {
  if (type === 'currency') return `$${n >= 1_000_000 ? (n/1_000_000).toFixed(1)+'M' : n >= 1_000 ? (n/1_000).toFixed(0)+'K' : n}`
  if (type === 'score')    return `${n}x`
  if (type === 'seconds')  return n === 0 ? '0s' : n >= 3600 ? `${(n/3600).toFixed(0)}h` : `${(n/60).toFixed(0)}m`
  return n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(0)}K` : `${n}`
}

interface Props {
  label: string
  min: number
  max: number
  minVal: number
  maxVal: number
  step?: number
  format?: 'number' | 'currency' | 'score' | 'seconds'
  onChange: (min: number, max: number) => void
}

export default function RangeSlider({ label, min, max, minVal, maxVal, step = 1, format = 'number', onChange }: Props) {
  const [localMin, setLocalMin] = useState(minVal)
  const [localMax, setLocalMax] = useState(maxVal)

  useEffect(() => { setLocalMin(minVal) }, [minVal])
  useEffect(() => { setLocalMax(maxVal) }, [maxVal])

  const pctMin = ((localMin - min) / (max - min)) * 100
  const pctMax = ((localMax - min) / (max - min)) * 100

  const commitMin = (v: number) => {
    const val = Math.min(v, localMax - step)
    setLocalMin(val)
    onChange(val, localMax)
  }
  const commitMax = (v: number) => {
    const val = Math.max(v, localMin + step)
    setLocalMax(val)
    onChange(localMin, val)
  }

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{label}</p>
      <div className="relative h-5">
        {/* Track */}
        <div className="absolute top-[9px] left-0 right-0 h-[3px] bg-gray-200 dark:bg-[#333] rounded-full" />
        {/* Fill */}
        <div
          className="absolute top-[9px] h-[3px] bg-blue-600 rounded-full"
          style={{ left: `${pctMin}%`, right: `${100 - pctMax}%` }}
        />
        {/* Min thumb */}
        <input
          type="range" min={min} max={max} step={step} value={localMin}
          onChange={e => { setLocalMin(+e.target.value) }}
          onMouseUp={e => commitMin(+(e.target as HTMLInputElement).value)}
          onTouchEnd={e => commitMin(+(e.target as HTMLInputElement).value)}
          className="dual-thumb"
          style={{ zIndex: localMin >= max - step ? 5 : 3 }}
        />
        {/* Max thumb */}
        <input
          type="range" min={min} max={max} step={step} value={localMax}
          onChange={e => { setLocalMax(+e.target.value) }}
          onMouseUp={e => commitMax(+(e.target as HTMLInputElement).value)}
          onTouchEnd={e => commitMax(+(e.target as HTMLInputElement).value)}
          className="dual-thumb"
          style={{ zIndex: 4 }}
        />
      </div>
      <div className="flex gap-2 mt-3">
        <div className="flex-1 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-[#2a2a2a] rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 text-center">
          {fmt(localMin, format)}
        </div>
        <div className="flex-1 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-[#2a2a2a] rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 text-center">
          {fmt(localMax, format)}
        </div>
      </div>
    </div>
  )
}
