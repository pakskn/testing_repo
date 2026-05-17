'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import ChannelForm from '../ChannelForm'

export default function EditChannelPage() {
  const { id } = useParams<{ id: string }>()
  const [channel, setChannel] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch(`/api/admin/channels/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setErr(d.error); return }
        setChannel(d)
      })
      .catch(() => setErr('Failed to load channel'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="p-8 text-gray-500 flex items-center gap-2">
      <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      Loading channel data...
    </div>
  )

  if (err) return <div className="p-8 text-red-500">Error: {err}</div>

  const initial = {
    channelId:        channel.channelId,
    channelName:      channel.channelName,
    channelHandle:    channel.channelHandle || '',
    thumbnailUrl:     channel.thumbnailUrl || '',
    channelType:      channel.channelType,
    niche:            channel.niche || '',
    subscribers:      String(channel.subscribers),
    totalVideos:      String(channel.totalVideos),
    totalViews:       String(channel.totalViews),
    daysSinceStart:   String(channel.daysSinceStart),
    avgViewsPerVideo: String(channel.avgViewsPerVideo),
    outlierScore:     String(channel.outlierScore),
    isMonetized:      channel.isMonetized,
    isActive:         channel.isActive,
    sortOrder:        String(channel.sortOrder || 0),
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <a href="/admin/channels" className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
          ← Back to Channels
        </a>
        <div className="flex items-center gap-3 mt-2">
          {channel.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={channel.thumbnailUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{channel.channelName}</h1>
            <p className="text-gray-500 text-sm">{channel.channelHandle || channel.channelId}</p>
          </div>
        </div>
      </div>
      <ChannelForm id={id} initial={initial} />
    </div>
  )
}
