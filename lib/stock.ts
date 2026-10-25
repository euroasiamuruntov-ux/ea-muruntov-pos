// Qoldiq mantig'i. Hisob-kitobning o'zi bazada (shift_balances, create_order);
// bu yerda faqat kassirga nima ko'rsatish va nimaga ruxsat berish hal qilinadi.

/**
 * strict - qoldiq 0 bo'lsa sotilmaydi (Cola, shisha ichimlik)
 * soft   - qoldiq 0 bo'lsa ham sotiladi, farq avtomatik "qo'shimcha tayyorlandi" kirimi bo'ladi
 * none   - qoldiq tekshirilmaydi
 */
export type StockMode = 'strict' | 'soft' | 'none'

export const STOCK_MODES: { id: StockMode; label: string; hint: string }[] = [
  { id: 'strict', label: "Qat'iy", hint: "Qoldiq 0 bo'lsa sotilmaydi" },
  { id: 'soft', label: 'Yumshoq', hint: "Qoldiq 0 bo'lsa ham sotiladi, farq avto-kirim bo'ladi" },
  { id: 'none', label: 'Cheksiz', hint: 'Qoldiq tekshirilmaydi' },
]

export type Balance = {
  product_id: string
  initial_qty: number
  kirim_qty: number
  auto_qty: number
  sold_qty: number
  writeoff_qty: number
  balance: number
}

export type Balances = Record<string, Balance>

/** Eski bazadan kelgan mahsulotda stock_mode bo'lmasa, is_unlimited dan olinadi */
export function stockModeOf(p: { stock_mode?: StockMode | null; is_unlimited?: boolean | null }): StockMode {
  if (p.stock_mode) return p.stock_mode
  return p.is_unlimited ? 'none' : 'strict'
}

export function toBalances(rows: Balance[] | null | undefined): Balances {
  const out: Balances = {}
  for (const r of rows ?? []) {
    out[r.product_id] = {
      product_id: r.product_id,
      initial_qty: Number(r.initial_qty),
      kirim_qty: Number(r.kirim_qty),
      auto_qty: Number(r.auto_qty),
      sold_qty: Number(r.sold_qty),
      writeoff_qty: Number(r.writeoff_qty),
      balance: Number(r.balance),
    }
  }
  return out
}

/** Sotish uchun mavjud butun son (minus qoldiq 0 hisoblanadi) */
export function availableQty(balance: number): number {
  return Math.max(0, Math.floor(balance))
}

/** Savatdagi miqdorni shu songa chiqarish mumkinmi? Yumshoq va cheksiz rejimda doim mumkin. */
export function canSetQty(mode: StockMode, balance: number, qty: number): boolean {
  return mode !== 'strict' || qty <= availableQty(balance)
}

/** Savatdagi miqdorning tizim qoldig'idan oshgan qismi - buyurtmada avto-kirim bo'ladi */
export function extraQty(mode: StockMode, balance: number, qty: number): number {
  if (mode !== 'soft') return 0
  return Math.max(0, qty - availableQty(balance))
}

/** Mahsulot kartasi kassir ro'yxatida ko'rinadimi? */
export function isVisible(
  p: { is_available: boolean; hide_when_empty?: boolean | null },
  mode: StockMode,
  balance: number,
): boolean {
  if (!p.is_available) return false
  if (!p.hide_when_empty) return true
  // Yumshoq mahsulot "tizimda tugagan" bo'lsa ham haqiqatda bo'lishi mumkin, yashirilmaydi
  if (mode === 'soft') return true
  return balance > 0
}

export type StockLevel = 'ok' | 'low' | 'empty' | 'extra' | 'muted'
export type StockInfo = { level: StockLevel; text: string }

/** Kartadagi qoldiq yozuvi. null - hech narsa ko'rsatilmaydi. */
export function stockInfo(mode: StockMode, balance: number, unit = 'ta'): StockInfo | null {
  const b = availableQty(balance)
  if (mode === 'none') return b > 0 ? { level: 'muted', text: `~${b} ${unit}` } : null
  if (b <= 0) {
    return mode === 'soft'
      ? { level: 'extra', text: 'Tizimda tugagan' }
      : { level: 'empty', text: 'Tugadi!' }
  }
  return { level: b <= 5 ? 'low' : 'ok', text: `Qoldiq: ${b} ${unit}` }
}

export type NewOrderExtra = { product_id: string; name: string; qty: number }

/** create_order natijasidagi avto-kirim xabari: "Osh butun +2, Somsa +3" */
export function extraSummary(extra: NewOrderExtra[] | null | undefined): string {
  return (extra ?? []).map(e => `${e.name} +${e.qty}`).join(', ')
}
