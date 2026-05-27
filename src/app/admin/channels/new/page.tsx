import ChannelForm from '../ChannelForm'

export default function NewChannelPage() {
  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <a href="/admin/channels" className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
          ← Back to Channels
        </a>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">Add New Channel</h1>
        <p className="text-gray-500 text-sm mt-1">Manually add a YouTube channel to the database</p>
      </div>
      <ChannelForm />
    </div>
  )
}
