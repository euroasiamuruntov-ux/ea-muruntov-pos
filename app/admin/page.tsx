'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import jsPDF from 'jspdf'

type User = { id: string; name: string; role: string }
type Category = { id: string; name: string; order_num: number }
type Product = { id: string; name: string; price: number; category_id: string; is_available: boolean }
type Shift = { id: string; is_open: boolean; opened_at: string }
type ShiftStock = { product_id: string; initial_qty: number }
type Order = { id: string; total: number; pay_type: string; debt_paid: boolean; debtor_name: string | null }
type Worker = { id: string; name: string; pin: string; role: string }

type Tab = 'smena' | 'mahsulot' | 'xodim' | 'hisobot'

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('smena')

  // Data
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [shift, setShift] = useState<Shift | null>(null)
  const [stocks, setStocks] = useState<ShiftStock[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])

  // Forms
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
      { data: wrks },
    ] = await Promise.all([
      supabase.from('categories').select('*').order('order_num'),
      supabase.from('products').select('*').order('created_at'),
      supabase.from('shifts').select('*').eq('is_open', true).single(),
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('users').select('*').eq('role', 'worker'),
    ])
    setCategories(cats || [])
    setProducts(prods || [])
    setShift(shifts || null)
    setOrders(ords || [])
    setWorkers(wrks || [])

    if (shifts?.id) {
      const { data: st } = await supabase
        .from('shift_stock')
        .select('*')
        .eq('shift_id', shifts.id)
      setStocks(st || [])
    }
  }

  const showToast = (msg: string) => {
    setToast(msg); setTimeout(() => setToast(''), 2500)
  }

  const fmt = (n: number) => n.toLocaleString('uz-UZ')

  // SMENA
  const openShift = async () => {
    setLoading(true)
    const u = JSON.parse(localStorage.getItem('pos_user') || '{}')
    const { data } = await supabase
      .from('shifts')
      .insert({ opened_by: u.id, is_open: true })
      .select().single()
    if (data) {
      // stock yozuvlarini yaratish
      const stockRows = products.map(p => ({
        shift_id: data.id,
        product_id: p.id,
        initial_qty: 0,
      }))
      await supabase.from('shift_stock').insert(stockRows)
      setShift(data)
      setStocks(stockRows)
      showToast('✅ Smena ochildi!')
    }
    setLoading(false)
  }

  const closeShift = async () => {
    if (!shift) return
    setLoading(true)
    await supabase.from('shifts')
      .update({ is_open: false, closed_at: new Date().toISOString() })
      .eq('id', shift.id)
    setShift(null)
    setStocks([])
    showToast('Smena yopildi')
    setLoading(false)
  }

  const updateStock = async (productId: string, qty: number) => {
    if (!shift) return
    setStocks(prev => prev.map(s =>
      s.product_id === productId ? { ...s, initial_qty: qty } : s
    ))
    await supabase.from('shift_stock')
      .update({ initial_qty: qty })
      .eq('shift_id', shift.id)
      .eq('product_id', productId)
  }

  const toggleAvail = async (p: Product) => {
    await supabase.from('products')
      .update({ is_available: !p.is_available })
      .eq('id', p.id)
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_available: !x.is_available } : x))
  }

  // KATEGORIYA
  const addCategory = async () => {
    if (!newCatName.trim()) return
    const { data } = await supabase.from('categories')
      .insert({ name: newCatName.trim(), order_num: categories.length + 1 })
      .select().single()
    if (data) { setCategories(p => [...p, data]); setNewCatName(''); showToast('✅ Kategoriya qo\'shildi!') }
  }

  const deleteCategory = async (id: string) => {
    await supabase.from('categories').delete().eq('id', id)
    setCategories(p => p.filter(c => c.id !== id))
    showToast('O\'chirildi')
  }

  // MAHSULOT
  const addProduct = async () => {
    if (!newProdName.trim() || !newProdPrice || !newProdCat) return
    const { data } = await supabase.from('products')
      .insert({ name: newProdName.trim(), price: parseInt(newProdPrice), category_id: newProdCat, is_available: true })
      .select().single()
    if (data) {
      setProducts(p => [...p, data])
      setNewProdName(''); setNewProdPrice(''); setNewProdCat('')
      showToast('✅ Mahsulot qo\'shildi!')
    }
  }

  const deleteProduct = async (id: string) => {
    await supabase.from('products').delete().eq('id', id)
    setProducts(p => p.filter(x => x.id !== id))
    showToast('O\'chirildi')
  }

  // XODIM
  const addWorker = async () => {
    if (!newWorkerName.trim() || newWorkerPin.length !== 4) return
    const { data } = await supabase.from('users')
      .insert({ name: newWorkerName.trim(), pin: newWorkerPin, role: 'worker' })
      .select().single()
    if (data) {
      setWorkers(p => [...p, data])
      setNewWorkerName(''); setNewWorkerPin('')
      showToast('✅ Xodim qo\'shildi!')
    }
  }

  const deleteWorker = async (id: string) => {
    await supabase.from('users').delete().eq('id', id)
    setWorkers(p => p.filter(x => x.id !== id))
    showToast('O\'chirildi')
  }

  // HISOBOT
  const todayOrders = orders
  const totalRev = todayOrders.reduce((s, o) => s + o.total, 0)
  const cashRev = todayOrders.reduce((s, o) => s + (o.pay_type === 'naqd' ? o.total : 0), 0)
  const cardRev = todayOrders.reduce((s, o) => s + (o.pay_type === 'karta' ? o.total : 0), 0)
  const debtRev = todayOrders.reduce((s, o) => s + (o.pay_type === 'qarz' ? o.total : 0), 0)
  const activeDebts = todayOrders.filter(o => o.pay_type === 'qarz' && !o.debt_paid)

  const payDebt = async (orderId: string) => {
    await supabase.from('orders').update({ debt_paid: true }).eq('id', orderId)
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, debt_paid: true } : o))
    showToast('✅ Qarz yopildi!')
  }
  const generatePDF = () => {
  const doc = new jsPDF()

  // Sarlavha
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('EA MURUNTOV - Kunlik Hisobot', 105, 20, { align: 'center' })

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Sana: ${new Date().toLocaleDateString('ru-RU')}`, 105, 30, { align: 'center' })

  // Chiziq
  doc.setLineWidth(0.5)
  doc.line(20, 35, 190, 35)

  // Statistika
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Umumiy statistika:', 20, 45)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  const stats = [
    [`Jami buyurtmalar:`, `${todayOrders.length} ta`],
    [`Jami tushum:`, `${fmt(totalRev)} som`],
    [`Naqd:`, `${fmt(cashRev)} som`],
    [`Karta:`, `${fmt(cardRev)} som`],
    [`Qarz:`, `${fmt(debtRev)} som`],
    [`Faol qarzlar:`, `${activeDebts.length} ta`],
  ]
  stats.forEach(([label, val], i) => {
    doc.text(label, 25, 55 + i * 8)
    doc.text(val, 140, 55 + i * 8)
  })

  // Chiziq
  doc.line(20, 107, 190, 107)

  // Qarzdorlar
  if (activeDebts.length > 0) {
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Qarzdorlar:', 20, 117)

    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    activeDebts.forEach((o, i) => {
      doc.text(`${i + 1}. ${o.debtor_name || "Noma'lum"}`, 25, 127 + i * 8)
      doc.text(`${fmt(o.total)} som`, 140, 127 + i * 8)
    })
  }

  // Buyurtmalar
  const startY = activeDebts.length > 0 ? 130 + activeDebts.length * 8 : 117
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text("So'nggi buyurtmalar:", 20, startY)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  todayOrders.slice(0, 15).forEach((o, i) => {
    const payLabel = o.pay_type === 'naqd' ? 'Naqd' : o.pay_type === 'karta' ? 'Karta' : `Qarz (${o.debtor_name})`
    doc.text(`${i + 1}. ${fmt(o.total)} som — ${payLabel}`, 25, startY + 10 + i * 7)
  })

  // Footer
  doc.setFontSize(9)
  doc.setTextColor(150)
  doc.text('Zarafshon Dasturchilari | EA Muruntov POS', 105, 285, { align: 'center' })

  doc.save(`ea-muruntov-hisobot-${new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')}.pdf`)
  showToast('✅ PDF yuklab olindi!')
}

  const tabs: { id: Tab; label: string }[] = [
    { id: 'smena', label: '⏱ Smena' },
    { id: 'mahsulot', label: '🍽 Menyu' },
    { id: 'xodim', label: '👤 Xodimlar' },
    { id: 'hisobot', label: '📊 Hisobot' },
  ]

  return (
    <div className="min-h-screen bg-[#F5F3EE]">

      {/* TOPBAR */}
      <div className="bg-[#1C1407] px-6 py-3 flex items-center justify-between sticky top-0 z-40">
        <div>
          <div className="text-[#F5C842] font-black tracking-widest text-base">EA MURUNTOV</div>
          <div className="text-gray-500 text-xs mt-0.5">{user?.name} · Admin</div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full text-xs font-bold ${shift ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
            {shift ? '● Smena ochiq' : '○ Smena yopiq'}
          </div>
          <button onClick={() => { localStorage.removeItem('pos_user'); router.push('/') }}
            className="border border-gray-600 text-gray-400 rounded-lg px-3 py-1.5 text-xs hover:border-gray-400 transition-all">
            Chiqish
          </button>
        </div>
      </div>

      {/* TABLAR */}
      <div className="bg-white border-b border-gray-200 px-4 flex gap-1 sticky top-[52px] z-30">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-5 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === t.id ? 'border-[#C8860A] text-[#C8860A]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-w-3xl mx-auto p-4">

        {/* ===== SMENA TAB ===== */}
        {activeTab === 'smena' && (
          <div className="space-y-4">
            {/* Smena holati */}
            <div className={`rounded-2xl p-5 border-2 ${shift ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-black text-lg">{shift ? 'Smena ochiq' : 'Smena yopiq'}</div>
                  <div className="text-sm text-gray-500 mt-1">
                    {shift ? `Boshlangan: ${new Date(shift.opened_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}` : 'Smena hali boshlanmagan'}
                  </div>
                </div>
                <button onClick={shift ? closeShift : openShift} disabled={loading}
                  className={`px-6 py-3 rounded-xl font-black text-sm transition-all disabled:opacity-50 ${shift ? 'bg-[#B83232] text-white hover:bg-red-700' : 'bg-[#1E7B47] text-white hover:bg-green-700'}`}>
                  {loading ? '...' : shift ? 'Yopish' : 'Ochish'}
                </button>
              </div>
            </div>

            {/* Sklad - mahsulot miqdori */}
            {shift && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <div className="font-black text-base">Boshlang'ich miqdor</div>
                  <div className="text-xs text-gray-400 mt-0.5">Smena boshidagi mahsulot soni</div>
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
                          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${p.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {p.is_available ? 'Bor' : "Yo'q"}
                        </button>
                        <input
                          type="number" min="0"
                          value={st?.initial_qty || 0}
                          onChange={e => updateStock(p.id, parseInt(e.target.value) || 0)}
                          className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-center text-sm font-bold outline-none focus:border-[#C8860A]"
                        />
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

            {/* Kategoriya qo'shish */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="font-black text-base mb-3">Kategoriya qo'shish</div>
              <div className="flex gap-2">
                <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                  placeholder="Kategoriya nomi"
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#C8860A]" />
                <button onClick={addCategory}
                  className="px-5 py-2.5 bg-[#C8860A] text-[#1A1208] rounded-xl font-black text-sm hover:bg-[#F5C842] transition-all">
                  Qo'shish
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {categories.map(c => (
                  <div key={c.id} className="flex items-center gap-1.5 bg-[#FFF8E7] border border-[#F5C842] rounded-full px-3 py-1">
                    <span className="text-sm font-bold text-[#1A1208]">{c.name}</span>
                    <button onClick={() => deleteCategory(c.id)} className="text-gray-400 hover:text-red-500 text-xs font-bold">✕</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Mahsulot qo'shish */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="font-black text-base mb-3">Mahsulot qo'shish</div>
              <div className="space-y-2">
                <input value={newProdName} onChange={e => setNewProdName(e.target.value)}
                  placeholder="Mahsulot nomi"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#C8860A]" />
                <div className="flex gap-2">
                  <input value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)}
                    placeholder="Narxi (so'm)" type="number"
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#C8860A]" />
                  <select value={newProdCat} onChange={e => setNewProdCat(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#C8860A] bg-white">
                    <option value="">Kategoriya</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <button onClick={addProduct}
                  className="w-full py-2.5 bg-[#C8860A] text-[#1A1208] rounded-xl font-black text-sm hover:bg-[#F5C842] transition-all">
                  ＋ Mahsulot qo'shish
                </button>
              </div>
            </div>

            {/* Mahsulotlar ro'yxati */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 font-black text-base">
                Mahsulotlar ({products.length} ta)
              </div>
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
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${p.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {p.is_available ? 'Bor' : "Yo'q"}
                      </button>
                      <button onClick={() => deleteProduct(p.id)}
                        className="text-gray-300 hover:text-red-500 text-lg transition-all">✕</button>
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
                <input value={newWorkerName} onChange={e => setNewWorkerName(e.target.value)}
                  placeholder="Xodim ismi"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#C8860A]" />
                <input value={newWorkerPin} onChange={e => setNewWorkerPin(e.target.value.slice(0, 4))}
                  placeholder="4 xonali PIN kod" type="number" maxLength={4}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#C8860A]" />
                <button onClick={addWorker}
                  className="w-full py-2.5 bg-[#C8860A] text-[#1A1208] rounded-xl font-black text-sm hover:bg-[#F5C842] transition-all">
                  ＋ Xodim qo'shish
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 font-black text-base">
                Xodimlar ({workers.length} ta)
              </div>
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
                    <button onClick={() => deleteWorker(w.id)}
                      className="text-gray-300 hover:text-red-500 text-lg transition-all">✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== HISOBOT TAB ===== */}
        {activeTab === 'hisobot' && (
          <div className="space-y-4">

            {/* Statistika */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Jami tushum', val: fmt(totalRev) + ' so\'m', color: 'text-[#C8860A]' },
                { label: 'Buyurtmalar', val: todayOrders.length + ' ta', color: 'text-[#1A1208]' },
                { label: 'Naqd', val: fmt(cashRev) + ' so\'m', color: 'text-[#1E7B47]' },
                { label: 'Karta', val: fmt(cardRev) + ' so\'m', color: 'text-blue-600' },
                { label: 'Qarz', val: fmt(debtRev) + ' so\'m', color: 'text-[#B83232]' },
                { label: 'Faol qarzlar', val: activeDebts.length + ' ta', color: 'text-[#B83232]' },
              ].map((s, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="text-xs text-gray-400 font-bold mb-1">{s.label}</div>
                  <div className={`font-black text-lg ${s.color}`}>{s.val}</div>
                </div>
              ))}
            </div>

            {/* Qarzdorlar */}
            {activeDebts.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 font-black text-base text-[#B83232]">
                  Qarzdorlar
                </div>
                <div className="divide-y divide-gray-50">
                  {activeDebts.map(o => (
                    <div key={o.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1">
                        <div className="font-bold text-sm">{o.debtor_name || "Noma'lum"}</div>
                        <div className="text-xs text-gray-400">{fmt(o.total)} so'm</div>
                      </div>
                      <button onClick={() => payDebt(o.id)}
                        className="px-4 py-2 bg-[#1E7B47] text-white rounded-xl text-xs font-black hover:bg-green-700 transition-all">
                        To'landi
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* So'nggi buyurtmalar */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 font-black text-base">
                So'nggi buyurtmalar
              </div>
              <div className="divide-y divide-gray-50">
                {todayOrders.slice(0, 20).map((o, i) => (
                  <div key={o.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-black text-gray-500">
                      {todayOrders.length - i}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-sm">{fmt(o.total)} so'm</div>
                      <div className="text-xs text-gray-400">
                        {o.pay_type === 'qarz' ? `📝 Qarz — ${o.debtor_name}` : o.pay_type === 'karta' ? '💳 Karta' : '💵 Naqd'}
                      </div>
                    </div>
                    {o.pay_type === 'qarz' && (
                      <div className={`text-xs font-bold px-2 py-1 rounded-full ${o.debt_paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {o.debt_paid ? "To'langan" : 'Qarzdor'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TOAST */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-[#1A1208] text-[#F5C842] px-5 py-2.5 rounded-full text-sm font-bold z-50 shadow-lg">
          {toast}
        </div>
      )}
      <button onClick={generatePDF}
  className="w-full py-4 bg-[#1A1208] text-[#F5C842] rounded-2xl font-black text-base hover:bg-[#2C200A] transition-all">
  📄 PDF hisobot yuklab olish
</button>
    </div>
  )
}