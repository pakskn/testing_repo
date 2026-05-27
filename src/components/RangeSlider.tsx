'use client'

import { useState, useEffect } from 'react'
import NumberInput from './NumberInput'

interface Props {
  label: string
  min: number
  max: number
  minVal: number
  maxVal: number
  step?: number
  arrowStep?: number    // NumberInput arrow step (default 1000)
  onChange: (min: number, max: number) => void
}

export default function RangeSlider({
  label, min, max, minVal, maxVal,
  step = 1, arrowStep = 1_000, onChange,
}: Props) {
  const [lv, setLv] = useState(minVal)
  const [rv, setRv] = useState(maxVal)

  useEffect(() => { setLv(minVal) }, [minVal])
  useEffect(() => { setRv(maxVal) }, [maxVal])

  const pctL = ((lv - min) / (max - min)) * 100
  const pctR = ((rv - min) / (max - min)) * 100

  const commitL = (v: number) => {
    const clamped = Math.min(v, rv - step)
    setLv(clamped); onChange(clamped, rv)
  }
  const commitR = (v: number) => {
    const clamped = Math.max(v, lv + step)
    setRv(clamped); onChange(lv, clamped)
  }

  return (
    <div>
      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-3">{label}</p>
      <div className="relative h-5 mb-3">
        <div className="absolute top-[9px] left-0 right-0 h-[3px] bg-gray-200 dark:bg-[#333] rounded-full" />
        <div className="absolute top-[9px] h-[3px] bg-blue-500 rounded-full"
          style={{ left: `${pctL}%`, right: `${100 - pctR}%` }} />
        <input type="range" min={min} max={max} step={step} value={lv}
          onChange={e => setLv(+e.target.value)}
          onMouseUp={e => commitL(+(e.target as HTMLInputElement).value)}
          onTouchEnd={e => commitL(+(e.target as HTMLInputElement).value)}
          className="dual-thumb" style={{ zIndex: lv >= max - step ? 5 : 3 }} />
        <input type="range" min={min} max={max} step={step} value={rv}
          onChange={e => setRv(+e.target.value)}
          onMouseUp={e => commitR(+(e.target as HTMLInputElement).value)}
          onTouchEnd={e => commitR(+(e.target as HTMLInputElement).value)}
          className="dual-thumb" style={{ zIndex: 4 }} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberInput value={lv} onChange={commitL} min={min} max={rv} step={arrowStep} />
        <NumberInput value={rv} onChange={commitR} min={lv} max={max} step={arrowStep} />
      </div>
    </div>
  )
}
