'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import jsPDF from 'jspdf'
import { Clock, UtensilsCrossed, Users, BarChart3, LogOut, PackagePlus, PackageMinus, Search } from 'lucide-react'
import DebtorCard from '../cashier/components/DebtorCard'

type User = { id: string; name: string; role: string }
type Category = { id: string; name: string; order_num: number }
type Product = {
  id: string; name: string; price: number; category_id: string; is_available: boolean
  unit_type?: string; kg_to_hissa?: number; hissa_per_unit?: number
}
type Shift = { id: string; is_open: boolean; opened_at: string; closed_at?: string; opened_by?: string; closed_by?: string }
type ShiftStock = { product_id: string; initial_qty: number }
type Order = { id: string; total: number; pay_type: string; debt_paid: boolean; debtor_name: string | null; worker_id: string; created_at: string; actual_paid?: number; payment_note?: string }
type OrderItem = { order_id: string; product_id: string; qty: number; price: number }
type Worker = { id: string; name: string; pin: string; role: string }
type WriteOff = { id: string; product_id: string; qty: number; reason: string; worker_id: string; created_at: string }
type StockIn = { id: string; product_id: string; qty: number; worker_id: string; created_at: string }
type Debtor = { id: string; name: string; phone: string; total_debt: number }
type ShiftSummary = {
  id: string; opened_at: string; closed_at: string | null; is_open: boolean
  opened_by_name: string | null; closed_by_name: string | null
  order_count: number; total_revenue: number; cash_revenue: number
  click_revenue: number; card_revenue: number; debt_revenue: number; ichki_count: number
}

type Tab = 'hisobot' | 'tarix' | 'qarzdorlar' | 'mahsulot' | 'xodim'

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

    const [
      { data: report },
      { data: stockData },
      { data: siData },
      { data: woData },
      { data: ords },
    ] = await Promise.all([
      supabase.from('shift_reports').select('*, products(name)').eq('shift_id', shiftId),
      supabase.from('shift_stock').select('*').eq('shift_id', shiftId),
      supabase.from('stock_ins').select('*').eq('shift_id', shiftId),
      supabase.from('write_offs').select('*').eq('shift_id', shiftId),
      supabase.from('orders').select('id').eq('shift_id', shiftId),
    ])

    let orderItemsData: any[] = []
    if (ords && ords.length > 0) {
      const orderIds = ords.map((o: any) => o.id)
      const { data: oi } = await supabase.from('order_items').select('*').in('order_id', orderIds)
      orderItemsData = oi || []
    }

    const enriched = (report || []).map((r: any) => {
      const prod = products.find((p: any) => p.id === r.product_id)
      const initial = stockData?.find((s: any) => s.product_id === r.product_id)?.initial_qty || 0

      const sotildi = orderItemsData
        .filter((oi: any) => oi.product_id === r.product_id)
        .reduce((s: number, oi: any) => s + oi.qty, 0)

      // Smena boshi chiqimlari (kassir 0 qilganlar)
      const smenaChiqim = woData?.filter((w: any) =>
        w.product_id === r.product_id &&
        w.reason === 'Smena boshida chiqindi'
      ).reduce((s: number, w: any) => s + w.qty, 0) || 0

      // Oddiy chiqimlar (smena davomida)
      const oddiyChiqim = woData?.filter((w: any) =>
        w.product_id === r.product_id &&
        w.reason !== 'Smena boshida chiqindi'
      ).reduce((s: number, w: any) => s + w.qty, 0) || 0

      const totalChiqim = oddiyChiqim + smenaChiqim
      // Haqiqiy boshlang'ich = shift_stock + smena boshi chiqimlari
      const realInitial = initial + smenaChiqim

      let kirim = 0

      if (prod?.unit_type === 'hissa') {
        const kgKirim = siData?.filter((si: any) => si.product_id === r.product_id)
          .reduce((s: number, si: any) => s + si.qty, 0) || 0
        if (kgKirim > 0) {
          const hissaKirim = Math.round(kgKirim * (prod.kg_to_hissa || 21))
          kirim = Math.floor(hissaKirim / (prod.hissa_per_unit || 3))
        }
        // Osh uchun qoldiq = kassir kiritgan haqiqiy qoldiq
        const qoldiq = r.actual_qty
        return { ...r, initial: realInitial, kirim, sotildi, chiqim: totalChiqim, qoldiq }
      }

      // Oddiy mahsulotlar
      kirim = siData?.filter((si: any) => si.product_id === r.product_id)
        .reduce((s: number, si: any) => s + si.qty, 0) || 0
      const qoldiq = realInitial + kirim - sotildi - totalChiqim
      return { ...r, initial: realInitial, kirim, sotildi, chiqim: totalChiqim, qoldiq }

    }).filter((r: any) => r.initial > 0 || r.kirim > 0 || r.sotildi > 0 || r.chiqim > 0)

    setShiftReports(prev => ({ ...prev, [shiftId]: enriched }))
  }

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }
  const fmt = (n: number) => n.toLocaleString('uz-UZ')
  const workerName = (id: string) => workers.find(w => w.id === id)?.name || 'Noma\'lum'
  const productName = (id: string) => products.find(p => p.id === id)?.name || 'Noma\'lum'

  const toggleAvail = async (p: Product) => {
    await supabase.from('products').update({ is_available: !p.is_available }).eq('id', p.id)
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_available: !x.is_available } : x))
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
  const sold = orderItems
    .filter(oi => oi.product_id === p.id && shiftOrderIds.includes(oi.order_id))
    .reduce((s, oi) => s + oi.qty, 0)
  const stock = stocks.find(s => s.product_id === p.id)

  // Smena boshi chiqimlari (kassir 0 qilganlar)
  const smenaChiqim = writeOffs
    .filter(w => w.product_id === p.id
      && shift
      && new Date(w.created_at) >= new Date(shift.opened_at)
      && w.reason === 'Smena boshida chiqindi')
    .reduce((s, w) => s + w.qty, 0)

  // Oddiy chiqimlar
  const oddiyChiqim = writeOffs
    .filter(w => w.product_id === p.id
      && shift
      && new Date(w.created_at) >= new Date(shift.opened_at)
      && w.reason !== 'Smena boshida chiqindi')
    .reduce((s, w) => s + w.qty, 0)

  const stockIn = stockIns
    .filter(si => si.product_id === p.id && shift && new Date(si.created_at) >= new Date(shift.opened_at))
    .reduce((s, si) => s + si.qty, 0)

  // Haqiqiy boshlang'ich = shift_stock + smena boshi chiqimlari
  const realInitial = (stock?.initial_qty || 0) + smenaChiqim
  const totalChiqim = smenaChiqim + oddiyChiqim
  const remaining = realInitial + stockIn - sold - totalChiqim

  return { ...p, sold, writeOff: totalChiqim, stockIn, remaining, initial: realInitial }
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
    <div style={{minHeight:'100vh', backgroundColor:'#F5F3EE', paddingBottom:'80px'}}>

      {/* TOPBAR */}
      <div style={{backgroundColor:'#1C1407', padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:40}}>
        <div>
          <div style={{color:'#F5C842', fontWeight:900, letterSpacing:'0.1em', fontSize:'14px'}}>EA MURUNTOV</div>
          <div style={{color:'#6b7280', fontSize:'12px'}}>{user?.name} · Rahbar</div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
          <div style={{padding:'4px 12px', borderRadius:'999px', fontSize:'12px', fontWeight:700, backgroundColor: shift?.is_open ? 'rgba(34,197,94,0.2)' : 'rgba(75,85,99,0.3)', color: shift?.is_open ? '#4ade80' : '#6b7280'}}>
            {shift?.is_open ? '● Ochiq' : '○ Yopiq'}
          </div>
          <button onClick={() => { localStorage.removeItem('pos_user'); router.push('/') }}
            style={{border:'1px solid #4b5563', color:'#9ca3af', borderRadius:'8px', padding:'8px', background:'transparent', cursor:'pointer'}}>
            <LogOut size={14}/>
          </button>
        </div>
      </div>

      <div style={{padding:'16px', maxWidth:'672px', margin:'0 auto'}}>

        {/* ===== HISOBOT ===== */}
        {activeTab === 'hisobot' && (
          <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
            {shift && (
              <div style={{backgroundColor:'white', borderRadius:'16px', border:'1px solid #e5e7eb', padding:'16px'}}>
                <div style={{fontWeight:900, fontSize:'14px', marginBottom:'8px'}}>📋 Smena</div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px', fontSize:'14px'}}>
                  <span style={{color:'#9ca3af'}}>Holat:</span>
                  <span style={{fontWeight:700, color: shift.is_open ? '#16a34a' : '#6b7280'}}>{shift.is_open ? '● Ochiq' : '○ Yopiq'}</span>
                  <span style={{color:'#9ca3af'}}>Kim ochdi:</span>
                  <span style={{fontWeight:700}}>{shift.opened_by ? workerName(shift.opened_by) : '—'}</span>
                  <span style={{color:'#9ca3af'}}>Soat:</span>
                  <span style={{fontWeight:700}}>{new Date(shift.opened_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</span>
                  {shift.closed_at && <>
                    <span style={{color:'#9ca3af'}}>Kim yopdi:</span>
                    <span style={{fontWeight:700}}>{shift.closed_by ? workerName(shift.closed_by) : '—'}</span>
                    <span style={{color:'#9ca3af'}}>Yopildi:</span>
                    <span style={{fontWeight:700}}>{new Date(shift.closed_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</span>
                  </>}
                </div>
              </div>
            )}

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
              {[
                { label: 'Jami tushum', val: fmt(actualRev) + ' so\'m', color: '#C8860A', sub: totalRev !== actualRev ? `Narx: ${fmt(totalRev)}` : undefined },
                { label: 'Buyurtmalar', val: shiftOrders.length + ' ta', color: '#1A1208' },
                { label: 'Naqd', val: fmt(cashRev) + ' so\'m', color: '#1E7B47' },
                { label: 'Click', val: fmt(clickRev) + ' so\'m', color: '#9333ea' },
                { label: 'Karta', val: fmt(cardRev) + ' so\'m', color: '#2563eb' },
                { label: 'Qarz', val: fmt(debtRev) + ' so\'m', color: '#B83232' },
                { label: 'Ichki', val: ichkiOrders.length + ' ta', color: '#f97316' },
                { label: 'Faol qarzlar', val: activeDebts.length + ' ta', color: '#B83232' },
              ].map((s, i) => (
                <div key={i} style={{backgroundColor:'white', borderRadius:'16px', border:'1px solid #e5e7eb', padding:'16px'}}>
                  <div style={{fontSize:'12px', color:'#9ca3af', fontWeight:700, marginBottom:'4px'}}>{s.label}</div>
                  <div style={{fontWeight:900, fontSize:'18px', color:s.color}}>{s.val}</div>
                  {s.sub && <div style={{fontSize:'11px', color:'#9ca3af', marginTop:'2px'}}>{s.sub}</div>}
                </div>
              ))}
            </div>

            {moslashuvOrders.length > 0 && (
              <div style={{backgroundColor:'white', borderRadius:'16px', border:'1px solid #e5e7eb', overflow:'hidden'}}>
                <div style={{padding:'12px 16px', borderBottom:'1px solid #f3f4f6', fontWeight:900, fontSize:'14px'}}>💱 Moslashuvchan to'lovlar</div>
                {moslashuvOrders.map(o => (
                  <div key={o.id} style={{padding:'12px 16px', borderBottom:'1px solid #f9fafb'}}>
                    <div style={{display:'flex', justifyContent:'space-between', fontSize:'14px'}}>
                      <span style={{color:'#6b7280'}}>Narx: {fmt(o.total)} so'm</span>
                      <span style={{fontWeight:700, color:'#C8860A'}}>To'landi: {fmt(o.actual_paid || o.total)} so'm</span>
                    </div>
                    {o.payment_note && <div style={{fontSize:'11px', color:'#9ca3af', marginTop:'2px'}}>{o.payment_note}</div>}
                  </div>
                ))}
              </div>
            )}

            {soldByProduct.length > 0 && (
              <div style={{backgroundColor:'white', borderRadius:'16px', border:'1px solid #e5e7eb', overflow:'hidden'}}>
                <div style={{padding:'12px 16px', borderBottom:'1px solid #f3f4f6', fontWeight:900, fontSize:'14px'}}>📦 Mahsulot hisobi</div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%', fontSize:'12px', borderCollapse:'collapse'}}>
                    <thead>
                      <tr style={{backgroundColor:'#f9fafb'}}>
                        <th style={{textAlign:'left', padding:'8px 12px', fontWeight:700, color:'#9ca3af'}}>Mahsulot</th>
                        <th style={{textAlign:'center', padding:'8px 4px', fontWeight:700, color:'#9ca3af'}}>B.</th>
                        <th style={{textAlign:'center', padding:'8px 4px', fontWeight:700, color:'#9ca3af'}}>K.</th>
                        <th style={{textAlign:'center', padding:'8px 4px', fontWeight:700, color:'#9ca3af'}}>S.</th>
                        <th style={{textAlign:'center', padding:'8px 4px', fontWeight:700, color:'#9ca3af'}}>Ch.</th>
                        <th style={{textAlign:'center', padding:'8px 4px', fontWeight:700, color:'#9ca3af'}}>Q.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {soldByProduct.map(p => (
                        <tr key={p.id} style={{borderTop:'1px solid #f9fafb'}}>
                          <td style={{padding:'8px 12px', fontWeight:700}}>{p.name}</td>
                          <td style={{padding:'8px 4px', textAlign:'center', color:'#6b7280'}}>{p.initial}</td>
                          <td style={{padding:'8px 4px', textAlign:'center', color:'#16a34a', fontWeight:700}}>{p.stockIn > 0 ? `+${p.stockIn}` : '—'}</td>
                          <td style={{padding:'8px 4px', textAlign:'center', color:'#C8860A', fontWeight:700}}>{p.sold > 0 ? p.sold : '—'}</td>
                          <td style={{padding:'8px 4px', textAlign:'center', color:'#ef4444', fontWeight:700}}>{p.writeOff > 0 ? p.writeOff : '—'}</td>
                          <td style={{padding:'8px 4px', textAlign:'center', fontWeight:900, color: p.remaining < 0 ? '#dc2626' : '#1A1208'}}>{p.remaining}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {oshHissa > 0 && (
              <div style={{backgroundColor:'white', borderRadius:'16px', border:'1px solid #e5e7eb', overflow:'hidden'}}>
                <div style={{padding:'12px 16px', borderBottom:'1px solid #f3f4f6', fontWeight:900, fontSize:'14px'}}>🍚 Osh qoldig'i</div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', padding:'16px'}}>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:'20px', fontWeight:900, color:'#C8860A'}}>{oshHissa}</div>
                    <div style={{fontSize:'11px', color:'#9ca3af', marginTop:'2px'}}>Hissa</div>
                  </div>
                  <div style={{textAlign:'center', borderLeft:'1px solid #f3f4f6', borderRight:'1px solid #f3f4f6'}}>
                    <div style={{fontSize:'20px', fontWeight:900, color:'#16a34a'}}>{Math.floor(oshHissa / 3)}</div>
                    <div style={{fontSize:'11px', color:'#9ca3af', marginTop:'2px'}}>Butun</div>
                  </div>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:'20px', fontWeight:900, color:'#2563eb'}}>{Math.floor(oshHissa / 2)}</div>
                    <div style={{fontSize:'11px', color:'#9ca3af', marginTop:'2px'}}>Yarim</div>
                  </div>
                </div>
              </div>
            )}

            {ichkiOrders.length > 0 && (
              <div style={{backgroundColor:'white', borderRadius:'16px', border:'1px solid #e5e7eb', overflow:'hidden'}}>
                <div style={{padding:'12px 16px', borderBottom:'1px solid #f3f4f6', fontWeight:900, fontSize:'14px', color:'#f97316'}}>🍽 Ichki iste'mol</div>
                {ichkiOrders.map(o => {
                  const items = orderItems.filter(oi => oi.order_id === o.id)
                  return (
                    <div key={o.id} style={{padding:'12px 16px', borderBottom:'1px solid #f9fafb'}}>
                      <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'4px'}}>
                        <span style={{fontWeight:700}}>{workerName(o.worker_id)}</span>
                        <span style={{color:'#9ca3af'}}>{new Date(o.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div style={{fontSize:'12px', color:'#6b7280'}}>{items.map(i => `${productName(i.product_id)} × ${i.qty}`).join(', ')}</div>
                    </div>
                  )
                })}
              </div>
            )}

            {writeOffs.length > 0 && (
              <div style={{backgroundColor:'white', borderRadius:'16px', border:'1px solid #e5e7eb', overflow:'hidden'}}>
                <div style={{padding:'12px 16px', borderBottom:'1px solid #f3f4f6', fontWeight:900, fontSize:'14px', color:'#B83232', display:'flex', alignItems:'center', gap:'8px'}}>
                  <PackageMinus size={14}/> Chiqimlar
                </div>
                {writeOffs.map(w => (
                  <div key={w.id} style={{padding:'12px 16px', borderBottom:'1px solid #f9fafb'}}>
                    <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'2px'}}>
                      <span style={{fontWeight:700}}>{productName(w.product_id)} — {w.qty} ta</span>
                      <span style={{color:'#9ca3af'}}>{workerName(w.worker_id)}</span>
                    </div>
                    <div style={{fontSize:'12px', color:'#6b7280', fontStyle:'italic'}}>"{w.reason}"</div>
                  </div>
                ))}
              </div>
            )}

            {stockIns.length > 0 && (
              <div style={{backgroundColor:'white', borderRadius:'16px', border:'1px solid #e5e7eb', overflow:'hidden'}}>
                <div style={{padding:'12px 16px', borderBottom:'1px solid #f3f4f6', fontWeight:900, fontSize:'14px', color:'#1E7B47', display:'flex', alignItems:'center', gap:'8px'}}>
                  <PackagePlus size={14}/> Kirimlar
                </div>
                {stockIns.map(si => (
                  <div key={si.id} style={{display:'flex', alignItems:'center', padding:'12px 16px', borderBottom:'1px solid #f9fafb'}}>
                    <div style={{flex:1, fontSize:'12px'}}>
                      <div style={{fontWeight:700}}>{productName(si.product_id)} — {si.qty} ta</div>
                      <div style={{color:'#9ca3af'}}>{workerName(si.worker_id)}</div>
                    </div>
                    <div style={{fontSize:'12px', color:'#9ca3af'}}>{new Date(si.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                ))}
              </div>
            )}

            {activeDebts.length > 0 && (
              <div style={{backgroundColor:'white', borderRadius:'16px', border:'1px solid #e5e7eb', overflow:'hidden'}}>
                <div style={{padding:'12px 16px', borderBottom:'1px solid #f3f4f6', fontWeight:900, fontSize:'14px', color:'#B83232'}}>Faol qarzlar</div>
                {activeDebts.map(o => (
                  <div key={o.id} style={{display:'flex', alignItems:'center', gap:'12px', padding:'12px 16px', borderBottom:'1px solid #f9fafb'}}>
                    <div style={{flex:1, fontSize:'14px'}}>
                      <div style={{fontWeight:700}}>{o.debtor_name || "Noma'lum"}</div>
                      <div style={{fontSize:'12px', color:'#9ca3af'}}>{fmt(o.total)} so'm</div>
                    </div>
                    <button onClick={() => payDebt(o.id)}
                      style={{padding:'6px 12px', backgroundColor:'#1E7B47', color:'white', borderRadius:'12px', fontSize:'12px', fontWeight:900, border:'none', cursor:'pointer'}}>
                      To'landi
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button onClick={generatePDF}
              style={{width:'100%', padding:'16px', backgroundColor:'#1A1208', color:'#F5C842', borderRadius:'16px', fontWeight:900, fontSize:'14px', border:'none', cursor:'pointer'}}>
              📄 PDF hisobot yuklab olish
            </button>
          </div>
        )}

        {/* ===== SMENA TARIXI ===== */}
        {activeTab === 'tarix' && (
          <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
            <div style={{fontSize:'12px', color:'#9ca3af', fontWeight:700}}>Oxirgi 30 ta smena</div>
            {shiftHistory.length === 0 ? (
              <div style={{backgroundColor:'white', borderRadius:'16px', border:'1px solid #e5e7eb', padding:'32px', textAlign:'center', color:'#d1d5db'}}>
                <div style={{fontSize:'32px', marginBottom:'8px'}}>📋</div>
                <div style={{fontSize:'14px', fontWeight:700}}>Smena tarixi yo'q</div>
              </div>
            ) : shiftHistory.map(s => {
              const isSelected = selectedShiftId === s.id
              const report = shiftReports[s.id] || []
              const sana = new Date(s.opened_at).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: '2-digit' })
              const vaqt = new Date(s.opened_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
              const yopildi = s.closed_at ? new Date(s.closed_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : null

              return (
                <div key={s.id} style={{backgroundColor:'white', borderRadius:'16px', border:'1px solid #e5e7eb', overflow:'hidden'}}>
                  <div style={{padding:'12px 16px', cursor:'pointer'}}
                    onClick={() => {
                      if (isSelected) { setSelectedShiftId(null) }
                      else { setSelectedShiftId(s.id); loadShiftReport(s.id) }
                    }}>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px'}}>
                      <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                        <div style={{width:'8px', height:'8px', borderRadius:'50%', backgroundColor: s.is_open ? '#22c55e' : '#d1d5db', flexShrink:0}}/>
                        <span style={{fontWeight:900, fontSize:'14px'}}>{sana}</span>
                        <span style={{color:'#9ca3af', fontSize:'12px'}}>{vaqt}{yopildi ? ` — ${yopildi}` : ''}</span>
                      </div>
                      <span style={{fontSize:'12px', color:'#9ca3af'}}>{isSelected ? '▲' : '▼'}</span>
                    </div>
                    <div style={{display:'flex', alignItems:'center', gap:'12px', marginLeft:'16px'}}>
                      <span style={{fontSize:'12px', color:'#6b7280'}}>{s.order_count} buyurtma</span>
                      <span style={{fontWeight:900, fontSize:'14px', color:'#C8860A'}}>{fmt(s.total_revenue)} so'm</span>
                      {s.is_open && <span style={{fontSize:'11px', backgroundColor:'#dcfce7', color:'#15803d', padding:'2px 8px', borderRadius:'999px', fontWeight:700}}>Ochiq</span>}
                    </div>
                    <div style={{display:'flex', gap:'12px', marginLeft:'16px', marginTop:'4px', fontSize:'12px', color:'#9ca3af'}}>
                      {s.opened_by_name && <span>Kim ochdi: {s.opened_by_name}</span>}
                      {s.closed_by_name && <span>Kim yopdi: {s.closed_by_name}</span>}
                    </div>
                  </div>

                  {isSelected && (
                    <div style={{borderTop:'1px solid #f3f4f6', padding:'12px 16px', backgroundColor:'#f9fafb', display:'flex', flexDirection:'column', gap:'12px'}}>
                      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px'}}>
                        {[
                          { label: 'Jami tushum', val: fmt(s.total_revenue) + ' so\'m', color: '#C8860A' },
                          { label: 'Buyurtmalar', val: s.order_count + ' ta', color: '#1A1208' },
                          { label: 'Naqd', val: fmt(s.cash_revenue) + ' so\'m', color: '#16a34a' },
                          { label: 'Click', val: fmt(s.click_revenue) + ' so\'m', color: '#9333ea' },
                          { label: 'Karta', val: fmt(s.card_revenue) + ' so\'m', color: '#2563eb' },
                          { label: 'Qarz', val: fmt(s.debt_revenue) + ' so\'m', color: '#dc2626' },
                          { label: 'Ichki', val: s.ichki_count + ' ta', color: '#f97316' },
                        ].map((item, i) => (
                          <div key={i} style={{backgroundColor:'white', borderRadius:'12px', padding:'10px'}}>
                            <div style={{fontSize:'11px', color:'#9ca3af', marginBottom:'2px'}}>{item.label}</div>
                            <div style={{fontWeight:900, fontSize:'14px', color:item.color}}>{item.val}</div>
                          </div>
                        ))}
                      </div>

                      {report.length > 0 ? (
                        <div style={{backgroundColor:'white', borderRadius:'12px', overflow:'hidden'}}>
                          <div style={{padding:'8px 12px', borderBottom:'1px solid #f3f4f6', fontWeight:900, fontSize:'12px', color:'#6b7280'}}>📦 Mahsulot hisoboti</div>
                          <div style={{overflowX:'auto'}}>
                            <table style={{width:'100%', fontSize:'11px', borderCollapse:'collapse'}}>
                              <thead>
                                <tr style={{backgroundColor:'#f9fafb'}}>
                                  <th style={{textAlign:'left', padding:'6px 12px', fontWeight:700, color:'#9ca3af'}}>Mahsulot</th>
                                  <th style={{textAlign:'center', padding:'6px 4px', fontWeight:700, color:'#9ca3af'}}>B.</th>
                                  <th style={{textAlign:'center', padding:'6px 4px', fontWeight:700, color:'#9ca3af'}}>K.</th>
                                  <th style={{textAlign:'center', padding:'6px 4px', fontWeight:700, color:'#9ca3af'}}>S.</th>
                                  <th style={{textAlign:'center', padding:'6px 4px', fontWeight:700, color:'#9ca3af'}}>Ch.</th>
                                  <th style={{textAlign:'center', padding:'6px 4px', fontWeight:700, color:'#9ca3af'}}>Q.</th>
                                  <th style={{textAlign:'center', padding:'6px 4px', fontWeight:700, color:'#9ca3af'}}>Farq</th>
                                </tr>
                              </thead>
                              <tbody>
                                {report.map((r: any) => (
                                  <tr key={r.id} style={{borderTop:'1px solid #f9fafb'}}>
                                    <td style={{padding:'6px 12px', fontWeight:700}}>{r.products?.name || '—'}</td>
                                    <td style={{padding:'6px 4px', textAlign:'center', color:'#6b7280'}}>{r.initial > 0 ? r.initial : '—'}</td>
                                    <td style={{padding:'6px 4px', textAlign:'center', color:'#16a34a', fontWeight:700}}>{r.kirim > 0 ? `+${r.kirim}` : '—'}</td>
                                    <td style={{padding:'6px 4px', textAlign:'center', color:'#C8860A', fontWeight:700}}>{r.sotildi > 0 ? r.sotildi : '—'}</td>
                                    <td style={{padding:'6px 4px', textAlign:'center', color:'#ef4444', fontWeight:700}}>{r.chiqim > 0 ? r.chiqim : '—'}</td>
                                    <td style={{padding:'6px 4px', textAlign:'center', fontWeight:900, color:'#1A1208'}}>{r.qoldiq}</td>
                                    <td style={{padding:'6px 4px', textAlign:'center', fontWeight:900, color: r.diff < 0 ? '#ef4444' : r.diff > 0 ? '#16a34a' : '#d1d5db'}}>
                                      {r.diff === 0 ? '—' : (r.diff > 0 ? '+' : '') + r.diff}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {report.filter((r: any) => r.diff !== 0 && r.note).length > 0 && (
                            <div style={{padding:'8px 12px', borderTop:'1px solid #f3f4f6'}}>
                              <div style={{fontSize:'11px', fontWeight:700, color:'#ef4444', marginBottom:'4px'}}>⚠ Farqlar izohi:</div>
                              {report.filter((r: any) => r.diff !== 0 && r.note).map((r: any) => (
                                <div key={r.id} style={{fontSize:'11px', color:'#6b7280', marginBottom:'2px'}}>
                                  <span style={{fontWeight:700}}>{r.products?.name}:</span> {r.note}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{backgroundColor:'white', borderRadius:'12px', padding:'12px', textAlign:'center', fontSize:'12px', color:'#9ca3af'}}>
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
          <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
            <div style={{position:'relative'}}>
              <Search size={14} style={{position:'absolute', left:'12px', top:'11px', color:'#9ca3af'}}/>
              <input type="text" placeholder="Ism yoki telefon..."
                value={debtorSearch} onChange={e => setDebtorSearch(e.target.value)}
                style={{width:'100%', border:'1px solid #e5e7eb', borderRadius:'12px', paddingLeft:'36px', paddingRight:'16px', paddingTop:'10px', paddingBottom:'10px', fontSize:'14px', outline:'none', boxSizing:'border-box', backgroundColor:'white'}}/>
            </div>
            <div style={{backgroundColor:'white', borderRadius:'16px', border:'1px solid #e5e7eb', overflow:'hidden'}}>
              {filteredDebtors.length === 0 ? (
                <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'128px', color:'#d1d5db'}}>
                  <div style={{fontSize:'32px', marginBottom:'8px'}}>🔍</div>
                  <div style={{fontSize:'14px', fontWeight:700}}>Topilmadi</div>
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
          <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
            <div style={{backgroundColor:'white', borderRadius:'16px', border:'1px solid #e5e7eb', padding:'16px'}}>
              <div style={{fontWeight:900, fontSize:'14px', marginBottom:'12px'}}>Kategoriya qo'shish</div>
              <div style={{display:'flex', gap:'8px'}}>
                <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Kategoriya nomi"
                  style={{flex:1, border:'1px solid #e5e7eb', borderRadius:'12px', padding:'10px 12px', fontSize:'14px', outline:'none'}}/>
                <button onClick={addCategory}
                  style={{padding:'10px 16px', backgroundColor:'#C8860A', color:'#1A1208', borderRadius:'12px', fontWeight:900, fontSize:'14px', border:'none', cursor:'pointer'}}>+</button>
              </div>
              <div style={{display:'flex', flexWrap:'wrap', gap:'8px', marginTop:'12px'}}>
                {categories.map(c => (
                  <div key={c.id} style={{display:'flex', alignItems:'center', gap:'4px', backgroundColor:'#FFF8E7', border:'1px solid #F5C842', borderRadius:'999px', padding:'4px 12px'}}>
                    <span style={{fontSize:'14px', fontWeight:700}}>{c.name}</span>
                    <button onClick={() => deleteCategory(c.id)} style={{color:'#9ca3af', background:'none', border:'none', cursor:'pointer', fontSize:'12px', marginLeft:'4px'}}>✕</button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{backgroundColor:'white', borderRadius:'16px', border:'1px solid #e5e7eb', padding:'16px'}}>
              <div style={{fontWeight:900, fontSize:'14px', marginBottom:'12px'}}>Mahsulot qo'shish</div>
              <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
                <input value={newProdName} onChange={e => setNewProdName(e.target.value)} placeholder="Mahsulot nomi"
                  style={{border:'1px solid #e5e7eb', borderRadius:'12px', padding:'10px 12px', fontSize:'14px', outline:'none'}}/>
                <div style={{display:'flex', gap:'8px'}}>
                  <input value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)} placeholder="Narxi" type="number"
                    style={{flex:1, border:'1px solid #e5e7eb', borderRadius:'12px', padding:'10px 12px', fontSize:'14px', outline:'none'}}/>
                  <select value={newProdCat} onChange={e => setNewProdCat(e.target.value)}
                    style={{flex:1, border:'1px solid #e5e7eb', borderRadius:'12px', padding:'10px 12px', fontSize:'14px', outline:'none', backgroundColor:'white'}}>
                    <option value="">Kategoriya</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <button onClick={addProduct}
                  style={{padding:'10px', backgroundColor:'#C8860A', color:'#1A1208', borderRadius:'12px', fontWeight:900, fontSize:'14px', border:'none', cursor:'pointer'}}>
                  ＋ Qo'shish
                </button>
              </div>
            </div>

            <div style={{backgroundColor:'white', borderRadius:'16px', border:'1px solid #e5e7eb', overflow:'hidden'}}>
              <div style={{padding:'12px 16px', borderBottom:'1px solid #f3f4f6', fontWeight:900, fontSize:'14px'}}>Mahsulotlar ({products.length} ta)</div>
              {products.map(p => {
                const cat = categories.find(c => c.id === p.category_id)
                return (
                  <div key={p.id} style={{display:'flex', alignItems:'center', gap:'12px', padding:'12px 16px', borderBottom:'1px solid #f9fafb'}}>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontWeight:700, fontSize:'14px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{p.name}</div>
                      <div style={{fontSize:'12px', color:'#9ca3af'}}>{cat?.name} · {fmt(p.price)} so'm</div>
                    </div>
                    <button onClick={() => toggleAvail(p)}
                      style={{padding:'4px 8px', borderRadius:'999px', fontSize:'12px', fontWeight:700, border:'none', cursor:'pointer', flexShrink:0, backgroundColor: p.is_available ? '#dcfce7' : '#fee2e2', color: p.is_available ? '#15803d' : '#b91c1c'}}>
                      {p.is_available ? 'Bor' : "Yo'q"}
                    </button>
                    <button onClick={() => deleteProduct(p.id)} style={{color:'#d1d5db', background:'none', border:'none', cursor:'pointer', fontSize:'18px', flexShrink:0}}>✕</button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ===== XODIMLAR ===== */}
        {activeTab === 'xodim' && (
          <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
            <div style={{backgroundColor:'white', borderRadius:'16px', border:'1px solid #e5e7eb', padding:'16px'}}>
              <div style={{fontWeight:900, fontSize:'14px', marginBottom:'12px'}}>Xodim qo'shish</div>
              <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
                <input value={newWorkerName} onChange={e => setNewWorkerName(e.target.value)} placeholder="Xodim ismi"
                  style={{border:'1px solid #e5e7eb', borderRadius:'12px', padding:'10px 12px', fontSize:'14px', outline:'none'}}/>
                <input value={newWorkerPin} onChange={e => setNewWorkerPin(e.target.value.slice(0, 4))} placeholder="4 xonali PIN" type="number"
                  style={{border:'1px solid #e5e7eb', borderRadius:'12px', padding:'10px 12px', fontSize:'14px', outline:'none'}}/>
                <button onClick={addWorker}
                  style={{padding:'10px', backgroundColor:'#C8860A', color:'#1A1208', borderRadius:'12px', fontWeight:900, fontSize:'14px', border:'none', cursor:'pointer'}}>
                  ＋ Xodim qo'shish
                </button>
              </div>
            </div>

            <div style={{backgroundColor:'white', borderRadius:'16px', border:'1px solid #e5e7eb', overflow:'hidden'}}>
              <div style={{padding:'12px 16px', borderBottom:'1px solid #f3f4f6', fontWeight:900, fontSize:'14px'}}>Xodimlar ({workers.length} ta)</div>
              {workers.map(w => (
                <div key={w.id} style={{display:'flex', alignItems:'center', gap:'12px', padding:'12px 16px', borderBottom:'1px solid #f9fafb'}}>
                  <div style={{width:'40px', height:'40px', borderRadius:'50%', backgroundColor:'#FFF8E7', border:'2px solid #F5C842', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'#C8860A', fontSize:'14px', flexShrink:0}}>
                    {w.name[0]}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700, fontSize:'14px'}}>{w.name}</div>
                    <div style={{fontSize:'12px', color:'#9ca3af'}}>PIN: {w.pin}</div>
                  </div>
                  <button onClick={() => deleteWorker(w.id)} style={{color:'#d1d5db', background:'none', border:'none', cursor:'pointer', fontSize:'18px'}}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div style={{position:'fixed', bottom:0, left:0, right:0, backgroundColor:'#1C1407', borderTop:'1px solid #3D2E10', zIndex:40}}>
        <div style={{display:'flex', maxWidth:'672px', margin:'0 auto'}}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'8px 0', gap:'2px', background:'none', border:'none', cursor:'pointer', color: activeTab === t.id ? '#F5C842' : '#4b5563'}}>
              {t.icon}
              <span style={{fontSize:'10px', fontWeight:700}}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div style={{position:'fixed', top:'80px', left:'50%', transform:'translateX(-50%)', backgroundColor:'#1A1208', color:'#F5C842', padding:'10px 20px', borderRadius:'999px', fontSize:'14px', fontWeight:700, zIndex:50, boxShadow:'0 4px 12px rgba(0,0,0,0.3)', whiteSpace:'nowrap'}}>
          {toast}
        </div>
      )}
    </div>
  )
}