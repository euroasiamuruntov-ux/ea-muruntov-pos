'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getRemainingMs, endTrial } from '@/lib/trial'
import { LogOut, ShoppingCart, Plus, X } from 'lucide-react'

type User = { id: string; name: string; role: string }
type Category = { id: string; name: string }
type Product = { id: string; name: string; price: number; category_id: string; is_available: boolean }
type CartItem = { product: Product; qty: number }
type Bill = { id: number; cart: CartItem[] }

export default function CashierPage() {
  const router = useRouter()
  const [timeLeft, setTimeLeft] = useState(0)
  const [user, setUser] = useState<User | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [activeCat, setActiveCat] = useState<string>('Barchasi')
  const [payType, setPayType] = useState<'naqd' | 'click' | 'karta' | 'qarz'>('naqd')
  const [debtorName, setDebtorName] = useState('')
  const [showPayModal, setShowPayModal] = useState(false)
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(false)
  const [bills, setBills] = useState<Bill[]>([{ id: 1, cart: [] }])
  const [activeBillId, setActiveBillId] = useState(1)
  const [nextBillId, setNextBillId] = useState(2)

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
  }

  const showToast = (msg: string) => {
    setToast(msg); setTimeout(() => setToast(''), 2500)
  }

  const fmt = (n: number) => n.toLocaleString('uz-UZ')

  const addBill = () => {
    if (bills.length >= 5) { showToast("Maksimal 5 ta hisob!"); return }
    const newBill: Bill = { id: nextBillId, cart: [] }
    setBills(prev => [...prev, newBill])
    setActiveBillId(nextBillId)
    setNextBillId(prev => prev + 1)
  }

  const removeBill = (id: number) => {
    if (bills.length === 1) { showToast("Kamida 1 ta hisob bo'lishi kerak!"); return }
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
    const existing = cart.find(i => i.product.id === product.id)
    if (existing) {
      updateBillCart(cart.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i))
    } else {
      updateBillCart([...cart, { product, qty: 1 }])
    }
  }

  const changeQty = (productId: string, delta: number) => {
    const updated = cart.map(i => i.product.id === productId ? { ...i, qty: i.qty + delta } : i)
    updateBillCart(updated.filter(i => i.qty > 0))
  }

  const total = cart.reduce((s, i) => s + i.product.price * i.qty, 0)
  const cartQty = (id: string) => cart.find(i => i.product.id === id)?.qty || 0

  const confirmOrder = async () => {
    if (cart.length === 0) return
    setLoading(true)
    const u = JSON.parse(localStorage.getItem('pos_user') || '{}')

    const { data: shift } = await supabase
      .from('shifts').select('id').eq('is_open', true).single()

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        shift_id: shift?.id || null,
        worker_id: u.id,
        total,
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

    updateBillCart([])
    setDebtorName('')
    setPayType('naqd')
    setShowPayModal(false)
    setLoading(false)
    showToast(`✅ Hisob ${activeBillId} tasdiqlandi!`)
  }

  return (
    <div className="h-screen bg-[#F5F3EE] flex flex-col overflow-hidden">

      <div className="bg-[#1C1407] px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <div className="text-[#F5C842] font-black tracking-widest text-base">EA MURUNTOV</div>
          <div className="text-gray-500 text-xs mt-0.5">{user?.name} · Kassir</div>
        </div>
        <div className="flex items-center gap-3">
          {timeLeft > 0 && (
            <div className={`px-3 py-1.5 rounded-lg text-xs font-black ${timeLeft < 60000 ? 'bg-red-900/40 text-red-400' : 'bg-[#3D2E10] text-[#F5C842]'}`}>
              ⏱ {Math.floor(timeLeft / 60000)}:{String(Math.floor((timeLeft % 60000) / 1000)).padStart(2, '0')}
            </div>
          )}
          <button
            onClick={() => { localStorage.removeItem('pos_user'); router.push('/') }}
            className="border border-gray-600 text-gray-400 rounded-lg px-3 py-1.5 text-xs hover:border-gray-400 transition-all flex items-center gap-1.5">
            <LogOut size={14}/> Chiqish
          </button>
        </div>
      </div>

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
                return (
                  <div key={p.id}
                    onClick={() => addToCart(p)}
                    className={`bg-white rounded-2xl overflow-hidden cursor-pointer border-2 transition-all select-none
                      ${!p.is_available ? 'opacity-40 pointer-events-none' : ''}
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
                      {!p.is_available && <div className="text-red-500 text-xs font-bold mt-1">Mavjud emas</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col bg-white" style={{width:'38%'}}>
          <div className="flex items-center gap-1 px-2 pt-2 pb-0 border-b border-gray-100 overflow-x-auto flex-shrink-0">
            {bills.map(b => (
              <div key={b.id}
                onClick={() => setActiveBillId(b.id)}
                className={`flex items-center gap-1 px-3 py-2 rounded-t-xl cursor-pointer transition-all flex-shrink-0 border-b-2 ${activeBillId === b.id ? 'bg-[#FFF8E7] border-[#C8860A]' : 'bg-gray-50 border-transparent hover:bg-gray-100'}`}>
                <span className={`text-xs font-black ${activeBillId === b.id ? 'text-[#C8860A]' : 'text-gray-400'}`}>
                  № {b.id}
                </span>
                {b.cart.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-[#C8860A] text-[#1A1208] text-[10px] font-black flex items-center justify-center">
                    {b.cart.reduce((s, i) => s + i.qty, 0)}
                  </span>
                )}
                {bills.length > 1 && (
                  <button onClick={e => { e.stopPropagation(); removeBill(b.id) }}
                    className="text-gray-300 hover:text-red-400 transition-all ml-0.5">
                    <X size={12}/>
                  </button>
                )}
              </div>
            ))}
            <button onClick={addBill}
              className="flex items-center gap-1 px-2 py-2 rounded-t-xl text-gray-400 hover:text-[#C8860A] hover:bg-[#FFF8E7] transition-all flex-shrink-0">
              <Plus size={16}/>
            </button>
          </div>

          <div className="px-4 py-2 flex-shrink-0">
            <div className="text-gray-400 text-xs mt-0.5">
              {cart.length > 0 ? `${cart.length} xil mahsulot` : "Savat bo'sh"}
            </div>
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
                      className="w-7 h-7 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 font-bold flex items-center justify-center hover:border-[#C8860A] hover:text-[#C8860A] transition-all">
                      −
                    </button>
                    <span className="font-black text-sm w-5 text-center">{item.qty}</span>
                    <button onClick={() => changeQty(item.product.id, 1)}
                      className="w-7 h-7 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 font-bold flex items-center justify-center hover:border-[#C8860A] hover:text-[#C8860A] transition-all">
                      +
                    </button>
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
            <button
              disabled={cart.length === 0}
              onClick={() => setShowPayModal(true)}
              className="w-full py-3.5 rounded-xl bg-[#C8860A] text-[#1A1208] font-black text-base transition-all hover:bg-[#F5C842] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed">
              Buyurtma berish
            </button>
          </div>
        </div>
      </div>

      {showPayModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <div className="font-black text-lg text-[#1A1208]">Hisob № {activeBillId} — To'lov</div>
              <button onClick={() => setShowPayModal(false)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold">✕</button>
            </div>
            <div className="text-gray-400 text-sm mb-1">Jami summa:</div>
            <div className="text-[#C8860A] font-black text-3xl mb-4">{fmt(total)} so'm</div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {(['naqd', 'click', 'karta', 'qarz'] as const).map(t => (
                <button key={t} type="button" onClick={() => setPayType(t)}
                  className={`py-3 rounded-xl border-2 font-bold text-sm transition-all ${payType === t ? 'border-[#C8860A] bg-[#FFF8E7] text-[#1A1208]' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                  {t === 'naqd' ? '💵 Naqd' : t === 'click' ? '📱 Click' : t === 'karta' ? '💳 Karta' : '📝 Qarz'}
                </button>
              ))}
            </div>

            {payType === 'qarz' && (
              <input type="text" placeholder="Mijoz ismi" value={debtorName}
                onChange={e => setDebtorName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-4 outline-none focus:border-[#C8860A]"/>
            )}

            <button onClick={confirmOrder} disabled={loading}
              className="w-full py-4 rounded-xl bg-[#1E7B47] text-white font-black text-base transition-all hover:bg-green-700 disabled:opacity-50">
              {loading ? 'Saqlanmoqda...' : '✓ Tasdiqlash'}
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