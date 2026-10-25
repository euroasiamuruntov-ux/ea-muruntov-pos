import { expect, test, type Page } from '@playwright/test'
import { db, P, resetDb } from './db'

async function cashierWithShift(page: Page) {
  await page.goto('/')
  for (const d of '1234') await page.getByRole('button', { name: d, exact: true }).click()
  await page.waitForURL('**/cashier')
  await page.getByRole('button', { name: 'Smena ochish' }).click()
  await expect(page.getByText("Savat bo'sh")).toBeVisible()
}

const card = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

async function longPress(page: Page, name: string) {
  const el = card(page, name)
  await el.hover()
  await page.mouse.down()
  await page.waitForTimeout(700)
  await page.mouse.up()
}

test.beforeEach(async () => { await resetDb() })

test("qidiruv: taomni nomi bo'yicha topadi, kategoriyadan qat'i nazar", async ({ page }) => {
  await cashierWithShift(page)
  await page.getByLabel('Taom qidirish').fill('osh')
  await expect(page.getByText('2 ta topildi')).toBeVisible()
  await expect(card(page, 'Osh butun')).toBeVisible()
  await expect(card(page, 'Osh yarim')).toBeVisible()
  await expect(card(page, 'Cola 1L')).toHaveCount(0)

  await page.getByLabel('Taom qidirish').fill('osh but')
  await expect(page.getByText('1 ta topildi')).toBeVisible()

  await page.getByLabel('Taom qidirish').fill('choy')
  await expect(page.getByText('Topilmadi')).toBeVisible()

  await page.getByLabel('Qidiruvni tozalash').click()
  await expect(card(page, 'Cola 1L')).toBeVisible()
})

test('tez-tez sotiladiganlar qatori: Rahbar belgilagan taomlar tepada, bosilsa savatga tushadi', async ({ page }) => {
  await db.from('products').update({ is_favorite: true }).in('id', [P.oshButun, P.somsa])
  await cashierWithShift(page)

  const strip = page.getByTestId('favorites')
  await expect(strip).toBeVisible()
  await expect(strip.getByRole('button', { name: 'Tez: Osh butun' })).toBeVisible()
  await expect(strip.getByRole('button', { name: 'Tez: Somsa' })).toBeVisible()
  await expect(strip.getByRole('button', { name: 'Tez: Cola 1L' })).toHaveCount(0)

  await strip.getByRole('button', { name: 'Tez: Somsa' }).click()
  await strip.getByRole('button', { name: 'Tez: Somsa' }).click()
  await expect(page.getByRole('button', { name: 'Somsa miqdori' })).toHaveText('2')

  // Qidirilganda qator yashirinadi
  await page.getByLabel('Taom qidirish').fill('somsa')
  await expect(page.getByTestId('favorites')).toHaveCount(0)
})

test('sonni tez kiritish: kartani bosib turish va savatdagi sonni bosish raqam panelini ochadi', async ({ page }) => {
  await cashierWithShift(page)

  // 1) Kartani bosib turish -> 12 ta
  await longPress(page, 'Somsa')
  await expect(page.getByRole('dialog', { name: 'Son kiritish' })).toBeVisible()
  // Raqam panelida "1" va "2" tayyor tugmalar qatorida ham bor, shuning uchun klaviatura tugmasi (oxirgisi) olinadi
  await page.getByRole('dialog').getByRole('button', { name: '1', exact: true }).last().click()
  await page.getByRole('dialog').getByRole('button', { name: '2', exact: true }).last().click()
  await expect(page.getByTestId('pad-value')).toHaveText('12')
  await page.getByRole('button', { name: /^OK/ }).click()
  await expect(page.getByRole('button', { name: 'Somsa miqdori' })).toHaveText('12')

  // 2) Oddiy bosish +1 ishlayveradi (panelni ochmaydi)
  await card(page, 'Somsa').click()
  await expect(page.getByRole('dialog', { name: 'Son kiritish' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Somsa miqdori' })).toHaveText('13')

  // 3) Savatdagi sonni bosib o'zgartirish: tayyor tugma (5) va savatdan olib tashlash (0)
  await page.getByRole('button', { name: 'Somsa miqdori' }).click()
  await page.getByRole('button', { name: '5', exact: true }).first().click()
  await page.getByRole('button', { name: /^OK/ }).click()
  await expect(page.getByRole('button', { name: 'Somsa miqdori' })).toHaveText('5')

  await page.getByRole('button', { name: 'Somsa miqdori' }).click()
  await page.getByRole('button', { name: '0', exact: true }).click()
  await page.getByRole('button', { name: 'Savatdan olib tashlash' }).click()
  await expect(page.getByText("Savat bo'sh")).toBeVisible()
})

test("qat'iy taomda raqam paneli ham qoldiqdan oshirmaydi", async ({ page }) => {
  await cashierWithShift(page)
  const { data: shift } = await db.from('shifts').select('id').eq('is_open', true).single()
  await db.from('shift_stock').insert({ shift_id: shift!.id, product_id: P.cola, initial_qty: 3 })
  await page.reload()
  await expect(page.getByText("Savat bo'sh")).toBeVisible()

  await longPress(page, 'Cola 1L')
  await page.getByRole('button', { name: '9', exact: true }).click()
  await page.getByRole('button', { name: /^OK/ }).click()
  await expect(page.getByText('Cola 1L tugadi!').first()).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Son kiritish' })).toBeVisible()   // panel ochiq qoladi
  await page.getByRole('button', { name: 'C', exact: true }).click()
  await page.getByRole('button', { name: '3', exact: true }).first().click()
  await page.getByRole('button', { name: /^OK/ }).click()
  await expect(page.getByRole('button', { name: 'Cola 1L miqdori' })).toHaveText('3')
})

test('cheksiz taomda qoldiq o\'rniga "Cheksiz" ko\'rinadi', async ({ page }) => {
  await cashierWithShift(page)
  await expect(card(page, 'Mastava')).toContainText('Cheksiz')
})
