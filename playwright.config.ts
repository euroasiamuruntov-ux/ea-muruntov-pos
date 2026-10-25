import { defineConfig, devices } from '@playwright/test'

// E2E testlar LOKAL Docker bazasiga (supabase start) qarshi ishlaydi.
// `npm run dev` .env.development.local dan lokal bazani oladi. Next 16 bitta papkada faqat bitta dev server
// ishlatadi, shuning uchun 3000-portda dev server allaqachon ishlayotgan bo'lsa, shu ishlatiladi.
const PORT = 3000

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Kassir planshet landscape rejimida ishlaydi
    viewport: { width: 1180, height: 820 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1180, height: 820 } } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
