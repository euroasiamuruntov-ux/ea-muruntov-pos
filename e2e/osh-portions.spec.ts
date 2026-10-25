import { expect, test, type Page } from '@playwright/test'
import { db, P, resetDb } from './db'

async function cashierWithShift(page: Page) {
  await page.goto('/')
  for (const d of '1234') await page.getByRole('button', { name: d, exact: true }).click()
  await page.waitForURL('**/cashier')
  await page.getByRole('button', { name: 'Smena ochish' }).click()
  await expect(page.getByText("Savat bo'sh")).toBeVisible()
}

test.beforeEach(async () => { await resetDb() })

test('osh kirimi porsiya bilan: 5 butun + 4 yarim, kg ko\'rsatiladi, qoldiq to\'g\'ri', async ({ page }) => {
  await cashierWithShift(page)

  await page.getByRole('button', { name: 'Kirim', exact: true }).click()
  await page.locator('select').selectOption({ label: 'Osh butun' })
  await page.getByRole('button', { name: 'Porsiya bilan' }).click()
  await page.getByLabel('butun porsiya soni').fill('5')
  await page.getByLabel('yarim porsiya soni').fill('4')
  // Ko'rinish: porsiyalar va kg (23 hissa = 1.1 kg), hissa so'zi yo'q
  await expect(page.getByText('5 butun + 4 yarim')).toBeVisible()
  await expect(page.getByText('1.1 kg')).toBeVisible()
  await page.getByRole('button', { name: 'Kirim qilish' }).click()
  await expect(page.getByText('Kirim qilindi: 5 butun + 4 yarim')).toBeVisible()

  // 23 hissa: 7 butun yoki 11 yarim
  const { data: pool } = await db.from('osh_stock').select('total_hissa')
  expect(pool).toEqual([{ total_hissa: 23 }])
  await expect(page.locator('div.cursor-pointer', { hasText: 'Osh butun' }).first().getByText('Qoldiq: 7 ta')).toBeVisible()
  await expect(page.locator('div.cursor-pointer', { hasText: 'Osh yarim' }).first().getByText('Qoldiq: 11 ta')).toBeVisible()
})

test('osh kirimi kg bilan: ekranda nechta butun va yarimga tengligi ko\'rinadi', async ({ page }) => {
  await cashierWithShift(page)
  await page.getByRole('button', { name: 'Kirim', exact: true }).click()
  await page.locator('select').selectOption({ label: 'Osh butun' })
  await page.getByPlaceholder('Miqdor (kg)').fill('2')
  await expect(page.getByText('7 butun yoki 10 yarim')).toHaveCount(0)
  await expect(page.getByText('14 butun yoki 21 yarim')).toBeVisible()
  await page.getByRole('button', { name: 'Kirim qilish' }).click()
  await expect(page.getByText('Kirim qilindi!')).toBeVisible()
  const { data: pool } = await db.from('osh_stock').select('total_hissa')
  expect(pool).toEqual([{ total_hissa: 42 }])
  expect(P.oshButun).toBeTruthy()
})

test("'+ tayyor' tugmasi osh uchun porsiya rejimida ochiladi", async ({ page }) => {
  await cashierWithShift(page)
  await page.locator('div.cursor-pointer', { hasText: 'Osh butun' }).first().getByRole('button', { name: '+ tayyor' }).click()
  await expect(page.getByLabel('butun porsiya soni')).toBeVisible()
  await expect(page.getByLabel('yarim porsiya soni')).toBeVisible()
})
