import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const TASKS = [
  { id: 'daily_collector.py', name: 'Daily Collector', description: 'Run the daily collector to fetch new data.' },
  { id: 'fetch_all_today.py', name: 'Fetch All Today', description: 'Fetch today\'s stats for all active channels.' },
  { id: 'new_viral_collector.py', name: 'New Viral Collector', description: 'Find new viral channels/videos.' },
  { id: 'search_collector.py', name: 'Search Collector', description: 'Run search-based collection.' },
  { id: 'import_nexlev_channels.py', name: 'Import NexLev Channels', description: 'Import channels from the NexLev JSON file.' },
  { id: 'remote_db_push.py', name: 'Remote DB Push', description: 'Push Prisma schema to the remote database.' },
]

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Optional: Verify if the scripts actually exist
  const dataCollectorPath = path.join(process.cwd(), 'data-collector')
  
  const availableTasks = TASKS.map(task => {
    const exists = fs.existsSync(path.join(dataCollectorPath, task.id))
    return {
      ...task,
      exists
    }
  })

  return NextResponse.json({ tasks: availableTasks })
}
