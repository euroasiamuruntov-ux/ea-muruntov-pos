'use client'
import { Plus, ShoppingCart, X } from 'lucide-react'
import { fmt } from '@/lib/format'
import type { Bill, CartItem } from '@/lib/types'

// O'ng panel: hisoblar (5 tagacha), savatdagi mahsulotlar, jami va to'lovga o'tish
export default function Cart({
  bills, activeBillId, cart, total, extraFor,
  onSelectBill, onAddBill, onRemoveBill, onChangeQty, onOpenPad, onAdjust, onCheckout,
}: {
  bills: Bill[]
  activeBillId: number
  cart: CartItem[]
  total: number
  /** tizim qoldig'idan oshgan (avto-kirim bo'ladigan) qism */
  extraFor: (item: CartItem) => number
  onSelectBill: (id: number) => void
  onAddBill: () => void
  onRemoveBill: (id: number) => void
  onChangeQty: (productId: string, delta: number) => void
  onOpenPad: (item: CartItem) => void
  onAdjust: () => void
  onCheckout: () => void
}) {
  return (
    <div style={{ position: 'fixed', right: 0, top: '48px', bottom: 0, width: '38%', display: 'flex', flexDirection: 'column', backgroundColor: 'white', zIndex: 20, borderLeft: '1px solid #E0DDD5' }}>
      <div className="flex items-center gap-1 px-2 pt-2 pb-0 border-b border-gray-100 overflow-x-auto flex-shrink-0">
        {bills.map(b => (
          <div key={b.id} onClick={() => onSelectBill(b.id)}
            className={`flex items-center gap-1 px-3 py-2 rounded-t-xl cursor-pointer transition-all flex-shrink-0 border-b-2 ${activeBillId === b.id ? 'bg-[#FFF8E7] border-[#C8860A]' : 'bg-gray-50 border-transparent hover:bg-gray-100'}`}>
            <span className={`text-xs font-black ${activeBillId === b.id ? 'text-[#C8860A]' : 'text-gray-400'}`}>No {b.id}</span>
            {b.cart.length > 0 && <span className="w-4 h-4 rounded-full bg-[#C8860A] text-[#1A1208] text-[10px] font-black flex items-center justify-center">{b.cart.reduce((s, i) => s + i.qty, 0)}</span>}
            {bills.length > 1 && (
              <button aria-label={`Hisob ${b.id} ni o'chirish`} onClick={e => { e.stopPropagation(); onRemoveBill(b.id) }} className="text-gray-300 hover:text-red-400 ml-0.5"><X size={12}/></button>
            )}
          </div>
        ))}
        <button onClick={onAddBill} aria-label="Yangi hisob" className="px-2 py-2 rounded-t-xl text-gray-400 hover:text-[#C8860A] hover:bg-[#FFF8E7] transition-all flex-shrink-0"><Plus size={16}/></button>
      </div>

      <div className="px-4 py-2 flex-shrink-0">
        <div className="text-gray-400 text-xs">{cart.length > 0 ? `${cart.length} xil mahsulot` : "Savat bo'sh"}</div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-1">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-3">
            <ShoppingCart size={48} strokeWidth={1.5}/>
            <div className="text-sm font-bold">Mahsulot tanlang</div>
            <div className="text-xs text-gray-300 text-center px-6">Kartani bosib turing: sonni raqam bilan kiritish</div>
          </div>
        ) : cart.map(item => {
          const extra = extraFor(item)
          return (
            <div key={item.product.id} className="flex items-center gap-2 py-3 border-b border-gray-50">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-[#1A1208] truncate">{item.product.name}</div>
                <div className="text-gray-400 text-xs">{fmt(item.product.price)} x {item.qty}</div>
                {extra > 0 && <div className="text-[11px] font-bold text-amber-600">Tizimda yetmaydi: +{extra} avto-kirim</div>}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button aria-label={`${item.product.name} kamaytirish`} onClick={() => onChangeQty(item.product.id, -1)}
                  className="w-9 h-9 rounded-lg border border-gray-200 bg-gray-50 font-bold flex items-center justify-center hover:border-[#C8860A] hover:text-[#C8860A] transition-all">-</button>
                <button type="button" aria-label={`${item.product.name} miqdori`} onClick={() => onOpenPad(item)}
                  className="min-w-12 h-9 px-2 rounded-lg border-2 border-[#F5C842] bg-[#FFF8E7] font-black text-base text-[#1A1208]">{item.qty}</button>
                <button aria-label={`${item.product.name} ko'paytirish`} onClick={() => onChangeQty(item.product.id, 1)}
                  className="w-9 h-9 rounded-lg border border-gray-200 bg-gray-50 font-bold flex items-center justify-center hover:border-[#C8860A] hover:text-[#C8860A] transition-all">+</button>
              </div>
              <div className="font-black text-[#C8860A] text-sm min-w-[64px] text-right">{fmt(item.product.price * item.qty)}</div>
            </div>
          )
        })}
      </div>

      <div style={{ padding: '12px 16px', borderTop: '2px solid #f3f4f6', flexShrink: 0, backgroundColor: 'white' }}>
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-gray-500 font-bold text-sm">Jami:</span>
          <span className="text-[#C8860A] font-black text-2xl">{fmt(total)} so&apos;m</span>
        </div>
        <button onClick={onAdjust} className="w-full py-2 rounded-xl bg-gray-100 text-gray-600 font-bold text-xs mb-2 hover:bg-gray-200 transition-all">Moslashuvchan to&apos;lov</button>
        <button disabled={cart.length === 0} onClick={onCheckout}
          className="w-full py-3.5 rounded-xl bg-[#C8860A] text-[#1A1208] font-black text-base transition-all hover:bg-[#F5C842] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed">Buyurtma berish</button>
      </div>
    </div>
  )
}
