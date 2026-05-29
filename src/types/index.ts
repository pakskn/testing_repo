export interface Video {
  videoId: string
  title: string
  thumbnailUrl: string | null
  views: number
  duration: string | null
  publishedAt: string | null
  language?: string | null
}

export interface Channel {
  channelId: string
  channelName: string
  channelHandle: string | null
  thumbnailUrl: string | null
  subscribers: number
  totalVideos: number
  totalViews: number
  channelType: string
  niche: string | null
  daysSinceStart: number
  avgViewsPerVideo: number
  outlierScore: number
  isMonetized: boolean
  isFaceless?: boolean
  isAi?: boolean
  isKids?: boolean
  isNews?: boolean
  isEntertainment?: boolean
  isNano?: boolean
  monthlyViews?: number | bigint
  updatedAt: string
  videos: Video[]
}

export interface ChannelsResponse {
  total: number
  page: number
  channels: Channel[]
}

export type FilterType =
  | 'all'
  | 'outliers'
  | 'high_views_low_subs'
  | 'above_50k'
  | 'new_channels'
  | 'high_revenue'
  | 'monetized'

export type SortType =
  | 'created_at'
  | 'subscribers'
  | 'avg_views'
  | 'days_since_start'
  | 'total_videos'
  | 'total_revenue'
  | 'random'

export type OrderType = 'asc' | 'desc'

export type ChannelType = 'long_form' | 'short_form' | 'real_time' | 'terminated'
