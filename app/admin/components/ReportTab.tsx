'use client'
import { ChevronsDownUp, ChevronsUpDown, FileDown } from 'lucide-react'
import { fmt } from '@/lib/format'
import { formatEquivalents, formatKg, type OshProduct } from '@/lib/osh'
import type { ShiftReport } from '@/lib/report'
import type { OrderItem, Shift, StockIn, WriteOff } from '@/lib/types'
import { useOpenSections } from '@/lib/useOpenSections'
import OshCard from './OshCard'
import Section from './Section'

type Props = {
  shift: Shift | null
  report: ShiftReport
  oshList: OshProduct[]
  orderItems: OrderItem[]
  writeOffs: WriteOff[]
  stockIns: StockIn[]
  workerName: (id: string) => string
  productName: (id: string) => string
  stockInLabel: (si: StockIn) => string
  onPDF: () => void
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
const card = 'bg-white rounded-2xl border border-gray-200 p-4'

// Hisobot: tepada har kuni kerak bo'ladigan asosiy raqamlar; qolgan hisobotlar bo'limlar ortida (tugma bosilganda ochiladi).
export default function ReportTab({ shift, report, oshList, orderItems, writeOffs, stockIns, workerName, productName, stockInLabel, onPDF }: Props) {
  const { pay, osh } = report
  const sections = useOpenSections('admin_report_sections')

  const available = {
    tolov: true,
    mahsulot: report.rows.length > 0,
    osh: osh.hasActivity,
    moslashuv: report.moslashuvOrders.length > 0,
    ichki: report.ichkiOrders.length > 0,
    chiqim: writeOffs.length > 0,
    kirim: stockIns.length > 0,
  }
  const ids = (Object.keys(available) as (keyof typeof available)[]).filter(k => available[k])
  const allOpen = ids.every(id => sections.isOpen(id))

  const row = 'flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0'

  if (!shift) {
    return <div className={`${card} text-center text-gray-400 text-sm`}>Hali smena ochilmagan</div>
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Smena holati (ixcham) */}
      <div className="flex items-center gap-2 text-xs text-gray-500 px-1">
        <span className={`px-2 py-0.5 rounded-full font-bold ${shift.is_open ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{shift.is_open ? 'Smena ochiq' : 'Oxirgi smena yopilgan'}</span>
        <span>{shift.opened_by ? workerName(shift.opened_by) : '—'} · {time(shift.opened_at)}{shift.closed_at ? ` — ${time(shift.closed_at)}` : ''}</span>
      </div>

      {/* Asosiy raqamlar */}
      <div className="grid grid-cols-2 gap-3">
        <div className={card}>
          <div className="text-xs text-gray-400 font-bold mb-1">Jami tushum</div>
          <div data-testid="kpi-revenue" className="font-black text-lg text-[#C8860A]">{fmt(pay.actual)} som</div>
          {pay.total !== pay.actual && <div className="text-[11px] text-gray-400 mt-0.5">Narx: {fmt(pay.total)}</div>}
        </div>
        <div className={card}>
          <div className="text-xs text-gray-400 font-bold mb-1">Buyurtmalar</div>
          <div className="font-black text-lg text-[#1A1208]">{report.orderCount} ta</div>
        </div>
        <div className={card}>
          <div className="text-xs text-gray-400 font-bold mb-1">Osh qoldig&apos;i</div>
          {osh.hasActivity ? (
            <>
              <div data-testid="kpi-osh" className="font-black text-lg text-[#1A1208]">{formatKg(osh.remaining, oshList)}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">= {formatEquivalents(osh.remaining, oshList)}</div>
            </>
          ) : <div className="font-black text-lg text-gray-300">—</div>}
        </div>
        <div className={card}>
          <div className="text-xs text-gray-400 font-bold mb-1">Avto-kirim</div>
          {report.autoItems.length > 0 ? (
            <div data-testid="kpi-auto" className="font-black text-sm text-amber-600 leading-snug">{report.autoItems.join(' · ')}</div>
          ) : <div className="font-black text-lg text-gray-300">Yo&apos;q</div>}
          {report.autoItems.length > 0 && <div className="text-[11px] text-gray-400 mt-0.5">oshpaz yozilganidan ko&apos;p qilgan</div>}
        </div>
      </div>

      {/* Bo'limlar */}
      <div className="flex items-center justify-between px-1 pt-1">
        <div className="text-xs font-black text-gray-400 tracking-wide">BATAFSIL HISOBOTLAR</div>
        <button type="button" onClick={() => sections.setAll(ids, !allOpen)} className="flex items-center gap-1 text-xs font-bold text-[#C8860A]">
          {allOpen ? <><ChevronsDownUp size={14}/> Hammasini yopish</> : <><ChevronsUpDown size={14}/> Hammasini ochish</>}
        </button>
      </div>

      <Section title="To'lov turlari" badge={fmt(pay.actual) + ' som'} open={sections.isOpen('tolov')} onToggle={() => sections.toggle('tolov')}>
        <div className="grid grid-cols-2 gap-px bg-gray-100">
          {[
            ['Naqd', fmt(pay.cash) + ' som', '#1E7B47'],
            ['Click', fmt(pay.click) + ' som', '#9333ea'],
            ['Karta', fmt(pay.card) + ' som', '#2563eb'],
            ['Qarz', fmt(pay.debt) + ' som', '#B83232'],
            ['Ichki iste\'mol', report.ichkiOrders.length + ' ta', '#f97316'],
          ].map(([label, val, color]) => (
            <div key={label} className="bg-white px-4 py-3">
              <div className="text-xs text-gray-400 font-bold">{label}</div>
              <div className="font-black text-base" style={{ color }}>{val}</div>
            </div>
          ))}
        </div>
      </Section>

      {available.mahsulot && (
        <Section title="Mahsulot hisobi" badge={report.rows.length} open={sections.isOpen('mahsulot')} onToggle={() => sections.toggle('mahsulot')}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-400">
                  <th className="text-left px-4 py-2 font-bold">Mahsulot</th>
                  {['B.', 'K.', 'S.', 'Ch.', 'Q.'].map(h => <th key={h} className="text-center px-1 py-2 font-bold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {report.rows.map(p => (
                  <tr key={p.id} className="border-t border-gray-50">
                    <td className="px-4 py-2 font-bold">{p.name}</td>
                    <td className="text-center px-1 py-2 text-gray-500">{p.initial}</td>
                    <td className="text-center px-1 py-2 font-bold text-green-600">
                      {p.stockIn > 0 ? `+${p.stockIn}` : '—'}
                      {p.autoIn > 0 && <div className="text-[9px] text-amber-600">avto +{p.autoIn}</div>}
                    </td>
                    <td className="text-center px-1 py-2 font-bold text-[#C8860A]">{p.sold > 0 ? p.sold : '—'}</td>
                    <td className="text-center px-1 py-2 font-bold text-red-500">{p.writeOff > 0 ? p.writeOff : '—'}</td>
                    <td className={`text-center px-1 py-2 font-black ${p.remaining < 0 ? 'text-red-600' : 'text-[#1A1208]'}`}>{p.remaining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 text-[11px] text-gray-400">B. boshlang&apos;ich · K. kirim · S. sotildi · Ch. chiqim · Q. qoldiq</div>
        </Section>
      )}

      {available.osh && (
        <Section title="Osh (umumiy qozon)" badge={formatKg(osh.remaining, oshList)} tone="#1A1208" open={sections.isOpen('osh')} onToggle={() => sections.toggle('osh')}>
          <OshCard summary={osh} products={oshList} embedded />
        </Section>
      )}

      {available.moslashuv && (
        <Section title="Moslashuvchan to'lovlar" badge={report.moslashuvOrders.length} open={sections.isOpen('moslashuv')} onToggle={() => sections.toggle('moslashuv')}>
          {report.moslashuvOrders.map(o => (
            <div key={o.id} className="px-4 py-3 border-b border-gray-50 last:border-0">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Narx: {fmt(o.total)} som</span>
                <span className="font-bold text-[#C8860A]">To&apos;landi: {fmt(o.actual_paid || o.total)} som</span>
              </div>
              {o.payment_note && <div className="text-[11px] text-gray-400 mt-0.5">{o.payment_note}</div>}
            </div>
          ))}
        </Section>
      )}

      {available.ichki && (
        <Section title="Ichki iste'mol" badge={report.ichkiOrders.length} tone="#f97316" open={sections.isOpen('ichki')} onToggle={() => sections.toggle('ichki')}>
          {report.ichkiOrders.map(o => (
            <div key={o.id} className="px-4 py-3 border-b border-gray-50 last:border-0">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-bold">{workerName(o.worker_id)}</span>
                <span className="text-gray-400">{time(o.created_at)}</span>
              </div>
              <div className="text-xs text-gray-500">{orderItems.filter(i => i.order_id === o.id).map(i => `${productName(i.product_id)} x ${i.qty}`).join(', ')}</div>
            </div>
          ))}
        </Section>
      )}

      {available.chiqim && (
        <Section title="Chiqimlar" badge={writeOffs.length} tone="#B83232" open={sections.isOpen('chiqim')} onToggle={() => sections.toggle('chiqim')}>
          {writeOffs.map(w => (
            <div key={w.id} className="px-4 py-3 border-b border-gray-50 last:border-0">
              <div className="flex justify-between text-xs mb-0.5">
                <span className="font-bold">{productName(w.product_id)} — {w.qty} ta</span>
                <span className="text-gray-400">{workerName(w.worker_id)}</span>
              </div>
              <div className="text-xs text-gray-500 italic">&quot;{w.reason}&quot;</div>
            </div>
          ))}
        </Section>
      )}

      {available.kirim && (
        <Section title="Kirimlar" badge={stockIns.length} tone="#1E7B47" open={sections.isOpen('kirim')} onToggle={() => sections.toggle('kirim')}>
          {stockIns.map(si => (
            <div key={si.id} className={row}>
              <div className="flex-1 text-xs">
                <div className="font-bold">
                  {productName(si.product_id)} — {stockInLabel(si)}
                  {si.source === 'auto_extra' && <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">avto</span>}
                </div>
                <div className="text-gray-400">{workerName(si.worker_id)}</div>
              </div>
              <div className="text-xs text-gray-400">{time(si.created_at)}</div>
            </div>
          ))}
        </Section>
      )}

      <button type="button" onClick={onPDF}
        className="w-full py-4 bg-[#1A1208] text-[#F5C842] rounded-2xl font-black text-sm flex items-center justify-center gap-2">
        <FileDown size={16}/> PDF hisobot yuklab olish
      </button>
    </div>
  )
}
