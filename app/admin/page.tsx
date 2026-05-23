'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import jsPDF from 'jspdf'
import { Clock, UtensilsCrossed, Users, BarChart3, LogOut, PackagePlus, PackageMinus } from 'lucide-react'

type User = { id: string; name: string; role: string }
type Category = { id: string; name: string; order_num: number }
type Product = { id: string; name: string; price: number; category_id: string; is_available: boolean }
type Shift = { id: string; is_open: boolean; opened_at: string; closed_at?: string; opened_by?: string; closed_by?: string }
type ShiftStock = { product_id: string; initial_qty: number }
type Order = { id: string; total: number; pay_type: string; debt_paid: boolean; debtor_name: string | null; worker_id: string; created_at: string }
type OrderItem = { order_id: string; product_id: string; qty: number; price: number }
type Worker = { id: string; name: string; pin: string; role: string }
type WriteOff = { id: string; product_id: string; qty: number; reason: string; worker_id: string; created_at: string }
type StockIn = { id: string; product_id: string; qty: number; worker_id: string; created_at: string }

type Tab = 'smena' | 'mahsulot' | 'xodim' | 'hisobot'

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('hisobot')

  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [shift, setShift] = useState<Shift | null>(null)
  const [stocks, setStocks] = useState<ShiftStock[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [writeOffs, setWriteOffs] = useState<WriteOff[]>([])
  const [stockIns, setStockIns] = useState<StockIn[]>([])

  const [newCatName, setNewCatName] = useState('')
  const [newProdName, setNewProdName] = useState('')
  const [newProdPrice, setNewProdPrice] = useState('')
  const [newProdCat, setNewProdCat] = useState('')
  const [newWorkerName, setNewWorkerName] = useState('')
  const [newWorkerPin, setNewWorkerPin] = useState('')

  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(false)

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
      { data: cats },
      { data: prods },
      { data: shifts },
      { data: ords },
      { data: oi },
      { data: wrks },
      { data: wo },
      { data: si },
    ] = await Promise.all([
      supabase.from('categories').select('*').order('order_num'),
      supabase.from('products').select('*').order('created_at'),
      supabase.from('shifts').select('*').order('opened_at', { ascending: false }).limit(1).single(),
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('order_items').select('*'),
      supabase.from('users').select('*').eq('role', 'worker'),
      supabase.from('write_offs').select('*').order('created_at', { ascending: false }),
      supabase.from('stock_ins').select('*').order('created_at', { ascending: false }),
    ])
    setCategories(cats || [])
    setProducts(prods || [])
    setShift(shifts || null)
    setOrders(ords || [])
    setOrderItems(oi || [])
    setWorkers(wrks || [])
    setWriteOffs(wo || [])
    setStockIns(si || [])

    if (shifts?.id) {
      const { data: st } = await supabase.from('shift_stock').select('*').eq('shift_id', shifts.id)
      setStocks(st || [])
    }
  }

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }
  const fmt = (n: number) => n.toLocaleString('uz-UZ')

  // Yordamchi funksiyalar
  const workerName = (id: string) => workers.find(w => w.id === id)?.name || 'Noma\'lum'
  const productName = (id: string) => products.find(p => p.id === id)?.name || 'Noma\'lum'

  // Smena
  const toggleAvail = async (p: Product) => {
    await supabase.from('products').update({ is_available: !p.is_available }).eq('id', p.id)
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_available: !x.is_available } : x))
  }

  const updateStock = async (productId: string, qty: number) => {
    if (!shift) return
    setStocks(prev => prev.map(s => s.product_id === productId ? { ...s, initial_qty: qty } : s))
    await supabase.from('shift_stock').update({ initial_qty: qty }).eq('shift_id', shift.id).eq('product_id', productId)
  }

  // Kategoriya
  const addCategory = async () => {
    if (!newCatName.trim()) return
    const { data } = await supabase.from('categories').insert({ name: newCatName.trim(), order_num: categories.length + 1 }).select().single()
    if (data) { setCategories(p => [...p, data]); setNewCatName(''); showToast('✅ Kategoriya qo\'shildi!') }
  }

  const deleteCategory = async (id: string) => {
    await supabase.from('categories').delete().eq('id', id)
    setCategories(p => p.filter(c => c.id !== id))
  }

  // Mahsulot
  const addProduct = async () => {
    if (!newProdName.trim() || !newProdPrice || !newProdCat) return
    const { data } = await supabase.from('products').insert({ name: newProdName.trim(), price: parseInt(newProdPrice), category_id: newProdCat, is_available: true }).select().single()
    if (data) { setProducts(p => [...p, data]); setNewProdName(''); setNewProdPrice(''); setNewProdCat(''); showToast('✅ Mahsulot qo\'shildi!') }
  }

  const deleteProduct = async (id: string) => {
    await supabase.from('products').delete().eq('id', id)
    setProducts(p => p.filter(x => x.id !== id))
  }

  // Xodim
  const addWorker = async () => {
    if (!newWorkerName.trim() || newWorkerPin.length !== 4) return
    const { data } = await supabase.from('users').insert({ name: newWorkerName.trim(), pin: newWorkerPin, role: 'worker' }).select().single()
    if (data) { setWorkers(p => [...p, data]); setNewWorkerName(''); setNewWorkerPin(''); showToast('✅ Xodim qo\'shildi!') }
  }

  const deleteWorker = async (id: string) => {
    await supabase.from('users').delete().eq('id', id)
    setWorkers(p => p.filter(x => x.id !== id))
  }

  // Hisobot hisob-kitobi
  const shiftOrders = shift ? orders.filter(o => {
    const oDate = new Date(o.created_at)
    const sDate = new Date(shift.opened_at)
    return oDate >= sDate
  }) : orders

  const totalRev = shiftOrders.filter(o => o.pay_type !== 'ichki').reduce((s, o) => s + o.total, 0)
  const cashRev = shiftOrders.reduce((s, o) => s + (o.pay_type === 'naqd' ? o.total : 0), 0)
  const cardRev = shiftOrders.reduce((s, o) => s + (o.pay_type === 'karta' ? o.total : 0), 0)
  const clickRev = shiftOrders.reduce((s, o) => s + (o.pay_type === 'click' ? o.total : 0), 0)
  const debtRev = shiftOrders.reduce((s, o) => s + (o.pay_type === 'qarz' ? o.total : 0), 0)
  const ichkiOrders = shiftOrders.filter(o => o.pay_type === 'ichki')
  const activeDebts = shiftOrders.filter(o => o.pay_type === 'qarz' && !o.debt_paid)

  // Har mahsulotdan nechta sotildi
  const soldByProduct = products.map(p => {
    const shiftOrderIds = shiftOrders.map(o => o.id)
    const sold = orderItems
      .filter(oi => oi.product_id === p.id && shiftOrderIds.includes(oi.order_id))
      .reduce((s, oi) => s + oi.qty, 0)
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

  // PDF
  const generatePDF = () => {
    const doc = new jsPDF()
    let y = 20

    doc.setFontSize(18); doc.setFont('helvetica', 'bold')
    doc.text('EA MURUNTOV - Smena Hisoboti', 105, y, { align: 'center' }); y += 10

    doc.setFontSize(10); doc.setFont('helvetica', 'normal')
    doc.text(`Sana: ${new Date().toLocaleDateString('ru-RU')}`, 105, y, { align: 'center' }); y += 6
    if (shift) {
      doc.text(`Smena boshlangan: ${new Date(shift.opened_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`, 105, y, { align: 'center' })
      y += 6
      if (shift.opened_by) { doc.text(`Kim ochdi: ${workerName(shift.opened_by)}`, 105, y, { align: 'center' }); y += 6 }
    }

    doc.setLineWidth(0.5); doc.line(20, y, 190, y); y += 8

    // Statistika
    doc.setFontSize(12); doc.setFont('helvetica', 'bold')
    doc.text('Moliyaviy ko\'rsatkichlar:', 20, y); y += 8
    doc.setFontSize(10); doc.setFont('helvetica', 'normal')
    const stats = [
      ['Jami buyurtmalar:', `${shiftOrders.length} ta`],
      ['Jami tushum:', `${fmt(totalRev)} som`],
      ['Naqd:', `${fmt(cashRev)} som`],
      ['Click:', `${fmt(clickRev)} som`],
      ['Karta:', `${fmt(cardRev)} som`],
      ['Qarz:', `${fmt(debtRev)} som`],
      ['Ichki iste\'mol:', `${ichkiOrders.length} ta buyurtma`],
    ]
    stats.forEach(([l, v]) => { doc.text(l, 25, y); doc.text(v, 140, y); y += 7 })

    y += 4; doc.line(20, y, 190, y); y += 8

    // Mahsulot hisobi
    doc.setFontSize(12); doc.setFont('helvetica', 'bold')
    doc.text('Mahsulot hisobi:', 20, y); y += 8
    doc.setFontSize(9); doc.setFont('helvetica', 'normal')
    doc.text('Mahsulot', 20, y); doc.text('Boshl.', 90, y); doc.text('Kirim', 110, y)
    doc.text('Sotildi', 130, y); doc.text('Chiqim', 150, y); doc.text('Qoldiq', 170, y); y += 6

    soldByProduct.forEach(p => {
      if (y > 270) { doc.addPage(); y = 20 }
      doc.text(p.name.slice(0, 30), 20, y)
      doc.text(String(p.initial), 90, y)
      doc.text(String(p.stockIn), 110, y)
      doc.text(String(p.sold), 130, y)
      doc.text(String(p.writeOff), 150, y)
      doc.text(String(p.remaining), 170, y)
      y += 6
    })

    // Chiqimlar
    if (writeOffs.length > 0) {
      y += 4; doc.line(20, y, 190, y); y += 8
      doc.setFontSize(12); doc.setFont('helvetica', 'bold')
      doc.text('Chiqimlar:', 20, y); y += 8
      doc.setFontSize(9); doc.setFont('helvetica', 'normal')
      writeOffs.slice(0, 10).forEach(w => {
        if (y > 270) { doc.addPage(); y = 20 }
        doc.text(`${productName(w.product_id)} — ${w.qty} ta`, 25, y)
        doc.text(`${workerName(w.worker_id)}: ${w.reason}`, 100, y)
        y += 6
      })
    }

    // Kirimlar
    if (stockIns.length > 0) {
      y += 4; doc.line(20, y, 190, y); y += 8
      doc.setFontSize(12); doc.setFont('helvetica', 'bold')
      doc.text('Kirimlar:', 20, y); y += 8
      doc.setFontSize(9); doc.setFont('helvetica', 'normal')
      stockIns.slice(0, 10).forEach(si => {
        if (y > 270) { doc.addPage(); y = 20 }
        doc.text(`${productName(si.product_id)} — ${si.qty} ta`, 25, y)
        doc.text(`Kim: ${workerName(si.worker_id)}`, 120, y)
        y += 6
      })
    }

    // Footer
    doc.setFontSize(8); doc.setTextColor(150)
    doc.text('Zarafshon Dasturchilari | EA Muruntov POS', 105, 285, { align: 'center' })

    doc.save(`ea-muruntov-${new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')}.pdf`)
    showToast('✅ PDF yuklab olindi!')
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'hisobot', label: 'Hisobot', icon: <BarChart3 size={16}/> },
    { id: 'smena', label: 'Smena', icon: <Clock size={16}/> },
    { id: 'mahsulot', label: 'Menyu', icon: <UtensilsCrossed size={16}/> },
    { id: 'xodim', label: 'Xodimlar', icon: <Users size={16}/> },
  ]

  return (
    <div className="min-h-screen bg-[#F5F3EE]">

      {/* TOPBAR */}
      <div className="bg-[#1C1407] px-6 py-3 flex items-center justify-between sticky top-0 z-40">
        <div>
          <div className="text-[#F5C842] font-black tracking-widest text-base">EA MURUNTOV</div>
          <div className="text-gray-500 text-xs mt-0.5">{user?.name} · Rahbar</div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full text-xs font-bold ${shift?.is_open ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
            {shift?.is_open ? '● Smena ochiq' : '○ Smena yopiq'}
          </div>
          <button onClick={() => { localStorage.removeItem('pos_user'); router.push('/') }}
            className="border border-gray-600 text-gray-400 rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5">
            <LogOut size={14}/> Chiqish
          </button>
        </div>
      </div>

      {/* TABLAR */}
      <div className="bg-white border-b border-gray-200 px-4 flex gap-1 sticky top-[52px] z-30">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-5 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === t.id ? 'border-[#C8860A] text-[#C8860A]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="max-w-3xl mx-auto p-4">

        {/* ===== HISOBOT TAB ===== */}
        {activeTab === 'hisobot' && (
          <div className="space-y-4">

            {/* Smena ma'lumoti */}
            {shift && (
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="font-black text-base mb-3">📋 Smena ma'lumoti</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-400">Holat:</div>
                  <div className={`font-bold ${shift.is_open ? 'text-green-600' : 'text-gray-500'}`}>
                    {shift.is_open ? '● Ochiq' : '○ Yopiq'}
                  </div>
                  <div className="text-gray-400">Ochdi:</div>
                  <div className="font-bold">{shift.opened_by ? workerName(shift.opened_by) : '—'}</div>
                  <div className="text-gray-400">Ochildi:</div>
                  <div className="font-bold">{new Date(shift.opened_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</div>
                  {shift.closed_at && <>
                    <div className="text-gray-400">Yopdi:</div>
                    <div className="font-bold">{shift.closed_by ? workerName(shift.closed_by) : '—'}</div>
                    <div className="text-gray-400">Yopildi:</div>
                    <div className="font-bold">{new Date(shift.closed_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</div>
                  </>}
                </div>
              </div>
            )}

            {/* Moliyaviy statistika */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Jami tushum', val: fmt(totalRev) + ' so\'m', color: 'text-[#C8860A]' },
                { label: 'Buyurtmalar', val: shiftOrders.length + ' ta', color: 'text-[#1A1208]' },
                { label: 'Naqd', val: fmt(cashRev) + ' so\'m', color: 'text-[#1E7B47]' },
                { label: 'Click', val: fmt(clickRev) + ' so\'m', color: 'text-purple-600' },
                { label: 'Karta', val: fmt(cardRev) + ' so\'m', color: 'text-blue-600' },
                { label: 'Qarz', val: fmt(debtRev) + ' so\'m', color: 'text-[#B83232]' },
                { label: 'Ichki iste\'mol', val: ichkiOrders.length + ' ta', color: 'text-orange-500' },
                { label: 'Faol qarzlar', val: activeDebts.length + ' ta', color: 'text-[#B83232]' },
              ].map((s, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="text-xs text-gray-400 font-bold mb-1">{s.label}</div>
                  <div className={`font-black text-lg ${s.color}`}>{s.val}</div>
                </div>
              ))}
            </div>

            {/* Mahsulot hisobi */}
            {soldByProduct.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 font-black text-base">📦 Mahsulot hisobi</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-4 py-2 font-bold text-gray-400 text-xs">Mahsulot</th>
                        <th className="text-center px-2 py-2 font-bold text-gray-400 text-xs">Boshl.</th>
                        <th className="text-center px-2 py-2 font-bold text-gray-400 text-xs">Kirim</th>
                        <th className="text-center px-2 py-2 font-bold text-gray-400 text-xs">Sotildi</th>
                        <th className="text-center px-2 py-2 font-bold text-gray-400 text-xs">Chiqim</th>
                        <th className="text-center px-2 py-2 font-bold text-gray-400 text-xs">Qoldiq</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {soldByProduct.map(p => (
                        <tr key={p.id}>
                          <td className="px-4 py-2 font-bold text-sm">{p.name}</td>
                          <td className="px-2 py-2 text-center text-gray-500">{p.initial}</td>
                          <td className="px-2 py-2 text-center text-green-600 font-bold">{p.stockIn > 0 ? `+${p.stockIn}` : '—'}</td>
                          <td className="px-2 py-2 text-center text-[#C8860A] font-bold">{p.sold > 0 ? p.sold : '—'}</td>
                          <td className="px-2 py-2 text-center text-red-500 font-bold">{p.writeOff > 0 ? p.writeOff : '—'}</td>
                          <td className={`px-2 py-2 text-center font-black ${p.remaining < 0 ? 'text-red-600' : 'text-[#1A1208]'}`}>{p.remaining}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Ichki iste'mol */}
            {ichkiOrders.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 font-black text-base text-orange-500">🍽 Ichki iste'mol</div>
                <div className="divide-y divide-gray-50">
                  {ichkiOrders.map(o => {
                    const items = orderItems.filter(oi => oi.order_id === o.id)
                    return (
                      <div key={o.id} className="px-5 py-3">
                        <div className="flex justify-between items-center">
                          <div className="font-bold text-sm">{workerName(o.worker_id)}</div>
                          <div className="text-xs text-gray-400">{new Date(o.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {items.map(i => `${productName(i.product_id)} × ${i.qty}`).join(', ')}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Chiqimlar */}
            {writeOffs.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 font-black text-base text-[#B83232] flex items-center gap-2">
                  <PackageMinus size={16}/> Chiqimlar
                </div>
                <div className="divide-y divide-gray-50">
                  {writeOffs.map(w => (
                    <div key={w.id} className="px-5 py-3">
                      <div className="flex justify-between items-center">
                        <div className="font-bold text-sm">{productName(w.product_id)} — {w.qty} ta</div>
                        <div className="text-xs text-gray-400">{workerName(w.worker_id)}</div>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 italic">"{w.reason}"</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Kirimlar */}
            {stockIns.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 font-black text-base text-[#1E7B47] flex items-center gap-2">
                  <PackagePlus size={16}/> Kirimlar
                </div>
                <div className="divide-y divide-gray-50">
                  {stockIns.map(si => (
                    <div key={si.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1">
                        <div className="font-bold text-sm">{productName(si.product_id)} — {si.qty} ta</div>
                        <div className="text-xs text-gray-400">{workerName(si.worker_id)}</div>
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(si.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Qarzdorlar */}
            {activeDebts.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 font-black text-base text-[#B83232]">Qarzdorlar</div>
                <div className="divide-y divide-gray-50">
                  {activeDebts.map(o => (
                    <div key={o.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1">
                        <div className="font-bold text-sm">{o.debtor_name || "Noma'lum"}</div>
                        <div className="text-xs text-gray-400">{fmt(o.total)} so'm</div>
                      </div>
                      <button onClick={() => payDebt(o.id)}
                        className="px-4 py-2 bg-[#1E7B47] text-white rounded-xl text-xs font-black">
                        To'landi
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PDF */}
            <button onClick={generatePDF}
              className="w-full py-4 bg-[#1A1208] text-[#F5C842] rounded-2xl font-black text-base hover:bg-[#2C200A] transition-all">
              📄 PDF hisobot yuklab olish
            </button>
          </div>
        )}

        {/* ===== SMENA TAB ===== */}
        {activeTab === 'smena' && (
          <div className="space-y-4">
            <div className={`rounded-2xl p-5 border-2 ${shift?.is_open ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="font-black text-lg mb-1">{shift?.is_open ? 'Smena ochiq' : 'Smena yopiq'}</div>
              <div className="text-sm text-gray-500">
                {shift ? `Boshlangan: ${new Date(shift.opened_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}` : 'Smena kassir tomonidan ochiladi'}
              </div>
            </div>

            {shift && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <div className="font-black text-base">Boshlang'ich miqdor</div>
                </div>
                <div className="divide-y divide-gray-50">
                  {products.map(p => {
                    const st = stocks.find(s => s.product_id === p.id)
                    return (
                      <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="flex-1">
                          <div className="font-bold text-sm">{p.name}</div>
                          <div className="text-xs text-gray-400">{fmt(p.price)} so'm</div>
                        </div>
                        <button onClick={() => toggleAvail(p)}
                          className={`px-3 py-1 rounded-full text-xs font-bold ${p.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {p.is_available ? 'Bor' : "Yo'q"}
                        </button>
                        <input type="number" min="0" value={st?.initial_qty || 0}
                          onChange={e => updateStock(p.id, parseInt(e.target.value) || 0)}
                          className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-center text-sm font-bold outline-none focus:border-[#C8860A]"/>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== MENYU TAB ===== */}
        {activeTab === 'mahsulot' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="font-black text-base mb-3">Kategoriya qo'shish</div>
              <div className="flex gap-2">
                <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Kategoriya nomi"
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#C8860A]"/>
                <button onClick={addCategory}
                  className="px-5 py-2.5 bg-[#C8860A] text-[#1A1208] rounded-xl font-black text-sm hover:bg-[#F5C842]">
                  Qo'shish
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {categories.map(c => (
                  <div key={c.id} className="flex items-center gap-1.5 bg-[#FFF8E7] border border-[#F5C842] rounded-full px-3 py-1">
                    <span className="text-sm font-bold">{c.name}</span>
                    <button onClick={() => deleteCategory(c.id)} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="font-black text-base mb-3">Mahsulot qo'shish</div>
              <div className="space-y-2">
                <input value={newProdName} onChange={e => setNewProdName(e.target.value)} placeholder="Mahsulot nomi"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#C8860A]"/>
                <div className="flex gap-2">
                  <input value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)} placeholder="Narxi" type="number"
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#C8860A]"/>
                  <select value={newProdCat} onChange={e => setNewProdCat(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#C8860A] bg-white">
                    <option value="">Kategoriya</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <button onClick={addProduct}
                  className="w-full py-2.5 bg-[#C8860A] text-[#1A1208] rounded-xl font-black text-sm hover:bg-[#F5C842]">
                  ＋ Mahsulot qo'shish
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 font-black text-base">Mahsulotlar ({products.length} ta)</div>
              <div className="divide-y divide-gray-50">
                {products.map(p => {
                  const cat = categories.find(c => c.id === p.category_id)
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1">
                        <div className="font-bold text-sm">{p.name}</div>
                        <div className="text-xs text-gray-400">{cat?.name} · {fmt(p.price)} so'm</div>
                      </div>
                      <button onClick={() => toggleAvail(p)}
                        className={`px-3 py-1 rounded-full text-xs font-bold ${p.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {p.is_available ? 'Bor' : "Yo'q"}
                      </button>
                      <button onClick={() => deleteProduct(p.id)} className="text-gray-300 hover:text-red-500 text-lg">✕</button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ===== XODIMLAR TAB ===== */}
        {activeTab === 'xodim' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="font-black text-base mb-3">Xodim qo'shish</div>
              <div className="space-y-2">
                <input value={newWorkerName} onChange={e => setNewWorkerName(e.target.value)} placeholder="Xodim ismi"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#C8860A]"/>
                <input value={newWorkerPin} onChange={e => setNewWorkerPin(e.target.value.slice(0, 4))} placeholder="4 xonali PIN" type="number"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#C8860A]"/>
                <button onClick={addWorker}
                  className="w-full py-2.5 bg-[#C8860A] text-[#1A1208] rounded-xl font-black text-sm hover:bg-[#F5C842]">
                  ＋ Xodim qo'shish
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 font-black text-base">Xodimlar ({workers.length} ta)</div>
              <div className="divide-y divide-gray-50">
                {workers.map(w => (
                  <div key={w.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-10 h-10 rounded-full bg-[#FFF8E7] border-2 border-[#F5C842] flex items-center justify-center font-black text-[#C8860A] text-sm">
                      {w.name[0]}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-sm">{w.name}</div>
                      <div className="text-xs text-gray-400">PIN: {w.pin}</div>
                    </div>
                    <button onClick={() => deleteWorker(w.id)} className="text-gray-300 hover:text-red-500 text-lg">✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-[#1A1208] text-[#F5C842] px-5 py-2.5 rounded-full text-sm font-bold z-50 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}