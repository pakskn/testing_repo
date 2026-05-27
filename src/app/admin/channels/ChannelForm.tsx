'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const NICHES = [
  'Sports','History','Crime','Finance','Technology','Gaming','Education',
  'Science','Travel','Motivation','Psychology','Business','Cooking','Health',
  'Fitness','Nature','Wildlife','DIY','Productivity','Self Improvement',
  'True Crime','Space','Conspiracy',
]

interface FormData {
  channelId: string
  channelName: string
  channelHandle: string
  thumbnailUrl: string
  channelType: string
  niche: string
  subscribers: string
  totalVideos: string
  totalViews: string
  daysSinceStart: string
  avgViewsPerVideo: string
  outlierScore: string
  isMonetized: boolean
  isActive: boolean
  sortOrder: string
}

interface Props {
  id?: string       // existing channel ID for edit mode
  initial?: Partial<FormData>
}

const defaultForm: FormData = {
  channelId: '', channelName: '', channelHandle: '', thumbnailUrl: '',
  channelType: 'long_form', niche: '', subscribers: '0', totalVideos: '0',
  totalViews: '0', daysSinceStart: '0', avgViewsPerVideo: '0',
  outlierScore: '0', isMonetized: false, isActive: true, sortOrder: '0',
}

export default function ChannelForm({ id, initial }: Props) {
  const router = useRouter()
  const isEdit = !!id
  const [form, setForm] = useState<FormData>({ ...defaultForm, ...initial })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof FormData, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const url    = isEdit ? `/api/admin/channels/${id}` : '/api/admin/channels'
      const method = isEdit ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          subscribers:      Number(form.subscribers),
          totalVideos:      Number(form.totalVideos),
          totalViews:       Number(form.totalViews),
          daysSinceStart:   Number(form.daysSinceStart),
          avgViewsPerVideo: parseFloat(form.avgViewsPerVideo),
          outlierScore:     parseFloat(form.outlierScore),
          sortOrder:        Number(form.sortOrder),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed')
      router.push('/admin/channels')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, key: keyof FormData, type = 'text', readOnly = false) => (
    <div>
      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={form[key] as string}
        onChange={e => set(key, type === 'number' ? e.target.value : e.target.value)}
        readOnly={readOnly}
        step={type === 'number' ? 'any' : undefined}
        className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 transition-colors ${
          readOnly
            ? 'bg-gray-50 dark:bg-[#111] text-gray-400 border-gray-100 dark:border-[#1e1e1e] cursor-not-allowed'
            : 'bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white border-gray-200 dark:border-[#2a2a2a]'
        }`}
      />
    </div>
  )

  const toggle = (label: string, key: 'isMonetized' | 'isActive', color: string) => (
    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#111] rounded-lg border border-gray-100 dark:border-[#1e1e1e]">
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{form[key] ? 'Enabled' : 'Disabled'}</p>
      </div>
      <button
        type="button"
        onClick={() => set(key, !form[key])}
        className={`relative w-12 h-6 rounded-full transition-colors ${form[key] ? color : 'bg-gray-300 dark:bg-[#333]'}`}
      >
        <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form[key] ? 'translate-x-6' : ''}`} />
      </button>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          ⚠ {error}
        </div>
      )}

      {/* Channel Identity */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-[#2a2a2a] p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Channel Identity</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field('YouTube Channel ID', 'channelId', 'text', isEdit)}
          {field('Channel Name', 'channelName')}
          {field('Channel Handle (e.g. @channelname)', 'channelHandle')}
          {field('Avatar / Thumbnail URL', 'thumbnailUrl')}
        </div>
      </div>

      {/* Classification */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-[#2a2a2a] p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Classification</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Channel Type
            </label>
            <select
              value={form.channelType}
              onChange={e => set('channelType', e.target.value)}
              className="w-full border border-gray-200 dark:border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white focus:outline-none focus:border-blue-400"
            >
              <option value="long_form">📹 Long Form</option>
              <option value="short_form">▶️ Short Form</option>
              <option value="real_time">🔴 Real Time</option>
              <option value="terminated">⛔ Terminated</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Niche / Category
            </label>
            <select
              value={form.niche}
              onChange={e => set('niche', e.target.value)}
              className="w-full border border-gray-200 dark:border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white focus:outline-none focus:border-blue-400"
            >
              <option value="">-- Select Niche --</option>
              {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-[#2a2a2a] p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Channel Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {field('Subscribers', 'subscribers', 'number')}
          {field('Total Videos (Uploads)', 'totalVideos', 'number')}
          {field('Total Views (All Time)', 'totalViews', 'number')}
          {field('Days Since Channel Start', 'daysSinceStart', 'number')}
          {field('Avg Views Per Video', 'avgViewsPerVideo', 'number')}
          {field('Outlier Score (auto-calc)', 'outlierScore', 'number')}
        </div>
        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
          <p className="text-xs text-blue-600 dark:text-blue-400">
            💡 Outlier Score formula: <strong>Avg Views ÷ Subscribers</strong>.
            Currently: <strong>{form.subscribers !== '0' ? (parseFloat(form.avgViewsPerVideo) / parseFloat(form.subscribers || '1')).toFixed(2) : '0'}x</strong>
          </p>
        </div>
      </div>

      {/* Status Toggles */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-[#2a2a2a] p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {toggle('💰 Monetized', 'isMonetized', 'bg-green-500')}
          {toggle('👁 Active (visible on site)', 'isActive', 'bg-blue-500')}
        </div>
        <div className="mt-4">
          {field('Sort Order (lower = higher on list)', 'sortOrder', 'number')}
        </div>
      </div>

      {/* Submit */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            <><div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> Saving...</>
          ) : (
            isEdit ? '💾 Save Changes' : '➕ Create Channel'
          )}
        </button>
        <a href="/admin/channels"
          className="px-6 py-3 border border-gray-200 dark:border-[#2a2a2a] rounded-xl text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors text-center">
          Cancel
        </a>
      </div>
    </form>
  )
}
