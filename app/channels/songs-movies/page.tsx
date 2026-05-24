import ContentView from '@/components/ContentView'

export const metadata = { title: 'Songs & Movies — Niche Finder' }

export default function Page() {
  return (
    <ContentView
      channelType="long_form"
      title="Songs & Movies"
      defaultNiches={['Music', 'Comedy', 'Animation']}
      includeNews={true}
      includeEntertainment={true}
      excludeKids={true}
    />
  )
}
