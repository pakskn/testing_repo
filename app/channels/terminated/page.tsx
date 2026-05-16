import ChannelsView from '@/components/ChannelsView'
export const metadata = { title: 'Terminated Channels — Niche Finder' }
export default function TerminatedPage() {
  return <ChannelsView channelType="terminated" title="Terminated Channels" />
}
