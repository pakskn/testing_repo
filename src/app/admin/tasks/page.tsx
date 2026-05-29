'use client'

import { useEffect, useState, useRef } from 'react'

interface Task {
  id: string
  name: string
  description: string
  exists: boolean
}

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [runningTask, setRunningTask] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/admin/tasks')
      .then(res => res.json())
      .then(data => {
        if (data.tasks) setTasks(data.tasks)
        setLoading(false)
      })
  }, [])

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const runTask = (scriptId: string) => {
    if (runningTask) return
    if (!confirm(`Are you sure you want to run ${scriptId}?`)) return

    setRunningTask(scriptId)
    setLogs([`> Starting script sequence for ${scriptId}...`])

    const eventSource = new EventSource(`/api/admin/tasks/run?script=${scriptId}`)

    eventSource.onmessage = (event) => {
      setLogs(prev => [...prev, event.data])
      if (event.data.includes('--- Script exited with code')) {
        eventSource.close()
        setRunningTask(null)
      }
    }

    eventSource.onerror = () => {
      setLogs(prev => [...prev, '> Error: Connection to background task runner lost.'])
      eventSource.close()
      setRunningTask(null)
    }
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-bold text-zinc-100 tracking-tight">System Scripts</h1>
        <p className="text-zinc-400 text-xs mt-1">Execute background crawler routines, metadata updates, and sync operations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scripts List */}
        <div className="bg-[#121214] border border-zinc-800 rounded-xl p-6">
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Available Scripts</h2>
          {loading ? (
            <div className="text-zinc-500 text-xs font-mono uppercase tracking-wider">Loading scripts...</div>
          ) : (
            <div className="space-y-3">
              {tasks.map(task => (
                <div key={task.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-zinc-800/80 rounded-lg bg-[#09090b] hover:border-zinc-800 transition-colors">
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                      {task.name}
                      {!task.exists && (
                        <span className="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded font-mono font-bold">
                          NOT FOUND
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">{task.description}</p>
                    <code className="text-[10px] text-indigo-400 font-mono mt-1.5 block select-all">{task.id}</code>
                  </div>
                  
                  <button
                    onClick={() => runTask(task.id)}
                    disabled={!task.exists || runningTask !== null}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-colors whitespace-nowrap flex-shrink-0 border ${
                      runningTask === task.id
                        ? 'bg-indigo-600 border-indigo-500 text-white animate-pulse'
                        : !task.exists || runningTask !== null
                        ? 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    {runningTask === task.id ? 'Running...' : 'Run now'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Console Box */}
        <div className="bg-[#09090b] border border-zinc-800 rounded-xl p-5 flex flex-col h-[600px] font-mono">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800/80 flex-shrink-0">
            <h2 className="text-xs font-bold text-zinc-300 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${runningTask ? 'bg-indigo-500 animate-ping' : 'bg-zinc-600'}`} />
              Live Terminal Log
            </h2>
            {runningTask && <span className="text-[10px] text-indigo-400 animate-pulse uppercase tracking-wider font-semibold">Streaming...</span>}
          </div>
          
          <div className="flex-1 overflow-y-auto text-[11px] space-y-1.5 text-zinc-400 select-text scrollbar-hide">
            {logs.length === 0 ? (
              <p className="text-zinc-600 italic">Logs stream console will populate here upon script execution...</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={
                  log.includes('[ERROR]') || log.includes('Failed') ? 'text-rose-400 font-medium' :
                  log.includes('--- Script exited') ? 'text-indigo-400 font-bold mt-4 border-t border-zinc-900 pt-2' :
                  log.startsWith('>') ? 'text-zinc-300 font-semibold' :
                  'text-zinc-400'
                }>
                  {log}
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  )
}
