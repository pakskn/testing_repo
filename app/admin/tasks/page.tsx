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
    setLogs([`> Starting ${scriptId}...`])

    const eventSource = new EventSource(`/api/admin/tasks/run?script=${scriptId}`)

    eventSource.onmessage = (event) => {
      setLogs(prev => [...prev, event.data])
      if (event.data.includes('--- Script exited with code')) {
        eventSource.close()
        setRunningTask(null)
      }
    }

    eventSource.onerror = () => {
      setLogs(prev => [...prev, '> Connection to task runner lost.'])
      eventSource.close()
      setRunningTask(null)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tasks & Scripts</h1>
          <p className="text-gray-500 text-sm mt-1">Run background data collection and synchronization scripts</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Task List */}
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-[#2a2a2a] p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Available Scripts</h2>
          {loading ? (
            <p className="text-sm text-gray-500">Loading tasks...</p>
          ) : (
            <div className="space-y-4">
              {tasks.map(task => (
                <div key={task.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-gray-100 dark:border-[#2a2a2a] rounded-xl bg-gray-50 dark:bg-[#111]">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      {task.name}
                      {!task.exists && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">MISSING</span>}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">{task.description}</p>
                    <code className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 block">{task.id}</code>
                  </div>
                  <button
                    onClick={() => runTask(task.id)}
                    disabled={!task.exists || runningTask !== null}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                      runningTask === task.id
                        ? 'bg-blue-600 text-white animate-pulse'
                        : !task.exists || runningTask !== null
                        ? 'bg-gray-200 dark:bg-[#333] text-gray-400 cursor-not-allowed'
                        : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100'
                    }`}
                  >
                    {runningTask === task.id ? 'Running...' : '▶ Run Task'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Logs Console */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 shadow-xl flex flex-col h-[600px] font-mono">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-800">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <span className="text-green-500">●</span> Console Output
            </h2>
            {runningTask && <span className="text-xs text-blue-400 animate-pulse">Streaming logs...</span>}
          </div>
          
          <div className="flex-1 overflow-y-auto text-xs space-y-1.5 custom-scrollbar">
            {logs.length === 0 ? (
              <p className="text-gray-600 italic">Select a task to run and logs will appear here...</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={
                  log.includes('[ERROR]') ? 'text-red-400' :
                  log.includes('--- Script exited') ? 'text-blue-400 font-bold mt-4' :
                  'text-gray-300'
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
