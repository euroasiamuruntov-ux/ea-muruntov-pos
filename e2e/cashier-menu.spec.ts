import { expect, test } from '@playwright/test'
import { db, P, resetDb } from './db'

test.beforeEach(async () => { await resetDb() })

test('kassir menyusi: qidiruv va tahrirlash bor, qoldiq rejimi va yulduzcha yo\'q (faqat Rahbar)', async ({ page }) => {
  await page.goto('/')
  for (const d of '1234') await page.getByRole('button', { name: d, exact: true }).click()
  await page.waitForURL('**/cashier')
  await page.getByRole('button', { name: 'Menyu' }).click()

  const dialog = page.getByRole('dialog', { name: 'Menyu boshqaruvi' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByTestId('menu-row')).toHaveCount(6)

  // Qidiruv
  await dialog.getByLabel('Menyuda qidirish').fill('osh')
  await expect(dialog.getByTestId('menu-row')).toHaveCount(2)
  await dialog.getByLabel('Qidiruvni tozalash').click()

  // Rahbarga tegishli boshqaruv ko'rinmaydi
  await expect(dialog.getByRole('button', { name: 'Yumshoq', exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: /tez-tez sotiladiganlarga/ })).toHaveCount(0)
  await expect(dialog.getByText("Ro'yxatdagi hammasiga:")).toHaveCount(0)

  // Tahrirlash: narx o'zgaradi, qoldiq rejimi o'zgarmaydi
  await dialog.getByRole('button', { name: 'Cola 1L tahrirlash' }).click()
  const edit = page.getByRole('dialog', { name: 'Taomni tahrirlash' })
  await expect(edit.getByText('Qoldiq rejimi')).toHaveCount(0)
  await edit.getByLabel('Taom narxi').fill('13000')
  await edit.getByRole('button', { name: 'Saqlash' }).click()
  await expect(page.getByText('Cola 1L: saqlandi')).toBeVisible()

  const { data } = await db.from('products').select('price, stock_mode, is_favorite').eq('id', P.cola).single()
  expect(data).toEqual({ price: 13000, stock_mode: 'strict', is_favorite: false })

  // Bor/Yo'q
  await dialog.getByRole('button', { name: 'Cola 1L sotuvda' }).click()
  await expect(dialog.getByRole('button', { name: 'Cola 1L sotuvda' })).toHaveText("Yo'q")
  const { data: p2 } = await db.from('products').select('is_available').eq('id', P.cola).single()
  expect(p2!.is_available).toBe(false)

  // Esc bilan yopiladi
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})
