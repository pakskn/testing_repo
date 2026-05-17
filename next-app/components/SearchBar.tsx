'use client'

import { useState, useEffect, useRef } from 'react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function SearchBar({ value, onChange, placeholder = 'Search channels...' }: SearchBarProps) {
  const [local, setLocal] = useState(value)
  const onChangeRef = useRef(onChange)

  useEffect(() => { onChangeRef.current = onChange })

  useEffect(() => { setLocal(value) }, [value])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (local !== value) onChangeRef.current(local)
    }, 400)
    return () => clearTimeout(timer)
  }, [local, value])

  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
        🔍
      </span>
      <input
        type="text"
        value={local}
        onChange={e => setLocal(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] text-gray-900 dark:text-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-gray-400 dark:focus:border-[#3a3a3a] placeholder-gray-400 dark:placeholder-gray-600 transition-colors shadow-sm dark:shadow-none"
      />
      {local && (
        <button
          onClick={() => { setLocal(''); onChange('') }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-white text-sm transition-colors"
        >
          ✕
        </button>
      )}
    </div>
  )
}
