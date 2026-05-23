'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getRemainingMs, endTrial } from '@/lib/trial'
import { LogOut, ShoppingCart, Plus, X, PackagePlus, PackageMinus, Clock } from 'lucide-react'

type User = { id: string; name: string; role: string }
type Category = { id: string; name: string }
type Product = {
  id: string
  name: string
  price: number
  category_id: string
  is_available: boolean
  unit_type: string
  hissa_per_unit: number
  kg_to_hissa: number
}
type CartItem = { product: Product; qty: number }
type Bill = { id: number; cart: CartItem[] }
type Shift = { id: string; is_open: boolean; opened_at: string }
type Stock = { product_id: string; initial_qty: number }
type StockIn = { id: string; product_id: string; qty: number }
type ActiveModal = null | 'pay' | 'kirим' | 'chiqim' | 'smena'

export default function CashierPage() {
  const router = useRouter()
  const [timeLeft, setTimeLeft] = useState(0)
  const [user, setUser] = useState<User | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [shift, setShift] = useState<Shift | null>(null)
  const [stocks, setStocks] = useState<Stock[]>([])
  const [stockIns, setStockIns] = useState<StockIn[]>([])
  const [hissaStock, setHissaStock] = useState<{[shiftId: string]: number}>({})
  const [activeCat, setActiveCat] = useState('Barchasi')
  const [payType, setPayType] = useState<'naqd' | 'click' | 'karta' | 'qarz' | 'ichki'>('naqd')
  const [debtorName, setDebtorName] = useState('')
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(false)
  const [bills, setBills] = useState<Bill[]>([{ id: 1, cart: [] }])
  const [activeBillId, setActiveBillId] = useState(1)
  const [nextBillId, setNextBillId] = useState(2)
  const [selectedProd, setSelectedProd] = useState('')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')

  const activeBill = bills.find(b => b.id === activeBillId)!
  const cart = activeBill?.cart || []

  useEffect(() => {
    const u = localStorage.getItem('pos_user')
    if (!u) { router.push('/'); return }
    const parsed = JSON.parse(u)
    if (parsed.role !== 'worker') { router.push('/admin'); return }
    setUser(parsed)
    loadData()

    const remaining = getRemainingMs()
    setTimeLeft(remaining)
    const interval = setInterval(() => {
      const left = getRemainingMs()
      setTimeLeft(left)
      if (left <= 0) {
        clearInterval(interval)
        endTrial()
        localStorage.removeItem('pos_user')
        router.push('/?expired=1')
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    const [{ data: cats }, { data: prods }] = await Promise.all([
      supabase.from('categories').select('*').order('order_num'),
      supabase.from('products').select('*').order('created_at'),
    ])
    setCategories(cats || [])
    setProducts(prods || [])

    const { data: shiftData } = await supabase
      .from('shifts')
      .select('*')
      .eq('is_open', true)
      .maybeSingle()
    setShift(shiftData || null)

    if (shiftData?.id) {
      // Osh hissa
      const { data: oshStock } = await supabase
        .from('osh_stock')
        .select('*')
        .eq('shift_id', shiftData.id)
        .maybeSingle()
      if (oshStock) {
        setHissaStock({ [shiftData.id]: oshStock.total_hissa })
      }

      // Boshlang'ich miqdor
      const { data: stockData } = await supabase
        .from('shift_stock')
        .select('*')
        .eq('shift_id', shiftData.id)
      setStocks(stockData || [])

      // Kirimlar
      const { data: siData } = await supabase
        .from('stock_ins')
        .select('*')
        .eq('shift_id', shiftData.id)
      setStockIns(siData || [])
    } else {
      setStocks([])
      setStockIns([])
    }
  }

  const showToast = (msg: string) => {
    setToast(msg); setTimeout(() => setToast(''), 2500)
  }

  const fmt = (n: number) => n.toLocaleString('uz-UZ')

  const getHissaQoldiq = (product: Product): number => {
    if (product.unit_type !== 'hissa') return 999
    if (!shift) return 0
    const totalHissa = hissaStock[shift.id] || 0
    return Math.floor(totalHissa / product.hissa_per_unit)
  }

  const getDonaQoldiq = (productId: string): number | null => {
    if (!shift) return null
    const stock = stocks.find(s => s.product_id === productId)
    if (!stock) return null
    const kirim = stockIns
      .filter(si => si.product_id === productId)
      .reduce((s, si) => s + si.qty, 0)
    const jami = (stock.initial_qty || 0) + kirim
    if (jami === 0) return null
    return jami
  }

  // SMENA
  const openShift = async () => {
    setLoading(true)
    const u = JSON.parse(localStorage.getItem('pos_user') || '{}')
    const { data } = await supabase
      .from('shifts')
      .insert({ opened_by: u.id, is_open: true })
      .select().single()
    if (data) {
      const stockRows = products.map(p => ({ shift_id: data.id, product_id: p.id, initial_qty: 0 }))
      await supabase.from('shift_stock').insert(stockRows)
      setShift(data)
      showToast('✅ Smena ochildi!')
      await loadData()
    }
    setLoading(false)
    setActiveModal(null)
  }

  const closeShift = async () => {
    if (!shift) return
    setLoading(true)
    const u = JSON.parse(localStorage.getItem('pos_user') || '{}')
    await supabase.from('shifts')
      .update({ is_open: false, closed_at: new Date().toISOString(), closed_by: u.id })
      .eq('id', shift.id)
    setShift(null)
    setStocks([])
    setStockIns([])
    setHissaStock({})
    showToast('Smena yopildi')
    setLoading(false)
    setActiveModal(null)
  }

  // BILL
  const addBill = () => {
    if (bills.length >= 5) { showToast("Maksimal 5 ta hisob!"); return }
    const newBill: Bill = { id: nextBillId, cart: [] }
    setBills(prev => [...prev, newBill])
    setActiveBillId(nextBillId)
    setNextBillId(prev => prev + 1)
  }

  const removeBill = (id: number) => {
    if (bills.length === 1) { showToast("Kamida 1 ta hisob!"); return }
    const remaining = bills.filter(b => b.id !== id)
    setBills(remaining)
    if (activeBillId === id) setActiveBillId(remaining[0].id)
  }

  const updateBillCart = (newCart: CartItem[]) => {
    setBills(prev => prev.map(b => b.id === activeBillId ? { ...b, cart: newCart } : b))
  }

  const filteredProducts = activeCat === 'Barchasi'
    ? products
    : products.filter(p => {
        const cat = categories.find(c => c.name === activeCat)
        return cat && p.category_id === cat.id
      })

  const addToCart = (product: Product) => {
    if (!product.is_available) return

    if (product.unit_type === 'hissa') {
      const qoldiq = getHissaQoldiq(product)
      const cartQtyNow = cart.find(i => i.product.id === product.id)?.qty || 0
      if (cartQtyNow >= qoldiq) {
        showToast(`⚠️ Yetarli ${product.name} yo'q!`)
        return
      }
    }

    const existing = cart.find(i => i.product.id === product.id)
    if (existing) {
      updateBillCart(cart.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i))
    } else {
      updateBillCart([...cart, { product, qty: 1 }])
    }
  }

  const changeQty = (productId: string, delta: number) => {
    if (delta > 0) {
      const prod = products.find(p => p.id === productId)
      if (prod?.unit_type === 'hissa') {
        const qoldiq = getHissaQoldiq(prod)
        const cartQtyNow = cart.find(i => i.product.id === productId)?.qty || 0
        if (cartQtyNow >= qoldiq) {
          showToast(`⚠️ Yetarli ${prod.name} yo'q!`)
          return
        }
      }
    }
    const updated = cart.map(i => i.product.id === productId ? { ...i, qty: i.qty + delta } : i)
    updateBillCart(updated.filter(i => i.qty > 0))
  }

  const total = cart.reduce((s, i) => s + i.product.price * i.qty, 0)
  const cartQty = (id: string) => cart.find(i => i.product.id === id)?.qty || 0

  // BUYURTMA
  const confirmOrder = async () => {
    if (cart.length === 0) return
    setLoading(true)
    const u = JSON.parse(localStorage.getItem('pos_user') || '{}')

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        shift_id: shift?.id || null,
        worker_id: u.id,
        total: payType === 'ichki' ? 0 : total,
        pay_type: payType,
        debtor_name: payType === 'qarz' ? debtorName : null,
        debt_paid: false,
      })
      .select().single()

    if (error || !order) { setLoading(false); return }

    await supabase.from('order_items').insert(
      cart.map(i => ({
        order_id: order.id,
        product_id: i.product.id,
        qty: i.qty,
        price: i.product.price,
      }))
    )

    // Hissa ayirish
    const hissaProducts = cart.filter(i => i.product.unit_type === 'hissa')
    if (hissaProducts.length > 0 && shift) {
      const totalAyirildi = hissaProducts.reduce((s, i) => s + i.product.hissa_per_unit * i.qty, 0)
      const currentHissa = hissaStock[shift.id] || 0
      const newHissa = Math.max(0, currentHissa - totalAyirildi)

      const { data: existing } = await supabase
        .from('osh_stock')
        .select('*')
        .eq('shift_id', shift.id)
        .eq('product_group', 'osh')
        .maybeSingle()

      if (existing) {
        await supabase.from('osh_stock')
          .update({ total_hissa: newHissa, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
      }

      setHissaStock(prev => ({ ...prev, [shift.id]: newHissa }))
    }

    updateBillCart([])
    setDebtorName('')
    setPayType('naqd')
    setActiveModal(null)
    setLoading(false)
    showToast(`✅ Hisob ${activeBillId} tasdiqlandi!`)
  }

  // KIRIM
  const confirmKirim = async () => {
    if (!selectedProd || !qty) return
    setLoading(true)
    const u = JSON.parse(localStorage.getItem('pos_user') || '{}')
    const prod = products.find(p => p.id === selectedProd)

    const { data: newSi } = await supabase.from('stock_ins').insert({
      shift_id: shift?.id || null,
      product_id: selectedProd,
      qty: parseFloat(qty),
      worker_id: u.id,
    }).select().single()

    // StockIns state ni yangilash
    if (newSi) setStockIns(prev => [...prev, newSi])

    if (prod?.unit_type === 'hissa' && shift) {
      const kgMiqdor = parseFloat(qty)
      const yangiHissa = Math.round(kgMiqdor * (prod.kg_to_hissa || 21))
      const currentHissa = hissaStock[shift.id] || 0
      const newHissa = currentHissa + yangiHissa

      const { data: existing } = await supabase
        .from('osh_stock')
        .select('*')
        .eq('shift_id', shift.id)
        .eq('product_group', 'osh')
        .maybeSingle()

      if (existing) {
        await supabase.from('osh_stock')
          .update({ total_hissa: newHissa, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
      } else {
        await supabase.from('osh_stock')
          .insert({ shift_id: shift.id, product_group: 'osh', total_hissa: newHissa })
      }

      setHissaStock(prev => ({ ...prev, [shift.id]: newHissa }))
    }

    setSelectedProd(''); setQty('')
    setActiveModal(null)
    setLoading(false)
    showToast('✅ Kirim qilindi!')
  }

  // CHIQIM
  const confirmChiqim = async () => {
    if (!selectedProd || !qty || !reason.trim()) return
    setLoading(true)
    const u = JSON.parse(localStorage.getItem('pos_user') || '{}')

    await supabase.from('write_offs').insert({
      shift_id: shift?.id || null,
      product_id: selectedProd,
      qty: parseInt(qty),
      reason: reason.trim(),
      worker_id: u.id,
    })

    setSelectedProd(''); setQty(''); setReason('')
    setActiveModal(null)
    setLoading(false)
    showToast('⚠️ Chiqim qilindi!')
  }

  return (
    <div className="h-screen bg-[#F5F3EE] flex flex-col overflow-hidden">

      {/* TOPBAR */}
      <div className="bg-[#1C1407] px-3 py-2 flex items-center justify-between flex-shrink-0">
        <div>
          <div className="text-[#F5C842] font-black tracking-widest text-sm">EA MURUNTOV</div>
          <div className="text-gray-500 text-xs">{user?.name} · Kassir</div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:'6px', flexShrink:0}}>
          {timeLeft > 0 && (
            <div style={{padding:'4px 8px', borderRadius:'8px', fontSize:'11px', fontWeight:900, background:'rgba(61,46,16,0.8)', color:'#F5C842', flexShrink:0}}>
              ⏱ {Math.floor(timeLeft / 60000)}:{String(Math.floor((timeLeft % 60000) / 1000)).padStart(2, '0')}
            </div>
          )}
          <button onClick={() => setActiveModal('smena')} style={{width:'32px', height:'32px', borderRadius:'8px', border: shift ? '1px solid #22c55e' : '1px solid #ef4444', background: shift ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: shift ? '#4ade80' : '#f87171', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer'}}>
            <Clock size={14}/>
          </button>
          <button onClick={() => setActiveModal('kirим')} style={{width:'32px', height:'32px', borderRadius:'8px', background:'rgba(61,46,16,0.8)', color:'#F5C842', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer', border:'none'}}>
            <PackagePlus size={13}/>
          </button>
          <button onClick={() => setActiveModal('chiqim')} style={{width:'32px', height:'32px', borderRadius:'8px', background:'rgba(61,46,16,0.8)', color:'#f87171', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer', border:'none'}}>
            <PackageMinus size={13}/>
          </button>
          <button onClick={() => { localStorage.removeItem('pos_user'); router.push('/') }} style={{width:'32px', height:'32px', borderRadius:'8px', border:'1px solid #4b5563', color:'#9ca3af', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer', background:'transparent'}}>
            <LogOut size={13}/>
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div className="flex flex-1 overflow-hidden">

        {/* CHAP: MENYU */}
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
                const hissaQoldiq = getHissaQoldiq(p)
                const donaQoldiq = getDonaQoldiq(p.id)
                const isHissa = p.unit_type === 'hissa'
                const tugadi = isHissa && hissaQoldiq === 0

                return (
                  <div key={p.id} onClick={() => addToCart(p)}
                    className={`bg-white rounded-2xl overflow-hidden cursor-pointer border-2 transition-all select-none
                      ${!p.is_available || tugadi ? 'opacity-40 pointer-events-none' : ''}
                      ${qty > 0 ? 'border-[#F5C842]' : 'border-transparent hover:border-[#C8860A] hover:-translate-y-0.5'}`}>
                    <div className="bg-gradient-to-br from-[#FFF3D6] to-[#FFE8A3] h-24 flex items-center justify-center relative">
                      <span className="text-5xl">🍽️</span>
                      {qty > 0 && (
                        <div className="absolute top-2 right-2 bg-[#C8860A] text-[#1A1208] rounded-full w-7 h-7 flex items-center justify-center text-sm font-black">
                          {qty}
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="font-extrabold text-[#1A1208] text-sm leading-tight">{p.name}</div>
                      <div className="text-[#C8860A] font-black text-base mt-1">{fmt(p.price)} so'm</div>
                      {isHissa ? (
                        <div className={`text-xs font-bold mt-1 ${
                          hissaQoldiq === 0 ? 'text-red-500' :
                          hissaQoldiq <= 5 ? 'text-orange-500' : 'text-green-600'
                        }`}>
                          {hissaQoldiq === 0 ? 'Tugadi!' : `Qoldiq: ${hissaQoldiq} ta`}
                        </div>
                      ) : donaQoldiq !== null ? (
                        <div className={`text-xs font-bold mt-1 ${
                          donaQoldiq === 0 ? 'text-red-500' :
                          donaQoldiq <= 5 ? 'text-orange-500' : 'text-green-600'
                        }`}>
                          {donaQoldiq === 0 ? 'Tugadi!' : `Qoldiq: ${donaQoldiq} ta`}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* O'NG: SAVAT */}
        <div className="flex flex-col bg-white" style={{width:'38%'}}>
          <div className="flex items-center gap-1 px-2 pt-2 pb-0 border-b border-gray-100 overflow-x-auto flex-shrink-0">
            {bills.map(b => (
              <div key={b.id} onClick={() => setActiveBillId(b.id)}
                className={`flex items-center gap-1 px-3 py-2 rounded-t-xl cursor-pointer transition-all flex-shrink-0 border-b-2 ${activeBillId === b.id ? 'bg-[#FFF8E7] border-[#C8860A]' : 'bg-gray-50 border-transparent hover:bg-gray-100'}`}>
                <span className={`text-xs font-black ${activeBillId === b.id ? 'text-[#C8860A]' : 'text-gray-400'}`}>№ {b.id}</span>
                {b.cart.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-[#C8860A] text-[#1A1208] text-[10px] font-black flex items-center justify-center">
                    {b.cart.reduce((s, i) => s + i.qty, 0)}
                  </span>
                )}
                {bills.length > 1 && (
                  <button onClick={e => { e.stopPropagation(); removeBill(b.id) }}
                    className="text-gray-300 hover:text-red-400 ml-0.5">
                    <X size={12}/>
                  </button>
                )}
              </div>
            ))}
            <button onClick={addBill}
              className="px-2 py-2 rounded-t-xl text-gray-400 hover:text-[#C8860A] hover:bg-[#FFF8E7] transition-all flex-shrink-0">
              <Plus size={16}/>
            </button>
          </div>

          <div className="px-4 py-2 flex-shrink-0">
            <div className="text-gray-400 text-xs">{cart.length > 0 ? `${cart.length} xil mahsulot` : "Savat bo'sh"}</div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-1">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-3">
                <ShoppingCart size={48} strokeWidth={1.5}/>
                <div className="text-sm font-bold">Mahsulot tanlang</div>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.product.id} className="flex items-center gap-2 py-3 border-b border-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-[#1A1208] truncate">{item.product.name}</div>
                    <div className="text-gray-400 text-xs">{fmt(item.product.price)} × {item.qty}</div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => changeQty(item.product.id, -1)}
                      className="w-7 h-7 rounded-lg border border-gray-200 bg-gray-50 font-bold flex items-center justify-center hover:border-[#C8860A] hover:text-[#C8860A] transition-all">−</button>
                    <span className="font-black text-sm w-5 text-center">{item.qty}</span>
                    <button onClick={() => changeQty(item.product.id, 1)}
                      className="w-7 h-7 rounded-lg border border-gray-200 bg-gray-50 font-bold flex items-center justify-center hover:border-[#C8860A] hover:text-[#C8860A] transition-all">+</button>
                  </div>
                  <div className="font-black text-[#C8860A] text-sm min-w-[64px] text-right">
                    {fmt(item.product.price * item.qty)}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="px-4 py-3 border-t-2 border-gray-100 flex-shrink-0">
            <div className="flex justify-between items-baseline mb-3">
              <span className="text-gray-500 font-bold text-sm">Jami:</span>
              <span className="text-[#C8860A] font-black text-2xl">{fmt(total)} so'm</span>
            </div>
            <button disabled={cart.length === 0} onClick={() => setActiveModal('pay')}
              className="w-full py-3.5 rounded-xl bg-[#C8860A] text-[#1A1208] font-black text-base transition-all hover:bg-[#F5C842] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed">
              Buyurtma berish
            </button>
          </div>
        </div>
      </div>

      {/* SMENA MODAL */}
      {activeModal === 'smena' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <div className="font-black text-lg">Smena boshqaruvi</div>
              <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">✕</button>
            </div>
            {shift ? (
              <>
                <div className="bg-green-50 border-2 border-green-400 rounded-xl p-4 mb-4">
                  <div className="font-black text-green-700 text-base">✅ Smena ochiq</div>
                  <div className="text-sm text-gray-500 mt-1">
                    Boshlangan: {new Date(shift.opened_at).toLocaleTimeString('uz-UZ', {hour:'2-digit', minute:'2-digit'})}
                  </div>
                </div>
                <button onClick={closeShift} disabled={loading}
                  className="w-full py-4 rounded-xl font-black text-base text-white disabled:opacity-50"
                  style={{backgroundColor: '#B83232'}}>
                  {loading ? '...' : '🔴 Smena yopish'}
                </button>
              </>
            ) : (
              <>
                <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 mb-4">
                  <div className="font-black text-red-600 text-base">⭕ Smena yopiq</div>
                </div>
                <button onClick={openShift} disabled={loading}
                  className="w-full py-4 rounded-xl font-black text-base text-white disabled:opacity-50"
                  style={{backgroundColor: '#1E7B47'}}>
                  {loading ? '...' : '🟢 Smena ochish'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* TO'LOV MODAL */}
      {activeModal === 'pay' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <div className="font-black text-lg">Hisob № {activeBillId} — To'lov</div>
              <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold">✕</button>
            </div>
            <div className="text-gray-400 text-sm mb-1">Jami summa:</div>
            <div className="text-[#C8860A] font-black text-3xl mb-4">{fmt(total)} so'm</div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {(['naqd', 'click', 'karta', 'qarz', 'ichki'] as const).map(t => (
                <button key={t} type="button" onClick={() => setPayType(t)}
                  className={`py-3 rounded-xl border-2 font-bold text-sm transition-all ${payType === t ? 'border-[#C8860A] bg-[#FFF8E7] text-[#1A1208]' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                  {t === 'naqd' ? '💵 Naqd' : t === 'click' ? '📱 Click' : t === 'karta' ? '💳 Karta' : t === 'qarz' ? '📝 Qarz' : '🍽 Ichki'}
                </button>
              ))}
            </div>
            {payType === 'qarz' && (
              <input type="text" placeholder="Mijoz ismi" value={debtorName}
                onChange={e => setDebtorName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-4 outline-none focus:border-[#C8860A]"/>
            )}
            {payType === 'ichki' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 text-sm text-yellow-700 font-bold">
                ⚠️ Bu buyurtma tushum hisobiga kirmaydi
              </div>
            )}
            <button onClick={confirmOrder} disabled={loading}
              className="w-full py-4 rounded-xl bg-[#1E7B47] text-white font-black text-base disabled:opacity-50">
              {loading ? 'Saqlanmoqda...' : '✓ Tasdiqlash'}
            </button>
          </div>
        </div>
      )}

      {/* KIRIM MODAL */}
      {activeModal === 'kirим' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <div className="font-black text-lg text-[#1E7B47]">📦 Mahsulot kirim</div>
              <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">✕</button>
            </div>
            <select value={selectedProd} onChange={e => setSelectedProd(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#C8860A] bg-white">
              <option value="">Mahsulot tanlang</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            {selectedProd && products.find(p => p.id === selectedProd)?.unit_type === 'hissa' ? (
              <div>
                <input type="number" placeholder="Miqdor (kg)" value={qty}
                  onChange={e => setQty(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-2 outline-none focus:border-[#C8860A]"/>
                {qty && parseFloat(qty) > 0 && (
                  <div className="bg-[#FFF8E7] border border-[#F5C842] rounded-xl px-4 py-3 text-sm mb-3">
                    <div className="font-bold text-[#C8860A] mb-1">{parseFloat(qty)} kg kirim:</div>
                    <div className="flex gap-4">
                      <span className="text-gray-600">Hissa: <b>{Math.round(parseFloat(qty) * 21)}</b></span>
                      <span className="text-green-600">Butun: <b>{Math.floor(parseFloat(qty) * 7)}</b></span>
                      <span className="text-blue-600">Yarim: <b>{Math.floor(parseFloat(qty) * 21 / 2)}</b></span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <input type="number" placeholder="Miqdor (dona)" value={qty}
                onChange={e => setQty(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-4 outline-none focus:border-[#C8860A]"/>
            )}

            <button onClick={confirmKirim} disabled={loading || !selectedProd || !qty}
              className="w-full py-4 rounded-xl bg-[#1E7B47] text-white font-black text-base disabled:opacity-50">
              {loading ? '...' : '✓ Kirim qilish'}
            </button>
          </div>
        </div>
      )}

      {/* CHIQIM MODAL */}
      {activeModal === 'chiqim' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <div className="font-black text-lg text-[#B83232]">⚠️ Mahsulot chiqim</div>
              <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">✕</button>
            </div>
            <select value={selectedProd} onChange={e => setSelectedProd(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#C8860A] bg-white">
              <option value="">Mahsulot tanlang</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="number" placeholder="Miqdor" value={qty}
              onChange={e => setQty(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#C8860A]"/>
            <textarea placeholder="Izoh (sabab)..." value={reason}
              onChange={e => setReason(e.target.value)} rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-4 outline-none focus:border-[#C8860A] resize-none"/>
            <button onClick={confirmChiqim} disabled={loading || !selectedProd || !qty || !reason.trim()}
              className="w-full py-4 rounded-xl bg-[#B83232] text-white font-black text-base disabled:opacity-50">
              {loading ? '...' : '⚠️ Chiqim qilish'}
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-[#1A1208] text-[#F5C842] px-5 py-2.5 rounded-full text-sm font-bold z-50 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}