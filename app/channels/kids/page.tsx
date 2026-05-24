import ContentView from '@/components/ContentView'

export const metadata = { title: 'Kids Channels — Niche Finder' }

export default function Page() {
  return (
    <ContentView
      channelType="long_form"
      title="Kids"
      onlyKids={true}
    />
  )
}
