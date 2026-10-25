import { expect, test, type Page } from '@playwright/test'
import { db, P, resetDb } from './db'

// Kassirning asosiy savdo oqimlari (qarz, ichki, moslashuvchan to'lov, chiqim, kampot, ko'p hisob)
async function cashierWithShift(page: Page) {
  await page.goto('/')
  for (const d of '1234') await page.getByRole('button', { name: d, exact: true }).click()
  await page.waitForURL('**/cashier')
  await page.getByRole('button', { name: 'Smena ochish' }).click()
  await expect(page.getByText("Savat bo'sh")).toBeVisible()
}

const card = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const payMethod = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

async function checkout(page: Page, method: string) {
  await page.getByRole('button', { name: 'Buyurtma berish' }).click()
  await payMethod(page, method).click()
}
const confirmPay = (page: Page) => page.getByRole('button', { name: 'Tasdiqlash', exact: true }).click()

test.beforeEach(async () => { await resetDb() })

test('naqd sotuv: buyurtma va tarkibi yoziladi, savat tozalanadi', async ({ page }) => {
  await cashierWithShift(page)
  await card(page, 'Mastava').click()
  await card(page, 'Mastava').click()
  await checkout(page, 'Naqd')
  await confirmPay(page)
  await expect(page.getByText('Hisob 1 tasdiqlandi!')).toBeVisible()
  await expect(page.getByText("Savat bo'sh")).toBeVisible()

  const { data: orders } = await db.from('orders').select('total, pay_type, actual_paid, debt_paid')
  expect(orders).toEqual([{ total: 30000, pay_type: 'naqd', actual_paid: 30000, debt_paid: true }])
  const { data: items } = await db.from('order_items').select('qty, price')
  expect(items).toEqual([{ qty: 2, price: 15000 }])
})

test("qarz: yangi mijoz ismi yoziladi va qarzdor yaratiladi", async ({ page }) => {
  await cashierWithShift(page)
  await card(page, 'Mastava').click()
  await checkout(page, 'Qarz')
  await page.getByPlaceholder('Yangi mijoz ismi *').fill('Valiyev')
  await confirmPay(page)
  await expect(page.getByText('Hisob 1 tasdiqlandi!')).toBeVisible()

  const { data: debtors } = await db.from('debtors').select('name, total_debt')
  expect(debtors).toEqual([{ name: 'Valiyev', total_debt: 15000 }])
  const { data: orders } = await db.from('orders').select('pay_type, debtor_name, debt_paid')
  expect(orders).toEqual([{ pay_type: 'qarz', debtor_name: 'Valiyev', debt_paid: false }])
})

test("qarz: ism faqat qidiruv maydoniga yozilsa ham qarz yo'qolmaydi (avvalgi xato)", async ({ page }) => {
  await cashierWithShift(page)
  await card(page, 'Mastava').click()
  await checkout(page, 'Qarz')
  await page.getByPlaceholder('Ism yoki telefon...').fill('Toshpulatov')
  await expect(page.getByText("Topilmadi - yangi sifatida qo'shiladi")).toBeVisible()
  await confirmPay(page)
  await expect(page.getByText('Hisob 1 tasdiqlandi!')).toBeVisible()

  const { data: debtors } = await db.from('debtors').select('name, total_debt')
  expect(debtors).toEqual([{ name: 'Toshpulatov', total_debt: 15000 }])
})

test("qarz: mavjud qarzdor tanlansa qarzi oshadi", async ({ page }) => {
  await db.from('debtors').insert({ name: 'Karimov', phone: '901234567', total_debt: 5000 })
  await cashierWithShift(page)
  await card(page, 'Mastava').click()
  await checkout(page, 'Qarz')
  await page.getByPlaceholder('Ism yoki telefon...').fill('karim')
  await page.getByRole('button', { name: /Karimov/ }).click()
  await confirmPay(page)
  await expect(page.getByText('Hisob 1 tasdiqlandi!')).toBeVisible()

  const { data: debtors } = await db.from('debtors').select('name, total_debt')
  expect(debtors).toEqual([{ name: 'Karimov', total_debt: 20000 }])
})

test("ichki iste'mol: tushumga kirmaydi (summa 0), qoldiq kamayadi", async ({ page }) => {
  await cashierWithShift(page)
  await card(page, 'Somsa').click()
  await checkout(page, 'Ichki')
  await expect(page.getByText('Bu buyurtma tushum hisobiga kirmaydi')).toBeVisible()
  await confirmPay(page)
  await expect(page.getByText(/^Hisob 1 tasdiqlandi!/)).toBeVisible()

  const { data: orders } = await db.from('orders').select('total, pay_type, actual_paid')
  expect(orders).toEqual([{ total: 0, pay_type: 'ichki', actual_paid: 0 }])
  const { data: items } = await db.from('order_items').select('qty')
  expect(items).toEqual([{ qty: 1 }])
})

test("moslashuvchan to'lov: ±1000 so'm ichida qabul qilinadi, undan ko'p rad etiladi", async ({ page }) => {
  await cashierWithShift(page)
  await card(page, 'Mastava').click()                       // 15 000

  await page.getByRole('button', { name: "Moslashuvchan to'lov" }).click()
  await page.getByPlaceholder("Haqiqiy to'lov summasi").fill('13000')
  await expect(page.getByText("Ruxsat yo'q!")).toBeVisible()
  await expect(page.getByRole('button', { name: "To'lovga o'tish" })).toHaveCount(0)

  await page.getByPlaceholder("Haqiqiy to'lov summasi").fill('14500')
  await page.getByRole('button', { name: "To'lovga o'tish" }).click()
  await payMethod(page, 'Naqd').click()
  await confirmPay(page)
  await expect(page.getByText('Hisob 1 tasdiqlandi!')).toBeVisible()

  const { data: orders } = await db.from('orders').select('total, actual_paid, payment_note')
  expect(orders).toHaveLength(1)
  expect(orders![0].total).toBe(15000)
  expect(orders![0].actual_paid).toBe(14500)
  expect(orders![0].payment_note).toContain('Moslashuv')
})

test("chiqim: izoh majburiy, qoldiq kamayadi", async ({ page }) => {
  await cashierWithShift(page)
  const { data: shift } = await db.from('shifts').select('id').eq('is_open', true).single()
  await db.from('shift_stock').update({ initial_qty: 5 }).eq('shift_id', shift!.id).eq('product_id', P.cola)
  await page.reload()
  await expect(card(page, 'Cola 1L')).toContainText('Qoldiq: 5 ta')

  await page.getByRole('button', { name: 'Chiqim', exact: true }).click()
  await page.locator('select').selectOption({ label: 'Cola 1L' })
  await page.getByPlaceholder('Miqdor').fill('2')
  await expect(page.getByRole('button', { name: 'Chiqim qilish' })).toBeDisabled()    // izohsiz bo'lmaydi
  await page.getByPlaceholder('Izoh (sabab)...').fill('Idish sindi')
  await page.getByRole('button', { name: 'Chiqim qilish' }).click()
  await expect(page.getByText('Chiqim qilindi!')).toBeVisible()
  await expect(card(page, 'Cola 1L')).toContainText('Qoldiq: 3 ta')

  const { data: wo } = await db.from('write_offs').select('qty, reason').eq('product_id', P.cola)
  expect(wo).toEqual([{ qty: 2, reason: 'Idish sindi' }])
})

test("kampot: kirim litrda, qoldiq stakanda ko'rinadi", async ({ page }) => {
  await cashierWithShift(page)
  await page.getByRole('button', { name: 'Kirim', exact: true }).click()
  await page.locator('select').selectOption({ label: 'Kampot' })
  await page.getByPlaceholder('Miqdor (litr)').fill('4.2')
  const stakan = Math.floor(4.2 / 0.42)
  await expect(page.getByText(`${stakan} stakan`).first()).toBeVisible()
  await page.getByRole('button', { name: 'Kirim qilish' }).click()
  await expect(card(page, 'Kampot')).toContainText(`Qoldiq: ${stakan} stakan`)
})

test("ko'p hisob: ikkita hisob alohida, sahifa yangilansa savat saqlanadi", async ({ page }) => {
  await cashierWithShift(page)
  await card(page, 'Mastava').click()
  await page.getByRole('button', { name: 'Yangi hisob' }).click()
  await card(page, 'Somsa').click()
  await card(page, 'Somsa').click()
  await expect(page.getByRole('button', { name: 'Somsa miqdori' })).toHaveText('2')
  await expect(page.getByRole('button', { name: 'Mastava miqdori' })).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole('button', { name: 'Somsa miqdori' })).toHaveText('2')   // 2-hisob eslab qolindi

  await page.getByText('No 1', { exact: true }).click()
  await expect(page.getByRole('button', { name: 'Mastava miqdori' })).toHaveText('1')
  await expect(page.getByRole('button', { name: 'Somsa miqdori' })).toHaveCount(0)

  page.once('dialog', d => d.accept())
  await page.getByRole('button', { name: "Hisob 1 ni o'chirish" }).click()
  await expect(page.getByRole('button', { name: 'Somsa miqdori' })).toHaveText('2')
})

test("chiqish: login sahifasiga qaytadi, qayta kirish ishlaydi", async ({ page }) => {
  await cashierWithShift(page)
  await page.getByRole('button', { name: 'Chiqish' }).click()
  await page.waitForURL(u => new URL(u).pathname === '/')
  await expect(page.getByText('Xodim kodi')).toBeVisible()
  await page.goto('/cashier')
  await page.waitForURL(u => new URL(u).pathname === '/')   // kirmasdan kassirga o'tib bo'lmaydi
})
