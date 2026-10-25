import { expect, test } from '@playwright/test'
import { db, P, resetDb } from './db'

const WORKER = '00000000-0000-0000-0000-00000000a002'

test.beforeEach(async () => { await resetDb() })

// Foydalanuvchi sinovi: butun x10 (osh "Cheksiz" paytida), 1 kg kirim, keyin yarim x12 (3 hissa yetmaydi)
test('rahbar hisoboti: osh bitta qozon sifatida, raqamlar mos va chalg\'itmaydi', async ({ page }) => {
  await db.from('products').update({ stock_mode: 'none', is_unlimited: true }).eq('id', P.oshButun)
  const { data: shift } = await db.from('shifts').insert({ opened_by: WORKER, is_open: true }).select().single()
  await db.from('osh_stock').insert({ shift_id: shift!.id, product_group: 'osh', total_hissa: 0 })

  const order = (productId: string, qty: number) => db.rpc('create_order', {
    p_shift_id: shift!.id, p_worker_id: WORKER, p_pay_type: 'naqd', p_items: [{ product_id: productId, qty }],
  })
  expect((await order(P.oshButun, 10)).error).toBeNull()

  await db.from('products').update({ stock_mode: 'soft', is_unlimited: false }).eq('id', P.oshButun)
  expect((await db.rpc('add_stock_in', { p_shift_id: shift!.id, p_worker_id: WORKER, p_product_id: P.oshButun, p_qty: 1 })).error).toBeNull()
  expect((await order(P.oshYarim, 12)).error).toBeNull()

  await page.goto('/')
  await page.getByRole('button', { name: 'Egasi' }).click()
  await page.getByPlaceholder('Parol').fill('9999')
  await page.getByRole('button', { name: 'Kirish', exact: true }).click()
  await page.waitForURL('**/admin')

  const card = page.getByTestId('osh-card')
  await expect(card).toBeVisible()
  // Foydalanuvchiga hissa ko'rsatilmaydi: kg va butun/yarim bilan
  await expect(card).not.toContainText('hissa')
  await expect(card).toContainText('+1 kg')                     // 1 kg kirim
  await expect(card).toContainText('= 7 butun yoki 10 yarim')   // 1 kg nechaga teng
  await expect(card).toContainText('+0.14 kg')                  // avto-kirim (3 hissa)
  await expect(card).toContainText('-2.57 kg')                  // 54 hissa sotilgan
  await expect(card).toContainText('10 butun + 12 yarim')
  await expect(card).toContainText("oshpaz yozilganidan ko'p qilgan")
  await expect(card).toContainText('1.43 kg (10 butun) tizimga yozilmagan holda sotilgan')
  await expect(card).not.toContainText('qozonda yetmagan')

  // Kirimlar ro'yxati: osh kg/hissa bilan, kasr raqam "ta" bo'lib chiqmaydi
  await expect(page.getByText('Osh butun — 1 kg = 7 butun')).toBeVisible()
  await expect(page.getByText('Osh yarim — 0.14 kg = 1 yarim')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('0.1428')

  // "Mahsulot hisobi" jadvalida osh qatorlari yo'q (aralashtirmaydi)
  const rows = page.locator('table tbody tr')
  const count = await rows.count()
  for (let i = 0; i < count; i++) await expect(rows.nth(i)).not.toContainText('Osh')
})

test('Tarix: yopilgan smenada ham osh bitta kartada, kg va porsiya bilan', async ({ page }) => {
  const { data: shift } = await db.from('shifts').insert({ opened_by: WORKER, is_open: true }).select().single()
  await db.from('osh_stock').insert({ shift_id: shift!.id, product_group: 'osh', total_hissa: 0 })
  expect((await db.rpc('add_osh_portions', {
    p_shift_id: shift!.id, p_worker_id: WORKER,
    p_items: [{ product_id: P.oshButun, qty: 5 }, { product_id: P.oshYarim, qty: 4 }],
  })).error).toBeNull()
  expect((await db.rpc('create_order', {
    p_shift_id: shift!.id, p_worker_id: WORKER, p_pay_type: 'naqd',
    p_items: [{ product_id: P.oshButun, qty: 3 }, { product_id: P.oshYarim, qty: 2 }],
  })).error).toBeNull()
  await db.from('shifts').update({ is_open: false, closed_at: new Date().toISOString(), closed_by: WORKER }).eq('id', shift!.id)

  await page.goto('/')
  await page.getByRole('button', { name: 'Egasi' }).click()
  await page.getByPlaceholder('Parol').fill('9999')
  await page.getByRole('button', { name: 'Kirish', exact: true }).click()
  await page.waitForURL('**/admin')
  await page.getByRole('button', { name: 'Tarix' }).click()
  await page.getByText('1 buyurtma').click()

  const card = page.getByTestId('osh-card')
  await expect(card).toBeVisible()
  await expect(card).not.toContainText('hissa')
  await expect(card).toContainText('+1.1 kg')                  // 5 butun + 4 yarim = 23 hissa
  await expect(card).toContainText('3 butun + 2 yarim')        // sotilgan
  await expect(card).toContainText('-0.62 kg')                 // 13 hissa
  await expect(card).toContainText('0.48 kg')                  // qoldiq 10 hissa
  await expect(card).toContainText('= 3 butun yoki 5 yarim')
  // Jadvalda osh qatorlari yo'q
  const rows = page.locator('table tbody tr')
  for (let i = 0; i < await rows.count(); i++) await expect(rows.nth(i)).not.toContainText('Osh')
})
