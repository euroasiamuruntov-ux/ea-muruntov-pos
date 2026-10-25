import { expect, test, type Page } from '@playwright/test'
import { db, P, resetDb } from './db'

const WORKER = '00000000-0000-0000-0000-00000000a002'

async function ownerMenu(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Egasi' }).click()
  await page.getByPlaceholder('Parol').fill('9999')
  await page.getByRole('button', { name: 'Kirish', exact: true }).click()
  await page.waitForURL('**/admin')
  await page.getByRole('button', { name: 'Menyu' }).click()
  await expect(page.getByTestId('menu-row').first()).toBeVisible()
}

const rows = (page: Page) => page.getByTestId('menu-row')

test.beforeEach(async () => { await resetDb() })

test('qidiruv va filtrlar: ro\'yxat tez topiladi', async ({ page }) => {
  await ownerMenu(page)
  await expect(rows(page)).toHaveCount(6)

  await page.getByLabel('Menyuda qidirish').fill('osh')
  await expect(rows(page)).toHaveCount(2)
  await expect(page.getByTestId('menu-count')).toHaveText('(2 / 6)')
  await page.getByLabel('Qidiruvni tozalash').click()

  await page.getByRole('button', { name: 'Ichimlik', exact: true }).click()
  await expect(rows(page)).toHaveCount(2)   // Cola, Kampot

  await page.getByRole('button', { name: 'Barcha kategoriya' }).click()
  await page.getByRole('button', { name: 'Yumshoq', exact: true }).first().click()   // holat filtri (birinchi "Yumshoq" tugmasi)
  await expect(rows(page)).toHaveCount(3)   // Somsa, Osh butun, Osh yarim

  await page.getByLabel('Menyuda qidirish').fill('choy')
  await expect(page.getByText('Topilmadi')).toBeVisible()
})

test('ro\'yxatdagi hammasiga rejimni bir bosishda o\'zgartirish', async ({ page }) => {
  await ownerMenu(page)
  await page.getByRole('button', { name: 'Ichimlik', exact: true }).click()
  page.once('dialog', d => d.accept())
  await page.getByText("Ro'yxatdagi hammasiga:").locator('..').getByRole('button', { name: 'Yumshoq' }).click()
  await expect(page.getByText('2 ta taom: Yumshoq')).toBeVisible()

  const { data } = await db.from('products').select('stock_mode').in('id', [P.cola, P.kampot])
  expect(data).toEqual([{ stock_mode: 'soft' }, { stock_mode: 'soft' }])
})

test('taomni tahrirlash: nom, narx, kategoriya, tez-tez, tugaganda yashir', async ({ page }) => {
  await ownerMenu(page)
  await page.getByRole('button', { name: 'Cola 1L tahrirlash' }).click()
  const dialog = page.getByRole('dialog', { name: 'Taomni tahrirlash' })
  await dialog.getByLabel('Taom nomi').fill('Cola 1.5L')
  await dialog.getByLabel('Taom narxi').fill('15000')
  await dialog.getByLabel('Taom kategoriyasi').selectOption({ label: 'Birinchi taom' })
  await dialog.getByRole('button', { name: 'Yumshoq' }).click()
  await dialog.getByLabel('Tez-tez sotiladi').check()
  await dialog.getByLabel('Tugaganda yashirish').check()
  await dialog.getByRole('button', { name: 'Saqlash' }).click()
  await expect(page.getByText('Cola 1.5L: saqlandi')).toBeVisible()

  const { data } = await db.from('products').select('name, price, category_id, stock_mode, is_unlimited, is_favorite, hide_when_empty').eq('id', P.cola).single()
  expect(data).toEqual({
    name: 'Cola 1.5L', price: 15000, category_id: '00000000-0000-0000-0000-00000000c001',
    stock_mode: 'soft', is_unlimited: false, is_favorite: true, hide_when_empty: true,
  })
})

test('tahrirlashda noto\'g\'ri narx rad etiladi', async ({ page }) => {
  await ownerMenu(page)
  await page.getByRole('button', { name: 'Cola 1L tahrirlash' }).click()
  const dialog = page.getByRole('dialog', { name: 'Taomni tahrirlash' })
  await dialog.getByLabel('Taom narxi').fill('0')
  await dialog.getByRole('button', { name: 'Saqlash' }).click()
  await expect(page.getByText("Narx musbat butun son bo'lishi kerak")).toBeVisible()
  const { data } = await db.from('products').select('price').eq('id', P.cola).single()
  expect(data!.price).toBe(12000)
})

test('sotuv tarixi bor taomni o\'chirib bo\'lmaydi, yangisini o\'chirsa bo\'ladi', async ({ page }) => {
  const { data: shift } = await db.from('shifts').insert({ opened_by: WORKER, is_open: true }).select().single()
  await db.rpc('create_order', { p_shift_id: shift!.id, p_worker_id: WORKER, p_pay_type: 'naqd', p_items: [{ product_id: P.somsa, qty: 1 }] })
  await ownerMenu(page)

  page.once('dialog', d => d.accept())
  await page.getByRole('button', { name: "Somsa o'chirish" }).click()
  await expect(page.getByText('"Somsa" sotuv tarixida bor')).toBeVisible()
  await expect(rows(page)).toHaveCount(6)

  await page.getByLabel('Yangi taom nomi').fill('Sinov taomi')
  await page.getByLabel('Yangi taom narxi').fill('5000')
  await page.getByLabel('Yangi taom kategoriyasi').selectOption({ label: 'Ikkinchi taom' })
  await page.getByRole('button', { name: "Qo'shish", exact: true }).click()
  await expect(page.getByText("Taom qo'shildi!")).toBeVisible()
  await expect(rows(page)).toHaveCount(7)

  page.once('dialog', d => d.accept())
  await page.getByRole('button', { name: "Sinov taomi o'chirish" }).click()
  await expect(rows(page)).toHaveCount(6)
})

test('kategoriya nomini o\'zgartirish', async ({ page }) => {
  await ownerMenu(page)
  page.once('dialog', d => d.accept('Ichimliklar'))
  await page.getByRole('button', { name: "Ichimlik nomini o'zgartirish" }).click()
  await expect(page.getByText("Kategoriya nomi o'zgartirildi")).toBeVisible()
  const { data } = await db.from('categories').select('name').eq('id', '00000000-0000-0000-0000-00000000c003').single()
  expect(data!.name).toBe('Ichimliklar')
})
