'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type User = { id: string; name: string; role: string }
type Category = { id: string; name: string }
type Product = { id: string; name: string; price: number; category_id: string; is_available: boolean }
type CartItem = { product: Product; qty: number }

export default function CashierPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [activeCat, setActiveCat] = useState<string>('Barchasi')
  const [cart, setCart] = useState<CartItem[]>([])
  const [payType, setPayType] = useState<'naqd' | 'karta' | 'qarz'>('naqd')
  const [debtorName, setDebtorName] = useState('')
  const [showPayModal, setShowPayModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    const u = localStorage.getItem('pos_user')
    if (!u) { router.push('/'); return }
    const parsed = JSON.parse(u)
    if (parsed.role !== 'worker') { router.push('/admin'); return }
    setUser(parsed)
    loadData()
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
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const filteredProducts = activeCat === 'Barchasi'
    ? products
    : products.filter(p => {
        const cat = categories.find(c => c.name === activeCat)
        return cat && p.category_id === cat.id
      })

  const addToCart = (product: Product) => {
    if (!product.is_available) return
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { product, qty: 1 }]
    })
  }

  const changeQty = (productId: string, delta: number) => {
    setCart(prev => {
      const updated = prev.map(i => i.product.id === productId ? { ...i, qty: i.qty + delta } : i)
      return updated.filter(i => i.qty > 0)
    })
  }

  const total = cart.reduce((s, i) => s + i.product.price * i.qty, 0)
  const fmt = (n: number) => n.toLocaleString('uz-UZ')

  const confirmOrder = async () => {
    if (cart.length === 0) return
    setLoading(true)
    const u = JSON.parse(localStorage.getItem('pos_user') || '{}')

    // Faol smena topish
    const { data: shift } = await supabase
      .from('shifts')
      .select('id')
      .eq('is_open', true)
      .single()

    // Buyurtma yaratish
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
      .select()
      .single()

    if (error || !order) { setLoading(false); return }

    // Buyurtma tarkibi
    await supabase.from('order_items').insert(
      cart.map(i => ({
        order_id: order.id,
        product_id: i.product.id,
        qty: i.qty,
        price: i.product.price,
      }))
    )

    setCart([])
    setDebtorName('')
    setPayType('naqd')
    setShowPayModal(false)
    setLoading(false)
    showToast('✅ Buyurtma tasdiqlandi!')
  }

  const cartQty = (id: string) => cart.find(i => i.product.id === id)?.qty || 0

  return (
    <div className="h-screen bg-[#F5F3EE] flex flex-col overflow-hidden">

      {/* TOPBAR */}
      <div className="bg-[#1C1407] px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <div className="text-[#F5C842] font-black tracking-widest text-base">EA MURUNTOV</div>
          <div className="text-gray-500 text-xs mt-0.5">{user?.name} · Kassir</div>
        </div>
        <button
          onClick={() => { localStorage.removeItem('pos_user'); router.push('/') }}
          className="border border-gray-600 text-gray-400 rounded-lg px-3 py-1.5 text-xs hover:border-gray-400 transition-all"
        >
          Chiqish
        </button>
      </div>

      {/* MAIN */}
      <div className="flex flex-1 overflow-hidden">

        {/* CHAP: MENYU */}
        <div className="flex flex-col border-r border-[#E0DDD5]" style={{width:'62%'}}>

          {/* KATEGORIYALAR */}
          <div className="bg-[#2C200A] px-3 py-2 flex gap-2 overflow-x-auto flex-shrink-0 scrollbar-hide">
            {['Barchasi', ...categories.map(c => c.name)].map(cat => (
              <button key={cat} onClick={() => setActiveCat(cat)}
                className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all flex-shrink-0 ${activeCat === cat ? 'bg-[#C8860A] text-[#1A1208]' : 'bg-[#3D2E10] text-gray-400 hover:text-gray-200'}`}>
                {cat}
              </button>
            ))}
          </div>

          {/* MAHSULOTLAR */}
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

                    {/* Rasm qismi */}
                    <div className="bg-gradient-to-br from-[#FFF3D6] to-[#FFE8A3] h-24 flex items-center justify-center relative">
                      <span className="text-5xl">🍽️</span>
                      {qty > 0 && (
                        <div className="absolute top-2 right-2 bg-[#C8860A] text-[#1A1208] rounded-full w-7 h-7 flex items-center justify-center text-sm font-black">
                          {qty}
                        </div>
                      )}
                    </div>

                    {/* Info */}
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

        {/* O'NG: SAVAT */}
        <div className="flex flex-col bg-white" style={{width:'38%'}}>
          <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <div className="font-black text-[#1A1208] text-base">Buyurtma</div>
            <div className="text-gray-400 text-xs mt-0.5">{cart.length > 0 ? `${cart.length} xil mahsulot` : "Savat bo'sh"}</div>
          </div>

          {/* CART ITEMS */}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-3">
                <div className="text-5xl">🛒</div>
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
                      className="w-7 h-7 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 font-bold text-base flex items-center justify-center hover:border-[#C8860A] hover:text-[#C8860A] transition-all">
                      −
                    </button>
                    <span className="font-black text-sm w-5 text-center">{item.qty}</span>
                    <button onClick={() => changeQty(item.product.id, 1)}
                      className="w-7 h-7 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 font-bold text-base flex items-center justify-center hover:border-[#C8860A] hover:text-[#C8860A] transition-all">
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

          {/* FOOTER */}
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

      {/* TO'LOV MODAL */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <div className="font-black text-lg text-[#1A1208]">To'lov turi</div>
              <button onClick={() => setShowPayModal(false)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold">✕</button>
            </div>
            <div className="text-gray-400 text-sm mb-1">Jami summa:</div>
            <div className="text-[#C8860A] font-black text-3xl mb-4">{fmt(total)} so'm</div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {(['naqd', 'karta', 'qarz'] as const).map(t => (
                <button key={t} type="button" onClick={() => setPayType(t)}            
                  className={`py-3 rounded-xl border-2 font-bold text-sm transition-all ${payType === t ? 'border-[#C8860A] bg-[#FFF8E7] text-[#1A1208]' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                  {t === 'naqd' ? '💵 Naqd' : t === 'karta' ? '💳 Karta' : '📝 Qarz'}
                </button>
              ))}
            </div>

            {payType === 'qarz' && (
              <input
                type="text"
                placeholder="Mijoz ismi"
                value={debtorName}
                onChange={e => setDebtorName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-4 outline-none focus:border-[#C8860A]"
              />
            )}

            <button onClick={confirmOrder} disabled={loading}
              className="w-full py-4 rounded-xl bg-[#1E7B47] text-white font-black text-base transition-all hover:bg-[#25964F] disabled:opacity-50">
              {loading ? 'Saqlanmoqda...' : '✓ Tasdiqlash'}
            </button>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-[#1A1208] text-[#F5C842] px-5 py-2.5 rounded-full text-sm font-bold z-50 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}