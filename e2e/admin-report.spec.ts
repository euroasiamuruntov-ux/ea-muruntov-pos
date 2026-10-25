import { expect, test, type Page } from '@playwright/test'
import { db, P, resetDb } from './db'

const WORKER = '00000000-0000-0000-0000-00000000a002'

async function seedShift() {
  const { data: shift } = await db.from('shifts').insert({ opened_by: WORKER, is_open: true }).select().single()
  const order = (pay: string, items: { product_id: string; qty: number }[], extra: Record<string, unknown> = {}) =>
    db.rpc('create_order', { p_shift_id: shift!.id, p_worker_id: WORKER, p_pay_type: pay, p_items: items, ...extra })
  await order('naqd', [{ product_id: P.somsa, qty: 4 }])           // 24 000 (tizimda 0 -> avto-kirim 4)
  await order('click', [{ product_id: P.mastava, qty: 2 }])        // 30 000
  await order('ichki', [{ product_id: P.somsa, qty: 1 }])          // xodim iste'moli
  await db.rpc('add_write_off', { p_shift_id: shift!.id, p_worker_id: WORKER, p_product_id: P.somsa, p_qty: 1, p_reason: "To'kildi" })
  return shift!.id as string
}

async function ownerLogin(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Egasi' }).click()
  await page.getByPlaceholder('Parol').fill('9999')
  await page.getByRole('button', { name: 'Kirish', exact: true }).click()
  await page.waitForURL('**/admin')
}

test.beforeEach(async () => { await resetDb() })

test("Hisobot: asosiy raqamlar tepada, batafsil hisobotlar bo'limlar ortida", async ({ page }) => {
  await seedShift()
  await ownerLogin(page)

  // Raqam ajratgichi brauzer tiliga bog'liq (bo'shliq yoki vergul)
  await expect(page.getByTestId('kpi-revenue')).toHaveText(/^54[\s,  ]000 som$/)
  await expect(page.getByTestId('kpi-auto')).toContainText('Somsa +5')   // 4 + 1 (ichki ham tizimda yo'q edi)

  // Hammasi yopiq
  for (const name of [/^To'lov turlari/, /^Mahsulot hisobi/, /^Ichki iste'mol/, /^Chiqimlar/, /^Kirimlar/]) {
    await expect(page.getByRole('button', { name })).toHaveAttribute('aria-expanded', 'false')
  }
  await expect(page.locator('table')).toHaveCount(0)

  // To'lov turlari
  await page.getByRole('button', { name: /^To'lov turlari/ }).click()
  await expect(page.getByText(/^24[\s,  ]000 som$/).first()).toBeVisible()   // naqd
  await expect(page.getByText(/^30[\s,  ]000 som$/).first()).toBeVisible()   // click

  // Mahsulot hisobi: jadval ochiladi
  await page.getByRole('button', { name: /^Mahsulot hisobi/ }).click()
  await expect(page.locator('table tbody tr')).toHaveCount(2)                 // Somsa, Mastava

  // Hammasini ochish / yopish
  await page.getByRole('button', { name: 'Hammasini ochish' }).click()
  await expect(page.getByRole('button', { name: /^Chiqimlar/ })).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByText('"To\'kildi"')).toBeVisible()
  await page.getByRole('button', { name: 'Hammasini yopish' }).click()
  await expect(page.getByRole('button', { name: /^Chiqimlar/ })).toHaveAttribute('aria-expanded', 'false')
})

test('Hisobot: ochiq bo\'limlar sahifa yangilanganda eslab qolinadi', async ({ page }) => {
  await seedShift()
  await ownerLogin(page)
  await page.getByRole('button', { name: /^Kirimlar/ }).click()
  await expect(page.getByRole('button', { name: /^Kirimlar/ })).toHaveAttribute('aria-expanded', 'true')
  await page.reload()
  await expect(page.getByRole('button', { name: /^Kirimlar/ })).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('button', { name: /^Chiqimlar/ })).toHaveAttribute('aria-expanded', 'false')
})

test('PDF hisobot yuklab olinadi', async ({ page }) => {
  await seedShift()
  await ownerLogin(page)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'PDF hisobot yuklab olish' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^ea-muruntov-.*\.pdf$/)
})

test('Tarix: davr tanlash, eng ko\'p sotilganlar, kecha bo\'sh', async ({ page }) => {
  await seedShift()
  await ownerLogin(page)
  await page.getByRole('button', { name: 'Tarix' }).click()

  await expect(page.getByText('1 buyurtma').or(page.getByText('3 buyurtma'))).toBeVisible()
  await expect(page.getByText('Davriy hisobot')).toBeVisible()

  await page.getByRole('button', { name: /^Eng ko'p sotilgan taomlar/ }).click()
  const top = page.getByRole('button', { name: /^Eng ko'p sotilgan taomlar/ }).locator('..')
  await expect(top).toContainText('Somsa')
  await expect(top).toContainText('4 ta')        // ichkisiz sotilgan
  await expect(top).toContainText('Mastava')
  await expect(top).toContainText('2 ta')

  await page.getByRole('button', { name: 'Kecha' }).click()
  await expect(page.getByText("Bu davrda smena yo'q")).toBeVisible()

  await page.getByRole('button', { name: 'Hafta' }).click()
  await expect(page.getByText('Davriy hisobot')).toBeVisible()

  await page.getByRole('button', { name: 'Muddat' }).click()
  await page.getByLabel('Boshlanish sanasi').fill('2020-01-01')
  await expect(page.getByText('Davriy hisobot')).toBeVisible()
})

test('Tarix: smenani ochganda bo\'limlar va izohlar ko\'rinadi', async ({ page }) => {
  await seedShift()
  await ownerLogin(page)
  await page.getByRole('button', { name: 'Tarix' }).click()
  await page.getByRole('button', { name: /buyurtma/ }).first().click()

  await page.getByRole('button', { name: /^Mahsulot hisoboti/ }).click()
  await expect(page.locator('table tbody tr')).toHaveCount(2)

  await page.getByRole('button', { name: /^Izohlar va hodisalar/ }).click()
  await expect(page.getByText('"To\'kildi"')).toBeVisible()
  await expect(page.getByText("oshpaz yozilganidan ko'p tayyorlagan").first()).toBeVisible()
  await expect(page.getByText("Xodim ichki iste'mol")).toBeVisible()
})
