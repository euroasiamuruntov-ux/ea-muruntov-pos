'use client'
import { useEffect, useMemo, useState } from 'react'
import { Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fmt } from '@/lib/format'
import { formatKg } from '@/lib/osh'
import { PERIOD_LABELS, periodRange, type PeriodFilter } from '@/lib/period'
import { buildShiftReport, oshProductsOf, type ShiftReport } from '@/lib/report'
import type { Order, OrderItem, Product, ShiftSummary, StockIn, Worker, WriteOff } from '@/lib/types'
import { useOpenSections } from '@/lib/useOpenSections'
import OshCard from './OshCard'
import Section from './Section'

type SaleRow = { product_id: string; name: string; qty: number; internal_qty: number; revenue: number }
type EventRow = { type: 'chiqim' | 'smena_chiqim' | 'avto_kirim' | 'ichki' | 'farq'; text: string; izoh: string; xodim: string; vaqt: string | null }
type Detail = { report: ShiftReport; diffs: Record<string, number>; events: EventRow[] } | { error: string }
type Loaded = { key: string; history: ShiftSummary[]; sales: SaleRow[]; error: string }

const time = (iso: string) => new Date(iso).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
const EVENT_ICON: Record<EventRow['type'], string> = { chiqim: '⚠️', ichki: '🍽️', smena_chiqim: '🗑️', avto_kirim: '🍳', farq: '📊' }
const SMENA_BOSHI = 'Smena boshida chiqindi'

export default function HistoryTab({ products, workers }: { products: Product[]; workers: Worker[] }) {
  const [filter, setFilter] = useState<PeriodFilter>('bugun')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [reloadTick, setReloadTick] = useState(0)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, Detail>>({})
  const sections = useOpenSections('admin_history_sections')

  const key = JSON.stringify([filter, customFrom, customTo, reloadTick])
  const loading = loaded?.key !== key
  const history = useMemo(() => (loaded?.key === key ? loaded.history : []), [loaded, key])
  const sales = loaded?.key === key ? loaded.sales : []
  const error = loaded?.key === key ? loaded.error : ''

  const oshList = useMemo(() => oshProductsOf(products), [products])
  const workerName = (id: string | null | undefined) => workers.find(w => w.id === id)?.name || '—'
  const productName = (id: string) => products.find(p => p.id === id)?.name || "Noma'lum"

  // Davr o'zgarganda smenalar va sotuvlar serverdan shu davr uchun olinadi
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const range = periodRange(filter, customFrom, customTo)
      let q = supabase.from('shift_summary').select('*').order('opened_at', { ascending: false }).limit(500)
      if (range) q = q.gte('opened_at', range.from.toISOString()).lte('opened_at', range.to.toISOString())
      const [{ data: hist, error: e1 }, { data: sold, error: e2 }] = await Promise.all([
        q,
        supabase.rpc('period_sales', {
          p_from: (range?.from ?? new Date(2000, 0, 1)).toISOString(),
          p_to: (range?.to ?? new Date(2100, 0, 1)).toISOString(),
        }),
      ])
      if (cancelled) return
      setLoaded({
        key,
        history: (hist as ShiftSummary[]) || [],
        sales: ((sold as SaleRow[]) || []).map(r => ({ ...r, qty: Number(r.qty), internal_qty: Number(r.internal_qty), revenue: Number(r.revenue) })),
        error: e1 ? "Smenalar yuklanmadi. Internetni tekshiring." : e2 ? "Sotuvlar ro'yxati yuklanmadi (yangi baza funksiyasi o'rnatilmagan bo'lishi mumkin)." : '',
      })
    })()
    return () => { cancelled = true }
  }, [key, filter, customFrom, customTo])

  const totals = useMemo(() => ({
    smena: history.length,
    revenue: history.reduce((s, h) => s + Number(h.total_revenue), 0),
    cash: history.reduce((s, h) => s + Number(h.cash_revenue), 0),
    click: history.reduce((s, h) => s + Number(h.click_revenue), 0),
    card: history.reduce((s, h) => s + Number(h.card_revenue), 0),
    debt: history.reduce((s, h) => s + Number(h.debt_revenue), 0),
    orders: history.reduce((s, h) => s + Number(h.order_count), 0),
    ichki: history.reduce((s, h) => s + Number(h.ichki_count), 0),
  }), [history])

  const loadDetail = async (shiftId: string) => {
    if (details[shiftId] && !('error' in details[shiftId])) return
    const [ords, stock, ins, wo, rep, osh] = await Promise.all([
      supabase.from('orders').select('*, order_items(*)').eq('shift_id', shiftId),
      supabase.from('shift_stock').select('product_id, initial_qty').eq('shift_id', shiftId),
      supabase.from('stock_ins').select('*').eq('shift_id', shiftId),
      supabase.from('write_offs').select('*').eq('shift_id', shiftId),
      supabase.from('shift_reports').select('product_id, diff, note').eq('shift_id', shiftId),
      supabase.from('osh_stock').select('total_hissa').eq('shift_id', shiftId),
    ])
    if ([ords, stock, ins, wo, rep, osh].some(r => r.error)) {
      setDetails(prev => ({ ...prev, [shiftId]: { error: "Smena ma'lumoti yuklanmadi. Internetni tekshirib, qayta oching." } }))
      return
    }
    const orderRows = (ords.data || []) as (Order & { order_items: OrderItem[] })[]
    const orders = orderRows as Order[]   // order_items qo'shimcha maydoni hisobga ta'sir qilmaydi
    const orderItems: OrderItem[] = orderRows.flatMap(o => o.order_items || [])
    const stockIns = (ins.data || []) as StockIn[]
    const writeOffs = (wo.data || []) as WriteOff[]
    const reports = (rep.data || []) as { product_id: string; diff: number; note: string | null }[]

    const report = buildShiftReport({
      products, orders, orderItems,
      stocks: (stock.data || []) as { product_id: string; initial_qty: number }[],
      writeOffs, stockIns,
      poolHissa: (osh.data || []).reduce((s: number, r: { total_hissa: number | null }) => s + (r.total_hissa || 0), 0),
    })

    const events: EventRow[] = []
    writeOffs.filter(w => w.reason !== SMENA_BOSHI).forEach(w => events.push({
      type: 'chiqim', text: `${productName(w.product_id)} — ${w.qty} ta chiqim`, izoh: w.reason, xodim: workerName(w.worker_id), vaqt: w.created_at,
    }))
    writeOffs.filter(w => w.reason === SMENA_BOSHI).forEach(w => events.push({
      type: 'smena_chiqim', text: `${productName(w.product_id)} — ${w.qty} ta`, izoh: 'Smena boshida chiqindi', xodim: workerName(w.worker_id), vaqt: w.created_at,
    }))
    stockIns.filter(si => si.source === 'auto_extra').forEach(si => events.push({
      type: 'avto_kirim', text: `${productName(si.product_id)} — qo'shimcha tayyorlangan`,
      izoh: "Tizimda qoldiq yo'q edi: oshpaz yozilganidan ko'p tayyorlagan (avto-kirim)", xodim: workerName(si.worker_id), vaqt: si.created_at,
    }))
    report.ichkiOrders.forEach(o => {
      const items = orderItems.filter(i => i.order_id === o.id)
      if (items.length > 0) events.push({
        type: 'ichki', text: items.map(i => `${productName(i.product_id)} x${i.qty}`).join(', '), izoh: "Xodim ichki iste'mol", xodim: workerName(o.worker_id), vaqt: o.created_at,
      })
    })
    reports.filter(r => r.diff !== 0 && r.note).forEach(r => events.push({
      type: 'farq', text: `${productName(r.product_id)} — farq: ${r.diff > 0 ? '+' : ''}${r.diff} ta`, izoh: r.note || '', xodim: '—', vaqt: null,
    }))
    events.sort((a, b) => (!a.vaqt ? 1 : !b.vaqt ? -1 : new Date(a.vaqt).getTime() - new Date(b.vaqt).getTime()))

    setDetails(prev => ({ ...prev, [shiftId]: { report, diffs: Object.fromEntries(reports.map(r => [r.product_id, r.diff])), events } }))
  }

  const topSales = sales.filter(s => s.qty > 0 || s.internal_qty > 0).slice(0, 10)
  const chip = (active: boolean) => `flex-1 py-2 rounded-xl text-xs font-bold ${active ? 'bg-[#C8860A] text-[#1A1208]' : 'bg-gray-100 text-gray-500'}`

  return (
    <div className="flex flex-col gap-3">
      {/* Davr */}
      <div className="bg-white rounded-2xl border border-gray-200 p-3 flex flex-col gap-2.5">
        <div className="flex gap-1.5">
          {PERIOD_LABELS.map(f => <button key={f.id} type="button" className={chip(filter === f.id)} onClick={() => setFilter(f.id)}>{f.label}</button>)}
        </div>
        {filter === 'custom' && (
          <div className="flex gap-2 items-center">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} aria-label="Boshlanish sanasi" className="flex-1 border border-gray-200 rounded-xl px-2.5 py-2 text-sm outline-none"/>
            <span className="text-gray-400 text-xs">—</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} aria-label="Tugash sanasi" className="flex-1 border border-gray-200 rounded-xl px-2.5 py-2 text-sm outline-none"/>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm font-bold flex items-center justify-between gap-2">
          <span>{error}</span>
          <button type="button" onClick={() => setReloadTick(t => t + 1)} className="px-3 py-1 rounded-lg bg-red-100 text-xs">Qayta urinish</button>
        </div>
      )}

      {/* Davriy hisobot */}
      {history.length > 0 && (
        <div className="bg-[#1A1208] rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="text-[#F5C842] font-black text-sm flex items-center gap-1.5"><Calendar size={14}/> Davriy hisobot</div>
            <div className="text-gray-500 text-[11px]">{totals.smena} ta smena</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Jami tushum', fmt(totals.revenue) + ' som', '#F5C842'],
              ['Buyurtmalar', totals.orders + ' ta', '#a3e635'],
              ['Naqd', fmt(totals.cash) + ' som', '#4ade80'],
              ['Click', fmt(totals.click) + ' som', '#c084fc'],
              ['Karta', fmt(totals.card) + ' som', '#60a5fa'],
              ['Qarz', fmt(totals.debt) + ' som', '#f87171'],
              ['Ichki', totals.ichki + ' ta', '#fb923c'],
              ['Smenalar', totals.smena + ' ta', '#94a3b8'],
            ].map(([label, val, color]) => (
              <div key={label} className="bg-white/10 rounded-xl p-2.5">
                <div className="text-[11px] text-gray-500 mb-0.5">{label}</div>
                <div className="font-black text-[15px]" style={{ color }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {topSales.length > 0 && (
        <Section title="Eng ko'p sotilgan taomlar" badge={topSales.length} open={sections.isOpen('top')} onToggle={() => sections.toggle('top')}>
          {topSales.map((s, i) => (
            <div key={s.product_id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 text-sm">
              <span className="w-5 text-xs font-black text-gray-300">{i + 1}</span>
              <span className="flex-1 font-bold truncate">{s.name}</span>
              <span className="font-black text-[#C8860A]">{s.qty} ta</span>
              <span className="w-28 text-right text-xs text-gray-400">{fmt(s.revenue)} som</span>
            </div>
          ))}
        </Section>
      )}

      {/* Smenalar ro'yxati */}
      {loading && history.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 py-8 text-center text-sm font-bold text-gray-300">Yuklanmoqda...</div>
      ) : history.length === 0 && !error ? (
        <div className="bg-white rounded-2xl border border-gray-200 py-8 text-center text-gray-300">
          <div className="text-3xl mb-2">📋</div>
          <div className="text-sm font-bold">Bu davrda smena yo&apos;q</div>
        </div>
      ) : history.map(s => {
        const selected = selectedShiftId === s.id
        const detail = details[s.id]
        const sana = new Date(s.opened_at).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: '2-digit' })
        return (
          <div key={s.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <button type="button" aria-expanded={selected} className="w-full text-left px-4 py-3"
              onClick={() => { if (selected) setSelectedShiftId(null); else { setSelectedShiftId(s.id); loadDetail(s.id) } }}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.is_open ? 'bg-green-500' : 'bg-gray-300'}`}/>
                  <span className="font-black text-sm">{sana}</span>
                  <span className="text-xs text-gray-400">{time(s.opened_at)}{s.closed_at ? ` — ${time(s.closed_at)}` : ''}</span>
                </div>
                <span className="text-xs text-gray-400">{selected ? '▲' : '▼'}</span>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <span className="text-xs text-gray-500">{s.order_count} buyurtma</span>
                <span className="font-black text-sm text-[#C8860A]">{fmt(Number(s.total_revenue))} som</span>
                {s.is_open && <span className="text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">Ochiq</span>}
              </div>
              <div className="flex gap-3 ml-4 mt-1 text-xs text-gray-400">
                {s.opened_by_name && <span>Kim ochdi: {s.opened_by_name}</span>}
                {s.closed_by_name && <span>Kim yopdi: {s.closed_by_name}</span>}
              </div>
            </button>

            {selected && (
              <div className="border-t border-gray-100 p-3 bg-gray-50 flex flex-col gap-2.5">
                <Section title="To'lov turlari" badge={fmt(Number(s.total_revenue)) + ' som'} open={sections.isOpen('h-tolov')} onToggle={() => sections.toggle('h-tolov')}>
                  <div className="grid grid-cols-2 gap-px bg-gray-100">
                    {[
                      ['Jami tushum', fmt(Number(s.total_revenue)) + ' som', '#C8860A'],
                      ['Buyurtmalar', s.order_count + ' ta', '#1A1208'],
                      ['Naqd', fmt(Number(s.cash_revenue)) + ' som', '#16a34a'],
                      ['Click', fmt(Number(s.click_revenue)) + ' som', '#9333ea'],
                      ['Karta', fmt(Number(s.card_revenue)) + ' som', '#2563eb'],
                      ['Qarz', fmt(Number(s.debt_revenue)) + ' som', '#dc2626'],
                      ['Ichki', s.ichki_count + ' ta', '#f97316'],
                    ].map(([label, val, color]) => (
                      <div key={label} className="bg-white px-4 py-2.5">
                        <div className="text-[11px] text-gray-400">{label}</div>
                        <div className="font-black text-sm" style={{ color }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </Section>

                {!detail ? (
                  <div className="text-center text-xs text-gray-400 py-3">Yuklanmoqda...</div>
                ) : 'error' in detail ? (
                  <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-3 py-2 text-xs font-bold">
                    {detail.error}
                    <button type="button" className="ml-2 underline" onClick={() => { setDetails(p => { const n = { ...p }; delete n[s.id]; return n }); loadDetail(s.id) }}>Qayta urinish</button>
                  </div>
                ) : (
                  <>
                    {detail.report.rows.length > 0 && (
                      <Section title="Mahsulot hisoboti" badge={detail.report.rows.length} open={sections.isOpen('h-mahsulot')} onToggle={() => sections.toggle('h-mahsulot')}>
                        <div className="overflow-x-auto">
                          <table className="w-full text-[11px]">
                            <thead>
                              <tr className="bg-gray-50 text-gray-400">
                                <th className="text-left px-3 py-1.5 font-bold">Mahsulot</th>
                                {['B.', 'K.', 'S.', 'Ch.', 'Q.', 'Farq'].map(h => <th key={h} className="text-center px-1 py-1.5 font-bold">{h}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {detail.report.rows.map(r => {
                                const diff = detail.diffs[r.id] || 0
                                return (
                                  <tr key={r.id} className="border-t border-gray-50">
                                    <td className="px-3 py-1.5 font-bold">{r.name}</td>
                                    <td className="text-center px-1 text-gray-500">{r.initial > 0 ? r.initial : '—'}</td>
                                    <td className="text-center px-1 font-bold text-green-600">{r.stockIn > 0 ? `+${r.stockIn}` : '—'}</td>
                                    <td className="text-center px-1 font-bold text-[#C8860A]">{r.sold > 0 ? r.sold : '—'}</td>
                                    <td className="text-center px-1 font-bold text-red-500">{r.writeOff > 0 ? r.writeOff : '—'}</td>
                                    <td className="text-center px-1 font-black">{r.remaining}</td>
                                    <td className={`text-center px-1 font-black ${diff < 0 ? 'text-red-500' : diff > 0 ? 'text-green-600' : 'text-gray-300'}`}>{diff === 0 ? '—' : (diff > 0 ? '+' : '') + diff}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </Section>
                    )}

                    {detail.report.osh.hasActivity && (
                      <Section title="Osh (umumiy qozon)" badge={formatKg(detail.report.osh.remaining, oshList)} open={sections.isOpen('h-osh')} onToggle={() => sections.toggle('h-osh')}>
                        <OshCard summary={detail.report.osh} products={oshList} embedded />
                      </Section>
                    )}

                    {detail.events.length > 0 && (
                      <Section title="Izohlar va hodisalar" badge={detail.events.length} open={sections.isOpen('h-izoh')} onToggle={() => sections.toggle('h-izoh')}>
                        {detail.events.map((ev, i) => (
                          <div key={i} className="px-3 py-2 border-b border-gray-50 last:border-0 flex gap-2 items-start">
                            <div className="text-sm flex-shrink-0">{EVENT_ICON[ev.type]}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold">{ev.text}</div>
                              <div className="text-[11px] text-[#C8860A] italic mt-0.5">&quot;{ev.izoh}&quot;</div>
                              <div className="flex gap-2 mt-0.5 text-[10px] text-gray-400"><span>{ev.xodim}</span>{ev.vaqt && <span>{time(ev.vaqt)}</span>}</div>
                            </div>
                          </div>
                        ))}
                      </Section>
                    )}

                    {detail.report.rows.length === 0 && !detail.report.osh.hasActivity && detail.events.length === 0 && (
                      <div className="text-center text-xs text-gray-400 py-3">Mahsulot hisoboti yo&apos;q</div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
