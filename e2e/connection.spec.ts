import { expect, test } from '@playwright/test'

test('internet uzilsa xabar chiqadi, tiklansa yo\'qoladi', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByTestId('connection-banner')).toHaveCount(0)

  await context.setOffline(true)
  const banner = page.getByTestId('connection-banner')
  await expect(banner).toBeVisible()
  await expect(banner).toHaveAttribute('data-status', 'offline')
  await expect(banner).toContainText("Internet yo'q")

  await context.setOffline(false)
  await expect(page.getByText('Aloqa tiklandi')).toBeVisible()
  await expect(banner).toHaveCount(0)
})

test('baza javob bermasa (503) rahbar uchun ko\'rsatma bilan xabar chiqadi', async ({ page }) => {
  await page.route('**/api/health', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false}' }))
  await page.goto('/')
  const banner = page.getByTestId('connection-banner')
  await expect(banner).toHaveAttribute('data-status', 'db')
  await expect(banner).toContainText("Ma'lumotlar bazasi javob bermayapti")
  await expect(banner).toContainText('Restore project')

  // Baza tiklangach "Tekshirish" tugmasi xabarni olib tashlaydi
  await page.unroute('**/api/health')
  await page.getByRole('button', { name: 'Aloqani qayta tekshirish' }).click()
  await expect(banner).toHaveCount(0)
})

test('server umuman javob bermasa xabar chiqadi', async ({ page }) => {
  await page.route('**/api/health', route => route.abort('failed'))
  await page.goto('/')
  await expect(page.getByTestId('connection-banner')).toHaveAttribute('data-status', 'server')
  await expect(page.getByTestId('connection-banner')).toContainText('Server bilan aloqa')
})

test('kutilmagan xatoda oq ekran o\'rniga tushunarli xabar va "Qayta urinish" chiqadi', async ({ page }) => {
  await page.goto('/qa/error')
  const alert = page.getByRole('alert').filter({ hasText: 'Nimadir xato ketdi' })
  await expect(alert).toBeVisible()
  await expect(alert.getByRole('button', { name: 'Qayta urinish' })).toBeVisible()
  await expect(alert.getByRole('button', { name: 'Boshidan kirish' })).toBeVisible()
})

test('buzilgan kirish ma\'lumoti sahifani yiqitmaydi, login\'ga qaytaradi', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('pos_user', '{buzilgan json'))
  await page.goto('/cashier')
  await page.waitForURL(u => new URL(u).pathname === '/')
  await expect(page.getByText('Xodim kodi')).toBeVisible()
  await page.goto('/admin')
  await page.waitForURL(u => new URL(u).pathname === '/')
})

test('mavjud bo\'lmagan sahifa: "Sahifa topilmadi"', async ({ page }) => {
  await page.goto('/yoq-sahifa')
  await expect(page.getByText('Sahifa topilmadi')).toBeVisible()
})
