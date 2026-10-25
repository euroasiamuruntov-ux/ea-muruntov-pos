import { describe, expect, it } from 'vitest'
import { buildShiftReport } from './report'
import type { Order, OrderItem, Product, StockIn, WriteOff } from './types'

const product = (over: Partial<Product>): Product => ({ id: 'p', name: 'Taom', price: 1000, category_id: null, is_available: true, ...over })
const order = (over: Partial<Order>): Order => ({
  id: 'o', total: 0, pay_type: 'naqd', debt_paid: true, debtor_name: null, worker_id: 'w', created_at: '2026-10-25T10:00:00Z', ...over,
})

const somsa = product({ id: 'somsa', name: 'Somsa', price: 6000 })
const cola = product({ id: 'cola', name: 'Cola', price: 12000 })
const butun = product({ id: 'butun', name: 'Osh (butun)', unit_type: 'hissa', hissa_per_unit: 3, kg_to_hissa: 21 })
const yarim = product({ id: 'yarim', name: 'Osh (yarim)', unit_type: 'hissa', hissa_per_unit: 2, kg_to_hissa: 21 })
const products = [somsa, cola, butun, yarim]

describe('buildShiftReport: moliya', () => {
  const orders = [
    order({ id: '1', total: 10000, pay_type: 'naqd' }),
    order({ id: '2', total: 20000, pay_type: 'click', actual_paid: 19500, payment_note: 'Moslashuv: 19 500' }),
    order({ id: '3', total: 5000, pay_type: 'karta' }),
    order({ id: '4', total: 8000, pay_type: 'qarz', debtor_name: 'Aliyev', debt_paid: false }),
    order({ id: '5', total: 0, pay_type: 'ichki' }),
  ]
  const r = buildShiftReport({ products, orders, orderItems: [], stocks: [], writeOffs: [], stockIns: [], poolHissa: 0 })

  it("to'lov turlari bo'yicha jamlaydi", () => {
    expect(r.pay).toEqual({ total: 43000, actual: 42500, cash: 10000, card: 5000, click: 19500, debt: 8000 })
    expect(r.orderCount).toBe(5)
  })
  it("ichki va moslashuvchan to'lovlarni ajratadi", () => {
    expect(r.ichkiOrders.map(o => o.id)).toEqual(['5'])
    expect(r.moslashuvOrders.map(o => o.id)).toEqual(['2'])
  })
})

describe('buildShiftReport: mahsulot hisobi', () => {
  const orders = [order({ id: '1', total: 18000 }), order({ id: 'boshqa', total: 1 })]
  const orderItems: OrderItem[] = [
    { order_id: '1', product_id: 'somsa', qty: 5, price: 6000 },
    { order_id: 'boshqa-smena', product_id: 'somsa', qty: 99, price: 6000 },   // boshqa smena buyurtmasi hisobga kirmaydi
  ]
  const stockIns: StockIn[] = [
    { id: 'a', product_id: 'somsa', qty: 2, worker_id: 'w', created_at: '', source: 'manual' },
    { id: 'b', product_id: 'somsa', qty: 3, worker_id: 'w', created_at: '', source: 'auto_extra' },
  ]
  const writeOffs: WriteOff[] = [
    { id: 'x', product_id: 'somsa', qty: 1, reason: "To'kildi", worker_id: 'w', created_at: '' },
    { id: 'y', product_id: 'somsa', qty: 2, reason: 'Smena boshida chiqindi', worker_id: 'w', created_at: '' },
  ]
  const r = buildShiftReport({ products, orders, orderItems, stocks: [{ product_id: 'somsa', initial_qty: 1 }], writeOffs, stockIns, poolHissa: 0 })

  it("B + K - S - Ch = Q, smena boshidagi chiqindi boshlang'ichga qo'shiladi", () => {
    // boshlang'ich 1 + 2 (tashlangan) = 3; kirim 5; sotildi 5; chiqim 3
    expect(r.rows).toEqual([{ id: 'somsa', name: 'Somsa', initial: 3, stockIn: 5, autoIn: 3, sold: 5, writeOff: 3, remaining: 0 }])
  })
  it("kassir izohi bilan yozilgan 'Smena boshida chiqindi: ...' ham boshlang'ichga qaytariladi", () => {
    const r = buildShiftReport({
      products, orders: [], orderItems: [], stocks: [{ product_id: 'cola', initial_qty: 3 }], stockIns: [],
      writeOffs: [{ id: 'z', product_id: 'cola', qty: 2, reason: 'Smena boshida chiqindi: sinib qolgan', worker_id: 'w', created_at: '' }],
      poolHissa: 0,
    })
    // boshlang'ich 3 + 2 (tashlangan) = 5, chiqim 2, qoldiq 3
    expect(r.rows).toEqual([{ id: 'cola', name: 'Cola', initial: 5, stockIn: 0, autoIn: 0, sold: 0, writeOff: 2, remaining: 3 }])
  })
  it("faoliyati yo'q mahsulot qatorda ko'rinmaydi, osh jadvalga kirmaydi", () => {
    expect(r.rows.map(x => x.id)).toEqual(['somsa'])
  })
  it('avto-kirim xulosasi', () => {
    expect(r.autoItems).toEqual(['Somsa +3'])
  })
})

describe('buildShiftReport: osh', () => {
  it('osh bitta qozon sifatida hisoblanadi va avto-kirimga kiradi', () => {
    const orders = [order({ id: '1' })]
    const orderItems: OrderItem[] = [
      { order_id: '1', product_id: 'butun', qty: 2, price: 1 },
      { order_id: '1', product_id: 'yarim', qty: 3, price: 1 },
    ]
    const stockIns: StockIn[] = [
      { id: '1', product_id: 'butun', qty: 1, worker_id: 'w', created_at: '', source: 'manual' },
      { id: '2', product_id: 'yarim', qty: 3 / 21, worker_id: 'w', created_at: '', source: 'auto_extra' },
    ]
    const r = buildShiftReport({ products, orders, orderItems, stocks: [], writeOffs: [], stockIns, poolHissa: 0 })
    expect(r.osh.kirimHissa).toBe(21)
    expect(r.osh.auto).toBe(3)
    expect(r.osh.soldHissa).toBe(12)
    expect(r.rows).toEqual([])
    expect(r.autoItems).toEqual(['Osh +0.14 kg'])
  })
})
