'use client'

import { useState } from 'react'
import RangeSlider from './RangeSlider'

const NICHES = [
  'Sports', 'History', 'Crime', 'Finance', 'Technology',
  'Gaming', 'Education', 'Science', 'Travel', 'Motivation',
  'Psychology', 'Business', 'Cooking', 'Health', 'Fitness',
  'Nature', 'Wildlife', 'DIY', 'Productivity', 'Self Improvement',
  'True Crime', 'Space', 'Conspiracy',
]

export interface FilterValues {
  monetization: 'on' | 'all' | 'off'
  faceless:     'yes' | 'all' | 'no'
  shorts:       'yes' | 'all' | 'no'
  subsMin: number;  subsMax: number
  avgViewsMin: number;  avgViewsMax: number
  outlierMin: number;   outlierMax: number
  totalVideosMin: number; totalVideosMax: number
  selectedNiches: string[]
}

export const DEFAULT_FILTERS: FilterValues = {
  monetization: 'all', faceless: 'all', shorts: 'all',
  subsMin: 0,           subsMax: 50_000_000,
  avgViewsMin: 0,       avgViewsMax: 10_000_000,
  outlierMin: 0,        outlierMax: 100,
  totalVideosMin: 0,    totalVideosMax: 10_000,
  selectedNiches: [],
}

// ─── Toggle group (On/All/Off style) ─────────────────────────────────────────
function ToggleGroup<T extends string>({
  options, value, onChange
}: { options: { label: string; value: T }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-[#2a2a2a]">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            value === o.value
              ? 'bg-blue-600 text-white'
              : 'bg-white dark:bg-[#1a1a1a] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#252525]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-3">{title}</h3>
      <div className="bg-gray-50 dark:bg-[#111] border border-gray-100 dark:border-[#222] rounded-xl p-4">
        {children}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
interface Props {
  initial: FilterValues
  onApply: (f: FilterValues) => void
  onClose: () => void
}

export default function AdvancedFilters({ initial, onApply, onClose }: Props) {
  const [advanced, setAdvanced] = useState(false)
  const [f, setF] = useState<FilterValues>(initial)

  const set = (patch: Partial<FilterValues>) => setF(prev => ({ ...prev, ...patch }))

  const toggleNiche = (niche: string) => {
    set({
      selectedNiches: f.selectedNiches.includes(niche)
        ? f.selectedNiches.filter(n => n !== niche)
        : [...f.selectedNiches, niche],
    })
  }

  const reset = () => setF(DEFAULT_FILTERS)

  const activeCount = [
    f.monetization !== 'all',
    f.faceless !== 'all',
    f.subsMin > 0 || f.subsMax < 50_000_000,
    f.avgViewsMin > 0 || f.avgViewsMax < 10_000_000,
    f.outlierMin > 0 || f.outlierMax < 100,
    f.totalVideosMin > 0 || f.totalVideosMax < 10_000,
  ].filter(Boolean).length

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white dark:bg-[#0f0f0f] z-50 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#1e1e1e] flex-shrink-0">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span className="font-semibold text-gray-900 dark:text-white text-base">Filters</span>
            {activeCount > 0 && (
              <span className="bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{activeCount}</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Advanced</span>
              <button
                onClick={() => setAdvanced(a => !a)}
                className={`relative w-10 h-6 rounded-full transition-colors ${advanced ? 'bg-blue-600' : 'bg-gray-300 dark:bg-[#333]'}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${advanced ? 'translate-x-4' : ''}`} />
              </button>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-xl leading-none">✕</button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* ── Basic toggles (2 cols — Shorts removed, Categories separate) ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Monetization</p>
              <ToggleGroup
                options={[{ label: 'On', value: 'on' }, { label: 'All', value: 'all' }, { label: 'Off', value: 'off' }]}
                value={f.monetization}
                onChange={v => set({ monetization: v as any })}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Faceless</p>
              <ToggleGroup
                options={[{ label: 'Yes', value: 'yes' }, { label: 'All', value: 'all' }, { label: 'No', value: 'no' }]}
                value={f.faceless}
                onChange={v => set({ faceless: v as any })}
              />
            </div>
          </div>

          {/* ── Subscriber Metrics ── */}
          <Section title="Subscriber Metrics">
            <RangeSlider
              label="Subscribers"
              min={0} max={50_000_000} step={1_000}
              minVal={f.subsMin} maxVal={f.subsMax}
              onChange={(mn, mx) => set({ subsMin: mn, subsMax: mx })}
            />
          </Section>

          {/* ── View Metrics ── */}
          <Section title="View Metrics">
            <div className="space-y-5">
              <RangeSlider
                label="Avg. Views Per Video"
                min={0} max={10_000_000} step={1_000}
                minVal={f.avgViewsMin} maxVal={f.avgViewsMax}
                onChange={(mn, mx) => set({ avgViewsMin: mn, avgViewsMax: mx })}
              />
              {advanced && (
                <RangeSlider
                  label="Outlier Score"
                  min={0} max={100} step={0.5}
                  minVal={f.outlierMin} maxVal={f.outlierMax}
                  format="score"
                  onChange={(mn, mx) => set({ outlierMin: mn, outlierMax: mx })}
                />
              )}
            </div>
          </Section>

          {/* ── Upload & Performance ── */}
          <Section title="Upload & Performance">
            <div className="space-y-5">
              <RangeSlider
                label="Total Videos"
                min={0} max={10_000} step={10}
                minVal={f.totalVideosMin} maxVal={f.totalVideosMax}
                onChange={(mn, mx) => set({ totalVideosMin: mn, totalVideosMax: mx })}
              />
              {advanced && (
                <RangeSlider
                  label="Outlier Score (x)"
                  min={0} max={100} step={0.5}
                  minVal={f.outlierMin} maxVal={f.outlierMax}
                  format="score"
                  onChange={(mn, mx) => set({ outlierMin: mn, outlierMax: mx })}
                />
              )}
            </div>
          </Section>

        </div>

        {/* Footer buttons */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 dark:border-[#1e1e1e] flex-shrink-0 bg-white dark:bg-[#0f0f0f]">
          <button
            onClick={reset}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-[#2a2a2a] rounded-xl transition-colors bg-white dark:bg-[#1a1a1a] hover:bg-gray-50 dark:hover:bg-[#252525]"
          >
            Reset Filters
          </button>
          <button
            onClick={() => { onApply(f); onClose() }}
            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </>
  )
}
