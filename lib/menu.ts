import { matchesQuery } from './search'
import { stockModeOf } from './stock'
import type { Product } from './types'

export type MenuStatusFilter = 'all' | 'favorite' | 'unavailable' | 'strict' | 'soft' | 'none'

export const STATUS_FILTERS: { id: MenuStatusFilter; label: string }[] = [
  { id: 'all', label: 'Hammasi' },
  { id: 'favorite', label: '⭐ Tez-tez' },
  { id: 'unavailable', label: "Yo'q" },
  { id: 'strict', label: "Qat'iy" },
  { id: 'soft', label: 'Yumshoq' },
  { id: 'none', label: 'Cheksiz' },
]

/** Menyu ro'yxatini qidiruv, kategoriya va holat bo'yicha saralaydi */
export function filterMenu(
  products: Product[],
  opts: { query: string; categoryId: string; status: MenuStatusFilter },
): Product[] {
  return products.filter(p => {
    if (opts.categoryId !== 'all' && p.category_id !== opts.categoryId) return false
    if (!matchesQuery(p.name, opts.query)) return false
    switch (opts.status) {
      case 'favorite': return !!p.is_favorite
      case 'unavailable': return !p.is_available
      case 'strict':
      case 'soft':
      case 'none': return stockModeOf(p) === opts.status
      default: return true
    }
  })
}

/** Narx kiritish: faqat musbat butun son (so'm) */
export function parsePrice(raw: string): number | null {
  const n = Number(String(raw).replace(/\s/g, ''))
  return Number.isInteger(n) && n > 0 ? n : null
}
