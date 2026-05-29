import ContentView from '@/components/ContentView'

export const metadata = { title: 'Short Form Channels — Niche Finder' }

export default function Page() {
  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1">
        <ContentView
          channelType="short_form"
          title="Short Form Channels"
        />
      </div>
    </div>
  )
}
