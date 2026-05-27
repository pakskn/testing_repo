import ContentView from '@/components/ContentView'

export const metadata = { title: 'Archive — Niche Finder' }

export default function Page() {
  return (
    <ContentView
      channelType="long_form"
      title="Archive — Inactive Channels"
      onlyInactive={true}
    />
  )
}
