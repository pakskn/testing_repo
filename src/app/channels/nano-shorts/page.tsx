import ContentView from '@/components/ContentView'

export const metadata = { title: 'Nano Shorts ⚡ — Niche Finder' }

export default function Page() {
  return (
    <ContentView
      channelType="short_form"
      title="Nano Shorts ⚡"
      onlyNano={true}
    />
  )
}
