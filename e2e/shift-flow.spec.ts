import { expect, test, type Page } from '@playwright/test'
import { db, P, resetDb } from './db'

const WORKER = '00000000-0000-0000-0000-00000000a002'

async function cashierLogin(page: Page) {
  await page.goto('/')
  for (const d of '1234') await page.getByRole('button', { name: d, exact: true }).click()
  await page.waitForURL('**/cashier')
}

const card = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

/** O'tgan smena: Cola 5 ta bilan yopilgan (keyingi smena ochilganda qoldiq oynasida chiqadi) */
async function previousShiftWithCola() {
  await db.rpc('open_shift', { p_worker_id: WORKER, p_items: [{ product_id: P.cola, qty: 5, qty_original: 5, note: '' }] })
  const { data: shift } = await db.from('shifts').select('id').eq('is_open', true).single()
  const { error } = await db.rpc('close_shift', { p_shift_id: shift!.id, p_worker_id: WORKER, p_rows: [] })
  expect(error).toBeNull()
}

test.beforeEach(async () => { await resetDb() })

test("smena ochish: o'tgan qoldiq kamaytirilsa chiqim bo'lib yoziladi va qoldiq ikki marta ayrilmaydi", async ({ page }) => {
  await previousShiftWithCola()
  await cashierLogin(page)
  await page.getByRole('button', { name: 'Smena ochish' }).click()

  await expect(page.getByText("O'tgan smena qoldiqlari")).toBeVisible()
  const row = page.locator('div.bg-gray-50', { hasText: 'Cola 1L' }).first()
  await row.locator('input[type=number]').fill('3')
  await expect(row.getByText('2 ta chiqindi sifatida yoziladi')).toBeVisible()
  await row.getByPlaceholder('Izoh (ixtiyoriy)...').fill('sindi')
  await page.getByRole('button', { name: 'Tasdiqlash va smena ochish' }).click()
  await expect(page.getByText('Smena ochildi!')).toBeVisible()

  // Qoldiq 3 (5 emas, 1 emas!)
  await expect(card(page, 'Cola 1L')).toContainText('Qoldiq: 3 ta')
  const { data: wo } = await db.from('write_offs').select('qty, reason').eq('product_id', P.cola)
  expect(wo).toEqual([{ qty: 2, reason: 'Smena boshida chiqindi: sindi' }])
  const { data: ss } = await db.from('shift_stock').select('initial_qty').eq('product_id', P.cola)
  expect(ss!.map(r => r.initial_qty)).toContain(3)
})

test("'Qoldiqsiz boshlash': hammasi chiqindi, qoldiq 0 (minus emas), kirimdan keyin to'g'ri", async ({ page }) => {
  await previousShiftWithCola()
  await cashierLogin(page)
  await page.getByRole('button', { name: 'Smena ochish' }).click()
  await page.getByRole('button', { name: 'Qoldiqsiz boshlash' }).click()
  await expect(page.getByText('Smena ochildi!')).toBeVisible()
  await expect(card(page, 'Cola 1L')).toContainText('Tugadi!')

  await page.getByRole('button', { name: 'Kirim', exact: true }).click()
  await page.locator('select').selectOption({ label: 'Cola 1L' })
  await page.getByPlaceholder('Miqdor (dona)').fill('10')
  await page.getByRole('button', { name: 'Kirim qilish' }).click()
  await expect(card(page, 'Cola 1L')).toContainText('Qoldiq: 10 ta')   // 10, "10 - 5 = 5" emas
})

test("smena yopish: farq bor mahsulotga izoh majburiy, izoh bilan yopiladi va PDF yuklanadi", async ({ page }) => {
  await previousShiftWithCola()
  await cashierLogin(page)
  await page.getByRole('button', { name: 'Smena ochish' }).click()
  await page.getByRole('button', { name: 'Tasdiqlash va smena ochish' }).click()
  await expect(page.getByText('Smena ochildi!')).toBeVisible()

  await page.getByRole('button', { name: 'Smena', exact: true }).click()
  await page.getByRole('button', { name: 'Smena yopish' }).click()
  const colaRow = page.locator('div.bg-gray-50', { hasText: 'Cola 1L' }).first()
  await colaRow.locator('input[type=number]').fill('4')       // tizimda 5, sanaldi 4

  await page.getByRole('button', { name: 'Tasdiqlash va smena yopish' }).click()
  await expect(page.getByText('Izoh yozing: Cola 1L')).toBeVisible()
  const { data: stillOpen } = await db.from('shifts').select('id').eq('is_open', true)
  expect(stillOpen).toHaveLength(1)

  await colaRow.getByLabel('Cola 1L izohi').fill('1 ta yo\'qolgan')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Tasdiqlash va smena yopish' }).click()
  expect((await download).suggestedFilename()).toMatch(/^smena-hisobot-.*\.pdf$/)
  await expect(page.getByText('Smena yopildi! PDF yuklab olindi.')).toBeVisible()
  await expect(page.getByText('Smena yopiq')).toBeVisible()

  const { data: open } = await db.from('shifts').select('id').eq('is_open', true)
  expect(open).toHaveLength(0)
  const { data: rep } = await db.from('shift_reports').select('system_qty, actual_qty, diff, note').eq('product_id', P.cola).order('created_at', { ascending: false }).limit(1)
  expect(rep).toEqual([{ system_qty: 5, actual_qty: 4, diff: -1, note: "1 ta yo'qolgan" }])
})

test("qarz to'lovi: qarzdan ko'p to'lab bo'lmaydi, to'g'ri summa qarzni kamaytiradi", async ({ page }) => {
  await db.rpc('open_shift', { p_worker_id: WORKER, p_items: [] })
  const { data: shift } = await db.from('shifts').select('id').eq('is_open', true).single()
  await db.rpc('create_order', {
    p_shift_id: shift!.id, p_worker_id: WORKER, p_pay_type: 'qarz', p_items: [{ product_id: P.mastava, qty: 2 }],   // 30 000
    p_debtor_name: 'Karimov', p_debtor_phone: '901112233',
  })

  await cashierLogin(page)
  await page.getByRole('button', { name: 'Qarzdorlar' }).click()
  await page.getByText('Karimov').click()

  await page.getByLabel("To'lov summasi").fill('40000')
  await page.getByRole('button', { name: /To'lovni tasdiqlash/ }).click()
  await expect(page.getByText("To'lov qarzdan ko'p")).toBeVisible()

  await page.getByLabel("To'lov summasi").fill('12000')
  await page.getByRole('button', { name: /To'lovni tasdiqlash/ }).click()
  await expect(page.getByText(/18[\s,  ]000 so'm/).first()).toBeVisible()
  const { data: d } = await db.from('debtors').select('total_debt').eq('name', 'Karimov').single()
  expect(d!.total_debt).toBe(18000)
  const { data: pays } = await db.from('debt_payments').select('amount')
  expect(pays).toEqual([{ amount: 12000 }])
})

test("menyuda sotuv tarixi bor mahsulotni o'chirib bo'lmaydi: tushunarli xabar", async ({ page }) => {
  await db.rpc('open_shift', { p_worker_id: WORKER, p_items: [] })
  const { data: shift } = await db.from('shifts').select('id').eq('is_open', true).single()
  await db.rpc('create_order', { p_shift_id: shift!.id, p_worker_id: WORKER, p_pay_type: 'naqd', p_items: [{ product_id: P.somsa, qty: 1 }] })

  await cashierLogin(page)
  await page.getByRole('button', { name: 'Menyu' }).click()
  page.once('dialog', d => d.accept())
  await page.getByRole('button', { name: "Somsa o'chirish" }).click()
  await expect(page.getByText("sotuv tarixida bor")).toBeVisible()
  const { data } = await db.from('products').select('id').eq('id', P.somsa)
  expect(data).toHaveLength(1)
})
