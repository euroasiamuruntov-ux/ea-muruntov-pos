import { expect, test } from '@playwright/test'
import { db, P, resetDb } from './db'

// Ikki planshet bir vaqtda ishlaganda qoldiq va buyurtmalar buzilmasligi kerak (brauzer kerak emas)
const WORKER = '00000000-0000-0000-0000-00000000a002'

async function openShiftWith(coladQty: number) {
  const { data: shift } = await db.from('shifts').insert({ opened_by: WORKER, is_open: true }).select().single()
  await db.from('shift_stock').insert({ shift_id: shift!.id, product_id: P.cola, initial_qty: coladQty })
  return shift!.id as string
}

test.beforeEach(async () => { await resetDb() })

test('bir vaqtda 4 ta buyurtma: oxirgi Cola faqat bittasiga sotiladi', async () => {
  const shiftId = await openShiftWith(1)
  const call = () => db.rpc('create_order', {
    p_shift_id: shiftId, p_worker_id: WORKER, p_pay_type: 'naqd',
    p_items: [{ product_id: P.cola, qty: 1 }],
  })
  const results = await Promise.all([call(), call(), call(), call()])

  expect(results.filter(r => !r.error)).toHaveLength(1)
  expect(results.filter(r => r.error?.message === 'STOCK_SHORT')).toHaveLength(3)
  const { count } = await db.from('orders').select('*', { count: 'exact', head: true }).eq('shift_id', shiftId)
  expect(count).toBe(1)
})

test('bir xil request_id bilan parallel yuborilsa faqat bitta buyurtma yoziladi', async () => {
  const shiftId = await openShiftWith(10)
  const requestId = crypto.randomUUID()
  const call = () => db.rpc('create_order', {
    p_shift_id: shiftId, p_worker_id: WORKER, p_pay_type: 'naqd',
    p_items: [{ product_id: P.cola, qty: 1 }], p_request_id: requestId,
  })
  const results = await Promise.all([call(), call(), call()])

  expect(results.every(r => !r.error)).toBe(true)
  expect(results.filter(r => r.data?.duplicate)).toHaveLength(2)
  const { count } = await db.from('orders').select('*', { count: 'exact', head: true }).eq('request_id', requestId)
  expect(count).toBe(1)
})

test('yumshoq mahsulot: parallel buyurtmalarda avto-kirim jami farqqa teng', async () => {
  const { data: shift } = await db.from('shifts').insert({ opened_by: WORKER, is_open: true }).select().single()
  await db.from('shift_stock').insert({ shift_id: shift!.id, product_id: P.somsa, initial_qty: 2 })
  const call = () => db.rpc('create_order', {
    p_shift_id: shift!.id, p_worker_id: WORKER, p_pay_type: 'naqd',
    p_items: [{ product_id: P.somsa, qty: 3 }],
  })
  const results = await Promise.all([call(), call(), call()])
  expect(results.every(r => !r.error)).toBe(true)

  // Jami sotildi 9, boshlang'ich 2 -> avto-kirim 7, qoldiq 0
  const { data: ins } = await db.from('stock_ins').select('qty').eq('shift_id', shift!.id).eq('source', 'auto_extra')
  expect((ins ?? []).reduce((s, r) => s + Number(r.qty), 0)).toBe(7)
  const { data: bal } = await db.rpc('shift_balances', { p_shift_id: shift!.id })
  const somsa = (bal as { product_id: string; balance: number }[]).find(b => b.product_id === P.somsa)
  expect(Number(somsa!.balance)).toBe(0)
})
