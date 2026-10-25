'use client'
import { ChevronDown } from 'lucide-react'

// Yig'iladigan bo'lim: sarlavha bosilganda ochiladi/yopiladi. Yopiq bo'lsa ichi chizilmaydi.
export default function Section({
  title, badge, tone = '#1A1208', open, onToggle, children,
}: {
  title: string
  badge?: string | number
  tone?: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <button type="button" aria-expanded={open} onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-3.5 text-left">
        <span className="font-black text-sm flex-1" style={{ color: tone }}>{title}</span>
        {badge !== undefined && badge !== '' && (
          <span className="text-xs font-bold text-gray-500 bg-gray-100 rounded-full px-2.5 py-0.5">{badge}</span>
        )}
        <ChevronDown size={18} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-gray-100">{children}</div>}
    </div>
  )
}
