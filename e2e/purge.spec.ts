import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { db, P, resetDb } from './db'

const WORKER = '00000000-0000-0000-0000-00000000a002'
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

async function seedOldAndCurrent() {
  // 2 ta eski yopilgan smena (sinov), bugungi ochiq smena
  for (const [n, qty] of [[5, 2], [3, 1]] as const) {
    const { data: shift } = await db.from('shifts').insert({
      opened_by: WORKER, is_open: false, opened_at: daysAgo(n), closed_at: daysAgo(n - 0.3),
    }).select().single()
    const { data: order } = await db.from('orders').insert({
      shift_id: shift!.id, worker_id: WORKER, total: 6000 * qty, pay_type: 'naqd', debt_paid: true, created_at: daysAgo(n),
    }).select().single()
    await db.from('order_items').insert({ order_id: order!.id, product_id: P.somsa, qty, price: 6000 })
    await db.from('stock_ins').insert({ shift_id: shift!.id, product_id: P.somsa, qty: 5, worker_id: WORKER })
  }
  await db.from('debtors').insert({ name: 'Sinov qarzdor', total_debt: 1000 })
  await db.rpc('open_shift', { p_worker_id: WORKER, p_items: [] })
  const { data: open } = await db.from('shifts').select('id').eq('is_open', true).single()
  await db.rpc('create_order', { p_shift_id: open!.id, p_worker_id: WORKER, p_pay_type: 'naqd', p_items: [{ product_id: P.mastava, qty: 1 }] })
}

test.beforeEach(async () => { await resetDb() })

test("tozalash: ko'rish, zaxira, tasdiqlash va parol; ochiq smena va menyu o'chmaydi", async ({ page }) => {
  await seedOldAndCurrent()
  await page.goto('/')
  await page.getByRole('button', { name: 'Egasi' }).click()
  await page.getByPlaceholder('Parol').fill('9999')
  await page.getByRole('button', { name: 'Kirish', exact: true }).click()
  await page.waitForURL('**/admin')
  await page.getByRole('button', { name: 'Sozlama' }).click()

  // Ko'rishdan oldin o'chirish tugmasi yo'q
  await expect(page.getByRole('button', { name: "Hammasini o'chirish" })).toHaveCount(0)
  await page.getByRole('button', { name: "Nimalar o'chishini ko'rish" }).click()
  const preview = page.getByTestId('purge-preview')
  await expect(preview).toContainText('Smenalar')
  await expect(preview).toContainText('2 ta')
  await expect(preview).toContainText('Buyurtmalar')

  // Zaxirasiz tasdiqlash maydonlari yopiq
  await expect(page.getByLabel("Tasdiqlash so'zi")).toBeDisabled()
  await expect(page.getByRole('button', { name: "Hammasini o'chirish" })).toBeDisabled()

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Zaxira faylni yuklab olish' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^zaxira-\d{4}-\d{2}-\d{2}\.json$/)
  const backup = JSON.parse(readFileSync(await file.path(), 'utf8'))
  expect(backup.shifts).toHaveLength(2)
  expect(backup.orders).toHaveLength(2)
  expect(backup.orders[0].order_items).toHaveLength(1)
  expect(backup.stock_ins).toHaveLength(2)

  // Noto'g'ri so'z yoki parol bilan o'chmaydi
  await page.getByLabel("Tasdiqlash so'zi").fill('tozalash')
  await page.getByLabel('Rahbar paroli').fill('xato')
  await expect(page.getByRole('button', { name: "Hammasini o'chirish" })).toBeDisabled()
  await page.getByLabel("Tasdiqlash so'zi").fill('TOZALASH')
  await page.getByRole('button', { name: "Hammasini o'chirish" }).click()
  await expect(page.getByRole('alert').filter({ hasText: "Parol noto'g'ri" })).toBeVisible()
  expect((await db.from('shifts').select('id')).data).toHaveLength(3)

  // To'g'ri parol
  await page.getByLabel('Rahbar paroli').fill('9999')
  await page.getByRole('button', { name: "Hammasini o'chirish" }).click()
  await expect(page.getByText('Tozalandi: 2 smena, 2 buyurtma')).toBeVisible()

  const { data: shifts } = await db.from('shifts').select('is_open')
  expect(shifts).toEqual([{ is_open: true }])                       // ochiq smena qoldi
  expect((await db.from('orders').select('id')).data).toHaveLength(1) // bugungi buyurtma qoldi
  expect((await db.from('stock_ins').select('id')).data).toHaveLength(0)
  expect((await db.from('products').select('id')).data).toHaveLength(6) // menyu o'chmadi
  expect((await db.from('debtors').select('id')).data).toHaveLength(1)  // qarzdor tanlanmagan edi
  // Panel yangilandi: ko'rsatuv tozalandi
  await expect(page.getByTestId('purge-preview')).toHaveCount(0)
})

test("tozalash: qarzdorlarni ham tanlasa ular o'chadi; o'chadigan narsa yo'q bo'lsa tugma chiqmaydi", async ({ page }) => {
  await seedOldAndCurrent()
  await page.goto('/')
  await page.getByRole('button', { name: 'Egasi' }).click()
  await page.getByPlaceholder('Parol').fill('9999')
  await page.getByRole('button', { name: 'Kirish', exact: true }).click()
  await page.waitForURL('**/admin')
  await page.getByRole('button', { name: 'Sozlama' }).click()

  await page.getByLabel("Qarzdorlar ro'yxatini ham tozalash").check()
  await page.getByRole('button', { name: "Nimalar o'chishini ko'rish" }).click()
  await expect(page.getByTestId('purge-preview')).toContainText('Qarzdorlar')

  await page.getByRole('button', { name: 'Zaxira faylni yuklab olish' }).click()
  await page.getByLabel("Tasdiqlash so'zi").fill('TOZALASH')
  await page.getByLabel('Rahbar paroli').fill('9999')
  await page.getByRole('button', { name: "Hammasini o'chirish" }).click()
  await expect(page.getByText(/^Tozalandi/)).toBeVisible()
  expect((await db.from('debtors').select('id')).data).toHaveLength(0)

  // Endi o'chiradigan narsa yo'q
  await page.getByRole('button', { name: "Nimalar o'chishini ko'rish" }).click()
  await expect(page.getByTestId('purge-preview')).toContainText("O'chiriladigan narsa yo'q")
  await expect(page.getByRole('button', { name: 'Zaxira faylni yuklab olish' })).toHaveCount(0)
})
