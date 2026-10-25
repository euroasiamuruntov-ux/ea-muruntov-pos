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

/** Smena, buyurtma, kirim-chiqim va qarzlarni tozalaydi; mahsulotlarni seed holatiga qaytaradi */
export async function resetDb() {
  const nil = '00000000-0000-0000-0000-000000000000'
  for (const t of ['debt_payments', 'order_items', 'orders', 'debtors', 'stock_ins', 'write_offs', 'shift_reports', 'shift_stock', 'osh_stock', 'shifts']) {
    const { error } = await db.from(t).delete().neq('id', nil)
    if (error) throw new Error(`${t}: ${error.message}`)
  }
  const modes: Record<string, string> = {
    [P.mastava]: 'none', [P.somsa]: 'soft', [P.oshButun]: 'soft', [P.oshYarim]: 'soft', [P.cola]: 'strict', [P.kampot]: 'strict',
  }
  for (const [id, stock_mode] of Object.entries(modes)) {
    await db.from('products').update({ stock_mode, is_unlimited: stock_mode === 'none', is_available: true, is_favorite: false }).eq('id', id)
  }
}
