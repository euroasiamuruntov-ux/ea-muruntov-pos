import { supabase } from './supabase'

export type Product = {
  id: string; name: string; price: number; category_id: string
  is_available: boolean; unit_type: string; hissa_per_unit: number
  kg_to_hissa: number; is_unlimited: boolean; unit_label: string
  litr_per_unit: number | null
}

export type CartItem = { product: Product; qty: number }
export type Bill = { id: number; cart: CartItem[] }
export type Shift = { id: string; is_open: boolean; opened_at: string }
export type Stock = { product_id: string; initial_qty: number; sold_qty?: number }
export type StockIn = { id: string; product_id: string; qty: number }
export type WriteOff = { id: string; product_id: string; qty: number }
export type Debtor = { id: string; name: string; phone: string; total_debt: number }
export type Category = { id: string; name: string }

export const fmt = (n: number) => n.toLocaleString('uz-UZ')

export function getHissaQoldiq(
  product: Product,
  shift: Shift | null,
  hissaStock: {[id: string]: number}
): number {
  if (product.unit_type !== 'hissa') return 999
  if (!shift) return 0
  return Math.floor((hissaStock[shift.id] || 0) / product.hissa_per_unit)
}

export function getDonaQoldiq(
  productId: string,
  shift: Shift | null,
  stocks: Stock[],
  stockIns: StockIn[],
  writeOffs: WriteOff[],
  orderItems: {product_id: string; qty: number; order_id: string}[],
  shiftOrderIds: string[]
): number | null {
  if (!shift) return null
  const stock = stocks.find(s => s.product_id === productId)
  if (!stock) return null

  const kirim = stockIns
    .filter(si => si.product_id === productId)
    .reduce((s, si) => s + si.qty, 0)

  const sotildi = orderItems
    .filter(oi => oi.product_id === productId && shiftOrderIds.includes(oi.order_id))
    .reduce((s, oi) => s + oi.qty, 0)

  const chiqim = writeOffs
    .filter(w => w.product_id === productId)
    .reduce((s, w) => s + w.qty, 0)

  return (stock.initial_qty || 0) + kirim - sotildi - chiqim
}

export function getKampotStakan(
  product: Product,
  donaQoldiq: number | null
): number | null {
  if (!product.litr_per_unit || donaQoldiq === null) return null
  return Math.floor(donaQoldiq / product.litr_per_unit)
}