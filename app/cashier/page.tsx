'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Clock, LogOut, PackageMinus, PackagePlus, Search, UtensilsCrossed, X } from 'lucide-react'
import Modal from '@/components/Modal'
import {
  canSetQty, extraQty, extraSummary, isVisible as isProductVisible, stockModeOf, toBalances,
  type Balances, type NewOrderExtra, type StockMode,
} from '@/lib/stock'
import { matchesQuery } from '@/lib/search'
import { friendlyError } from '@/lib/errors'
import { clearStoredUser, getStoredUser, type SessionUser } from '@/lib/session'
import { downloadCloseShiftPdf } from '@/lib/closePdf'
import { fmt } from '@/lib/format'
import { portionLabel } from '@/lib/osh'
import type { Bill, CartItem, Category, Debtor, PrevStock, Product, Shift } from '@/lib/types'
import MenuTab from '../admin/components/MenuTab'
import Cart from './components/Cart'
import DebtorsModal from './components/DebtorsModal'
import NumberPad from './components/NumberPad'
import { MoslashuvModal, PayModal, type PayPayload } from './components/PayModals'
import ProductCard from './components/ProductCard'
import { CloseShiftModal, ShiftModal, ShiftStartModal, type ShiftReportInput } from './components/ShiftModals'
import { ChiqimModal, KirimModal, type ChiqimPayload, type KirimPayload } from './components/StockModals'

type ActiveModal = null | 'pay' | 'kirim' | 'chiqim' | 'smena' | 'moslashuv' | 'debtors' | 'close_shift' | 'shift_start'

// Tepa paneldagi kichik tugma (ikonka)
function HeaderButton({ label, onClick, color, border, children }: { label: string; onClick: () => void; color: string; border?: string; children: React.ReactNode }) {
  return (
    <button aria-label={label} title={label} onClick={onClick}
      style={{ width: 32, height: 32, borderRadius: 8, border: border ?? 'none', background: border ? 'rgba(0,0,0,0)' : 'rgba(61,46,16,0.8)', color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
      {children}
    </button>
  )
}

export default function CashierPage() {
  const router = useRouter()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [shift, setShift] = useState<Shift | null>(null)
  const [balances, setBalances] = useState<Balances>({})
  const [debtors, setDebtors] = useState<Debtor[]>([])
  const [prevStocks, setPrevStocks] = useState<PrevStock[]>([])
  const [shiftReport, setShiftReport] = useState<ShiftReportInput>({})
  const [activeCat, setActiveCat] = useState('Barchasi')
  const [search, setSearch] = useState('')
  const [padFor, setPadFor] = useState<Product | null>(null)
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)
  const [kirimInit, setKirimInit] = useState<{ productId: string; mode: 'kg' | 'portion' }>({ productId: '', mode: 'kg' })
  const [moslashuvActual, setMoslashuvActual] = useState<number | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [payError, setPayError] = useState('')
  const orderRequestId = useRef<{ id: string; sig: string } | null>(null)
  const busy = useRef(false)

  // Hisoblar (savat) brauzerda saqlanadi: sahifa yangilansa yo'qolmaydi
  const [bills, setBills] = useState<Bill[]>(() => {
    if (typeof window === 'undefined') return [{ id: 1, cart: [] }]
    try { const s = localStorage.getItem('pos_bills'); return s ? JSON.parse(s) : [{ id: 1, cart: [] }] }
    catch { return [{ id: 1, cart: [] }] }
  })
  const [activeBillId, setActiveBillId] = useState<number>(() => {
    if (typeof window === 'undefined') return 1
    try { const s = localStorage.getItem('pos_active_bill'); return s ? parseInt(s) : 1 }
    catch { return 1 }
  })
  const [nextBillId, setNextBillId] = useState<number>(() => {
    if (typeof window === 'undefined') return 2
    try { const s = localStorage.getItem('pos_next_bill'); return s ? parseInt(s) : 2 }
    catch { return 2 }
  })

  const activeBill = bills.find(b => b.id === activeBillId)!
  const cart = activeBill?.cart || []

  useEffect(() => {
    localStorage.setItem('pos_bills', JSON.stringify(bills))
    localStorage.setItem('pos_active_bill', String(activeBillId))
    localStorage.setItem('pos_next_bill', String(nextBillId))
  }, [bills, activeBillId, nextBillId])

  useEffect(() => {
    const parsed = getStoredUser()
    if (!parsed) { router.push('/'); return }
    if (parsed.role !== 'worker') { router.push('/admin'); return }
    // Kirgan xodim faqat brauzerda (localStorage) bor, shuning uchun bu yerda o'qiladi
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(parsed)
    // eslint-disable-next-line react-hooks/immutability
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  // Amal bajarayotgan xodim; yo'q bo'lsa qayta kirish so'raladi
  const currentUserId = (): string | null => {
    const id = getStoredUser()?.id ?? null
    if (!id) { showToast('Qayta kiring'); router.push('/') }
    return id
  }

  // ---- Ma'lumot yuklash
  const loadData = async () => {
    const [{ data: cats }, { data: prods }, { data: dbtrs }] = await Promise.all([
      supabase.from('categories').select('*').order('order_num'),
      supabase.from('products').select('*').order('created_at'),
      supabase.from('debtors').select('*').order('name'),
    ])
    if (!cats || !prods) { setLoadError("Ma'lumot yuklanmadi. Internetni tekshiring."); return }
    setCategories(cats)
    setProducts(prods)
    setDebtors(dbtrs || [])

    const { data: shiftData, error: shiftErr } = await supabase
      .from('shifts').select('*').eq('is_open', true).order('opened_at', { ascending: false }).limit(1).maybeSingle()
    if (shiftErr) { setLoadError("Smena ma'lumoti yuklanmadi. Internetni tekshiring."); return }

    setShift(shiftData || null)
    if (shiftData?.id) {
      if (!(await loadBalances(shiftData.id))) return
    } else {
      setBalances({})
    }
    setLoadError('')
  }

  // Qoldiqlar bazadagi shift_balances funksiyasidan olinadi (yagona haqiqat manbai)
  const loadBalances = async (shiftId: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('shift_balances', { p_shift_id: shiftId })
    if (error) { setLoadError(`Qoldiqlar yuklanmadi: ${friendlyError(error)}`); return false }
    setBalances(toBalances(data))
    setLoadError('')
    return true
  }

  // ---- Qoldiq qoidalari
  const modeOf = (p: Product): StockMode => stockModeOf(p)
  const getBalance = (productId: string): number => balances[productId]?.balance ?? 0
  const unitOf = (p: Product) => (p.litr_per_unit && p.litr_per_unit > 0 ? 'stakan' : 'ta')
  const isVisible = (p: Product): boolean => isProductVisible(p, modeOf(p), getBalance(p.id))

  // Savatdagi miqdorni `qty` ga chiqarish mumkinmi? Mumkin bo'lmasa xabar chiqaradi.
  const checkQty = (p: Product, qty: number): boolean => {
    if (canSetQty(modeOf(p), getBalance(p.id), qty)) return true
    showToast(`${p.name} tugadi!`)
    return false
  }

  // ---- Smena ochish / yopish
  const openShift = async () => {
    setLoading(true)
    // Ochiq smena allaqachon bo'lsa (boshqa planshet ochgan) shuni ishlatamiz
    const { data: existingOpen } = await supabase.from('shifts').select('*').eq('is_open', true).order('opened_at', { ascending: false }).limit(1).maybeSingle()
    if (existingOpen) {
      showToast('Mavjud smena topildi!')
      setLoading(false)
      await loadData()
      return
    }

    // Oxirgi yopilgan smenadan qoldiq qolganmi?
    const { data: lastShift } = await supabase.from('shifts').select('id').eq('is_open', false).order('closed_at', { ascending: false }).limit(1).maybeSingle()
    if (lastShift?.id) {
      const { data: lastReport } = await supabase.from('shift_reports').select('product_id, actual_qty, products(name)').eq('shift_id', lastShift.id).gt('actual_qty', 0)
      if (lastReport && lastReport.length > 0) {
        const prevList: PrevStock[] = lastReport.map(r => ({
          product_id: r.product_id as string,
          name: ((r.products as unknown as { name?: string } | null)?.name) || '',
          qty: Number(r.actual_qty), qty_original: Number(r.actual_qty), note: '',
        }))
        setPrevStocks(prevList); setLoading(false); setActiveModal('shift_start'); return
      }
    }
    await doOpenShift([])
  }

  // Smena ochish bazadagi open_shift funksiyasida bajariladi: smena, boshlang'ich qoldiq, tashlangan qoldiq
  // va osh qozoni bitta tranzaksiyada. Ikki planshet bir vaqtda bossa, ikkinchisiga mavjud smena qaytadi.
  const doOpenShift = async (stocks: PrevStock[]) => {
    if (busy.current) return
    const uid = currentUserId()
    if (!uid) return
    busy.current = true
    setLoading(true)
    try {
      const items = stocks.map(ps => ({ product_id: ps.product_id, qty: ps.qty, qty_original: ps.qty_original, note: ps.note.trim() }))
      const { data, error } = await supabase.rpc('open_shift', { p_worker_id: uid, p_items: items })
      if (error) { showToast(`Smena ochilmadi: ${friendlyError(error)}`); return }
      // Oynani darrov yopamiz: ma'lumot yuklanishini kutib turganda kassir boshqa oyna ochgan bo'lishi mumkin
      setActiveModal(null); setPrevStocks([])
      showToast((data as { existing?: boolean }).existing ? 'Mavjud smena topildi!' : 'Smena ochildi!')
      await loadData()
    } finally {
      busy.current = false
      setLoading(false)
    }
  }

  // Tizim qoldig'idan farq qilgan har bir mahsulot uchun izoh majburiy
  const closeShiftMissingNotes = () => products.filter(p => {
    const rep = shiftReport[p.id]
    if (!rep || rep.actual === '') return false
    const actual = parseFloat(rep.actual)
    return Number.isFinite(actual) && actual !== getBalance(p.id) && !rep.note?.trim()
  })

  // Smena yopish bazadagi close_shift funksiyasida: tizim qoldig'i serverda hisoblanadi,
  // hisobot qatorlari va smena yopilishi birga yoziladi. PDF faqat muvaffaqiyatdan keyin yaratiladi.
  const closeShift = async () => {
    if (!shift || busy.current) return
    const uid = currentUserId()
    if (!uid) return
    const missing = closeShiftMissingNotes()
    if (missing.length > 0) {
      showToast(`Izoh yozing: ${missing.slice(0, 3).map(p => p.name).join(', ')}${missing.length > 3 ? ' ...' : ''}`)
      return
    }
    busy.current = true
    setLoading(true)
    try {
      const rows = products
        .filter(p => shiftReport[p.id]?.actual !== undefined && shiftReport[p.id].actual !== '' && Number.isFinite(parseFloat(shiftReport[p.id].actual)))
        .map(p => ({ product_id: p.id, actual_qty: parseFloat(shiftReport[p.id].actual), note: shiftReport[p.id].note?.trim() || '' }))
      const { data, error } = await supabase.rpc('close_shift', { p_shift_id: shift.id, p_worker_id: uid, p_rows: rows })
      if (error) { showToast(friendlyError(error)); return }

      const reportRows = ((data as { rows: { product_id: string; system_qty: number; actual_qty: number; diff: number; note: string }[] }).rows || []).map(r => ({
        name: products.find(p => p.id === r.product_id)?.name || "Noma'lum",
        system_qty: Number(r.system_qty), actual_qty: Number(r.actual_qty), diff: Number(r.diff), note: r.note,
      }))
      const openedAt = shift.opened_at
      localStorage.removeItem('pos_bills'); localStorage.removeItem('pos_active_bill'); localStorage.removeItem('pos_next_bill')
      setBills([{ id: 1, cart: [] }]); setActiveBillId(1); setNextBillId(2)
      setShift(null); setBalances({}); setShiftReport({}); setActiveModal(null)
      try {
        await downloadCloseShiftPdf(openedAt, reportRows)
        showToast('Smena yopildi! PDF yuklab olindi.')
      } catch {
        showToast('Smena yopildi, lekin PDF yaratilmadi. Rahbarga ayting.')
      }
    } finally {
      busy.current = false
      setLoading(false)
    }
  }

  // ---- Hisoblar va savat
  const addBill = () => {
    if (!shift) { showToast('Avval smena oching!'); return }
    if (bills.length >= 5) { showToast('Maksimal 5 ta hisob!'); return }
    const nb: Bill = { id: nextBillId, cart: [] }
    setBills(prev => [...prev, nb]); setActiveBillId(nextBillId); setNextBillId(prev => prev + 1)
  }

  const removeBill = (id: number) => {
    if (bills.length === 1) { showToast('Kamida 1 ta hisob!'); return }
    const bill = bills.find(b => b.id === id)
    if (bill && bill.cart.length > 0 && !window.confirm(`Hisob No${id} da mahsulot bor. O'chirilsinmi?`)) return
    const remaining = bills.filter(b => b.id !== id)
    setBills(remaining); if (activeBillId === id) setActiveBillId(remaining[0].id)
  }

  const updateBillCart = (newCart: CartItem[]) => setBills(prev => prev.map(b => b.id === activeBillId ? { ...b, cart: newCart } : b))
  const cartQty = (id: string) => cart.find(i => i.product.id === id)?.qty || 0
  const total = cart.reduce((s, i) => s + i.product.price * i.qty, 0)

  const addToCart = (product: Product) => {
    if (!shift) { showToast('Avval smena oching!'); return }
    if (!product.is_available) return
    const existing = cart.find(i => i.product.id === product.id)
    if (!checkQty(product, (existing?.qty || 0) + 1)) return
    if (existing) updateBillCart(cart.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i))
    else updateBillCart([...cart, { product, qty: 1 }])
  }

  // Savatdagi miqdorni to'g'ridan-to'g'ri belgilash (raqam paneli). 0 = savatdan olib tashlash.
  const setCartQty = (product: Product, n: number): boolean => {
    if (!shift) { showToast('Avval smena oching!'); return false }
    if (n <= 0) { updateBillCart(cart.filter(i => i.product.id !== product.id)); return true }
    if (!checkQty(product, n)) return false
    const existing = cart.find(i => i.product.id === product.id)
    updateBillCart(existing ? cart.map(i => i.product.id === product.id ? { ...i, qty: n } : i) : [...cart, { product, qty: n }])
    return true
  }

  const changeQty = (productId: string, delta: number) => {
    const prod = products.find(p => p.id === productId)
    if (delta > 0 && prod && !checkQty(prod, cartQty(productId) + delta)) return
    updateBillCart(cart.map(i => i.product.id === productId ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0))
  }

  // ---- Mahsulotlar ro'yxati: qidiruv, kategoriya, tez-tez sotiladiganlar
  const query = search.trim()
  const filteredProducts = (query
    ? products.filter(p => matchesQuery(p.name, query))
    : activeCat === 'Barchasi'
      ? products
      : products.filter(p => { const cat = categories.find(c => c.name === activeCat); return cat && p.category_id === cat.id })
  ).filter(p => isVisible(p))
  const favorites = products.filter(p => p.is_favorite && isVisible(p))

  const openKirim = (p?: Product) => {
    setKirimInit({ productId: p?.id ?? '', mode: p?.unit_type === 'hissa' ? 'portion' : 'kg' })
    setActiveModal('kirim')
  }

  const renderCard = (p: Product, compact = false) => (
    <ProductCard key={`${p.id}${compact ? '-tez' : ''}`} compact={compact} name={p.name} price={p.price}
      qty={cartQty(p.id)} mode={modeOf(p)} balance={getBalance(p.id)} unit={unitOf(p)}
      onAdd={() => addToCart(p)}
      onLongPress={() => { if (!shift) { showToast('Avval smena oching!'); return } setPadFor(p) }}
      onRestock={() => openKirim(p)} />
  )

  // ---- Buyurtma
  const confirmOrder = async ({ payType, debtorId, newDebtorName }: PayPayload) => {
    if (cart.length === 0 || !shift || busy.current) return
    busy.current = true
    setLoading(true)
    setPayError('')
    try {
      const uid = currentUserId()
      if (!uid) return
      const paymentNote = moslashuvActual && moslashuvActual !== total ? `Moslashuv: ${fmt(moslashuvActual)} som (farq: ${fmt(moslashuvActual - total)} som)` : null
      const items = cart.map(i => ({ product_id: i.product.id, qty: i.qty }))

      // Bir xil buyurtma qayta yuborilsa (internet uzilib qayta bosilsa) bazada ikkinchisi yaratilmaydi
      const sig = JSON.stringify([payType, items, debtorId, newDebtorName, moslashuvActual])
      if (orderRequestId.current?.sig !== sig) orderRequestId.current = { id: crypto.randomUUID(), sig }

      const { data, error } = await supabase.rpc('create_order', {
        p_shift_id: shift.id,
        p_worker_id: uid,
        p_pay_type: payType,
        p_items: items,
        p_debtor_id: debtorId,
        p_debtor_name: newDebtorName || null,
        p_debtor_phone: null,
        p_actual_paid: moslashuvActual,
        p_payment_note: paymentNote,
        p_request_id: orderRequestId.current.id,
      })

      if (error) {
        setPayError(friendlyError(error))
        // Qoldiq o'zgargan bo'lishi mumkin (boshqa planshetda sotilgan) - yangilab qo'yamiz
        if (error.message === 'SHIFT_CLOSED') await loadData()
        else if (error.message !== 'DEBTOR_REQUIRED') await loadBalances(shift.id)
        return
      }

      const result = data as { extra?: NewOrderExtra[] }
      orderRequestId.current = null
      updateBillCart([]); setMoslashuvActual(null); setActiveModal(null)
      if (payType === 'qarz') {
        const { data: dbtrs } = await supabase.from('debtors').select('*').order('name')
        if (dbtrs) setDebtors(dbtrs)
      }
      await loadBalances(shift.id)
      const extra = extraSummary(result.extra)
      showToast(extra ? `Hisob ${activeBillId} tasdiqlandi! Avto-kirim: ${extra}` : `Hisob ${activeBillId} tasdiqlandi!`)
    } finally {
      busy.current = false
      setLoading(false)
    }
  }

  // ---- Kirim / chiqim
  const confirmKirim = async (payload: KirimPayload) => {
    if (!shift || busy.current) return
    const prod = products.find(p => p.id === payload.productId)
    if (!prod) return
    const byPortion = prod.unit_type === 'hissa' && payload.mode === 'portion'
    const entered = parseFloat(payload.qty)
    const savedQty = prod.litr_per_unit ? Math.floor(entered / prod.litr_per_unit) : entered
    if (byPortion ? payload.portions.length === 0 : !(savedQty > 0)) { showToast("Miqdor noto'g'ri"); return }
    busy.current = true
    setLoading(true)
    try {
      const uid = currentUserId()
      if (!uid) return
      const { data, error } = byPortion
        ? await supabase.rpc('add_osh_portions', {
            p_shift_id: shift.id, p_worker_id: uid,
            p_items: payload.portions.map(i => ({ product_id: i.productId, qty: i.qty })),
          })
        : await supabase.rpc('add_stock_in', { p_shift_id: shift.id, p_worker_id: uid, p_product_id: prod.id, p_qty: savedQty })
      if (error) { showToast(friendlyError(error)); return }

      // "Yo'q" qilingan mahsulotga kirim kelsa, baza uni avtomatik "Bor" qiladi
      const ids = byPortion ? payload.portions.map(i => i.productId) : [prod.id]
      const madeAvailable = byPortion
        ? payload.portions.some(i => !products.find(p => p.id === i.productId)?.is_available)
        : !!(data as { made_available?: boolean }).made_available
      if (madeAvailable) setProducts(prev => prev.map(p => ids.includes(p.id) ? { ...p, is_available: true } : p))
      await loadBalances(shift.id)

      const kirimText = byPortion
        ? `Kirim qilindi: ${payload.portions.map(i => `${i.qty} ${portionLabel(products.find(p => p.id === i.productId) || { id: i.productId, name: '' })}`).join(' + ')}`
        : prod.litr_per_unit ? `${entered}L = ${savedQty} stakan kirim!` : 'Kirim qilindi!'
      showToast(madeAvailable && !byPortion ? `${kirimText} "${prod.name}" menuga qo'shildi.` : kirimText)
      setActiveModal(null)
    } finally {
      busy.current = false
      setLoading(false)
    }
  }

  const confirmChiqim = async ({ productId, qty, reason }: ChiqimPayload) => {
    const amount = parseInt(qty)
    if (!productId || !shift || !reason.trim() || busy.current) return
    if (!(amount > 0)) { showToast("Miqdor noto'g'ri"); return }
    busy.current = true
    setLoading(true)
    try {
      const uid = currentUserId()
      if (!uid) return
      const { error } = await supabase.rpc('add_write_off', {
        p_shift_id: shift.id, p_worker_id: uid, p_product_id: productId, p_qty: amount, p_reason: reason.trim(),
      })
      if (error) { showToast(friendlyError(error)); return }
      await loadBalances(shift.id)
      setActiveModal(null)
      showToast('Chiqim qilindi!')
    } finally {
      busy.current = false
      setLoading(false)
    }
  }

  return (
    <div className="h-screen bg-[#F5F3EE] flex flex-col overflow-hidden">
      <div className="bg-[#1C1407] px-3 py-2 flex items-center justify-between flex-shrink-0">
        <div>
          <div className="text-[#F5C842] font-black tracking-widest text-sm">EA MURUNTOV</div>
          <div className="text-gray-500 text-xs">{user?.name} · Kassir</div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <HeaderButton label="Smena" onClick={() => setActiveModal('smena')} color={shift ? '#4ade80' : '#f87171'} border={shift ? '1px solid #22c55e' : '1px solid #ef4444'}><Clock size={14}/></HeaderButton>
          {shift && <>
            <HeaderButton label="Kirim" onClick={() => openKirim()} color="#F5C842"><PackagePlus size={13}/></HeaderButton>
            <HeaderButton label="Chiqim" onClick={() => setActiveModal('chiqim')} color="#f87171"><PackageMinus size={13}/></HeaderButton>
            <HeaderButton label="Qarzdorlar" onClick={() => setActiveModal('debtors')} color="#fbbf24"><Search size={13}/></HeaderButton>
          </>}
          <HeaderButton label="Menyu" onClick={() => setShowMenu(true)} color="#a78bfa"><UtensilsCrossed size={13}/></HeaderButton>
          <HeaderButton label="Chiqish" onClick={() => { clearStoredUser(); router.push('/') }} color="#9ca3af" border="1px solid #4b5563"><LogOut size={13}/></HeaderButton>
        </div>
      </div>

      {loadError && (
        <div className="bg-red-600 text-white px-4 py-2 text-sm font-bold flex items-center justify-between gap-3 flex-shrink-0">
          <span>{loadError}</span>
          <button onClick={loadData} className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-black">Qayta urinish</button>
        </div>
      )}

      {!shift ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          <div className="text-5xl">🔒</div>
          <div className="font-black text-xl text-[#1A1208]">Smena yopiq</div>
          <div className="text-gray-400 text-sm text-center">Savdo boshlash uchun smena oching</div>
          <button onClick={openShift} disabled={loading} className="px-8 py-4 rounded-2xl font-black text-white text-base disabled:opacity-50 bg-[#1E7B47]">
            {loading ? '...' : 'Smena ochish'}
          </button>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-col border-r border-[#E0DDD5]" style={{ width: '62%' }}>
            <div className="bg-[#2C200A] px-3 pt-2 flex-shrink-0">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3 text-gray-500"/>
                <input type="text" inputMode="search" placeholder="Taom qidirish..." aria-label="Taom qidirish" value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-[#3D2E10] text-[#F5C842] placeholder-gray-500 rounded-xl pl-10 pr-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#C8860A]"/>
                {search && (
                  <button type="button" aria-label="Qidiruvni tozalash" onClick={() => setSearch('')}
                    className="absolute right-1 top-1 w-9 h-9 rounded-full text-gray-400 flex items-center justify-center"><X size={16}/></button>
                )}
              </div>
            </div>
            {!query && (
              <div className="bg-[#2C200A] px-3 py-2 flex gap-2 overflow-x-auto flex-shrink-0">
                {['Barchasi', ...categories.map(c => c.name)].map(cat => (
                  <button key={cat} onClick={() => setActiveCat(cat)}
                    className={`px-5 py-2.5 rounded-full text-base font-bold whitespace-nowrap transition-all flex-shrink-0 ${activeCat === cat ? 'bg-[#C8860A] text-[#1A1208]' : 'bg-[#3D2E10] text-gray-400 hover:text-gray-200'}`}>
                    {cat}
                  </button>
                ))}
              </div>
            )}
            {!query && favorites.length > 0 && (
              <div data-testid="favorites" className="px-3 pt-2 flex-shrink-0 border-b border-[#E0DDD5]">
                <div className="text-[11px] font-black text-[#C8860A] tracking-wide">⭐ TEZ-TEZ SOTILADIGAN</div>
                <div className="flex gap-3 overflow-x-auto pt-3 pb-2 pr-2">
                  {favorites.map(p => renderCard(p, true))}
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-3">
              {query && (
                <div className="text-xs font-bold text-gray-500 mb-2">{filteredProducts.length > 0 ? `${filteredProducts.length} ta topildi` : 'Topilmadi'}</div>
              )}
              <div className="grid grid-cols-3 gap-3">
                {filteredProducts.map(p => renderCard(p))}
              </div>
            </div>
          </div>

          <Cart bills={bills} activeBillId={activeBillId} cart={cart} total={total}
            extraFor={item => extraQty(modeOf(item.product), getBalance(item.product.id), item.qty)}
            onSelectBill={setActiveBillId} onAddBill={addBill} onRemoveBill={removeBill}
            onChangeQty={changeQty} onOpenPad={item => setPadFor(item.product)}
            onAdjust={() => setActiveModal('moslashuv')}
            onCheckout={() => { setPayError(''); setActiveModal('pay') }} />
        </div>
      )}

      {activeModal === 'shift_start' && (
        <ShiftStartModal prevStocks={prevStocks} onChange={setPrevStocks} loading={loading}
          onConfirm={() => doOpenShift(prevStocks)}
          onNoStock={() => doOpenShift(prevStocks.map(ps => ({ ...ps, qty: 0 })))} />
      )}
      {activeModal === 'smena' && (
        <ShiftModal shift={shift} loading={loading} onClose={() => setActiveModal(null)} onOpen={openShift} onClosing={() => setActiveModal('close_shift')} />
      )}
      {activeModal === 'close_shift' && (
        <CloseShiftModal products={products} report={shiftReport} onReport={setShiftReport} getSystemQty={p => getBalance(p.id)}
          loading={loading} onBack={() => setActiveModal('smena')} onConfirm={closeShift} />
      )}
      {activeModal === 'pay' && (
        <PayModal billId={activeBillId} total={total} moslashuvActual={moslashuvActual} debtors={debtors}
          loading={loading} error={payError} onConfirm={confirmOrder} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'moslashuv' && (
        <MoslashuvModal total={total} onClose={() => setActiveModal(null)}
          onConfirm={actual => { setMoslashuvActual(actual); setPayError(''); setActiveModal('pay') }} />
      )}
      {activeModal === 'kirim' && (
        <KirimModal products={products} initialProductId={kirimInit.productId} initialMode={kirimInit.mode} loading={loading}
          onSubmit={confirmKirim} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'chiqim' && (
        <ChiqimModal products={products} loading={loading} onSubmit={confirmChiqim} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'debtors' && (
        <DebtorsModal debtors={debtors} products={products} onClose={() => setActiveModal(null)}
          onUpdate={(id, newDebt) => setDebtors(prev => prev.map(x => x.id === id ? { ...x, total_debt: newDebt } : x))} />
      )}
      {showMenu && (
        <Modal title="Menyu boshqaruvi" variant="center" size="lg" onClose={() => setShowMenu(false)}>
          <div className="p-4 bg-[#F5F3EE]">
            <MenuTab role="worker" categories={categories} products={products} setCategories={setCategories} setProducts={setProducts} showToast={showToast} />
          </div>
        </Modal>
      )}

      {padFor && (
        <NumberPad title={padFor.name} subtitle={`${fmt(padFor.price)} so'm`} initial={cartQty(padFor.id)}
          onClose={() => setPadFor(null)}
          onConfirm={n => { if (setCartQty(padFor, n)) setPadFor(null) }} />
      )}

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-[#1A1208] text-[#F5C842] px-5 py-2.5 rounded-full text-sm font-bold z-[70] shadow-lg">{toast}</div>
      )}
    </div>
  )
}
