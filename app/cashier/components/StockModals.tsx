'use client'
import { useState } from 'react'
import Modal from '@/components/Modal'
import { formatEquivalents, formatKg, hissaFromKg, portionLabel, portionsToHissa, type OshProduct } from '@/lib/osh'
import type { Product } from '@/lib/types'

export type KirimPayload = {
  productId: string
  mode: 'kg' | 'portion'
  /** kg / litr / dona (matn, kiritilganicha) */
  qty: string
  /** porsiya rejimida: necha butun, necha yarim */
  portions: { productId: string; qty: number }[]
}

export type ChiqimPayload = { productId: string; qty: string; reason: string }

const input = 'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#C8860A]'

// ---- Kirim: dona / litr (kampot) / kg yoki porsiya (osh). Tanlov oyna ichida saqlanadi.
export function KirimModal({
  products, initialProductId, initialMode, loading, onSubmit, onClose,
}: {
  products: Product[]
  initialProductId: string
  initialMode: 'kg' | 'portion'
  loading: boolean
  onSubmit: (payload: KirimPayload) => void
  onClose: () => void
}) {
  const [productId, setProductId] = useState(initialProductId)
  const [mode, setMode] = useState(initialMode)
  const [qty, setQty] = useState('')
  const [portionQty, setPortionQty] = useState<Record<string, string>>({})

  const prod = products.find(p => p.id === productId)
  // Osh mahsulotlari (butun, yarim): kattasidan boshlab
  const oshProducts = products.filter(p => p.unit_type === 'hissa').sort((a, b) => (b.hissa_per_unit ?? 1) - (a.hissa_per_unit ?? 1))
  const portions = oshProducts.map(p => ({ product: p, qty: parseInt(portionQty[p.id] || '0') || 0 })).filter(i => i.qty > 0)
  const oshList: OshProduct[] = oshProducts
  const byPortion = prod?.unit_type === 'hissa' && mode === 'portion'
  const ready = !!prod && (byPortion ? portions.length > 0 : !!qty)

  const choose = (id: string) => { setProductId(id); setQty(''); setPortionQty({}) }

  return (
    <Modal title="Mahsulot kirim" titleClassName="text-[#1E7B47]" onClose={onClose}>
      <select value={productId} onChange={e => choose(e.target.value)} aria-label="Mahsulot" className={`${input} mb-3 bg-white`}>
        <option value="">Mahsulot tanlang</option>
        {products.map(p => <option key={p.id} value={p.id}>{p.name}{!p.is_available ? " (Yo'q)" : ''}</option>)}
      </select>

      {prod?.unit_type === 'hissa' && (
        <div>
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1 mb-3">
            {([['kg', 'Kg bilan'], ['portion', 'Porsiya bilan']] as const).map(([m, label]) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mode === m ? 'bg-[#C8860A] text-[#1A1208]' : 'text-gray-500'}`}>{label}</button>
            ))}
          </div>
          {mode === 'kg' ? (
            <>
              <input type="number" placeholder="Miqdor (kg)" value={qty} onChange={e => setQty(e.target.value)} className={`${input} mb-2`}/>
              {qty && parseFloat(qty) > 0 && (
                <div className="bg-[#FFF8E7] border border-[#F5C842] rounded-xl px-4 py-3 text-sm mb-3">
                  <span className="font-bold text-[#C8860A]">{parseFloat(qty)} kg</span> = <b>{formatEquivalents(hissaFromKg(parseFloat(qty), prod), oshList)}</b>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex gap-2 mb-2">
                {oshProducts.map(p => (
                  <label key={p.id} className="flex-1">
                    <div className="text-xs font-bold text-gray-500 mb-1"><span className="capitalize">{portionLabel(p)}</span> (ta)</div>
                    <input type="number" min={0} placeholder="0" aria-label={`${portionLabel(p)} porsiya soni`} value={portionQty[p.id] || ''}
                      onChange={e => setPortionQty(prev => ({ ...prev, [p.id]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg font-black text-center outline-none focus:border-[#C8860A]"/>
                  </label>
                ))}
              </div>
              {portions.length > 0 && (
                <div className="bg-[#FFF8E7] border border-[#F5C842] rounded-xl px-4 py-3 text-sm mb-3">
                  <b>{portions.map(i => `${i.qty} ${portionLabel(i.product)}`).join(' + ')}</b> = <span className="font-bold text-[#C8860A]">{formatKg(portionsToHissa(portions), oshList)}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {prod && prod.unit_type !== 'hissa' && prod.litr_per_unit ? (
        <div>
          <input type="number" placeholder="Miqdor (litr)" value={qty} onChange={e => setQty(e.target.value)} className={`${input} mb-2`}/>
          {qty && parseFloat(qty) > 0 && (
            <div className="bg-[#FFF8E7] border border-[#F5C842] rounded-xl px-4 py-3 text-sm mb-3 text-center">
              <span className="font-bold text-[#C8860A]">{parseFloat(qty)} litr</span><span className="text-gray-500"> = </span>
              <span className="font-black text-green-600 text-lg">{Math.floor(parseFloat(qty) / prod.litr_per_unit)} stakan</span>
            </div>
          )}
        </div>
      ) : prod && prod.unit_type !== 'hissa' ? (
        <div className="mb-4">
          <input type="number" placeholder="Miqdor (dona)" value={qty} onChange={e => setQty(e.target.value)} className={`${input} mb-2`}/>
          <div className="flex gap-2">
            {[1, 5, 10, 20].map(n => (
              <button key={n} type="button" onClick={() => setQty(String((parseFloat(qty) || 0) + n))}
                className="flex-1 py-2 rounded-xl bg-[#FFF8E7] border border-[#F5C842] text-[#C8860A] text-sm font-black">+{n}</button>
            ))}
          </div>
        </div>
      ) : null}

      <button onClick={() => onSubmit({ productId, mode, qty, portions: portions.map(i => ({ productId: i.product.id, qty: i.qty })) })}
        disabled={loading || !ready} className="w-full py-4 rounded-xl bg-[#1E7B47] text-white font-black text-base disabled:opacity-50">{loading ? '...' : 'Kirim qilish'}</button>
    </Modal>
  )
}

// ---- Chiqim: buzilgan, to'kilgan yoki yo'qolgan mahsulot (izoh majburiy)
export function ChiqimModal({
  products, loading, onSubmit, onClose,
}: { products: Product[]; loading: boolean; onSubmit: (payload: ChiqimPayload) => void; onClose: () => void }) {
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')

  return (
    <Modal title="Mahsulot chiqim" titleClassName="text-[#B83232]" onClose={onClose}>
      <select value={productId} onChange={e => setProductId(e.target.value)} aria-label="Mahsulot" className={`${input} mb-3 bg-white`}>
        <option value="">Mahsulot tanlang</option>
        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <input type="number" placeholder="Miqdor" value={qty} onChange={e => setQty(e.target.value)} className={`${input} mb-3`}/>
      <textarea placeholder="Izoh (sabab)..." value={reason} onChange={e => setReason(e.target.value)} rows={3} className={`${input} mb-4 resize-none`}/>
      <button onClick={() => onSubmit({ productId, qty, reason })} disabled={loading || !productId || !qty || !reason.trim()}
        className="w-full py-4 rounded-xl bg-[#B83232] text-white font-black text-base disabled:opacity-50">{loading ? '...' : 'Chiqim qilish'}</button>
    </Modal>
  )
}
