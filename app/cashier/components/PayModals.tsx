'use client'
import { useState } from 'react'
import { Search } from 'lucide-react'
import Modal from '@/components/Modal'
import { fmt } from '@/lib/format'
import { matchesQuery } from '@/lib/search'
import type { Debtor, PayType } from '@/lib/types'

export type PayPayload = { payType: PayType; debtorId: string | null; newDebtorName: string }

const PAY_TYPES: { id: PayType; label: string }[] = [
  { id: 'naqd', label: 'Naqd' }, { id: 'click', label: 'Click' }, { id: 'karta', label: 'Karta' },
  { id: 'qarz', label: 'Qarz' }, { id: 'ichki', label: 'Ichki' },
]

// ---- To'lov: tur tanlash, qarz bo'lsa qarzdor tanlash yoki yangi ism.
// Tanlov oyna ichida saqlanadi: oyna yopilganda o'zi tozalanadi.
export function PayModal({
  billId, total, moslashuvActual, debtors, loading, error, onConfirm, onClose,
}: {
  billId: number
  total: number
  moslashuvActual: number | null
  debtors: Debtor[]
  loading: boolean
  error: string
  onConfirm: (payload: PayPayload) => void
  onClose: () => void
}) {
  const [payType, setPayType] = useState<PayType>('naqd')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [newName, setNewName] = useState('')

  const found = debtors.filter(d => matchesQuery(d.name, search) || (d.phone || '').includes(search.trim()))
  const selected = debtors.find(d => d.id === selectedId)
  const isDebt = payType === 'qarz'
  const debtMissing = isDebt && !selectedId && !newName.trim() && !search.trim()

  const submit = () => onConfirm({
    payType,
    debtorId: isDebt && selectedId ? selectedId : null,
    // Qidiruv maydoniga yozilgan ism ham yangi qarzdor nomi bo'ladi (qarz yo'qolib ketmasligi uchun)
    newDebtorName: isDebt && !selectedId ? (newName.trim() || search.trim()) : '',
  })

  return (
    <Modal title={`Hisob No ${billId}`} onClose={onClose}>
      <div className="text-[#C8860A] font-black text-3xl mb-1">{fmt(total)} so&apos;m</div>
      {moslashuvActual && moslashuvActual !== total && (
        <div className={`text-sm font-bold mb-3 ${moslashuvActual > total ? 'text-green-600' : 'text-orange-500'}`}>
          Haqiqiy: {fmt(moslashuvActual)} so&apos;m ({moslashuvActual > total ? '+' : ''}{fmt(moslashuvActual - total)} so&apos;m)
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 mb-4 mt-3">
        {PAY_TYPES.map(t => (
          <button key={t.id} type="button" onClick={() => setPayType(t.id)}
            className={`py-3 rounded-xl border-2 font-bold text-sm transition-all ${payType === t.id ? 'border-[#C8860A] bg-[#FFF8E7] text-[#1A1208]' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>{t.label}</button>
        ))}
      </div>

      {isDebt && (
        <div className="space-y-2 mb-4">
          <div className="text-xs font-bold text-gray-500">Qarzdorni qidiring:</div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-3 text-gray-400"/>
            <input type="text" placeholder="Ism yoki telefon..." value={search} onChange={e => { setSearch(e.target.value); setSelectedId('') }}
              className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#C8860A]"/>
          </div>
          {search && !selectedId && (
            <div className="border border-gray-200 rounded-xl overflow-hidden max-h-32 overflow-y-auto">
              {found.length === 0 ? <div className="px-4 py-2 text-xs text-gray-400">Topilmadi - yangi sifatida qo&apos;shiladi</div>
              : found.map(d => (
                <button key={d.id} type="button" onClick={() => { setSelectedId(d.id); setSearch(d.name) }} className="w-full text-left px-4 py-2 text-sm border-b border-gray-50 hover:bg-gray-50">
                  <span className="font-bold">{d.name}</span>
                  {d.phone && <span className="text-gray-400 text-xs ml-2">{d.phone}</span>}
                  <span className="text-red-500 text-xs ml-2 float-right">{fmt(d.total_debt)} so&apos;m</span>
                </button>
              ))}
            </div>
          )}
          {selected && (
            <div className="flex items-center justify-between bg-[#FFF8E7] border border-[#F5C842] rounded-xl px-4 py-2">
              <span className="font-bold text-sm">{selected.name}</span>
              <button type="button" aria-label="Tanlovni bekor qilish" onClick={() => { setSelectedId(''); setSearch('') }} className="text-gray-400 hover:text-red-500 text-xs">x</button>
            </div>
          )}
          {!selectedId && !search && (
            <input type="text" placeholder="Yangi mijoz ismi *" value={newName} onChange={e => setNewName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#C8860A]"/>
          )}
        </div>
      )}

      {payType === 'ichki' && <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 text-sm text-yellow-700 font-bold">Bu buyurtma tushum hisobiga kirmaydi</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm font-bold mb-3">{error}</div>}
      <button onClick={submit} disabled={loading || debtMissing} className="w-full py-4 rounded-xl bg-[#1E7B47] text-white font-black text-base disabled:opacity-50">
        {loading ? 'Saqlanmoqda...' : 'Tasdiqlash'}
      </button>
    </Modal>
  )
}

// ---- Moslashuvchan to'lov: mijoz aniq summani bera olmasa (±1000 so'm)
export function MoslashuvModal({ total, onClose, onConfirm }: { total: number; onClose: () => void; onConfirm: (actual: number) => void }) {
  const [summa, setSumma] = useState('')
  const given = parseInt(summa)
  const hasValue = !!summa && given > 0
  const diff = given - total
  const allowed = hasValue && Math.abs(diff) <= 1000

  return (
    <Modal title="Moslashuvchan to'lov" onClose={onClose}>
      <div className="text-gray-400 text-sm mb-1">Asl narx:</div>
      <div className="text-[#C8860A] font-black text-2xl mb-4">{fmt(total)} so&apos;m</div>
      <input type="number" placeholder="Haqiqiy to'lov summasi" value={summa} onChange={e => setSumma(e.target.value)}
        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg font-bold outline-none focus:border-[#C8860A] mb-3"/>
      {hasValue && (
        <div className={`rounded-xl p-4 mb-4 border-2 ${!allowed ? 'bg-red-50 border-red-300' : diff < 0 ? 'bg-orange-50 border-orange-300' : 'bg-green-50 border-green-300'}`}>
          {diff === 0 && <div className="text-center font-black text-green-600 text-lg">Aynan to&apos;g&apos;ri!</div>}
          {diff > 0 && allowed && <div className="text-center font-black text-green-600 text-xl">+{fmt(diff)} so&apos;m ortiqcha</div>}
          {diff < 0 && allowed && <div className="text-center font-black text-orange-600 text-xl">{fmt(Math.abs(diff))} so&apos;m kam</div>}
          {!allowed && <div className="text-center font-black text-red-600 text-lg">Ruxsat yo&apos;q! (max 1000 so&apos;m)</div>}
        </div>
      )}
      {allowed && (
        <button onClick={() => onConfirm(given)} className="w-full py-4 rounded-xl bg-[#1E7B47] text-white font-black text-base">To&apos;lovga o&apos;tish</button>
      )}
    </Modal>
  )
}
