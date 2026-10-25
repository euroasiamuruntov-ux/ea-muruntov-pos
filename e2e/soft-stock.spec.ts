import { expect, test, type Page } from '@playwright/test'
import { db, P, resetDb } from './db'

async function loginCashier(page: Page) {
  await page.goto('/')
  for (const d of '1234') await page.getByRole('button', { name: d, exact: true }).click()
  await page.waitForURL('**/cashier')
}

async function openShift(page: Page) {
  await page.getByRole('button', { name: 'Smena ochish' }).click()
  await expect(page.getByText('Savat bo\'sh')).toBeVisible()
}

const card = (page: Page, name: string) => page.locator('div.cursor-pointer', { hasText: name }).filter({ has: page.locator('.font-extrabold', { hasText: new RegExp(`^${name}$`) }) }).first()

async function pay(page: Page, type = 'Naqd') {
  await page.getByRole('button', { name: 'Buyurtma berish' }).click()
  await page.getByRole('button', { name: type, exact: true }).click()
  await page.getByRole('button', { name: 'Tasdiqlash', exact: true }).click()
}

test.beforeEach(async () => { await resetDb() })

test('yumshoq mahsulot tizimda tugagan bo\'lsa ham sotiladi va avto-kirim yoziladi', async ({ page }) => {
  await loginCashier(page)
  await openShift(page)

  const somsa = card(page, 'Somsa')
  await expect(somsa.getByText('Tizimda tugagan')).toBeVisible()

  for (let i = 0; i < 3; i++) await somsa.click()
  await expect(page.getByText('Tizimda yetmaydi: +3 avto-kirim')).toBeVisible()

  await pay(page)
  await expect(page.getByText('Avto-kirim: Somsa +3')).toBeVisible()

  const { data: auto } = await db.from('stock_ins').select('qty, source').eq('product_id', P.somsa)
  expect(auto).toEqual([{ qty: 3, source: 'auto_extra' }])
  const { data: items } = await db.from('order_items').select('qty').eq('product_id', P.somsa)
  expect(items).toEqual([{ qty: 3 }])
  // Qoldiq minusga tushmaydi
  await expect(somsa.getByText('Tizimda tugagan')).toBeVisible()
})

test('qat\'iy mahsulot tugagan bo\'lsa sotilmaydi, kirimdan keyin sotiladi', async ({ page }) => {
  await loginCashier(page)
  await openShift(page)

  const cola = card(page, 'Cola 1L')
  await expect(cola.getByText('Tugadi!')).toBeVisible()
  await cola.click()
  await expect(page.getByText('Cola 1L tugadi!').first()).toBeVisible()
  await expect(page.getByText('Savat bo\'sh')).toBeVisible()

  await page.getByRole('button', { name: 'Kirim', exact: true }).click()
  await page.locator('select').selectOption({ label: 'Cola 1L' })
  await page.getByPlaceholder('Miqdor (dona)').fill('2')
  await page.getByRole('button', { name: 'Kirim qilish' }).click()
  await expect(cola.getByText('Qoldiq: 2 ta')).toBeVisible()

  await cola.click(); await cola.click(); await cola.click()
  await expect(page.getByText('Cola 1L tugadi!').first()).toBeVisible()
  await pay(page)
  await expect(page.getByText('Hisob 1 tasdiqlandi!')).toBeVisible()
  await expect(cola.getByText('Tugadi!')).toBeVisible()
})

test('osh: hissa yetmasa ham sotiladi, qoldiq 0 da qoladi', async ({ page }) => {
  await loginCashier(page)
  await openShift(page)

  const butun = card(page, 'Osh butun')
  await butun.click(); await butun.click()
  await pay(page)
  await expect(page.getByText('Avto-kirim: Osh butun +2')).toBeVisible()

  const { data: pool } = await db.from('osh_stock').select('total_hissa')
  // osh_stock qatori yo'q (kirim bo'lmagan), minus ham yo'q
  expect(pool ?? []).toEqual([])
  const { data: ins } = await db.from('stock_ins').select('source').eq('product_id', P.oshButun)
  expect(ins).toEqual([{ source: 'auto_extra' }])
})

test('rahbar mahsulot rejimini o\'zgartira oladi', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Egasi' }).click()
  await page.getByPlaceholder('Parol').fill('9999')
  await page.getByRole('button', { name: 'Kirish', exact: true }).click()
  await page.waitForURL('**/admin')

  await page.getByRole('button', { name: 'Menyu' }).click()
  const row = page.locator('div', { hasText: /^Cola 1L/ }).filter({ has: page.getByRole('button', { name: 'Yumshoq' }) }).last()
  await row.getByRole('button', { name: 'Yumshoq' }).click()
  await expect(page.getByText('Cola 1L: Yumshoq')).toBeVisible()

  const { data } = await db.from('products').select('stock_mode, is_unlimited').eq('id', P.cola).single()
  expect(data).toEqual({ stock_mode: 'soft', is_unlimited: false })
})
