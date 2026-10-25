import { describe, expect, it } from 'vitest'
import { filterMenu, parsePrice } from './menu'
import type { Product } from './types'

const p = (over: Partial<Product>): Product => ({ id: 'x', name: 'Taom', price: 1000, category_id: 'c1', is_available: true, ...over })

const list: Product[] = [
  p({ id: '1', name: 'Osh (butun)', category_id: 'c1', stock_mode: 'soft', is_favorite: true }),
  p({ id: '2', name: 'Osh (yarim)', category_id: 'c1', stock_mode: 'soft' }),
  p({ id: '3', name: 'Cola 1L', category_id: 'c2', stock_mode: 'strict', is_available: false }),
  p({ id: '4', name: 'Mastava', category_id: 'c1', is_unlimited: true }),
]
const ids = (r: Product[]) => r.map(x => x.id)

describe('filterMenu', () => {
  it('filtrsiz hammasi', () => {
    expect(ids(filterMenu(list, { query: '', categoryId: 'all', status: 'all' }))).toEqual(['1', '2', '3', '4'])
  })
  it('qidiruv nom bo\'yicha', () => {
    expect(ids(filterMenu(list, { query: 'osh', categoryId: 'all', status: 'all' }))).toEqual(['1', '2'])
  })
  it('kategoriya bo\'yicha', () => {
    expect(ids(filterMenu(list, { query: '', categoryId: 'c2', status: 'all' }))).toEqual(['3'])
  })
  it('holat bo\'yicha: yulduzcha, yo\'q, rejimlar', () => {
    expect(ids(filterMenu(list, { query: '', categoryId: 'all', status: 'favorite' }))).toEqual(['1'])
    expect(ids(filterMenu(list, { query: '', categoryId: 'all', status: 'unavailable' }))).toEqual(['3'])
    expect(ids(filterMenu(list, { query: '', categoryId: 'all', status: 'soft' }))).toEqual(['1', '2'])
    expect(ids(filterMenu(list, { query: '', categoryId: 'all', status: 'strict' }))).toEqual(['3'])
    // stock_mode yo'q eski mahsulot is_unlimited dan cheksiz hisoblanadi
    expect(ids(filterMenu(list, { query: '', categoryId: 'all', status: 'none' }))).toEqual(['4'])
  })
  it('filtrlar birga ishlaydi', () => {
    expect(ids(filterMenu(list, { query: 'osh', categoryId: 'c1', status: 'favorite' }))).toEqual(['1'])
  })
})

describe('parsePrice', () => {
  it('musbat butun son', () => {
    expect(parsePrice('15000')).toBe(15000)
    expect(parsePrice('15 000')).toBe(15000)
  })
  it('noto\'g\'ri qiymatlar', () => {
    expect(parsePrice('')).toBeNull()
    expect(parsePrice('0')).toBeNull()
    expect(parsePrice('-5')).toBeNull()
    expect(parsePrice('12.5')).toBeNull()
    expect(parsePrice('abc')).toBeNull()
  })
})
