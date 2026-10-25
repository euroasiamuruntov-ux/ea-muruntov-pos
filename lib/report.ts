// Smena hisoboti: ekran va PDF uchun yagona hisob-kitob (sof funksiyalar).
import { isStartDiscard } from './discard'
import { formatKg, summarizeOsh, type OshProduct, type OshSummary } from './osh'
import type { Order, OrderItem, Product, ShiftStock, StockIn, WriteOff } from './types'

export type ProductRow = {
  id: string
  name: string
  initial: number
  stockIn: number
  autoIn: number
  sold: number
  writeOff: number
  remaining: number
}

export type PayTotals = {
  /** narx bo'yicha (ichkisiz) */
  total: number
  /** haqiqiy to'langan (moslashuv bilan) */
  actual: number
  cash: number
  card: number
  click: number
  debt: number
}

export type ShiftReport = {
  orderCount: number
  pay: PayTotals
  ichkiOrders: Order[]
  moslashuvOrders: Order[]
  /** osh'siz mahsulotlar (osh alohida: `osh`) */
  rows: ProductRow[]
  osh: OshSummary
  /** avto-kirim bo'lgan taomlar: "Somsa +3", "Osh +0.14 kg" */
  autoItems: string[]
}

const sum = (nums: number[]) => nums.reduce((s, n) => s + Number(n), 0)

export function oshProductsOf(products: Product[]): OshProduct[] {
  return products
    .filter(p => p.unit_type === 'hissa')
    .map(p => ({ id: p.id, name: p.name, hissa_per_unit: p.hissa_per_unit, kg_to_hissa: p.kg_to_hissa }))
}

/** Tanlangan smena (yoki davr) ma'lumotlaridan hisobot. Kiruvchi ro'yxatlar allaqachon shu smenaga tegishli bo'lishi kerak. */
export function buildShiftReport(input: {
  products: Product[]
  orders: Order[]
  orderItems: OrderItem[]
  stocks: ShiftStock[]
  writeOffs: WriteOff[]
  stockIns: StockIn[]
  /** osh_stock.total_hissa */
  poolHissa: number
}): ShiftReport {
  const { products, orders, orderItems, stocks, writeOffs, stockIns, poolHissa } = input
  const paid = orders.filter(o => o.pay_type !== 'ichki')
  const actualOf = (o: Order) => o.actual_paid ?? o.total
  const byType = (type: string) => sum(orders.filter(o => o.pay_type === type).map(actualOf))

  const pay: PayTotals = {
    total: sum(paid.map(o => o.total)),
    actual: sum(paid.map(actualOf)),
    cash: byType('naqd'),
    card: byType('karta'),
    click: byType('click'),
    debt: sum(orders.filter(o => o.pay_type === 'qarz').map(o => o.total)),
  }

  const orderIds = new Set(orders.map(o => o.id))
  const soldItems = orderItems.filter(oi => orderIds.has(oi.order_id))

  const rows: ProductRow[] = products
    .filter(p => p.unit_type !== 'hissa')
    .map(p => {
      const sold = sum(soldItems.filter(oi => oi.product_id === p.id).map(oi => oi.qty))
      const initialQty = stocks.find(s => s.product_id === p.id)?.initial_qty || 0
      const wo = writeOffs.filter(w => w.product_id === p.id)
      const smenaChiqim = sum(wo.filter(w => isStartDiscard(w.reason)).map(w => w.qty))
      const oddiyChiqim = sum(wo.filter(w => !isStartDiscard(w.reason)).map(w => w.qty))
      const ins = stockIns.filter(si => si.product_id === p.id)
      const stockIn = sum(ins.map(si => si.qty))
      const autoIn = sum(ins.filter(si => si.source === 'auto_extra').map(si => si.qty))
      const initial = initialQty + smenaChiqim
      const writeOff = smenaChiqim + oddiyChiqim
      return { id: p.id, name: p.name, initial, stockIn, autoIn, sold, writeOff, remaining: initial + stockIn - sold - writeOff }
    })
    .filter(r => r.sold > 0 || r.writeOff > 0 || r.stockIn > 0 || r.initial > 0)

  const oshList = oshProductsOf(products)
  const osh = summarizeOsh({
    products: oshList,
    initialQty: Object.fromEntries(stocks.map(st => [st.product_id, st.initial_qty])),
    stockIns,
    soldItems,
    writeOffs,
    poolHissa,
  })

  const autoItems = [
    ...rows.filter(r => r.autoIn > 0).map(r => `${r.name} +${r.autoIn}`),
    ...(osh.auto > 0 ? [`Osh +${formatKg(osh.auto, oshList)}`] : []),
  ]

  return {
    orderCount: orders.length,
    pay,
    ichkiOrders: orders.filter(o => o.pay_type === 'ichki'),
    moslashuvOrders: orders.filter(o => !!o.payment_note),
    rows,
    osh,
    autoItems,
  }
}
