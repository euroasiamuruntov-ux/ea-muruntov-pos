'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LogOut, ShoppingCart, Plus, X, PackagePlus, PackageMinus, Clock, Search, UtensilsCrossed } from 'lucide-react'
import DebtorCard from './components/DebtorCard'
import jsPDF from 'jspdf'
import {
  canSetQty, extraQty, extraSummary, isVisible as isProductVisible, stockInfo, stockModeOf, toBalances,
  type Balances, type NewOrderExtra, type StockLevel, type StockMode,
} from '@/lib/stock'
import { friendlyError } from '@/lib/errors'

const LEVEL_STYLE: Record<StockLevel, string> = {
  ok: 'text-green-600', low: 'text-orange-500', empty: 'text-red-500', extra: 'text-amber-600', muted: 'text-gray-400',
}

type User = { id: string; name: string; role: string }
type Category = { id: string; name: string }
type Product = {
  id: string; name: string; price: number; category_id: string
  is_available: boolean; unit_type: string; hissa_per_unit: number
  kg_to_hissa: number; is_unlimited: boolean; unit_label: string
  litr_per_unit: number | null; hide_when_empty: boolean; stock_mode?: StockMode
}
type CartItem = { product: Product; qty: number }
type Bill = { id: number; cart: CartItem[] }
type Shift = { id: string; is_open: boolean; opened_at: string }
type Debtor = { id: string; name: string; phone: string; total_debt: number }
type PrevStock = { product_id: string; name: string; qty: number; qty_original: number; note: string }
type ActiveModal = null | 'pay' | 'kirим' | 'chiqim' | 'smena' | 'moslashuv' | 'debtors' | 'close_shift' | 'shift_start'

export default function CashierPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [shift, setShift] = useState<Shift | null>(null)
  const [balances, setBalances] = useState<Balances>({})
  const [loadError, setLoadError] = useState('')
  const orderRequestId = useRef<{ id: string; sig: string } | null>(null)
  const [payError, setPayError] = useState('')
  const busy = useRef(false)
  const [debtors, setDebtors] = useState<Debtor[]>([])
  const [prevStocks, setPrevStocks] = useState<PrevStock[]>([])
  const [activeCat, setActiveCat] = useState('Barchasi')
  const [payType, setPayType] = useState<'naqd' | 'click' | 'karta' | 'qarz' | 'ichki'>('naqd')
  const [debtorName, setDebtorName] = useState('')
  const [debtorPhone, setDebtorPhone] = useState('')
  const [selectedDebtorId, setSelectedDebtorId] = useState('')
  const [debtorSearch, setDebtorSearch] = useState('')
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newProdName, setNewProdName] = useState('')
  const [newProdPrice, setNewProdPrice] = useState('')
  const [newProdCat, setNewProdCat] = useState('')

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

  const [selectedProd, setSelectedProd] = useState('')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [moslashuvSumma, setMoslashuvSumma] = useState('')
  const [moslashuvActual, setMoslashuvActual] = useState<number | null>(null)
  const [shiftReport, setShiftReport] = useState<{[productId: string]: {actual: string; note: string}}>({})

  const activeBill = bills.find(b => b.id === activeBillId)!
  const cart = activeBill?.cart || []

  useEffect(() => {
    localStorage.setItem('pos_bills', JSON.stringify(bills))
    localStorage.setItem('pos_active_bill', String(activeBillId))
    localStorage.setItem('pos_next_bill', String(nextBillId))
  }, [bills, activeBillId, nextBillId])

  useEffect(() => {
    const u = localStorage.getItem('pos_user')
    if (!u) { router.push('/'); return }
    const parsed = JSON.parse(u)
    if (parsed.role !== 'worker') { router.push('/admin'); return }
    setUser(parsed)
    loadData()
  }, [])

  const loadData = async () => {
    const [{ data: cats }, { data: prods }, { data: dbtrs }] = await Promise.all([
      supabase.from('categories').select('*').order('order_num'),
      supabase.from('products').select('*').order('created_at'),
      supabase.from('debtors').select('*').order('name'),
    ])
    if (!cats || !prods) {
      setLoadError("Ma'lumot yuklanmadi. Internetni tekshiring.")
      return
    }
    setCategories(cats)
    setProducts(prods)
    setDebtors(dbtrs || [])

    const { data: shiftData, error: shiftErr } = await supabase
      .from('shifts')
      .select('*')
      .eq('is_open', true)
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (shiftErr) { setLoadError("Smena ma'lumoti yuklanmadi. Internetni tekshiring."); return }

    setShift(shiftData || null)
    if (shiftData?.id) {
      const ok = await loadBalances(shiftData.id)
      if (!ok) return
    } else {
      setBalances({})
    }
    setLoadError('')
  }

  // Qoldiqlar bazadagi shift_balances funksiyasidan olinadi (yagona haqiqat manbai)
  const loadBalances = async (shiftId: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('shift_balances', { p_shift_id: shiftId })
    if (error) {
      setLoadError(`Qoldiqlar yuklanmadi: ${friendlyError(error)}`)
      return false
    }
    setBalances(toBalances(data))
    setLoadError('')
    return true
  }

  const openKirimFor = (p: Product) => { setSelectedProd(p.id); setQty(''); setActiveModal('kirим') }

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }
  const fmt = (n: number) => n.toLocaleString('uz-UZ')

  const modeOf = (p: Product): StockMode => stockModeOf(p)
  const getBalance = (productId: string): number => balances[productId]?.balance ?? 0
  const getSystemQty = (product: Product): number => getBalance(product.id)
  const unitOf = (p: Product) => (p.litr_per_unit && p.litr_per_unit > 0 ? 'stakan' : 'ta')

  // Mahsulot ko'rinadimi?
  const isVisible = (p: Product): boolean => isProductVisible(p, modeOf(p), getBalance(p.id))

  // Savatdagi miqdorni `qty` ga chiqarish mumkinmi? Mumkin bo'lmasa xabar chiqaradi.
  const checkQty = (p: Product, qty: number): boolean => {
    if (canSetQty(modeOf(p), getBalance(p.id), qty)) return true
    showToast(`${p.name} tugadi!`)
    return false
  }

  const openShift = async () => {
  setLoading(true)

  // Avval ochiq smena bormi — tekshiramiz
  const { data: existingOpen } = await supabase
    .from('shifts')
    .select('*')
    .eq('is_open', true)
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingOpen) {
    // Ochiq smena bor — uni ishlatamiz
    setShift(existingOpen)
    showToast('Mavjud smena topildi!')
    setLoading(false)
    await loadData()
    return
  }

  // Yopiq oxirgi smenaning qoldig'ini olamiz
  const { data: lastShift } = await supabase
    .from('shifts').select('id')
    .eq('is_open', false)
    .order('closed_at', { ascending: false })
    .limit(1).maybeSingle()

  if (lastShift?.id) {
    const { data: lastReport } = await supabase
      .from('shift_reports').select('*, products(name)')
      .eq('shift_id', lastShift.id).gt('actual_qty', 0)
    if (lastReport && lastReport.length > 0) {
      const prevList: PrevStock[] = lastReport.map((r: any) => ({
        product_id: r.product_id, name: r.products?.name || '',
        qty: r.actual_qty, qty_original: r.actual_qty, note: ''
      }))
      setPrevStocks(prevList); setLoading(false); setActiveModal('shift_start'); return
    }
  }
  await doOpenShift()
}

  const doOpenShift = async (customPrevStocks?: PrevStock[]) => {
    setLoading(true)
    const u = JSON.parse(localStorage.getItem('pos_user') || '{}')
    const { data, error } = await supabase.from('shifts').insert({ opened_by: u.id, is_open: true }).select().single()
    if (error || !data) {
      showToast(`Smena ochilmadi: ${friendlyError(error)}`)
      setLoading(false)
      return
    }
    {
      const workingPrevStocks = customPrevStocks ?? prevStocks
      const stockRows = products.map(p => { const prev = workingPrevStocks.find(ps => ps.product_id === p.id); return { shift_id: data.id, product_id: p.id, initial_qty: prev ? prev.qty : 0 } })
      await supabase.from('shift_stock').insert(stockRows)
      const reducedProducts = workingPrevStocks.filter(ps => ps.qty < ps.qty_original)
      if (reducedProducts.length > 0) {
        await supabase.from('write_offs').insert(reducedProducts.map(ps => ({ shift_id: data.id, product_id: ps.product_id, qty: ps.qty_original - ps.qty, reason: ps.note || 'Smena boshida chiqindi', worker_id: u.id })))
      }
      const oshProducts = products.filter(p => p.unit_type === 'hissa')
      if (oshProducts.length > 0) {
        const butun = oshProducts.find(p => p.hissa_per_unit === 3)
        const yarim = oshProducts.find(p => p.hissa_per_unit === 2)
        const butunQty = workingPrevStocks.find(ps => ps.product_id === butun?.id)?.qty || 0
        const yarimQty = workingPrevStocks.find(ps => ps.product_id === yarim?.id)?.qty || 0
        const totalHissa = butunQty * 3
        if (totalHissa > 0) { await supabase.from('osh_stock').insert({ shift_id: data.id, product_group: 'osh', total_hissa: totalHissa }) }
        else if (yarimQty > 0) { await supabase.from('osh_stock').insert({ shift_id: data.id, product_group: 'osh', total_hissa: yarimQty * 2 }) }
      }
      // Oynani darrov yopamiz: ma'lumot yuklanishini kutib turganda kassir boshqa oyna
      // (kirim, to'lov) ochgan bo'lishi mumkin, uni keyin yopib yubormaslik kerak.
      setShift(data); setActiveModal(null); showToast('Smena ochildi!'); setPrevStocks([])
      await loadData()
    }
    setLoading(false)
  }

  const closeShift = async () => {
    if (!shift) return
    setLoading(true)
    const u = JSON.parse(localStorage.getItem('pos_user') || '{}')
    const reportRows = products.map(p => { const systemQty = getSystemQty(p); const rep = shiftReport[p.id]; const actual = !rep?.actual ? systemQty : parseFloat(rep.actual); const diff = actual - systemQty; return { shift_id: shift.id, product_id: p.id, system_qty: systemQty, actual_qty: actual, diff, note: rep?.note || '' } })
    await supabase.from('shift_reports').insert(reportRows)
    await supabase.from('shifts').update({ is_open: false, closed_at: new Date().toISOString(), closed_by: u.id }).eq('id', shift.id)
    generateShiftPDF(reportRows)
    localStorage.removeItem('pos_bills'); localStorage.removeItem('pos_active_bill'); localStorage.removeItem('pos_next_bill')
    setBills([{ id: 1, cart: [] }]); setActiveBillId(1); setNextBillId(2)
    setShift(null); setBalances({}); setShiftReport({})
    showToast('Smena yopildi! PDF yuklab olindi.'); setLoading(false); setActiveModal(null)
  }

  const generateShiftPDF = (reportRows: { product_id: string; system_qty: number; actual_qty: number; diff: number; note: string }[]) => {
    const doc = new jsPDF(); let y = 20
    doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text('EA MURUNTOV - Smena Hisoboti', 105, y, { align: 'center' }); y += 10
    doc.setFontSize(10); doc.setFont('helvetica', 'normal')
    doc.text(`Sana: ${new Date().toLocaleDateString('ru-RU')}`, 105, y, { align: 'center' }); y += 6
    doc.text(`Smena: ${new Date(shift!.opened_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} - ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`, 105, y, { align: 'center' }); y += 10
    doc.setLineWidth(0.5); doc.line(20, y, 190, y); y += 8
    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text('Mahsulot hisobi:', 20, y); y += 8
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setFillColor(240, 240, 240); doc.rect(20, y - 4, 170, 8, 'F')
    doc.text('Mahsulot', 22, y); doc.text('Tizim', 110, y); doc.text('Haqiqiy', 130, y); doc.text('Farq', 155, y); y += 8
    doc.setFont('helvetica', 'normal')
    reportRows.forEach(r => {
      if (y > 265) { doc.addPage(); y = 20 }
      const prod = products.find(p => p.id === r.product_id)
      if (r.diff !== 0) doc.setTextColor(180, 50, 50); else doc.setTextColor(0, 0, 0)
      doc.text((prod?.name || 'Noma\'lum').slice(0, 35), 22, y); doc.text(String(r.system_qty), 115, y); doc.text(String(r.actual_qty), 135, y)
      doc.text(r.diff === 0 ? '-' : (r.diff > 0 ? '+' : '') + String(r.diff), 158, y)
      if (r.note) { y += 5; doc.setFontSize(8); doc.setTextColor(120, 120, 120); doc.text(`  Izoh: ${r.note}`, 22, y); doc.setFontSize(9); doc.setTextColor(0, 0, 0) }
      doc.setTextColor(0, 0, 0); y += 7
    })
    doc.setFontSize(8); doc.setTextColor(150, 150, 150); doc.text('Zarafshon Dasturchilari | EA Muruntov POS', 105, 285, { align: 'center' })
    doc.save(`smena-hisobot-${new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')}-${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }).replace(':', '-')}.pdf`)
  }

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

  const filteredProducts = (activeCat === 'Barchasi'
    ? products
    : products.filter(p => { const cat = categories.find(c => c.name === activeCat); return cat && p.category_id === cat.id })
  ).filter(p => isVisible(p))

  const filteredDebtors = debtors.filter(d => d.name.toLowerCase().includes(debtorSearch.toLowerCase()) || (d.phone || '').includes(debtorSearch))

  const addToCart = (product: Product) => {
    if (!shift) { showToast('Avval smena oching!'); return }
    if (!product.is_available) return
    const existing = cart.find(i => i.product.id === product.id)
    if (!checkQty(product, (existing?.qty || 0) + 1)) return
    if (existing) updateBillCart(cart.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i))
    else updateBillCart([...cart, { product, qty: 1 }])
  }

  const changeQty = (productId: string, delta: number) => {
    const prod = products.find(p => p.id === productId)
    if (delta > 0 && prod && !checkQty(prod, (cart.find(i => i.product.id === productId)?.qty || 0) + delta)) return
    updateBillCart(cart.map(i => i.product.id === productId ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0))
  }

  const total = cart.reduce((s, i) => s + i.product.price * i.qty, 0)
  const cartQty = (id: string) => cart.find(i => i.product.id === id)?.qty || 0

  const confirmOrder = async () => {
    if (cart.length === 0 || !shift || busy.current) return
    busy.current = true
    setLoading(true)
    setPayError('')
    try {
      const u = JSON.parse(localStorage.getItem('pos_user') || '{}')
      const paymentNote = moslashuvActual && moslashuvActual !== total ? `Moslashuv: ${fmt(moslashuvActual)} som (farq: ${fmt(moslashuvActual - total)} som)` : null
      const items = cart.map(i => ({ product_id: i.product.id, qty: i.qty }))
      const debtorId = payType === 'qarz' && selectedDebtorId ? selectedDebtorId : null
      const newDebtorName = payType === 'qarz' && !selectedDebtorId ? (debtorName.trim() || debtorSearch.trim()) : ''

      // Bir xil buyurtma qayta yuborilsa (internet uzilib qayta bosilsa) bazada ikkinchisi yaratilmaydi
      const sig = JSON.stringify([payType, items, debtorId, newDebtorName, moslashuvActual])
      if (orderRequestId.current?.sig !== sig) orderRequestId.current = { id: crypto.randomUUID(), sig }

      const { data, error } = await supabase.rpc('create_order', {
        p_shift_id: shift.id,
        p_worker_id: u.id,
        p_pay_type: payType,
        p_items: items,
        p_debtor_id: debtorId,
        p_debtor_name: newDebtorName || null,
        p_debtor_phone: payType === 'qarz' ? debtorPhone.trim() : null,
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
      updateBillCart([]); setDebtorName(''); setDebtorPhone(''); setSelectedDebtorId(''); setDebtorSearch('')
      setPayType('naqd'); setMoslashuvActual(null); setActiveModal(null)
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

  const confirmKirim = async () => {
    if (!selectedProd || !qty || !shift || busy.current) return
    const prod = products.find(p => p.id === selectedProd)
    const entered = parseFloat(qty)
    const savedQty = prod?.litr_per_unit ? Math.floor(entered / prod.litr_per_unit) : entered
    if (!prod || !(savedQty > 0)) { showToast("Miqdor noto'g'ri"); return }
    busy.current = true
    setLoading(true)
    try {
      const u = JSON.parse(localStorage.getItem('pos_user') || '{}')
      const { data, error } = await supabase.rpc('add_stock_in', {
        p_shift_id: shift.id, p_worker_id: u.id, p_product_id: selectedProd, p_qty: savedQty,
      })
      if (error) { showToast(friendlyError(error)); return }
      const madeAvailable = (data as { made_available?: boolean }).made_available
      if (madeAvailable) setProducts(prev => prev.map(p => p.id === selectedProd ? { ...p, is_available: true } : p))
      await loadBalances(shift.id)
      const kirimText = prod.litr_per_unit ? `${entered}L = ${savedQty} stakan kirim!` : 'Kirim qilindi!'
      showToast(madeAvailable ? `${kirimText} "${prod.name}" menuga qo'shildi.` : kirimText)
      setSelectedProd(''); setQty(''); setActiveModal(null)
    } finally {
      busy.current = false
      setLoading(false)
    }
  }

  const confirmChiqim = async () => {
    const amount = parseInt(qty)
    if (!selectedProd || !shift || !reason.trim() || busy.current) return
    if (!(amount > 0)) { showToast("Miqdor noto'g'ri"); return }
    busy.current = true
    setLoading(true)
    try {
      const u = JSON.parse(localStorage.getItem('pos_user') || '{}')
      const { error } = await supabase.rpc('add_write_off', {
        p_shift_id: shift.id, p_worker_id: u.id, p_product_id: selectedProd, p_qty: amount, p_reason: reason.trim(),
      })
      if (error) { showToast(friendlyError(error)); return }
      await loadBalances(shift.id)
      setSelectedProd(''); setQty(''); setReason(''); setActiveModal(null)
      showToast('Chiqim qilindi!')
    } finally {
      busy.current = false
      setLoading(false)
    }
  }

  const addCategory = async () => {
    if (!newCatName.trim()) return
    const { data } = await supabase.from('categories').insert({ name: newCatName.trim(), order_num: categories.length + 1 }).select().single()
    if (data) { setCategories(p => [...p, data]); setNewCatName(''); showToast('Kategoriya qoshildi!') }
  }
  const deleteCategory = async (id: string) => {
    if (!window.confirm('Kategoriyani ochirasizmi?')) return
    await supabase.from('categories').delete().eq('id', id)
    setCategories(p => p.filter(c => c.id !== id))
  }
  const addProduct = async () => {
    if (!newProdName.trim() || !newProdPrice || !newProdCat) return
    const { data } = await supabase.from('products').insert({ name: newProdName.trim(), price: parseInt(newProdPrice), category_id: newProdCat, is_available: true }).select().single()
    if (data) { setProducts(p => [...p, data]); setNewProdName(''); setNewProdPrice(''); setNewProdCat(''); showToast('Mahsulot qoshildi!') }
  }
  const deleteProduct = async (id: string) => {
    if (!window.confirm('Mahsulotni ochirasizmi?')) return
    await supabase.from('products').delete().eq('id', id)
    setProducts(p => p.filter(x => x.id !== id))
  }
  const toggleAvail = async (p: Product) => {
    await supabase.from('products').update({ is_available: !p.is_available }).eq('id', p.id)
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_available: !x.is_available } : x))
  }
  const toggleHideWhenEmpty = async (p: Product) => {
    await supabase.from('products').update({ hide_when_empty: !p.hide_when_empty }).eq('id', p.id)
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, hide_when_empty: !x.hide_when_empty } : x))
    showToast(p.hide_when_empty ? `"${p.name}" endi doim ko'rinadi` : `"${p.name}" tugaganda yashiriladi`)
  }

  return (
    <div className="h-screen bg-[#F5F3EE] flex flex-col overflow-hidden">
      <div className="bg-[#1C1407] px-3 py-2 flex items-center justify-between flex-shrink-0">
        <div>
          <div className="text-[#F5C842] font-black tracking-widest text-sm">EA MURUNTOV</div>
          <div className="text-gray-500 text-xs">{user?.name} · Kassir</div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:'6px', flexShrink:0}}>
          <button aria-label="Smena" title="Smena" onClick={() => setActiveModal('smena')} style={{width:'32px', height:'32px', borderRadius:'8px', border: shift ? '1px solid #22c55e' : '1px solid #ef4444', background: shift ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: shift ? '#4ade80' : '#f87171', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer'}}>
            <Clock size={14}/>
          </button>
          {shift && <>
            <button aria-label="Kirim" title="Kirim" onClick={() => setActiveModal('kirим')} style={{width:'32px', height:'32px', borderRadius:'8px', background:'rgba(61,46,16,0.8)', color:'#F5C842', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer', border:'none'}}><PackagePlus size={13}/></button>
            <button aria-label="Chiqim" title="Chiqim" onClick={() => setActiveModal('chiqim')} style={{width:'32px', height:'32px', borderRadius:'8px', background:'rgba(61,46,16,0.8)', color:'#f87171', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer', border:'none'}}><PackageMinus size={13}/></button>
            <button aria-label="Qarzdorlar" title="Qarzdorlar" onClick={() => setActiveModal('debtors')} style={{width:'32px', height:'32px', borderRadius:'8px', background:'rgba(61,46,16,0.8)', color:'#fbbf24', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer', border:'none'}}><Search size={13}/></button>
          </>}
          <button aria-label="Menyu" title="Menyu" onClick={() => setShowMenu(true)} style={{width:'32px', height:'32px', borderRadius:'8px', background:'rgba(61,46,16,0.8)', color:'#a78bfa', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer', border:'none'}}><UtensilsCrossed size={13}/></button>
          <button aria-label="Chiqish" title="Chiqish" onClick={() => { localStorage.removeItem('pos_user'); router.push('/') }} style={{width:'32px', height:'32px', borderRadius:'8px', border:'1px solid #4b5563', color:'#9ca3af', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer', background:'transparent'}}><LogOut size={13}/></button>
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
          <button onClick={openShift} disabled={loading} className="px-8 py-4 rounded-2xl font-black text-white text-base disabled:opacity-50" style={{backgroundColor: '#1E7B47'}}>
            {loading ? '...' : 'Smena ochish'}
          </button>
        </div>
      ) : (
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col border-r border-[#E0DDD5]" style={{width:'62%'}}>
          <div className="bg-[#2C200A] px-3 py-2 flex gap-2 overflow-x-auto flex-shrink-0">
            {['Barchasi', ...categories.map(c => c.name)].map(cat => (
              <button key={cat} onClick={() => setActiveCat(cat)}
                className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all flex-shrink-0 ${activeCat === cat ? 'bg-[#C8860A] text-[#1A1208]' : 'bg-[#3D2E10] text-gray-400 hover:text-gray-200'}`}>
                {cat}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-3 gap-3">
              {filteredProducts.map(p => {
                const qty = cartQty(p.id)
                const mode = modeOf(p)
                const balance = getBalance(p.id)
                const info = stockInfo(mode, balance, unitOf(p))
                const extra = extraQty(mode, balance, qty)
                return (
                  <div key={p.id} onClick={() => addToCart(p)}
                    className={`bg-white rounded-2xl overflow-hidden cursor-pointer border-2 transition-all select-none ${qty > 0 ? 'border-[#F5C842]' : 'border-transparent hover:border-[#C8860A] hover:-translate-y-0.5'}`}>
                    <div className="bg-gradient-to-br from-[#FFF3D6] to-[#FFE8A3] h-24 flex items-center justify-center relative">
                      <span className="text-5xl">🍽️</span>
                      {qty > 0 && <div className="absolute top-2 right-2 bg-[#C8860A] text-[#1A1208] rounded-full w-7 h-7 flex items-center justify-center text-sm font-black">{qty}</div>}
                    </div>
                    <div className="p-3">
                      <div className="font-extrabold text-[#1A1208] text-sm leading-tight">{p.name}</div>
                      <div className="text-[#C8860A] font-black text-base mt-1">{fmt(p.price)} so'm</div>
                      {info && <div className={`text-xs font-bold mt-1 ${LEVEL_STYLE[info.level]}`}>{info.text}</div>}
                      {extra > 0 && <div className="text-[11px] font-bold text-amber-600">+{extra} avto-kirim bo&apos;ladi</div>}
                      {mode === 'soft' && (info?.level === 'extra' || info?.level === 'low') && (
                        <button type="button" onClick={e => { e.stopPropagation(); openKirimFor(p) }}
                          className="mt-1.5 px-2 py-1 rounded-lg bg-[#FFF8E7] border border-[#F5C842] text-[#C8860A] text-[11px] font-black">
                          + tayyor
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div style={{position:'fixed', right:0, top:'48px', bottom:0, width:'38%', display:'flex', flexDirection:'column', backgroundColor:'white', zIndex:20, borderLeft:'1px solid #E0DDD5'}}>
          <div className="flex items-center gap-1 px-2 pt-2 pb-0 border-b border-gray-100 overflow-x-auto flex-shrink-0">
            {bills.map(b => (
              <div key={b.id} onClick={() => setActiveBillId(b.id)}
                className={`flex items-center gap-1 px-3 py-2 rounded-t-xl cursor-pointer transition-all flex-shrink-0 border-b-2 ${activeBillId === b.id ? 'bg-[#FFF8E7] border-[#C8860A]' : 'bg-gray-50 border-transparent hover:bg-gray-100'}`}>
                <span className={`text-xs font-black ${activeBillId === b.id ? 'text-[#C8860A]' : 'text-gray-400'}`}>No {b.id}</span>
                {b.cart.length > 0 && <span className="w-4 h-4 rounded-full bg-[#C8860A] text-[#1A1208] text-[10px] font-black flex items-center justify-center">{b.cart.reduce((s, i) => s + i.qty, 0)}</span>}
                {bills.length > 1 && <button onClick={e => { e.stopPropagation(); removeBill(b.id) }} className="text-gray-300 hover:text-red-400 ml-0.5"><X size={12}/></button>}
              </div>
            ))}
            <button onClick={addBill} className="px-2 py-2 rounded-t-xl text-gray-400 hover:text-[#C8860A] hover:bg-[#FFF8E7] transition-all flex-shrink-0"><Plus size={16}/></button>
          </div>
          <div className="px-4 py-2 flex-shrink-0">
            <div className="text-gray-400 text-xs">{cart.length > 0 ? `${cart.length} xil mahsulot` : "Savat bo'sh"}</div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-1">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-3"><ShoppingCart size={48} strokeWidth={1.5}/><div className="text-sm font-bold">Mahsulot tanlang</div></div>
            ) : cart.map(item => (
              <div key={item.product.id} className="flex items-center gap-2 py-3 border-b border-gray-50">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-[#1A1208] truncate">{item.product.name}</div>
                  <div className="text-gray-400 text-xs">{fmt(item.product.price)} x {item.qty}</div>
                  {extraQty(modeOf(item.product), getBalance(item.product.id), item.qty) > 0 && (
                    <div className="text-[11px] font-bold text-amber-600">Tizimda yetmaydi: +{extraQty(modeOf(item.product), getBalance(item.product.id), item.qty)} avto-kirim</div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => changeQty(item.product.id, -1)} className="w-7 h-7 rounded-lg border border-gray-200 bg-gray-50 font-bold flex items-center justify-center hover:border-[#C8860A] hover:text-[#C8860A] transition-all">-</button>
                  <input type="number" defaultValue={item.qty} min={1} onFocus={e => e.target.select()}
                    onBlur={e => {
                      const val = parseInt(e.target.value)
                      if (!val || val < 1) { e.target.value = String(item.qty); return }
                      const prod = products.find(p => p.id === item.product.id)
                      if (prod && !checkQty(prod, val)) { e.target.value = String(item.qty); return }
                      updateBillCart(cart.map(i => i.product.id === item.product.id ? { ...i, qty: val } : i))
                    }} key={item.qty}
                    style={{width:'44px', textAlign:'center', fontWeight:900, fontSize:'14px', border:'1px solid #e5e7eb', borderRadius:'6px', padding:'2px 4px', outline:'none'}}/>
                  <button onClick={() => changeQty(item.product.id, 1)} className="w-7 h-7 rounded-lg border border-gray-200 bg-gray-50 font-bold flex items-center justify-center hover:border-[#C8860A] hover:text-[#C8860A] transition-all">+</button>
                </div>
                <div className="font-black text-[#C8860A] text-sm min-w-[64px] text-right">{fmt(item.product.price * item.qty)}</div>
              </div>
            ))}
          </div>
          <div style={{padding:'12px 16px', borderTop:'2px solid #f3f4f6', flexShrink:0, backgroundColor:'white'}}>
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-gray-500 font-bold text-sm">Jami:</span>
              <span className="text-[#C8860A] font-black text-2xl">{fmt(total)} so'm</span>
            </div>
            <button onClick={() => setActiveModal('moslashuv')} className="w-full py-2 rounded-xl bg-gray-100 text-gray-600 font-bold text-xs mb-2 hover:bg-gray-200 transition-all">Moslashuvchan to'lov</button>
            <button disabled={cart.length === 0} onClick={() => { setPayError(''); setActiveModal('pay') }} className="w-full py-3.5 rounded-xl bg-[#C8860A] text-[#1A1208] font-black text-base transition-all hover:bg-[#F5C842] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed">Buyurtma berish</button>
          </div>
        </div>
      </div>
      )}

      {activeModal === 'shift_start' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg flex flex-col" style={{maxHeight:'92vh'}}>
            <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="font-black text-base">O'tgan smena qoldiqlari</div>
              <div className="text-xs text-gray-400 mt-1">Miqdorni tekshiring. 0 qilsangiz - chiqindi sifatida saqlanadi</div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {prevStocks.map((ps, i) => (
                <div key={ps.product_id} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 font-bold text-sm">{ps.name}</div>
                    <div className="text-xs text-gray-400 flex-shrink-0">O'tgan: <b>{ps.qty_original}</b></div>
                    <input type="number" value={ps.qty} onChange={e => setPrevStocks(prev => prev.map((x, j) => j === i ? { ...x, qty: parseFloat(e.target.value) || 0 } : x))} className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-center text-sm font-bold outline-none focus:border-[#C8860A]"/>
                  </div>
                  {ps.qty < ps.qty_original && <div className="text-xs text-orange-500 font-bold mb-1">{ps.qty_original - ps.qty} ta chiqindi sifatida yoziladi</div>}
                  <input type="text" placeholder="Izoh (ixtiyoriy)..." value={ps.note} onChange={e => setPrevStocks(prev => prev.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-[#C8860A]"/>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0 space-y-2">
              <button onClick={() => doOpenShift()} disabled={loading} className="w-full py-3 rounded-xl font-black text-white text-sm disabled:opacity-50" style={{backgroundColor: '#1E7B47'}}>{loading ? '...' : 'Tasdiqlash va smena ochish'}</button>
              <button onClick={() => doOpenShift(prevStocks.map(ps => ({ ...ps, qty: 0 })))} className="w-full py-2 rounded-xl text-gray-400 text-xs font-bold hover:bg-gray-50">Qoldiqsiz boshlash</button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'smena' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <div className="font-black text-lg">Smena boshqaruvi</div>
              <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">x</button>
            </div>
            {shift ? (
              <>
                <div className="bg-green-50 border-2 border-green-400 rounded-xl p-4 mb-4">
                  <div className="font-black text-green-700">Smena ochiq</div>
                  <div className="text-sm text-gray-500 mt-1">Boshlangan: {new Date(shift.opened_at).toLocaleTimeString('uz-UZ', {hour:'2-digit', minute:'2-digit'})}</div>
                </div>
                <button onClick={() => setActiveModal('close_shift')} className="w-full py-4 rounded-xl font-black text-base text-white" style={{backgroundColor: '#B83232'}}>Smena yopish</button>
              </>
            ) : (
              <button onClick={openShift} disabled={loading} className="w-full py-4 rounded-xl font-black text-base text-white disabled:opacity-50" style={{backgroundColor: '#1E7B47'}}>{loading ? '...' : 'Smena ochish'}</button>
            )}
          </div>
        </div>
      )}

      {activeModal === 'close_shift' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg flex flex-col" style={{maxHeight:'92vh'}}>
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
              <div className="font-black text-base">Smena yopish hisoboti</div>
              <button onClick={() => setActiveModal('smena')} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">x</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="text-xs text-gray-400 mb-3 font-bold">Har mahsulot uchun haqiqiy qoldiqni kiriting. Bo'sh qoldirsangiz - tizim hisobi qabul qilinadi.</div>
              {products.filter(p => p.is_available).map(p => {
                const sysQty = getSystemQty(p); const rep = shiftReport[p.id] || { actual: '', note: '' }
                const actual = rep.actual === '' ? sysQty : parseFloat(rep.actual); const diff = actual - sysQty
                return (
                  <div key={p.id} className="mb-3 p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 font-bold text-sm truncate">{p.name}</div>
                      <div className="text-xs text-gray-400 flex-shrink-0">Tizim: <b>{sysQty}</b></div>
                      <input type="number" placeholder={String(sysQty)} value={rep.actual} onChange={e => setShiftReport(prev => ({ ...prev, [p.id]: { ...rep, actual: e.target.value } }))} className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-center text-sm font-bold outline-none focus:border-[#C8860A] flex-shrink-0"/>
                    </div>
                    {rep.actual !== '' && diff !== 0 && (
                      <>
                        <div className={`text-xs font-bold mb-1 ${diff < 0 ? 'text-red-500' : 'text-green-600'}`}>Farq: {diff > 0 ? '+' : ''}{diff} ta</div>
                        <input type="text" placeholder="Izoh (majburiy)..." value={rep.note} onChange={e => setShiftReport(prev => ({ ...prev, [p.id]: { ...rep, note: e.target.value } }))} className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-[#C8860A]"/>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
              <button onClick={closeShift} disabled={loading} className="w-full py-3 rounded-xl font-black text-white text-sm disabled:opacity-50" style={{backgroundColor: '#B83232'}}>{loading ? '...' : 'Tasdiqlash va smena yopish'}</button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'pay' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl p-6 w-full max-w-md" style={{maxHeight:'90vh', overflowY:'auto'}}>
            <div className="flex justify-between items-center mb-4">
              <div className="font-black text-lg">Hisob No {activeBillId}</div>
              <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">x</button>
            </div>
            <div className="text-[#C8860A] font-black text-3xl mb-1">{fmt(total)} so'm</div>
            {moslashuvActual && moslashuvActual !== total && (
              <div className={`text-sm font-bold mb-3 ${moslashuvActual > total ? 'text-green-600' : 'text-orange-500'}`}>
                Haqiqiy: {fmt(moslashuvActual)} so'm ({moslashuvActual > total ? '+' : ''}{fmt(moslashuvActual - total)} so'm)
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mb-4 mt-3">
              {(['naqd', 'click', 'karta', 'qarz', 'ichki'] as const).map(t => (
                <button key={t} type="button" onClick={() => setPayType(t)} className={`py-3 rounded-xl border-2 font-bold text-sm transition-all ${payType === t ? 'border-[#C8860A] bg-[#FFF8E7] text-[#1A1208]' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                  {t === 'naqd' ? 'Naqd' : t === 'click' ? 'Click' : t === 'karta' ? 'Karta' : t === 'qarz' ? 'Qarz' : 'Ichki'}
                </button>
              ))}
            </div>
            {payType === 'qarz' && (
              <div className="space-y-2 mb-4">
                <div className="text-xs font-bold text-gray-500">Qarzdorni qidiring:</div>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-3 text-gray-400"/>
                  <input type="text" placeholder="Ism yoki telefon..." value={debtorSearch} onChange={e => { setDebtorSearch(e.target.value); setSelectedDebtorId('') }} className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#C8860A]"/>
                </div>
                {debtorSearch && !selectedDebtorId && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-32 overflow-y-auto">
                    {filteredDebtors.length === 0 ? <div className="px-4 py-2 text-xs text-gray-400">Topilmadi - yangi sifatida qo'shiladi</div>
                    : filteredDebtors.map(d => (
                      <button key={d.id} type="button" onClick={() => { setSelectedDebtorId(d.id); setDebtorSearch(d.name) }} className="w-full text-left px-4 py-2 text-sm border-b border-gray-50 hover:bg-gray-50">
                        <span className="font-bold">{d.name}</span>
                        {d.phone && <span className="text-gray-400 text-xs ml-2">{d.phone}</span>}
                        <span className="text-red-500 text-xs ml-2 float-right">{fmt(d.total_debt)} so'm</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedDebtorId && (
                  <div className="flex items-center justify-between bg-[#FFF8E7] border border-[#F5C842] rounded-xl px-4 py-2">
                    <span className="font-bold text-sm">{debtors.find(d => d.id === selectedDebtorId)?.name}</span>
                    <button type="button" onClick={() => { setSelectedDebtorId(''); setDebtorSearch('') }} className="text-gray-400 hover:text-red-500 text-xs">x</button>
                  </div>
                )}
                {!selectedDebtorId && !debtorSearch && <input type="text" placeholder="Yangi mijoz ismi *" value={debtorName} onChange={e => setDebtorName(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#C8860A]"/>}
              </div>
            )}
            {payType === 'ichki' && <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 text-sm text-yellow-700 font-bold">Bu buyurtma tushum hisobiga kirmaydi</div>}
            {payError && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm font-bold mb-3">{payError}</div>}
            <button onClick={confirmOrder} disabled={loading || (payType === 'qarz' && !selectedDebtorId && !debtorName.trim() && !debtorSearch.trim())} className="w-full py-4 rounded-xl bg-[#1E7B47] text-white font-black text-base disabled:opacity-50">
              {loading ? 'Saqlanmoqda...' : 'Tasdiqlash'}
            </button>
          </div>
        </div>
      )}

      {activeModal === 'moslashuv' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <div className="font-black text-lg">Moslashuvchan to'lov</div>
              <button onClick={() => { setActiveModal(null); setMoslashuvSumma('') }} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">x</button>
            </div>
            <div className="text-gray-400 text-sm mb-1">Asl narx:</div>
            <div className="text-[#C8860A] font-black text-2xl mb-4">{fmt(total)} so'm</div>
            <input type="number" placeholder="Haqiqiy to'lov summasi" value={moslashuvSumma} onChange={e => setMoslashuvSumma(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg font-bold outline-none focus:border-[#C8860A] mb-3"/>
            {moslashuvSumma && parseInt(moslashuvSumma) > 0 && (() => {
              const berildi = parseInt(moslashuvSumma); const farq = berildi - total; const ruxsat = Math.abs(farq) <= 1000
              return (
                <div className={`rounded-xl p-4 mb-4 border-2 ${!ruxsat ? 'bg-red-50 border-red-300' : farq > 0 ? 'bg-green-50 border-green-300' : farq < 0 ? 'bg-orange-50 border-orange-300' : 'bg-green-50 border-green-300'}`}>
                  {farq === 0 && <div className="text-center font-black text-green-600 text-lg">Aynan to'g'ri!</div>}
                  {farq > 0 && ruxsat && <div className="text-center font-black text-green-600 text-xl">+{fmt(farq)} so'm ortiqcha</div>}
                  {farq < 0 && ruxsat && <div className="text-center font-black text-orange-600 text-xl">{fmt(Math.abs(farq))} so'm kam</div>}
                  {!ruxsat && <div className="text-center font-black text-red-600 text-lg">Ruxsat yo'q! (max 1000 so'm)</div>}
                </div>
              )
            })()}
            {moslashuvSumma && Math.abs(parseInt(moslashuvSumma) - total) <= 1000 && parseInt(moslashuvSumma) > 0 && (
              <button onClick={() => { setMoslashuvActual(parseInt(moslashuvSumma)); setActiveModal('pay'); setMoslashuvSumma('') }} className="w-full py-4 rounded-xl bg-[#1E7B47] text-white font-black text-base">To'lovga o'tish</button>
            )}
          </div>
        </div>
      )}

      {activeModal === 'kirим' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <div className="font-black text-lg text-[#1E7B47]">Mahsulot kirim</div>
              <button onClick={() => { setActiveModal(null); setSelectedProd(''); setQty('') }} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">x</button>
            </div>
            <select value={selectedProd} onChange={e => { setSelectedProd(e.target.value); setQty('') }} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#C8860A] bg-white">
              <option value="">Mahsulot tanlang</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}{!p.is_available ? ' (Yo\'q)' : ''}</option>)}
            </select>
            {selectedProd && (() => {
              const prod = products.find(p => p.id === selectedProd)
              if (!prod) return null
              if (prod.unit_type === 'hissa') return (
                <div>
                  <input type="number" placeholder="Miqdor (kg)" value={qty} onChange={e => setQty(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-2 outline-none focus:border-[#C8860A]"/>
                  {qty && parseFloat(qty) > 0 && (
                    <div className="bg-[#FFF8E7] border border-[#F5C842] rounded-xl px-4 py-3 text-sm mb-3">
                      <div className="font-bold text-[#C8860A] mb-1">{parseFloat(qty)} kg:</div>
                      <div className="flex gap-4"><span className="text-green-600">Butun: <b>{Math.floor(parseFloat(qty) * 7)}</b></span><span className="text-blue-600">Yarim: <b>{Math.floor(parseFloat(qty) * 21 / 2)}</b></span></div>
                    </div>
                  )}
                </div>
              )
              if (prod.litr_per_unit) return (
                <div>
                  <input type="number" placeholder="Miqdor (litr)" value={qty} onChange={e => setQty(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-2 outline-none focus:border-[#C8860A]"/>
                  {qty && parseFloat(qty) > 0 && (
                    <div className="bg-[#FFF8E7] border border-[#F5C842] rounded-xl px-4 py-3 text-sm mb-3 text-center">
                      <span className="font-bold text-[#C8860A]">{parseFloat(qty)} litr</span><span className="text-gray-500"> = </span><span className="font-black text-green-600 text-lg">{Math.floor(parseFloat(qty) / prod.litr_per_unit)} stakan</span>
                    </div>
                  )}
                </div>
              )
              return (
                <div className="mb-4">
                  <input type="number" placeholder="Miqdor (dona)" value={qty} onChange={e => setQty(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-2 outline-none focus:border-[#C8860A]"/>
                  <div className="flex gap-2">
                    {[1, 5, 10, 20].map(n => (
                      <button key={n} type="button" onClick={() => setQty(String((parseFloat(qty) || 0) + n))} className="flex-1 py-2 rounded-xl bg-[#FFF8E7] border border-[#F5C842] text-[#C8860A] text-sm font-black">+{n}</button>
                    ))}
                  </div>
                </div>
              )
            })()}
            <button onClick={confirmKirim} disabled={loading || !selectedProd || !qty} className="w-full py-4 rounded-xl bg-[#1E7B47] text-white font-black text-base disabled:opacity-50">{loading ? '...' : 'Kirim qilish'}</button>
          </div>
        </div>
      )}

      {activeModal === 'chiqim' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <div className="font-black text-lg text-[#B83232]">Mahsulot chiqim</div>
              <button onClick={() => { setActiveModal(null); setSelectedProd(''); setQty(''); setReason('') }} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">x</button>
            </div>
            <select value={selectedProd} onChange={e => setSelectedProd(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#C8860A] bg-white">
              <option value="">Mahsulot tanlang</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="number" placeholder="Miqdor" value={qty} onChange={e => setQty(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#C8860A]"/>
            <textarea placeholder="Izoh (sabab)..." value={reason} onChange={e => setReason(e.target.value)} rows={3} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-4 outline-none focus:border-[#C8860A] resize-none"/>
            <button onClick={confirmChiqim} disabled={loading || !selectedProd || !qty || !reason.trim()} className="w-full py-4 rounded-xl bg-[#B83232] text-white font-black text-base disabled:opacity-50">{loading ? '...' : 'Chiqim qilish'}</button>
          </div>
        </div>
      )}

      {activeModal === 'debtors' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md flex flex-col" style={{maxHeight:'85vh'}}>
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
              <div className="font-black text-base">Qarzdorlar</div>
              <button onClick={() => { setActiveModal(null); setDebtorSearch('') }} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">x</button>
            </div>
            <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-3 text-gray-400"/>
                <input type="text" placeholder="Ism yoki telefon..." value={debtorSearch} onChange={e => setDebtorSearch(e.target.value)} className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#C8860A]"/>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredDebtors.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-300"><div className="text-3xl mb-2">🔍</div><div className="text-sm font-bold">Topilmadi</div></div>
              ) : filteredDebtors.map(d => <DebtorCard key={d.id} debtor={d} products={products} onUpdate={(id, newDebt) => setDebtors(prev => prev.map(x => x.id === id ? { ...x, total_debt: newDebt } : x))}/>)}
            </div>
          </div>
        </div>
      )}

      {showMenu && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg flex flex-col" style={{maxHeight:'92vh'}}>
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
              <div className="font-black text-base">Menyu boshqaruvi</div>
              <button onClick={() => setShowMenu(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">x</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="font-bold text-sm mb-2">Kategoriya qo'shish</div>
                <div className="flex gap-2">
                  <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Kategoriya nomi" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C8860A]"/>
                  <button onClick={addCategory} style={{padding:'8px 16px', backgroundColor:'#C8860A', color:'#1A1208', borderRadius:'12px', fontWeight:900, fontSize:'14px', border:'none', cursor:'pointer'}}>+</button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {categories.map(c => (
                    <div key={c.id} style={{display:'flex', alignItems:'center', gap:'4px', backgroundColor:'#FFF8E7', border:'1px solid #F5C842', borderRadius:'999px', padding:'4px 12px'}}>
                      <span style={{fontSize:'13px', fontWeight:700}}>{c.name}</span>
                      <button onClick={() => deleteCategory(c.id)} style={{color:'#9ca3af', background:'none', border:'none', cursor:'pointer', fontSize:'12px'}}>x</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-3">
                <div className="font-bold text-sm mb-2">Mahsulot qo'shish</div>
                <div className="space-y-2">
                  <input value={newProdName} onChange={e => setNewProdName(e.target.value)} placeholder="Mahsulot nomi" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C8860A]"/>
                  <div className="flex gap-2">
                    <input value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)} placeholder="Narxi" type="number" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C8860A]"/>
                    <select value={newProdCat} onChange={e => setNewProdCat(e.target.value)} className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C8860A] bg-white">
                      <option value="">Kategoriya</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <button onClick={addProduct} style={{width:'100%', padding:'10px', backgroundColor:'#C8860A', color:'#1A1208', borderRadius:'12px', fontWeight:900, fontSize:'14px', border:'none', cursor:'pointer'}}>Qo'shish</button>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl overflow-hidden">
                <div className="px-3 py-2 font-bold text-sm border-b border-gray-100 bg-white">Mahsulotlar ({products.length} ta)</div>
                {products.map(p => {
                  const cat = categories.find(c => c.id === p.category_id)
                  return (
                    <div key={p.id} style={{display:'flex', alignItems:'center', gap:'8px', padding:'10px 12px', borderBottom:'1px solid #f3f4f6', backgroundColor:'white'}}>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{fontWeight:700, fontSize:'13px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{p.name}</div>
                        <div style={{fontSize:'11px', color:'#9ca3af'}}>{cat?.name} - {fmt(p.price)} so'm</div>
                      </div>
                      {/* Bor/Yo'q */}
                      <button onClick={() => toggleAvail(p)}
                        style={{padding:'3px 8px', borderRadius:'999px', fontSize:'11px', fontWeight:700, border:'none', cursor:'pointer', flexShrink:0, backgroundColor: p.is_available ? '#dcfce7' : '#fee2e2', color: p.is_available ? '#15803d' : '#b91c1c'}}>
                        {p.is_available ? 'Bor' : "Yo'q"}
                      </button>
                      {/* Tugaganda yashir */}
                      <button onClick={() => toggleHideWhenEmpty(p)}
                        title={p.hide_when_empty ? 'Tugaganda yashiriladi' : 'Doim ko\'rinadi'}
                        style={{padding:'3px 8px', borderRadius:'999px', fontSize:'11px', fontWeight:700, border:'none', cursor:'pointer', flexShrink:0, backgroundColor: p.hide_when_empty ? '#fef3c7' : '#f3f4f6', color: p.hide_when_empty ? '#d97706' : '#9ca3af'}}>
                        {p.hide_when_empty ? 'Yashir' : 'Ko\'r'}
                      </button>
                      <button onClick={() => deleteProduct(p.id)} style={{color:'#d1d5db', background:'none', border:'none', cursor:'pointer', fontSize:'16px', flexShrink:0}}>x</button>
                    </div>
                  )
                })}
              </div>

              {/* Izoh */}
              <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-600">
                <b>Yashir</b> — tugaganda menuda ko'rinmaydi (somsa, salat kabi)<br/>
                <b>Ko'r</b> — doim ko'rinadi (mastava, jarkoe kabi)
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-[#1A1208] text-[#F5C842] px-5 py-2.5 rounded-full text-sm font-bold z-50 shadow-lg">{toast}</div>
      )}
    </div>
  )
}