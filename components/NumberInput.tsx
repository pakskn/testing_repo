'use client'

import { useState, useEffect } from 'react'

function fmtDisplay(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString()
}

interface Props {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number          // arrow step (default 1000)
  placeholder?: string
}

export default function NumberInput({
  value, onChange,
  min = 0, max = 999_999_999,
  step = 1_000,
  placeholder,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')

  useEffect(() => {
    if (!editing) setRaw(String(value))
  }, [value, editing])

  const commit = (raw: string) => {
    const cleaned = raw.replace(/[^0-9]/g, '')
    const n = Math.max(min, Math.min(max, parseInt(cleaned) || 0))
    onChange(n)
    setEditing(false)
  }

  const inc = () => onChange(Math.min(max, value + step))
  const dec = () => onChange(Math.max(min, value - step))

  return (
    <div className="flex items-stretch border border-gray-200 dark:border-[#2a2a2a] rounded-lg overflow-hidden bg-white dark:bg-[#1a1a1a] focus-within:border-blue-400 transition-colors">
      {/* Editable value */}
      {editing ? (
        <input
          type="text"
          value={raw}
          autoFocus
          onChange={e => setRaw(e.target.value)}
          onBlur={() => commit(raw)}
          onKeyDown={e => {
            if (e.key === 'Enter') commit(raw)
            if (e.key === 'Escape') setEditing(false)
          }}
          className="flex-1 px-2 py-1.5 text-xs text-center bg-transparent text-gray-900 dark:text-white outline-none min-w-0"
          placeholder={placeholder}
        />
      ) : (
        <button
          type="button"
          onClick={() => { setEditing(true); setRaw(String(value)) }}
          title="Click to type exact value"
          className="flex-1 px-2 py-1.5 text-xs text-center text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors min-w-0 truncate"
        >
          {fmtDisplay(value)}
        </button>
      )}

      {/* Up / Down arrows */}
      <div className="flex flex-col border-l border-gray-200 dark:border-[#2a2a2a] flex-shrink-0">
        <button
          type="button"
          onClick={inc}
          title={`+${step.toLocaleString()}`}
          className="px-1.5 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors"
          style={{ height: '50%', fontSize: '9px' }}
        >▲</button>
        <button
          type="button"
          onClick={dec}
          title={`-${step.toLocaleString()}`}
          className="px-1.5 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors border-t border-gray-200 dark:border-[#2a2a2a]"
          style={{ height: '50%', fontSize: '9px' }}
        >▼</button>
      </div>
    </div>
  )
}
