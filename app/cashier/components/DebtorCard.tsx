'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Debtor = { id: string; name: string; phone: string; total_debt: number }
type Product = { id: string; name: string }
type Payment = { id: string; amount: number; pay_type: string; created_at: string }
type Order = {
  id: string; total: number; created_at: string
  order_items: { product_id: string; qty: number; price: number }[]
}

const fmt = (n: number) => n.toLocaleString('uz-UZ')

export default function DebtorCard({
  debtor,
  products,
  onUpdate,
}: {
  debtor: Debtor
  products: Product[]
  onUpdate: (id: string, newDebt: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payType, setPayType] = useState('naqd')
  const [payments, setPayments] = useState<Payment[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loaded, setLoaded] = useState(false)
  const [paying, setPaying] = useState(false)

  const loadHistory = async () => {
    if (loaded) return
    const [{ data: pays }, { data: ords }] = await Promise.all([
      supabase.from('debt_payments')
        .select('*').eq('debtor_id', debtor.id)
        .order('created_at', { ascending: false }),
      supabase.from('orders')
        .select('*, order_items(product_id, qty, price)')
        .eq('debtor_id', debtor.id)
        .order('created_at', { ascending: false }),
    ])
    setPayments(pays || [])
    setOrders((ords as Order[]) || [])
    setLoaded(true)
  }

  const handleOpen = () => {
    const next = !open
    setOpen(next)
    if (next) loadHistory()
  }

  const handlePay = async () => {
    if (!payAmount || parseInt(payAmount) <= 0) return
    setPaying(true)
    const amount = parseInt(payAmount)
    const newDebt = Math.max(0, debtor.total_debt - amount)

    await supabase.from('debtors')
      .update({ total_debt: newDebt, updated_at: new Date().toISOString() })
      .eq('id', debtor.id)

    const { data: newPay } = await supabase.from('debt_payments').insert({
      debtor_id: debtor.id,
      amount,
      pay_type: payType,
      note: `To'lov: ${fmt(amount)} so'm (${payType})`,
    }).select().single()

    if (newPay) setPayments(prev => [newPay, ...prev])
    onUpdate(debtor.id, newDebt)
    setPayAmount('')
    setPaying(false)
  }

  return (
    <div className="border-b border-gray-50">
      {/* Asosiy qator */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
        onClick={handleOpen}>
        <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center font-black text-red-500 text-sm flex-shrink-0">
          {debtor.name[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm">{debtor.name}</div>
          {debtor.phone && <div className="text-xs text-gray-400">{debtor.phone}</div>}
        </div>
        <div className="text-right flex-shrink-0">
          <div className={`font-black text-sm ${debtor.total_debt > 0 ? 'text-red-500' : 'text-green-600'}`}>
            {debtor.total_debt > 0 ? fmt(debtor.total_debt) + ' so\'m' : '✅ Qarzsiz'}
          </div>
          <div className="text-xs text-gray-300">{open ? '▲' : '▼'}</div>
        </div>
      </div>

      {/* Ochilgan qism */}
      {open && (
        <div className="px-4 pb-4 bg-gray-50 space-y-3">

          {/* To'lov qilish */}
          {debtor.total_debt > 0 && (
            <div className="bg-white rounded-xl p-3 space-y-2">
              <div className="text-xs font-bold text-gray-500">Qarz to'lash:</div>
              <input
                type="number"
                placeholder={`Max: ${fmt(debtor.total_debt)} so'm`}
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C8860A]"
              />
              {/* 4 ta to'lov turi */}
              <div className="grid grid-cols-4 gap-1">
                {(['naqd', 'click', 'karta'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setPayType(t)}
                    className={`py-2 rounded-lg border text-xs font-bold transition-all text-center ${payType === t ? 'border-[#C8860A] bg-[#FFF8E7] text-[#1A1208]' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                    <div>{t === 'naqd' ? '💵' : t === 'click' ? '📱' : t === 'karta' ? '💳' : '📝'}</div>
                    <div>{t}</div>
                  </button>
                ))}
              </div>
              <button onClick={handlePay} disabled={paying || !payAmount}
                className="w-full py-2.5 rounded-xl bg-[#1E7B47] text-white font-black text-sm disabled:opacity-50">
                {paying ? '...' : '✓ To\'lovni tasdiqlash'}
              </button>
            </div>
          )}

          {/* Qarz buyurtmalari tarixi */}
          {orders.length > 0 && (
            <div className="bg-white rounded-xl p-3">
              <div className="text-xs font-bold text-gray-500 mb-2">🧾 Qarz buyurtmalari:</div>
              {orders.map(o => (
                <div key={o.id} className="py-2 border-b border-gray-50 last:border-0">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">
                      {new Date(o.created_at).toLocaleDateString('uz-UZ')} —{' '}
                      {new Date(o.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="font-black text-red-500">{fmt(o.total)} so'm</span>
                  </div>
                  {o.order_items?.map((oi, i) => {
                    const prod = products.find(p => p.id === oi.product_id)
                    return (
                      <div key={i} className="text-xs text-gray-500 ml-2">
                        • {prod?.name || 'Noma\'lum'} × {oi.qty} — {fmt(oi.price * oi.qty)} so'm
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}

          {/* To'lov tarixi */}
          {payments.length > 0 && (
            <div className="bg-white rounded-xl p-3">
              <div className="text-xs font-bold text-gray-500 mb-2">✅ To'lov tarixi:</div>
              {payments.map((p, i) => (
                <div key={i} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                  <div>
                    <div className="text-xs font-bold text-gray-600">{p.pay_type}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(p.created_at).toLocaleDateString('uz-UZ')} —{' '}
                      {new Date(p.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="font-black text-green-600 text-sm">+{fmt(p.amount)} so'm</div>
                </div>
              ))}
            </div>
          )}

          {orders.length === 0 && payments.length === 0 && loaded && (
            <div className="text-center text-gray-400 text-xs py-2">Tarix yo'q</div>
          )}
        </div>
      )}
    </div>
  )
}