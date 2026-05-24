'use client'

import { useState } from 'react'
import RangeSlider from './RangeSlider'

// Duration ranges (seconds)
export const DURATION_RANGES: Record<string, { min: number; max: number; label: string; desc: string }> = {
  micro:           { min: 0,     max: 179,   label: 'Micro',        desc: '< 3 min (16:9)' },
  standard_long:   { min: 180,   max: 1199,  label: 'Standard',     desc: '3 – 20 min' },
  prime:           { min: 1200,  max: 3599,  label: 'Prime',        desc: '20 – 60 min' },
  ultra:           { min: 3600,  max: 43200, label: 'Ultra',        desc: '1h – 12h' },
  nano:            { min: 0,     max: 12,    label: 'Nano Shorts',  desc: 'Under 12 sec' },
  standard_shorts: { min: 14,    max: 60,    label: 'Standard',     desc: '14 – 60 sec' },
  super:           { min: 60,    max: 179,   label: 'Super Shorts', desc: '60 sec – 2:59' },
}

export interface FilterValues {
  monetization: 'on' | 'all' | 'off'
  faceless:     'yes' | 'all' | 'no'
  videoFormat:  'all' | 'long' | 'shorts'
  videoSubtype: string
  contentMode:  'channels' | 'videos'
  subsMin: number; subsMax: number
  avgViewsMin: number; avgViewsMax: number
  totalViewsMin: number; totalViewsMax: number
  totalVideosMin: number; totalVideosMax: number
  outlierMin: number; outlierMax: number
  dateFrom: string; dateTo: string
  selectedNiches: string[]
}

export const DEFAULT_FILTERS: FilterValues = {
  monetization: 'all', faceless: 'all',
  videoFormat: 'all', videoSubtype: '', contentMode: 'channels',
  subsMin: 0,        subsMax: 50_000_000,
  avgViewsMin: 0,    avgViewsMax: 10_000_000,
  totalViewsMin: 0,  totalViewsMax: 1_000_000_000,
  totalVideosMin: 0, totalVideosMax: 10_000,
  outlierMin: 0,     outlierMax: 100,
  dateFrom: '', dateTo: '',
  selectedNiches: [],
}

function Tgl<T extends string>({ opts, val, onChange }: {
  opts: { label: string; value: T }[]
  val: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-[#2a2a2a]">
      {opts.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            val === o.value
              ? 'bg-blue-600 text-white'
              : 'bg-white dark:bg-[#1a1a1a] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#252525]'
          }`}
        >{o.label}</button>
      ))}
    </div>
  )
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">{title}</h3>
      <div className="bg-gray-50 dark:bg-[#111] border border-gray-100 dark:border-[#1e1e1e] rounded-xl p-3 space-y-4">
        {children}
      </div>
    </div>
  )
}

interface Props {
  initial: FilterValues
  onApply: (f: FilterValues) => void
  onClose: () => void
}

export default function AdvancedFilters({ initial, onApply, onClose }: Props) {
  const [f, setF] = useState<FilterValues>(initial)
  const set = (p: Partial<FilterValues>) => setF(prev => ({ ...prev, ...p }))

  const activeCount = [
    f.monetization !== 'all', f.faceless !== 'all',
    f.videoFormat !== 'all', f.videoSubtype !== '',
    f.subsMin > 0 || f.subsMax < 50_000_000,
    f.avgViewsMin > 0 || f.avgViewsMax < 10_000_000,
    f.totalViewsMin > 0 || f.totalViewsMax < 1_000_000_000,
    f.totalVideosMin > 0 || f.totalVideosMax < 10_000,
    f.outlierMin > 0 || f.outlierMax < 100,
    f.dateFrom !== '' || f.dateTo !== '',
  ].filter(Boolean).length

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-[#0f0f0f] z-50 shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-[#1e1e1e] flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-white text-sm">⚙ Filters</span>
            {activeCount > 0 && (
              <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{activeCount}</span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-lg leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Step 1: Video Format */}
          <Sec title="Step 1 — Video Format">
            <div className="flex gap-2">
              {[
                { v: 'all',    l: '📋 All'    },
                { v: 'long',   l: '📹 Long'   },
                { v: 'shorts', l: '📱 Shorts'  },
              ].map(o => (
                <button key={o.v} type="button"
                  onClick={() => set({ videoFormat: o.v as any, videoSubtype: '' })}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    f.videoFormat === o.v
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-[#1a1a1a] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-[#2a2a2a] hover:border-blue-400'
                  }`}
                >{o.l}</button>
              ))}
            </div>

            {f.videoFormat === 'long' && (
              <div className="grid grid-cols-2 gap-2">
                {(['micro', 'standard_long', 'prime', 'ultra'] as const).map(k => {
                  const r = DURATION_RANGES[k]
                  const active = f.videoSubtype === k
                  return (
                    <button key={k} type="button"
                      onClick={() => set({ videoSubtype: active ? '' : k })}
                      className={`p-2.5 rounded-lg text-left border transition-all ${
                        active
                          ? 'bg-blue-600 border-blue-600'
                          : 'bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-[#2a2a2a] hover:border-blue-400'
                      }`}
                    >
                      <p className={`text-xs font-bold ${active ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>{r.label}</p>
                      <p className={`text-[10px] ${active ? 'text-blue-100' : 'text-gray-400 dark:text-gray-500'}`}>{r.desc}</p>
                    </button>
                  )
                })}
              </div>
            )}

            {f.videoFormat === 'shorts' && (
              <div className="grid grid-cols-3 gap-2">
                {(['nano', 'standard_shorts', 'super'] as const).map(k => {
                  const r = DURATION_RANGES[k]
                  const active = f.videoSubtype === k
                  return (
                    <button key={k} type="button"
                      onClick={() => set({ videoSubtype: active ? '' : k })}
                      className={`p-2 rounded-lg text-center border transition-all ${
                        active
                          ? 'bg-blue-600 border-blue-600'
                          : 'bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-[#2a2a2a] hover:border-blue-400'
                      }`}
                    >
                      <p className={`text-[10px] font-bold leading-tight ${active ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>{r.label}</p>
                      <p className={`text-[9px] mt-0.5 ${active ? 'text-blue-100' : 'text-gray-400 dark:text-gray-500'}`}>{r.desc}</p>
                    </button>
                  )
                })}
              </div>
            )}
          </Sec>

          {/* Step 2: Content Mode */}
          <Sec title="Step 2 — Show Me">
            <div className="grid grid-cols-2 gap-3">
              {[
                { v: 'channels', i: '📺', l: 'Channels', d: 'Filter channels' },
                { v: 'videos',   i: '🎬', l: 'Videos',   d: 'Filter videos'  },
              ].map(o => (
                <button key={o.v} type="button"
                  onClick={() => set({ contentMode: o.v as any })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    f.contentMode === o.v
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400'
                      : 'bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-[#2a2a2a] hover:border-blue-300'
                  }`}
                >
                  <span className="text-xl">{o.i}</span>
                  <p className={`text-xs font-bold mt-1 ${f.contentMode === o.v ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200'}`}>{o.l}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">{o.d}</p>
                </button>
              ))}
            </div>
          </Sec>

          {/* Monetization + Faceless */}
          <Sec title="Channel Properties">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-gray-400 mb-1.5 uppercase font-semibold">Monetization</p>
                <Tgl opts={[{label:'On',value:'on'},{label:'All',value:'all'},{label:'Off',value:'off'}]}
                  val={f.monetization} onChange={v => set({ monetization: v as any })} />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1.5 uppercase font-semibold">Faceless</p>
                <Tgl opts={[{label:'Yes',value:'yes'},{label:'All',value:'all'},{label:'No',value:'no'}]}
                  val={f.faceless} onChange={v => set({ faceless: v as any })} />
              </div>
            </div>
          </Sec>

          {/* Subscriber Metrics */}
          <Sec title="Subscriber Metrics">
            <RangeSlider label="Subscribers"
              min={0} max={50_000_000} step={1_000} arrowStep={1_000}
              minVal={f.subsMin} maxVal={f.subsMax}
              onChange={(mn, mx) => set({ subsMin: mn, subsMax: mx })} />
          </Sec>

          {/* View Metrics */}
          <Sec title="View Metrics">
            <RangeSlider label="Avg. Views Per Video"
              min={0} max={10_000_000} step={1_000} arrowStep={1_000}
              minVal={f.avgViewsMin} maxVal={f.avgViewsMax}
              onChange={(mn, mx) => set({ avgViewsMin: mn, avgViewsMax: mx })} />
            <RangeSlider label="Total Views (All Time)"
              min={0} max={1_000_000_000} step={10_000} arrowStep={10_000}
              minVal={f.totalViewsMin} maxVal={f.totalViewsMax}
              onChange={(mn, mx) => set({ totalViewsMin: mn, totalViewsMax: mx })} />
          </Sec>

          {/* Performance */}
          <Sec title="Upload & Performance">
            <RangeSlider label="Total Videos Uploaded"
              min={0} max={10_000} step={1} arrowStep={100}
              minVal={f.totalVideosMin} maxVal={f.totalVideosMax}
              onChange={(mn, mx) => set({ totalVideosMin: mn, totalVideosMax: mx })} />
            <RangeSlider label="Outlier Score (x)"
              min={0} max={100} step={0.5} arrowStep={1}
              minVal={f.outlierMin} maxVal={f.outlierMax}
              onChange={(mn, mx) => set({ outlierMin: mn, outlierMax: mx })} />
          </Sec>

          {/* Date Filter */}
          <Sec title="Date Filter">
            <p className="text-[10px] text-gray-400 dark:text-gray-500">
              {f.contentMode === 'channels' ? 'Channel Creation Date' : 'Video Upload Date'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-400 mb-1 block">From</label>
                <input type="date" value={f.dateFrom}
                  onChange={e => set({ dateFrom: e.target.value })}
                  className="w-full text-xs px-2 py-2 border border-gray-200 dark:border-[#2a2a2a] rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 mb-1 block">To</label>
                <input type="date" value={f.dateTo}
                  onChange={e => set({ dateTo: e.target.value })}
                  className="w-full text-xs px-2 py-2 border border-gray-200 dark:border-[#2a2a2a] rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-400" />
              </div>
            </div>
          </Sec>

        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-gray-100 dark:border-[#1e1e1e] flex-shrink-0 bg-white dark:bg-[#0f0f0f]">
          <button type="button" onClick={() => setF(DEFAULT_FILTERS)}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-[#2a2a2a] rounded-xl hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors">
            Reset Filters
          </button>
          <button type="button" onClick={() => { onApply(f); onClose() }}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors">
            Apply Filters
          </button>
        </div>
      </div>
    </>
  )
}
