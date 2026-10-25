'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { clearStoredUser, getStoredUser } from '@/lib/session'
import { BarChart3, Clock, LogOut, Search, UtensilsCrossed, Users } from 'lucide-react'
import DebtorCard from '../cashier/components/DebtorCard'
import { formatKg, portionLabel } from '@/lib/osh'
import { buildShiftReport, oshProductsOf } from '@/lib/report'
import { downloadShiftPdf } from '@/lib/shiftPdf'
import { matchesQuery } from '@/lib/search'
import type { Category, Debtor, Order, OrderItem, Product, Shift, ShiftStock, StockIn, Worker, WriteOff } from '@/lib/types'
import MenuTab from './components/MenuTab'
import ReportTab from './components/ReportTab'
import HistoryTab from './components/HistoryTab'

type User = { id: string; name: string; role: string }
type Tab = 'hisobot' | 'tarix' | 'qarzdorlar' | 'mahsulot' | 'xodim'

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('hisobot')
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [shift, setShift] = useState<Shift | null>(null)
  const [oshHissa, setOshHissa] = useState(0)
  const [stocks, setStocks] = useState<ShiftStock[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [writeOffs, setWriteOffs] = useState<WriteOff[]>([])
  const [stockIns, setStockIns] = useState<StockIn[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [debtors, setDebtors] = useState<Debtor[]>([])
  const [debtorSearch, setDebtorSearch] = useState('')
  const [newWorkerName, setNewWorkerName] = useState('')
  const [newWorkerPin, setNewWorkerPin] = useState('')
  const [loadError, setLoadError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    const parsed = getStoredUser()
    if (!parsed) { router.push('/'); return }
    if (parsed.role !== 'owner') { router.push('/cashier'); return }
    setUser(parsed)
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Joriy (oxirgi) smena uchun kerakli ma'lumotlar faqat shu smena bo'yicha olinadi:
  // buyurtmalar soni oshgan sari sahifa sekinlashmaydi va 1000 qatorlik chegara hisobni buzmaydi.
  const loadAll = async () => {
    const [cats, prods, wrks, dbtrs, latest] = await Promise.all([
      supabase.from('categories').select('*').order('order_num'),
      supabase.from('products').select('*').order('created_at'),
      supabase.from('users').select('*').eq('role', 'worker'),
      supabase.from('debtors').select('*').order('name'),
      supabase.from('shifts').select('*').order('opened_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    if (cats.error || prods.error || wrks.error || dbtrs.error || latest.error) {
      setLoadError("Ma'lumot yuklanmadi. Internetni tekshiring.")
      return
    }
    setCategories(cats.data || [])
    setProducts(prods.data || [])
    setWorkers(wrks.data || [])
    setDebtors(dbtrs.data || [])
    setShift(latest.data || null)

    if (latest.data?.id) {
      const sid = latest.data.id
      const [ords, st, osh, si, wo] = await Promise.all([
        supabase.from('orders').select('*, order_items(*)').eq('shift_id', sid).order('created_at', { ascending: false }),
        supabase.from('shift_stock').select('product_id, initial_qty').eq('shift_id', sid),
        supabase.from('osh_stock').select('total_hissa').eq('shift_id', sid).maybeSingle(),
        supabase.from('stock_ins').select('*').eq('shift_id', sid).order('created_at', { ascending: false }),
        supabase.from('write_offs').select('*').eq('shift_id', sid).order('created_at', { ascending: false }),
      ])
      if (ords.error || st.error || osh.error || si.error || wo.error) {
        setLoadError("Smena ma'lumoti yuklanmadi. Internetni tekshiring.")
        return
      }
      const rows = (ords.data || []) as (Order & { order_items: OrderItem[] })[]
      setOrders(rows)
      setOrderItems(rows.flatMap(o => o.order_items || []))
      setStocks(st.data || [])
      setOshHissa(osh.data?.total_hissa || 0)
      setStockIns(si.data || [])
      setWriteOffs(wo.data || [])
    }
    setLoadError('')
  }

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }
  const workerName = (id: string) => workers.find(w => w.id === id)?.name || "Noma'lum"
  const productName = (id: string) => products.find(p => p.id === id)?.name || "Noma'lum"

  const oshList = useMemo(() => oshProductsOf(products), [products])
  const report = useMemo(
    () => buildShiftReport({ products, orders, orderItems, stocks, writeOffs, stockIns, poolHissa: oshHissa }),
    [products, orders, orderItems, stocks, writeOffs, stockIns, oshHissa],
  )

  // Osh kirimi kg bilan yoziladi; ro'yxatda kg va nechta porsiyaga tengligi ko'rsatiladi
  const stockInLabel = (si: StockIn) => {
    const p = products.find(x => x.id === si.product_id)
    if (p?.unit_type !== 'hissa') return `${si.qty} ta`
    const hissa = Math.round(si.qty * (p.kg_to_hissa || 21))
    const portions = `${Math.floor(hissa / (p.hissa_per_unit || 1))} ${portionLabel({ id: p.id, name: p.name })}`
    return `${formatKg(hissa, oshList)} = ${portions}`
  }

  const addWorker = async () => {
    const name = newWorkerName.trim()
    if (!name) { showToast('Xodim ismini kiriting'); return }
    if (!/^\d{4}$/.test(newWorkerPin)) { showToast("PIN aynan 4 ta raqamdan iborat bo'lishi kerak"); return }
    const { data, error } = await supabase.from('users').insert({ name, pin: newWorkerPin, role: 'worker' }).select().single()
    if (error || !data) {
      showToast(error?.code === '23505' ? 'Bu PIN band, boshqa PIN tanlang' : "Xodim qo'shilmadi: internetni tekshiring")
      return
    }
    setWorkers(p => [...p, data]); setNewWorkerName(''); setNewWorkerPin(''); showToast("Xodim qo'shildi!")
  }

  const deleteWorker = async (w: Worker) => {
    if (!window.confirm(`"${w.name}" xodimni o'chirasizmi?`)) return
    const { error } = await supabase.from('users').delete().eq('id', w.id)
    if (error) {
      // 23503: xodim buyurtma/smena yozuvlarida bor
      showToast(error.code === '23503' ? `"${w.name}" sotuv tarixida bor, o'chirib bo'lmaydi` : "O'chirilmadi: internetni tekshiring")
      return
    }
    setWorkers(p => p.filter(x => x.id !== w.id))
  }

  const generatePDF = async () => {
    await downloadShiftPdf(report, oshList)
    showToast('PDF yuklab olindi!')
  }

  const filteredDebtors = debtors.filter(d => matchesQuery(d.name, debtorSearch) || (d.phone || '').includes(debtorSearch.trim()))

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'hisobot', label: 'Hisobot', icon: <BarChart3 size={20}/> },
    { id: 'tarix', label: 'Tarix', icon: <Clock size={20}/> },
    { id: 'qarzdorlar', label: 'Qarzlar', icon: <Search size={20}/> },
    { id: 'mahsulot', label: 'Menyu', icon: <UtensilsCrossed size={20}/> },
    { id: 'xodim', label: 'Xodim', icon: <Users size={20}/> },
  ]

  return (
    <div className="min-h-screen bg-[#F5F3EE] pb-20">
      {/* Yuqori panel */}
      <div className="bg-[#1C1407] px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div>
          <div className="text-[#F5C842] font-black tracking-widest text-sm">EA MURUNTOV</div>
          <div className="text-gray-500 text-xs">{user?.name} · Rahbar</div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1 rounded-full text-xs font-bold ${shift?.is_open ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/30 text-gray-500'}`}>
            {shift?.is_open ? 'Ochiq' : 'Yopiq'}
          </div>
          <button type="button" aria-label="Chiqish" onClick={() => { clearStoredUser(); router.push('/') }}
            className="border border-gray-600 text-gray-400 rounded-lg p-2"><LogOut size={14}/></button>
        </div>
      </div>

      {loadError && (
        <div className="bg-red-600 text-white px-4 py-2 text-sm font-bold flex items-center justify-between gap-3">
          <span>{loadError}</span>
          <button type="button" onClick={loadAll} className="px-3 py-1 rounded-lg bg-white/20 text-xs font-black">Qayta urinish</button>
        </div>
      )}

      <div className="p-4 max-w-2xl mx-auto">
        {activeTab === 'hisobot' && (
          <ReportTab shift={shift} report={report} oshList={oshList} orderItems={orderItems} writeOffs={writeOffs} stockIns={stockIns}
            workerName={workerName} productName={productName} stockInLabel={stockInLabel} onPDF={generatePDF} />
        )}

        {activeTab === 'tarix' && <HistoryTab products={products} workers={workers} />}

        {activeTab === 'qarzdorlar' && (
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-3 text-gray-400"/>
              <input type="text" placeholder="Ism yoki telefon..." aria-label="Qarzdor qidirish" value={debtorSearch} onChange={e => setDebtorSearch(e.target.value)}
                className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none bg-white"/>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {filteredDebtors.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-300">
                  <div className="text-3xl mb-2">🔍</div>
                  <div className="text-sm font-bold">Topilmadi</div>
                </div>
              ) : filteredDebtors.map(d => (
                <DebtorCard key={d.id} debtor={d} products={products}
                  onUpdate={(id, newDebt) => { setDebtors(prev => prev.map(x => x.id === id ? { ...x, total_debt: newDebt } : x)) }}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'mahsulot' && (
          <MenuTab categories={categories} products={products} setCategories={setCategories} setProducts={setProducts} showToast={showToast} />
        )}

        {activeTab === 'xodim' && (
          <div className="flex flex-col gap-3">
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="font-black text-sm mb-3">Xodim qo&apos;shish</div>
              <div className="flex flex-col gap-2">
                <input value={newWorkerName} onChange={e => setNewWorkerName(e.target.value)} placeholder="Xodim ismi" aria-label="Xodim ismi"
                  className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C8860A]"/>
                <input value={newWorkerPin} onChange={e => setNewWorkerPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="4 xonali PIN" inputMode="numeric" aria-label="Xodim PIN"
                  className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C8860A]"/>
                <button type="button" onClick={addWorker} className="py-2.5 bg-[#C8860A] text-[#1A1208] rounded-xl font-black text-sm">Xodim qo&apos;shish</button>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 font-black text-sm">Xodimlar ({workers.length} ta)</div>
              {workers.map(w => (
                <div key={w.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
                  <div className="w-10 h-10 rounded-full bg-[#FFF8E7] border-2 border-[#F5C842] flex items-center justify-center font-black text-[#C8860A] text-sm flex-shrink-0">{w.name[0]}</div>
                  <div className="flex-1">
                    <div className="font-bold text-sm">{w.name}</div>
                    <div className="text-xs text-gray-400">PIN: {w.pin}</div>
                  </div>
                  <button type="button" aria-label={`${w.name} o'chirish`} onClick={() => deleteWorker(w)} className="text-gray-300 hover:text-red-500 text-lg px-2">x</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pastki menyu */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#1C1407] border-t border-[#3D2E10] z-40">
        <div className="flex max-w-2xl mx-auto">
          {tabs.map(t => (
            <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex flex-col items-center py-2 gap-0.5 ${activeTab === t.id ? 'text-[#F5C842]' : 'text-gray-600'}`}>
              {t.icon}
              <span className="text-[10px] font-bold">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-[#1A1208] text-[#F5C842] px-5 py-2.5 rounded-full text-sm font-bold z-50 shadow-lg whitespace-nowrap">{toast}</div>
      )}
    </div>
  )
}
