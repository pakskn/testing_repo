'use client'

import { useState } from 'react'

export interface VideoFilterValues {
  videoType:     'long' | 'short' | 'all'
  columns:       4 | 5 | 6
  outlierMin:    number
  outlierMax:    number
  viewsMin:      number
  viewsMax:      number
  subsMin:       number
  subsMax:       number
  durationMin:   number   // seconds
  durationMax:   number
  datePreset:    string   // '' | 'week' | 'month' | '3months' | '6months' | 'year' | '2years'
}

export const DEFAULT_VIDEO_FILTERS: VideoFilterValues = {
  videoType: 'all', columns: 4,
  outlierMin: 0, outlierMax: 100,
  viewsMin: 0, viewsMax: 1_000_000_000,
  subsMin: 0, subsMax: 50_000_000,
  durationMin: 0, durationMax: 43200,
  datePreset: '',
}

const DATE_PRESETS = [
  { value: '',         label: 'All time'      },
  { value: 'week',     label: 'Last week'     },
  { value: 'month',    label: 'Last month'    },
  { value: '3months',  label: 'Last 3 months' },
  { value: '6months',  label: 'Last 6 months' },
  { value: 'year',     label: 'Last year'     },
  { value: '2years',   label: 'Last 2 years'  },
]

function fmtN(n: number) {
  if (n >= 1_000_000_000) return `${(n/1_000_000_000).toFixed(0)}B`
  if (n >= 1_000_000)     return `${(n/1_000_000).toFixed(0)}M`
  if (n >= 1_000)         return `${(n/1_000).toFixed(0)}K`
  return n.toString()
}

function fmtDur(s: number) {
  if (s === 0) return '0:00'
  const h = Math.floor(s/3600); const m = Math.floor((s%3600)/60); const sec = s%60
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`
}

function MiniSlider({ label, min, max, minVal, maxVal, onChange, fmt }:{
  label: string; min: number; max: number; minVal: number; maxVal: number
  onChange: (mn: number, mx: number) => void; fmt?: (n: number) => string
}) {
  const f = fmt || fmtN
  const pctL = ((minVal - min) / (max - min)) * 100
  const pctR = ((maxVal - min) / (max - min)) * 100
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-[10px] text-gray-400">{f(minVal)} — {f(maxVal)}</span>
      </div>
      <div className="relative h-4">
        <div className="absolute top-[6px] left-0 right-0 h-1.5 bg-gray-200 dark:bg-[#333] rounded-full" />
        <div className="absolute top-[6px] h-1.5 bg-blue-500 rounded-full"
          style={{ left: `${pctL}%`, right: `${100-pctR}%` }} />
        <input type="range" min={min} max={max} value={minVal}
          onChange={e => onChange(+e.target.value, maxVal)}
          className="dual-thumb" style={{ zIndex: 3 }} />
        <input type="range" min={min} max={max} value={maxVal}
          onChange={e => onChange(minVal, +e.target.value)}
          className="dual-thumb" style={{ zIndex: 4 }} />
      </div>
    </div>
  )
}

interface Props {
  initial: VideoFilterValues
  onApply: (f: VideoFilterValues) => void
  onClose: () => void
}

export default function VideoFilters({ initial, onApply, onClose }: Props) {
  const [f, setF] = useState<VideoFilterValues>(initial)
  const set = (p: Partial<VideoFilterValues>) => setF(prev => ({ ...prev, ...p }))

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white dark:bg-[#0f0f0f] z-50 shadow-2xl flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-[#1e1e1e] flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white text-base">Filters & Views</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">Adjust search filters</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-xl">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Search Filters card */}
          <div className="bg-gray-50 dark:bg-[#111] border border-gray-100 dark:border-[#1e1e1e] rounded-xl p-4 space-y-4">
            <h3 className="font-semibold text-gray-800 dark:text-white text-sm">Search Filters</h3>

            {/* Long / Short toggle */}
            <div className="flex gap-2">
              {[{v:'all',l:'All'},{v:'long',l:'▶ Long'},{v:'short',l:'📱 Short'}].map(o => (
                <button key={o.v} type="button" onClick={() => set({ videoType: o.v as any })}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    f.videoType === o.v
                      ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-black dark:border-white'
                      : 'bg-white dark:bg-[#1a1a1a] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-[#2a2a2a] hover:border-gray-400'
                  }`}
                >{o.l}</button>
              ))}
            </div>

            {/* Sliders */}
            <MiniSlider label="Outlier Score"
              min={0} max={100} minVal={f.outlierMin} maxVal={f.outlierMax}
              onChange={(mn,mx) => set({ outlierMin:mn, outlierMax:mx })}
              fmt={n => `${n}x`} />

            <MiniSlider label="Views"
              min={0} max={1_000_000_000} minVal={f.viewsMin} maxVal={f.viewsMax}
              onChange={(mn,mx) => set({ viewsMin:mn, viewsMax:mx })} />

            <MiniSlider label="Subscribers"
              min={0} max={50_000_000} minVal={f.subsMin} maxVal={f.subsMax}
              onChange={(mn,mx) => set({ subsMin:mn, subsMax:mx })} />

            <MiniSlider label="Video Duration"
              min={0} max={43200} minVal={f.durationMin} maxVal={f.durationMax}
              onChange={(mn,mx) => set({ durationMin:mn, durationMax:mx })}
              fmt={fmtDur} />

            {/* Publication date */}
            <div>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Publication date</p>
              <div className="flex flex-wrap gap-1.5">
                {DATE_PRESETS.map(d => (
                  <button key={d.value} type="button" onClick={() => set({ datePreset: d.value })}
                    className={`px-3 py-1.5 text-[10px] font-medium rounded-full border transition-all ${
                      f.datePreset === d.value
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-[#1a1a1a] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-[#2a2a2a] hover:border-blue-400'
                    }`}
                  >{d.label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* View Preferences card */}
          <div className="bg-gray-50 dark:bg-[#111] border border-gray-100 dark:border-[#1e1e1e] rounded-xl p-4 space-y-4">
            <h3 className="font-semibold text-gray-800 dark:text-white text-sm">View Preferences</h3>

            {/* Columns */}
            <div>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Columns</p>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => set({ columns: Math.max(4, f.columns - 1) as any })}
                  className="w-9 h-9 rounded-lg border border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors flex items-center justify-center text-lg">
                  −
                </button>
                <span className="text-xl font-bold text-gray-900 dark:text-white w-8 text-center">{f.columns}</span>
                <button type="button" onClick={() => set({ columns: Math.min(6, f.columns + 1) as any })}
                  className="w-9 h-9 rounded-lg border border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors flex items-center justify-center text-lg">
                  +
                </button>
                <div className="flex gap-1 ml-2">
                  {[4,5,6].map(n => (
                    <button key={n} type="button" onClick={() => set({ columns: n as any })}
                      className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${
                        f.columns === n
                          ? 'bg-gray-900 dark:bg-white text-white dark:text-black'
                          : 'bg-white dark:bg-[#1a1a1a] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-[#2a2a2a]'
                      }`}
                    >{n}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-gray-100 dark:border-[#1e1e1e] flex-shrink-0">
          <button type="button" onClick={() => setF(DEFAULT_VIDEO_FILTERS)}
            className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-[#2a2a2a] rounded-xl hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors font-medium">
            Reset Filters
          </button>
          <button type="button" onClick={() => { onApply(f); onClose() }}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-gray-900 dark:bg-white dark:text-black hover:opacity-90 rounded-xl transition-opacity flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Apply changes
          </button>
        </div>
      </div>
    </>
  )
}
