import { createClient } from '@supabase/supabase-js'

// Faqat LOKAL baza. Jonli bazaga hech qachon ulanmaydi.
export const LOCAL_URL = 'http://127.0.0.1:54321'
export const LOCAL_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'

export const db = createClient(LOCAL_URL, LOCAL_KEY)

export const P = {
  mastava: '00000000-0000-0000-0000-00000000b001',
  somsa: '00000000-0000-0000-0000-00000000b002',
  oshButun: '00000000-0000-0000-0000-00000000b003',
  oshYarim: '00000000-0000-0000-0000-00000000b004',
  cola: '00000000-0000-0000-0000-00000000b005',
  kampot: '00000000-0000-0000-0000-00000000b006',
}

export const C = {
  birinchi: '00000000-0000-0000-0000-00000000c001',
  ikkinchi: '00000000-0000-0000-0000-00000000c002',
  ichimlik: '00000000-0000-0000-0000-00000000c003',
}

// supabase/seed.sql dagi holat
const SEED_PRODUCTS: Record<string, { name: string; price: number; category_id: string; stock_mode: string }> = {
  [P.mastava]: { name: 'Mastava', price: 15000, category_id: C.birinchi, stock_mode: 'none' },
  [P.somsa]: { name: 'Somsa', price: 6000, category_id: C.ikkinchi, stock_mode: 'soft' },
  [P.oshButun]: { name: 'Osh butun', price: 40000, category_id: C.ikkinchi, stock_mode: 'soft' },
  [P.oshYarim]: { name: 'Osh yarim', price: 28000, category_id: C.ikkinchi, stock_mode: 'soft' },
  [P.cola]: { name: 'Cola 1L', price: 12000, category_id: C.ichimlik, stock_mode: 'strict' },
  [P.kampot]: { name: 'Kampot', price: 3000, category_id: C.ichimlik, stock_mode: 'strict' },
}
const SEED_CATEGORIES: Record<string, string> = {
  [C.birinchi]: 'Birinchi taom', [C.ikkinchi]: 'Ikkinchi taom', [C.ichimlik]: 'Ichimlik',
}
const SEED_PIDS = Object.keys(SEED_PRODUCTS)

/** Smena, buyurtma, kirim-chiqim va qarzlarni tozalaydi; menyuni seed holatiga qaytaradi */
export async function resetDb() {
  const nil = '00000000-0000-0000-0000-000000000000'
  for (const t of ['debt_payments', 'order_items', 'orders', 'debtors', 'stock_ins', 'write_offs', 'shift_reports', 'shift_stock', 'osh_stock', 'shifts']) {
    const { error } = await db.from(t).delete().neq('id', nil)
    if (error) throw new Error(`${t}: ${error.message}`)
  }
  // Testlarda qo'shilgan taomlar (seeddan tashqari) olib tashlanadi
  await db.from('products').delete().not('id', 'in', `(${SEED_PIDS.join(',')})`)
  for (const [id, name] of Object.entries(SEED_CATEGORIES)) await db.from('categories').update({ name }).eq('id', id)
  for (const [id, p] of Object.entries(SEED_PRODUCTS)) {
    await db.from('products').update({
      ...p, is_unlimited: p.stock_mode === 'none', is_available: true, is_favorite: false, hide_when_empty: false,
    }).eq('id', id)
  }
}
