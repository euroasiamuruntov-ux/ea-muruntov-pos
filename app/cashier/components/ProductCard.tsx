'use client'
import { useRef } from 'react'
import { extraQty, stockInfo, type StockLevel, type StockMode } from '@/lib/stock'
import { fmt } from '@/lib/format'

const LEVEL_STYLE: Record<StockLevel, string> = {
  ok: 'text-green-600', low: 'text-orange-500', empty: 'text-red-500', extra: 'text-amber-600', muted: 'text-gray-400',
}

// Kartani bosib turish (500 ms) = son kiritish paneli; oddiy bosish = savatga +1
function useLongPress(onLongPress: () => void, ms = 500) {
  const timer = useRef<number | null>(null)
  const fired = useRef(false)
  const clear = () => { if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null } }
  return {
    handlers: {
      onPointerDown: () => { fired.current = false; clear(); timer.current = window.setTimeout(() => { fired.current = true; onLongPress() }, ms) },
      onPointerUp: clear,
      onPointerLeave: clear,
      onPointerCancel: clear,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    },
    consumeLongPress: () => { const was = fired.current; fired.current = false; return was },
  }
}

export type ProductCardProps = {
  name: string
  price: number
  /** savatdagi miqdor */
  qty: number
  mode: StockMode
  balance: number
  unit: string
  /** tez-tez sotiladiganlar qatori uchun ixcham ko'rinish */
  compact?: boolean
  onAdd: () => void
  onLongPress: () => void
  /** "+ tayyor": kirim oynasini shu taom bilan ochadi (faqat yumshoq rejimda) */
  onRestock?: () => void
}

export default function ProductCard({ name, price, qty, mode, balance, unit, compact, onAdd, onLongPress, onRestock }: ProductCardProps) {
  const info = stockInfo(mode, balance, unit)
  const extra = extraQty(mode, balance, qty)
  const { handlers, consumeLongPress } = useLongPress(onLongPress)
  const click = () => { if (!consumeLongPress()) onAdd() }

  if (compact) {
    return (
      <div role="button" aria-label={`Tez: ${name}`} {...handlers} onClick={click}
        className={`flex-shrink-0 w-40 bg-white rounded-2xl px-3 py-2 cursor-pointer border-2 select-none relative transition-all ${qty > 0 ? 'border-[#F5C842]' : 'border-transparent hover:border-[#C8860A]'}`}>
        {qty > 0 && <div className="absolute -top-2 -right-2 bg-[#C8860A] text-[#1A1208] rounded-full min-w-6 h-6 px-1 flex items-center justify-center text-xs font-black">{qty}</div>}
        <div className="font-extrabold text-[#1A1208] text-sm leading-tight truncate">{name}</div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[#C8860A] font-black text-sm">{fmt(price)}</span>
          {info && <span className={`text-[11px] font-bold truncate ${LEVEL_STYLE[info.level]}`}>{info.text}</span>}
        </div>
      </div>
    )
  }

  return (
    <div role="button" aria-label={name} {...handlers} onClick={click}
      className={`bg-white rounded-2xl overflow-hidden cursor-pointer border-2 transition-all select-none ${qty > 0 ? 'border-[#F5C842]' : 'border-transparent hover:border-[#C8860A] hover:-translate-y-0.5'}`}>
      <div className="bg-gradient-to-br from-[#FFF3D6] to-[#FFE8A3] h-24 flex items-center justify-center relative">
        <span className="text-5xl">🍽️</span>
        {qty > 0 && <div className="absolute top-2 right-2 bg-[#C8860A] text-[#1A1208] rounded-full w-7 h-7 flex items-center justify-center text-sm font-black">{qty}</div>}
      </div>
      <div className="p-3">
        <div className="font-extrabold text-[#1A1208] text-sm leading-tight">{name}</div>
        <div className="text-[#C8860A] font-black text-base mt-1">{fmt(price)} so&apos;m</div>
        {info && <div className={`text-xs font-bold mt-1 ${LEVEL_STYLE[info.level]}`}>{info.text}</div>}
        {extra > 0 && <div className="text-[11px] font-bold text-amber-600">+{extra} avto-kirim bo&apos;ladi</div>}
        {onRestock && mode === 'soft' && (info?.level === 'extra' || info?.level === 'low') && (
          <button type="button" onClick={e => { e.stopPropagation(); onRestock() }}
            onPointerDown={e => e.stopPropagation()}
            className="mt-1.5 px-2 py-1 rounded-lg bg-[#FFF8E7] border border-[#F5C842] text-[#C8860A] text-[11px] font-black">
            + tayyor
          </button>
        )}
      </div>
    </div>
  )
}
