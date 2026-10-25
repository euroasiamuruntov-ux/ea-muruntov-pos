'use client'
import Modal from '@/components/Modal'
import type { PrevStock, Product, Shift } from '@/lib/types'

// ---- Yangi smena ochishdan oldin o'tgan smena qoldig'ini tasdiqlash
export function ShiftStartModal({
  prevStocks, onChange, loading, onConfirm, onNoStock,
}: {
  prevStocks: PrevStock[]
  onChange: (next: PrevStock[]) => void
  loading: boolean
  onConfirm: () => void
  onNoStock: () => void
}) {
  const update = (i: number, patch: Partial<PrevStock>) => onChange(prevStocks.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  return (
    <Modal title="O'tgan smena qoldiqlari" variant="center" size="lg"
      footer={
        <div className="space-y-2">
          <button onClick={onConfirm} disabled={loading} className="w-full py-3 rounded-xl font-black text-white text-sm disabled:opacity-50 bg-[#1E7B47]">{loading ? '...' : 'Tasdiqlash va smena ochish'}</button>
          <button onClick={onNoStock} className="w-full py-2 rounded-xl text-gray-400 text-xs font-bold hover:bg-gray-50">Qoldiqsiz boshlash</button>
        </div>
      }>
      <div className="p-4 space-y-2">
        <div className="text-xs text-gray-400 mb-1">Miqdorni tekshiring. 0 qilsangiz - chiqindi sifatida saqlanadi</div>
        {prevStocks.map((ps, i) => (
          <div key={ps.product_id} className="bg-gray-50 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex-1 font-bold text-sm">{ps.name}</div>
              <div className="text-xs text-gray-400 flex-shrink-0">O&apos;tgan: <b>{ps.qty_original}</b></div>
              <input type="number" value={ps.qty} aria-label={`${ps.name} qoldig'i`} onChange={e => update(i, { qty: parseFloat(e.target.value) || 0 })}
                className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-center text-sm font-bold outline-none focus:border-[#C8860A]"/>
            </div>
            {ps.qty < ps.qty_original && <div className="text-xs text-orange-500 font-bold mb-1">{ps.qty_original - ps.qty} ta chiqindi sifatida yoziladi</div>}
            <input type="text" placeholder="Izoh (ixtiyoriy)..." value={ps.note} onChange={e => update(i, { note: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-[#C8860A]"/>
          </div>
        ))}
      </div>
    </Modal>
  )
}

// ---- Smena boshqaruvi: ochish yoki yopishga o'tish
export function ShiftModal({
  shift, loading, onClose, onOpen, onClosing,
}: { shift: Shift | null; loading: boolean; onClose: () => void; onOpen: () => void; onClosing: () => void }) {
  return (
    <Modal title="Smena boshqaruvi" onClose={onClose}>
      {shift ? (
        <>
          <div className="bg-green-50 border-2 border-green-400 rounded-xl p-4 mb-4">
            <div className="font-black text-green-700">Smena ochiq</div>
            <div className="text-sm text-gray-500 mt-1">Boshlangan: {new Date(shift.opened_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          <button onClick={onClosing} className="w-full py-4 rounded-xl font-black text-base text-white bg-[#B83232]">Smena yopish</button>
        </>
      ) : (
        <button onClick={onOpen} disabled={loading} className="w-full py-4 rounded-xl font-black text-base text-white disabled:opacity-50 bg-[#1E7B47]">{loading ? '...' : 'Smena ochish'}</button>
      )}
    </Modal>
  )
}

// ---- Smena yopish: haqiqiy qoldiqni kiritish (farq bo'lsa izoh majburiy)
export type ShiftReportInput = { [productId: string]: { actual: string; note: string } }

export function CloseShiftModal({
  products, report, onReport, getSystemQty, loading, onBack, onConfirm,
}: {
  products: Product[]
  report: ShiftReportInput
  onReport: (next: ShiftReportInput) => void
  getSystemQty: (p: Product) => number
  loading: boolean
  onBack: () => void
  onConfirm: () => void
}) {
  return (
    <Modal title="Smena yopish hisoboti" variant="center" size="lg" onClose={onBack}
      footer={<button onClick={onConfirm} disabled={loading} className="w-full py-3 rounded-xl font-black text-white text-sm disabled:opacity-50 bg-[#B83232]">{loading ? '...' : 'Tasdiqlash va smena yopish'}</button>}>
      <div className="p-4">
        <div className="text-xs text-gray-400 mb-3 font-bold">Har mahsulot uchun haqiqiy qoldiqni kiriting. Bo&apos;sh qoldirsangiz - tizim hisobi qabul qilinadi.</div>
        {products.filter(p => p.is_available).map(p => {
          const sysQty = getSystemQty(p)
          const rep = report[p.id] || { actual: '', note: '' }
          const actual = rep.actual === '' ? sysQty : parseFloat(rep.actual)
          const diff = actual - sysQty
          return (
            <div key={p.id} className="mb-3 p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 font-bold text-sm truncate">{p.name}</div>
                <div className="text-xs text-gray-400 flex-shrink-0">Tizim: <b>{sysQty}</b></div>
                <input type="number" placeholder={String(sysQty)} value={rep.actual} aria-label={`${p.name} haqiqiy qoldig'i`}
                  onChange={e => onReport({ ...report, [p.id]: { ...rep, actual: e.target.value } })}
                  className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-center text-sm font-bold outline-none focus:border-[#C8860A] flex-shrink-0"/>
              </div>
              {rep.actual !== '' && diff !== 0 && (
                <>
                  <div className={`text-xs font-bold mb-1 ${diff < 0 ? 'text-red-500' : 'text-green-600'}`}>Farq: {diff > 0 ? '+' : ''}{diff} ta</div>
                  <input type="text" placeholder="Izoh (majburiy)..." aria-label={`${p.name} izohi`} value={rep.note}
                    onChange={e => onReport({ ...report, [p.id]: { ...rep, note: e.target.value } })}
                    className={`w-full border rounded-lg px-2 py-1 text-xs outline-none focus:border-[#C8860A] ${rep.note.trim() ? 'border-gray-200' : 'border-red-300 bg-red-50'}`}/>
                </>
              )}
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
