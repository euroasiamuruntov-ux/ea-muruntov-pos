'use client'
import { useState } from 'react'
import { Delete, X } from 'lucide-react'

// Planshetda sonni tez kiritish uchun katta raqam paneli.
export default function NumberPad({
  title, subtitle, initial, presets = [1, 2, 3, 5, 10, 20], onConfirm, onClose,
}: {
  title: string
  subtitle?: string
  initial?: number
  presets?: number[]
  onConfirm: (n: number) => void
  onClose: () => void
}) {
  const [value, setValue] = useState('')
  const shown = value === '' ? (initial ? String(initial) : '0') : value
  const n = value === '' ? NaN : parseInt(value, 10)

  const press = (d: string) => setValue(v => (v.length >= 3 ? v : v === '0' ? d : v + d))
  const confirmLabel = value === '' ? 'Miqdorni kiriting' : n === 0 ? 'Savatdan olib tashlash' : `OK — ${n} ta`

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div role="dialog" aria-label="Son kiritish" className="bg-white rounded-3xl w-full max-w-xs p-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0">
            <div className="font-black text-base text-[#1A1208] truncate">{title}</div>
            {subtitle && <div className="text-xs text-gray-400">{subtitle}</div>}
          </div>
          <button type="button" aria-label="Yopish" onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0"><X size={16}/></button>
        </div>

        <div data-testid="pad-value" className={`text-center font-black text-5xl py-3 rounded-2xl bg-[#FFF8E7] mb-3 ${value === '' ? 'text-gray-300' : 'text-[#C8860A]'}`}>{shown}</div>

        <div className="grid grid-cols-6 gap-1.5 mb-3">
          {presets.map(p => (
            <button key={p} type="button" onClick={() => setValue(String(p))}
              className="py-2 rounded-xl bg-[#FFF8E7] border border-[#F5C842] text-[#C8860A] text-sm font-black">{p}</button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
            <button key={d} type="button" onClick={() => press(d)} className="h-14 rounded-2xl bg-gray-100 text-2xl font-black text-[#1A1208] active:bg-gray-200">{d}</button>
          ))}
          <button type="button" onClick={() => setValue('')} className="h-14 rounded-2xl bg-gray-50 text-sm font-black text-gray-500 active:bg-gray-200">C</button>
          <button type="button" onClick={() => press('0')} className="h-14 rounded-2xl bg-gray-100 text-2xl font-black text-[#1A1208] active:bg-gray-200">0</button>
          <button type="button" aria-label="O'chirish" onClick={() => setValue(v => v.slice(0, -1))} className="h-14 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-500 active:bg-gray-200"><Delete size={22}/></button>
        </div>

        <button type="button" disabled={Number.isNaN(n)} onClick={() => onConfirm(n)}
          className={`w-full py-4 rounded-2xl font-black text-base text-white disabled:opacity-40 ${n === 0 ? 'bg-[#B83232]' : 'bg-[#1E7B47]'}`}>
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
