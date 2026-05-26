'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import jsPDF from 'jspdf'
import { Clock, UtensilsCrossed, Users, BarChart3, LogOut, PackagePlus, PackageMinus, Search } from 'lucide-react'
import DebtorCard from '../cashier/components/DebtorCard'

type User = { id: string; name: string; role: string }
type Category = { id: string; name: string; order_num: number }
type Product = { id: string; name: string; price: number; category_id: string; is_available: boolean }
type Shift = { id: string; is_open: boolean; opened_at: string; closed_at?: string; opened_by?: string; closed_by?: string }
type ShiftStock = { product_id: string; initial_qty: number }
type Order = { id: string; total: number; pay_type: string; debt_paid: boolean; debtor_name: string | null; worker_id: string; created_at: string; actual_paid?: number; payment_note?: string }
type OrderItem = { order_id: string; product_id: string; qty: number; price: number }
type Worker = { id: string; name: string; pin: string; role: string }
type WriteOff = { id: string; product_id: string; qty: number; reason: string; worker_id: string; created_at: string }
type StockIn = { id: string; product_id: string; qty: number; worker_id: string; created_at: string }
type Debtor = { id: string; name: string; phone: string; total_debt: number }
type ShiftSummary = {
  id: string
  opened_at: string
  closed_at: string | null
  is_open: boolean
  opened_by_name: string | null
  closed_by_name: string | null
  order_count: number
  total_revenue: number
  cash_revenue: number
  click_revenue: number
  card_revenue: number
  debt_revenue: number
  ichki_count: number
}

type Tab = 'hisobot' | 'smena' | 'mahsulot' | 'xodim' | 'qarzdorlar' | 'tarix'

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('hisobot')
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [oshHissa, setOshHissa] = useState(0)
  const [shift, setShift] = useState<Shift | null>(null)
  const [stocks, setStocks] = useState<ShiftStock[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [writeOffs, setWriteOffs] = useState<WriteOff[]>([])
  const [stockIns, setStockIns] = useState<StockIn[]>([])
  const [debtors, setDebtors] = useState<Debtor[]>([])
  const [debtorSearch, setDebtorSearch] = useState('')
  const [shiftHistory, setShiftHistory] = useState<ShiftSummary[]>([])
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null)
  const [shiftReports, setShiftReports] = useState<{[shiftId: string]: any[]}>({})

  const [newCatName, setNewCatName] = useState('')
  const [newProdName, setNewProdName] = useState('')
  const [newProdPrice, setNewProdPrice] = useState('')
  const [newProdCat, setNewProdCat] = useState('')
  const [newWorkerName, setNewWorkerName] = useState('')
  const [newWorkerPin, setNewWorkerPin] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    const u = localStorage.getItem('pos_user')
    if (!u) { router.push('/'); return }
    const parsed = JSON.parse(u)
    if (parsed.role !== 'owner') { router.push('/cashier'); return }
    setUser(parsed)
    loadAll()
  }, [])

  const loadAll = async () => {
    const [
      { data: cats }, { data: prods },
      { data: shifts }, { data: ords },
      { data: oi }, { data: wrks },
      { data: wo }, { data: si },
      { data: dbtrs }, { data: history },
    ] = await Promise.all([
      supabase.from('categories').select('*').order('order_num'),
      supabase.from('products').select('*').order('created_at'),
      supabase.from('shifts').select('*').order('opened_at', { ascending: false }).limit(1).single(),
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('order_items').select('*'),
      supabase.from('users').select('*').eq('role', 'worker'),
      supabase.from('write_offs').select('*').order('created_at', { ascending: false }),
      supabase.from('stock_ins').select('*').order('created_at', { ascending: false }),
      supabase.from('debtors').select('*').order('name'),
      supabase.from('shift_summary').select('*').order('opened_at', { ascending: false }).limit(30),
    ])
    setCategories(cats || [])
    setProducts(prods || [])
    setShift(shifts || null)
    setOrders(ords || [])
    setOrderItems(oi || [])
    setWorkers(wrks || [])
    setWriteOffs(wo || [])
    setStockIns(si || [])
    setDebtors(dbtrs || [])
    setShiftHistory(history || [])

    if (shifts?.id) {
      const { data: st } = await supabase.from('shift_stock').select('*').eq('shift_id', shifts.id)
      setStocks(st || [])
      const { data: oh } = await supabase.from('osh_stock').select('*').eq('shift_id', shifts.id).maybeSingle()
      setOshHissa(oh?.total_hissa || 0)
    }
  }

  const loadShiftReport = async (shiftId: string) => {
    if (shiftReports[shiftId]) return
    const { data } = await supabase
      .from('shift_reports')
      .select('*, products(name)')
      .eq('shift_id', shiftId)
    setShiftReports(prev => ({ ...prev, [shiftId]: data || [] }))
  }

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }
  const fmt = (n: number) => n.toLocaleString('uz-UZ')
  const workerName = (id: string) => workers.find(w => w.id === id)?.name || 'Noma\'lum'
  const productName = (id: string) => products.find(p => p.id === id)?.name || 'Noma\'lum'

  const toggleAvail = async (p: Product) => {
    await supabase.from('products').update({ is_available: !p.is_available }).eq('id', p.id)
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_available: !x.is_available } : x))
  }

  const updateStock = async (productId: string, qty: number) => {
    if (!shift) return
    setStocks(prev => prev.map(s => s.product_id === productId ? { ...s, initial_qty: qty } : s))
    await supabase.from('shift_stock').update({ initial_qty: qty }).eq('shift_id', shift.id).eq('product_id', productId)
  }

  const addCategory = async () => {
    if (!newCatName.trim()) return
    const { data } = await supabase.from('categories').insert({ name: newCatName.trim(), order_num: categories.length + 1 }).select().single()
    if (data) { setCategories(p => [...p, data]); setNewCatName(''); showToast('✅ Kategoriya qo\'shildi!') }
  }

  const deleteCategory = async (id: string) => {
    await supabase.from('categories').delete().eq('id', id)
    setCategories(p => p.filter(c => c.id !== id))
  }

  const addProduct = async () => {
    if (!newProdName.trim() || !newProdPrice || !newProdCat) return
    const { data } = await supabase.from('products').insert({ name: newProdName.trim(), price: parseInt(newProdPrice), category_id: newProdCat, is_available: true }).select().single()
    if (data) { setProducts(p => [...p, data]); setNewProdName(''); setNewProdPrice(''); setNewProdCat(''); showToast('✅ Mahsulot qo\'shildi!') }
  }

  const deleteProduct = async (id: string) => {
    await supabase.from('products').delete().eq('id', id)
    setProducts(p => p.filter(x => x.id !== id))
  }

  const addWorker = async () => {
    if (!newWorkerName.trim() || newWorkerPin.length !== 4) return
    const { data } = await supabase.from('users').insert({ name: newWorkerName.trim(), pin: newWorkerPin, role: 'worker' }).select().single()
    if (data) { setWorkers(p => [...p, data]); setNewWorkerName(''); setNewWorkerPin(''); showToast('✅ Xodim qo\'shildi!') }
  }

  const deleteWorker = async (id: string) => {
    await supabase.from('users').delete().eq('id', id)
    setWorkers(p => p.filter(x => x.id !== id))
  }

  const shiftOrders = shift ? orders.filter(o => new Date(o.created_at) >= new Date(shift.opened_at)) : orders
  const totalRev = shiftOrders.filter(o => o.pay_type !== 'ichki').reduce((s, o) => s + o.total, 0)
  const actualRev = shiftOrders.filter(o => o.pay_type !== 'ichki').reduce((s, o) => s + (o.actual_paid ?? o.total), 0)
  const cashRev = shiftOrders.reduce((s, o) => s + (o.pay_type === 'naqd' ? (o.actual_paid ?? o.total) : 0), 0)
  const cardRev = shiftOrders.reduce((s, o) => s + (o.pay_type === 'karta' ? (o.actual_paid ?? o.total) : 0), 0)
  const clickRev = shiftOrders.reduce((s, o) => s + (o.pay_type === 'click' ? (o.actual_paid ?? o.total) : 0), 0)
  const debtRev = shiftOrders.reduce((s, o) => s + (o.pay_type === 'qarz' ? o.total : 0), 0)
  const ichkiOrders = shiftOrders.filter(o => o.pay_type === 'ichki')
  const activeDebts = shiftOrders.filter(o => o.pay_type === 'qarz' && !o.debt_paid)
  const moslashuvOrders = shiftOrders.filter(o => o.payment_note)

  const soldByProduct = products.map(p => {
    const shiftOrderIds = shiftOrders.map(o => o.id)
    const sold = orderItems.filter(oi => oi.product_id === p.id && shiftOrderIds.includes(oi.order_id)).reduce((s, oi) => s + oi.qty, 0)
    const stock = stocks.find(s => s.product_id === p.id)
    const writeOff = writeOffs.filter(w => w.product_id === p.id && shift && new Date(w.created_at) >= new Date(shift.opened_at)).reduce((s, w) => s + w.qty, 0)
    const stockIn = stockIns.filter(si => si.product_id === p.id && shift && new Date(si.created_at) >= new Date(shift.opened_at)).reduce((s, si) => s + si.qty, 0)
    const remaining = (stock?.initial_qty || 0) + stockIn - sold - writeOff
    return { ...p, sold, writeOff, stockIn, remaining, initial: stock?.initial_qty || 0 }
  }).filter(p => p.sold > 0 || p.writeOff > 0 || p.stockIn > 0 || p.initial > 0)

  const payDebt = async (orderId: string) => {
    await supabase.from('orders').update({ debt_paid: true }).eq('id', orderId)
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, debt_paid: true } : o))
    showToast('✅ Qarz yopildi!')
  }

  const filteredDebtors = debtors.filter(d =>
    d.name.toLowerCase().includes(debtorSearch.toLowerCase()) ||
    (d.phone || '').includes(debtorSearch)
  )

  const generatePDF = () => {
    const doc = new jsPDF()
    let y = 20
    doc.setFontSize(18); doc.setFont('helvetica', 'bold')
    doc.text('EA MURUNTOV - Smena Hisoboti', 105, y, { align: 'center' }); y += 10
    doc.setFontSize(10); doc.setFont('helvetica', 'normal')
    doc.text(`Sana: ${new Date().toLocaleDateString('ru-RU')}`, 105, y, { align: 'center' }); y += 8
    doc.setLineWidth(0.5); doc.line(20, y, 190, y); y += 8

    doc.setFontSize(12); doc.setFont('helvetica', 'bold')
    doc.text('Moliyaviy ko\'rsatkichlar:', 20, y); y += 8
    doc.setFontSize(10); doc.setFont('helvetica', 'normal')
    const stats = [
      ['Jami buyurtmalar:', `${shiftOrders.length} ta`],
      ['Jami narx:', `${fmt(totalRev)} som`],
      ['Haqiqiy tushum:', `${fmt(actualRev)} som`],
      ['Naqd:', `${fmt(cashRev)} som`],
      ['Click:', `${fmt(clickRev)} som`],
      ['Karta:', `${fmt(cardRev)} som`],
      ['Qarz:', `${fmt(debtRev)} som`],
      ['Ichki iste\'mol:', `${ichkiOrders.length} ta`],
    ]
    stats.forEach(([l, v]) => { doc.text(l, 25, y); doc.text(v, 140, y); y += 7 })

    if (moslashuvOrders.length > 0) {
      y += 4; doc.line(20, y, 190, y); y += 8
      doc.setFontSize(11); doc.setFont('helvetica', 'bold')
      doc.text('Moslashuvchan to\'lovlar:', 20, y); y += 7
      doc.setFontSize(9); doc.setFont('helvetica', 'normal')
      moslashuvOrders.forEach(o => {
        if (y > 265) { doc.addPage(); y = 20 }
        doc.text(`${fmt(o.total)} → ${fmt(o.actual_paid || o.total)} so'm`, 25, y)
        doc.text(o.payment_note || '', 90, y); y += 6
      })
    }

    y += 4; doc.line(20, y, 190, y); y += 8
    doc.setFontSize(12); doc.setFont('helvetica', 'bold')
    doc.text('Mahsulot hisobi:', 20, y); y += 8
    doc.setFontSize(9); doc.setFont('helvetica', 'normal')
    doc.text('Mahsulot', 20, y); doc.text('Boshl.', 90, y); doc.text('Kirim', 110, y)
    doc.text('Sotildi', 130, y); doc.text('Chiqim', 150, y); doc.text('Qoldiq', 170, y); y += 6
    soldByProduct.forEach(p => {
      if (y > 270) { doc.addPage(); y = 20 }
      doc.text(p.name.slice(0, 30), 20, y)
      doc.text(String(p.initial), 92, y); doc.text(String(p.stockIn), 112, y)
      doc.text(String(p.sold), 132, y); doc.text(String(p.writeOff), 152, y)
      doc.text(String(p.remaining), 172, y); y += 6
    })

    doc.setFontSize(8); doc.setTextColor(150)
    doc.text('Zarafshon Dasturchilari | EA Muruntov POS', 105, 285, { align: 'center' })
    doc.save(`ea-muruntov-${new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')}.pdf`)
    showToast('✅ PDF yuklab olindi!')
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'hisobot', label: 'Hisobot', icon: <BarChart3 size={20}/> },
    { id: 'tarix', label: 'Tarix', icon: <Clock size={20}/> },
    { id: 'qarzdorlar', label: 'Qarzlar', icon: <Search size={20}/> },
    { id: 'mahsulot', label: 'Menyu', icon: <UtensilsCrossed size={20}/> },
    { id: 'xodim', label: 'Xodim', icon: <Users size={20}/> },
  ]

  return (
    <div className="min-h-screen bg-[#F5F3EE] pb-20">

      {/* TOPBAR */}
      <div className="bg-[#1C1407] px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div>
          <div className="text-[#F5C842] font-black tracking-widest text-sm">EA MURUNTOV</div>
          <div className="text-gray-500 text-xs">{user?.name} · Rahbar</div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1 rounded-full text-xs font-bold ${shift?.is_open ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
            {shift?.is_open ? '● Ochiq' : '○ Yopiq'}
          </div>
          <button onClick={() => { localStorage.removeItem('pos_user'); router.push('/') }}
            className="border border-gray-600 text-gray-400 rounded-lg p-2">
            <LogOut size={14}/>
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 pb-2 max-w-2xl mx-auto">

        {/* ===== HISOBOT ===== */}
        {activeTab === 'hisobot' && (
          <div className="space-y-3">

            {shift && (
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="font-black text-sm mb-2">📋 Smena</div>
                <div className="grid grid-cols-2 gap-y-1 text-sm">
                  <span className="text-gray-400">Holat:</span>
                  <span className={`font-bold ${shift.is_open ? 'text-green-600' : 'text-gray-500'}`}>
                    {shift.is_open ? '● Ochiq' : '○ Yopiq'}
                  </span>
                  <span className="text-gray-400">Kim ochdi:</span>
                  <span className="font-bold">{shift.opened_by ? workerName(shift.opened_by) : '—'}</span>
                  <span className="text-gray-400">Soat:</span>
                  <span className="font-bold">{new Date(shift.opened_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</span>
                  {shift.closed_at && <>
                    <span className="text-gray-400">Kim yopdi:</span>
                    <span className="font-bold">{shift.closed_by ? workerName(shift.closed_by) : '—'}</span>
                    <span className="text-gray-400">Yopildi:</span>
                    <span className="font-bold">{new Date(shift.closed_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</span>
                  </>}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Jami tushum', val: fmt(actualRev) + ' so\'m', color: 'text-[#C8860A]', sub: totalRev !== actualRev ? `Narx: ${fmt(totalRev)}` : undefined },
                { label: 'Buyurtmalar', val: shiftOrders.length + ' ta', color: 'text-[#1A1208]' },
                { label: 'Naqd', val: fmt(cashRev) + ' so\'m', color: 'text-[#1E7B47]' },
                { label: 'Click', val: fmt(clickRev) + ' so\'m', color: 'text-purple-600' },
                { label: 'Karta', val: fmt(cardRev) + ' so\'m', color: 'text-blue-600' },
                { label: 'Qarz', val: fmt(debtRev) + ' so\'m', color: 'text-[#B83232]' },
                { label: 'Ichki', val: ichkiOrders.length + ' ta', color: 'text-orange-500' },
                { label: 'Faol qarzlar', val: activeDebts.length + ' ta', color: 'text-[#B83232]' },
              ].map((s, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="text-xs text-gray-400 font-bold mb-1">{s.label}</div>
                  <div className={`font-black text-lg ${s.color}`}>{s.val}</div>
                  {s.sub && <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>}
                </div>
              ))}
            </div>

            {moslashuvOrders.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 font-black text-sm">💱 Moslashuvchan to'lovlar</div>
                {moslashuvOrders.map(o => (
                  <div key={o.id} className="px-4 py-3 border-b border-gray-50 last:border-0">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Narx: {fmt(o.total)} so'm</span>
                      <span className="font-bold text-[#C8860A]">To'landi: {fmt(o.actual_paid || o.total)} so'm</span>
                    </div>
                    {o.payment_note && <div className="text-xs text-gray-400 mt-0.5">{o.payment_note}</div>}
                  </div>
                ))}
              </div>
            )}

            {soldByProduct.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 font-black text-sm">📦 Mahsulot hisobi</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-3 py-2 font-bold text-gray-400">Mahsulot</th>
                        <th className="text-center px-1 py-2 font-bold text-gray-400">B.</th>
                        <th className="text-center px-1 py-2 font-bold text-gray-400">K.</th>
                        <th className="text-center px-1 py-2 font-bold text-gray-400">S.</th>
                        <th className="text-center px-1 py-2 font-bold text-gray-400">Ch.</th>
                        <th className="text-center px-1 py-2 font-bold text-gray-400">Q.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {soldByProduct.map(p => (
                        <tr key={p.id}>
                          <td className="px-3 py-2 font-bold text-xs">{p.name}</td>
                          <td className="px-1 py-2 text-center text-gray-500">{p.initial}</td>
                          <td className="px-1 py-2 text-center text-green-600 font-bold">{p.stockIn > 0 ? `+${p.stockIn}` : '—'}</td>
                          <td className="px-1 py-2 text-center text-[#C8860A] font-bold">{p.sold > 0 ? p.sold : '—'}</td>
                          <td className="px-1 py-2 text-center text-red-500 font-bold">{p.writeOff > 0 ? p.writeOff : '—'}</td>
                          <td className={`px-1 py-2 text-center font-black ${p.remaining < 0 ? 'text-red-600' : 'text-[#1A1208]'}`}>{p.remaining}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {oshHissa > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 font-black text-sm">🍚 Osh qoldig'i</div>
                <div className="grid grid-cols-3 gap-2 p-4">
                  <div className="text-center">
                    <div className="text-xl font-black text-[#C8860A]">{oshHissa}</div>
                    <div className="text-xs text-gray-400 mt-0.5">Hissa</div>
                  </div>
                  <div className="text-center border-x border-gray-100">
                    <div className="text-xl font-black text-green-600">{Math.floor(oshHissa / 3)}</div>
                    <div className="text-xs text-gray-400 mt-0.5">Butun</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-black text-blue-600">{Math.floor(oshHissa / 2)}</div>
                    <div className="text-xs text-gray-400 mt-0.5">Yarim</div>
                  </div>
                </div>
              </div>
            )}

            {ichkiOrders.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 font-black text-sm text-orange-500">🍽 Ichki iste'mol</div>
                {ichkiOrders.map(o => {
                  const items = orderItems.filter(oi => oi.order_id === o.id)
                  return (
                    <div key={o.id} className="px-4 py-3 border-b border-gray-50 last:border-0">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-bold">{workerName(o.worker_id)}</span>
                        <span className="text-gray-400">{new Date(o.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {items.map(i => `${productName(i.product_id)} × ${i.qty}`).join(', ')}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {writeOffs.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 font-black text-sm text-[#B83232] flex items-center gap-2">
                  <PackageMinus size={14}/> Chiqimlar
                </div>
                {writeOffs.map(w => (
                  <div key={w.id} className="px-4 py-3 border-b border-gray-50 last:border-0">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="font-bold">{productName(w.product_id)} — {w.qty} ta</span>
                      <span className="text-gray-400">{workerName(w.worker_id)}</span>
                    </div>
                    <div className="text-xs text-gray-500 italic">"{w.reason}"</div>
                  </div>
                ))}
              </div>
            )}

            {stockIns.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 font-black text-sm text-[#1E7B47] flex items-center gap-2">
                  <PackagePlus size={14}/> Kirimlar
                </div>
                {stockIns.map(si => (
                  <div key={si.id} className="flex items-center px-4 py-3 border-b border-gray-50 last:border-0">
                    <div className="flex-1 text-xs">
                      <div className="font-bold">{productName(si.product_id)} — {si.qty} ta</div>
                      <div className="text-gray-400">{workerName(si.worker_id)}</div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(si.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeDebts.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 font-black text-sm text-[#B83232]">Faol qarzlar</div>
                {activeDebts.map(o => (
                  <div key={o.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                    <div className="flex-1 text-sm">
                      <div className="font-bold">{o.debtor_name || "Noma'lum"}</div>
                      <div className="text-xs text-gray-400">{fmt(o.total)} so'm</div>
                    </div>
                    <button onClick={() => payDebt(o.id)}
                      className="px-3 py-1.5 bg-[#1E7B47] text-white rounded-xl text-xs font-black">
                      To'landi
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button onClick={generatePDF}
              className="w-full py-4 bg-[#1A1208] text-[#F5C842] rounded-2xl font-black text-sm">
              📄 PDF hisobot yuklab olish
            </button>
          </div>
        )}

        {/* ===== SMENA TARIXI ===== */}
        {activeTab === 'tarix' && (
          <div className="space-y-3">
            <div className="text-xs text-gray-400 font-bold px-1">Oxirgi 30 ta smena</div>
            {shiftHistory.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-300">
                <div className="text-3xl mb-2">📋</div>
                <div className="text-sm font-bold">Smena tarixi yo'q</div>
              </div>
            ) : shiftHistory.map(s => {
              const isSelected = selectedShiftId === s.id
              const report = shiftReports[s.id] || []
              const sana = new Date(s.opened_at).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: '2-digit' })
              const vaqt = new Date(s.opened_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
              const yopildi = s.closed_at
                ? new Date(s.closed_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
                : null

              return (
                <div key={s.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div
                    className="px-4 py-3 cursor-pointer hover:bg-gray-50 transition-all"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedShiftId(null)
                      } else {
                        setSelectedShiftId(s.id)
                        loadShiftReport(s.id)
                      }
                    }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.is_open ? 'bg-green-500' : 'bg-gray-300'}`}/>
                        <span className="font-black text-sm">{sana}</span>
                        <span className="text-gray-400 text-xs">{vaqt}{yopildi ? ` — ${yopildi}` : ''}</span>
                      </div>
                      <span className="text-xs text-gray-400">{isSelected ? '▲' : '▼'}</span>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span className="text-xs text-gray-500">{s.order_count} buyurtma</span>
                      <span className="font-black text-sm text-[#C8860A]">{fmt(s.total_revenue)} so'm</span>
                      {s.is_open && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">Ochiq</span>}
                    </div>
                    <div className="flex gap-3 ml-4 mt-1 text-xs text-gray-400">
                      {s.opened_by_name && <span>Kim ochdi: {s.opened_by_name}</span>}
                      {s.closed_by_name && <span>Kim yopdi: {s.closed_by_name}</span>}
                    </div>
                  </div>

                  {isSelected && (
                    <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: 'Jami tushum', val: fmt(s.total_revenue) + ' so\'m', color: 'text-[#C8860A]' },
                          { label: 'Buyurtmalar', val: s.order_count + ' ta', color: 'text-gray-700' },
                          { label: 'Naqd', val: fmt(s.cash_revenue) + ' so\'m', color: 'text-green-600' },
                          { label: 'Click', val: fmt(s.click_revenue) + ' so\'m', color: 'text-purple-600' },
                          { label: 'Karta', val: fmt(s.card_revenue) + ' so\'m', color: 'text-blue-600' },
                          { label: 'Qarz', val: fmt(s.debt_revenue) + ' so\'m', color: 'text-red-500' },
                          { label: 'Ichki', val: s.ichki_count + ' ta', color: 'text-orange-500' },
                        ].map((item, i) => (
                          <div key={i} className="bg-white rounded-xl p-2.5">
                            <div className="text-xs text-gray-400 mb-0.5">{item.label}</div>
                            <div className={`font-black text-sm ${item.color}`}>{item.val}</div>
                          </div>
                        ))}
                      </div>

                      {report.length > 0 ? (
                        <div className="bg-white rounded-xl overflow-hidden">
                          <div className="px-3 py-2 border-b border-gray-100 font-black text-xs text-gray-500">
                            📦 Mahsulot hisoboti
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-50">
                                  <th className="text-left px-3 py-1.5 font-bold text-gray-400">Mahsulot</th>
                                  <th className="text-center px-1 py-1.5 font-bold text-gray-400">Tizim</th>
                                  <th className="text-center px-1 py-1.5 font-bold text-gray-400">Haqiqiy</th>
                                  <th className="text-center px-1 py-1.5 font-bold text-gray-400">Farq</th>
                                </tr>
                              </thead>
                              <tbody>
                                {report.map((r: any) => (
                                  <tr key={r.id} className="border-t border-gray-50">
                                    <td className="px-3 py-1.5 font-bold">{r.products?.name || '—'}</td>
                                    <td className="px-1 py-1.5 text-center text-gray-500">{r.system_qty}</td>
                                    <td className="px-1 py-1.5 text-center font-bold">{r.actual_qty}</td>
                                    <td className={`px-1 py-1.5 text-center font-black ${r.diff < 0 ? 'text-red-500' : r.diff > 0 ? 'text-green-600' : 'text-gray-300'}`}>
                                      {r.diff === 0 ? '—' : (r.diff > 0 ? '+' : '') + r.diff}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {report.filter((r: any) => r.diff !== 0 && r.note).length > 0 && (
                            <div className="px-3 py-2 border-t border-gray-100">
                              <div className="text-xs font-bold text-red-500 mb-1">⚠ Farqlar izohi:</div>
                              {report.filter((r: any) => r.diff !== 0 && r.note).map((r: any) => (
                                <div key={r.id} className="text-xs text-gray-500 mb-0.5">
                                  <span className="font-bold">{r.products?.name}:</span> {r.note}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-white rounded-xl p-3 text-center text-xs text-gray-400">
                          Mahsulot hisoboti yo'q
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ===== QARZDORLAR ===== */}
        {activeTab === 'qarzdorlar' && (
          <div className="space-y-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-3 text-gray-400"/>
              <input type="text" placeholder="Ism yoki telefon..."
                value={debtorSearch} onChange={e => setDebtorSearch(e.target.value)}
                className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#C8860A] bg-white"/>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {filteredDebtors.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-300">
                  <div className="text-3xl mb-2">🔍</div>
                  <div className="text-sm font-bold">Topilmadi</div>
                </div>
              ) : filteredDebtors.map(d => (
                <DebtorCard key={d.id} debtor={d} products={products}
                  onUpdate={(id, newDebt) => {
                    setDebtors(prev => prev.map(x => x.id === id ? { ...x, total_debt: newDebt } : x))
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ===== MENYU ===== */}
        {activeTab === 'mahsulot' && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="font-black text-sm mb-3">Kategoriya qo'shish</div>
              <div className="flex gap-2">
                <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                  placeholder="Kategoriya nomi"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C8860A]"/>
                <button onClick={addCategory}
                  className="px-4 py-2.5 bg-[#C8860A] text-[#1A1208] rounded-xl font-black text-sm">+</button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {categories.map(c => (
                  <div key={c.id} className="flex items-center gap-1 bg-[#FFF8E7] border border-[#F5C842] rounded-full px-3 py-1">
                    <span className="text-sm font-bold">{c.name}</span>
                    <button onClick={() => deleteCategory(c.id)} className="text-gray-400 hover:text-red-500 text-xs ml-1">✕</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="font-black text-sm mb-3">Mahsulot qo'shish</div>
              <div className="space-y-2">
                <input value={newProdName} onChange={e => setNewProdName(e.target.value)}
                  placeholder="Mahsulot nomi"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C8860A]"/>
                <div className="flex gap-2">
                  <input value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)}
                    placeholder="Narxi" type="number"
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C8860A]"/>
                  <select value={newProdCat} onChange={e => setNewProdCat(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C8860A] bg-white">
                    <option value="">Kategoriya</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <button onClick={addProduct}
                  className="w-full py-2.5 bg-[#C8860A] text-[#1A1208] rounded-xl font-black text-sm">
                  ＋ Qo'shish
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 font-black text-sm">
                Mahsulotlar ({products.length} ta)
              </div>
              {products.map(p => {
                const cat = categories.find(c => c.id === p.category_id)
                return (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{p.name}</div>
                      <div className="text-xs text-gray-400">{cat?.name} · {fmt(p.price)} so'm</div>
                    </div>
                    <button onClick={() => toggleAvail(p)}
                      className={`px-2 py-1 rounded-full text-xs font-bold flex-shrink-0 ${p.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {p.is_available ? 'Bor' : "Yo'q"}
                    </button>
                    <button onClick={() => deleteProduct(p.id)} className="text-gray-300 hover:text-red-500 flex-shrink-0">✕</button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ===== XODIMLAR ===== */}
        {activeTab === 'xodim' && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="font-black text-sm mb-3">Xodim qo'shish</div>
              <div className="space-y-2">
                <input value={newWorkerName} onChange={e => setNewWorkerName(e.target.value)}
                  placeholder="Xodim ismi"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C8860A]"/>
                <input value={newWorkerPin} onChange={e => setNewWorkerPin(e.target.value.slice(0, 4))}
                  placeholder="4 xonali PIN" type="number"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C8860A]"/>
                <button onClick={addWorker}
                  className="w-full py-2.5 bg-[#C8860A] text-[#1A1208] rounded-xl font-black text-sm">
                  ＋ Xodim qo'shish
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 font-black text-sm">
                Xodimlar ({workers.length} ta)
              </div>
              {workers.map(w => (
                <div key={w.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                  <div className="w-10 h-10 rounded-full bg-[#FFF8E7] border-2 border-[#F5C842] flex items-center justify-center font-black text-[#C8860A] text-sm flex-shrink-0">
                    {w.name[0]}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sm">{w.name}</div>
                    <div className="text-xs text-gray-400">PIN: {w.pin}</div>
                  </div>
                  <button onClick={() => deleteWorker(w.id)} className="text-gray-300 hover:text-red-500">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#1C1407] border-t border-[#3D2E10] z-40">
        <div className="flex max-w-2xl mx-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-all ${activeTab === t.id ? 'text-[#F5C842]' : 'text-gray-600'}`}>
              {t.icon}
              <span className="text-[10px] font-bold">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-[#1A1208] text-[#F5C842] px-5 py-2.5 rounded-full text-sm font-bold z-50 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}