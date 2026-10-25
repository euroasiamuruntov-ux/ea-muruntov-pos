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
