'use client'
import { useMemo, useState } from 'react'
import { Pencil, Search, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { STOCK_MODES, stockModeOf, type StockMode } from '@/lib/stock'
import { filterMenu, parsePrice, STATUS_FILTERS, type MenuStatusFilter } from '@/lib/menu'
import { fmt } from '@/lib/format'
import type { Category, Product } from '@/lib/types'

type Props = {
  categories: Category[]
  products: Product[]
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>
  showToast: (msg: string) => void
}

type Form = {
  name: string; price: string; category_id: string; stock_mode: StockMode
  is_favorite: boolean; hide_when_empty: boolean; is_available: boolean
}

const MODE_COLOR: Record<StockMode, string> = { strict: 'bg-blue-50 text-blue-700', soft: 'bg-amber-50 text-amber-700', none: 'bg-gray-100 text-gray-600' }

export default function MenuTab({ categories, products, setCategories, setProducts, showToast }: Props) {
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [status, setStatus] = useState<MenuStatusFilter>('all')

  const [newCatName, setNewCatName] = useState('')
  const [newProd, setNewProd] = useState({ name: '', price: '', category_id: '', stock_mode: 'strict' as StockMode })
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)

  const visible = useMemo(() => filterMenu(products, { query, categoryId, status }), [products, query, categoryId, status])
  const catName = (id: string | null) => categories.find(c => c.id === id)?.name || 'Kategoriyasiz'
  const filtered = query.trim() !== '' || categoryId !== 'all' || status !== 'all'

  // ---- kategoriyalar
  const addCategory = async () => {
    const name = newCatName.trim()
    if (!name) return
    const { data, error } = await supabase.from('categories').insert({ name, order_num: categories.length + 1 }).select().single()
    if (error || !data) { showToast("Kategoriya qo'shilmadi: internetni tekshiring"); return }
    setCategories(p => [...p, data]); setNewCatName(''); showToast("Kategoriya qo'shildi!")
  }

  const renameCategory = async (c: Category) => {
    const name = window.prompt('Kategoriyaning yangi nomi:', c.name)?.trim()
    if (!name || name === c.name) return
    const { error } = await supabase.from('categories').update({ name }).eq('id', c.id)
    if (error) { showToast("Saqlanmadi: internetni tekshiring"); return }
    setCategories(p => p.map(x => x.id === c.id ? { ...x, name } : x))
    showToast('Kategoriya nomi o\'zgartirildi')
  }

  const deleteCategory = async (c: Category) => {
    const count = products.filter(p => p.category_id === c.id).length
    const warn = count > 0 ? `\n\nUndagi ${count} ta taom kategoriyasiz qoladi.` : ''
    if (!window.confirm(`"${c.name}" kategoriyasini o'chirasizmi?${warn}`)) return
    const { error } = await supabase.from('categories').delete().eq('id', c.id)
    if (error) { showToast("O'chirilmadi: internetni tekshiring"); return }
    setCategories(p => p.filter(x => x.id !== c.id))
    setProducts(p => p.map(x => x.category_id === c.id ? { ...x, category_id: null } : x))
    if (categoryId === c.id) setCategoryId('all')
  }

  // ---- mahsulot qo'shish
  const addProduct = async () => {
    const price = parsePrice(newProd.price)
    if (!newProd.name.trim() || !newProd.category_id) { showToast('Nomi va kategoriyani kiriting'); return }
    if (!price) { showToast("Narx musbat butun son bo'lishi kerak"); return }
    const { data, error } = await supabase.from('products').insert({
      name: newProd.name.trim(), price, category_id: newProd.category_id, is_available: true,
      stock_mode: newProd.stock_mode, is_unlimited: newProd.stock_mode === 'none',
    }).select().single()
    if (error || !data) { showToast("Taom qo'shilmadi: internetni tekshiring"); return }
    setProducts(p => [...p, data]); setNewProd({ name: '', price: '', category_id: newProd.category_id, stock_mode: newProd.stock_mode })
    showToast("Taom qo'shildi!")
  }

  // ---- bitta mahsulot ustida amallar
  const patchProduct = async (p: Product, patch: Partial<Product>, okMsg?: string) => {
    const { error } = await supabase.from('products').update(patch).eq('id', p.id)
    if (error) { showToast('Saqlanmadi: internetni tekshiring'); return false }
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, ...patch } : x))
    if (okMsg) showToast(okMsg)
    return true
  }

  const setMode = (p: Product, mode: StockMode) => {
    if (stockModeOf(p) === mode) return
    return patchProduct(p, { stock_mode: mode, is_unlimited: mode === 'none' }, `${p.name}: ${STOCK_MODES.find(m => m.id === mode)?.label}`)
  }

  const deleteProduct = async (p: Product) => {
    if (!window.confirm(`"${p.name}" ni o'chirasizmi?`)) return
    const { error } = await supabase.from('products').delete().eq('id', p.id)
    if (error) {
      // 23503 = boshqa jadvallar (buyurtmalar, kirim...) shu taomga bog'langan
      showToast(error.code === '23503'
        ? `"${p.name}" sotuv tarixida bor, o'chirib bo'lmaydi. Uni "Yo'q" qiling.`
        : "O'chirilmadi: internetni tekshiring")
      return
    }
    setProducts(prev => prev.filter(x => x.id !== p.id))
  }

  // ---- ro'yxatdagi hammasiga rejim (tez sozlash uchun)
  const setModeForAll = async (mode: StockMode) => {
    const label = STOCK_MODES.find(m => m.id === mode)?.label
    const targets = visible.filter(p => stockModeOf(p) !== mode)
    if (targets.length === 0) { showToast(`Hammasi allaqachon "${label}"`); return }
    if (!window.confirm(`Ro'yxatdagi ${targets.length} ta taomni "${label}" qilasizmi?`)) return
    const ids = targets.map(p => p.id)
    const { error } = await supabase.from('products').update({ stock_mode: mode, is_unlimited: mode === 'none' }).in('id', ids)
    if (error) { showToast('Saqlanmadi: internetni tekshiring'); return }
    setProducts(prev => prev.map(x => ids.includes(x.id) ? { ...x, stock_mode: mode, is_unlimited: mode === 'none' } : x))
    showToast(`${ids.length} ta taom: ${label}`)
  }

  // ---- tahrirlash oynasi
  const openEdit = (p: Product) => {
    setEditing(p)
    setForm({
      name: p.name, price: String(p.price), category_id: p.category_id || '', stock_mode: stockModeOf(p),
      is_favorite: !!p.is_favorite, hide_when_empty: !!p.hide_when_empty, is_available: p.is_available,
    })
  }

  const saveEdit = async () => {
    if (!editing || !form) return
    const price = parsePrice(form.price)
    if (!form.name.trim()) { showToast('Taom nomini kiriting'); return }
    if (!price) { showToast("Narx musbat butun son bo'lishi kerak"); return }
    setSaving(true)
    const ok = await patchProduct(editing, {
      name: form.name.trim(), price, category_id: form.category_id || null,
      stock_mode: form.stock_mode, is_unlimited: form.stock_mode === 'none',
      is_favorite: form.is_favorite, hide_when_empty: form.hide_when_empty, is_available: form.is_available,
    }, `${form.name.trim()}: saqlandi`)
    setSaving(false)
    if (ok) { setEditing(null); setForm(null) }
  }

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0 border ${active ? 'bg-[#C8860A] text-[#1A1208] border-[#C8860A]' : 'bg-white text-gray-500 border-gray-200'}`

  return (
    <div className="flex flex-col gap-3">
      {/* Qidiruv va filtrlar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-3 flex flex-col gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-3 text-gray-400"/>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Taom qidirish..." aria-label="Menyuda qidirish"
            className="w-full border border-gray-200 rounded-xl pl-9 pr-9 py-2.5 text-sm outline-none focus:border-[#C8860A]"/>
          {query && <button type="button" aria-label="Qidiruvni tozalash" onClick={() => setQuery('')} className="absolute right-1 top-1 w-8 h-8 text-gray-400 flex items-center justify-center"><X size={14}/></button>}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Kategoriya filtri">
          <button type="button" className={chip(categoryId === 'all')} onClick={() => setCategoryId('all')}>Barcha kategoriya</button>
          {categories.map(c => (
            <button key={c.id} type="button" className={chip(categoryId === c.id)} onClick={() => setCategoryId(c.id)}>{c.name}</button>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Holat filtri">
          {STATUS_FILTERS.map(f => (
            <button key={f.id} type="button" className={chip(status === f.id)} onClick={() => setStatus(f.id)}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* Ro'yxat */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
          <div className="font-black text-sm">Taomlar <span data-testid="menu-count" className="text-gray-400 font-bold">({visible.length}{filtered ? ` / ${products.length}` : ''})</span></div>
        </div>
        {visible.length > 0 && (
          <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-500">Ro&apos;yxatdagi hammasiga:</span>
            {STOCK_MODES.map(m => (
              <button key={m.id} type="button" onClick={() => setModeForAll(m.id)} title={m.hint}
                className="px-2.5 py-1 rounded-lg text-xs font-bold border border-gray-200 bg-white text-gray-600">{m.label}</button>
            ))}
          </div>
        )}
        <div className="px-4 py-2 border-b border-gray-100 text-[11px] text-gray-400 leading-relaxed">
          {STOCK_MODES.map(m => <span key={m.id} className="mr-3"><b>{m.label}</b>: {m.hint}</span>)}
        </div>

        {visible.length === 0 ? (
          <div className="py-10 text-center text-gray-300">
            <div className="text-3xl mb-1">🔍</div>
            <div className="text-sm font-bold">Topilmadi</div>
          </div>
        ) : visible.map(p => {
          const mode = stockModeOf(p)
          return (
            <div key={p.id} data-testid="menu-row" className="px-4 py-3 border-b border-gray-50 flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-sm truncate">{p.name}</span>
                  {!p.is_available && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600">Yo&apos;q</span>}
                  {p.hide_when_empty && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">tugaganda yashiriladi</span>}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{catName(p.category_id)} · {fmt(p.price)} som</div>
                <div className="flex gap-1 mt-1.5">
                  {STOCK_MODES.map(m => (
                    <button key={m.id} type="button" title={m.hint} onClick={() => setMode(p, m.id)}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border ${mode === m.id ? `border-[#C8860A] ${MODE_COLOR[m.id]}` : 'border-gray-200 bg-white text-gray-400'}`}>{m.label}</button>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => patchProduct(p, { is_favorite: !p.is_favorite }, p.is_favorite ? `${p.name}: tez-tez sotiladiganlardan olindi` : `${p.name}: kassirda tez-tez sotiladiganlarga qo'shildi`)}
                aria-label={`${p.name} tez-tez sotiladiganlarga`} title="Kassirda tepada ko'rsatish"
                className="text-lg flex-shrink-0 w-8 h-8 flex items-center justify-center" style={{ opacity: p.is_favorite ? 1 : 0.3 }}>⭐</button>
              <button type="button" onClick={() => patchProduct(p, { is_available: !p.is_available })} aria-label={`${p.name} sotuvda`}
                className={`px-2 h-8 rounded-full text-xs font-bold flex-shrink-0 ${p.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{p.is_available ? 'Bor' : "Yo'q"}</button>
              <button type="button" onClick={() => openEdit(p)} aria-label={`${p.name} tahrirlash`}
                className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 flex items-center justify-center flex-shrink-0"><Pencil size={14}/></button>
              <button type="button" onClick={() => deleteProduct(p)} aria-label={`${p.name} o'chirish`}
                className="w-8 h-8 text-gray-300 hover:text-red-500 flex items-center justify-center flex-shrink-0"><X size={16}/></button>
            </div>
          )
        })}
      </div>

      {/* Taom qo'shish */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="font-black text-sm mb-3">Taom qo&apos;shish</div>
        <div className="flex flex-col gap-2">
          <input value={newProd.name} onChange={e => setNewProd(s => ({ ...s, name: e.target.value }))} placeholder="Taom nomi" aria-label="Yangi taom nomi"
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C8860A]"/>
          <div className="flex gap-2">
            <input value={newProd.price} onChange={e => setNewProd(s => ({ ...s, price: e.target.value }))} placeholder="Narxi" type="number" inputMode="numeric" aria-label="Yangi taom narxi"
              className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C8860A]"/>
            <select value={newProd.category_id} onChange={e => setNewProd(s => ({ ...s, category_id: e.target.value }))} aria-label="Yangi taom kategoriyasi"
              className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C8860A] bg-white">
              <option value="">Kategoriya</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex gap-1.5">
            {STOCK_MODES.map(m => (
              <button key={m.id} type="button" title={m.hint} onClick={() => setNewProd(s => ({ ...s, stock_mode: m.id }))}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border ${newProd.stock_mode === m.id ? 'border-[#C8860A] bg-[#FFF8E7] text-[#C8860A]' : 'border-gray-200 text-gray-400'}`}>{m.label}</button>
            ))}
          </div>
          <button type="button" onClick={addProduct} className="py-2.5 bg-[#C8860A] text-[#1A1208] rounded-xl font-black text-sm">Qo&apos;shish</button>
        </div>
      </div>

      {/* Kategoriyalar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="font-black text-sm mb-3">Kategoriyalar</div>
        <div className="flex gap-2">
          <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Kategoriya nomi" aria-label="Yangi kategoriya nomi"
            className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C8860A]"/>
          <button type="button" onClick={addCategory} aria-label="Kategoriya qo'shish" className="px-4 bg-[#C8860A] text-[#1A1208] rounded-xl font-black">+</button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {categories.map(c => (
            <div key={c.id} className="flex items-center gap-1 bg-[#FFF8E7] border border-[#F5C842] rounded-full pl-3 pr-1 py-0.5">
              <span className="text-sm font-bold">{c.name}</span>
              <span className="text-[11px] text-gray-400">{products.filter(p => p.category_id === c.id).length}</span>
              <button type="button" aria-label={`${c.name} nomini o'zgartirish`} onClick={() => renameCategory(c)} className="w-7 h-7 text-gray-400 flex items-center justify-center"><Pencil size={12}/></button>
              <button type="button" aria-label={`${c.name} o'chirish`} onClick={() => deleteCategory(c)} className="w-7 h-7 text-gray-400 flex items-center justify-center"><X size={12}/></button>
            </div>
          ))}
        </div>
      </div>

      {/* Tahrirlash oynasi */}
      {editing && form && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => { setEditing(null); setForm(null) }}>
          <div role="dialog" aria-label="Taomni tahrirlash" className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="font-black text-base">Taomni tahrirlash</div>
              <button type="button" aria-label="Yopish" onClick={() => { setEditing(null); setForm(null) }} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X size={14}/></button>
            </div>
            <div className="flex flex-col gap-3">
              <label className="text-xs font-bold text-gray-500">Nomi
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} aria-label="Taom nomi"
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-black outline-none focus:border-[#C8860A]"/>
              </label>
              <div className="flex gap-2">
                <label className="flex-1 min-w-0 text-xs font-bold text-gray-500">Narxi (so&apos;m)
                  <input value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} type="number" inputMode="numeric" aria-label="Taom narxi"
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-black outline-none focus:border-[#C8860A]"/>
                </label>
                <label className="flex-1 min-w-0 text-xs font-bold text-gray-500">Kategoriya
                  <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} aria-label="Taom kategoriyasi"
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-black outline-none focus:border-[#C8860A] bg-white">
                    <option value="">Kategoriyasiz</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              </div>
              <div>
                <div className="text-xs font-bold text-gray-500 mb-1">Qoldiq rejimi</div>
                <div className="flex gap-1.5">
                  {STOCK_MODES.map(m => (
                    <button key={m.id} type="button" onClick={() => setForm({ ...form, stock_mode: m.id })}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold border ${form.stock_mode === m.id ? 'border-[#C8860A] bg-[#FFF8E7] text-[#C8860A]' : 'border-gray-200 text-gray-400'}`}>{m.label}</button>
                  ))}
                </div>
                <div className="text-[11px] text-gray-400 mt-1">{STOCK_MODES.find(m => m.id === form.stock_mode)?.hint}</div>
              </div>
              {([
                ['is_available', 'Sotuvda bor', "O'chiq bo'lsa kassirda ko'rinmaydi"],
                ['is_favorite', 'Tez-tez sotiladi', 'Kassirda tepada alohida qatorda ko\'rinadi'],
                ['hide_when_empty', 'Tugaganda yashirish', "Qoldiq 0 bo'lsa kassirda ko'rinmaydi (yumshoq taomda ishlamaydi)"],
              ] as const).map(([key, label, hint]) => (
                <label key={key} className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={form[key]} onChange={e => setForm({ ...form, [key]: e.target.checked })} aria-label={label} className="mt-1 w-5 h-5 accent-[#C8860A]"/>
                  <span><span className="block text-sm font-bold text-[#1A1208]">{label}</span><span className="block text-[11px] text-gray-400">{hint}</span></span>
                </label>
              ))}
              <button type="button" onClick={saveEdit} disabled={saving} className="py-3 bg-[#C8860A] text-[#1A1208] rounded-xl font-black text-sm disabled:opacity-50">{saving ? 'Saqlanmoqda...' : 'Saqlash'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
