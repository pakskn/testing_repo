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
        <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100 tracking-tight">System Scripts</h1>
        <p className="text-gray-550 dark:text-zinc-400 text-xs mt-1">Execute background crawler routines, metadata updates, and sync operations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scripts List */}
        <div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
          <h2 className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-widest mb-4">Available Scripts</h2>
          {loading ? (
            <div className="text-gray-400 dark:text-zinc-500 text-xs font-mono uppercase tracking-wider">Loading scripts...</div>
          ) : (
            <div className="space-y-3">
              {tasks.map(task => (
                <div key={task.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-gray-150 dark:border-zinc-800/80 rounded-lg bg-gray-50 dark:bg-[#09090b] hover:border-gray-250 dark:hover:border-zinc-800 hover:shadow-sm transition-all">
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-gray-800 dark:text-zinc-200 flex items-center gap-2">
                      {task.name}
                      {!task.exists && (
                        <span className="text-[9px] bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 px-2 py-0.5 rounded font-mono font-bold">
                          NOT FOUND
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-1 leading-relaxed">{task.description}</p>
                    <code className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono mt-1.5 block select-all">{task.id}</code>
                  </div>
                  
                  <button
                    onClick={() => runTask(task.id)}
                    disabled={!task.exists || runningTask !== null}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-colors whitespace-nowrap flex-shrink-0 border ${
                      runningTask === task.id
                        ? 'bg-indigo-600 border-indigo-500 text-white animate-pulse'
                        : !task.exists || runningTask !== null
                        ? 'bg-gray-100 dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-400 dark:text-zinc-650 cursor-not-allowed'
                        : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 hover:text-gray-950 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {runningTask === task.id ? 'Running...' : 'Run now'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Console Box (Always dark slate for high terminal fidelity) */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col h-[600px] font-mono text-slate-100 shadow-lg">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/80 flex-shrink-0">
            <h2 className="text-xs font-bold text-slate-350 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${runningTask ? 'bg-indigo-550 animate-ping' : 'bg-slate-600'}`} />
              Live Terminal Log
            </h2>
            {runningTask && <span className="text-[10px] text-indigo-400 animate-pulse uppercase tracking-wider font-semibold">Streaming...</span>}
          </div>
          
          <div className="flex-1 overflow-y-auto text-[11px] space-y-1.5 text-slate-300 select-text scrollbar-hide">
            {logs.length === 0 ? (
              <p className="text-slate-600 italic">Logs stream console will populate here upon script execution...</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={
                  log.includes('[ERROR]') || log.includes('Failed') ? 'text-rose-400 font-medium' :
                  log.includes('--- Script exited') ? 'text-indigo-400 font-bold mt-4 border-t border-slate-900 pt-2' :
                  log.startsWith('>') ? 'text-slate-200 font-semibold' :
                  'text-slate-300'
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
