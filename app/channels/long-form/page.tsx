import ContentView from '@/components/ContentView'
export const metadata = { title: 'Long Form Channels — Niche Finder' }

export default function Page() {
  // Compute fresh on every request — hides videos older than 4 years
  const d = new Date()
  d.setFullYear(d.getFullYear() - 3)
  const fourYearsAgo = d.toISOString().split('T')[0]

  return (
    <ContentView
      channelType="long_form"
      title="Long Form Channels"
      excludeNiches={['Music', 'Comedy', 'Animation']}
      excludeKids={true}
      excludeNews={true}
      excludeEntertainment={true}
      onlyFaceless={true}
      hideInactive={true}
      defaultDateFrom={fourYearsAgo}
    />
  )
}
