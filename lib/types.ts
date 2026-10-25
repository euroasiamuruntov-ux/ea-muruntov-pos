import type { StockMode } from './stock'

// Bazadagi jadvallar turlari (sahifalar uchun umumiy)
export type Category = { id: string; name: string; order_num: number }

export type Product = {
  id: string
  name: string
  price: number
  category_id: string | null
  is_available: boolean
  unit_type?: string
  hissa_per_unit?: number
  kg_to_hissa?: number
  litr_per_unit?: number | null
  stock_mode?: StockMode
  is_unlimited?: boolean
  is_favorite?: boolean
  hide_when_empty?: boolean
}

export type Shift = {
  id: string
  is_open: boolean
  opened_at: string
  closed_at?: string | null
  opened_by?: string | null
  closed_by?: string | null
}

export type ShiftStock = { product_id: string; initial_qty: number }

export type Order = {
  id: string
  total: number
  pay_type: string
  debt_paid: boolean
  debtor_name: string | null
  worker_id: string
  created_at: string
  actual_paid?: number | null
  payment_note?: string | null
}

export type OrderItem = { order_id: string; product_id: string; qty: number; price: number }

export type Worker = { id: string; name: string; pin: string; role: string }

export type WriteOff = { id: string; product_id: string; qty: number; reason: string; worker_id: string; created_at: string }

export type StockIn = {
  id: string
  product_id: string
  qty: number
  worker_id: string
  created_at: string
  source?: string
  note?: string | null
}

export type Debtor = { id: string; name: string; phone: string; total_debt: number }

/** shift_summary ko'rinishi (bazadagi VIEW) */
export type ShiftSummary = {
  id: string
  opened_at: string
  closed_at: string | null
  is_open: boolean
  opened_by_name: string | null
  closed_by_name: string | null
  order_count: number
  total_revenue: number
  cash_revenue: number
  click_revenue: number
  card_revenue: number
  debt_revenue: number
  ichki_count: number
}
